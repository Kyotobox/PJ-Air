// 🎯 Implementación SQLite de Almacén de Sesiones FSM con TTL Perezoso y Bloqueo Optimista (§39, §45)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios,
// §12.b Límite 5 archivos, §39 Pure Dart, §40 Thin Client, §45 Soberanía Offline-First,
// §48 Cierre Autárquico, Calm Error UX.

import 'dart:convert';
import 'package:sqlite3/sqlite3.dart';

import '../testing/test_database_factory.dart';
import 'flow_session_store.dart';

export 'flow_session_store.dart';

/// Almacén SQLite embebido liviano para sesiones FSM con purga perezosa (>24h)
/// y control de versión optimista (stateVersion) anti-concurrencia sin daemons residentes.
class SqliteFlowSessionStore implements FlowSessionStore {
  /// Base de datos SQLite subyacente.
  final Database db;

  /// Tiempo de vida máximo permitido para una sesión desde su última actualización.
  final Duration ttl;

  /// Proveedor de tiempo inyectable para pruebas deterministas.
  final DateTime Function()? clock;

  /// Indica si la instancia es propietaria del ciclo de vida de [db].
  final bool _ownsDb;

  /// Nombre canónico de la tabla única de sesiones.
  static const String tableName = 'flow_sessions';

  /// Constructor principal con base de datos SQLite pre-inicializada.
  SqliteFlowSessionStore(
    this.db, {
    this.ttl = FlowSessionStore.defaultTtl,
    this.clock,
    bool ownsDb = false,
  }) : _ownsDb = ownsDb {
    _initSchema();
  }

  /// Crea una instancia 100% en memoria RAM (`:memory:`) determinista y sin mocks (§4).
  factory SqliteFlowSessionStore.inMemory({
    Duration ttl = FlowSessionStore.defaultTtl,
    DateTime Function()? clock,
  }) {
    TestDatabaseFactory.ensureInitialized();
    final Database memoryDb = sqlite3.openInMemory();
    return SqliteFlowSessionStore(
      memoryDb,
      ttl: ttl,
      clock: clock,
      ownsDb: true,
    );
  }

  /// Abre o crea una base de datos SQLite persistente en disco.
  factory SqliteFlowSessionStore.openFile(
    String path, {
    Duration ttl = FlowSessionStore.defaultTtl,
    DateTime Function()? clock,
  }) {
    TestDatabaseFactory.ensureInitialized();
    final Database fileDb = sqlite3.open(path);
    return SqliteFlowSessionStore(fileDb, ttl: ttl, clock: clock, ownsDb: true);
  }

  /// Inicializa la tabla única indexada por `session_id` e índice de expiración `updated_at`.
  void _initSchema() {
    db.execute('''
      CREATE TABLE IF NOT EXISTS $tableName (
        session_id TEXT PRIMARY KEY NOT NULL,
        state_version INTEGER NOT NULL DEFAULT 1,
        current_step TEXT NOT NULL,
        state_json TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_flow_sessions_session_id 
        ON $tableName(session_id);

      CREATE INDEX IF NOT EXISTS idx_flow_sessions_updated_at 
        ON $tableName(updated_at);
    ''');
  }

  DateTime _now({DateTime? override}) {
    if (override != null) return override.toUtc();
    if (clock != null) return clock!().toUtc();
    return DateTime.now().toUtc();
  }

  @override
  int purgeExpiredSessions({DateTime? now}) {
    final DateTime effectiveNow = _now(override: now);
    final String cutoff = effectiveNow.subtract(ttl).toIso8601String();
    db.execute('DELETE FROM $tableName WHERE updated_at < ?', <Object?>[
      cutoff,
    ]);
    return db.updatedRows;
  }

  /// Ejecuta purga perezosa de sesiones expiradas previo a cualquier operación de lectura.
  void _lazyPurge({DateTime? now}) {
    purgeExpiredSessions(now: now);
  }

  @override
  FlowSessionRecord? loadSession(String sessionId, {DateTime? now}) {
    final String cleanId = sessionId.trim();
    if (cleanId.isEmpty) {
      throw ArgumentError.value(
        sessionId,
        'sessionId',
        'El identificador de sesión no puede ser vacío.',
      );
    }

    // 1. Purga perezosa sin daemons residentes
    _lazyPurge(now: now);

    // 2. Consulta de la sesión
    final PreparedStatement stmt = db.prepare(
      'SELECT session_id, state_version, current_step, state_json, metadata_json, created_at, updated_at '
      'FROM $tableName WHERE session_id = ?',
    );

    try {
      final ResultSet result = stmt.select(<Object?>[cleanId]);
      if (result.isEmpty) {
        return null;
      }

      final Row row = result.first;
      final Map<String, dynamic> stateMap =
          jsonDecode(row['state_json'] as String) as Map<String, dynamic>;
      final Map<String, dynamic> metadataMap =
          jsonDecode(row['metadata_json'] as String) as Map<String, dynamic>;

      return FlowSessionRecord(
        sessionId: row['session_id'] as String,
        flowState: flowStateFromJson(stateMap),
        stateVersion: row['state_version'] as int,
        createdAt: DateTime.parse(row['created_at'] as String).toUtc(),
        updatedAt: DateTime.parse(row['updated_at'] as String).toUtc(),
        metadata: metadataMap,
      );
    } finally {
      stmt.close();
    }
  }

