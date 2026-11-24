// 🎯 Contratos Canónicos de Sourcing Autónomo de Proveedores y Arbitraje (§4, §6, §39, §45, §47)
// Shared Kernel (packages/axioma) — SPRINT S04 [BLUEMARKET/TELEGRAM-MTPROTO-SOURCING]

/// Estados del ciclo de vida de una oferta o mensaje de proveedor.
abstract final class SupplierOfferStatuses {
  static const String raw = 'RAW';
  static const String parsed = 'PARSED';
  static const String processed = 'PROCESSED';
  static const String rejected = 'REJECTED';
  static const String ignored = 'IGNORED';

  static const Set<String> validStatuses = <String>{
    raw,
    parsed,
    processed,
    rejected,
    ignored,
  };
}

/// DTO Canónico para el mensaje crudo capturado desde canales de proveedores (§39 Pure Dart Core).
class SupplierMessageDTO {
  final String id;
  final String supplierId;
  final String channel;
  final String rawText;
  final String? senderUsername;
  final int? messageId;
  final DateTime receivedAt;
  final Map<String, dynamic> metadata;

  const SupplierMessageDTO._({
    required this.id,
    required this.supplierId,
    required this.channel,
    required this.rawText,
    this.senderUsername,
    this.messageId,
    required this.receivedAt,
    this.metadata = const <String, dynamic>{},
  });

  /// Factory constructor con validaciones estrictas (§4, §6).
  factory SupplierMessageDTO({
    required String id,
    required String supplierId,
    required String channel,
    required String rawText,
    String? senderUsername,
    int? messageId,
    required DateTime receivedAt,
    Map<String, dynamic>? metadata,
  }) {
    final String cleanId = id.trim();
    if (cleanId.isEmpty) {
      throw ArgumentError.value(id, 'id', 'id no puede estar vacío');
    }

    final String cleanSupplier = supplierId.trim();
    if (cleanSupplier.isEmpty) {
      throw ArgumentError.value(
        supplierId,
        'supplierId',
        'supplierId no puede estar vacío',
      );
    }

    final String cleanChannel = channel.trim();
    if (cleanChannel.isEmpty) {
      throw ArgumentError.value(
        channel,
        'channel',
        'channel no puede estar vacío',
      );
    }

    final String cleanText = rawText.trim();
    if (cleanText.isEmpty) {
      throw ArgumentError.value(
        rawText,
        'rawText',
        'rawText no puede estar vacío',
      );
    }

    final String? cleanUsername = senderUsername?.trim();
    final String? finalUsername =
        (cleanUsername != null && cleanUsername.isNotEmpty)
        ? cleanUsername
        : null;

    return SupplierMessageDTO._(
      id: cleanId,
      supplierId: cleanSupplier,
      channel: cleanChannel,
      rawText: cleanText,
      senderUsername: finalUsername,
      messageId: messageId,
      receivedAt: receivedAt,
      metadata: metadata != null
          ? Map<String, dynamic>.unmodifiable(metadata)
          : const <String, dynamic>{},
    );
  }

