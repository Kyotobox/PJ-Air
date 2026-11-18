// 🎯 Canonical Telegram Envelope Adapter — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios,
// §12.b Límite 5 archivos, §39 Pure Dart Core, §40 Thin Client, §48 Cierre Autárquico.
library;

import '../omnichannel_envelope.dart';
import '../telegram_models.dart';

/// Excepción arrojada ante fallas de adaptación de sobres de Telegram.
class TelegramAdapterException implements Exception {
  final String message;
  final Map<String, dynamic>? rawPayload;
  final Object? cause;

  const TelegramAdapterException(this.message, {this.rawPayload, this.cause});

  @override
  String toString() => 'TelegramAdapterException: $message';
}

/// Adaptador canónico bidireccional para Telegram Bot API.
///
/// Transforma webhooks entrantes (Telegram Update objects) en sobres universales [InboundMessage],
/// y mapea mensajes salientes canónicos [OutboundMessage] hacia DTOs fuertemente tipados
/// [TelegramTextMessage] o [TelegramPhotoMessage] listos para despacho hacia la API de Telegram.
class TelegramEnvelopeAdapter {
  const TelegramEnvelopeAdapter();

  /// Determina si [payload] presenta una estructura reconocible de Telegram Bot API.
  bool isTelegramUpdate(Map<String, dynamic> payload) {
    if (payload.isEmpty) return false;
    if (payload.containsKey('update_id')) return true;
    if (payload.containsKey('message') && payload['message'] is Map) {
      return true;
    }
    if (payload.containsKey('edited_message') &&
        payload['edited_message'] is Map) {
      return true;
    }
    if (payload.containsKey('channel_post') && payload['channel_post'] is Map) {
      return true;
    }
    if (payload.containsKey('callback_query') &&
        payload['callback_query'] is Map) {
      return true;
    }
    if (payload.containsKey('message_id') &&
        (payload.containsKey('chat') || payload.containsKey('from'))) {
      return true;
    }
    return false;
  }

