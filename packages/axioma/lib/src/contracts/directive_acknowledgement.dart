/// directive_acknowledgement.dart — Contrato Canónico de Acuse Soberano de Directivas Tácticas (§4, §6, §39, §43, §54).
///
/// Define el protocolo formal de acuse (acknowledgement) emitido por los satélites
/// al procesar directivas en su outbox:
///   `vault/directives/<target_node>/<directive_id>.ack.json`
///
/// Estados y decisiones soberanas:
/// - `ACCEPTED`: El satélite acepta la directiva y sintetiza la tarea en su backlog local.
/// - `REJECTED`: El satélite rechaza la directiva con justificación técnica.
/// - `DEFERRED`: El satélite difiere la evaluación de la directiva.
/// - `EXPIRED_DIRECTIVE`: Rechazo automático por vencimiento temporal (now > expires_at).
library;

import 'dart:convert';
import 'package:crypto/crypto.dart';

/// Códigos auditables de error para el protocolo de acuse de directivas (§4, §6).
abstract final class DirectiveAcknowledgementErrorCodes {
  /// Campo `directive_id` ausente, nulo o vacío.
  static const String directiveIdEmpty = 'ERR_ACK_DIRECTIVE_ID_EMPTY';

  /// Campo `target_node` ausente, nulo o vacío.
  static const String targetNodeEmpty = 'ERR_ACK_TARGET_NODE_EMPTY';

  /// Estado o decisión de acuse no reconocido.
  static const String invalidStatus = 'ERR_ACK_INVALID_STATUS';

  /// Fecha `acknowledged_at` con formato inválido o no ISO-8601.
  static const String invalidTimestamp = 'ERR_ACK_INVALID_TIMESTAMP';

  /// Campo obligatorio ausente en el payload JSON.
  static const String missingRequiredField = 'ERR_ACK_MISSING_FIELD';

  /// Versión semántica del esquema inválida.
  static const String invalidSchemaVersion = 'ERR_ACK_INVALID_SCHEMA_VERSION';

  /// Firma digital/criptográfica inválida o corrupta.
  static const String invalidSignature = 'ERR_ACK_INVALID_SIGNATURE';

  /// Directiva rechazada automáticamente por expiración (§6, TASK-N89-04).
  static const String expiredDirective = 'EXPIRED_DIRECTIVE';
}

/// Excepción de dominio para violaciones en contratos de acuse soberano.
///
/// Hereda directamente de [FormatException] para certificar contratos Sad Path.
class DirectiveAcknowledgementException extends FormatException {
  /// Código canónico auditable del error (ej. ERR_ACK_DIRECTIVE_ID_EMPTY).
  final String errorCode;

  /// Nombre del campo causal de la violación (si aplica).
  final String? field;

  /// Valor que detonó el rechazo (si aplica).
  final dynamic rejectedValue;

