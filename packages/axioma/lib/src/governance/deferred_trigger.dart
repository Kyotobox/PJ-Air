/// deferred_trigger.dart — Esquema y DTO de Disparadores Diferidos de Gobernanza (§12.b, §39, §48, §54, §56).
///
/// Shared Kernel (Pure Dart Core §39) para el rastreo inmutable de umbrales condicionales
/// y alertas diferidas en toda la flota federada.
library;

import 'dart:convert';
import 'dart:io' as io;
import 'package:crypto/crypto.dart';

// =============================================================================
// EXCEPCIONES FORMALES DE GOBERNANZA (§6, §48)
// =============================================================================

/// Excepción base para el subsistema de disparadores diferidos.
abstract class DeferredTriggerException implements Exception {
  final String message;
  final String? field;

  const DeferredTriggerException(this.message, {this.field});

  @override
  String toString() =>
      'DeferredTriggerException: $message${field != null ? " (Campo: $field)" : ""}';
}

/// Excepción arrojada ante esquemas JSON corruptos, incompletos o malformados (§6).
class CorruptTriggerSchemaException extends DeferredTriggerException {
  const CorruptTriggerSchemaException(super.message, {super.field});

  @override
  String toString() =>
      'CorruptTriggerSchemaException: $message${field != null ? " (Campo: $field)" : ""}';
}

/// Excepción arrojada ante operadores o condiciones de umbral inválidas (§6).
class InvalidTriggerConditionException extends DeferredTriggerException {
  const InvalidTriggerConditionException(super.message, {super.field});

  @override
  String toString() =>
      'InvalidTriggerConditionException: $message${field != null ? " (Campo: $field)" : ""}';
}

/// Excepción arrojada ante violaciones de validación en contratos de disparador (§6).
class DeferredTriggerValidationException extends DeferredTriggerException {
  const DeferredTriggerValidationException(super.message, {super.field});

  @override
  String toString() =>
      'DeferredTriggerValidationException: $message${field != null ? " (Campo: $field)" : ""}';
}

/// Excepción arrojada cuando se detectan IDs de disparador duplicados en el ledger (§6).
class DuplicateTriggerIdException extends DeferredTriggerException {
  final String triggerId;

  const DuplicateTriggerIdException(this.triggerId)
    : super(
        'Disparador diferido duplicado detectado: "$triggerId"',
        field: 'id',
      );

  @override
  String toString() =>
      'DuplicateTriggerIdException: Disparador diferido duplicado detectado: "$triggerId" (Campo: id)';
}

/// Excepción arrojada ante inconsistencias en la firma criptográfica inmutable (§47, §48).
class TriggerIntegrityException extends DeferredTriggerException {
  final String expectedChecksum;
  final String actualChecksum;

  const TriggerIntegrityException({
    required this.expectedChecksum,
    required this.actualChecksum,
    String message = 'Violación de integridad inmutable en disparador diferido',
  }) : super(message, field: 'checksum');

  @override
  String toString() =>
      'TriggerIntegrityException: $message (Esperado: $expectedChecksum, Actual: $actualChecksum)';
}

// =============================================================================
// ENUMS FORMALES
// =============================================================================

/// Estados del ciclo de vida de un disparador diferido.
enum TriggerStatus {
  pending('PENDING'),
  triggered('TRIGGERED'),
  resolved('RESOLVED'),
  dismissed('DISMISSED');

  final String code;
  const TriggerStatus(this.code);

  bool get isPending => this == TriggerStatus.pending;
  bool get isTriggered => this == TriggerStatus.triggered;
  bool get isResolved => this == TriggerStatus.resolved;
  bool get isDismissed => this == TriggerStatus.dismissed;

