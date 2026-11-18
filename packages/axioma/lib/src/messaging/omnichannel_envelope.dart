// 🎯 Canonical Omnichannel Messaging Envelope & Triage DTOs — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios, §40 Thin Client.

/// Versión canónica del esquema de sobres omnicanal.
const String kOmnichannelSchemaVersion = '1.0.0';

/// Canales de mensajería soportados en la flota.
enum ChannelType {
  whatsapp('whatsapp'),
  telegram('telegram'),
  discord('discord'),
  web('web');

  final String value;
  const ChannelType(this.value);

  static ChannelType fromString(String raw) {
    final String clean = raw.trim().toLowerCase();
    for (final ChannelType c in ChannelType.values) {
      if (c.value == clean || c.name.toLowerCase() == clean) return c;
    }
    throw ArgumentError.value(
      raw,
      'raw',
      'Canal de mensajería desconocido: "$raw". Válidos: '
          '${ChannelType.values.map((ChannelType e) => e.value).join(", ")}',
    );
  }
}

/// Mensaje entrante normalizado e independiente del proveedor.
class InboundMessage {
  static const String currentSchemaVersion = kOmnichannelSchemaVersion;
  static const String defaultSchemaVersion = currentSchemaVersion;

  final String schemaVersion;
  final ChannelType channel;
  final String senderId;
  final String? senderName;
  final String text;
  final String? mediaUrl;
  final String providerMessageId;
  final DateTime timestamp;
  final Map<String, dynamic> rawPayload;

  InboundMessage({
    this.schemaVersion = defaultSchemaVersion,
    required this.channel,
    required this.senderId,
    this.senderName,
    required this.text,
    this.mediaUrl,
    required this.providerMessageId,
    required this.timestamp,
    this.rawPayload = const <String, dynamic>{},
  }) {
    if (schemaVersion.trim().isEmpty) {
      throw ArgumentError.value(
        schemaVersion,
        'schemaVersion',
        'La versión del esquema no puede estar vacía.',
      );
    }
    if (senderId.trim().isEmpty) {
      throw ArgumentError.value(
        senderId,
        'senderId',
        'El identificador del remitente no puede estar vacío.',
      );
    }
    if (providerMessageId.trim().isEmpty) {
      throw ArgumentError.value(
        providerMessageId,
        'providerMessageId',
        'El ID de mensaje del proveedor no puede estar vacío.',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'schema_version': schemaVersion,
    'channel': channel.value,
    'sender_id': senderId.trim(),
    if (senderName != null) 'sender_name': senderName,
    'text': text,
    if (mediaUrl != null) 'media_url': mediaUrl,
    'provider_message_id': providerMessageId.trim(),
    'timestamp': timestamp.toIso8601String(),
    'raw_payload': rawPayload,
  };

  factory InboundMessage.fromJson(Map<String, dynamic> json) {
    final String? rawSchema = json['schema_version'] as String?;
    if (json.containsKey('schema_version') &&
        (rawSchema == null || rawSchema.trim().isEmpty)) {
      throw ArgumentError(
        'El campo "schema_version" no puede estar vacío en InboundMessage.',
      );
    }
    final String schemaVersion =
        (rawSchema != null && rawSchema.trim().isNotEmpty)
        ? rawSchema.trim()
        : defaultSchemaVersion;

    final String? channelStr = json['channel'] as String?;
    if (channelStr == null || channelStr.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "channel" faltante en InboundMessage.',
      );
    }
    final String? senderId = json['sender_id'] as String?;
    if (senderId == null || senderId.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "sender_id" faltante en InboundMessage.',
      );
    }
    final String? providerMessageId = json['provider_message_id'] as String?;
    if (providerMessageId == null || providerMessageId.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "provider_message_id" faltante en InboundMessage.',
      );
    }
    final String? tsStr = json['timestamp'] as String?;
    if (tsStr == null || tsStr.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "timestamp" faltante en InboundMessage.',
      );
    }

    return InboundMessage(
      schemaVersion: schemaVersion,
      channel: ChannelType.fromString(channelStr),
      senderId: senderId,
      senderName: json['sender_name'] as String?,
      text: json['text'] as String? ?? '',
      mediaUrl: json['media_url'] as String?,
      providerMessageId: providerMessageId,
      timestamp: DateTime.parse(tsStr),
      rawPayload:
          (json['raw_payload'] as Map<String, dynamic>?) ??
          const <String, dynamic>{},
    );
  }

  /// Genera un [DeduplicatedAck] idempotente para este sobre de mensaje.
  DeduplicatedAck toDeduplicatedAck({
    String status = 'deduplicated',
    Map<String, dynamic>? metadata,
  }) {
    return DeduplicatedAck(
      schemaVersion: schemaVersion,
      channel: channel,
      providerMessageId: providerMessageId,
      timestamp: DateTime.now().toUtc(),
      status: status,
      metadata: <String, dynamic>{
        'sender_id': senderId,
        if (senderName != null) 'sender_name': senderName,
        ...?metadata,
      },
    );
  }
}

