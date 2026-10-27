import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('QuarantineLifecycleEvaluator (CMMI Nivel 5 CAR §46)', () {
    late QuarantineLifecycleEvaluator evaluator;

    setUp(() {
      evaluator = const QuarantineLifecycleEvaluator(
        minSprintsForPromotion: 3,
        maxAllowedFalsePositives: 0,
        fatalFalsePositiveThreshold: 3,
      );
    });

    test('Happy Path: Promoción exitosa tras 3 sprints limpios a ERROR', () {
      final record = RuleQuarantineRecord(
        ruleId: 'CAR-DEF-001-EMPTY-CATCH',
        status: CarPromotionStatus.observation,
        severity: CarRuleSeverity.warn,
        sprintsInQuarantine: 3,
        falsePositivesCount: 0,
        truePositivesCount: 12,
        quarantinedAt: DateTime.now().subtract(const Duration(days: 21)),
      );

      final result = evaluator.evaluate(record);

      expect(result.decision, equals(LifecycleDecision.promoted));
      expect(result.updatedRecord.status, equals(CarPromotionStatus.promoted));
      expect(result.updatedRecord.severity, equals(CarRuleSeverity.error));
      expect(result.reason, contains('Promoción exitosa'));
    });

    test('Happy Path: Retención en observación cuando sprints < 3', () {
      final record = RuleQuarantineRecord(
        ruleId: 'CAR-DEF-002-BLIND-FIRST',
        status: CarPromotionStatus.observation,
        severity: CarRuleSeverity.warn,
        sprintsInQuarantine: 2,
        falsePositivesCount: 0,
        truePositivesCount: 4,
        quarantinedAt: DateTime.now().subtract(const Duration(days: 14)),
      );

      final result = evaluator.evaluate(record);

      expect(result.decision, equals(LifecycleDecision.retainInQuarantine));
      expect(
        result.updatedRecord.status,
        equals(CarPromotionStatus.observation),
      );
      expect(result.updatedRecord.severity, equals(CarRuleSeverity.warn));
      expect(result.reason, contains('2/3 sprints requeridos'));
    });

    test('Happy Path: Cuarentena extendida ante falsos positivos menores', () {
      final record = RuleQuarantineRecord(
        ruleId: 'CAR-DEF-003-FORCE-UNWRAP',
        status: CarPromotionStatus.observation,
        severity: CarRuleSeverity.warn,
        sprintsInQuarantine: 4,
        falsePositivesCount: 1,
        truePositivesCount: 8,
        quarantinedAt: DateTime.now().subtract(const Duration(days: 28)),
      );

      final result = evaluator.evaluate(record);

      expect(result.decision, equals(LifecycleDecision.retainInQuarantine));
      expect(
        result.updatedRecord.status,
        equals(CarPromotionStatus.observation),
      );
      expect(result.reason, contains('falsos positivos reportados'));
    });

    test(
      'Happy Path: Revocación (Veto) ante 3 o más falsos positivos fatales',
      () {
        final record = RuleQuarantineRecord(
          ruleId: 'CAR-DEF-004-SPURIOUS-VAR',
          status: CarPromotionStatus.observation,
          severity: CarRuleSeverity.warn,
          sprintsInQuarantine: 2,
          falsePositivesCount: 3,
          truePositivesCount: 1,
          quarantinedAt: DateTime.now().subtract(const Duration(days: 10)),
        );

        final result = evaluator.evaluate(record);

        expect(result.decision, equals(LifecycleDecision.vetoed));
        expect(result.updatedRecord.status, equals(CarPromotionStatus.vetoed));
        expect(result.reason, contains('Regla revocada'));
      },
    );

    test('Sad Path: Validación de ruleId vacío lanza ArgumentError', () {
      expect(
        () => evaluator.evaluate(
          RuleQuarantineRecord(ruleId: '   ', quarantinedAt: DateTime.now()),
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test(
      'Sad Path: Validación de sprintsInQuarantine < 0 lanza ArgumentError',
      () {
        expect(
          () => evaluator.evaluate(
            RuleQuarantineRecord(
              ruleId: 'CAR-TEST-01',
              sprintsInQuarantine: -1,
              quarantinedAt: DateTime.now(),
            ),
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test(
      'Sad Path: Validación de falsePositivesCount < 0 lanza ArgumentError',
      () {
        expect(
          () => evaluator.evaluate(
            RuleQuarantineRecord(
              ruleId: 'CAR-TEST-01',
              falsePositivesCount: -2,
              quarantinedAt: DateTime.now(),
            ),
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test(
      'Sad Path: Validación de truePositivesCount < 0 lanza ArgumentError',
      () {
        expect(
          () => evaluator.evaluate(
            RuleQuarantineRecord(
              ruleId: 'CAR-TEST-01',
              truePositivesCount: -1,
              quarantinedAt: DateTime.now(),
            ),
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );
  });
}