  static TriggerStatus fromString(String raw) {
    final String clean = raw.trim().toUpperCase();
    for (final TriggerStatus status in TriggerStatus.values) {
      if (status.code == clean || status.name.toUpperCase() == clean) {
        return status;
      }
    }
    throw DeferredTriggerValidationException(
      'Estado de disparador diferido no reconocido: "$raw". '
      'Valores válidos: ${TriggerStatus.values.map((TriggerStatus s) => s.code).join(", ")}',
      field: 'status',
    );
  }
}

/// Operadores relacionales de comparación para umbrales métricos.
enum TriggerOperator {
  greaterThanOrEqual('>='),
  greaterThan('>'),
  lessThanOrEqual('<='),
  lessThan('<'),
  equals('=='),
  notEquals('!=');

  final String symbol;
  const TriggerOperator(this.symbol);

  /// Evalúa si el valor métrico observado cumple la condición respecto al umbral.
  bool evaluate(num metricValue, num thresholdValue) {
    switch (this) {
      case TriggerOperator.greaterThanOrEqual:
        return metricValue >= thresholdValue;
      case TriggerOperator.greaterThan:
        return metricValue > thresholdValue;
      case TriggerOperator.lessThanOrEqual:
        return metricValue <= thresholdValue;
      case TriggerOperator.lessThan:
        return metricValue < thresholdValue;
      case TriggerOperator.equals:
        return metricValue == thresholdValue;
      case TriggerOperator.notEquals:
        return metricValue != thresholdValue;
    }
  }

  static TriggerOperator fromString(String raw) {
    final String clean = raw.trim();
    for (final TriggerOperator op in TriggerOperator.values) {
      if (op.symbol == clean || op.name == clean) {
        return op;
      }
    }
    throw InvalidTriggerConditionException(
      'Operador relacional no reconocido: "$raw". '
      'Valores válidos: ${TriggerOperator.values.map((TriggerOperator o) => o.symbol).join(", ")}',
      field: 'operator',
    );
  }
}

/// Severidad o nivel de impacto del disparador diferido.
enum TriggerSeverity {
  info('INFO'),
  warning('WARNING'),
  critical('CRITICAL'),
  s1('S1'),
  s2('S2');

  final String code;
  const TriggerSeverity(this.code);

  static TriggerSeverity fromString(String raw) {
    final String clean = raw.trim().toUpperCase();
    for (final TriggerSeverity sev in TriggerSeverity.values) {
      if (sev.code == clean || sev.name.toUpperCase() == clean) {
        return sev;
      }
    }
    throw DeferredTriggerValidationException(
      'Nivel de severidad no reconocido: "$raw". '
      'Valores válidos: ${TriggerSeverity.values.map((TriggerSeverity s) => s.code).join(", ")}',
      field: 'severity',
    );
  }
}

// =============================================================================
// DTOS FORMALES (§39, §48)
// =============================================================================

/// Condición de umbral métrico evaluable.
class TriggerCondition {
  final String metric;
  final TriggerOperator operator;
  final num threshold;
  final String? unit;
  final num? observedValue;
  final DateTime? observedAt;

  const TriggerCondition({
    required this.metric,
    required this.operator,
    required this.threshold,
    this.unit,
    this.observedValue,
    this.observedAt,
  });

  /// Evalúa el valor observado contra el umbral configurado.
  bool evaluate(num metricValue) {
    return operator.evaluate(metricValue, threshold);
  }

  /// Retorna una copia con la última observación registrada.
  TriggerCondition withObservation(num value, {DateTime? at}) {
    return TriggerCondition(
      metric: metric,
      operator: operator,
      threshold: threshold,
      unit: unit,
      observedValue: value,
      observedAt: at ?? DateTime.now().toUtc(),
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'metric': metric,
      'operator': operator.symbol,
      'threshold': threshold,
      if (unit != null) 'unit': unit,
      if (observedValue != null) 'observed_value': observedValue,
      if (observedAt != null) 'observed_at': observedAt!.toIso8601String(),
    };
  }