  factory SupplierMessageDTO.fromJson(Map<String, dynamic> json) {
    final dynamic idRaw = json['id'];
    final dynamic supplierRaw = json['supplierId'] ?? json['supplier_id'];
    final dynamic channelRaw = json['channel'];
    final dynamic textRaw = json['rawText'] ?? json['raw_text'];
    final dynamic usernameRaw =
        json['senderUsername'] ?? json['sender_username'];
    final dynamic messageIdRaw = json['messageId'] ?? json['message_id'];
    final dynamic receivedAtRaw = json['receivedAt'] ?? json['received_at'];
    final dynamic metaRaw = json['metadata'];

    if (idRaw is! String) {
      throw ArgumentError('id debe ser un String no nulo');
    }
    if (supplierRaw is! String) {
      throw ArgumentError('supplierId debe ser un String no nulo');
    }
    if (channelRaw is! String) {
      throw ArgumentError('channel debe ser un String no nulo');
    }
    if (textRaw is! String) {
      throw ArgumentError('rawText debe ser un String no nulo');
    }
    if (receivedAtRaw is! String) {
      throw ArgumentError('receivedAt debe ser un String ISO 8601');
    }

    return SupplierMessageDTO(
      id: idRaw,
      supplierId: supplierRaw,
      channel: channelRaw,
      rawText: textRaw,
      senderUsername: usernameRaw as String?,
      messageId: messageIdRaw is num ? messageIdRaw.toInt() : null,
      receivedAt: DateTime.parse(receivedAtRaw),
      metadata: metaRaw is Map<String, dynamic>
          ? Map<String, dynamic>.from(metaRaw)
          : null,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'supplierId': supplierId,
    'channel': channel,
    'rawText': rawText,
    if (senderUsername != null) 'senderUsername': senderUsername,
    if (messageId != null) 'messageId': messageId,
    'receivedAt': receivedAt.toUtc().toIso8601String(),
    'metadata': metadata,
  };

  SupplierMessageDTO copyWith({
    String? id,
    String? supplierId,
    String? channel,
    String? rawText,
    String? senderUsername,
    int? messageId,
    DateTime? receivedAt,
    Map<String, dynamic>? metadata,
  }) {
    return SupplierMessageDTO(
      id: id ?? this.id,
      supplierId: supplierId ?? this.supplierId,
      channel: channel ?? this.channel,
      rawText: rawText ?? this.rawText,
      senderUsername: senderUsername ?? this.senderUsername,
      messageId: messageId ?? this.messageId,
      receivedAt: receivedAt ?? this.receivedAt,
      metadata: metadata ?? this.metadata,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! SupplierMessageDTO) return false;
    return other.id == id &&
        other.supplierId == supplierId &&
        other.channel == channel &&
        other.rawText == rawText &&
        other.senderUsername == senderUsername &&
        other.messageId == messageId &&
        other.receivedAt == receivedAt;
  }

  @override
  int get hashCode => Object.hash(
    id,
    supplierId,
    channel,
    rawText,
    senderUsername,
    messageId,
    receivedAt,
  );

  @override
  String toString() =>
      'SupplierMessageDTO(id: $id, supplierId: $supplierId, channel: $channel, messageId: $messageId)';
}

/// DTO Canónico para un producto identificado y evaluado para arbitraje (§39 Pure Dart Core).
class ArbitrageProductDTO {
  final String id;
  final String title;
  final String category;
  final double sourcingCostUsd;
  final double suggestedSalePriceUsd;
  final String? warrantyDescription;
  final int? warrantyDays;
  final String supplierId;
  final String? sourceMessageId;
  final double confidenceScore;
  final DateTime extractedAt;
  final Map<String, dynamic> metadata;

  const ArbitrageProductDTO._({
    required this.id,
    required this.title,
    required this.category,
    required this.sourcingCostUsd,
    required this.suggestedSalePriceUsd,
    this.warrantyDescription,
    this.warrantyDays,
    required this.supplierId,
    this.sourceMessageId,
    required this.confidenceScore,
    required this.extractedAt,
    this.metadata = const <String, dynamic>{},
  });

