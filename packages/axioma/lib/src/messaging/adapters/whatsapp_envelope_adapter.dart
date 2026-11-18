// 🎯 Canonical WhatsApp Envelope Adapter — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios,
// §12.b Límite 5 archivos, §39 Pure Dart Core, §40 Thin Client, §48 Cierre Autárquico.
library;

import '../omnichannel_envelope.dart';
import '../phone_sanitizer.dart';
import '../whatsapp_models.dart';

/// Excepción arrojada ante fallas de adaptación de sobres de WhatsApp.
class WhatsAppAdapterException implements Exception {
  final String message;
  final Map<String, dynamic>? rawPayload;
  final Object? cause;

  const WhatsAppAdapterException(this.message, {this.rawPayload, this.cause});

  @override
  String toString() => 'WhatsAppAdapterException: $message';
}

/// Adaptador canónico bidireccional para WhatsApp.
///
/// Transforma webhooks crudos entrantes (Meta WhatsApp Business Cloud API y Evolution API)
/// en sobres universales [InboundMessage], y mapea mensajes salientes canónicos [OutboundMessage]
/// hacia DTOs fuertemente tipados [WhatsAppTextMessage] o [WhatsAppMediaMessage] listos para despacho.
class WhatsAppEnvelopeAdapter {
  const WhatsAppEnvelopeAdapter();

  /// Determina si [payload] proviene de Meta WhatsApp Business Cloud API.
  bool isCloudApi(Map<String, dynamic> payload) {
    if (payload.isEmpty) return false;
    if (payload['object'] == 'whatsapp_business_account') return true;
    if (payload.containsKey('entry') && payload['entry'] is List) return true;
    if (payload['messaging_product'] == 'whatsapp' &&
        payload.containsKey('messages')) {
      return true;
    }
    return false;
  }

  /// Determina si [payload] proviene de Evolution API (Baileys webhook).
  bool isEvolutionApi(Map<String, dynamic> payload) {
    if (payload.isEmpty) return false;
    if (payload.containsKey('event')) {
      final String evt = payload['event'].toString().toLowerCase();
      if (evt.contains('message') ||
          evt.contains('upsert') ||
          evt.contains('send_message')) {
        return true;
      }
    }
    if (payload.containsKey('instance') && payload.containsKey('data')) {
      return true;
    }
    if (payload.containsKey('key') &&
        payload['key'] is Map &&
        payload.containsKey('message')) {
      return true;
    }
    if (payload.containsKey('data')) {
      final dynamic data = payload['data'];
      if (data is Map &&
          (data.containsKey('key') || data.containsKey('message'))) {
        return true;
      }
      if (data is List && data.isNotEmpty && data.first is Map) {
        final Map<dynamic, dynamic> first = data.first as Map<dynamic, dynamic>;
        if (first.containsKey('key') || first.containsKey('message')) {
          return true;
        }
      }
    }
    return false;
  }

  /// Convierte un webhook crudo de WhatsApp (Cloud API o Evolution API) a [InboundMessage].
  ///
  /// Arroja [WhatsAppAdapterException] ante estructuras desconocidas, vacías o campos faltantes (§6).
  InboundMessage toInboundMessage(Map<String, dynamic> rawWebhook) {
    if (rawWebhook.isEmpty) {
      throw const WhatsAppAdapterException(
        'El payload del webhook WhatsApp está vacío.',
      );
    }

    if (isCloudApi(rawWebhook)) {
      return fromCloudApi(rawWebhook);
    } else if (isEvolutionApi(rawWebhook)) {
      return fromEvolutionApi(rawWebhook);
    }

    throw WhatsAppAdapterException(
      'Formato de webhook WhatsApp no reconocido o estructura desconocida.',
      rawPayload: rawWebhook,
    );
  }

