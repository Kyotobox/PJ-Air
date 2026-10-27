import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

void main() {
  group('ResourceGuard Unit Tests (§33 / TASK-G50-01)', () {
    test('Happy Path: Instanciación predeterminada cumple con umbral del 85% (§33)', () {
      const ResourceGuard guard = ResourceGuard();

      expect(guard.maxPressureRatio, equals(0.85));
      expect(
        guard.getTotalMemoryBytes(),
        equals(ResourceGuard.defaultFallbackTotalMemoryBytes),
      );
      expect(guard.getCurrentRssBytes(), greaterThan(0));
    });

    test('Happy Path: Memoria de proceso en ejecución reporta estado seguro (<85%)', () {
      const ResourceGuard guard = ResourceGuard();
      final MemoryReport report = guard.inspectMemory();

      expect(report.isSafe, isTrue);
      expect(report.pressureRatio, lessThan(0.85));
      expect(guard.isMemorySafe(), isTrue);

      // checkMemoryPressure no debe arrojar excepción bajo condiciones seguras
      expect(() => guard.checkMemoryPressure(), returnsNormally);

      final Map<String, dynamic> json = report.toJson();
      expect(json['is_safe'], isTrue);
      expect(json['threshold'], equals(0.85));
      expect(json['used_bytes'], greaterThan(0));
      expect(json['total_bytes'], equals(guard.getTotalMemoryBytes()));
    });

    test(
      'Happy Path: Cálculos personalizados de memoria operan correctamente',
      () {
        const ResourceGuard guard = ResourceGuard(
          totalMemoryBytes: 1000,
          maxPressureRatio: 0.85,
        );

        final MemoryReport safeReport = guard.inspectMemory(
          customUsedBytes: 500,
        );
        expect(safeReport.isSafe, isTrue);
        expect(safeReport.pressureRatio, equals(0.50));
        expect(safeReport.threshold, equals(0.85));

        expect(
          guard.isMemorySafe(customUsedBytes: 849, customTotalBytes: 1000),
          isTrue,
        );
      },
    );

    test('Sad Path: checkMemoryPressure arroja ResourceGuardException ante presión crítica >=85%', () {
      const ResourceGuard guard = ResourceGuard(
        totalMemoryBytes: 1000,
        maxPressureRatio: 0.85,
      );

      // 860 / 1000 = 86% -> supera el 85%
      expect(
        () => guard.checkMemoryPressure(customUsedBytes: 860),
        throwsA(
          isA<ResourceGuardException>()
              .having(
                (ResourceGuardException e) => e.currentPressureRatio,
                'ratio',
                0.86,
              )
              .having(
                (ResourceGuardException e) => e.maxPressureThreshold,
                'threshold',
                0.85,
              )
              .having(
                (ResourceGuardException e) => e.currentUsedBytes,
                'used',
                860,
              )
              .having(
                (ResourceGuardException e) => e.totalMemoryBytes,
                'total',
                1000,
              ),
        ),
      );

      // 850 / 1000 = 85% exacto -> umbral alcanzado (no seguro)
      expect(
        () => guard.checkMemoryPressure(customUsedBytes: 850),
        throwsA(isA<ResourceGuardException>()),
      );
    });

    test('Sad Path: Formato toString de ResourceGuardException contiene métricas legibles', () {
      const ResourceGuardException ex = ResourceGuardException(
        currentPressureRatio: 0.925,
        maxPressureThreshold: 0.85,
        currentUsedBytes: 9250,
        totalMemoryBytes: 10000,
      );

      final String representation = ex.toString();
      expect(representation, contains('RESOURCE_GUARD_PRESSURE_EXCEEDED'));
      expect(representation, contains('92.5%'));
      expect(representation, contains('85.0%'));
    });

    test(
      'Sad Path: Valores límites de memoria inválidos arrojan ArgumentError',
      () {
        const ResourceGuard guard = ResourceGuard();

        expect(
          () => guard.inspectMemory(customTotalBytes: 0),
          throwsA(isA<ArgumentError>()),
        );
        expect(
          () => guard.inspectMemory(customTotalBytes: -100),
          throwsA(isA<ArgumentError>()),
        );
        expect(
          () => guard.inspectMemory(customUsedBytes: -1),
          throwsA(isA<ArgumentError>()),
        );
      },
    );
  });
}
