import 'dart:convert';

/// Códigos auditables de error para directivas tácticas de Praxis (§4, §6).
abstract final class TacticalDirectiveErrorCodes {
  /// Campo `target_node` ausente, nulo o vacío.
  static const String targetNodeEmpty = 'ERR_DIRECTIVE_TARGET_NODE_EMPTY';

  /// Fecha `expires_at` expirada respecto al tiempo de referencia.
  static const String expired = 'ERR_DIRECTIVE_EXPIRED';

  /// Campo `source_node` diferente a 'praxis' (fijo por contrato).
  static const String invalidSourceNode = 'ERR_DIRECTIVE_INVALID_SOURCE_NODE';

  /// Formato de fecha `expires_at` inválido (no conforme a ISO-8601).
  static const String invalidExpiresAt = 'ERR_DIRECTIVE_INVALID_EXPIRES_AT';

  /// Campo `directive_id` ausente, nulo o vacío.
  static const String directiveIdEmpty = 'ERR_DIRECTIVE_ID_EMPTY';

  /// Campo `rationale` ausente, nulo o vacío.
  static const String rationaleEmpty = 'ERR_DIRECTIVE_RATIONALE_EMPTY';

  /// Campo `evidence_refs` inválido o contiene elementos vacíos.
  static const String invalidEvidenceRefs =
      'ERR_DIRECTIVE_INVALID_EVIDENCE_REFS';

  /// Campo `suggested_tasks` inválido o contiene elementos vacíos.
  static const String invalidSuggestedTasks =
      'ERR_DIRECTIVE_INVALID_SUGGESTED_TASKS';

  /// Prioridad de directiva táctica no reconocida.
  static const String invalidPriority = 'ERR_DIRECTIVE_INVALID_PRIORITY';

  /// Estado de directiva táctica no reconocido.
  static const String invalidStatus = 'ERR_DIRECTIVE_INVALID_STATUS';

  /// Versión semántica del esquema inválida.
  static const String invalidSchemaVersion =
      'ERR_DIRECTIVE_INVALID_SCHEMA_VERSION';

  /// Campo obligatorio ausente en el payload JSON.
  static const String missingRequiredField = 'ERR_DIRECTIVE_MISSING_FIELD';
}

/// Excepción de validación de directivas tácticas de Praxis.
///
/// Hereda directamente de [FormatException] para certificar el contrato Sad Path
/// emitiendo un código de error auditable y descripción técnica inequívoca.
class TacticalDirectiveException extends FormatException {
  /// Código canónico auditable del error (ej. ERR_DIRECTIVE_TARGET_NODE_EMPTY).
  final String errorCode;

  /// Nombre del campo causal de la violación (si aplica).
  final String? field;

  /// Valor que detonó el rechazo (si aplica).
  final dynamic rejectedValue;

  const TacticalDirectiveException(
    String message, {
    required this.errorCode,
    this.field,
    this.rejectedValue,
    dynamic source,
    int? offset,
  }) : super(message, source, offset);

  @override
  String toString() {
    final StringBuffer sb = StringBuffer(
      '[$errorCode] FormatException: $message',
    );
    if (field != null) {
      sb.write(' (field: "$field")');
    }
    if (rejectedValue != null) {
      sb.write(' (rejected: "$rejectedValue")');
    }
    return sb.toString();
  }
}

/// Estados canónicos del ciclo de vida de una directiva táctica.
enum TacticalDirectiveStatus {
  emitted('EMITTED'),
  accepted('ACCEPTED'),
  rejected('REJECTED'),
  deferred('DEFERRED');

  final String value;
  const TacticalDirectiveStatus(this.value);

  /// Parsea un estado a partir de su cadena textual (insensible a mayúsculas/minúsculas).
  static TacticalDirectiveStatus fromString(String raw) {
    final String normalized = raw.trim().toUpperCase();
    for (final TacticalDirectiveStatus status
        in TacticalDirectiveStatus.values) {
      if (status.value == normalized ||
          status.name.toUpperCase() == normalized) {
        return status;
      }
    }
    throw TacticalDirectiveException(
      'Estado de directiva táctica no reconocido: "$raw". Valores válidos: '
      '${TacticalDirectiveStatus.values.map((TacticalDirectiveStatus e) => e.value).join(", ")}',
      errorCode: TacticalDirectiveErrorCodes.invalidStatus,
      field: 'status',
      rejectedValue: raw,
    );
  }
}