/// Mensaje saliente canónico despachable hacia cualquier canal.
class OutboundMessage {
  static const String currentSchemaVersion = kOmnichannelSchemaVersion;
  static const String defaultSchemaVersion = currentSchemaVersion;

  final String schemaVersion;
  final ChannelType channel;
  final String recipientId;
  final String text;
  final String? mediaUrl;
  final String? mediaType;
  final String? replyToId;
  final Map<String, dynamic> metadata;

  OutboundMessage({
    this.schemaVersion = defaultSchemaVersion,
    required this.channel,
    required this.recipientId,
    required this.text,
    this.mediaUrl,
    this.mediaType,
    this.replyToId,
    this.metadata = const <String, dynamic>{},
  }) {
    if (schemaVersion.trim().isEmpty) {
      throw ArgumentError.value(
        schemaVersion,
        'schemaVersion',
        'La versión del esquema no puede estar vacía.',
      );
    }
    if (recipientId.trim().isEmpty) {
      throw ArgumentError.value(
        recipientId,
        'recipientId',
        'El destinatario no puede estar vacío.',
      );
    }
    if (text.trim().isEmpty && (mediaUrl == null || mediaUrl!.trim().isEmpty)) {
      throw ArgumentError(
        'El mensaje saliente debe contener al menos texto o una URL de medio.',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'schema_version': schemaVersion,
    'channel': channel.value,
    'recipient_id': recipientId.trim(),
    'text': text,
    if (mediaUrl != null) 'media_url': mediaUrl,
    if (mediaType != null) 'media_type': mediaType,
    if (replyToId != null) 'reply_to_id': replyToId,
    if (metadata.isNotEmpty) 'metadata': metadata,
  };

  factory OutboundMessage.fromJson(Map<String, dynamic> json) {
    final String? rawSchema = json['schema_version'] as String?;
    if (json.containsKey('schema_version') &&
        (rawSchema == null || rawSchema.trim().isEmpty)) {
      throw ArgumentError(
        'El campo "schema_version" no puede estar vacío en OutboundMessage.',
      );
    }
    final String schemaVersion =
        (rawSchema != null && rawSchema.trim().isNotEmpty)
        ? rawSchema.trim()
        : defaultSchemaVersion;

    final String? channelStr = json['channel'] as String?;
    if (channelStr == null || channelStr.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "channel" faltante en OutboundMessage.',
      );
    }
    final String? recipientId = json['recipient_id'] as String?;
    if (recipientId == null || recipientId.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "recipient_id" faltante en OutboundMessage.',
      );
    }

    return OutboundMessage(
      schemaVersion: schemaVersion,
      channel: ChannelType.fromString(channelStr),
      recipientId: recipientId,
      text: json['text'] as String? ?? '',
      mediaUrl: json['media_url'] as String?,
      mediaType: json['media_type'] as String?,
      replyToId: json['reply_to_id'] as String?,
      metadata:
          (json['metadata'] as Map<String, dynamic>?) ??
          const <String, dynamic>{},
    );
  }
}

/// Confirmación canónica e idempotente de deduplicación de webhooks (§4, §6, §39).
class DeduplicatedAck {
  static const String currentSchemaVersion = kOmnichannelSchemaVersion;
  static const String defaultSchemaVersion = currentSchemaVersion;

  final String schemaVersion;
  final ChannelType channel;
  final String providerMessageId;
  final DateTime timestamp;
  final String status;
  final Map<String, dynamic> metadata;