  factory TriggerCondition.fromJson(dynamic raw) {
    if (raw == null || raw is! Map<String, dynamic>) {
      throw const InvalidTriggerConditionException(
        'El campo "condition" debe ser un objeto JSON válido.',
        field: 'condition',
      );
    }

    final dynamic rawMetric = raw['metric'];
    if (rawMetric == null || rawMetric is! String || rawMetric.trim().isEmpty) {
      throw const InvalidTriggerConditionException(
        'La métrica de condición no puede ser nula ni vacía.',
        field: 'metric',
      );
    }

    final dynamic rawOperator = raw['operator'];
    if (rawOperator == null || rawOperator is! String) {
      throw const InvalidTriggerConditionException(
        'El operador relacional de la condición es obligatorio.',
        field: 'operator',
      );
    }
    final TriggerOperator op = TriggerOperator.fromString(rawOperator);

    final dynamic rawThreshold = raw['threshold'];
    if (rawThreshold == null ||
        rawThreshold is! num ||
        rawThreshold.isNaN ||
        rawThreshold.isInfinite) {
      throw const InvalidTriggerConditionException(
        'El umbral debe ser un número finito válido.',
        field: 'threshold',
      );
    }

    DateTime? observedAt;
    if (raw['observed_at'] != null) {
      observedAt = DateTime.tryParse(raw['observed_at'].toString())?.toUtc();
    }

    num? observedValue;
    if (raw['observed_value'] != null && raw['observed_value'] is num) {
      observedValue = raw['observed_value'] as num;
    }

    return TriggerCondition(
      metric: rawMetric.trim(),
      operator: op,
      threshold: rawThreshold,
      unit: raw['unit'] as String?,
      observedValue: observedValue,
      observedAt: observedAt,
    );
  }
}

/// Contrato formal e inmutable de un Disparador Diferido de Gobernanza (§12.b, §39, §48).
class DeferredTriggerContract {
  static final RegExp _validIdPattern = RegExp(r'^[a-zA-Z0-9_\-]+$');

  final String id;
  final String title;
  final String description;
  final String targetNode;
  final TriggerCondition condition;
  final TriggerSeverity severity;
  final TriggerStatus status;
  final String actionableSuggestion;
  final String? suggestedSprint;
  final DateTime createdAt;
  final DateTime? triggeredAt;
  final DateTime? resolvedAt;
  final DateTime? lastEvaluatedAt;
  final Map<String, dynamic> metadata;
  final String checksum;

  DeferredTriggerContract._({
    required this.id,
    required this.title,
    required this.description,
    required this.targetNode,
    required this.condition,
    required this.severity,
    required this.status,
    required this.actionableSuggestion,
    this.suggestedSprint,
    required this.createdAt,
    this.triggeredAt,
    this.resolvedAt,
    this.lastEvaluatedAt,
    this.metadata = const <String, dynamic>{},
    required this.checksum,
  });

  /// Factory creador que calcula automáticamente la firma inmutable de trazabilidad (§48).
  factory DeferredTriggerContract.create({
    required String id,
    required String title,
    required String description,
    required String targetNode,
    required TriggerCondition condition,
    TriggerSeverity severity = TriggerSeverity.warning,
    TriggerStatus status = TriggerStatus.pending,
    required String actionableSuggestion,
    String? suggestedSprint,
    DateTime? createdAt,
    DateTime? triggeredAt,
    DateTime? resolvedAt,
    DateTime? lastEvaluatedAt,
    Map<String, dynamic> metadata = const <String, dynamic>{},
  }) {
    _validateFields(
      id: id,
      title: title,
      targetNode: targetNode,
      actionableSuggestion: actionableSuggestion,
    );

    final DateTime created = (createdAt ?? DateTime.now()).toUtc();
    final String computed = computeChecksum(
      id: id.trim(),
      targetNode: targetNode.trim(),
      metric: condition.metric,
      operatorSymbol: condition.operator.symbol,
      threshold: condition.threshold,
      createdAtIso: created.toIso8601String(),
    );

    return DeferredTriggerContract._(
      id: id.trim(),
      title: title.trim(),
      description: description.trim(),
      targetNode: targetNode.trim(),
      condition: condition,
      severity: severity,
      status: status,
      actionableSuggestion: actionableSuggestion.trim(),
      suggestedSprint: suggestedSprint?.trim(),
      createdAt: created,
      triggeredAt: triggeredAt?.toUtc(),
      resolvedAt: resolvedAt?.toUtc(),
      lastEvaluatedAt: lastEvaluatedAt?.toUtc(),
      metadata: Map<String, dynamic>.unmodifiable(metadata),
      checksum: computed,
    );
  }

