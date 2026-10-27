import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('AstVarianceStabilizer (CMMI Nivel 5 CAR §46)', () {
    late AstVarianceStabilizer stabilizer;

    setUp(() {
      stabilizer = const AstVarianceStabilizer();
    });

    test('Happy Path: Causa Especial clasificada y aprobada para síntesis', () {
      final sample = AstCandidateSample(
        snippet: 'catch (_) {}',
        nodeType: 'CatchClause',
        recurrenceCount: 4,
        affectedFiles: <String>{'lib/src/a.dart', 'lib/src/b.dart'},
        violatesInvariant: true,
      );

      final result = stabilizer.evaluate(sample);

      expect(
        result.classification,
        equals(VarianceClassification.specialCause),
      );
      expect(result.isApprovedForSynthesis, isTrue);
      expect(result.specialCauseScore, greaterThanOrEqualTo(0.70));
      expect(result.rationale, contains('Causa Especial confirmada'));
    });

    test(
      'Happy Path: Causa Común clasificada y rechazada (ruido sintáctico)',
      () {
        final sample = const AstCandidateSample(
          snippet: 'myTempVar',
          nodeType: 'SimpleIdentifier',
          recurrenceCount: 1,
          affectedFiles: <String>{'lib/src/feature.dart'},
          violatesInvariant: false,
        );

        final result = stabilizer.evaluate(sample);

        expect(
          result.classification,
          equals(VarianceClassification.commonCause),
        );
        expect(result.isApprovedForSynthesis, isFalse);
        expect(result.commonCauseScore, greaterThanOrEqualTo(0.60));
        expect(result.rationale, contains('Variación de causa común'));
      },
    );

    test(
      'Happy Path: Filtrado de lista de candidatos reteniendo solo Causa Especial',
      () {
        final candidates = <>[
          const AstCandidateSample(
            snippet: 'tempX',
            nodeType: 'SimpleIdentifier',
            recurrenceCount: 1,
            violatesInvariant: false,
          ),
          const AstCandidateSample(
            snippet: 'as String',
            nodeType: 'AsExpression',
            recurrenceCount: 3,
            affectedFiles: <String>{'lib/service.dart', 'lib/repo.dart'},
            violatesInvariant: true,
          ),
          const AstCandidateSample(
            snippet: 'catch (e) {}',
            nodeType: 'CatchClause',
            recurrenceCount: 5,
            affectedFiles: <String>{'lib/a.dart', 'lib/b.dart', 'lib/c.dart'},
            violatesInvariant: true,
          ),
        ];

        final filtered = stabilizer.filterSpecialCauses(candidates);

        expect(filtered.length, equals(2));
        expect(filtered.any((c) => c.snippet == 'tempX'), isFalse);
        expect(filtered.any((c) => c.snippet == 'as String'), isTrue);
        expect(filtered.any((c) => c.snippet == 'catch (e) {}'), isTrue);
      },
    );

    test(
      'Sad Path: Caso Indeterminado para muestra ambigua sin invariante rota',
      () {
        final ambiguous = const AstCandidateSample(
          snippet: 'calculateSubtotal(items)',
          nodeType: 'MethodInvocation',
          recurrenceCount: 2,
          affectedFiles: <String>{'lib/calculator.dart'},
          violatesInvariant: false,
        );

        final result = stabilizer.evaluate(ambiguous);

        expect(
          result.classification,
          equals(VarianceClassification.indeterminate),
        );
        expect(result.isApprovedForSynthesis, isFalse);
        expect(result.rationale, contains('Indeterminado'));
      },
    );

    test('Sad Path: Validación de snippet vacío lanza ArgumentError', () {
      expect(
        () => stabilizer.evaluate(
          const AstCandidateSample(
            snippet: '   ',
            nodeType: 'CatchClause',
            recurrenceCount: 3,
          ),
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('Sad Path: Validación de nodeType vacío lanza ArgumentError', () {
      expect(
        () => stabilizer.evaluate(
          const AstCandidateSample(
            snippet: 'as Type',
            nodeType: '',
            recurrenceCount: 3,
          ),
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('Sad Path: Validación de recurrenceCount < 1 lanza ArgumentError', () {
      expect(
        () => stabilizer.evaluate(
          const AstCandidateSample(
            snippet: 'as Type',
            nodeType: 'AsExpression',
            recurrenceCount: 0,
          ),
        ),
        throwsA(isA<ArgumentError>()),
      );
    });
  });
}
