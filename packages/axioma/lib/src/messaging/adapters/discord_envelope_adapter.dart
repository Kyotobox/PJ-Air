// 🎯 Canonical Discord Envelope Adapter — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios,
// §12.b Límite 5 archivos, §39 Pure Dart Core, §40 Thin Client, §48 Cierre Autárquico.
library;

import 'dart:convert';
import 'package:cryptography/cryptography.dart';

import '../discord_models.dart';
import '../omnichannel_envelope.dart';
import '../../security/webhook_signature_validator.dart';

/// Excepción base arrojada ante fallas de adaptación de sobres de Discord.
class DiscordAdapterException implements Exception {
  final String message;
  final Map<String, dynamic>? rawPayload;
  final Object? cause;

  const DiscordAdapterException(this.message, {this.rawPayload, this.cause});

  @override
  String toString() => 'DiscordAdapterException: $message';
}

/// Excepción arrojada ante detección de mensajes duplicados (deduplicación idempotente).
class DiscordDuplicateMessageException extends DiscordAdapterException {
  final String providerMessageId;
  final DeduplicatedAck? ack;

  const DiscordDuplicateMessageException(
    super.message, {
    required this.providerMessageId,
    this.ack,
    super.rawPayload,
    super.cause,
  });

  @override
  String toString() => 'DiscordDuplicateMessageException: $message';
}

/// Excepción arrojada ante fallas de verificación de firmas criptográficas o tokens en Discord.
class DiscordSignatureException extends DiscordAdapterException {
  const DiscordSignatureException(
    super.message, {
    super.rawPayload,
    super.cause,
  });

  @override
  String toString() => 'DiscordSignatureException: $message';
}

/// Adaptador canónico bidireccional para Discord Webhooks y Bot Interactions.
///
/// Transforma webhooks y eventos entrantes de Discord en sobres universales [InboundMessage]
/// con soporte transversal para versionado de esquema ([schemaVersion]) y deduplicación
/// idempotente ([DeduplicatedAck]). Mapea mensajes salientes [OutboundMessage] hacia DTOs
/// [DiscordMessage] listos para despacho.
class DiscordEnvelopeAdapter {
  /// Cabecera HTTP canónica para la firma Ed25519 de Discord.
  static const String headerSignatureEd25519 = 'X-Signature-Ed25519';

  /// Cabecera HTTP canónica para la marca de tiempo de la firma Ed25519 de Discord.
  static const String headerSignatureTimestamp = 'X-Signature-Timestamp';

  /// Cabecera HTTP canónica para autorización Bot o Bearer.
  static const String headerAuthorization = 'Authorization';

  /// Cabecera HTTP para token secreto de webhook Discord.
  static const String headerSecretToken = 'X-Discord-Secret-Token';

  /// Cabecera HTTP para firma HMAC-SHA256 (compatibilidad proxy/gateway).
  static const String headerSignature256 = 'X-Signature-256';

  /// Cabecera HTTP estándar Hub Signature HMAC-SHA256.
  static const String headerHubSignature256 = 'X-Hub-Signature-256';

  static final RegExp _hex128Regex = RegExp(r'^[0-9a-fA-F]{128}$');
  static final RegExp _hex64Regex = RegExp(r'^[0-9a-fA-F]{64}$');

  final Set<String> _processedMessageIds;

  /// Crea una instancia del adaptador con registro de deduplicación opcional.
  DiscordEnvelopeAdapter({Set<String>? processedMessageIds})
    : _processedMessageIds = processedMessageIds ?? <String>{};

  /// Conjunto inmutable de identificadores de mensajes ya procesados por esta instancia.
  Set<String> get processedMessageIds =>
      Set<String>.unmodifiable(_processedMessageIds);

  /// Limpia el registro de mensajes procesados.
  void clearProcessedMessages() => _processedMessageIds.clear();

  /// Registra manualmente un [messageId] en la memoria de deduplicación.
  void recordProcessedMessage(String messageId) {
    final String clean = messageId.trim();
    if (clean.isNotEmpty) {
      _processedMessageIds.add(clean);
    }
  }

  /// Indica si [messageId] ya ha sido procesado previamente.
  bool isMessageProcessed(String messageId) =>
      _processedMessageIds.contains(messageId.trim());