  /// Factory constructor con validaciones exhaustivas (§4, §6).
  factory ArbitrageProductDTO({
    required String id,
    required String title,
    String category = 'digital_goods',
    required double sourcingCostUsd,
    required double suggestedSalePriceUsd,
    String? warrantyDescription,
    int? warrantyDays,
    required String supplierId,
    String? sourceMessageId,
    double confidenceScore = 1.0,
    required DateTime extractedAt,
    Map<String, dynamic>? metadata,
  }) {
    final String cleanId = id.trim();
    if (cleanId.isEmpty) {
      throw ArgumentError.value(id, 'id', 'id no puede estar vacío');
    }

    final String cleanTitle = title.trim();
    if (cleanTitle.isEmpty) {
      throw ArgumentError.value(title, 'title', 'title no puede estar vacío');
    }

    if (sourcingCostUsd < 0.0) {
      throw ArgumentError.value(
        sourcingCostUsd,
        'sourcingCostUsd',
        'sourcingCostUsd no puede ser negativo',
      );
    }

    if (suggestedSalePriceUsd < 0.0) {
      throw ArgumentError.value(
        suggestedSalePriceUsd,
        'suggestedSalePriceUsd',
        'suggestedSalePriceUsd no puede ser negativo',
      );
    }

    if (warrantyDays != null && warrantyDays < 0) {
      throw ArgumentError.value(
        warrantyDays,
        'warrantyDays',
        'warrantyDays no puede ser negativo',
      );
    }

    final String cleanSupplier = supplierId.trim();
    if (cleanSupplier.isEmpty) {
      throw ArgumentError.value(
        supplierId,
        'supplierId',
        'supplierId no puede estar vacío',
      );
    }

    if (confidenceScore < 0.0 || confidenceScore > 1.0) {
      throw ArgumentError.value(
        confidenceScore,
        'confidenceScore',
        'confidenceScore debe estar comprendido entre 0.0 y 1.0',
      );
    }

    final String cleanCat = category.trim().isEmpty
        ? 'digital_goods'
        : category.trim();

    return ArbitrageProductDTO._(
      id: cleanId,
      title: cleanTitle,
      category: cleanCat,
      sourcingCostUsd: sourcingCostUsd,
      suggestedSalePriceUsd: suggestedSalePriceUsd,
      warrantyDescription: warrantyDescription?.trim(),
      warrantyDays: warrantyDays,
      supplierId: cleanSupplier,
      sourceMessageId: sourceMessageId?.trim(),
      confidenceScore: confidenceScore,
      extractedAt: extractedAt,
      metadata: metadata != null
          ? Map<String, dynamic>.unmodifiable(metadata)
          : const <String, dynamic>{},
    );
  }

  /// Margen bruto en USD.
  double get grossMarginUsd => suggestedSalePriceUsd - sourcingCostUsd;

  /// Margen porcentual sobre el precio de venta sugerido.
  double get marginPercentage => suggestedSalePriceUsd > 0.0
      ? (grossMarginUsd / suggestedSalePriceUsd) * 100.0
      : 0.0;