  /// Parsea un webhook de Meta WhatsApp Business Cloud API hacia [InboundMessage].
  InboundMessage fromCloudApi(Map<String, dynamic> payload) {
    Map<String, dynamic>? valueMap;
    List<dynamic>? messagesList;
    List<dynamic>? contactsList;

    if (payload.containsKey('entry') && payload['entry'] is List) {
      final List<dynamic> entries = payload['entry'] as List<dynamic>;
      if (entries.isEmpty || entries.first is! Map) {
        throw WhatsAppAdapterException(
          'Payload de Cloud API contiene lista "entry" vacía o inválida.',
          rawPayload: payload,
        );
      }
      final Map<dynamic, dynamic> firstEntry =
          entries.first as Map<dynamic, dynamic>;
      final dynamic changes = firstEntry['changes'];
      if (changes is! List || changes.isEmpty || changes.first is! Map) {
        throw WhatsAppAdapterException(
          'Payload de Cloud API contiene lista "changes" vacía o inválida.',
          rawPayload: payload,
        );
      }
      final Map<dynamic, dynamic> firstChange =
          changes.first as Map<dynamic, dynamic>;
      final dynamic val = firstChange['value'];
      if (val is! Map) {
        throw WhatsAppAdapterException(
          'Campo "value" ausente o no estructurado en Cloud API webhook.',
          rawPayload: payload,
        );
      }
      valueMap = Map<String, dynamic>.from(val);
      messagesList = valueMap['messages'] as List<dynamic>?;
      contactsList = valueMap['contacts'] as List<dynamic>?;
    } else if (payload.containsKey('messages') && payload['messages'] is List) {
      valueMap = payload;
      messagesList = payload['messages'] as List<dynamic>?;
      contactsList = payload['contacts'] as List<dynamic>?;
    }

    if (messagesList == null ||
        messagesList.isEmpty ||
        messagesList.first is! Map) {
      throw WhatsAppAdapterException(
        'El webhook de WhatsApp Cloud API no contiene mensajes ("messages").',
        rawPayload: payload,
      );
    }

    final Map<dynamic, dynamic> message =
        messagesList.first as Map<dynamic, dynamic>;

    // Sender ID (wa_id / from)
    final dynamic rawFrom = message['from'];
    if (rawFrom == null || rawFrom.toString().trim().isEmpty) {
      throw WhatsAppAdapterException(
        'Campo obligatorio "from" ausente o vacío en mensaje de Cloud API.',
        rawPayload: payload,
      );
    }
    final String senderId = _normalizePhoneNumber(rawFrom.toString());

    // Provider Message ID
    final dynamic rawId = message['id'];
    if (rawId == null || rawId.toString().trim().isEmpty) {
      throw WhatsAppAdapterException(
        'Campo obligatorio "id" (providerMessageId) ausente o vacío en mensaje de Cloud API.',
        rawPayload: payload,
      );
    }
    final String providerMessageId = rawId.toString().trim();

    // Sender Name de la lista de contactos
    String? senderName;
    if (contactsList != null &&
        contactsList.isNotEmpty &&
        contactsList.first is Map) {
      final Map<dynamic, dynamic> contact =
          contactsList.first as Map<dynamic, dynamic>;
      final dynamic profile = contact['profile'];
      if (profile is Map && profile['name'] != null) {
        senderName = profile['name'].toString().trim();
      }
    }

    // Timestamp
    final DateTime timestamp = _parseTimestamp(message['timestamp']);

    // Extraer texto y/o medio según tipo
    final String msgType =
        (message['type'] as String?)?.toLowerCase().trim() ?? 'text';
    String text = '';
    String? mediaUrl;

    switch (msgType) {
      case 'text':
        final dynamic textObj = message['text'];
        if (textObj is Map) {
          text = textObj['body'] as String? ?? '';
        } else if (textObj is String) {
          text = textObj;
        }
        break;
      case 'image':
      case 'document':
      case 'video':
      case 'audio':
      case 'sticker':
        final dynamic mediaObj = message[msgType];
        if (mediaObj is Map) {
          text =
              mediaObj['caption'] as String? ??
              mediaObj['filename'] as String? ??
              '';
          mediaUrl =
              mediaObj['link'] as String? ??
              mediaObj['url'] as String? ??
              mediaObj['id'] as String?;
        }
        break;
      case 'interactive':
        final dynamic interactive = message['interactive'];
        if (interactive is Map) {
          final dynamic btnReply = interactive['button_reply'];
          if (btnReply is Map) {
            text =
                btnReply['title'] as String? ?? btnReply['id'] as String? ?? '';
          }
          final dynamic listReply = interactive['list_reply'];
          if (listReply is Map) {
            text =
                listReply['title'] as String? ??
                listReply['id'] as String? ??
                '';
          }
        }
        break;
      case 'button':
        final dynamic button = message['button'];
        if (button is Map) {
          text = button['text'] as String? ?? '';
        }
        break;
      default:
        if (message['text'] != null) {
          final dynamic t = message['text'];
          text = t is Map ? (t['body'] as String? ?? '') : t.toString();
        }
        break;
    }

    return InboundMessage(
      channel: ChannelType.whatsapp,
      senderId: senderId,
      senderName: senderName,
      text: text,
      mediaUrl: mediaUrl,
      providerMessageId: providerMessageId,
      timestamp: timestamp,
      rawPayload: payload,
    );
  }