  /// Determina si [payload] presenta una estructura reconocible de Discord API o Webhook.
  bool isDiscordPayload(Map<String, dynamic> payload) {
    if (payload.isEmpty) return false;
    if (payload.containsKey('content')) return true;
    if (payload.containsKey('embeds') && payload['embeds'] is List) return true;
    if (payload.containsKey('author') && payload['author'] is Map) return true;
    if (payload.containsKey('user') && payload['user'] is Map) return true;
    if (payload.containsKey('member') && payload['member'] is Map) return true;
    if (payload.containsKey('channel_id')) return true;
    if (payload.containsKey('guild_id')) return true;
    if (payload.containsKey('application_id')) return true;
    if (payload.containsKey('attachments') && payload['attachments'] is List) {
      return true;
    }
    if (payload.containsKey('type') &&
        (payload.containsKey('token') || payload.containsKey('data'))) {
      return true;
    }
    if (payload.containsKey('id') &&
        (payload.containsKey('channel_id') ||
            payload.containsKey('webhook_id') ||
            payload.containsKey('author') ||
            payload.containsKey('content'))) {
      return true;
    }
    return false;
  }

  /// Busca una cabecera en [headers] de forma insensible a mayúsculas/minúsculas.
  static String? findHeader(Map<String, String> headers, String target) {
    final String lower = target.toLowerCase();
    for (final MapEntry<String, String> entry in headers.entries) {
      if (entry.key.toLowerCase() == lower) {
        return entry.value;
      }
    }
    return null;
  }

  /// Valida sincrónicamente las firmas o tokens de seguridad configurados.
  ///
  /// Arroja [DiscordSignatureException] si la firma o token es inválido o está ausente (§6).
  static void validateSignatureSync({
    required String rawBody,
    required Map<String, String> headers,
    String? secretToken,
    String? botToken,
    String? hmacSecret,
    String? publicKeyHex,
  }) {
    // 1. Validar Token Secreto si fue configurado
    if (secretToken != null && secretToken.isNotEmpty) {
      final String? token =
          findHeader(headers, headerSecretToken) ??
          findHeader(headers, 'X-Secret-Token');
      if (token == null || token.trim().isEmpty) {
        throw const DiscordSignatureException(
          'Cabecera de token secreto faltante o vacía en webhook Discord.',
        );
      }
      if (!WebhookSignatureValidator.constantTimeEquals(
        token.trim(),
        secretToken.trim(),
      )) {
        throw const DiscordSignatureException(
          'Token secreto de Discord mismatch o inválido.',
        );
      }
    }

    // 2. Validar Bot Authorization Token si fue configurado
    if (botToken != null && botToken.isNotEmpty) {
      final String? auth = findHeader(headers, headerAuthorization);
      if (auth == null || auth.trim().isEmpty) {
        throw const DiscordSignatureException(
          'Cabecera "Authorization" faltante o vacía en webhook Discord.',
        );
      }
      final String trimmedAuth = auth.trim();
      final String expectedAuth = 'Bot ${botToken.trim()}';
      if (!WebhookSignatureValidator.constantTimeEquals(
        trimmedAuth,
        expectedAuth,
      )) {
        throw const DiscordSignatureException(
          'Token de autorización Bot mismatch o inválido en webhook Discord.',
        );
      }
    }

    // 3. Validar HMAC-SHA256 si fue configurado
    if (hmacSecret != null && hmacSecret.isNotEmpty) {
      final String? sig =
          findHeader(headers, headerSignature256) ??
          findHeader(headers, headerHubSignature256);
      if (sig == null || sig.trim().isEmpty) {
        throw const DiscordSignatureException(
          'Cabecera de firma HMAC faltante o vacía en webhook Discord.',
        );
      }
      try {
        WebhookSignatureValidator.validateHubSignature(
          payload: rawBody,
          signatureHeader: sig,
          secret: hmacSecret,
        );
      } catch (e) {
        throw DiscordSignatureException(
          'Firma HMAC inválida en webhook Discord: $e',
          cause: e,
        );
      }
    }

    // 4. Si se provee publicKeyHex o cabecera Ed25519 en headers, validar formato sintáctico
    final String? edSig = findHeader(headers, headerSignatureEd25519);
    final String? edTs = findHeader(headers, headerSignatureTimestamp);
    if (publicKeyHex != null || edSig != null) {
      if (edSig == null || edSig.trim().isEmpty) {
        throw const DiscordSignatureException(
          'Cabecera obligatoria "X-Signature-Ed25519" faltante o vacía.',
        );
      }
      if (edTs == null || edTs.trim().isEmpty) {
        throw const DiscordSignatureException(
          'Cabecera obligatoria "X-Signature-Timestamp" faltante o vacía.',
        );
      }
      final String cleanSig = edSig.trim();
      if (cleanSig.length != 128 || !_hex128Regex.hasMatch(cleanSig)) {
        throw DiscordSignatureException(
          'Firma Ed25519 mutilada o malformada (longitud ${cleanSig.length}, se esperaban 128 caracteres hexadecimales).',
        );
      }
      if (publicKeyHex != null) {
        final String cleanKey = publicKeyHex.trim();
        if (cleanKey.length != 64 || !_hex64Regex.hasMatch(cleanKey)) {
          throw DiscordSignatureException(
            'Clave pública Ed25519 mutilada o malformada (longitud ${cleanKey.length}, se esperaban 64 caracteres hexadecimales).',
          );
        }
      }
    }
  }

