import 'dart:io';

import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

void main() {
  group('IsolateThrottle Unit Tests (§33 / TASK-G50-02)', () {
    test('Happy Path: Cálculo óptimo de workers es CPU - 1 en arquitecturas multi-core', () {
      expect(
        IsolateThrottle.getRecommendedWorkers(processorCount: 8),
        equals(7),
      );
      expect(
        IsolateThrottle.getRecommendedWorkers(processorCount: 4),
        equals(3),
      );
      expect(
        IsolateThrottle.getRecommendedWorkers(processorCount: 2),
        equals(1),
      );
      expect(
        IsolateThrottle.getRecommendedWorkers(processorCount: 1),
        equals(1),
      );

      final int hostCores = Platform.numberOfProcessors;
      final int hostRecommended = IsolateThrottle.getRecommendedWorkers();
      if (hostCores > 1) {
        expect(hostRecommended, equals(hostCores - 1));
      } else {
        expect(hostRecommended, equals(1));
      }
    });

    test('Happy Path: Instancia con configuración custom valida concurrencia segura', () {
      const IsolateThrottle throttle = IsolateThrottle(processorCount: 4);

      expect(throttle.totalCores, equals(4));
      expect(throttle.getMaxAllowedWorkers(), equals(3));
      expect(throttle.isWorkerCountSafe(1), isTrue);
      expect(throttle.isWorkerCountSafe(2), isTrue);
      expect(throttle.isWorkerCountSafe(3), isTrue);

      expect(() => throttle.validateWorkerCount(3), returnsNormally);
    });

    test('Happy Path: runThrottled ejecuta tareas concurrentemente preservando orden', () async {
      const IsolateThrottle throttle = IsolateThrottle(processorCount: 4);
      final List<int> items = <int>[1, 2, 3, 4, 5];

      final List<String> results = await throttle.runThrottled<int, String>(
        items: items,
        worker: (int n) async {
          await Future<void>.delayed(const Duration(milliseconds: 10));
          return 'item_$n';
        },
      );

      expect(
        results,
        equals(<String>['item_1', 'item_2', 'item_3', 'item_4', 'item_5']),
      );
    });

    test('Sad Path: validateWorkerCount arroja IsolateThrottleException ante saturación de núcleos (§33)', () {
      const IsolateThrottle throttle = IsolateThrottle(processorCount: 4);

      // 4 workers en 4 cores -> saturación total (prohibida por §33)
      expect(
        () => throttle.validateWorkerCount(4),
        throwsA(
          isA<IsolateThrottleException>()
              .having(
                (IsolateThrottleException e) => e.requestedWorkers,
                'requested',
                4,
              )
              .having(
                (IsolateThrottleException e) => e.maxAllowedWorkers,
                'maxAllowed',
                3,
              )
              .having(
                (IsolateThrottleException e) => e.totalCores,
                'totalCores',
                4,
              ),
        ),
      );

      // 5 workers en 4 cores -> sobrecarga y saturación
      expect(
        () => throttle.validateWorkerCount(5),
        throwsA(isA<IsolateThrottleException>()),
      );
    });

    test(
      'Sad Path: validateWorkerCount arroja ArgumentError ante cantidad <= 0',
      () {
        const IsolateThrottle throttle = IsolateThrottle(processorCount: 4);

        expect(
          () => throttle.validateWorkerCount(0),
          throwsA(isA<ArgumentError>()),
        );
        expect(
          () => throttle.validateWorkerCount(-2),
          throwsA(isA<ArgumentError>()),
        );
        expect(throttle.isWorkerCountSafe(0), isFalse);
      },
    );

    test('Sad Path: runThrottled aborta ante excepción de ResourceGuard (§33)', () async {
      const IsolateThrottle throttle = IsolateThrottle(processorCount: 4);
      // ResourceGuard configurado al 85%, simulando saturación (900/1000 = 90%)
      const ResourceGuard saturatedGuard = ResourceGuard(
        totalMemoryBytes: 1000,
        maxPressureRatio: 0.85,
        rssBytesProvider: _mockHighRss,
      );

      expect(
        () => throttle.runThrottled<int, int>(
          items: <int>[1, 2, 3],
          worker: (int n) async => n * 2,
          resourceGuard: saturatedGuard,
        ),
        throwsA(isA<ResourceGuardException>()),
      );
    });
  });
}

int _mockHighRss() => 900;
