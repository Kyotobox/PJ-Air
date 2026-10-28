/// GlobalCircuitBreaker & 529 Resilience Engine (TASK-G205-03 / SPEC-RESILIENCE-01)
///
/// Mitiga el thundering herd y la sobrecarga de proveedores LLM (HTTP 529 Overloaded)
/// persistiendo el estado en SQLite WAL local como fuente única de verdad (§39, §45).
/// Implementa backoff con decorrelated jitter y bloqueo determinista en estado OPEN.
library;

import 'dart:io';
import 'dart:math';
import 'package:sqlite3/sqlite3.dart';

/// Estados de la máquina finita del Circuit Breaker
enum CircuitState { closed, open, halfOpen }

/// Excepción lanzada cuando una petición es bloqueada por estar el circuito en estado OPEN
class CircuitBreakerOpenException implements Exception {
  final String circuitId;
  final int retryAfterMs;
  final String message;

  const CircuitBreakerOpenException({
    required this.circuitId,
    required this.retryAfterMs,
    this.message =
        'Circuito en estado OPEN. Solicitudes bloqueadas por resiliencia.',
  });

  @override
  String toString() =>
      '[CIRCUIT_BREAKER_OPEN] ($circuitId): $message (Retry-After: ${retryAfterMs}ms)';
}

/// Snapshot inmutable del estado del Circuit Breaker
class CircuitStateSnapshot {
  final String id;
  final CircuitState state;
  final int failureCount;
  final DateTime? lastFailureAt;
  final DateTime? openedAt;
  final int retryAfterMs;
  final DateTime updatedAt;

  const CircuitStateSnapshot({
    required this.id,
    required this.state,
    required this.failureCount,
    this.lastFailureAt,
    this.openedAt,
    required this.retryAfterMs,
    required this.updatedAt,
  });
}

/// Circuito de Resiliencia Global persistido en SQLite WAL
class GlobalCircuitBreaker {
  final String circuitId;
  final String dbPath;
  final Random _random;
  final int failureThreshold;
  final Duration windowDuration;
  final int maxBackoffMs;
  Database? _db;

  GlobalCircuitBreaker({
    this.circuitId = 'llm_provider_global',
    this.dbPath = 'vault/runtime/circuit_breaker_state.db',
    this.failureThreshold = 3,
    this.windowDuration = const Duration(seconds: 10),
    this.maxBackoffMs = 120000,
    Random? random,
    Database? customDb,
  }) : _random = random ?? Random(),
       _db = customDb;

  /// Inicializa la base de datos y el esquema DDL si no fue inyectada
  void init() {
    if (_db == null) {
      final File file = File(dbPath);
      if (!file.parent.existsSync()) {
        file.parent.createSync(recursive: true);
      }
      _db = sqlite3.open(dbPath);
    }

    _applyPragmasAndSchema(_db!);
  }

  static void _applyPragmasAndSchema(Database db) {
    db.execute('PRAGMA journal_mode = WAL;');
    db.execute('PRAGMA synchronous = NORMAL;');

    db.execute('''
CREATE TABLE IF NOT EXISTS circuit_state (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TEXT NULL,
  opened_at TEXT NULL,
  retry_after_ms INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
''');
  }

  Database get _activeDb {
    if (_db == null) {
      init();
    }
    return _db!;
  }

  /// Retorna el estado actual del circuito evaluando tiempos de recuperación
  CircuitState getState({DateTime? now}) {
    final CircuitStateSnapshot snapshot = getSnapshot(now: now);
    return snapshot.state;
  }