  /// Valida asincrónicamente la firma Ed25519 contra [headers], [rawBody] y [publicKeyHex].
  ///
  /// Conforme a la especificación de interacciones HTTP de Discord.
  static Future<void> validateEd25519Signature({
    required String rawBody,
    required Map<String, String> headers,
    required String publicKeyHex,
  }) async {
    validateSignatureSync(
      rawBody: rawBody,
      headers: headers,
      publicKeyHex: publicKeyHex,
    );

    final String sigHex = findHeader(headers, headerSignatureEd25519)!.trim();
    final String timestamp = findHeader(
      headers,
      headerSignatureTimestamp,
    )!.trim();
    final String cleanKey = publicKeyHex.trim();

    try {
      final List<int> sigBytes = _hexDecode(sigHex);
      final List<int> keyBytes = _hexDecode(cleanKey);

      final Ed25519 ed25519 = Ed25519();
      final SimplePublicKey pubKey = SimplePublicKey(
        keyBytes,
        type: KeyPairType.ed25519,
      );
      final Signature signature = Signature(sigBytes, publicKey: pubKey);

      final String messageToVerify = '$timestamp$rawBody';
      final bool isValid = await ed25519.verify(
        utf8.encode(messageToVerify),
        signature: signature,
      );

      if (!isValid) {
        throw const DiscordSignatureException(
          'Verificación criptográfica de firma Ed25519 fallida.',
        );
      }
    } on DiscordSignatureException {
      rethrow;
    } catch (e) {
      throw DiscordSignatureException(
        'Error durante la verificación matemática de firma Ed25519: $e',
        cause: e,
      );
    }
  }

