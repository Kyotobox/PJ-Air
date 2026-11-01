/// Canonical Pure Dart DTOs for Telegram Bot API messaging (§39).

/// Telegram text message payload.
class TelegramTextMessage {
  /// Unique identifier for the target chat or username of the target channel (in the format @channelusername).
  final String chatId;

  /// Text of the message to be sent (1-4096 characters).
  final String text;

  /// Mode for parsing entities in the message text (e.g. 'MarkdownV2', 'HTML', 'Markdown').
  final String? parseMode;

  /// If the message is a reply, ID of the original message.
  final int? replyToMessageId;

  /// Disables link previews for links in this message.
  final bool? disableWebPagePreview;

  /// Creates a [TelegramTextMessage] with validation (§6).
  TelegramTextMessage({
    required this.chatId,
    required this.text,
    this.parseMode,
    this.replyToMessageId,
    this.disableWebPagePreview,
  }) {
    if (chatId.trim().isEmpty) {
      throw ArgumentError.value(
        chatId,
        'chatId',
        'Telegram chatId cannot be empty.',
      );
    }
    if (text.trim().isEmpty) {
      throw ArgumentError.value(
        text,
        'text',
        'Telegram message text cannot be empty.',
      );
    }
  }

  /// Converts to standard Telegram Bot API payload.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'chat_id': chatId.trim(),
    'text': text,
    if (parseMode != null) 'parse_mode': parseMode,
    if (replyToMessageId != null) 'reply_to_message_id': replyToMessageId,
    if (disableWebPagePreview != null)
      'disable_web_page_preview': disableWebPagePreview,
  };

  /// Parses from standard Telegram JSON map.
  factory TelegramTextMessage.fromJson(Map<String, dynamic> json) {
    final dynamic rawChatId = json['chat_id'] ?? json['chatId'];
    if (rawChatId == null || rawChatId.toString().trim().isEmpty) {
      throw ArgumentError(
        'Missing required field "chat_id" in TelegramTextMessage JSON.',
      );
    }

    final String? rawText = json['text'] as String?;
    if (rawText == null || rawText.trim().isEmpty) {
      throw ArgumentError(
        'Missing required field "text" in TelegramTextMessage JSON.',
      );
    }

    return TelegramTextMessage(
      chatId: rawChatId.toString(),
      text: rawText,
      parseMode: json['parse_mode'] as String? ?? json['parseMode'] as String?,
      replyToMessageId:
          json['reply_to_message_id'] as int? ??
          json['replyToMessageId'] as int?,
      disableWebPagePreview:
          json['disable_web_page_preview'] as bool? ??
          json['disableWebPagePreview'] as bool?,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TelegramTextMessage &&
          runtimeType == other.runtimeType &&
          chatId == other.chatId &&
          text == other.text &&
          parseMode == other.parseMode &&
          replyToMessageId == other.replyToMessageId &&
          disableWebPagePreview == other.disableWebPagePreview;

  @override
  int get hashCode => Object.hash(
    chatId,
    text,
    parseMode,
    replyToMessageId,
    disableWebPagePreview,
  );

  @override
  String toString() =>
      'TelegramTextMessage(chatId: $chatId, textLength: ${text.length})';
}

/// Telegram photo message payload.
class TelegramPhotoMessage {
  final String chatId;
  final String photoUrl;
  final String? caption;
  final String? parseMode;

  /// Creates a [TelegramPhotoMessage] with validation (§6).
  TelegramPhotoMessage({
    required this.chatId,
    required this.photoUrl,
    this.caption,
    this.parseMode,
  }) {
    if (chatId.trim().isEmpty) {
      throw ArgumentError.value(
        chatId,
        'chatId',
        'Telegram chatId cannot be empty.',
      );
    }
    if (photoUrl.trim().isEmpty) {
      throw ArgumentError.value(
        photoUrl,
        'photoUrl',
        'Telegram photoUrl cannot be empty.',
      );
    }
  }

  /// Converts to standard Telegram Bot API payload.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'chat_id': chatId.trim(),
    'photo': photoUrl.trim(),
    if (caption != null && caption!.trim().isNotEmpty)
      'caption': caption!.trim(),
    if (parseMode != null) 'parse_mode': parseMode,
  };

  /// Parses from standard Telegram JSON map.
  factory TelegramPhotoMessage.fromJson(Map<String, dynamic> json) {
    final dynamic rawChatId = json['chat_id'] ?? json['chatId'];
    if (rawChatId == null || rawChatId.toString().trim().isEmpty) {
      throw ArgumentError(
        'Missing required field "chat_id" in TelegramPhotoMessage JSON.',
      );
    }

    final String? rawPhoto =
        json['photo'] as String? ?? json['photoUrl'] as String?;
    if (rawPhoto == null || rawPhoto.trim().isEmpty) {
      throw ArgumentError(
        'Missing required field "photo" in TelegramPhotoMessage JSON.',
      );
    }

    return TelegramPhotoMessage(
      chatId: rawChatId.toString(),
      photoUrl: rawPhoto,
      caption: json['caption'] as String?,
      parseMode: json['parse_mode'] as String? ?? json['parseMode'] as String?,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TelegramPhotoMessage &&
          runtimeType == other.runtimeType &&
          chatId == other.chatId &&
          photoUrl == other.photoUrl &&
          caption == other.caption &&
          parseMode == other.parseMode;

  @override
  int get hashCode => Object.hash(chatId, photoUrl, caption, parseMode);

  @override
  String toString() =>
      'TelegramPhotoMessage(chatId: $chatId, photo: $photoUrl)';
}