  factory ArbitrageProductDTO.fromJson(Map<String, dynamic> json) {
    final dynamic idRaw = json['id'];
    final dynamic titleRaw = json['title'];
    final dynamic catRaw = json['category'];
    final dynamic costRaw =
        json['sourcingCostUsd'] ?? json['sourcing_cost_usd'];
    final dynamic saleRaw =
        json['suggestedSalePriceUsd'] ?? json['suggested_sale_price_usd'];
    final dynamic warDescRaw =
        json['warrantyDescription'] ?? json['warranty_description'];
    final dynamic warDaysRaw = json['warrantyDays'] ?? json['warranty_days'];
    final dynamic suppRaw = json['supplierId'] ?? json['supplier_id'];
    final dynamic srcRaw = json['sourceMessageId'] ?? json['source_message_id'];
    final dynamic confRaw = json['confidenceScore'] ?? json['confidence_score'];
    final dynamic dateRaw = json['extractedAt'] ?? json['extracted_at'];
    final dynamic metaRaw = json['metadata'];

    if (idRaw is! String) {
      throw ArgumentError('id debe ser un String no nulo');
    }
    if (titleRaw is! String) {
      throw ArgumentError('title debe ser un String no nulo');
    }
    if (costRaw is! num) {
      throw ArgumentError('sourcingCostUsd debe ser un número');
    }
    if (saleRaw is! num) {
      throw ArgumentError('suggestedSalePriceUsd debe ser un número');
    }
    if (suppRaw is! String) {
      throw ArgumentError('supplierId debe ser un String no nulo');
    }
    if (dateRaw is! String) {
      throw ArgumentError('extractedAt debe ser un String ISO 8601');
    }

    return ArbitrageProductDTO(
      id: idRaw,
      title: titleRaw,
      category: catRaw as String? ?? 'digital_goods',
      sourcingCostUsd: costRaw.toDouble(),
      suggestedSalePriceUsd: saleRaw.toDouble(),
      warrantyDescription: warDescRaw as String?,
      warrantyDays: warDaysRaw is num ? warDaysRaw.toInt() : null,
      supplierId: suppRaw,
      sourceMessageId: srcRaw as String?,
      confidenceScore: confRaw is num ? confRaw.toDouble() : 1.0,
      extractedAt: DateTime.parse(dateRaw),
      metadata: metaRaw is Map<String, dynamic>
          ? Map<String, dynamic>.from(metaRaw)
          : null,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'title': title,
    'category': category,
    'sourcingCostUsd': sourcingCostUsd,
    'suggestedSalePriceUsd': suggestedSalePriceUsd,
    'grossMarginUsd': grossMarginUsd,
    'marginPercentage': marginPercentage,
    if (warrantyDescription != null) 'warrantyDescription': warrantyDescription,
    if (warrantyDays != null) 'warrantyDays': warrantyDays,
    'supplierId': supplierId,
    if (sourceMessageId != null) 'sourceMessageId': sourceMessageId,
    'confidenceScore': confidenceScore,
    'extractedAt': extractedAt.toUtc().toIso8601String(),
    'metadata': metadata,
  };

  ArbitrageProductDTO copyWith({
    String? id,
    String? title,
    String? category,
    double? sourcingCostUsd,
    double? suggestedSalePriceUsd,
    String? warrantyDescription,
    int? warrantyDays,
    String? supplierId,
    String? sourceMessageId,
    double? confidenceScore,
    DateTime? extractedAt,
    Map<String, dynamic>? metadata,
  }) {
    return ArbitrageProductDTO(
      id: id ?? this.id,
      title: title ?? this.title,
      category: category ?? this.category,
      sourcingCostUsd: sourcingCostUsd ?? this.sourcingCostUsd,
      suggestedSalePriceUsd:
          suggestedSalePriceUsd ?? this.suggestedSalePriceUsd,
      warrantyDescription: warrantyDescription ?? this.warrantyDescription,
      warrantyDays: warrantyDays ?? this.warrantyDays,
      supplierId: supplierId ?? this.supplierId,
      sourceMessageId: sourceMessageId ?? this.sourceMessageId,
      confidenceScore: confidenceScore ?? this.confidenceScore,
      extractedAt: extractedAt ?? this.extractedAt,
      metadata: metadata ?? this.metadata,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! ArbitrageProductDTO) return false;
    return other.id == id &&
        other.title == title &&
        other.category == category &&
        other.sourcingCostUsd == sourcingCostUsd &&
        other.suggestedSalePriceUsd == suggestedSalePriceUsd &&
        other.warrantyDescription == warrantyDescription &&
        other.warrantyDays == warrantyDays &&
        other.supplierId == supplierId &&
        other.sourceMessageId == sourceMessageId &&
        other.confidenceScore == confidenceScore &&
        other.extractedAt == extractedAt;
  }

  @override
  int get hashCode => Object.hash(
    id,
    title,
    category,
    sourcingCostUsd,
    suggestedSalePriceUsd,
    warrantyDescription,
    warrantyDays,
    supplierId,
    sourceMessageId,
    confidenceScore,
    extractedAt,
  );

  @override
  String toString() =>
      'ArbitrageProductDTO(id: $id, title: $title, cost: \$$sourcingCostUsd, sale: \$$suggestedSalePriceUsd, margin: ${marginPercentage.toStringAsFixed(1)}%)';
}