  /// Retorna un snapshot completo y consistente del estado
  CircuitStateSnapshot getSnapshot({DateTime? now}) {
    final DateTime current = now ?? DateTime.now().toUtc();
    final Database db = _activeDb;

    final ResultSet rows = db.select(
      'SELECT * FROM circuit_state WHERE id = ?',
      <Object?>[circuitId],
    );

    if (rows.isEmpty) {
      return CircuitStateSnapshot(
        id: circuitId,
        state: CircuitState.closed,
        failureCount: 0,
        retryAfterMs: 0,
        updatedAt: current,
      );
    }

    final Row row = rows.first;
    final String stateStr = row['state'] as String;
    final int failureCount = row['failure_count'] as int;
    final DateTime? lastFailureAt = row['last_failure_at'] != null
        ? DateTime.tryParse(row['last_failure_at'] as String)
        : null;
    final DateTime? openedAt = row['opened_at'] != null
        ? DateTime.tryParse(row['opened_at'] as String)
        : null;
    final int retryAfterMs = row['retry_after_ms'] as int;
    final DateTime updatedAt =
        DateTime.tryParse(row['updated_at'] as String) ?? current;

    CircuitState state = CircuitState.closed;
    if (stateStr == 'OPEN') {
      state = CircuitState.open;
      // Verificar si ya transcurrió el backoff para pasar a HALF_OPEN
      if (openedAt != null) {
        final int elapsedMs = current.difference(openedAt).inMilliseconds;
        if (elapsedMs >= retryAfterMs) {
          state = CircuitState.halfOpen;
          _updateState(state: CircuitState.halfOpen, now: current);
        }
      }
    } else if (stateStr == 'HALF_OPEN') {
      state = CircuitState.halfOpen;
    }

    return CircuitStateSnapshot(
      id: circuitId,
      state: state,
      failureCount: failureCount,
      lastFailureAt: lastFailureAt,
      openedAt: openedAt,
      retryAfterMs: retryAfterMs,
      updatedAt: updatedAt,
    );
  }

  /// Evalúa si una petición puede ejecutarse según el estado del circuito
  bool canExecute({DateTime? now}) {
    final CircuitState state = getState(now: now);
    return state != CircuitState.open;
  }

  /// Verifica si puede ejecutarse; si está en OPEN, arroja [CircuitBreakerOpenException]
  void checkExecutionPermission({DateTime? now}) {
    final CircuitStateSnapshot snapshot = getSnapshot(now: now);
    if (snapshot.state == CircuitState.open) {
      final DateTime current = now ?? DateTime.now().toUtc();
      int remainingMs = snapshot.retryAfterMs;
      if (snapshot.openedAt != null) {
        final int elapsed = current
            .difference(snapshot.openedAt!)
            .inMilliseconds;
        remainingMs = max(0, snapshot.retryAfterMs - elapsed);
      }
      throw CircuitBreakerOpenException(
        circuitId: circuitId,
        retryAfterMs: remainingMs,
      );
    }
  }

  /// Registra una respuesta exitosa (cierra el circuito si estaba en HALF_OPEN o resetea fallos)
  void recordSuccess({DateTime? now}) {
    final DateTime current = now ?? DateTime.now().toUtc();
    final Database db = _activeDb;

    db.execute('BEGIN IMMEDIATE;');
    try {
      final CircuitStateSnapshot snapshot = getSnapshot(now: current);
      if (snapshot.state == CircuitState.halfOpen ||
          snapshot.failureCount > 0) {
        db.execute(
          '''
INSERT INTO circuit_state (id, state, failure_count, last_failure_at, opened_at, retry_after_ms, updated_at)
VALUES (?, 'CLOSED', 0, NULL, NULL, 0, ?)
ON CONFLICT(id) DO UPDATE SET
  state = 'CLOSED',
  failure_count = 0,
  last_failure_at = NULL,
  opened_at = NULL,
  retry_after_ms = 0,
  updated_at = excluded.updated_at;
''',
          <Object?>[circuitId, current.toIso8601String()],
        );
      }
      db.execute('COMMIT;');
    } catch (_) {
      db.execute('ROLLBACK;');
      rethrow;
    }
  }

