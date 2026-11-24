/// counterweight_gate.dart — Compuerta Mecánica de Contrapeso Crítico (§4, §6, §39, §46, §47, §61.2, §63).
///
/// Intercepta directivas y solicita el bloque mandatorio de Causa Raíz y Contrapeso
/// ante operaciones destructivas o servilismo cognitivo en Pure Dart.
library;

import 'directive_classifier.dart';
import 'governance_exceptions.dart';

/// Resultado de la evaluación de la compuerta de contrapeso.
class CounterweightValidationResult {
  final bool isValid;
  final DirectiveClassification classification;
  final List<String> verifiedGates;

  const CounterweightValidationResult({
    required this.isValid,
    required this.classification,
    this.verifiedGates = const <String>[],
  });
}

/// Compuerta mecánica de pre-evaluación y contrapeso crítico (§63).
class CounterweightGate {
  final DirectiveClassifier classifier;

  const CounterweightGate({this.classifier = const DirectiveClassifier()});

  /// Evalúa una directiva operativa frente a las doctrinas constitucionales §61.2 y §63.
  CounterweightValidationResult validate({
    required String directiveText,
    String? justificationBlock,
  }) {
    final DirectiveClassification classification = classifier.classify(
      directiveText,
    );

    // 1. Veto a la complacencia cognitiva y teatros procedimentales (§47, §61.2, §63.4)
    if (classification.isSycophantic) {
      throw SycophancyDetectedException(
        'Veto de Gobernanza (§47, §61.2, §63.4): Se detectó servilismo cognitivo o simulación de teatro procedimental.',
        matchedPattern: classification.sycophancySnippet ?? '',
      );
    }

    // 2. Si la directiva es de lectura o exploratoria, se autoriza directamente
    if (classification.isReadOnly || classification.isExploratory) {
      return CounterweightValidationResult(
        isValid: true,
        classification: classification,
        verifiedGates: const <String>['PASS_NON_DESTRUCTIVE'],
      );
    }

    // 3. Si la directiva es destructiva, exige el bloque constitucional obligatorio (§63.2)
    if (classification.isDestructive) {
      final String block = (justificationBlock ?? '').trim();
      if (block.isEmpty) {
        throw const MissingRootCauseBlockException(
          'Veto de Gobernanza (§63.2): La directiva destructiva fue rechazada. Se exige el bloque mandatorio de Verificación de Causa Raíz y Contrapeso Crítico antes de cualquier ejecución.',
          missingSections: <String>[
            'CAUSA RAÍZ (Causality Check)',
            'IMPACTO COLATERAL (Blast Radius)',
            'PROPUESTA DE CONTRAPESO LEAN (Alternative)',
          ],
        );
      }

      final List<String> missing = <String>[];
      final bool hasCausality = RegExp(
        r'\b(causa\s+ra[ií]z|causality\s+check)\b',
        caseSensitive: false,
      ).hasMatch(block);
      final bool hasBlastRadius = RegExp(
        r'\b(impacto\s+colateral|blast\s+radius)\b',
        caseSensitive: false,
      ).hasMatch(block);
      final bool hasLeanAlternative = RegExp(
        r'\b(contrapeso|alternativa|propuesta\s+de\s+contrapeso)\b',
        caseSensitive: false,
      ).hasMatch(block);

      if (!hasCausality) missing.add('CAUSA RAÍZ (Causality Check)');
      if (!hasBlastRadius) missing.add('IMPACTO COLATERAL (Blast Radius)');
      if (!hasLeanAlternative)
        missing.add('PROPUESTA DE CONTRAPESO LEAN (Alternative)');

      if (missing.isNotEmpty) {
        throw MissingRootCauseBlockException(
          'Veto de Gobernanza (§63.2): El bloque de justificación es incompleto. Secciones faltantes requeridas por el Protocolo de Trabajo Conjunto.',
          missingSections: missing,
        );
      }

      return CounterweightValidationResult(
        isValid: true,
        classification: classification,
        verifiedGates: const <String>[
          'GATE_1_CAUSALITY_VERIFIED',
          'GATE_2_BLAST_RADIUS_QUANTIFIED',
          'GATE_3_COUNTERWEIGHT_LEAN_ACTIVE',
        ],
      );
    }

    // Directiva híbrida autorizada con verificación ligera
    return CounterweightValidationResult(
      isValid: true,
      classification: classification,
      verifiedGates: const <String>['PASS_HYBRID_LOW_RISK'],
    );
  }
}