/// Prioridades canónicas de una directiva táctica de Praxis.
enum TacticalDirectivePriority {
  critical('CRITICAL'),
  high('HIGH'),
  normal('NORMAL'),
  medium('MEDIUM'),
  low('LOW'),
  p0('P0'),
  p1('P1'),
  p2('P2'),
  p3('P3');

  final String value;
  const TacticalDirectivePriority(this.value);

  /// Parsea una prioridad a partir de su cadena textual (insensible a mayúsculas/minúsculas).
  static TacticalDirectivePriority fromString(String raw) {
    final String normalized = raw.trim().toUpperCase();
    for (final TacticalDirectivePriority p
        in TacticalDirectivePriority.values) {
      if (p.value == normalized || p.name.toUpperCase() == normalized) {
        return p;
      }
    }
    throw TacticalDirectiveException(
      'Prioridad de directiva táctica no reconocida: "$raw". Valores válidos: '
      '${TacticalDirectivePriority.values.map((TacticalDirectivePriority e) => e.value).join(", ")}',
      errorCode: TacticalDirectiveErrorCodes.invalidPriority,
      field: 'priority',
      rejectedValue: raw,
    );
  }
}

/// Contrato Canónico de Directiva Táctica emitida por Praxis (§4, §6, §39, §43).
class TacticalDirective {
  /// Nodo origen canónico e inmutable (estrictamente fijo en "praxis").
  static const String canonicalSourceNode = 'praxis';

  /// Versión de esquema por defecto (1.0.0).
  static const String defaultSchemaVersion = '1.0.0';

  static final RegExp _semverPattern = RegExp(r'^\d+\.\d+\.\d+$');

  /// Identificador único de la directiva (ej. DIR-PRAXIS-RUEDAS-001).
  final String directiveId;

  /// Nodo origen emisor (estrictamente "praxis").
  final String sourceNode;

  /// Nodo satélite destinatario (ej. "ruedas", "smart", "automa").
  final String targetNode;

  /// Justificación y rationale de la directiva táctica.
  final String rationale;

  /// Referencias a evidencias empíricas (logs, métricas, reportes, RFCs).
  final List<String> evidenceRefs;

  /// Tareas sugeridas para resolver la directiva en el nodo destino.
  final List<String> suggestedTasks;

  /// Nivel de prioridad táctica.
  final TacticalDirectivePriority priority;

  /// Marca de tiempo UTC en que expira la validez de la directiva.
  final DateTime expiresAt;

  /// Estado canónico actual de la directiva táctica.
  final TacticalDirectiveStatus status;

  /// Versión semántica del contrato.
  final String schemaVersion;

  /// Crea e inicializa una directiva táctica validando todas sus invariantes de dominio.
  TacticalDirective({
    required this.directiveId,
    this.sourceNode = canonicalSourceNode,
    required this.targetNode,
    required this.rationale,
    required List<String> evidenceRefs,
    required List<String> suggestedTasks,
    required this.priority,
    required DateTime expiresAt,
    this.status = TacticalDirectiveStatus.emitted,
    this.schemaVersion = defaultSchemaVersion,
    DateTime? referenceTime,
    bool enforceExpiration = true,
  }) : evidenceRefs = List<String>.unmodifiable(evidenceRefs),
       suggestedTasks = List<String>.unmodifiable(suggestedTasks),
       expiresAt = expiresAt.toUtc() {
    _validateState(
      directiveId: directiveId,
      sourceNode: sourceNode,
      targetNode: targetNode,
      rationale: rationale,
      evidenceRefs: this.evidenceRefs,
      suggestedTasks: this.suggestedTasks,
      expiresAt: this.expiresAt,
      schemaVersion: schemaVersion,
      referenceTime: referenceTime,
      enforceExpiration: enforceExpiration,
    );
  }