  /// Calcula el hash SHA-256 inmutable de la regla base.
  static String computeChecksum({
    required String id,
    required String targetNode,
    required String metric,
    required String operatorSymbol,
    required num threshold,
    required String createdAtIso,
  }) {
    final String canonical =
        '$id|$targetNode|$metric|$operatorSymbol|$threshold|$createdAtIso';
    return sha256.convert(utf8.encode(canonical)).toString();
  }

  static void _validateFields({
    required String id,
    required String title,
    required String targetNode,
    required String actionableSuggestion,
  }) {
    final String cleanId = id.trim();
    if (cleanId.isEmpty) {
      throw const DeferredTriggerValidationException(
        'El ID del disparador diferido no puede estar vacío.',
        field: 'id',
      );
    }
    if (!_validIdPattern.hasMatch(cleanId)) {
      throw DeferredTriggerValidationException(
        'El ID "$cleanId" contiene caracteres inválidos. Solo se admiten alfanuméricos, "_" y "-".',
        field: 'id',
      );
    }

    final String cleanTitle = title.trim();
    if (cleanTitle.isEmpty) {
      throw const DeferredTriggerValidationException(
        'El título del disparador diferido no puede estar vacío.',
        field: 'title',
      );
    }

    final String cleanNode = targetNode.trim();
    if (cleanNode.isEmpty) {
      throw const DeferredTriggerValidationException(
        'El nodo objetivo del disparador diferido no puede estar vacío.',
        field: 'target_node',
      );
    }

    final String cleanSuggestion = actionableSuggestion.trim();
    if (cleanSuggestion.isEmpty) {
      throw const DeferredTriggerValidationException(
        'La sugerencia accionable no puede estar vacía.',
        field: 'actionable_suggestion',
      );
    }
  }

  /// Verifica si el checksum coincide con la firma inmutable de la regla.
  bool verifyIntegrity() {
    final String expected = computeChecksum(
      id: id,
      targetNode: targetNode,
      metric: condition.metric,
      operatorSymbol: condition.operator.symbol,
      threshold: condition.threshold,
      createdAtIso: createdAt.toIso8601String(),
    );
    return expected == checksum;
  }

  /// Evalúa si el valor métrico recibido cruza el umbral.
  bool evaluate(num metricValue) {
    return condition.evaluate(metricValue);
  }

  /// Dispara el umbral, mutando el estado a TRIGGERED y registrando la fecha y valor observado.
  DeferredTriggerContract trigger({
    num? observedValue,
    DateTime? timestamp,
    String? note,
  }) {
    final DateTime now = (timestamp ?? DateTime.now()).toUtc();
    final TriggerCondition updatedCondition = observedValue != null
        ? condition.withObservation(observedValue, at: now)
        : condition;

    final Map<String, dynamic> updatedMeta = Map<String, dynamic>.from(
      metadata,
    );
    if (note != null) {
      updatedMeta['trigger_note'] = note;
    }

    return DeferredTriggerContract._(
      id: id,
      title: title,
      description: description,
      targetNode: targetNode,
      condition: updatedCondition,
      severity: severity,
      status: TriggerStatus.triggered,
      actionableSuggestion: actionableSuggestion,
      suggestedSprint: suggestedSprint,
      createdAt: createdAt,
      triggeredAt: now,
      resolvedAt: resolvedAt,
      lastEvaluatedAt: now,
      metadata: Map<String, dynamic>.unmodifiable(updatedMeta),
      checksum: checksum,
    );
  }

