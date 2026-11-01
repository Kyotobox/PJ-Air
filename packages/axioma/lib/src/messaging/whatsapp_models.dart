/// Canonical Pure Dart DTOs for WhatsApp Messaging (§39).
/// Fully compatible with Meta WhatsApp Business Cloud API payload specifications.

/// WhatsApp text message payload.
class WhatsAppTextMessage {
  /// Recipient phone number in international format.
  final String to;

  /// Text body content.
  final String body;

  /// Whether to display a preview for URLs found in the message body.
  final bool previewUrl;

  /// Creates a [WhatsAppTextMessage] with validation (§6).
  WhatsAppTextMessage({
    required this.to,
    required this.body,
    this.previewUrl = false,
  }) {
    if (to.trim().isEmpty) {
      throw ArgumentError.value(
        to,
        'to',
        'Recipient phone number cannot be empty.',
      );
    }
    if (body.trim().isEmpty) {
      throw ArgumentError.value(body, 'body', 'Message body cannot be empty.');
    }
  }

  /// Converts the message to Meta Cloud API format.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'messaging_product': 'whatsapp',
    'recipient_type': 'individual',
    'to': to.trim(),
    'type': 'text',
    'text': <String, dynamic>{'preview_url': previewUrl, 'body': body},
  };

  /// Parses from standard JSON map.
  factory WhatsAppTextMessage.fromJson(Map<String, dynamic> json) {
    final String? to = json['to'] as String?;
    if (to == null || to.trim().isEmpty) {
      throw ArgumentError(
        'Missing required field "to" in WhatsAppTextMessage JSON.',
      );
    }

    String? body;
    bool previewUrl = false;
    final dynamic textObj = json['text'];
    if (textObj is Map<String, dynamic>) {
      body = textObj['body'] as String?;
      previewUrl = textObj['preview_url'] as bool? ?? false;
    } else if (json['body'] is String) {
      body = json['body'] as String;
    }

    if (body == null || body.trim().isEmpty) {
      throw ArgumentError(
        'Missing required field "body" in WhatsAppTextMessage JSON.',
      );
    }

    return WhatsAppTextMessage(to: to, body: body, previewUrl: previewUrl);
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is WhatsAppTextMessage &&
          runtimeType == other.runtimeType &&
          to == other.to &&
          body == other.body &&
          previewUrl == other.previewUrl;

  @override
  int get hashCode => Object.hash(to, body, previewUrl);

  @override
  String toString() =>
      'WhatsAppTextMessage(to: $to, bodyLength: ${body.length})';
}

/// WhatsApp pre-approved template message payload.
class WhatsAppTemplateMessage {
  final String to;
  final String templateName;
  final String languageCode;
  final List<Map<String, dynamic>> components;

  /// Creates a [WhatsAppTemplateMessage] with validation (§6).
  WhatsAppTemplateMessage({
    required this.to,
    required this.templateName,
    this.languageCode = 'es',
    this.components = const <Map<String, dynamic>>[],
  }) {
    if (to.trim().isEmpty) {
      throw ArgumentError.value(
        to,
        'to',
        'Recipient phone number cannot be empty.',
      );
    }
    if (templateName.trim().isEmpty) {
      throw ArgumentError.value(
        templateName,
        'templateName',
        'Template name cannot be empty.',
      );
    }
    if (languageCode.trim().isEmpty) {
      throw ArgumentError.value(
        languageCode,
        'languageCode',
        'Language code cannot be empty.',
      );
    }
  }