  /// Deserializa una directiva táctica desde un mapa JSON validando invariantes.
  factory TacticalDirective.fromJson(
    Map<String, dynamic> json, {
    DateTime? referenceTime,
    bool enforceExpiration = true,
  }) {
    validate(
      json,
      referenceTime: referenceTime,
      enforceExpiration: enforceExpiration,
    );

    return TacticalDirective(
      directiveId: (json['directive_id'] as String).trim(),
      sourceNode: (json['source_node'] as String).trim(),
      targetNode: (json['target_node'] as String).trim(),
      rationale: (json['rationale'] as String).trim(),
      evidenceRefs: (json['evidence_refs'] as List<dynamic>)
          .map((dynamic e) => e.toString().trim())
          .toList(),
      suggestedTasks: (json['suggested_tasks'] as List<dynamic>)
          .map((dynamic e) => e.toString().trim())
          .toList(),
      priority: TacticalDirectivePriority.fromString(
        json['priority'] as String,
      ),
      expiresAt: DateTime.parse((json['expires_at'] as String).trim()),
      status: TacticalDirectiveStatus.fromString(json['status'] as String),
      schemaVersion: (json['schema_version'] as String).trim(),
      referenceTime: referenceTime,
      enforceExpiration: enforceExpiration,
    );
  }

  /// Deserializa una directiva táctica desde una cadena JSON.
  factory TacticalDirective.fromJsonString(
    String jsonString, {
    DateTime? referenceTime,
    bool enforceExpiration = true,
  }) {
    final dynamic decoded = jsonDecode(jsonString);
    if (decoded is! Map<String, dynamic>) {
      throw const TacticalDirectiveException(
        'El payload de la directiva debe ser un objeto JSON válido.',
        errorCode: TacticalDirectiveErrorCodes.missingRequiredField,
      );
    }
    return TacticalDirective.fromJson(
      decoded,
      referenceTime: referenceTime,
      enforceExpiration: enforceExpiration,
    );
  }