  /// Convierte un webhook crudo de Discord a un sobre canónico [InboundMessage].
  ///
  /// Arroja:
  /// - [DiscordAdapterException] si el payload está vacío, no se reconoce la estructura,
  ///   faltan campos mandatorios o el payload está mutilado (§6).
  /// - [DiscordSignatureException] si la firma o token de autenticación es inválido o ausente.
  /// - [DiscordDuplicateMessageException] si [checkDeduplication] es true y el `message_id`
  ///   ya fue procesado previamente (deduplicación idempotente).
  InboundMessage toInboundMessage(
    Map<String, dynamic> rawWebhook, {
    Map<String, String>? headers,
    String? rawBody,
    String? publicKeyHex,
    String? secretToken,
    String? botToken,
    String? hmacSecret,
    bool checkDeduplication = true,
  }) {
    if (rawWebhook.isEmpty) {
      throw const DiscordAdapterException(
        'El payload del webhook Discord está vacío.',
      );
    }

    if (!isDiscordPayload(rawWebhook)) {
      throw DiscordAdapterException(
        'Estructura de webhook Discord no reconocida o ausente.',
        rawPayload: rawWebhook,
      );
    }

    // 1. Verificación de Seguridad y Firmas (sincrónica)
    if (headers != null ||
        publicKeyHex != null ||
        secretToken != null ||
        botToken != null ||
        hmacSecret != null) {
      if (headers == null) {
        throw const DiscordSignatureException(
          'Cabeceras HTTP ausentes para validación de firma o token de Discord.',
        );
      }
      validateSignatureSync(
        rawBody: rawBody ?? jsonEncode(rawWebhook),
        headers: headers,
        secretToken: secretToken,
        botToken: botToken,
        hmacSecret: hmacSecret,
        publicKeyHex: publicKeyHex,
      );
    }

    // 2. Extracción de Provider Message ID
    final dynamic rawMsgId =
        rawWebhook['id'] ??
        rawWebhook['message_id'] ??
        (rawWebhook['data'] is Map ? rawWebhook['data']['id'] : null);

    if (rawMsgId == null || rawMsgId.toString().trim().isEmpty) {
      throw DiscordAdapterException(
        'Campo obligatorio "id" o "message_id" faltante en mensaje de Discord.',
        rawPayload: rawWebhook,
      );
    }
    final String providerMessageId = rawMsgId.toString().trim();

    // 3. Deduplicación Idempotente
    if (checkDeduplication) {
      if (_processedMessageIds.contains(providerMessageId)) {
        final DeduplicatedAck ack = DeduplicatedAck(
          schemaVersion: InboundMessage.defaultSchemaVersion,
          channel: ChannelType.discord,
          providerMessageId: providerMessageId,
          timestamp: DateTime.now().toUtc(),
          status: 'duplicate',
          metadata: <String, dynamic>{'reason': 'message_id repetido'},
        );
        throw DiscordDuplicateMessageException(
          'Mensaje duplicado detectado: providerMessageId "$providerMessageId" ya fue procesado.',
          providerMessageId: providerMessageId,
          ack: ack,
          rawPayload: rawWebhook,
        );
      }
      _processedMessageIds.add(providerMessageId);
    }

    // 4. Extracción de Remitente (Author / User / Member)
    String? senderId;
    String? senderName;

    final dynamic authorObj =
        rawWebhook['author'] ??
        rawWebhook['user'] ??
        (rawWebhook['member'] is Map ? rawWebhook['member']['user'] : null);

    if (authorObj is Map) {
      if (authorObj['id'] != null) {
        final String rawId = authorObj['id'].toString().trim();
        if (rawId.isNotEmpty) {
          senderId = rawId;
        }
      }
      final String? globalName = authorObj['global_name'] as String?;
      final String? username = authorObj['username'] as String?;
      final String? discriminator = authorObj['discriminator']?.toString();
      final String? nick = rawWebhook['member'] is Map
          ? rawWebhook['member']['nick'] as String?
          : null;

      if (nick != null && nick.trim().isNotEmpty) {
        senderName = nick.trim();
      } else if (globalName != null && globalName.trim().isNotEmpty) {
        senderName = globalName.trim();
      } else if (username != null && username.trim().isNotEmpty) {
        if (discriminator != null &&
            discriminator.trim().isNotEmpty &&
            discriminator.trim() != '0') {
          senderName = '${username.trim()}#${discriminator.trim()}';
        } else {
          senderName = username.trim();
        }
      }
    } else if (rawWebhook['webhook_id'] != null) {
      senderId = rawWebhook['webhook_id'].toString().trim();
      senderName = rawWebhook['username'] as String? ?? 'Discord Webhook';
    }

    if (senderId == null || senderId.isEmpty) {
      throw DiscordAdapterException(
        'No se encontró un identificador de remitente (author/user) válido en el mensaje de Discord.',
        rawPayload: rawWebhook,
      );
    }

    // 5. Extracción de Marca de Tiempo
    final dynamic rawDate =
        rawWebhook['timestamp'] ??
        rawWebhook['created_at'] ??
        rawWebhook['date'];
    final DateTime timestamp = rawDate != null
        ? _parseDate(rawDate)
        : DateTime.now().toUtc();

    // 6. Extracción de Texto y Medios
    String text = '';
    String? mediaUrl;

    if (rawWebhook['content'] is String) {
      text = (rawWebhook['content'] as String).trim();
    } else if (rawWebhook['data'] is Map &&
        rawWebhook['data']['name'] != null) {
      text = '/${rawWebhook['data']['name']}';
    }

    // Adjuntos (Attachments)
    final dynamic attachments = rawWebhook['attachments'];
    if (attachments is List && attachments.isNotEmpty) {
      final dynamic first = attachments.first;
      if (first is Map) {
        mediaUrl = first['url'] as String? ?? first['proxy_url'] as String?;
      }
    }

    // Embeds
    final dynamic embeds = rawWebhook['embeds'];
    if (embeds is List && embeds.isNotEmpty) {
      final dynamic firstEmbed = embeds.first;
      if (firstEmbed is Map) {
        if (mediaUrl == null) {
          final dynamic image = firstEmbed['image'];
          final dynamic thumbnail = firstEmbed['thumbnail'];
          if (image is Map && image['url'] != null) {
            mediaUrl = image['url'] as String?;
          } else if (thumbnail is Map && thumbnail['url'] != null) {
            mediaUrl = thumbnail['url'] as String?;
          } else if (firstEmbed['url'] != null) {
            mediaUrl = firstEmbed['url'] as String?;
          }
        }
        if (text.isEmpty) {
          final String? desc = firstEmbed['description'] as String?;
          final String? title = firstEmbed['title'] as String?;
          if (desc != null && desc.trim().isNotEmpty) {
            text = desc.trim();
          } else if (title != null && title.trim().isNotEmpty) {
            text = title.trim();
          }
        }
      }
    }

    // Mutilated payload check (§6)
    if (text.isEmpty &&
        mediaUrl == null &&
        (embeds is! List || embeds.isEmpty)) {
      throw DiscordAdapterException(
        'El payload de Discord está mutilado: no contiene texto, adjuntos ni embeds.',
        rawPayload: rawWebhook,
      );
    }

    return InboundMessage(
      schemaVersion: InboundMessage.defaultSchemaVersion,
      channel: ChannelType.discord,
      senderId: senderId,
      senderName: senderName,
      text: text,
      mediaUrl: mediaUrl,
      providerMessageId: providerMessageId,
      timestamp: timestamp,
      rawPayload: rawWebhook,
    );
  }