  /// Convierte un webhook crudo de Telegram Update a un [InboundMessage] canónico.
  ///
  /// Arroja [TelegramAdapterException] si el payload está vacío, no se reconoce
  /// la estructura o faltan campos mandatorios (§6).
  InboundMessage toInboundMessage(Map<String, dynamic> rawWebhook) {
    if (rawWebhook.isEmpty) {
      throw const TelegramAdapterException(
        'El payload del webhook Telegram está vacío.',
      );
    }

    if (!isTelegramUpdate(rawWebhook)) {
      throw TelegramAdapterException(
        'Estructura de webhook Telegram no reconocida o ausente.',
        rawPayload: rawWebhook,
      );
    }

    Map<String, dynamic>? messageMap;
    if (rawWebhook['message'] is Map) {
      messageMap = Map<String, dynamic>.from(
        rawWebhook['message'] as Map<dynamic, dynamic>,
      );
    } else if (rawWebhook['edited_message'] is Map) {
      messageMap = Map<String, dynamic>.from(
        rawWebhook['edited_message'] as Map<dynamic, dynamic>,
      );
    } else if (rawWebhook['channel_post'] is Map) {
      messageMap = Map<String, dynamic>.from(
        rawWebhook['channel_post'] as Map<dynamic, dynamic>,
      );
    } else if (rawWebhook['callback_query'] is Map) {
      final Map<dynamic, dynamic> cb =
          rawWebhook['callback_query'] as Map<dynamic, dynamic>;
      if (cb['message'] is Map) {
        messageMap = Map<String, dynamic>.from(
          cb['message'] as Map<dynamic, dynamic>,
        );
        if (cb.containsKey('data')) {
          messageMap['text'] = cb['data'];
        }
      }
    } else if (rawWebhook.containsKey('message_id') &&
        (rawWebhook.containsKey('chat') || rawWebhook.containsKey('from'))) {
      messageMap = rawWebhook;
    }

    if (messageMap == null) {
      throw TelegramAdapterException(
        'El webhook de Telegram no contiene un objeto de mensaje analizable.',
        rawPayload: rawWebhook,
      );
    }

    // Provider Message ID
    final dynamic rawMsgId = messageMap['message_id'];
    if (rawMsgId == null || rawMsgId.toString().trim().isEmpty) {
      throw TelegramAdapterException(
        'Campo obligatorio "message_id" faltante en mensaje de Telegram.',
        rawPayload: rawWebhook,
      );
    }
    final String providerMessageId = rawMsgId.toString().trim();

    // Sender ID & Name
    String? senderId;
    String? senderName;

    final dynamic fromObj = messageMap['from'];
    if (fromObj is Map) {
      if (fromObj['id'] != null) {
        senderId = fromObj['id'].toString().trim();
      }
      final String? firstName = fromObj['first_name'] as String?;
      final String? lastName = fromObj['last_name'] as String?;
      final String? username = fromObj['username'] as String?;
      final List<String> parts = <String>[
        if (firstName != null && firstName.trim().isNotEmpty) firstName.trim(),
        if (lastName != null && lastName.trim().isNotEmpty) lastName.trim(),
      ];
      if (parts.isNotEmpty) {
        senderName = parts.join(' ');
      } else if (username != null && username.trim().isNotEmpty) {
        senderName = '@${username.trim()}';
      }
    }

    if (senderId == null || senderId.isEmpty) {
      final dynamic chatObj = messageMap['chat'];
      if (chatObj is Map && chatObj['id'] != null) {
        senderId = chatObj['id'].toString().trim();
        if (senderName == null) {
          final String? title = chatObj['title'] as String?;
          final String? username = chatObj['username'] as String?;
          senderName = title ?? (username != null ? '@$username' : null);
        }
      }
    }

    if (senderId == null || senderId.isEmpty) {
      throw TelegramAdapterException(
        'No se encontró un identificador de remitente o chat válido en el mensaje de Telegram.',
        rawPayload: rawWebhook,
      );
    }

    // Timestamp
    final dynamic rawDate = messageMap['date'];
    if (rawDate == null) {
      throw TelegramAdapterException(
        'Campo obligatorio "date" faltante en mensaje de Telegram.',
        rawPayload: rawWebhook,
      );
    }
    final DateTime timestamp = _parseDate(rawDate);

    // Text & Media
    String text = '';
    String? mediaUrl;

    if (messageMap['text'] is String) {
      text = messageMap['text'] as String;
    } else if (messageMap['caption'] is String) {
      text = messageMap['caption'] as String;
    }

    if (messageMap['photo'] is List) {
      final List<dynamic> photos = messageMap['photo'] as List<dynamic>;
      if (photos.isNotEmpty && photos.last is Map) {
        final Map<dynamic, dynamic> lastPhoto =
            photos.last as Map<dynamic, dynamic>;
        mediaUrl =
            lastPhoto['file_url'] as String? ??
            lastPhoto['url'] as String? ??
            lastPhoto['file_id'] as String?;
      }
    } else if (messageMap['document'] is Map) {
      final Map<dynamic, dynamic> doc =
          messageMap['document'] as Map<dynamic, dynamic>;
      mediaUrl = doc['file_url'] as String? ?? doc['file_id'] as String?;
    } else if (messageMap['video'] is Map) {
      final Map<dynamic, dynamic> vid =
          messageMap['video'] as Map<dynamic, dynamic>;
      mediaUrl = vid['file_url'] as String? ?? vid['file_id'] as String?;
    }

    return InboundMessage(
      channel: ChannelType.telegram,
      senderId: senderId,
      senderName: senderName,
      text: text,
      mediaUrl: mediaUrl,
      providerMessageId: providerMessageId,
      timestamp: timestamp,
      rawPayload: rawWebhook,
    );
  }

