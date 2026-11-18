// 🎯 Suite de Certificación para SqliteFlowSessionStore — Pure Dart (§39, §45)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios,
// §12.b Límite 5 archivos, §39 Pure Dart, §40 Thin Client, §43 Paridad Test-to-Prod,
// §48 Cierre Autárquico, Calm Error UX.

import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:sqlite3/sqlite3.dart';
import 'package:test/test.dart';

// Importación canónica exclusiva desde el entry point de producción (§43 Paridad Test-to-Prod)
import 'package:axioma/flow.dart';

void main() {
  setUpAll(() {
    // Inicialización canónica de SQLite mediante el entry point de flujo (§4, §43)
    final SqliteFlowSessionStore warmUp = SqliteFlowSessionStore.inMemory();
    warmUp.close();
  });

  group('SqliteFlowSessionStore — Happy Path y Ciclo de Vida (§4, §39)', () {
    late SqliteFlowSessionStore store;

    setUp(() {
      store = SqliteFlowSessionStore.inMemory();
    });

    tearDown(() {
      store.close();
    });

    test(
      'Persiste sesión inicial (v1) y la recupera con fidelidad de estado completa',
      () {
        final FlowState state = FlowState.initial(
          initialStep: 'awaiting_input',
          initialSlots: <String, dynamic>{
            'user_role': 'buyer',
            'category': 'brakes',
          },
          metadata: <String, dynamic>{'source': 'telegram_webhook'},
        );

        final FlowSessionRecord session = FlowSessionRecord.initial(
          sessionId: 'session-alpha-101',
          flowState: state,
          metadata: <String, dynamic>{'tenant_id': 'tenant_01'},
        );

        store.saveSession(session);

        expect(store.activeSessionCount, equals(1));
        expect(store.hasSession('session-alpha-101'), isTrue);

        final FlowSessionRecord? loaded = store.loadSession(
          'session-alpha-101',
        );
        expect(loaded, isNotNull);
        expect(loaded!.sessionId, equals('session-alpha-101'));
        expect(loaded.stateVersion, equals(1));
        expect(loaded.flowState.currentStep, equals('awaiting_input'));
        expect(loaded.flowState.slots['user_role'], equals('buyer'));
        expect(loaded.flowState.slots['category'], equals('brakes'));
        expect(loaded.flowState.metadata['source'], equals('telegram_webhook'));
        expect(loaded.metadata['tenant_id'], equals('tenant_01'));
      },
    );

    test(
      'Actualiza sesión consecutivamente incrementando stateVersion con nextVersion',
      () {
        final FlowState initial = FlowState.initial(initialStep: 'step_one');
        final FlowSessionRecord s1 = FlowSessionRecord.initial(
          sessionId: 'session-seq-202',
          flowState: initial,
        );
        store.saveSession(s1);

        // Transición a versión 2
        final FlowState stepTwo = initial.copyWith(
          currentStep: 'step_two',
          turnCount: 1,
          slots: <String, dynamic>{'query': 'turbocharger'},
        );
        final FlowSessionRecord s2 = s1.nextVersion(flowState: stepTwo);
        store.saveSession(s2);

        final FlowSessionRecord? loaded2 = store.loadSession('session-seq-202');
        expect(loaded2, isNotNull);
        expect(loaded2!.stateVersion, equals(2));
        expect(loaded2.flowState.currentStep, equals('step_two'));
        expect(loaded2.flowState.turnCount, equals(1));
        expect(loaded2.flowState.slots['query'], equals('turbocharger'));

        // Transición a versión 3 con expectedVersion explícito
        final FlowState stepThree = stepTwo.copyWith(
          currentStep: 'step_three',
          turnCount: 2,
          isCompleted: true,
        );
        final FlowSessionRecord s3 = s2.nextVersion(flowState: stepThree);
        store.saveSession(s3, expectedVersion: 2);

        final FlowSessionRecord? loaded3 = store.loadSession('session-seq-202');
        expect(loaded3, isNotNull);
        expect(loaded3!.stateVersion, equals(3));
        expect(loaded3.flowState.currentStep, equals('step_three'));
        expect(loaded3.flowState.isCompleted, isTrue);
      },
    );

    test('deleteSession remueve determinísticamente la sesión del almacén', () {
      final FlowSessionRecord record = FlowSessionRecord.initial(
        sessionId: 'to-delete-303',
        flowState: FlowState.initial(initialStep: 'start'),
      );
      store.saveSession(record);

      expect(store.hasSession('to-delete-303'), isTrue);
      final bool deleted = store.deleteSession('to-delete-303');
      expect(deleted, isTrue);

      expect(store.hasSession('to-delete-303'), isFalse);
      expect(store.loadSession('to-delete-303'), isNull);
      expect(store.activeSessionCount, equals(0));

      // Intento de eliminación posterior retorna false
      expect(store.deleteSession('to-delete-303'), isFalse);
    });

    test(
      'Serializa y restaura correctamente FlowState con GentleExitResult bimodal',
      () {
        const GentleExitResult gentleExit = GentleExitResult(
          mode: GentleExitMode.specializedHandoff,
          userMessage: 'Derivando con un especialista automotriz...',
          reason: 'Presupuesto conversacional agotado (§40 Calm Error UX).',
          metadata: <String, dynamic>{'queue_id': 'support_tier2'},
        );

        final FlowState stateWithExit =
            FlowState.initial(initialStep: 'consultation').copyWith(
              currentStep: 'gentle_exit',
              turnCount: 6,
              isCompleted: true,
              gentleExit: gentleExit,
            );

        final FlowSessionRecord session = FlowSessionRecord.initial(
          sessionId: 'session-gentle-exit',
          flowState: stateWithExit,
        );
        store.saveSession(session);

        final FlowSessionRecord? loaded = store.loadSession(
          'session-gentle-exit',
        );
        expect(loaded, isNotNull);
        expect(loaded!.flowState.gentleExit, isNotNull);
        expect(
          loaded.flowState.gentleExit!.mode,
          equals(GentleExitMode.specializedHandoff),
        );
        expect(
          loaded.flowState.gentleExit!.userMessage,
          equals('Derivando con un especialista automotriz...'),
        );
        expect(
          loaded.flowState.gentleExit!.metadata['queue_id'],
          equals('support_tier2'),
        );
      },
    );
  });

  group(
    'SqliteFlowSessionStore — Sad Paths y Control de Bloqueo Optimista (§6, §45)',
    () {
      late SqliteFlowSessionStore store;

      setUp(() {
        store = SqliteFlowSessionStore.inMemory();
      });

      tearDown(() {
        store.close();
      });

      test(
        'Sad Path 1 (§6): Concurrencia conflictiva arroja FlowOptimisticLockException',
        () {
          final FlowSessionRecord initial = FlowSessionRecord.initial(
            sessionId: 'sess-conflict-01',
            flowState: FlowState.initial(initialStep: 'welcome'),
          );
          store.saveSession(initial);

          // Simular dos workers concurrentes leyendo la versión 1
          final FlowSessionRecord? workerA = store.loadSession(
            'sess-conflict-01',
          );
          final FlowSessionRecord? workerB = store.loadSession(
            'sess-conflict-01',
          );
          expect(workerA, isNotNull);
          expect(workerB, isNotNull);
          expect(workerA!.stateVersion, equals(1));
          expect(workerB!.stateVersion, equals(1));

          // Worker A actualiza primero con éxito a versión 2
          final FlowSessionRecord updateA = workerA.nextVersion(
            flowState: workerA.flowState.copyWith(currentStep: 'step_worker_a'),
          );
          store.saveSession(updateA, expectedVersion: 1);
          expect(
            store.loadSession('sess-conflict-01')!.stateVersion,
            equals(2),
          );

          // Worker B intenta guardar su modificación asumiendo aún versión 1
          final FlowSessionRecord updateB = workerB.nextVersion(
            flowState: workerB.flowState.copyWith(currentStep: 'step_worker_b'),
          );

          expect(
            () => store.saveSession(updateB, expectedVersion: 1),
            throwsA(
              isA<FlowOptimisticLockException>()
                  .having(
                    (FlowOptimisticLockException e) => e.sessionId,
                    'sessionId',
                    'sess-conflict-01',
                  )
                  .having(
                    (FlowOptimisticLockException e) => e.expectedVersion,
                    'expectedVersion',
                    1,
                  )
                  .having(
                    (FlowOptimisticLockException e) => e.actualVersion,
                    'actualVersion',
                    2,
                  )
                  .having(
                    (FlowOptimisticLockException e) => e.toString(),
                    'toString',
                    contains('Conflicto de bloqueo optimista'),
                  ),
            ),
          );

          // Intercepción limpia de FlowOptimisticLockException (§43)
          bool caughtOptimisticLock = false;
          try {
            store.saveSession(updateB, expectedVersion: 1);
          } on FlowOptimisticLockException catch (e) {
            caughtOptimisticLock = true;
            expect(e.sessionId, equals('sess-conflict-01'));
            expect(e.expectedVersion, equals(1));
            expect(e.actualVersion, equals(2));
          }
          expect(caughtOptimisticLock, isTrue);

          // Verificar que el estado de Worker A se preservó intacto
          final FlowSessionRecord? persisted = store.loadSession(
            'sess-conflict-01',
          );
          expect(persisted!.flowState.currentStep, equals('step_worker_a'));
          expect(persisted.stateVersion, equals(2));
        },
      );

      test(
        'Sad Path 2 (§6): Inserción duplicada de sesión existente arroja FlowOptimisticLockException',
        () {
          final FlowSessionRecord record1 = FlowSessionRecord.initial(
            sessionId: 'sess-unique-02',
            flowState: FlowState.initial(initialStep: 'initial'),
          );
          store.saveSession(record1);

          // Otro proceso intenta insertar una sesión inicial con el mismo sessionId
          final FlowSessionRecord recordDuplicate = FlowSessionRecord.initial(
            sessionId: 'sess-unique-02',
            flowState: FlowState.initial(initialStep: 'duplicate_start'),
          );

          expect(
            () => store.saveSession(recordDuplicate),
            throwsA(
              isA<FlowOptimisticLockException>()
                  .having(
                    (FlowOptimisticLockException e) => e.sessionId,
                    'sessionId',
                    'sess-unique-02',
                  )
                  .having(
                    (FlowOptimisticLockException e) => e.expectedVersion,
                    'expectedVersion',
                    0,
                  )
                  .having(
                    (FlowOptimisticLockException e) => e.actualVersion,
                    'actualVersion',
                    1,
                  ),
            ),
          );
        },
      );

      test(
        'Sad Path 3 (§6): Brecha o salto de versión arroja FlowOptimisticLockException',
        () {
          final FlowSessionRecord initial = FlowSessionRecord.initial(
            sessionId: 'sess-gap-03',
            flowState: FlowState.initial(initialStep: 'step_0'),
          );
          store.saveSession(initial);

          // Intento de guardar con expectedVersion 5 cuando en DB sólo existe versión 1
          final FlowSessionRecord invalidJump = initial.copyWith(
            stateVersion: 6,
            flowState: initial.flowState.copyWith(currentStep: 'step_jumped'),
          );

          expect(
            () => store.saveSession(invalidJump, expectedVersion: 5),
            throwsA(
              isA<FlowOptimisticLockException>()
                  .having(
                    (FlowOptimisticLockException e) => e.sessionId,
                    'sessionId',
                    'sess-gap-03',
                  )
                  .having(
                    (FlowOptimisticLockException e) => e.expectedVersion,
                    'expectedVersion',
                    5,
                  )
                  .having(
                    (FlowOptimisticLockException e) => e.actualVersion,
                    'actualVersion',
                    1,
                  ),
            ),
          );
        },
      );

      test(
        'Sad Path 4 (§6): Actualización sobre sesión inexistente con expectedVersion > 0 arroja FlowOptimisticLockException',
        () {
          final FlowSessionRecord nonExistent = FlowSessionRecord(
            sessionId: 'sess-ghost-04',
            stateVersion: 3,
            flowState: FlowState.initial(initialStep: 'ghost'),
            createdAt: DateTime.now().toUtc(),
            updatedAt: DateTime.now().toUtc(),
          );

          expect(
            () => store.saveSession(nonExistent, expectedVersion: 2),
            throwsA(
              isA<FlowOptimisticLockException>()
                  .having(
                    (FlowOptimisticLockException e) => e.sessionId,
                    'sessionId',
                    'sess-ghost-04',
                  )
                  .having(
                    (FlowOptimisticLockException e) => e.expectedVersion,
                    'expectedVersion',
                    2,
                  )
                  .having(
                    (FlowOptimisticLockException e) => e.actualVersion,
                    'actualVersion',
                    0,
                  ),
            ),
          );
        },
      );

      test(
        'Sad Path 5 (§6): Identificadores de sesión vacíos arrojan ArgumentError',
        () {
          expect(
            () => FlowSessionRecord.initial(
              sessionId: '   ',
              flowState: FlowState.initial(initialStep: 'test'),
            ),
            throwsA(isA<ArgumentError>()),
          );

          expect(() => store.loadSession(''), throwsA(isA<ArgumentError>()));

          expect(
            () => store.saveSession(
              FlowSessionRecord(
                sessionId: '   ',
                flowState: FlowState.initial(initialStep: 'test'),
                createdAt: DateTime.now().toUtc(),
                updatedAt: DateTime.now().toUtc(),
              ),
            ),
            throwsA(isA<ArgumentError>()),
          );
        },
      );

      test(
        'Sad Path 6 (§6): requireSession arroja FlowSessionNotFoundException e intercepta limpiamente',
        () {
          expect(
            () => store.requireSession('sess-missing-404'),
            throwsA(
              isA<FlowSessionNotFoundException>()
                  .having(
                    (FlowSessionNotFoundException e) => e.sessionId,
                    'sessionId',
                    'sess-missing-404',
                  )
                  .having(
                    (FlowSessionNotFoundException e) => e.toString(),
                    'toString',
                    contains('FlowSessionNotFoundException'),
                  ),
            ),
          );

          // Verificación de intercepción canónica con bloque try/on
          bool caughtNotFound = false;
          try {
            store.requireSession('sess-missing-404');
          } on FlowSessionNotFoundException catch (e) {
            caughtNotFound = true;
            expect(e.sessionId, equals('sess-missing-404'));
            expect(e.message, contains('sess-missing-404'));
          }
          expect(caughtNotFound, isTrue);
        },
      );
    },
  );

  group(
    'SqliteFlowSessionStore — Purga Perezosa y TTL Determinista (>24h) (§4, §45)',
    () {
      test(
        'Purga perezosa al leer elimina sesiones viejas (>24h) sin daemons residentes',
        () {
          DateTime simulatedTime = DateTime.utc(2026, 11, 10, 8, 0, 0);

          final SqliteFlowSessionStore storeWithClock =
              SqliteFlowSessionStore.inMemory(
                clock: () => simulatedTime,
                ttl: const Duration(hours: 24),
              );

          try {
            // Sesión 1: Creada en T0 (08:00)
            final FlowSessionRecord sessOld = FlowSessionRecord.initial(
              sessionId: 'sess-old-8am',
              flowState: FlowState.initial(initialStep: 'old_step'),
              now: simulatedTime,
            );
            storeWithClock.saveSession(sessOld, now: simulatedTime);

            // Avanzar el reloj 10 horas: T0 + 10h (18:00)
            simulatedTime = simulatedTime.add(const Duration(hours: 10));

            // Sesión 2: Creada en T0 + 10h
            final FlowSessionRecord sessRecent = FlowSessionRecord.initial(
              sessionId: 'sess-recent-6pm',
              flowState: FlowState.initial(initialStep: 'recent_step'),
              now: simulatedTime,
            );
            storeWithClock.saveSession(sessRecent, now: simulatedTime);

            expect(storeWithClock.activeSessionCount, equals(2));

            // Avanzar el reloj 15 horas más: T0 + 25h (09:00 del día siguiente)
            // La sesión 1 tiene 25 horas de antigüedad (> 24h: EXPIRADA)
            // La sesión 2 tiene 15 horas de antigüedad (< 24h: ACTIVA)
            simulatedTime = simulatedTime.add(const Duration(hours: 15));

            // La lectura de sess-recent dispara la purga perezosa interna
            final FlowSessionRecord? recentRead = storeWithClock.loadSession(
              'sess-recent-6pm',
            );
            expect(recentRead, isNotNull);
            expect(recentRead!.sessionId, equals('sess-recent-6pm'));

            // Al intentar leer la sesión vieja, ya fue purgada y retorna null
            final FlowSessionRecord? oldRead = storeWithClock.loadSession(
              'sess-old-8am',
            );
            expect(oldRead, isNull);

            // Comprobación directa contra la tabla SQLite física
            final ResultSet physicalRows = storeWithClock.db.select(
              'SELECT session_id FROM flow_sessions',
            );
            expect(physicalRows.length, equals(1));
            expect(physicalRows.first['session_id'], equals('sess-recent-6pm'));
          } finally {
            storeWithClock.close();
          }
        },
      );

      test(
        'purgeExpiredSessions purga deterministamente y retorna el recuento exacto',
        () {
          DateTime simulatedTime = DateTime.utc(2026, 11, 10, 0, 0, 0);

          final SqliteFlowSessionStore store = SqliteFlowSessionStore.inMemory(
            clock: () => simulatedTime,
            ttl: const Duration(hours: 24),
          );

          try {
            store.saveSession(
              FlowSessionRecord.initial(
                sessionId: 'sess-to-expire-1',
                flowState: FlowState.initial(initialStep: 'start'),
                now: simulatedTime,
              ),
              now: simulatedTime,
            );

            store.saveSession(
              FlowSessionRecord.initial(
                sessionId: 'sess-to-expire-2',
                flowState: FlowState.initial(initialStep: 'start'),
                now: simulatedTime,
              ),
              now: simulatedTime,
            );

            expect(store.activeSessionCount, equals(2));

            // Avanzar 25 horas
            simulatedTime = simulatedTime.add(const Duration(hours: 25));

            final int purged = store.purgeExpiredSessions();
            expect(purged, equals(2));
            expect(store.activeSessionCount, equals(0));
          } finally {
            store.close();
          }
        },
      );
    },
  );

  group(
    'SqliteFlowSessionStore — Persistencia Física en Disco Scratch (§4, §45)',
    () {
      late Directory tempDir;
      late String dbFilePath;

      setUp(() {
        tempDir = Directory.systemTemp.createTempSync('flow_session_scratch_');
        dbFilePath = p.join(tempDir.path, 'sessions_scratch.db');
      });

      tearDown(() {
        if (tempDir.existsSync()) {
          tempDir.deleteSync(recursive: true);
        }
      });

      test(
        'Persistencia real en disco SQLite cruzando ciclos de vida de instancias sin mocks',
        () {
          // Instancia 1: Escribe la sesión
          final SqliteFlowSessionStore store1 = SqliteFlowSessionStore.openFile(
            dbFilePath,
          );
          final FlowSessionRecord session = FlowSessionRecord.initial(
            sessionId: 'persisted-file-session-01',
            flowState: FlowState.initial(
              initialStep: 'checkout',
              initialSlots: <String, dynamic>{'order_id': 'ORD-998877'},
            ),
          );
          store1.saveSession(session);
          store1.close();

          // Verificar que el archivo SQLite físico existe y no está vacío
          final File dbFile = File(dbFilePath);
          expect(dbFile.existsSync(), isTrue);
          expect(dbFile.lengthSync(), greaterThan(0));

          // Instancia 2: Lee y actualiza la sesión desde el archivo físico
          final SqliteFlowSessionStore store2 = SqliteFlowSessionStore.openFile(
            dbFilePath,
          );
          final FlowSessionRecord? loaded = store2.loadSession(
            'persisted-file-session-01',
          );
          expect(loaded, isNotNull);
          expect(loaded!.stateVersion, equals(1));
          expect(loaded.flowState.slots['order_id'], equals('ORD-998877'));

          // Actualizar a versión 2
          final FlowSessionRecord update = loaded.nextVersion(
            flowState: loaded.flowState.copyWith(
              currentStep: 'payment_confirmed',
              isCompleted: true,
            ),
          );
          store2.saveSession(update, expectedVersion: 1);
          store2.close();

          // Instancia 3: Verifica la mutación física del archivo en disco
          final SqliteFlowSessionStore store3 = SqliteFlowSessionStore.openFile(
            dbFilePath,
          );
          final FlowSessionRecord? verified = store3.loadSession(
            'persisted-file-session-01',
          );
          expect(verified, isNotNull);
          expect(verified!.stateVersion, equals(2));
          expect(verified.flowState.currentStep, equals('payment_confirmed'));
          expect(verified.flowState.isCompleted, isTrue);
          store3.close();
        },
      );
    },
  );
}
