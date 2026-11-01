/// Canonical Pure Dart DTOs for Discord Webhooks and Bot messaging (§39).

/// Field inside a Discord Embed object.
class DiscordEmbedField {
  final String name;
  final String value;
  final bool inline;

  DiscordEmbedField({
    required this.name,
    required this.value,
    this.inline = false,
  }) {
    if (name.trim().isEmpty) {
      throw ArgumentError.value(name, 'name', 'Field name cannot be empty.');
    }
    if (value.trim().isEmpty) {
      throw ArgumentError.value(value, 'value', 'Field value cannot be empty.');
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'name': name.trim(),
    'value': value.trim(),
    'inline': inline,
  };

  factory DiscordEmbedField.fromJson(Map<String, dynamic> json) =>
      DiscordEmbedField(
        name: json['name'] as String? ?? '',
        value: json['value'] as String? ?? '',
        inline: json['inline'] as bool? ?? false,
      );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DiscordEmbedField &&
          runtimeType == other.runtimeType &&
          name == other.name &&
          value == other.value &&
          inline == other.inline;

  @override
  int get hashCode => Object.hash(name, value, inline);
}

/// Rich Embed object for Discord messages.
class DiscordEmbed {
  final String? title;
  final String? description;
  final String? url;
  final int? color;
  final List<DiscordEmbedField> fields;
  final String? footerText;
  final String? timestamp;

  DiscordEmbed({
    this.title,
    this.description,
    this.url,
    this.color,
    this.fields = const <DiscordEmbedField>[],
    this.footerText,
    this.timestamp,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    if (title != null && title!.trim().isNotEmpty) 'title': title!.trim(),
    if (description != null && description!.trim().isNotEmpty)
      'description': description!.trim(),
    if (url != null && url!.trim().isNotEmpty) 'url': url!.trim(),
    if (color != null) 'color': color,
    if (fields.isNotEmpty)
      'fields': fields.map((DiscordEmbedField f) => f.toJson()).toList(),
    if (footerText != null && footerText!.trim().isNotEmpty)
      'footer': <String, dynamic>{'text': footerText!.trim()},
    if (timestamp != null) 'timestamp': timestamp,
  };

  factory DiscordEmbed.fromJson(Map<String, dynamic> json) {
    List<DiscordEmbedField> parsedFields = const <DiscordEmbedField>[];
    final dynamic rawFields = json['fields'];
    if (rawFields is List) {
      parsedFields = rawFields
          .whereType<Map<String, dynamic>>()
          .map((Map<String, dynamic> f) => DiscordEmbedField.fromJson(f))
          .toList();
    }

    String? footer;
    final dynamic footerObj = json['footer'];
    if (footerObj is Map<String, dynamic>) {
      footer = footerObj['text'] as String?;
    } else if (json['footerText'] is String) {
      footer = json['footerText'] as String;
    }

    return DiscordEmbed(
      title: json['title'] as String?,
      description: json['description'] as String?,
      url: json['url'] as String?,
      color: json['color'] as int?,
      fields: parsedFields,
      footerText: footer,
      timestamp: json['timestamp'] as String?,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DiscordEmbed &&
          runtimeType == other.runtimeType &&
          title == other.title &&
          description == other.description &&
          url == other.url &&
          color == other.color &&
          footerText == other.footerText &&
          timestamp == other.timestamp;

  @override
  int get hashCode =>
      Object.hash(title, description, url, color, footerText, timestamp);
}

/// Discord webhook message payload.
class DiscordMessage {
  final String? content;
  final String? username;
  final String? avatarUrl;
  final bool tts;
  final List<DiscordEmbed> embeds;

  /// Creates a [DiscordMessage] with validation (§6).
  ///
  /// Throws [ArgumentError] if both [content] and [embeds] are empty.
  DiscordMessage({
    this.content,
    this.username,
    this.avatarUrl,
    this.tts = false,
    this.embeds = const <DiscordEmbed>[],
  }) {
    final bool hasContent = content != null && content!.trim().isNotEmpty;
    if (!hasContent && embeds.isEmpty) {
      throw ArgumentError(
        'Discord message must contain either non-empty content or at least one embed.',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    if (content != null && content!.trim().isNotEmpty)
      'content': content!.trim(),
    if (username != null && username!.trim().isNotEmpty)
      'username': username!.trim(),
    if (avatarUrl != null && avatarUrl!.trim().isNotEmpty)
      'avatar_url': avatarUrl!.trim(),
    'tts': tts,
    if (embeds.isNotEmpty)
      'embeds': embeds.map((DiscordEmbed e) => e.toJson()).toList(),
  };

  factory DiscordMessage.fromJson(Map<String, dynamic> json) {
    List<DiscordEmbed> parsedEmbeds = const <DiscordEmbed>[];
    final dynamic rawEmbeds = json['embeds'];
    if (rawEmbeds is List) {
      parsedEmbeds = rawEmbeds
          .whereType<Map<String, dynamic>>()
          .map((Map<String, dynamic> e) => DiscordEmbed.fromJson(e))
          .toList();
    }

    return DiscordMessage(
      content: json['content'] as String?,
      username: json['username'] as String?,
      avatarUrl: json['avatar_url'] as String? ?? json['avatarUrl'] as String?,
      tts: json['tts'] as bool? ?? false,
      embeds: parsedEmbeds,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DiscordMessage &&
          runtimeType == other.runtimeType &&
          content == other.content &&
          username == other.username &&
          avatarUrl == other.avatarUrl &&
          tts == other.tts;

  @override
  int get hashCode => Object.hash(content, username, avatarUrl, tts);

  @override
  String toString() =>
      'DiscordMessage(hasContent: ${content != null}, embedsCount: ${embeds.length})';
}
