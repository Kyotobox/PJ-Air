import 'dart:async';
import 'package:test/test.dart';
import 'package:axioma/src/ui/action_lock.dart';

void main() {
  group('AxiomaActionLock - Happy Path', () {
    test('estado inicial en reposo es correcto', () {
      final AxiomaActionLock lock = AxiomaActionLock();
      expect(lock.isLocked, isFalse);
      expect(lock.canExecute, isTrue);
      expect(lock.currentTag, isNull);
      expect(lock.lockedAt, isNull);
    });

    test(
      'run ejecuta la acción y devuelve el resultado liberando el candado',
      () async {
        final AxiomaActionLock lock = AxiomaActionLock();
        bool wasLockedDuringExecution = false;
        String? tagDuringExecution;
        DateTime? lockedAtDuringExecution;

        final int result = await lock.run(() async {
          wasLockedDuringExecution = lock.isLocked;
          tagDuringExecution = lock.currentTag;
          lockedAtDuringExecution = lock.lockedAt;
          return 42;
        }, tag: 'fetch_order');

        expect(result, equals(42));
        expect(wasLockedDuringExecution, isTrue);
        expect(tagDuringExecution, equals('fetch_order'));
        expect(lockedAtDuringExecution, isNotNull);
        expect(lock.isLocked, isFalse);
        expect(lock.canExecute, isTrue);
        expect(lock.currentTag, isNull);
        expect(lock.lockedAt, isNull);
      },
    );

    test(
      'ejecuciones secuenciales sucesivas se completan sin colisión',
      () async {
        final AxiomaActionLock lock = AxiomaActionLock();

        final String first = await lock.run(() async => 'first');
        final String second = await lock.run(() async => 'second');
        final String third = await lock.run(() async => 'third');

        expect(first, equals('first'));
        expect(second, equals('second'));
        expect(third, equals('third'));
        expect(lock.isLocked, isFalse);
      },
    );

    test('lockStream emite true al adquirir y false al liberar', () async {
      final AxiomaActionLock lock = AxiomaActionLock();
      final List<bool> streamEvents = <bool>[];
      final StreamSubscription<bool> sub = lock.lockStream.listen(
        streamEvents.add,
      );

      await lock.run(() async {
        await Future<void>.delayed(const Duration(milliseconds: 10));
        return 'done';
      });

      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(streamEvents, equals(<bool>[true, false]));
      await sub.cancel();
      lock.dispose();
    });

    test(
      'runOrNull ejecuta normalmente cuando el candado está libre',
      () async {
        final AxiomaActionLock lock = AxiomaActionLock();
        final String? result = await lock.runOrNull(
          () async => 'hello',
          tag: 'test',
        );
        expect(result, equals('hello'));
        expect(lock.isLocked, isFalse);
      },
    );

    test(
      'tryRun ejecuta y retorna true cuando el candado está libre',
      () async {
        final AxiomaActionLock lock = AxiomaActionLock();
        bool executed = false;
        final bool success = await lock.tryRun(() async {
          executed = true;
        });
        expect(success, isTrue);
        expect(executed, isTrue);
        expect(lock.isLocked, isFalse);
      },
    );

    test(
      'forceRelease restablece forzadamente el estado del candado',
      () async {
        final AxiomaActionLock lock = AxiomaActionLock();
        final Completer<void> completer = Completer<void>();

        // Iniciar tarea que bloquea el candado
        final Future<void> future = lock.run(
          () => completer.future,
          tag: 'blocking_action',
        );
        expect(lock.isLocked, isTrue);

        lock.forceRelease();
        expect(lock.isLocked, isFalse);
        expect(lock.canExecute, isTrue);
        expect(lock.currentTag, isNull);

        completer.complete();
        await future;
      },
    );
  });

  group('AxiomaActionLock - Sad Path Mandatorio (§6, §48)', () {
    test(
      'disparo asíncrono concurrente mientras isLocked es true lanza ActionLockBusyException',
      () async {
        final AxiomaActionLock lock = AxiomaActionLock();
        final Completer<void> blocker = Completer<void>();

        // Primera acción que retiene el candado
        final Future<void> runningAction = lock.run(
          () => blocker.future,
          tag: 'primary_submit',
        );
        expect(lock.isLocked, isTrue);

        // Sad Path: Segundo submit concurrente debe ser rechazado inmediatamente
        expect(
          () =>
              lock.run(() async => 'duplicate_submit', tag: 'duplicate_submit'),
          throwsA(
            isA<ActionLockBusyException>()
                .having(
                  (ActionLockBusyException e) => e.message,
                  'message',
                  contains('primary_submit'),
                )
                .having(
                  (ActionLockBusyException e) => e.actionTag,
                  'actionTag',
                  equals('duplicate_submit'),
                )
                .having(
                  (ActionLockBusyException e) => e.timestamp,
                  'timestamp',
                  isNotNull,
                )
                .having(
                  (ActionLockBusyException e) => e.toString(),
                  'toString',
                  contains('ActionLockBusyException'),
                ),
          ),
        );

        // Completar la primera acción y certificar liberación limpia
        blocker.complete();
        await runningAction;
        expect(lock.isLocked, isFalse);
      },
    );

    test(
      'múltiples llamadas concurrentes simultáneas solo permiten una y rechazan las demás',
      () async {
        final AxiomaActionLock lock = AxiomaActionLock();
        int successCount = 0;
        int busyCount = 0;

        Future<void> triggerSubmit(int index) async {
          try {
            await lock.run(() async {
              await Future<void>.delayed(const Duration(milliseconds: 30));
              successCount++;
            }, tag: 'submit_$index');
          } on ActionLockBusyException {
            busyCount++;
          }
        }

        // Disparar 5 submits simultáneos (doble clic masivo)
        await Future.wait(<Future<void>>[
          triggerSubmit(1),
          triggerSubmit(2),
          triggerSubmit(3),
          triggerSubmit(4),
          triggerSubmit(5),
        ]);

        expect(
          successCount,
          equals(1),
          reason: 'Solo una acción debió ser admitida',
        );
        expect(
          busyCount,
          equals(4),
          reason: 'Las 4 acciones duplicadas debieron cancelarse por busy',
        );
        expect(lock.isLocked, isFalse);
      },
    );

    test(
      'libera el candado garantizadamente cuando la acción interna arroja excepción',
      () async {
        final AxiomaActionLock lock = AxiomaActionLock();

        await expectLater(
          () => lock.run(() async {
            throw const FormatException('Payload corrupto');
          }, tag: 'failing_action'),
          throwsA(isA<FormatException>()),
        );

        expect(
          lock.isLocked,
          isFalse,
          reason: 'El candado DEBE liberarse tras error en la acción',
        );
        expect(lock.canExecute, isTrue);
        expect(lock.currentTag, isNull);
      },
    );

    test(
      'timeout cancela la acción y libera garantizadamente el candado',
      () async {
        final AxiomaActionLock lock = AxiomaActionLock();

        await expectLater(
          () => lock.run(
            () async {
              await Future<void>.delayed(const Duration(milliseconds: 200));
              return 'should_not_reach';
            },
            tag: 'slow_action',
            timeout: const Duration(milliseconds: 30),
          ),
          throwsA(isA<TimeoutException>()),
        );

        // Esperar brevemente a que el timeout se procese
        await Future<void>.delayed(const Duration(milliseconds: 10));
        expect(lock.isLocked, isFalse);
        expect(lock.canExecute, isTrue);
      },
    );

    test(
      'runOrNull retorna null sin arrojar excepción cuando el candado está ocupado',
      () async {
        final AxiomaActionLock lock = AxiomaActionLock();
        final Completer<void> blocker = Completer<void>();

        final Future<void> active = lock.run(() => blocker.future, tag: 'main');
        expect(lock.isLocked, isTrue);

        final String? dropped = await lock.runOrNull(
          () async => 'ignored',
          tag: 'secondary',
        );
        expect(dropped, isNull);

        blocker.complete();
        await active;
        expect(lock.isLocked, isFalse);
      },
    );

    test('tryRun retorna false cuando el candado está ocupado', () async {
      final AxiomaActionLock lock = AxiomaActionLock();
      final Completer<void> blocker = Completer<void>();

      final Future<void> active = lock.run(() => blocker.future, tag: 'main');
      expect(lock.isLocked, isTrue);

      final bool success = await lock.tryRun(() async {}, tag: 'second');
      expect(success, isFalse);

      blocker.complete();
      await active;
      expect(lock.isLocked, isFalse);
    });
  });
}