  /// Resuelve el disparador tras remediación, mutando el estado a RESOLVED.
  DeferredTriggerContract resolve({
    DateTime? timestamp,
    String? resolutionNotes,
  }) {
    final DateTime now = (timestamp ?? DateTime.now()).toUtc();
    final Map<String, dynamic> updatedMeta = Map<String, dynamic>.from(
      metadata,
    );
    if (resolutionNotes != null) {
      updatedMeta['resolution_notes'] = resolutionNotes;
    }

    return DeferredTriggerContract._(
      id: id,
      title: title,
      description: description,
      targetNode: targetNode,
      condition: condition,
      severity: severity,
      status: TriggerStatus.resolved,
      actionableSuggestion: actionableSuggestion,
      suggestedSprint: suggestedSprint,
      createdAt: createdAt,
      triggeredAt: triggeredAt,
      resolvedAt: now,
      lastEvaluatedAt: now,
      metadata: Map<String, dynamic>.unmodifiable(updatedMeta),
      checksum: checksum,
    );
  }

  /// Descarta el disparador si quedó obsoleto o desestimado.
  DeferredTriggerContract dismiss({DateTime? timestamp, String? reason}) {
    final DateTime now = (timestamp ?? DateTime.now()).toUtc();
    final Map<String, dynamic> updatedMeta = Map<String, dynamic>.from(
      metadata,
    );
    if (reason != null) {
      updatedMeta['dismiss_reason'] = reason;
    }

    return DeferredTriggerContract._(
      id: id,
      title: title,
      description: description,
      targetNode: targetNode,
      condition: condition,
      severity: severity,
      status: TriggerStatus.dismissed,
      actionableSuggestion: actionableSuggestion,
      suggestedSprint: suggestedSprint,
      createdAt: createdAt,
      triggeredAt: triggeredAt,
      resolvedAt: resolvedAt,
      lastEvaluatedAt: now,
      metadata: Map<String, dynamic>.unmodifiable(updatedMeta),
      checksum: checksum,
    );
  }