  @override
  void saveSession(
    FlowSessionRecord session, {
    int? expectedVersion,
    DateTime? now,
    bool force = false,
  }) {
    final String cleanId = session.sessionId.trim();
    if (cleanId.isEmpty) {
      throw ArgumentError.value(
        session.sessionId,
        'sessionId',
        'El identificador de sesión no puede ser vacío.',
      );
    }

    final DateTime effectiveNow = _now(override: now);
    final String updatedAtIso = effectiveNow.toIso8601String();
    final String createdAtIso = session.createdAt.toUtc().toIso8601String();
    final String stateJson = jsonEncode(session.flowState.toJson());
    final String metadataJson = jsonEncode(session.metadata);

    // Consultar versión actual en base de datos
    final PreparedStatement selectStmt = db.prepare(
      'SELECT state_version FROM $tableName WHERE session_id = ?',
    );
    final int actualVersion;
    final bool exists;
    try {
      final ResultSet res = selectStmt.select(<Object?>[cleanId]);
      exists = res.isNotEmpty;
      actualVersion = exists ? (res.first['state_version'] as int) : 0;
    } finally {
      selectStmt.close();
    }

    // Control de versión optimista si no es forzado
    if (!force) {
      final int targetExpectedVersion;
      if (expectedVersion != null) {
        targetExpectedVersion = expectedVersion;
      } else {
        // Inferencia anti-concurrencia:
        // Si session.stateVersion es 1, se espera que no exista (expectedVersion: 0).
        // Si session.stateVersion > 1, se espera que en DB exista con (session.stateVersion - 1).
        targetExpectedVersion = session.stateVersion == 1
            ? 0
            : session.stateVersion - 1;
      }

      if (targetExpectedVersion != actualVersion) {
        throw OptimisticLockException(
          sessionId: cleanId,
          expectedVersion: targetExpectedVersion,
          actualVersion: actualVersion,
        );
      }
    }

    final int targetVersion =
        (!force &&
            expectedVersion != null &&
            session.stateVersion <= expectedVersion)
        ? expectedVersion + 1
        : session.stateVersion;

    if (!exists) {
      try {
        db.execute(
          'INSERT INTO $tableName ('
          'session_id, state_version, current_step, state_json, metadata_json, created_at, updated_at'
          ') VALUES (?, ?, ?, ?, ?, ?, ?)',
          <Object?>[
            cleanId,
            targetVersion,
            session.flowState.currentStep,
            stateJson,
            metadataJson,
            createdAtIso,
            updatedAtIso,
          ],
        );
      } on SqliteException {
        // Concurrencia de inserción: otra transacción insertó la sesión primero
        final int currentActual = _getActualVersion(cleanId);
        throw OptimisticLockException(
          sessionId: cleanId,
          expectedVersion: expectedVersion ?? 0,
          actualVersion: currentActual,
        );
      }
    } else {
      if (force) {
        db.execute(
          'UPDATE $tableName SET '
          'state_version = ?, '
          'current_step = ?, '
          'state_json = ?, '
          'metadata_json = ?, '
          'updated_at = ? '
          'WHERE session_id = ?',
          <Object?>[
            targetVersion,
            session.flowState.currentStep,
            stateJson,
            metadataJson,
            updatedAtIso,
            cleanId,
          ],
        );
      } else {
        // Actualización atómica condicionada por versión optimista
        final PreparedStatement updateStmt = db.prepare(
          'UPDATE $tableName SET '
          'state_version = ?, '
          'current_step = ?, '
          'state_json = ?, '
          'metadata_json = ?, '
          'updated_at = ? '
          'WHERE session_id = ? AND state_version = ?',
        );

        try {
          updateStmt.execute(<Object?>[
            targetVersion,
            session.flowState.currentStep,
            stateJson,
            metadataJson,
            updatedAtIso,
            cleanId,
            actualVersion,
          ]);

          if (db.updatedRows == 0) {
            final int currentActual = _getActualVersion(cleanId);
            throw OptimisticLockException(
              sessionId: cleanId,
              expectedVersion: actualVersion,
              actualVersion: currentActual,
            );
          }
        } finally {
          updateStmt.close();
        }
      }
    }
  }

  int _getActualVersion(String sessionId) {
    final PreparedStatement stmt = db.prepare(
      'SELECT state_version FROM $tableName WHERE session_id = ?',
    );
    try {
      final ResultSet res = stmt.select(<Object?>[sessionId]);
      return res.isNotEmpty ? (res.first['state_version'] as int) : 0;
    } finally {
      stmt.close();
    }
  }

  @override
  bool deleteSession(String sessionId) {
    final String cleanId = sessionId.trim();
    if (cleanId.isEmpty) return false;

    db.execute('DELETE FROM $tableName WHERE session_id = ?', <Object?>[
      cleanId,
    ]);
    return db.updatedRows > 0;
  }

  @override
  bool hasSession(String sessionId, {DateTime? now}) {
    final String cleanId = sessionId.trim();
    if (cleanId.isEmpty) return false;

    _lazyPurge(now: now);

    final PreparedStatement stmt = db.prepare(
      'SELECT 1 FROM $tableName WHERE session_id = ? LIMIT 1',
    );
    try {
      final ResultSet res = stmt.select(<Object?>[cleanId]);
      return res.isNotEmpty;
    } finally {
      stmt.close();
    }
  }

  /// Retorna la cantidad total de sesiones activas en el almacén.
  int get activeSessionCount {
    final ResultSet res = db.select('SELECT COUNT(*) as count FROM $tableName');
    return (res.first['count'] as num).toInt();
  }

  @override
  void close() {
    if (_ownsDb) {
      db.close();
    }
  }
}