  /// Registra una respuesta fallida (especialmente HTTP 529 Overloaded)
  void recordFailure(int statusCode, {DateTime? now}) {
    // Solo HTTP 529 (Overloaded) o HTTP 503 dispara la apertura por thundering herd
    if (statusCode != 529 && statusCode != 503) {
      return;
    }

    final DateTime current = now ?? DateTime.now().toUtc();
    final Database db = _activeDb;

    db.execute('BEGIN IMMEDIATE;');
    try {
      final CircuitStateSnapshot snapshot = getSnapshot(now: current);

      // Si estábamos en HALF_OPEN y la sonda falló: reabrir inmediatamente con jitter aumentado
      if (snapshot.state == CircuitState.halfOpen) {
        final int newJitter = _calculateDecorrelatedJitter(
          snapshot.retryAfterMs,
        );
        _persistOpenState(
          db: db,
          now: current,
          failureCount: snapshot.failureCount + 1,
          retryAfterMs: newJitter,
        );
        db.execute('COMMIT;');
        return;
      }

      // Si el circuito estaba en CLOSED: evaluar ventana deslizante
      int newCount = 1;
      if (snapshot.lastFailureAt != null) {
        final Duration windowDiff = current.difference(snapshot.lastFailureAt!);
        if (windowDiff <= windowDuration) {
          newCount = snapshot.failureCount + 1;
        }
      }

      if (newCount >= failureThreshold) {
        // Disparar apertura del circuito con decorrelated jitter
        final int initialJitter = _calculateDecorrelatedJitter(0);
        _persistOpenState(
          db: db,
          now: current,
          failureCount: newCount,
          retryAfterMs: initialJitter,
        );
      } else {
        // Solo registrar incremento de fallo
        db.execute(
          '''
INSERT INTO circuit_state (id, state, failure_count, last_failure_at, opened_at, retry_after_ms, updated_at)
VALUES (?, 'CLOSED', ?, ?, NULL, 0, ?)
ON CONFLICT(id) DO UPDATE SET
  failure_count = excluded.failure_count,
  last_failure_at = excluded.last_failure_at,
  updated_at = excluded.updated_at;
''',
          <Object?>[
            circuitId,
            newCount,
            current.toIso8601String(),
            current.toIso8601String(),
          ],
        );
      }

      db.execute('COMMIT;');
    } catch (_) {
      db.execute('ROLLBACK;');
      rethrow;
    }
  }

  void _persistOpenState({
    required Database db,
    required DateTime now,
    required int failureCount,
    required int retryAfterMs,
  }) {
    db.execute(
      '''
INSERT INTO circuit_state (id, state, failure_count, last_failure_at, opened_at, retry_after_ms, updated_at)
VALUES (?, 'OPEN', ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  state = 'OPEN',
  failure_count = excluded.failure_count,
  last_failure_at = excluded.last_failure_at,
  opened_at = excluded.opened_at,
  retry_after_ms = excluded.retry_after_ms,
  updated_at = excluded.updated_at;
''',
      <Object?>[
        circuitId,
        failureCount,
        now.toIso8601String(),
        now.toIso8601String(),
        retryAfterMs,
        now.toIso8601String(),
      ],
    );
  }

  void _updateState({required CircuitState state, required DateTime now}) {
    final String stateStr = state == CircuitState.halfOpen
        ? 'HALF_OPEN'
        : (state == CircuitState.open ? 'OPEN' : 'CLOSED');
    _activeDb.execute(
      '''
UPDATE circuit_state
SET state = ?, updated_at = ?
WHERE id = ?;
''',
      <Object?>[stateStr, now.toIso8601String(), circuitId],
    );
  }

  /// Fórmula canónica de Decorrelated Jitter:
  /// sleep = min(maxBackoff, uniform(1000ms, prev * 3))
  int _calculateDecorrelatedJitter(int prevMs) {
    const int minMs = 1000;
    final int base = prevMs <= 0 ? minMs : prevMs;
    final int upper = min(maxBackoffMs, base * 3);
    if (upper <= minMs) return minMs;
    return minMs + _random.nextInt(upper - minMs + 1);
  }

  /// Resetea el circuito a estado CLOSED (útil para tests o mantenimiento)
  void reset() {
    _activeDb.execute(
      '''
DELETE FROM circuit_state WHERE id = ?;
''',
      <Object?>[circuitId],
    );
  }

  /// Cierra la conexión física
  void close() {
    _db?.close();
    _db = null;
  }

  /// Alias de compatibilidad hacia atrás
  @Deprecated('Use close() instead')
  void dispose() => close();
}