  /// Serializa a JSON canónico.
  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'title': title,
      'description': description,
      'target_node': targetNode,
      'condition': condition.toJson(),
      'severity': severity.code,
      'status': status.code,
      'actionable_suggestion': actionableSuggestion,
      if (suggestedSprint != null) 'suggested_sprint': suggestedSprint,
      'created_at': createdAt.toIso8601String(),
      if (triggeredAt != null) 'triggered_at': triggeredAt!.toIso8601String(),
      if (resolvedAt != null) 'resolved_at': resolvedAt!.toIso8601String(),
      if (lastEvaluatedAt != null)
        'last_evaluated_at': lastEvaluatedAt!.toIso8601String(),
      if (metadata.isNotEmpty) 'metadata': metadata,
      'checksum': checksum,
    };
  }

  /// Deserializa y valida exhaustivamente desde JSON (§6).
  factory DeferredTriggerContract.fromJson(dynamic raw) {
    if (raw == null || raw is! Map<String, dynamic>) {
      throw const DeferredTriggerValidationException(
        'El disparador diferido debe ser un objeto JSON.',
      );
    }

    final dynamic rawId = raw['id'];
    if (rawId == null || rawId is! String) {
      throw const DeferredTriggerValidationException(
        'El campo "id" es obligatorio y debe ser una cadena.',
        field: 'id',
      );
    }

    final dynamic rawTitle = raw['title'];
    if (rawTitle == null || rawTitle is! String) {
      throw const DeferredTriggerValidationException(
        'El campo "title" es obligatorio y debe ser una cadena.',
        field: 'title',
      );
    }

    final dynamic rawDescription = raw['description'] ?? '';
    if (rawDescription is! String) {
      throw const DeferredTriggerValidationException(
        'El campo "description" debe ser una cadena.',
        field: 'description',
      );
    }

    final dynamic rawNode = raw['target_node'];
    if (rawNode == null || rawNode is! String) {
      throw const DeferredTriggerValidationException(
        'El campo "target_node" es obligatorio y debe ser una cadena.',
        field: 'target_node',
      );
    }

    final dynamic rawSuggestion = raw['actionable_suggestion'];
    if (rawSuggestion == null || rawSuggestion is! String) {
      throw const DeferredTriggerValidationException(
        'El campo "actionable_suggestion" es obligatorio y debe ser una cadena.',
        field: 'actionable_suggestion',
      );
    }

    _validateFields(
      id: rawId,
      title: rawTitle,
      targetNode: rawNode,
      actionableSuggestion: rawSuggestion,
    );

    final TriggerCondition condition = TriggerCondition.fromJson(
      raw['condition'],
    );

    final dynamic rawStatus = raw['status'];
    if (rawStatus == null || rawStatus is! String) {
      throw const DeferredTriggerValidationException(
        'El campo "status" es obligatorio y debe ser una cadena.',
        field: 'status',
      );
    }
    final TriggerStatus status = TriggerStatus.fromString(rawStatus);

    TriggerSeverity severity = TriggerSeverity.warning;
    if (raw['severity'] != null) {
      severity = TriggerSeverity.fromString(raw['severity'].toString());
    }

    final dynamic rawCreatedAt = raw['created_at'];
    if (rawCreatedAt == null || rawCreatedAt is! String) {
      throw const DeferredTriggerValidationException(
        'El campo "created_at" es obligatorio y debe ser una fecha ISO 8601.',
        field: 'created_at',
      );
    }
    final DateTime? createdAt = DateTime.tryParse(rawCreatedAt);
    if (createdAt == null) {
      throw const DeferredTriggerValidationException(
        'El formato de fecha en "created_at" es inválido.',
        field: 'created_at',
      );
    }

    DateTime? triggeredAt;
    if (raw['triggered_at'] != null) {
      triggeredAt = DateTime.tryParse(raw['triggered_at'].toString())?.toUtc();
    }

    DateTime? resolvedAt;
    if (raw['resolved_at'] != null) {
      resolvedAt = DateTime.tryParse(raw['resolved_at'].toString())?.toUtc();
    }

    DateTime? lastEvaluatedAt;
    if (raw['last_evaluated_at'] != null) {
      lastEvaluatedAt = DateTime.tryParse(
        raw['last_evaluated_at'].toString(),
      )?.toUtc();
    }

    Map<String, dynamic> metadata = const <String, dynamic>{};
    if (raw['metadata'] != null) {
      if (raw['metadata'] is! Map<String, dynamic>) {
        throw const DeferredTriggerValidationException(
          'El campo "metadata" debe ser un mapa JSON.',
          field: 'metadata',
        );
      }
      metadata = raw['metadata'] as Map<String, dynamic>;
    }

    final String computedChecksum = computeChecksum(
      id: rawId.trim(),
      targetNode: rawNode.trim(),
      metric: condition.metric,
      operatorSymbol: condition.operator.symbol,
      threshold: condition.threshold,
      createdAtIso: createdAt.toUtc().toIso8601String(),
    );

    final dynamic rawChecksum = raw['checksum'];
    if (rawChecksum != null &&
        rawChecksum is String &&
        rawChecksum.isNotEmpty &&
        rawChecksum != computedChecksum) {
      throw TriggerIntegrityException(
        expectedChecksum: computedChecksum,
        actualChecksum: rawChecksum,
      );
    }

    return DeferredTriggerContract._(
      id: rawId.trim(),
      title: rawTitle.trim(),
      description: rawDescription.trim(),
      targetNode: rawNode.trim(),
      condition: condition,
      severity: severity,
      status: status,
      actionableSuggestion: rawSuggestion.trim(),
      suggestedSprint: raw['suggested_sprint'] as String?,
      createdAt: createdAt.toUtc(),
      triggeredAt: triggeredAt,
      resolvedAt: resolvedAt,
      lastEvaluatedAt: lastEvaluatedAt,
      metadata: Map<String, dynamic>.unmodifiable(metadata),
      checksum: computedChecksum,
    );
  }
}