  /// Convierte un [OutboundMessage] canónico a [TelegramTextMessage].
  TelegramTextMessage toTextMessage(OutboundMessage outbound) {
    if (outbound.channel != ChannelType.telegram) {
      throw TelegramAdapterException(
        'El canal del mensaje saliente ("${outbound.channel.value}") no corresponde a Telegram.',
      );
    }

    int? replyToId;
    if (outbound.replyToId != null && outbound.replyToId!.trim().isNotEmpty) {
      replyToId = int.tryParse(outbound.replyToId!.trim());
    }

    final String? parseMode = outbound.metadata['parse_mode'] as String?;
    final bool? disableWebPreview =
        outbound.metadata['disable_web_page_preview'] as bool?;

    return TelegramTextMessage(
      chatId: outbound.recipientId,
      text: outbound.text,
      parseMode: parseMode,
      replyToMessageId: replyToId,
      disableWebPagePreview: disableWebPreview,
    );
  }

  /// Convierte un [OutboundMessage] canónico con imagen a [TelegramPhotoMessage].
  TelegramPhotoMessage toPhotoMessage(OutboundMessage outbound) {
    if (outbound.channel != ChannelType.telegram) {
      throw TelegramAdapterException(
        'El canal del mensaje saliente ("${outbound.channel.value}") no corresponde a Telegram.',
      );
    }
    if (outbound.mediaUrl == null || outbound.mediaUrl!.trim().isEmpty) {
      throw const TelegramAdapterException(
        'El mensaje saliente no contiene "mediaUrl" para construir TelegramPhotoMessage.',
      );
    }

    final String? parseMode = outbound.metadata['parse_mode'] as String?;
    final String? caption = outbound.text.trim().isNotEmpty
        ? outbound.text
        : null;

    return TelegramPhotoMessage(
      chatId: outbound.recipientId,
      photoUrl: outbound.mediaUrl!,
      caption: caption,
      parseMode: parseMode,
    );
  }

  /// Convierte un [OutboundMessage] dinámicamente a payload JSON de Telegram Bot API.
  Map<String, dynamic> toPayload(OutboundMessage outbound) {
    if (outbound.mediaUrl != null &&
        outbound.mediaUrl!.trim().isNotEmpty &&
        (outbound.mediaType == 'image' || outbound.mediaType == 'photo')) {
      return toPhotoMessage(outbound).toJson();
    }
    return toTextMessage(outbound).toJson();
  }

  /// Convierte un [TelegramTextMessage] nativo a [OutboundMessage] canónico.
  OutboundMessage fromTextMessage(
    TelegramTextMessage msg, {
    Map<String, dynamic>? metadata,
  }) {
    return OutboundMessage(
      channel: ChannelType.telegram,
      recipientId: msg.chatId,
      text: msg.text,
      replyToId: msg.replyToMessageId?.toString(),
      metadata: <String, dynamic>{
        if (msg.parseMode != null) 'parse_mode': msg.parseMode,
        if (msg.disableWebPagePreview != null)
          'disable_web_page_preview': msg.disableWebPagePreview,
        ...?metadata,
      },
    );
  }

  /// Convierte un [TelegramPhotoMessage] nativo a [OutboundMessage] canónico.
  OutboundMessage fromPhotoMessage(
    TelegramPhotoMessage msg, {
    Map<String, dynamic>? metadata,
  }) {
    return OutboundMessage(
      channel: ChannelType.telegram,
      recipientId: msg.chatId,
      text: msg.caption ?? '',
      mediaUrl: msg.photoUrl,
      mediaType: 'image',
      metadata: <String, dynamic>{
        if (msg.parseMode != null) 'parse_mode': msg.parseMode,
        ...?metadata,
      },
    );
  }

  static DateTime _parseDate(dynamic raw) {
    if (raw is int) {
      return DateTime.fromMillisecondsSinceEpoch(raw * 1000, isUtc: true);
    }
    if (raw is String) {
      final int? dateInt = int.tryParse(raw);
      if (dateInt != null) {
        return DateTime.fromMillisecondsSinceEpoch(dateInt * 1000, isUtc: true);
      }
      final DateTime? parsed = DateTime.tryParse(raw);
      if (parsed != null) return parsed.toUtc();
    }
    throw TelegramAdapterException(
      'Formato de fecha inválido en Telegram: "$raw"',
    );
  }
}