  /// Parsea un webhook de Evolution API hacia [InboundMessage].
  InboundMessage fromEvolutionApi(Map<String, dynamic> payload) {
    Map<String, dynamic>? dataMap;
    if (payload.containsKey('data')) {
      final dynamic rawData = payload['data'];
      if (rawData is Map) {
        dataMap = Map<String, dynamic>.from(rawData);
      } else if (rawData is List &&
          rawData.isNotEmpty &&
          rawData.first is Map) {
        dataMap = Map<String, dynamic>.from(
          rawData.first as Map<dynamic, dynamic>,
        );
      }
    } else if (payload.containsKey('key')) {
      dataMap = payload;
    }

    if (dataMap == null || !dataMap.containsKey('key')) {
      throw WhatsAppAdapterException(
        'El payload de Evolution API no contiene el objeto obligatorio "key".',
        rawPayload: payload,
      );
    }

    final dynamic keyObj = dataMap['key'];
    if (keyObj is! Map) {
      throw WhatsAppAdapterException(
        'El campo "key" en Evolution API debe ser un mapa estructurado.',
        rawPayload: payload,
      );
    }
    final Map<dynamic, dynamic> key = keyObj;

    // Sender ID
    final dynamic remoteJid =
        key['remoteJid'] ?? key['participant'] ?? dataMap['sender'];
    if (remoteJid == null || remoteJid.toString().trim().isEmpty) {
      throw WhatsAppAdapterException(
        'Identificador de remitente (remoteJid) ausente en Evolution API.',
        rawPayload: payload,
      );
    }
    final String senderId = _normalizePhoneNumber(remoteJid.toString());

    // Provider Message ID
    final dynamic idObj = key['id'];
    if (idObj == null || idObj.toString().trim().isEmpty) {
      throw WhatsAppAdapterException(
        'Identificador de mensaje (key.id) ausente en Evolution API.',
        rawPayload: payload,
      );
    }
    final String providerMessageId = idObj.toString().trim();

    // Sender Name
    final String? senderName = (dataMap['pushName'] as String?)?.trim();

    // Timestamp
    final dynamic tsObj = dataMap['messageTimestamp'];
    final DateTime timestamp = _parseTimestamp(tsObj);

    // Contenido del mensaje
    String text = '';
    String? mediaUrl;

    final dynamic msgObj = dataMap['message'];
    if (msgObj is Map) {
      if (msgObj.containsKey('conversation') &&
          msgObj['conversation'] is String) {
        text = msgObj['conversation'] as String;
      } else if (msgObj.containsKey('extendedTextMessage') &&
          msgObj['extendedTextMessage'] is Map) {
        text = msgObj['extendedTextMessage']['text'] as String? ?? '';
      } else if (msgObj.containsKey('imageMessage') &&
          msgObj['imageMessage'] is Map) {
        final Map<dynamic, dynamic> img =
            msgObj['imageMessage'] as Map<dynamic, dynamic>;
        text = img['caption'] as String? ?? '';
        mediaUrl = img['url'] as String? ?? img['directPath'] as String?;
      } else if (msgObj.containsKey('videoMessage') &&
          msgObj['videoMessage'] is Map) {
        final Map<dynamic, dynamic> vid =
            msgObj['videoMessage'] as Map<dynamic, dynamic>;
        text = vid['caption'] as String? ?? '';
        mediaUrl = vid['url'] as String?;
      } else if (msgObj.containsKey('documentMessage') &&
          msgObj['documentMessage'] is Map) {
        final Map<dynamic, dynamic> doc =
            msgObj['documentMessage'] as Map<dynamic, dynamic>;
        text = doc['title'] as String? ?? doc['fileName'] as String? ?? '';
        mediaUrl = doc['url'] as String?;
      } else if (msgObj.containsKey('audioMessage') &&
          msgObj['audioMessage'] is Map) {
        final Map<dynamic, dynamic> aud =
            msgObj['audioMessage'] as Map<dynamic, dynamic>;
        mediaUrl = aud['url'] as String?;
      } else if (msgObj.containsKey('buttonsResponseMessage') &&
          msgObj['buttonsResponseMessage'] is Map) {
        text =
            msgObj['buttonsResponseMessage']['selectedDisplayText']
                as String? ??
            '';
      }
    } else if (msgObj is String) {
      text = msgObj;
    }

    return InboundMessage(
      channel: ChannelType.whatsapp,
      senderId: senderId,
      senderName: senderName,
      text: text,
      mediaUrl: mediaUrl,
      providerMessageId: providerMessageId,
      timestamp: timestamp,
      rawPayload: payload,
    );
  }

  /// Convierte un [OutboundMessage] saliente a [WhatsAppTextMessage].
  WhatsAppTextMessage toTextMessage(OutboundMessage outbound) {
    if (outbound.channel != ChannelType.whatsapp) {
      throw WhatsAppAdapterException(
        'El canal del mensaje saliente ("${outbound.channel.value}") no corresponde a WhatsApp.',
      );
    }
    final String to = _normalizePhoneNumber(outbound.recipientId);
    final bool previewUrl = outbound.metadata['preview_url'] as bool? ?? false;

    return WhatsAppTextMessage(
      to: to,
      body: outbound.text,
      previewUrl: previewUrl,
    );
  }

