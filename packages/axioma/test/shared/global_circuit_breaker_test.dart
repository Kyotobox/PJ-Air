import 'dart:io';
import 'package:sqlite3/sqlite3.dart';
import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('TASK-G205-03: GlobalCircuitBreaker con SQLite WAL (§39, §45)', () {
    late Database memoryDb;
    late GlobalCircuitBreaker breaker;

    setUp(() {
      memoryDb = sqlite3.openInMemory();
      breaker = GlobalCircuitBreaker(
        circuitId: 'test_circuit',
        customDb: memoryDb,
        failureThreshold: 3,
        windowDuration: const Duration(seconds: 10),
      );
      breaker.init();
    });

    tearDown(() {
      breaker.close();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // HAPPY PATHS
    // ─────────────────────────────────────────────────────────────────────────
    test(
      'Happy Path 1: Circuito cerrado permite ejecución inicial y persiste en SQLite',
      () {
        expect(breaker.getState(), equals(CircuitState.closed));
        expect(breaker.canExecute(), isTrue);

        final CircuitStateSnapshot snapshot = breaker.getSnapshot();
        expect(snapshot.failureCount, equals(0));
        expect(snapshot.state, equals(CircuitState.closed));
      },
    );

    test(
      'Happy Path 2: 3 fallos HTTP 529 en ventana de 10s abren el circuito',
      () {
        final DateTime t0 = DateTime.utc(2026, 10, 12, 10, 0, 0);

        breaker.recordFailure(529, now: t0);
        expect(breaker.getState(now: t0), equals(CircuitState.closed));

        breaker.recordFailure(529, now: t0.add(const Duration(seconds: 2)));
        expect(
          breaker.getState(now: t0.add(const Duration(seconds: 2))),
          equals(CircuitState.closed),
        );

        // 3er fallo dentro de la ventana de 10s: se abre
        breaker.recordFailure(529, now: t0.add(const Duration(seconds: 4)));
        final CircuitState state = breaker.getState(
          now: t0.add(const Duration(seconds: 4)),
        );

        expect(state, equals(CircuitState.open));
        expect(
          breaker.canExecute(now: t0.add(const Duration(seconds: 4))),
          isFalse,
        );

        final CircuitStateSnapshot snapshot = breaker.getSnapshot(
          now: t0.add(const Duration(seconds: 4)),
        );
        expect(snapshot.failureCount, equals(3));
        expect(snapshot.retryAfterMs, greaterThanOrEqualTo(1000));
      },
    );

    test(
      'Happy Path 3: Recuperación ordenada CLOSED tras HALF_OPEN y prueba exitosa',
      () {
        final DateTime t0 = DateTime.utc(2026, 10, 12, 10, 0, 0);

        // Abrir el circuito
        breaker.recordFailure(529, now: t0);
        breaker.recordFailure(529, now: t0.add(const Duration(seconds: 1)));
        breaker.recordFailure(529, now: t0.add(const Duration(seconds: 2)));

        final CircuitStateSnapshot snapshotOpen = breaker.getSnapshot(
          now: t0.add(const Duration(seconds: 2)),
        );
        expect(snapshotOpen.state, equals(CircuitState.open));

        // Avanzar el tiempo más allá de retryAfterMs
        final DateTime tHalfOpen = t0.add(
          Duration(milliseconds: 2000 + snapshotOpen.retryAfterMs + 100),
        );
        expect(breaker.getState(now: tHalfOpen), equals(CircuitState.halfOpen));
        expect(breaker.canExecute(now: tHalfOpen), isTrue);

        // Sonda exitosa cierra el circuito
        breaker.recordSuccess(now: tHalfOpen);
        expect(breaker.getState(now: tHalfOpen), equals(CircuitState.closed));
        expect(breaker.getSnapshot(now: tHalfOpen).failureCount, equals(0));
      },
    );

    // ─────────────────────────────────────────────────────────────────────────
    // SAD PATHS (§6, §16)
    // ─────────────────────────────────────────────────────────────────────────
    test(
      'Sad Path 1: Solicitud en estado OPEN lanza CircuitBreakerOpenException',
      () {
        final DateTime t0 = DateTime.utc(2026, 10, 12, 10, 0, 0);
        breaker.recordFailure(529, now: t0);
        breaker.recordFailure(529, now: t0);
        breaker.recordFailure(529, now: t0);

        expect(
          () => breaker.checkExecutionPermission(now: t0),
          throwsA(isA<CircuitBreakerOpenException>()),
        );
      },
    );

    test(
      'Sad Path 2: Errores no-529 (ej. 400 Bad Request) no abren el circuito',
      () {
        final DateTime t0 = DateTime.utc(2026, 10, 12, 10, 0, 0);
        breaker.recordFailure(400, now: t0);
        breaker.recordFailure(404, now: t0);
        breaker.recordFailure(500, now: t0);

        expect(breaker.getState(now: t0), equals(CircuitState.closed));
        expect(breaker.getSnapshot(now: t0).failureCount, equals(0));
      },
    );

    test(
      'Sad Path 3: Fallo en HALF_OPEN retorna inmediatamente a OPEN con nuevo jitter',
      () {
        final DateTime t0 = DateTime.utc(2026, 10, 12, 10, 0, 0);
        breaker.recordFailure(529, now: t0);
        breaker.recordFailure(529, now: t0);
        breaker.recordFailure(529, now: t0);

        final CircuitStateSnapshot openSnapshot = breaker.getSnapshot(now: t0);
        final DateTime tHalfOpen = t0.add(
          Duration(milliseconds: openSnapshot.retryAfterMs + 500),
        );
        expect(breaker.getState(now: tHalfOpen), equals(CircuitState.halfOpen));

        // Sonda falla con 529: debe reabrir
        breaker.recordFailure(529, now: tHalfOpen);
        expect(breaker.getState(now: tHalfOpen), equals(CircuitState.open));
        expect(breaker.canExecute(now: tHalfOpen), isFalse);
      },
    );
  });

  group(
    'TASK-G208-02: SQLite WAL Concurrency & Inter-Process Resiliency (§39, §45)',
    () {
      late Directory tempDir;
      late String dbFilePath;

      setUp(() {
        tempDir = Directory.systemTemp.createTempSync(
          'circuit_breaker_wal_test_',
        );
        dbFilePath = '${tempDir.path}${Platform.pathSeparator}circuit_state.db';
      });

      tearDown(() {
        if (tempDir.existsSync()) {
          try {
            tempDir.deleteSync(recursive: true);
          } catch (_) {}
        }
      });

      test(
        'Happy Path: Sincronización multi-instancia vía SQLite WAL en disco',
        () {
          final GlobalCircuitBreaker nodeA = GlobalCircuitBreaker(
            circuitId: 'shared_llm_bus',
            dbPath: dbFilePath,
            failureThreshold: 2,
          );
          final GlobalCircuitBreaker nodeB = GlobalCircuitBreaker(
            circuitId: 'shared_llm_bus',
            dbPath: dbFilePath,
            failureThreshold: 2,
          );

          nodeA.init();
          nodeB.init();

          expect(nodeA.getState(), equals(CircuitState.closed));
          expect(nodeB.getState(), equals(CircuitState.closed));

          final DateTime t0 = DateTime.utc(2026, 10, 13, 12, 0, 0);

          // Node A registra fallo 1
          nodeA.recordFailure(529, now: t0);
          expect(nodeB.getSnapshot(now: t0).failureCount, equals(1));
          expect(nodeB.getState(now: t0), equals(CircuitState.closed));

          // Node B registra fallo 2 -> supera umbral y abre el breaker globalmente
          nodeB.recordFailure(529, now: t0.add(const Duration(seconds: 1)));
          expect(
            nodeA.getState(now: t0.add(const Duration(seconds: 1))),
            equals(CircuitState.open),
          );
          expect(
            nodeB.getState(now: t0.add(const Duration(seconds: 1))),
            equals(CircuitState.open),
          );

          // Node A verifica que canExecute está bloqueado
          expect(
            nodeA.canExecute(now: t0.add(const Duration(seconds: 1))),
            isFalse,
          );

          nodeA.close();
          nodeB.close();
        },
      );

      test(
        'Sad Path: Concurrencia de escrituras interleaved sin bloqueos corruptos',
        () {
          final GlobalCircuitBreaker nodeA = GlobalCircuitBreaker(
            circuitId: 'shared_llm_bus',
            dbPath: dbFilePath,
            failureThreshold: 5,
          );
          final GlobalCircuitBreaker nodeB = GlobalCircuitBreaker(
            circuitId: 'shared_llm_bus',
            dbPath: dbFilePath,
            failureThreshold: 5,
          );

          nodeA.init();
          nodeB.init();

          final DateTime t0 = DateTime.utc(2026, 10, 13, 12, 0, 0);
          for (int i = 0; i < 4; i++) {
            if (i.isEven) {
              nodeA.recordFailure(
                529,
                now: t0.add(Duration(milliseconds: i * 200)),
              );
            } else {
              nodeB.recordFailure(
                529,
                now: t0.add(Duration(milliseconds: i * 200)),
              );
            }
          }

          // Ambos nodos deben leer de manera consistente failureCount = 4
          final CircuitStateSnapshot snapA = nodeA.getSnapshot(
            now: t0.add(const Duration(seconds: 1)),
          );
          final CircuitStateSnapshot snapB = nodeB.getSnapshot(
            now: t0.add(const Duration(seconds: 1)),
          );

          expect(snapA.failureCount, equals(4));
          expect(snapB.failureCount, equals(4));
          expect(snapA.state, equals(CircuitState.closed));

          // Node A registra éxito y limpia el estado para ambos
          nodeA.recordSuccess(now: t0.add(const Duration(seconds: 2)));
          expect(nodeB.getSnapshot().failureCount, equals(0));

          nodeA.close();
          nodeB.close();
        },
      );
    },
  );
}