  /// Validador formal estricto conforme a `tactical_directive.schema.json`.
  ///
  /// Arroja [TacticalDirectiveException] (subclase de [FormatException]) con
  /// código de error auditable ante cualquier discrepancia.
  static void validate(
    Map<String, dynamic> json, {
    DateTime? referenceTime,
    bool enforceExpiration = true,
  }) {
    // 1. target_node (Sad path mandatorio: campo vacío o ausente)
    if (!json.containsKey('target_node')) {
      throw const TacticalDirectiveException(
        'El campo "target_node" es obligatorio.',
        errorCode: TacticalDirectiveErrorCodes.targetNodeEmpty,
        field: 'target_node',
      );
    }
    final dynamic rawTargetNode = json['target_node'];
    if (rawTargetNode == null ||
        rawTargetNode is! String ||
        rawTargetNode.trim().isEmpty) {
      throw TacticalDirectiveException(
        'El campo "target_node" no puede estar vacío.',
        errorCode: TacticalDirectiveErrorCodes.targetNodeEmpty,
        field: 'target_node',
        rejectedValue: rawTargetNode,
      );
    }

    // 2. directive_id
    if (!json.containsKey('directive_id')) {
      throw const TacticalDirectiveException(
        'El campo "directive_id" es obligatorio.',
        errorCode: TacticalDirectiveErrorCodes.directiveIdEmpty,
        field: 'directive_id',
      );
    }
    final dynamic rawDirectiveId = json['directive_id'];
    if (rawDirectiveId == null ||
        rawDirectiveId is! String ||
        rawDirectiveId.trim().isEmpty) {
      throw TacticalDirectiveException(
        'El campo "directive_id" no puede estar vacío.',
        errorCode: TacticalDirectiveErrorCodes.directiveIdEmpty,
        field: 'directive_id',
        rejectedValue: rawDirectiveId,
      );
    }

    // 3. source_node (estrictamente "praxis")
    if (!json.containsKey('source_node')) {
      throw const TacticalDirectiveException(
        'El campo "source_node" es obligatorio.',
        errorCode: TacticalDirectiveErrorCodes.invalidSourceNode,
        field: 'source_node',
      );
    }
    final dynamic rawSourceNode = json['source_node'];
    if (rawSourceNode is! String ||
        rawSourceNode.trim() != canonicalSourceNode) {
      throw TacticalDirectiveException(
        'El campo "source_node" debe ser estrictamente "$canonicalSourceNode" (recibido: "$rawSourceNode").',
        errorCode: TacticalDirectiveErrorCodes.invalidSourceNode,
        field: 'source_node',
        rejectedValue: rawSourceNode,
      );
    }

    // 4. rationale
    if (!json.containsKey('rationale')) {
      throw const TacticalDirectiveException(
        'El campo "rationale" es obligatorio.',
        errorCode: TacticalDirectiveErrorCodes.rationaleEmpty,
        field: 'rationale',
      );
    }
    final dynamic rawRationale = json['rationale'];
    if (rawRationale == null ||
        rawRationale is! String ||
        rawRationale.trim().isEmpty) {
      throw TacticalDirectiveException(
        'El campo "rationale" no puede estar vacío.',
        errorCode: TacticalDirectiveErrorCodes.rationaleEmpty,
        field: 'rationale',
        rejectedValue: rawRationale,
      );
    }

    // 5. evidence_refs
    if (!json.containsKey('evidence_refs')) {
      throw const TacticalDirectiveException(
        'El campo "evidence_refs" es obligatorio.',
        errorCode: TacticalDirectiveErrorCodes.invalidEvidenceRefs,
        field: 'evidence_refs',
      );
    }
    final dynamic rawEvidenceRefs = json['evidence_refs'];
    if (rawEvidenceRefs is! List) {
      throw TacticalDirectiveException(
        'El campo "evidence_refs" debe ser una lista.',
        errorCode: TacticalDirectiveErrorCodes.invalidEvidenceRefs,
        field: 'evidence_refs',
        rejectedValue: rawEvidenceRefs,
      );
    }
    for (int i = 0; i < rawEvidenceRefs.length; i++) {
      final dynamic item = rawEvidenceRefs[i];
      if (item is! String || item.trim().isEmpty) {
        throw TacticalDirectiveException(
          'Cada referencia en "evidence_refs" debe ser una cadena no vacía (índice $i).',
          errorCode: TacticalDirectiveErrorCodes.invalidEvidenceRefs,
          field: 'evidence_refs[$i]',
          rejectedValue: item,
        );
      }
    }

    // 6. suggested_tasks
    if (!json.containsKey('suggested_tasks')) {
      throw const TacticalDirectiveException(
        'El campo "suggested_tasks" es obligatorio.',
        errorCode: TacticalDirectiveErrorCodes.invalidSuggestedTasks,
        field: 'suggested_tasks',
      );
    }
    final dynamic rawSuggestedTasks = json['suggested_tasks'];
    if (rawSuggestedTasks is! List) {
      throw TacticalDirectiveException(
        'El campo "suggested_tasks" debe ser una lista.',
        errorCode: TacticalDirectiveErrorCodes.invalidSuggestedTasks,
        field: 'suggested_tasks',
        rejectedValue: rawSuggestedTasks,
      );
    }
    for (int i = 0; i < rawSuggestedTasks.length; i++) {
      final dynamic item = rawSuggestedTasks[i];
      if (item is! String || item.trim().isEmpty) {
        throw TacticalDirectiveException(
          'Cada tarea en "suggested_tasks" debe ser una cadena no vacía (índice $i).',
          errorCode: TacticalDirectiveErrorCodes.invalidSuggestedTasks,
          field: 'suggested_tasks[$i]',
          rejectedValue: item,
        );
      }
    }

    // 7. priority
    if (!json.containsKey('priority')) {
      throw const TacticalDirectiveException(
        'El campo "priority" es obligatorio.',
        errorCode: TacticalDirectiveErrorCodes.invalidPriority,
        field: 'priority',
      );
    }
    final dynamic rawPriority = json['priority'];
    if (rawPriority is! String) {
      throw TacticalDirectiveException(
        'El campo "priority" debe ser una cadena.',
        errorCode: TacticalDirectiveErrorCodes.invalidPriority,
        field: 'priority',
        rejectedValue: rawPriority,
      );
    }
    TacticalDirectivePriority.fromString(rawPriority);

    // 8. expires_at (Sad path mandatorio: fecha expirada o malformada)
    if (!json.containsKey('expires_at')) {
      throw const TacticalDirectiveException(
        'El campo "expires_at" es obligatorio.',
        errorCode: TacticalDirectiveErrorCodes.invalidExpiresAt,
        field: 'expires_at',
      );
    }
    final dynamic rawExpiresAt = json['expires_at'];
    if (rawExpiresAt is! String || rawExpiresAt.trim().isEmpty) {
      throw TacticalDirectiveException(
        'El campo "expires_at" debe ser una cadena ISO-8601 válida.',
        errorCode: TacticalDirectiveErrorCodes.invalidExpiresAt,
        field: 'expires_at',
        rejectedValue: rawExpiresAt,
      );
    }
    final DateTime parsedExpiresAt;
    try {
      parsedExpiresAt = DateTime.parse(rawExpiresAt.trim()).toUtc();
    } on FormatException catch (e) {
      throw TacticalDirectiveException(
        'Formato de fecha inválido para "expires_at": "$rawExpiresAt". Debe ser ISO-8601.',
        errorCode: TacticalDirectiveErrorCodes.invalidExpiresAt,
        field: 'expires_at',
        rejectedValue: rawExpiresAt,
        source: e.source,
        offset: e.offset,
      );
    }

    final DateTime refTime = (referenceTime ?? DateTime.now()).toUtc();
    if (enforceExpiration && parsedExpiresAt.isBefore(refTime)) {
      throw TacticalDirectiveException(
        'La directiva táctica ha expirado: fecha de expiración $parsedExpiresAt es anterior al tiempo de referencia $refTime.',
        errorCode: TacticalDirectiveErrorCodes.expired,
        field: 'expires_at',
        rejectedValue: rawExpiresAt,
      );
    }

    // 9. status
    if (!json.containsKey('status')) {
      throw const TacticalDirectiveException(
        'El campo "status" es obligatorio.',
        errorCode: TacticalDirectiveErrorCodes.invalidStatus,
        field: 'status',
      );
    }
    final dynamic rawStatus = json['status'];
    if (rawStatus is! String) {
      throw TacticalDirectiveException(
        'El campo "status" debe ser una cadena.',
        errorCode: TacticalDirectiveErrorCodes.invalidStatus,
        field: 'status',
        rejectedValue: rawStatus,
      );
    }
    TacticalDirectiveStatus.fromString(rawStatus);

    // 10. schema_version
    if (!json.containsKey('schema_version')) {
      throw const TacticalDirectiveException(
        'El campo "schema_version" es obligatorio.',
        errorCode: TacticalDirectiveErrorCodes.invalidSchemaVersion,
        field: 'schema_version',
      );
    }
    final dynamic rawSchemaVersion = json['schema_version'];
    if (rawSchemaVersion is! String ||
        !_semverPattern.hasMatch(rawSchemaVersion.trim())) {
      throw TacticalDirectiveException(
        'El campo "schema_version" debe cumplir con formato semver "^\\d+\\.\\d+\\.\\d+\$" (recibido: "$rawSchemaVersion").',
        errorCode: TacticalDirectiveErrorCodes.invalidSchemaVersion,
        field: 'schema_version',
        rejectedValue: rawSchemaVersion,
      );
    }
  }