  /// Convierte un webhook verificando de forma asincrónica la firma Ed25519 de Discord.
  Future<InboundMessage> toInboundMessageVerified(
    Map<String, dynamic> rawWebhook, {
    required Map<String, String> headers,
    required String publicKeyHex,
    String? rawBody,
    bool checkDeduplication = true,
  }) async {
    await validateEd25519Signature(
      rawBody: rawBody ?? jsonEncode(rawWebhook),
      headers: headers,
      publicKeyHex: publicKeyHex,
    );
    return toInboundMessage(
      rawWebhook,
      headers: headers,
      rawBody: rawBody,
      publicKeyHex: publicKeyHex,
      checkDeduplication: checkDeduplication,
    );
  }

  /// Procesa un webhook de Discord de forma idempotente.
  ///
  /// Si el mensaje es nuevo, retorna [InboundMessage].
  /// Si ya fue procesado, retorna un [DeduplicatedAck] sin arrojar excepción.
  Object processWebhookIdempotent(
    Map<String, dynamic> rawWebhook, {
    Map<String, String>? headers,
    String? rawBody,
    String? publicKeyHex,
    String? secretToken,
    String? botToken,
    String? hmacSecret,
  }) {
    try {
      return toInboundMessage(
        rawWebhook,
        headers: headers,
        rawBody: rawBody,
        publicKeyHex: publicKeyHex,
        secretToken: secretToken,
        botToken: botToken,
        hmacSecret: hmacSecret,
        checkDeduplication: true,
      );
    } on DiscordDuplicateMessageException catch (dup) {
      return dup.ack ??
          DeduplicatedAck(
            schemaVersion: InboundMessage.defaultSchemaVersion,
            channel: ChannelType.discord,
            providerMessageId: dup.providerMessageId,
            timestamp: DateTime.now().toUtc(),
            status: 'duplicate',
            metadata: <String, dynamic>{'reason': 'idempotent_deduplication'},
          );
    }
  }

  /// Crea un [DeduplicatedAck] para un mensaje entrante de Discord.
  DeduplicatedAck createDeduplicatedAck(
    InboundMessage message, {
    String status = 'deduplicated',
    Map<String, dynamic>? metadata,
  }) {
    return DeduplicatedAck(
      schemaVersion: message.schemaVersion,
      channel: ChannelType.discord,
      providerMessageId: message.providerMessageId,
      timestamp: DateTime.now().toUtc(),
      status: status,
      metadata: <String, dynamic>{
        'sender_id': message.senderId,
        if (message.senderName != null) 'sender_name': message.senderName,
        ...?metadata,
      },
    );
  }

  /// Genera un [DeduplicatedAck] para un identificador de mensaje duplicado.
  DeduplicatedAck acknowledgeDuplicate(
    String messageId, {
    String status = 'duplicate',
    Map<String, dynamic>? metadata,
  }) {
    return DeduplicatedAck(
      schemaVersion: InboundMessage.defaultSchemaVersion,
      channel: ChannelType.discord,
      providerMessageId: messageId.trim(),
      timestamp: DateTime.now().toUtc(),
      status: status,
      metadata: metadata ?? const <String, dynamic>{},
    );
  }

