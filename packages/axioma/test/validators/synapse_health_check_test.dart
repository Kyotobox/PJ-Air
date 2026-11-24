// test/validators/synapse_health_check_test.dart — Certificación de SynapseHealthValidator (§4, §6, §39, §60.7, §60.8)
import 'package:axioma/src/validators/synapse_health_check.dart';
import 'package:test/test.dart';

void main() {
  group('SynapseHealthValidator — Happy Paths (§39, §60.8)', () {
    test('Happy Path 1: Validación nominal de reporte de salud', () {
      final DateTime now = DateTime.now().toUtc();
      final Map<String, dynamic> report = <String, dynamic>{
        'node_id': 'studio',
        'is_reachable': true,
        'latency_ms': 45,
        'active_skills': <String>[
          'adstudio-pipeline',
          'media-audio-normalizer',
        ],
        'timestamp': now.toIso8601String(),
      };

      final HealthValidationResult res =
          SynapseHealthValidator.validateHealthReport(
            report,
            referenceTime: now,
          );

      expect(res.isHealthy, isTrue);
      expect(res.nodeId, equals('studio'));
      expect(res.latencyMs, equals(45));
      expect(res.isDegraded, isFalse);
      expect(res.activeSkills, contains('adstudio-pipeline'));
      expect(res.anomalies, isEmpty);
    });

    test('Happy Path 2: Detección de degradación por latencia sin crasheo', () {
      final DateTime now = DateTime.now().toUtc();
      final Map<String, dynamic> report = <String, dynamic>{
        'node_id': 'ruedas',
        'is_reachable': true,
        'latency_ms': 1200, // Entre warning (800) y crítico (2000)
        'active_skills': <String>['data-catalog-sanitizer'],
        'timestamp': now.toIso8601String(),
      };

      final HealthValidationResult res =
          SynapseHealthValidator.validateHealthReport(
            report,
            referenceTime: now,
          );

      expect(res.isHealthy, isFalse);
      expect(res.isDegraded, isTrue);
      expect(res.anomalies, isNotEmpty);
      expect(res.anomalies.first, contains('advertencia'));
    });

    test('Happy Path 3: Validación atómica de ping payload', () {
      final DateTime now = DateTime.now().toUtc();
      final HealthValidationResult pingRes =
          SynapseHealthValidator.validatePingPayload(
            nodeId: 'levita',
            latencyMs: 15,
            timestamp: now,
            referenceTime: now,
          );

      expect(pingRes.isHealthy, isTrue);
      expect(pingRes.nodeId, equals('levita'));
      expect(pingRes.isDegraded, isFalse);
    });
  });

  group('SynapseHealthValidator — Sad Paths (§6, §39, §60.7, §60.8)', () {
    final DateTime now = DateTime.now().toUtc();

    test('Sad Path 1: Reporte vacío lanza FormatException', () {
      expect(
        () => SynapseHealthValidator.validateHealthReport(<String, dynamic>{}),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 2: nodeId vacío lanza FormatException', () {
      expect(
        () => SynapseHealthValidator.validateHealthReport(<String, dynamic>{
          'node_id': '  ',
          'is_reachable': true,
          'latency_ms': 20,
          'timestamp': now.toIso8601String(),
        }),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 3: latency_ms negativo lanza FormatException', () {
      expect(
        () => SynapseHealthValidator.validateHealthReport(<String, dynamic>{
          'node_id': 'studio',
          'is_reachable': true,
          'latency_ms': -10,
          'timestamp': now.toIso8601String(),
        }),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 4: is_reachable no booleano lanza FormatException', () {
      expect(
        () => SynapseHealthValidator.validateHealthReport(<String, dynamic>{
          'node_id': 'studio',
          'is_reachable': 'yes',
          'latency_ms': 20,
          'timestamp': now.toIso8601String(),
        }),
        throwsA(isA<FormatException>()),
      );
    });

    test(
      'Sad Path 5: timestamp en el futuro excesivo (>5 min) lanza FormatException',
      () {
        final DateTime futureTime = now.add(const Duration(minutes: 10));
        expect(
          () => SynapseHealthValidator.validateHealthReport(<String, dynamic>{
            'node_id': 'studio',
            'is_reachable': true,
            'latency_ms': 20,
            'timestamp': futureTime.toIso8601String(),
          }, referenceTime: now),
          throwsA(isA<FormatException>()),
        );
      },
    );

    test('Sad Path 6: Ping con nodeId vacío lanza FormatException', () {
      expect(
        () => SynapseHealthValidator.validatePingPayload(
          nodeId: '',
          latencyMs: 10,
          timestamp: now,
          referenceTime: now,
        ),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 7: Ping con latencyMs negativo lanza FormatException', () {
      expect(
        () => SynapseHealthValidator.validatePingPayload(
          nodeId: 'studio',
          latencyMs: -1,
          timestamp: now,
          referenceTime: now,
        ),
        throwsA(isA<FormatException>()),
      );
    });
  });
}