// =============================================================================
// LEDGER / CONTENEDOR FORMAL (§12.b, §39, §48, §54)
// =============================================================================

/// Contenedor formal para la persistencia y auditoría de disparadores diferidos
/// en `vault/governance/deferred_triggers.json`.
class DeferredTriggerLedger {
  static const String currentSchemaVersion = '1.0.0';

  final String schemaVersion;
  final String description;
  final DateTime updatedAt;
  final List<DeferredTriggerContract> triggers;

  DeferredTriggerLedger({
    required this.schemaVersion,
    required this.description,
    required this.updatedAt,
    required List<DeferredTriggerContract> triggers,
  }) : triggers = List<DeferredTriggerContract>.unmodifiable(triggers);

  /// Obtiene los disparadores que se encuentran actualmente disparados (TRIGGERED).
  List<DeferredTriggerContract> get activeTriggers => triggers
      .where((DeferredTriggerContract t) => t.status.isTriggered)
      .toList();

  /// Obtiene los disparadores pendientes de evaluación (PENDING).
  List<DeferredTriggerContract> get pendingTriggers => triggers
      .where((DeferredTriggerContract t) => t.status.isPending)
      .toList();

  /// Obtiene los disparadores resueltos (RESOLVED).
  List<DeferredTriggerContract> get resolvedTriggers => triggers
      .where((DeferredTriggerContract t) => t.status.isResolved)
      .toList();

  /// Busca un disparador por su ID único.
  DeferredTriggerContract? findById(String id) {
    for (final DeferredTriggerContract trigger in triggers) {
      if (trigger.id == id) {
        return trigger;
      }
    }
    return null;
  }

  /// Retorna todos los disparadores correspondientes a un nodo específico (§56).
  List<DeferredTriggerContract> findByTargetNode(String node) {
    return triggers
        .where(
          (DeferredTriggerContract t) =>
              t.targetNode.toLowerCase() == node.trim().toLowerCase(),
        )
        .toList();
  }

  /// Agrega un nuevo disparador verificando la ausencia de duplicados (§6).
  DeferredTriggerLedger withTrigger(DeferredTriggerContract trigger) {
    if (findById(trigger.id) != null) {
      throw DuplicateTriggerIdException(trigger.id);
    }
    final List<DeferredTriggerContract> updatedList =
        List<DeferredTriggerContract>.from(triggers)..add(trigger);
    return DeferredTriggerLedger(
      schemaVersion: schemaVersion,
      description: description,
      updatedAt: DateTime.now().toUtc(),
      triggers: updatedList,
    );
  }

  /// Reemplaza o actualiza un disparador existente conservando la inmutabilidad.
  DeferredTriggerLedger updateTrigger(DeferredTriggerContract updated) {
    final int index = triggers.indexWhere(
      (DeferredTriggerContract t) => t.id == updated.id,
    );
    if (index == -1) {
      throw DeferredTriggerValidationException(
        'No se puede actualizar el disparador inexistente: "${updated.id}"',
        field: 'id',
      );
    }
    final List<DeferredTriggerContract> updatedList =
        List<DeferredTriggerContract>.from(triggers);
    updatedList[index] = updated;

    return DeferredTriggerLedger(
      schemaVersion: schemaVersion,
      description: description,
      updatedAt: DateTime.now().toUtc(),
      triggers: updatedList,
    );
  }

