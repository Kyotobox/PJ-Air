// test/contracts/satellite_payload_test.dart — Certificación de DTOs Pure Dart (§39, §60.2)
import 'package:axioma/contracts.dart';
import 'package:test/test.dart';

void main() {
  group('SatellitePayload — Happy Paths (§39, §60.2)', () {
    test('Happy Path 1: Construcción y serialización nominal', () {
      final SatellitePayload payload = SatellitePayload(
        satelliteId: 'bluemarket',
        jobType: 'ARBITRAGE_SYNC',
        traceId: 'TRC-BM-001',
        data: <String, dynamic>{'margin_target': 0.65, 'skus': 150},
        schemaVersion: 1,
      );

      final Map<String, dynamic> json = payload.toJson();
      expect(json['satellite_id'], equals('bluemarket'));
      expect(json['job_type'], equals('ARBITRAGE_SYNC'));
      expect(json['trace_id'], equals('TRC-BM-001'));
      expect(json['data']['margin_target'], equals(0.65));
      expect(json['schema_version'], equals(1));

      final SatellitePayload deserialized = SatellitePayload.fromJson(json);
      expect(deserialized.satelliteId, equals('bluemarket'));
      expect(deserialized.jobType, equals('ARBITRAGE_SYNC'));
      expect(deserialized.traceId, equals('TRC-BM-001'));
      expect(deserialized.data['skus'], equals(150));
      expect(deserialized.schemaVersion, equals(1));
    });

    test(
      'Happy Path 2: StrategyDTO agrupa múltiples payloads de satélites',
      () {
        final SatellitePayload job1 = SatellitePayload(
          satelliteId: 'ruedas',
          jobType: 'CATALOG_AUDIT',
          traceId: 'TRC-RD-001',
          data: <String, dynamic>{'catalog_completeness': 0.98},
        );
        final SatellitePayload job2 = SatellitePayload(
          satelliteId: 'pj-air',
          jobType: 'ORDER_FULFILLMENT',
          traceId: 'TRC-PJ-001',
          data: <String, dynamic>{'orders': 12},
        );

        final StrategyDTO strategy = StrategyDTO(
          sprintId: 'N164',
          priority: 'HIGH',
          objective: 'Consolidar flujos de satélites',
          satelliteJobs: <SatellitePayload>[job1, job2],
          metadata: <String, dynamic>{'initiator': 'Smart'},
        );

        final Map<String, dynamic> json = strategy.toJson();
        expect(json['sprint_id'], equals('N164'));
        expect(json['priority'], equals('HIGH'));
        expect((json['satellite_jobs'] as List).length, equals(2));

        final StrategyDTO deserialized = StrategyDTO.fromJson(json);
        expect(deserialized.sprintId, equals('N164'));
        expect(deserialized.satelliteJobs.length, equals(2));
        expect(deserialized.satelliteJobs[0].satelliteId, equals('ruedas'));
        expect(deserialized.satelliteJobs[1].satelliteId, equals('pj-air'));
      },
    );
  });

  group('SatellitePayload & StrategyDTO — Sad Paths (§6, §39, §60.2)', () {
    test(
      'Sad Path 1: SatellitePayload con satelliteId vacío lanza FormatException',
      () {
        expect(
          () => SatellitePayload(
            satelliteId: '  ',
            jobType: 'SYNC',
            traceId: 'TRC-01',
            data: <String, dynamic>{},
          ),
          throwsA(isA<FormatException>()),
        );
      },
    );

    test(
      'Sad Path 2: SatellitePayload con jobType vacío lanza FormatException',
      () {
        expect(
          () => SatellitePayload(
            satelliteId: 'ruedas',
            jobType: '',
            traceId: 'TRC-01',
            data: <String, dynamic>{},
          ),
          throwsA(isA<FormatException>()),
        );
      },
    );

    test(
      'Sad Path 3: SatellitePayload con schemaVersion <= 0 lanza FormatException',
      () {
        expect(
          () => SatellitePayload(
            satelliteId: 'ruedas',
            jobType: 'AUDIT',
            traceId: 'TRC-01',
            data: <String, dynamic>{},
            schemaVersion: 0,
          ),
          throwsA(isA<FormatException>()),
        );
      },
    );

    test(
      'Sad Path 4: SatellitePayload fromJson con payload corrupto lanza FormatException',
      () {
        expect(
          () => SatellitePayload.fromJson(<String, dynamic>{
            'satellite_id': null,
            'job_type': 'AUDIT',
            'trace_id': 'TRC-01',
          }),
          throwsA(isA<FormatException>()),
        );
      },
    );

    test(
      'Sad Path 5: StrategyDTO con prioridad desconocida lanza FormatException',
      () {
        expect(
          () => StrategyDTO(
            sprintId: 'N164',
            priority: 'SUPER_URGENT_INVALID',
            objective: 'Test',
            satelliteJobs: <SatellitePayload>[],
            metadata: <String, dynamic>{},
          ),
          throwsA(isA<FormatException>()),
        );
      },
    );

    test(
      'Sad Path 6: StrategyDTO con sprintId vacío lanza FormatException',
      () {
        expect(
          () => StrategyDTO(
            sprintId: '',
            priority: 'MEDIUM',
            objective: 'Test',
            satelliteJobs: <SatellitePayload>[],
            metadata: <String, dynamic>{},
          ),
          throwsA(isA<FormatException>()),
        );
      },
    );
  });
}
