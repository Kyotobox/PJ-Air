import 'ast_signature_extractor.dart';

/// Decisión emitida por el evaluador de ciclo de vida.
enum LifecycleDecision {
  /// Promovida de cuarentena (warn) a regla activa bloqueante (error).
  promoted,

  /// Retenida en periodo de observación/cuarentena.
  retainInQuarantine,

  /// Revocada o vetada debido a falsos positivos reiterados.
  vetoed;

  bool get isPromoted => this == LifecycleDecision.promoted;
  bool get isRetained => this == LifecycleDecision.retainInQuarantine;
  bool get isVetoed => this == LifecycleDecision.vetoed;
}

/// Registro de seguimiento de una regla durante su periodo de cuarentena.
class RuleQuarantineRecord {
  final String ruleId;
  final CarPromotionStatus status;
  final CarRuleSeverity severity;
  final int sprintsInQuarantine;
  final int falsePositivesCount;
  final int truePositivesCount;
  final DateTime quarantinedAt;
  final DateTime? lastEvaluatedAt;

  const RuleQuarantineRecord({
    required this.ruleId,
    this.status = CarPromotionStatus.observation,
    this.severity = CarRuleSeverity.warn,
    this.sprintsInQuarantine = 0,
    this.falsePositivesCount = 0,
    this.truePositivesCount = 0,
    required this.quarantinedAt,
    this.lastEvaluatedAt,
  });

  void validate() {
    if (ruleId.trim().isEmpty) {
      throw ArgumentError.value(
        ruleId,
        'ruleId',
        'El identificador de regla ruleId no puede estar vacío.',
      );
    }
    if (sprintsInQuarantine < 0) {
      throw ArgumentError.value(
        sprintsInQuarantine,
        'sprintsInQuarantine',
        'El contador de sprints en cuarentena no puede ser negativo.',
      );
    }
    if (falsePositivesCount < 0) {
      throw ArgumentError.value(
        falsePositivesCount,
        'falsePositivesCount',
        'El contador de falsos positivos no puede ser negativo.',
      );
    }
    if (truePositivesCount < 0) {
      throw ArgumentError.value(
        truePositivesCount,
        'truePositivesCount',
        'El contador de verdaderos positivos no puede ser negativo.',
      );
    }
  }

  RuleQuarantineRecord copyWith({
    CarPromotionStatus? status,
    CarRuleSeverity? severity,
    int? sprintsInQuarantine,
    int? falsePositivesCount,
    int? truePositivesCount,
    DateTime? lastEvaluatedAt,
  }) {
    return RuleQuarantineRecord(
      ruleId: ruleId,
      status: status ?? this.status,
      severity: severity ?? this.severity,
      sprintsInQuarantine: sprintsInQuarantine ?? this.sprintsInQuarantine,
      falsePositivesCount: falsePositivesCount ?? this.falsePositivesCount,
      truePositivesCount: truePositivesCount ?? this.truePositivesCount,
      quarantinedAt: quarantinedAt,
      lastEvaluatedAt: lastEvaluatedAt ?? this.lastEvaluatedAt,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'rule_id': ruleId,
    'status': status.name.toUpperCase(),
    'severity': severity.name.toUpperCase(),
    'sprints_in_quarantine': sprintsInQuarantine,
    'false_positives': falsePositivesCount,
    'true_positives': truePositivesCount,
    'quarantined_at': quarantinedAt.toIso8601String(),
    'last_evaluated_at': lastEvaluatedAt?.toIso8601String(),
  };
}

/// Resultado de la evaluación de ciclo de vida de una regla preventiva.
class LifecycleEvaluationResult {
  final RuleQuarantineRecord updatedRecord;
  final LifecycleDecision decision;
  final String reason;

  const LifecycleEvaluationResult({
    required this.updatedRecord,
    required this.decision,
    required this.reason,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'record': updatedRecord.toJson(),
    'decision': decision.name,
    'reason': reason,
  };
}

/// Evaluador de Cuarentena y Promoción de Reglas en CarEngine (CMMI Nivel 5 CAR - §46).
///
/// Gestiona la transición gradual de reglas preventivas desde observación no-bloqueante
/// (WARNING) hasta reglas de producción obligatorias (ERROR en AutoMergeGate).
class QuarantineLifecycleEvaluator {
  final int minSprintsForPromotion;
  final int maxAllowedFalsePositives;
  final int fatalFalsePositiveThreshold;

  const QuarantineLifecycleEvaluator({
    this.minSprintsForPromotion = 3,
    this.maxAllowedFalsePositives = 0,
    this.fatalFalsePositiveThreshold = 3,
  });

  /// Evalúa el estado de una regla en cuarentena y computa su decisión de ciclo de vida.
  LifecycleEvaluationResult evaluate(RuleQuarantineRecord record) {
    record.validate();

    final DateTime now = DateTime.now();

    // 1. Falsos positivos fatales -> Revocación inmediata (vetoed)
    if (record.falsePositivesCount >= fatalFalsePositiveThreshold) {
      final RuleQuarantineRecord updated = record.copyWith(
        status: CarPromotionStatus.vetoed,
        severity: CarRuleSeverity.warn,
        lastEvaluatedAt: now,
      );
      return LifecycleEvaluationResult(
        updatedRecord: updated,
        decision: LifecycleDecision.vetoed,
        reason:
            'Regla revocada: acumuló ${record.falsePositivesCount} falsos positivos (umbral fatal: $fatalFalsePositiveThreshold).',
      );
    }

    // 2. Falsos positivos menores -> Retener en cuarentena y extender observación
    if (record.falsePositivesCount > maxAllowedFalsePositives) {
      final RuleQuarantineRecord updated = record.copyWith(
        status: CarPromotionStatus.observation,
        severity: CarRuleSeverity.warn,
        lastEvaluatedAt: now,
      );
      return LifecycleEvaluationResult(
        updatedRecord: updated,
        decision: LifecycleDecision.retainInQuarantine,
        reason:
            'Cuarentena extendida: ${record.falsePositivesCount} falsos positivos reportados. Requiere ajuste de patrón AST.',
      );
    }

    // 3. Sprints suficientes sin falsos positivos -> Promoción a regla activa (ERROR)
    if (record.sprintsInQuarantine >= minSprintsForPromotion &&
        record.falsePositivesCount == 0) {
      final RuleQuarantineRecord updated = record.copyWith(
        status: CarPromotionStatus.promoted,
        severity: CarRuleSeverity.error,
        lastEvaluatedAt: now,
      );
      return LifecycleEvaluationResult(
        updatedRecord: updated,
        decision: LifecycleDecision.promoted,
        reason:
            'Promoción exitosa: ${record.sprintsInQuarantine} sprints en cuarentena con 0 falsos positivos. Promovida a ERROR bloqueante.',
      );
    }

    // 4. Periodo de observación nominal en curso
    final RuleQuarantineRecord updated = record.copyWith(
      status: CarPromotionStatus.observation,
      severity: CarRuleSeverity.warn,
      lastEvaluatedAt: now,
    );
    return LifecycleEvaluationResult(
      updatedRecord: updated,
      decision: LifecycleDecision.retainInQuarantine,
      reason:
          'Periodo de observación en curso: ${record.sprintsInQuarantine}/$minSprintsForPromotion sprints requeridos.',
    );
  }

  /// Evalúa un lote completo de registros de cuarentena.
  List<LifecycleEvaluationResult> evaluateBatch(
    List<RuleQuarantineRecord> records,
  ) {
    return records.map(evaluate).toList();
  }
}
