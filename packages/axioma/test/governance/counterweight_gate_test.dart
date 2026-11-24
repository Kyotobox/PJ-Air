/// counterweight_gate_test.dart — Suite de Certificación Física de CounterweightGate (§4, §6, §39, §60.7, §61.2, §63).
library;

import 'package:axioma/src/governance/counterweight_gate.dart';
import 'package:axioma/src/governance/directive_classifier.dart';
import 'package:axioma/src/governance/governance_exceptions.dart';
import 'package:test/test.dart';

void main() {
  group('CounterweightGate — Certificación de Contrapeso Crítico (§39, §63)', () {
    late CounterweightGate gate;

    setUp(() {
      gate = const CounterweightGate();
    });

    test(
      'Happy Path: Directiva de solo lectura es autorizada sin justificación',
      () {
        final CounterweightValidationResult result = gate.validate(
          directiveText: 'logix check && git status',
        );

        expect(result.isValid, isTrue);
        expect(result.classification.type, equals(DirectiveType.readOnly));
        expect(result.verifiedGates, contains('PASS_NON_DESTRUCTIVE'));
      },
    );

    test(
      'Happy Path: Consulta exploratoria del PO es autorizada para debate',
      () {
        final CounterweightValidationResult result = gate.validate(
          directiveText:
              '¿Qué alternativas hay para la deduplicación de SKUs? Evalúa opciones.',
        );

        expect(result.isValid, isTrue);
        expect(result.classification.type, equals(DirectiveType.exploratory));
        expect(result.verifiedGates, contains('PASS_NON_DESTRUCTIVE'));
      },
    );

    test(
      'Happy Path: Directiva destructiva con justificación constitucional de 3 compuertas es autorizada',
      () {
        const String destructiveCmd =
            'rm -rf data/corrupted_cache && git reset --hard HEAD';
        const String justification = '''
ANÁLISIS DE CONTRAPESO CRÍTICO (§63):
1. CAUSA RAÍZ: La caché contiene hashes de ADN desincronizados tras el crash.
2. IMPACTO COLATERAL: Blast Radius confinado a archivos efímeros no persistidos.
3. PROPUESTA DE CONTRAPESO LEAN: Reconstruir la caché incremental sin tocar la base principal.
''';

        final CounterweightValidationResult result = gate.validate(
          directiveText: destructiveCmd,
          justificationBlock: justification,
        );

        expect(result.isValid, isTrue);
        expect(result.classification.type, equals(DirectiveType.destructive));
        expect(
          result.verifiedGates,
          containsAll(<String>[
            'GATE_1_CAUSALITY_VERIFIED',
            'GATE_2_BLAST_RADIUS_QUANTIFIED',
            'GATE_3_COUNTERWEIGHT_LEAN_ACTIVE',
          ]),
        );
      },
    );

    test(
      'Sad Path 1 (Ruptura): Directiva destructiva sin bloque de justificación lanza MissingRootCauseBlockException',
      () {
        expect(
          () => gate.validate(
            directiveText: 're-ingesta masiva universal de todo el catálogo',
            justificationBlock: null,
          ),
          throwsA(
            isA<MissingRootCauseBlockException>()
                .having(
                  (MissingRootCauseBlockException e) => e.exitCode,
                  'exitCode',
                  equals(46),
                )
                .having(
                  (MissingRootCauseBlockException e) => e.missingSections,
                  'missingSections',
                  contains('CAUSA RAÍZ (Causality Check)'),
                ),
          ),
        );
      },
    );

    test(
      'Sad Path 2 (Ruptura): Justificación incompleta (sin Blast Radius) lanza MissingRootCauseBlockException',
      () {
        const String partialJustification = '''
1. CAUSA RAÍZ: Limpiar datos duplicados.
3. PROPUESTA DE CONTRAPESO LEAN: Ejecutar script de deduplicación.
''';

        expect(
          () => gate.validate(
            directiveText: 'cuarentena destructiva de piezas',
            justificationBlock: partialJustification,
          ),
          throwsA(
            isA<MissingRootCauseBlockException>().having(
              (MissingRootCauseBlockException e) => e.missingSections,
              'missingSections',
              contains('IMPACTO COLATERAL (Blast Radius)'),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path 3 (Ruptura): Servilismo cognitivo o teatro procedimental lanza SycophancyDetectedException',
      () {
        expect(
          () => gate.validate(
            directiveText:
                // INTENTIONAL: prueba negativa de detección de complacencia (§10)
                'El PO tiene la razón absoluta, procedo de inmediato a borrar',
          ),
          throwsA(
            isA<SycophancyDetectedException>()
                .having(
                  (SycophancyDetectedException e) => e.exitCode,
                  'exitCode',
                  equals(47),
                )
                .having(
                  (SycophancyDetectedException e) => e.matchedPattern,
                  'matchedPattern',
                  isNotEmpty,
                ),
          ),
        );
      },
    );
  });
}