  const DirectiveAcknowledgementException(
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

/// Estados y decisiones canónicas del protocolo de acuse soberano (§54).
enum DirectiveAckStatus {
  accepted('ACCEPTED'),
  rejected('REJECTED'),
  deferred('DEFERRED'),
  expiredDirective('EXPIRED_DIRECTIVE');

  final String value;
  const DirectiveAckStatus(this.value);

  /// Retorna el valor representativo para la decisión soberana ('ACCEPTED', 'REJECTED', 'DEFERRED').
  String get decisionValue {
    switch (this) {
      case DirectiveAckStatus.accepted:
        return 'ACCEPTED';
      case DirectiveAckStatus.rejected:
      case DirectiveAckStatus.expiredDirective:
        return 'REJECTED';
      case DirectiveAckStatus.deferred:
        return 'DEFERRED';
    }
  }

  /// Parsea un estado o decisión a partir de una cadena textual (insensible a mayúsculas/minúsculas).
  static DirectiveAckStatus fromString(String raw) {
    final String normalized = raw.trim().toUpperCase().replaceAll('-', '_');
    for (final DirectiveAckStatus status in DirectiveAckStatus.values) {
      if (status.value == normalized ||
          status.name.toUpperCase() == normalized ||
          (status == DirectiveAckStatus.expiredDirective &&
              (normalized == 'EXPIRED' ||
                  normalized == 'EXPIRED_DIRECTIVE' ||
                  normalized == 'EXPIREDDIRECTIVE'))) {
        return status;
      }
    }
    throw DirectiveAcknowledgementException(
      'Estado o decisión de acuse no reconocido: "$raw". Valores válidos: '
      '${DirectiveAckStatus.values.map((DirectiveAckStatus e) => e.value).join(", ")}',
      errorCode: DirectiveAcknowledgementErrorCodes.invalidStatus,
      field: 'status',
      rejectedValue: raw,
    );
  }
}

/// Contrato Canónico de Acuse Soberano de Directiva Táctica (§4, §6, §39, §43, §54).
class DirectiveAcknowledgement {
  /// Versión de esquema por defecto (1.0.0).
  static const String defaultSchemaVersion = '1.0.0';

  static final RegExp _semverPattern = RegExp(r'^\d+\.\d+\.\d+$');

  /// Identificador único de la directiva objeto del acuse (ej. DIR-PRAXIS-RUEDAS-001).
  final String directiveId;

  /// Nodo satélite que emite el acuse de forma soberana (ej. "ruedas", "smart").
  final String targetNode;

  /// Nodo origen emisor de la directiva (por defecto "praxis").
  final String sourceNode;

  /// Estado/decisión soberana resultante (ACCEPTED, REJECTED, DEFERRED, EXPIRED_DIRECTIVE).
  final DirectiveAckStatus status;

  /// Justificación, motivo o explicación técnica de la decisión.
  final String? reason;

  /// Identificador de la tarea sintetizada en el backlog local (si fue aceptada).
  final String? synthesizedTaskId;

  /// Marca de tiempo UTC en que se emite el acuse.
  final DateTime acknowledgedAt;

  /// Firma digital/criptográfica SHA-256 que certifica la soberanía del acuse.
  final String signature;

  /// Versión semántica del contrato de acuse.
  final String schemaVersion;

  /// Metadatos operacionales contextuales adicionales.
  final Map<String, dynamic>? metadata;

  DirectiveAcknowledgement({
    required this.directiveId,
    required this.targetNode,
    this.sourceNode = 'praxis',
    required this.status,
    this.reason,
    this.synthesizedTaskId,
    DateTime? acknowledgedAt,
    String? signature,
    this.schemaVersion = defaultSchemaVersion,
    this.metadata,
  }) : acknowledgedAt = (acknowledgedAt ?? DateTime.now()).toUtc(),
       signature =
           signature ??
           computeSignature(
             directiveId: directiveId,
             targetNode: targetNode,
             status: status.value,
             acknowledgedAt: (acknowledgedAt ?? DateTime.now()).toUtc(),
           ) {
    _validateState(
      directiveId: directiveId,
      targetNode: targetNode,
      sourceNode: sourceNode,
      status: status,
      acknowledgedAt: this.acknowledgedAt,
      signature: this.signature,
      schemaVersion: schemaVersion,
    );
  }

  /// Calcula la firma criptográfica canónica SHA-256 del acuse.
  static String computeSignature({
    required String directiveId,
    required String targetNode,
    required String status,
    required DateTime acknowledgedAt,
    String? salt,
  }) {
    final String cleanDirective = directiveId.trim();
    final String cleanTarget = targetNode.trim().toLowerCase();
    final String cleanStatus = status.trim().toUpperCase();
    final String cleanTs = acknowledgedAt.toUtc().toIso8601String();
    final String raw =
        'conext:ack:$cleanDirective:$cleanTarget:$cleanStatus:$cleanTs${salt != null ? ":$salt" : ""}';
    return sha256.convert(utf8.encode(raw)).toString();
  }

  /// Verifica si la firma del acuse concuerda con los campos canónicos.
  bool verifySignature({String? salt}) {
    final String expected = computeSignature(
      directiveId: directiveId,
      targetNode: targetNode,
      status: status.value,
      acknowledgedAt: acknowledgedAt,
      salt: salt,
    );
    return signature == expected;
  }

  /// Deserializa un acuse desde un mapa JSON validando invariantes.
  factory DirectiveAcknowledgement.fromJson(Map<String, dynamic> json) {
    validate(json);

    final String rawDirectiveId = (json['directive_id'] as String).trim();
    final String rawTargetNode = (json['target_node'] as String).trim();
    final String rawSourceNode =
        json.containsKey('source_node') && json['source_node'] != null
        ? (json['source_node'] as String).trim()
        : 'praxis';

    final DirectiveAckStatus parsedStatus = DirectiveAckStatus.fromString(
      json['status'] as String,
    );

    final String? reason = json['reason'] as String?;
    final String? synthesizedTaskId = json['synthesized_task_id'] as String?;
    final DateTime ackAt = DateTime.parse(
      (json['acknowledged_at'] as String).trim(),
    );
    final String sig = (json['signature'] as String).trim();
    final String ver =
        json.containsKey('schema_version') && json['schema_version'] != null
        ? (json['schema_version'] as String).trim()
        : defaultSchemaVersion;

    final Map<String, dynamic>? meta =
        json['metadata'] as Map<String, dynamic>?;

    return DirectiveAcknowledgement(
      directiveId: rawDirectiveId,
      targetNode: rawTargetNode,
      sourceNode: rawSourceNode,
      status: parsedStatus,
      reason: reason?.trim(),
      synthesizedTaskId: synthesizedTaskId?.trim(),
      acknowledgedAt: ackAt,
      signature: sig,
      schemaVersion: ver,
      metadata: meta != null ? Map<String, dynamic>.unmodifiable(meta) : null,
    );
  }

  /// Deserializa un acuse desde una cadena JSON.
  factory DirectiveAcknowledgement.fromJsonString(String jsonString) {
    final dynamic decoded = jsonDecode(jsonString);
    if (decoded is! Map<String, dynamic>) {
      throw const DirectiveAcknowledgementException(
        'El payload del acuse debe ser un objeto JSON válido.',
        errorCode: DirectiveAcknowledgementErrorCodes.missingRequiredField,
      );
    }
    return DirectiveAcknowledgement.fromJson(decoded);
  }

  /// Validador formal estricto del payload de acuse.
  ///
  /// Arroja [DirectiveAcknowledgementException] (subclase de [FormatException])
  /// con código de error auditable ante cualquier discrepancia.
  static void validate(Map<String, dynamic> json) {
    // 1. directive_id
    if (!json.containsKey('directive_id')) {
      throw const DirectiveAcknowledgementException(
        'El campo "directive_id" es obligatorio en el acuse.',
        errorCode: DirectiveAcknowledgementErrorCodes.directiveIdEmpty,
        field: 'directive_id',
      );
    }
    final dynamic rawDirectiveId = json['directive_id'];
    if (rawDirectiveId == null ||
        rawDirectiveId is! String ||
        rawDirectiveId.trim().isEmpty) {
      throw DirectiveAcknowledgementException(
        'El campo "directive_id" no puede estar vacío.',
        errorCode: DirectiveAcknowledgementErrorCodes.directiveIdEmpty,
        field: 'directive_id',
        rejectedValue: rawDirectiveId,
      );
    }

    // 2. target_node
    if (!json.containsKey('target_node')) {
      throw const DirectiveAcknowledgementException(
        'El campo "target_node" es obligatorio en el acuse.',
        errorCode: DirectiveAcknowledgementErrorCodes.targetNodeEmpty,
        field: 'target_node',
      );
    }
    final dynamic rawTargetNode = json['target_node'];
    if (rawTargetNode == null ||
        rawTargetNode is! String ||
        rawTargetNode.trim().isEmpty) {
      throw DirectiveAcknowledgementException(
        'El campo "target_node" no puede estar vacío.',
        errorCode: DirectiveAcknowledgementErrorCodes.targetNodeEmpty,
        field: 'target_node',
        rejectedValue: rawTargetNode,
      );
    }

    // 3. status
    if (!json.containsKey('status')) {
      throw const DirectiveAcknowledgementException(
        'El campo "status" es obligatorio en el acuse.',
        errorCode: DirectiveAcknowledgementErrorCodes.invalidStatus,
        field: 'status',
      );
    }
    final dynamic rawStatus = json['status'];
    if (rawStatus == null || rawStatus is! String || rawStatus.trim().isEmpty) {
      throw DirectiveAcknowledgementException(
        'El campo "status" no puede estar vacío.',
        errorCode: DirectiveAcknowledgementErrorCodes.invalidStatus,
        field: 'status',
        rejectedValue: rawStatus,
      );
    }
    DirectiveAckStatus.fromString(rawStatus);

    // 4. acknowledged_at
    if (json.containsKey('acknowledged_at') &&
        json['acknowledged_at'] != null) {
      final dynamic rawAckAt = json['acknowledged_at'];
      if (rawAckAt is! String || DateTime.tryParse(rawAckAt) == null) {
        throw DirectiveAcknowledgementException(
          'El campo "acknowledged_at" debe ser una marca temporal ISO-8601 válida.',
          errorCode: DirectiveAcknowledgementErrorCodes.invalidTimestamp,
          field: 'acknowledged_at',
          rejectedValue: rawAckAt,
        );
      }
    }

    // 5. schema_version
    if (json.containsKey('schema_version') && json['schema_version'] != null) {
      final dynamic rawVer = json['schema_version'];
      if (rawVer is! String || !_semverPattern.hasMatch(rawVer.trim())) {
        throw DirectiveAcknowledgementException(
          'La versión del esquema debe cumplir SemVer (X.Y.Z): "$rawVer".',
          errorCode: DirectiveAcknowledgementErrorCodes.invalidSchemaVersion,
          field: 'schema_version',
          rejectedValue: rawVer,
        );
      }
    }

    // 6. signature
    if (json.containsKey('signature')) {
      final dynamic rawSig = json['signature'];
      if (rawSig == null || rawSig is! String || rawSig.trim().isEmpty) {
        throw DirectiveAcknowledgementException(
          'La firma del acuse no puede ser vacía.',
          errorCode: DirectiveAcknowledgementErrorCodes.invalidSignature,
          field: 'signature',
          rejectedValue: rawSig,
        );
      }
    }
  }

  static void _validateState({
    required String directiveId,
    required String targetNode,
    required String sourceNode,
    required DirectiveAckStatus status,
    required DateTime acknowledgedAt,
    required String signature,
    required String schemaVersion,
  }) {
    if (directiveId.trim().isEmpty) {
      throw const DirectiveAcknowledgementException(
        'El campo "directive_id" no puede estar vacío.',
        errorCode: DirectiveAcknowledgementErrorCodes.directiveIdEmpty,
        field: 'directive_id',
      );
    }
    if (targetNode.trim().isEmpty) {
      throw const DirectiveAcknowledgementException(
        'El campo "target_node" no puede estar vacío.',
        errorCode: DirectiveAcknowledgementErrorCodes.targetNodeEmpty,
        field: 'target_node',
      );
    }
    if (!_semverPattern.hasMatch(schemaVersion.trim())) {
      throw DirectiveAcknowledgementException(
        'La versión del esquema debe cumplir SemVer (X.Y.Z): "$schemaVersion".',
        errorCode: DirectiveAcknowledgementErrorCodes.invalidSchemaVersion,
        field: 'schema_version',
        rejectedValue: schemaVersion,
      );
    }
    if (signature.trim().isEmpty) {
      throw const DirectiveAcknowledgementException(
        'La firma del acuse no puede estar vacía.',
        errorCode: DirectiveAcknowledgementErrorCodes.invalidSignature,
        field: 'signature',
      );
    }
  }

  /// Retorna `true` si la directiva fue aceptada por el satélite.
  bool get isAccepted => status == DirectiveAckStatus.accepted;

  /// Retorna `true` si la directiva fue rechazada (técnicamente o por expiración).
  bool get isRejected =>
      status == DirectiveAckStatus.rejected ||
      status == DirectiveAckStatus.expiredDirective;

  /// Retorna `true` si la directiva fue diferida.
  bool get isDeferred => status == DirectiveAckStatus.deferred;

  /// Retorna `true` si la directiva fue rechazada por expiración automática.
  bool get isExpired => status == DirectiveAckStatus.expiredDirective;

  /// Serializa el acuse a un mapa JSON canónico.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'directive_id': directiveId,
    'target_node': targetNode,
    'source_node': sourceNode,
    'status': status.value,
    'decision': status.decisionValue,
    if (reason != null && reason!.isNotEmpty) 'reason': reason,
    if (synthesizedTaskId != null && synthesizedTaskId!.isNotEmpty)
      'synthesized_task_id': synthesizedTaskId,
    'acknowledged_at': acknowledgedAt.toUtc().toIso8601String(),
    'signature': signature,
    'schema_version': schemaVersion,
    if (metadata != null && metadata!.isNotEmpty) 'metadata': metadata,
  };

  /// Serializa el acuse a una cadena JSON con formato legible o compacto.
  String toJsonString({bool pretty = true}) {
    if (pretty) {
      return const JsonEncoder.withIndent('  ').convert(toJson());
    }
    return jsonEncode(toJson());
  }

  /// Crea una copia del acuse con campos mutados.
  DirectiveAcknowledgement copyWith({
    String? directiveId,
    String? targetNode,
    String? sourceNode,
    DirectiveAckStatus? status,
    String? reason,
    String? synthesizedTaskId,
    DateTime? acknowledgedAt,
    String? signature,
    String? schemaVersion,
    Map<String, dynamic>? metadata,
  }) {
    return DirectiveAcknowledgement(
      directiveId: directiveId ?? this.directiveId,
      targetNode: targetNode ?? this.targetNode,
      sourceNode: sourceNode ?? this.sourceNode,
      status: status ?? this.status,
      reason: reason ?? this.reason,
      synthesizedTaskId: synthesizedTaskId ?? this.synthesizedTaskId,
      acknowledgedAt: acknowledgedAt ?? this.acknowledgedAt,
      signature: signature ?? this.signature,
      schemaVersion: schemaVersion ?? this.schemaVersion,
      metadata: metadata ?? this.metadata,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DirectiveAcknowledgement &&
          runtimeType == other.runtimeType &&
          directiveId == other.directiveId &&
          targetNode == other.targetNode &&
          status == other.status &&
          signature == other.signature &&
          schemaVersion == other.schemaVersion;

  @override
  int get hashCode =>
      Object.hash(directiveId, targetNode, status, signature, schemaVersion);

  @override
  String toString() =>
      'DirectiveAcknowledgement(id: "$directiveId", target: "$targetNode", status: ${status.value}, signature: "${signature.substring(0, 8)}...")';
}