  /// Converts the template message to Meta Cloud API format.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'messaging_product': 'whatsapp',
    'recipient_type': 'individual',
    'to': to.trim(),
    'type': 'template',
    'template': <String, dynamic>{
      'name': templateName.trim(),
      'language': <String, dynamic>{'code': languageCode.trim()},
      if (components.isNotEmpty) 'components': components,
    },
  };

  /// Parses from standard JSON map.
  factory WhatsAppTemplateMessage.fromJson(Map<String, dynamic> json) {
    final String? to = json['to'] as String?;
    if (to == null || to.trim().isEmpty) {
      throw ArgumentError(
        'Missing required field "to" in WhatsAppTemplateMessage JSON.',
      );
    }

    String? name;
    String lang = 'es';
    List<Map<String, dynamic>> comp = const <Map<String, dynamic>>[];

    final dynamic tpl = json['template'];
    if (tpl is Map<String, dynamic>) {
      name = tpl['name'] as String?;
      final dynamic langMap = tpl['language'];
      if (langMap is Map<String, dynamic>) {
        lang = langMap['code'] as String? ?? 'es';
      }
      final dynamic rawComp = tpl['components'];
      if (rawComp is List) {
        comp = rawComp.whereType<Map<String, dynamic>>().toList();
      }
    } else {
      name = json['templateName'] as String?;
      lang = json['languageCode'] as String? ?? 'es';
    }

    if (name == null || name.trim().isEmpty) {
      throw ArgumentError(
        'Missing required template name in WhatsAppTemplateMessage JSON.',
      );
    }

    return WhatsAppTemplateMessage(
      to: to,
      templateName: name,
      languageCode: lang,
      components: comp,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is WhatsAppTemplateMessage &&
          runtimeType == other.runtimeType &&
          to == other.to &&
          templateName == other.templateName &&
          languageCode == other.languageCode;

  @override
  int get hashCode => Object.hash(to, templateName, languageCode);

  @override
  String toString() =>
      'WhatsAppTemplateMessage(to: $to, template: $templateName, lang: $languageCode)';
}

/// WhatsApp media message payload (image, document, audio, video).
class WhatsAppMediaMessage {
  final String to;
  final String mediaType;
  final String mediaUrl;
  final String? caption;
  final String? filename;

  static const Set<String> validMediaTypes = <String>{
    'image',
    'document',
    'audio',
    'video',
    'sticker',
  };

  /// Creates a [WhatsAppMediaMessage] with validation (§6).
  WhatsAppMediaMessage({
    required this.to,
    required this.mediaType,
    required this.mediaUrl,
    this.caption,
    this.filename,
  }) {
    if (to.trim().isEmpty) {
      throw ArgumentError.value(to, 'to', 'Recipient phone cannot be empty.');
    }
    final String normalizedType = mediaType.toLowerCase().trim();
    if (!validMediaTypes.contains(normalizedType)) {
      throw ArgumentError.value(
        mediaType,
        'mediaType',
        'Invalid media type. Must be one of: ${validMediaTypes.join(', ')}.',
      );
    }
    if (mediaUrl.trim().isEmpty) {
      throw ArgumentError.value(
        mediaUrl,
        'mediaUrl',
        'Media URL cannot be empty.',
      );
    }
  }

  /// Converts to Meta Cloud API format.
  Map<String, dynamic> toJson() {
    final String type = mediaType.toLowerCase().trim();
    final Map<String, dynamic> mediaContent = <String, dynamic>{
      'link': mediaUrl.trim(),
      if (caption != null && caption!.trim().isNotEmpty)
        'caption': caption!.trim(),
      if (filename != null && filename!.trim().isNotEmpty)
        'filename': filename!.trim(),
    };

    return <String, dynamic>{
      'messaging_product': 'whatsapp',
      'recipient_type': 'individual',
      'to': to.trim(),
      'type': type,
      type: mediaContent,
    };
  }

  /// Parses from standard JSON map.
  factory WhatsAppMediaMessage.fromJson(Map<String, dynamic> json) {
    final String? to = json['to'] as String?;
    if (to == null || to.trim().isEmpty) {
      throw ArgumentError(
        'Missing required field "to" in WhatsAppMediaMessage JSON.',
      );
    }

    final String? type = (json['type'] as String?)?.toLowerCase().trim();
    if (type == null || !validMediaTypes.contains(type)) {
      throw ArgumentError(
        'Missing or invalid "type" in WhatsAppMediaMessage JSON.',
      );
    }

    String? link;
    String? caption;
    String? filename;

    final dynamic mediaObj = json[type];
    if (mediaObj is Map<String, dynamic>) {
      link = mediaObj['link'] as String? ?? mediaObj['url'] as String?;
      caption = mediaObj['caption'] as String?;
      filename = mediaObj['filename'] as String?;
    } else {
      link = json['mediaUrl'] as String?;
      caption = json['caption'] as String?;
      filename = json['filename'] as String?;
    }

    if (link == null || link.trim().isEmpty) {
      throw ArgumentError(
        'Missing media link/url in WhatsAppMediaMessage JSON.',
      );
    }

    return WhatsAppMediaMessage(
      to: to,
      mediaType: type,
      mediaUrl: link,
      caption: caption,
      filename: filename,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is WhatsAppMediaMessage &&
          runtimeType == other.runtimeType &&
          to == other.to &&
          mediaType == other.mediaType &&
          mediaUrl == other.mediaUrl &&
          caption == other.caption &&
          filename == other.filename;

  @override
  int get hashCode => Object.hash(to, mediaType, mediaUrl, caption, filename);

  @override
  String toString() =>
      'WhatsAppMediaMessage(to: $to, type: $mediaType, url: $mediaUrl)';
}
