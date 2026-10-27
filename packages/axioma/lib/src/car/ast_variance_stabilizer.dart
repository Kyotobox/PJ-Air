/// Clasificación estadística de la causa de variación sintáctica (CMMI Nivel 5).
enum VarianceClassification {
  /// Anomalía estructural repetible con causa asignable (§46).
  specialCause,

  /// Ruido estadístico normal o variación cosmética/aleatoria inherente.
  commonCause,

  /// Muestra ambigua con confianza estadística insuficiente.
  indeterminate;

  bool get isSpecialCause => this == VarianceClassification.specialCause;
  bool get isCommonCause => this == VarianceClassification.commonCause;
  bool get isIndeterminate => this == VarianceClassification.indeterminate;
}

/// Muestra sintáctica candidata evaluada por el estabilizador de varianza.
class AstCandidateSample {
  final String snippet;
  final String nodeType;
  final int recurrenceCount;
  final Set<String> affectedFiles;
  final bool violatesInvariant;
  final double structuralEntropy;

  const AstCandidateSample({
    required this.snippet,
    required this.nodeType,
    required this.recurrenceCount,
    this.affectedFiles = const <String>{},
    this.violatesInvariant = false,
    this.structuralEntropy = 0.5,
  });

  void validate() {
    if (snippet.trim().isEmpty) {
      throw ArgumentError.value(
        snippet,
        'snippet',
        'El snippet de código no puede estar vacío.',
      );
    }
    if (nodeType.trim().isEmpty) {
      throw ArgumentError.value(
        nodeType,
        'nodeType',
        'El tipo de nodo sintáctico no puede estar vacío.',
      );
    }
    if (recurrenceCount < 1) {
      throw ArgumentError.value(
        recurrenceCount,
        'recurrenceCount',
        'La recurrencia debe ser al menos 1.',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'snippet': snippet,
    'node_type': nodeType,
    'recurrence_count': recurrenceCount,
    'affected_files': affectedFiles.toList(),
    'violates_invariant': violatesInvariant,
    'structural_entropy': structuralEntropy,
  };
}

/// Resultado de la evaluación estadística de varianza.
class VarianceEvaluationResult {
  final VarianceClassification classification;
  final double specialCauseScore;
  final double commonCauseScore;
  final bool isApprovedForSynthesis;
  final String rationale;

  const VarianceEvaluationResult({
    required this.classification,
    required this.specialCauseScore,
    required this.commonCauseScore,
    required this.isApprovedForSynthesis,
    required this.rationale,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'classification': classification.name,
    'special_cause_score': specialCauseScore,
    'common_cause_score': commonCauseScore,
    'approved_for_synthesis': isApprovedForSynthesis,
    'rationale': rationale,
  };
}

/// Estabilizador de Varianza de Causa Común AST (CMMI Nivel 5 CAR - §46).
///
/// Filtra las firmas de defectos detectadas para prevenir la proliferación de
/// reglas preventivas espurias basadas en ruido aleatorio de desarrollo.
class AstVarianceStabilizer {
  final double specialCauseThreshold;
  final double commonCauseThreshold;
  final int minRecurrenceThreshold;

  const AstVarianceStabilizer({
    this.specialCauseThreshold = 0.70,
    this.commonCauseThreshold = 0.60,
    this.minRecurrenceThreshold = 3,
  });

  /// Evalúa si la muestra corresponde a una Causa Especial o Causa Común.
  VarianceEvaluationResult evaluate(AstCandidateSample sample) {
    sample.validate();

    // 1. Detección directa de causa común aislada/cosmética
    final bool isSingleOccurrence = sample.recurrenceCount == 1;
    final bool isEphemeralIdentifier =
        sample.nodeType == 'SimpleIdentifier' ||
        sample.nodeType == 'VariableDeclaration';
    final bool isCosmetic =
        sample.snippet.trim().length < 6 && !sample.violatesInvariant;

    if (isSingleOccurrence &&
        !sample.violatesInvariant &&
        (isEphemeralIdentifier || isCosmetic)) {
      return const VarianceEvaluationResult(
        classification: VarianceClassification.commonCause,
        specialCauseScore: 0.10,
        commonCauseScore: 0.90,
        isApprovedForSynthesis: false,
        rationale: 'Variación de causa común: Identificador o cambio cosmético aislado sin violación de invariantes.',
      );
    }

    // 2. Cálculo ponderado de causas
    double specialScore = 0.0;
    double commonScore = 0.0;

    // A. Recurrencia
    if (sample.recurrenceCount >= minRecurrenceThreshold) {
      specialScore += 0.35;
    } else if (sample.recurrenceCount == 2) {
      specialScore += 0.15;
      commonScore += 0.20;
    } else {
      commonScore += 0.40;
    }

    // B. Violación de Invariantes Doctrinales (§4, §10, §12)
    if (sample.violatesInvariant) {
      specialScore += 0.40;
    } else {
      commonScore += 0.25;
    }

    // C. Dispersión en Archivos Afectados
    if (sample.affectedFiles.length >= 2) {
      specialScore += 0.20;
    } else if (sample.affectedFiles.length == 1) {
      specialScore += 0.05;
      commonScore += 0.10;
    }

    // D. Gravedad del Tipo de Nodo
    const Set<String> criticalNodes = <String>{
      'CatchClause',
      'AsExpression',
      'PostfixExpression',
      'MethodInvocation',
      'ConstructorInvocation',
    };

    if (criticalNodes.contains(sample.nodeType)) {
      specialScore += 0.15;
    } else {
      commonScore += 0.15;
    }

    // Normalización de scores en [0.0, 1.0]
    specialScore = (specialScore * 100).round() / 100;
    commonScore = (commonScore * 100).round() / 100;

    // Clasificación final por umbrales
    if (specialScore >= specialCauseThreshold &&
        sample.recurrenceCount >= minRecurrenceThreshold &&
        sample.violatesInvariant) {
      return VarianceEvaluationResult(
        classification: VarianceClassification.specialCause,
        specialCauseScore: specialScore,
        commonCauseScore: commonScore,
        isApprovedForSynthesis: true,
        rationale:
            'Causa Especial confirmada: Recurrencia >= $minRecurrenceThreshold con violación estructural reproducible.',
      );
    }

    if (commonScore >= commonCauseThreshold && !sample.violatesInvariant) {
      return VarianceEvaluationResult(
        classification: VarianceClassification.commonCause,
        specialCauseScore: specialScore,
        commonCauseScore: commonScore,
        isApprovedForSynthesis: false,
        rationale: 'Causa Común confirmada: Ruido estadístico sin patrón anómalo ni recurrencia estructural.',
      );
    }

    // Zona de incertidumbre estadística
    return VarianceEvaluationResult(
      classification: VarianceClassification.indeterminate,
      specialCauseScore: specialScore,
      commonCauseScore: commonScore,
      isApprovedForSynthesis: false,
      rationale:
          'Indeterminado: Umbrales no concluyentes (special: $specialScore, common: $commonScore). Retener en observación.',
    );
  }

  /// Filtra una lista de candidatos reteniendo únicamente los que califican como Causa Especial.
  List<AstCandidateSample> filterSpecialCauses(
    List<AstCandidateSample> candidates,
  ) {
    return candidates.where((AstCandidateSample sample) {
      final VarianceEvaluationResult res = evaluate(sample);
      return res.isApprovedForSynthesis;
    }).toList();
  }
}