  /// Convierte un [OutboundMessage] saliente con medio adjunto a [WhatsAppMediaMessage].
  WhatsAppMediaMessage toMediaMessage(OutboundMessage outbound) {
    if (outbound.channel != ChannelType.whatsapp) {
      throw WhatsAppAdapterException(
        'El canal del mensaje saliente ("${outbound.channel.value}") no corresponde a WhatsApp.',
      );
    }
    if (outbound.mediaUrl == null || outbound.mediaUrl!.trim().isEmpty) {
      throw const WhatsAppAdapterException(
        'El mensaje saliente no contiene "mediaUrl" para construir WhatsAppMediaMessage.',
      );
    }

    final String to = _normalizePhoneNumber(outbound.recipientId);
    String type = (outbound.mediaType ?? 'image').toLowerCase().trim();
    if (!WhatsAppMediaMessage.validMediaTypes.contains(type)) {
      type = 'image';
    }

    final String? filename = outbound.metadata['filename'] as String?;
    final String? caption = outbound.text.trim().isNotEmpty
        ? outbound.text
        : null;

    return WhatsAppMediaMessage(
      to: to,
      mediaType: type,
      mediaUrl: outbound.mediaUrl!,
      caption: caption,
      filename: filename,
    );
  }

  /// Convierte un [OutboundMessage] dinámicamente a [WhatsAppTextMessage] o [WhatsAppMediaMessage].
  Object toWhatsAppMessage(OutboundMessage outbound) {
    if (outbound.mediaUrl != null && outbound.mediaUrl!.trim().isNotEmpty) {
      return toMediaMessage(outbound);
    }
    return toTextMessage(outbound);
  }

  /// Convierte un [OutboundMessage] a payload JSON de Meta Cloud API.
  Map<String, dynamic> toPayload(OutboundMessage outbound) {
    final Object msg = toWhatsAppMessage(outbound);
    if (msg is WhatsAppMediaMessage) {
      return msg.toJson();
    }
    return (msg as WhatsAppTextMessage).toJson();
  }

  /// Convierte un [WhatsAppTextMessage] nativo a [OutboundMessage] canónico.
  OutboundMessage fromTextMessage(
    WhatsAppTextMessage msg, {
    Map<String, dynamic>? metadata,
  }) {
    return OutboundMessage(
      channel: ChannelType.whatsapp,
      recipientId: msg.to,
      text: msg.body,
      metadata: <String, dynamic>{
        if (msg.previewUrl) 'preview_url': true,
        ...?metadata,
      },
    );
  }

  /// Convierte un [WhatsAppMediaMessage] nativo a [OutboundMessage] canónico.
  OutboundMessage fromMediaMessage(
    WhatsAppMediaMessage msg, {
    Map<String, dynamic>? metadata,
  }) {
    return OutboundMessage(
      channel: ChannelType.whatsapp,
      recipientId: msg.to,
      text: msg.caption ?? '',
      mediaUrl: msg.mediaUrl,
      mediaType: msg.mediaType,
      metadata: <String, dynamic>{
        if (msg.filename != null) 'filename': msg.filename,
        ...?metadata,
      },
    );
  }

  static String _normalizePhoneNumber(String raw) {
    String clean = raw.trim();
    if (clean.contains('@')) {
      clean = clean.split('@').first.split(':').first;
    }
    if (!clean.startsWith('+') && !clean.startsWith('00')) {
      clean = '+$clean';
    }
    if (E164PhoneValidator.isValid(clean)) {
      return E164PhoneValidator.sanitize(clean);
    }
    return clean;
  }

  static DateTime _parseTimestamp(dynamic raw) {
    if (raw == null) return DateTime.now().toUtc();
    if (raw is int) {
      if (raw > 100000000000) {
        return DateTime.fromMillisecondsSinceEpoch(raw, isUtc: true);
      }
      return DateTime.fromMillisecondsSinceEpoch(raw * 1000, isUtc: true);
    }
    if (raw is String) {
      final int? asInt = int.tryParse(raw);
      if (asInt != null) {
        if (asInt > 100000000000) {
          return DateTime.fromMillisecondsSinceEpoch(asInt, isUtc: true);
        }
        return DateTime.fromMillisecondsSinceEpoch(asInt * 1000, isUtc: true);
      }
      final DateTime? parsed = DateTime.tryParse(raw);
      if (parsed != null) return parsed.toUtc();
    }
    return DateTime.now().toUtc();
  }
}