  DeduplicatedAck({
    this.schemaVersion = defaultSchemaVersion,
    required this.channel,
    required this.providerMessageId,
    required this.timestamp,
    this.status = 'deduplicated',
    this.metadata = const <String, dynamic>{},
  }) {
    if (schemaVersion.trim().isEmpty) {
      throw ArgumentError.value(
        schemaVersion,
        'schemaVersion',
        'La versión del esquema no puede estar vacía.',
      );
    }
    if (providerMessageId.trim().isEmpty) {
      throw ArgumentError.value(
        providerMessageId,
        'providerMessageId',
        'El ID del mensaje de proveedor no puede estar vacío.',
      );
    }
    if (status.trim().isEmpty) {
      throw ArgumentError.value(
        status,
        'status',
        'El estado de deduplicación no puede estar vacío.',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'schema_version': schemaVersion,
    'channel': channel.value,
    'provider_message_id': providerMessageId.trim(),
    'timestamp': timestamp.toIso8601String(),
    'status': status.trim(),
    if (metadata.isNotEmpty) 'metadata': metadata,
  };

  factory DeduplicatedAck.fromJson(Map<String, dynamic> json) {
    final String? rawSchema = json['schema_version'] as String?;
    if (json.containsKey('schema_version') &&
        (rawSchema == null || rawSchema.trim().isEmpty)) {
      throw ArgumentError(
        'El campo "schema_version" no puede estar vacío en DeduplicatedAck.',
      );
    }
    final String schemaVersion =
        (rawSchema != null && rawSchema.trim().isNotEmpty)
        ? rawSchema.trim()
        : defaultSchemaVersion;

    final String? channelStr = json['channel'] as String?;
    if (channelStr == null || channelStr.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "channel" faltante en DeduplicatedAck.',
      );
    }
    final String? providerMessageId = json['provider_message_id'] as String?;
    if (providerMessageId == null || providerMessageId.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "provider_message_id" faltante en DeduplicatedAck.',
      );
    }
    final String? tsStr = json['timestamp'] as String?;
    if (tsStr == null || tsStr.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "timestamp" faltante en DeduplicatedAck.',
      );
    }
    final String? status = json['status'] as String?;
    if (status == null || status.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "status" faltante en DeduplicatedAck.',
      );
    }

    return DeduplicatedAck(
      schemaVersion: schemaVersion,
      channel: ChannelType.fromString(channelStr),
      providerMessageId: providerMessageId,
      timestamp: DateTime.parse(tsStr),
      status: status,
      metadata:
          (json['metadata'] as Map<String, dynamic>?) ??
          const <String, dynamic>{},
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DeduplicatedAck &&
          runtimeType == other.runtimeType &&
          schemaVersion == other.schemaVersion &&
          channel == other.channel &&
          providerMessageId == other.providerMessageId &&
          status == other.status;

  @override
  int get hashCode =>
      Object.hash(schemaVersion, channel, providerMessageId, status);

  @override
  String toString() =>
      'DeduplicatedAck(channel: ${channel.value}, id: $providerMessageId, status: $status, schemaVersion: $schemaVersion)';
}

/// Ruta de resolución conversacional del Triaje Turn-0.
enum TriageRoute {
  fastTrack('fast_track'),
  socratic('socratic');

  final String value;
  const TriageRoute(this.value);

  static TriageRoute fromString(String raw) {
    final String clean = raw.trim().toLowerCase();
    for (final TriageRoute r in TriageRoute.values) {
      if (r.value == clean || r.name.toLowerCase() == clean) return r;
    }
    throw ArgumentError.value(raw, 'raw', 'Ruta de triaje desconocida: "$raw"');
  }
}

/// Intenciones reconocidas por el clasificador Turn-0.
enum TriageIntent {
  order('order'),
  inquiry('inquiry'),
  consultation('consultation'),
  support('support'),
  unknown('unknown');

  final String value;
  const TriageIntent(this.value);

  static TriageIntent fromString(String raw) {
    final String clean = raw.trim().toLowerCase();
    for (final TriageIntent i in TriageIntent.values) {
      if (i.value == clean || i.name.toLowerCase() == clean) return i;
    }
    return TriageIntent.unknown;
  }
}

/// Decisión estructurada emitida por el motor de Triaje Turn-0.
class TriageDecision {
  final TriageIntent intent;
  final TriageRoute route;
  final double confidence;
  final Map<String, dynamic> extractedParams;
  final String reason;

  TriageDecision({
    required this.intent,
    required this.route,
    required this.confidence,
    this.extractedParams = const <String, dynamic>{},
    this.reason = '',
  }) {
    if (confidence.isNaN || confidence < 0.0 || confidence > 1.0) {
      throw ArgumentError.value(
        confidence,
        'confidence',
        'El nivel de confianza debe estar acotado entre 0.0 y 1.0.',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'intent': intent.value,
    'route': route.value,
    'confidence': confidence,
    'extracted_params': extractedParams,
    'reason': reason,
  };

  factory TriageDecision.fromJson(Map<String, dynamic> json) {
    final String? intentStr = json['intent'] as String?;
    final String? routeStr = json['route'] as String?;
    final num? conf = json['confidence'] as num?;

    if (intentStr == null || routeStr == null || conf == null) {
      throw ArgumentError(
        'Campos obligatorios faltantes en TriageDecision JSON.',
      );
    }

    return TriageDecision(
      intent: TriageIntent.fromString(intentStr),
      route: TriageRoute.fromString(routeStr),
      confidence: conf.toDouble(),
      extractedParams:
          (json['extracted_params'] as Map<String, dynamic>?) ??
          const <String, dynamic>{},
      reason: json['reason'] as String? ?? '',
    );
  }
}