  static void _validateState({
    required String directiveId,
    required String sourceNode,
    required String targetNode,
    required String rationale,
    required List<String> evidenceRefs,
    required List<String> suggestedTasks,
    required DateTime expiresAt,
    required String schemaVersion,
    DateTime? referenceTime,
    bool enforceExpiration = true,
  }) {
    if (targetNode.trim().isEmpty) {
      throw const TacticalDirectiveException(
        'El campo "target_node" no puede estar vacío.',
        errorCode: TacticalDirectiveErrorCodes.targetNodeEmpty,
        field: 'target_node',
      );
    }

    if (directiveId.trim().isEmpty) {
      throw const TacticalDirectiveException(
        'El campo "directive_id" no puede estar vacío.',
        errorCode: TacticalDirectiveErrorCodes.directiveIdEmpty,
        field: 'directive_id',
      );
    }

    if (sourceNode.trim() != canonicalSourceNode) {
      throw TacticalDirectiveException(
        'El campo "source_node" debe ser estrictamente "$canonicalSourceNode" (recibido: "$sourceNode").',
        errorCode: TacticalDirectiveErrorCodes.invalidSourceNode,
        field: 'source_node',
        rejectedValue: sourceNode,
      );
    }

    if (rationale.trim().isEmpty) {
      throw const TacticalDirectiveException(
        'El campo "rationale" no puede estar vacío.',
        errorCode: TacticalDirectiveErrorCodes.rationaleEmpty,
        field: 'rationale',
      );
    }

    for (int i = 0; i < evidenceRefs.length; i++) {
      if (evidenceRefs[i].trim().isEmpty) {
        throw TacticalDirectiveException(
          'Cada referencia en "evidence_refs" debe ser una cadena no vacía (índice $i).',
          errorCode: TacticalDirectiveErrorCodes.invalidEvidenceRefs,
          field: 'evidence_refs[$i]',
        );
      }
    }

    for (int i = 0; i < suggestedTasks.length; i++) {
      if (suggestedTasks[i].trim().isEmpty) {
        throw TacticalDirectiveException(
          'Cada tarea en "suggested_tasks" debe ser una cadena no vacía (índice $i).',
          errorCode: TacticalDirectiveErrorCodes.invalidSuggestedTasks,
          field: 'suggested_tasks[$i]',
        );
      }
    }

    final DateTime refTime = (referenceTime ?? DateTime.now()).toUtc();
    if (enforceExpiration && expiresAt.isBefore(refTime)) {
      throw TacticalDirectiveException(
        'La directiva táctica ha expirado: fecha de expiración $expiresAt es anterior al tiempo de referencia $refTime.',
        errorCode: TacticalDirectiveErrorCodes.expired,
        field: 'expires_at',
        rejectedValue: expiresAt.toIso8601String(),
      );
    }

    if (!_semverPattern.hasMatch(schemaVersion.trim())) {
      throw TacticalDirectiveException(
        'El campo "schema_version" debe cumplir con formato semver (recibido: "$schemaVersion").',
        errorCode: TacticalDirectiveErrorCodes.invalidSchemaVersion,
        field: 'schema_version',
        rejectedValue: schemaVersion,
      );
    }
  }