  /// Deserializa y valida el esquema del ledger completo (§6).
  factory DeferredTriggerLedger.fromJson(dynamic raw) {
    if (raw == null || raw is! Map<String, dynamic>) {
      throw const CorruptTriggerSchemaException(
        'El archivo de disparadores diferidos debe contener un objeto JSON raíz.',
      );
    }

    final dynamic version = raw['schema_version'];
    if (version == null || version is! String || version.trim().isEmpty) {
      throw const CorruptTriggerSchemaException(
        'El campo "schema_version" es obligatorio y debe ser una cadena no vacía.',
        field: 'schema_version',
      );
    }

    final dynamic rawTriggers = raw['triggers'];
    if (rawTriggers == null || rawTriggers is! List) {
      throw const CorruptTriggerSchemaException(
        'El campo "triggers" es obligatorio y debe ser una lista de disparadores.',
        field: 'triggers',
      );
    }

    final String description =
        raw['description'] as String? ??
        'Ledger formal de disparadores diferidos de gobernanza';

    DateTime updatedAt = DateTime.now().toUtc();
    if (raw['updated_at'] != null) {
      updatedAt =
          DateTime.tryParse(raw['updated_at'].toString())?.toUtc() ?? updatedAt;
    }

    final Set<String> seenIds = <String>{};
    final List<DeferredTriggerContract> parsedTriggers =
        <DeferredTriggerContract>[];

    for (int i = 0; i < rawTriggers.length; i++) {
      final dynamic item = rawTriggers[i];
      if (item is! Map<String, dynamic>) {
        throw CorruptTriggerSchemaException(
          'El elemento en el índice $i de "triggers" no es un objeto válido.',
          field: 'triggers[$i]',
        );
      }

      final DeferredTriggerContract trigger = DeferredTriggerContract.fromJson(
        item,
      );
      if (!seenIds.add(trigger.id)) {
        throw DuplicateTriggerIdException(trigger.id);
      }
      parsedTriggers.add(trigger);
    }

    return DeferredTriggerLedger(
      schemaVersion: version.trim(),
      description: description.trim(),
      updatedAt: updatedAt,
      triggers: parsedTriggers,
    );
  }

  /// Carga el ledger desde un archivo en disco.
  static DeferredTriggerLedger loadFromFile(String filePath) {
    final io.File file = io.File(filePath);
    if (!file.existsSync()) {
      throw CorruptTriggerSchemaException(
        'El archivo de disparadores diferidos no existe: "$filePath"',
      );
    }
    final String content = file.readAsStringSync();
    if (content.trim().isEmpty) {
      throw CorruptTriggerSchemaException(
        'El archivo de disparadores diferidos está vacío: "$filePath"',
      );
    }

    dynamic decoded;
    try {
      decoded = jsonDecode(content);
    } catch (e) {
      throw CorruptTriggerSchemaException(
        'Sintaxis JSON corrupta en el archivo "$filePath": $e',
      );
    }

    return DeferredTriggerLedger.fromJson(decoded);
  }

  /// Serializa a JSON canónico formateado con indentación de 2 espacios.
  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'schema_version': schemaVersion,
      'description': description,
      'updated_at': updatedAt.toIso8601String(),
      'triggers': triggers
          .map((DeferredTriggerContract t) => t.toJson())
          .toList(growable: false),
    };
  }

  /// Guarda el ledger en disco de manera atómica con codificación UTF-8.
  void saveToFile(String filePath) {
    final io.File file = io.File(filePath);
    if (!file.parent.existsSync()) {
      file.parent.createSync(recursive: true);
    }
    final String formattedJson = const JsonEncoder.withIndent(
      '  ',
    ).convert(toJson());
    file.writeAsStringSync('$formattedJson\n');
  }
}