  /// Convierte un [OutboundMessage] canónico a [DiscordMessage].
  DiscordMessage toDiscordMessage(OutboundMessage outbound) {
    if (outbound.channel != ChannelType.discord) {
      throw DiscordAdapterException(
        'El canal del mensaje saliente ("${outbound.channel.value}") no corresponde a Discord.',
      );
    }

    final String? username = outbound.metadata['username'] as String?;
    final String? avatarUrl =
        outbound.metadata['avatar_url'] as String? ??
        outbound.metadata['avatarUrl'] as String?;
    final bool tts = outbound.metadata['tts'] as bool? ?? false;

    List<DiscordEmbed> embeds = <DiscordEmbed>[];

    // Si se especifican embeds explícitos en los metadatos
    final dynamic rawEmbeds = outbound.metadata['embeds'];
    if (rawEmbeds is List) {
      for (final dynamic item in rawEmbeds) {
        if (item is DiscordEmbed) {
          embeds.add(item);
        } else if (item is Map<String, dynamic>) {
          embeds.add(DiscordEmbed.fromJson(item));
        }
      }
    }

    // Si el mensaje incluye una URL de medio y no hay embed con dicha URL, generarlo
    if (outbound.mediaUrl != null &&
        outbound.mediaUrl!.trim().isNotEmpty &&
        embeds.isEmpty) {
      embeds.add(
        DiscordEmbed(
          title: outbound.text.trim().isNotEmpty ? outbound.text.trim() : null,
          url: outbound.mediaUrl!.trim(),
          description: outbound.text.trim().isNotEmpty
              ? outbound.text.trim()
              : 'Media attachment',
        ),
      );
    }

    final String? content = outbound.text.trim().isNotEmpty
        ? outbound.text.trim()
        : null;

    return DiscordMessage(
      content: content,
      username: username,
      avatarUrl: avatarUrl,
      tts: tts,
      embeds: embeds,
    );
  }

  /// Convierte un [OutboundMessage] dinámicamente a payload JSON de Discord API.
  Map<String, dynamic> toPayload(OutboundMessage outbound) {
    return toDiscordMessage(outbound).toJson();
  }

  /// Convierte un [DiscordMessage] nativo a [OutboundMessage] canónico.
  OutboundMessage fromDiscordMessage(
    DiscordMessage msg, {
    required String recipientId,
    Map<String, dynamic>? metadata,
  }) {
    String text = msg.content ?? '';
    String? mediaUrl;

    if (msg.embeds.isNotEmpty) {
      final DiscordEmbed first = msg.embeds.first;
      if (text.isEmpty) {
        text = first.description ?? first.title ?? '';
      }
      mediaUrl = first.url;
    }

    return OutboundMessage(
      schemaVersion: OutboundMessage.defaultSchemaVersion,
      channel: ChannelType.discord,
      recipientId: recipientId,
      text: text,
      mediaUrl: mediaUrl,
      metadata: <String, dynamic>{
        if (msg.username != null) 'username': msg.username,
        if (msg.avatarUrl != null) 'avatar_url': msg.avatarUrl,
        if (msg.tts) 'tts': true,
        if (msg.embeds.isNotEmpty)
          'embeds': msg.embeds.map((DiscordEmbed e) => e.toJson()).toList(),
        ...?metadata,
      },
    );
  }

  static DateTime _parseDate(dynamic raw) {
    if (raw is int) {
      if (raw > 1000000000000) {
        return DateTime.fromMillisecondsSinceEpoch(raw, isUtc: true);
      }
      return DateTime.fromMillisecondsSinceEpoch(raw * 1000, isUtc: true);
    }
    if (raw is String) {
      final String trimmed = raw.trim();
      if (trimmed.isEmpty) {
        throw const DiscordAdapterException(
          'La marca de tiempo de Discord no puede estar vacía.',
        );
      }
      final int? asInt = int.tryParse(trimmed);
      if (asInt != null) {
        return _parseDate(asInt);
      }
      final DateTime? parsed = DateTime.tryParse(trimmed);
      if (parsed != null) {
        return parsed.toUtc();
      }
    }
    throw DiscordAdapterException(
      'Formato de fecha inválido en mensaje de Discord: "$raw"',
    );
  }

  static List<int> _hexDecode(String hex) {
    final List<int> result = <int>[];
    for (int i = 0; i < hex.length; i += 2) {
      final String byteStr = hex.substring(i, i + 2);
      final int? byte = int.tryParse(byteStr, radix: 16);
      if (byte == null) {
        throw FormatException('Carácter hexadecimal inválido en: "$byteStr"');
      }
      result.add(byte);
    }
    return result;
  }
}