  /// Verifica si la directiva se encuentra vencida respecto a un instante dado o actual.
  bool isExpired([DateTime? referenceTime]) {
    final DateTime ref = (referenceTime ?? DateTime.now()).toUtc();
    return expiresAt.isBefore(ref);
  }

  /// Serializa la directiva táctica a un mapa JSON canónico.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'directive_id': directiveId,
    'source_node': sourceNode,
    'target_node': targetNode,
    'rationale': rationale,
    'evidence_refs': List<String>.from(evidenceRefs),
    'suggested_tasks': List<String>.from(suggestedTasks),
    'priority': priority.value,
    'expires_at': expiresAt.toIso8601String(),
    'status': status.value,
    'schema_version': schemaVersion,
  };

  /// Serializa a cadena JSON.
  String toJsonString({bool pretty = false}) {
    if (pretty) {
      return const JsonEncoder.withIndent('  ').convert(toJson());
    }
    return jsonEncode(toJson());
  }

  /// Crea una copia de la directiva mutando únicamente los campos especificados.
  TacticalDirective copyWith({
    String? directiveId,
    String? sourceNode,
    String? targetNode,
    String? rationale,
    List<String>? evidenceRefs,
    List<String>? suggestedTasks,
    TacticalDirectivePriority? priority,
    DateTime? expiresAt,
    TacticalDirectiveStatus? status,
    String? schemaVersion,
    DateTime? referenceTime,
    bool enforceExpiration = true,
  }) {
    return TacticalDirective(
      directiveId: directiveId ?? this.directiveId,
      sourceNode: sourceNode ?? this.sourceNode,
      targetNode: targetNode ?? this.targetNode,
      rationale: rationale ?? this.rationale,
      evidenceRefs: evidenceRefs ?? this.evidenceRefs,
      suggestedTasks: suggestedTasks ?? this.suggestedTasks,
      priority: priority ?? this.priority,
      expiresAt: expiresAt ?? this.expiresAt,
      status: status ?? this.status,
      schemaVersion: schemaVersion ?? this.schemaVersion,
      referenceTime: referenceTime,
      enforceExpiration: enforceExpiration,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TacticalDirective &&
          runtimeType == other.runtimeType &&
          directiveId == other.directiveId &&
          sourceNode == other.sourceNode &&
          targetNode == other.targetNode &&
          rationale == other.rationale &&
          priority == other.priority &&
          expiresAt == other.expiresAt &&
          status == other.status &&
          schemaVersion == other.schemaVersion;

  @override
  int get hashCode => Object.hash(
    directiveId,
    sourceNode,
    targetNode,
    rationale,
    priority,
    expiresAt,
    status,
    schemaVersion,
  );

  @override
  String toString() =>
      'TacticalDirective(id: $directiveId, from: $sourceNode, to: $targetNode, priority: ${priority.value}, status: ${status.value}, expires: ${expiresAt.toIso8601String()})';
}
