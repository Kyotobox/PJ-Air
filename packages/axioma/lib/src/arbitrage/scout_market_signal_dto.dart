// 🎯 Contrato Canónico de Señales de Mercado y Telemetría de Canales Oscuros (Scout)
// Conforme a Doctrinas: §4 Zero Mocks, §6 Sad Paths Mandatorios, §39 Pure Dart Core, §45 Soberanía Offline-First.

import 'arbitrage_contracts.dart';

/// Canales de telemetría e ingesta soportados por Scout.
enum ScoutChannel {
  whatsapp('WHATSAPP'),
  telegram('TELEGRAM'),
  discord('DISCORD'),
  web('WEB');

  final String value;
  const ScoutChannel(this.value);

  static ScoutChannel fromValue(String raw) {
    final clean = raw.trim().toUpperCase();
    for (final c in ScoutChannel.values) {
      if (c.value == clean || c.name.toUpperCase() == clean) return c;
    }
    throw ArbitrageContractException(
      'Canal de Scout no reconocido: "$raw". Válidos: ${ScoutChannel.values.map((e) => e.value).join(", ")}',
      errorCode: ArbitrageContractErrorCodes.invalidChannel,
      field: 'channel',
      rejectedValue: raw,
    );
  }
}

/// DTO Canónico para Señales de Precio e Inteligencia de Mercado capturadas por Scout.
///
/// Modela mensajes capturados pasivamente en canales oscuros (grupos de mayoristas),
/// enriquecidos con SKUs detectados, costos mayoristas y nivel de confianza de extracción.
class ScoutMarketSignalDTO {
  final String signalId;
  final ScoutChannel channel;
  final String sourceGroupId;
  final String senderHash;
  final String rawText;
  final String extractedSku;
  final String productTitle;
  final String category;
  final double wholesaleCost;
  final String currency;
  final bool inStock;
  final double confidenceScore;
  final DateTime capturedAt;
  final Map<String, dynamic> metadata;

  ScoutMarketSignalDTO._({
    required this.signalId,
    required this.channel,
    required this.sourceGroupId,
    required this.senderHash,
    required this.rawText,
    required this.extractedSku,
    required this.productTitle,
    required this.category,
    required this.wholesaleCost,
    required this.currency,
    required this.inStock,
    required this.confidenceScore,
    required this.capturedAt,
    required this.metadata,
  });

  /// Factory constructor con validación estricta de invariantes (§4, §6).
  factory ScoutMarketSignalDTO.validated({
    required String signalId,
    required dynamic channel,
    required String sourceGroupId,
    required String senderHash,
    required String rawText,
    required String extractedSku,
    required String productTitle,
    required String category,
    required double wholesaleCost,
    String currency = 'USD',
    bool inStock = true,
    double confidenceScore = 1.0,
    DateTime? capturedAt,
    Map<String, dynamic>? metadata,
  }) {
    final cleanSignalId = signalId.trim();
    if (cleanSignalId.isEmpty) {
      throw const ArbitrageContractException(
        'signalId no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'signalId',
      );
    }

    final cleanSourceGroupId = sourceGroupId.trim();
    if (cleanSourceGroupId.isEmpty) {
      throw const ArbitrageContractException(
        'sourceGroupId no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'sourceGroupId',
      );
    }

    final cleanSenderHash = senderHash.trim();
    if (cleanSenderHash.isEmpty) {
      throw const ArbitrageContractException(
        'senderHash no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'senderHash',
      );
    }

    final cleanRawText = rawText.trim();
    if (cleanRawText.isEmpty) {
      throw const ArbitrageContractException(
        'rawText no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'rawText',
      );
    }

    final cleanExtractedSku = extractedSku.trim().toUpperCase();
    if (cleanExtractedSku.isEmpty) {
      throw const ArbitrageContractException(
        'extractedSku no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'extractedSku',
      );
    }

    final cleanProductTitle = productTitle.trim();
    if (cleanProductTitle.isEmpty) {
      throw const ArbitrageContractException(
        'productTitle no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'productTitle',
      );
    }

    final cleanCategory = category.trim().toUpperCase();
    if (cleanCategory.isEmpty) {
      throw const ArbitrageContractException(
        'category no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'category',
      );
    }

    if (wholesaleCost <= 0.0) {
      throw ArbitrageContractException(
        'wholesaleCost debe ser estrictamente positivo',
        errorCode: ArbitrageContractErrorCodes.negativePrice,
        field: 'wholesaleCost',
        rejectedValue: wholesaleCost,
      );
    }

    final normalizedCurrency = currency.trim().toUpperCase();
    const validCurrencies = <String>{'USD', 'VES', 'USDT', 'BRL', 'COP'};
    if (!validCurrencies.contains(normalizedCurrency)) {
      throw ArbitrageContractException(
        'Moneda no soportada: $currency. Válidas: ${validCurrencies.join(", ")}',
        errorCode: ArbitrageContractErrorCodes.invalidCurrency,
        field: 'currency',
        rejectedValue: currency,
      );
    }

    if (confidenceScore < 0.0 || confidenceScore > 1.0) {
      throw ArbitrageContractException(
        'confidenceScore debe estar entre 0.0 y 1.0',
        errorCode: ArbitrageContractErrorCodes.invalidConfidenceScore,
        field: 'confidenceScore',
        rejectedValue: confidenceScore,
      );
    }

    final resolvedChannel = channel is ScoutChannel
        ? channel
        : ScoutChannel.fromValue(channel.toString());

    return ScoutMarketSignalDTO._(
      signalId: cleanSignalId,
      channel: resolvedChannel,
      sourceGroupId: cleanSourceGroupId,
      senderHash: cleanSenderHash,
      rawText: cleanRawText,
      extractedSku: cleanExtractedSku,
      productTitle: cleanProductTitle,
      category: cleanCategory,
      wholesaleCost: wholesaleCost,
      currency: normalizedCurrency,
      inStock: inStock,
      confidenceScore: confidenceScore,
      capturedAt: capturedAt ?? DateTime.now().toUtc(),
      metadata: Map<String, dynamic>.unmodifiable(
        metadata ?? <String, dynamic>{},
      ),
    );
  }

  factory ScoutMarketSignalDTO.fromJson(Map<String, dynamic> json) {
    return ScoutMarketSignalDTO.validated(
      signalId: json['signal_id'] as String? ?? '',
      channel: json['channel'] as String? ?? '',
      sourceGroupId: json['source_group_id'] as String? ?? '',
      senderHash: json['sender_hash'] as String? ?? '',
      rawText: json['raw_text'] as String? ?? '',
      extractedSku: json['extracted_sku'] as String? ?? '',
      productTitle: json['product_title'] as String? ?? '',
      category: json['category'] as String? ?? '',
      wholesaleCost: (json['wholesale_cost'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'USD',
      inStock: json['in_stock'] as bool? ?? true,
      confidenceScore: (json['confidence_score'] as num?)?.toDouble() ?? 1.0,
      capturedAt: json['captured_at'] != null
          ? DateTime.parse(json['captured_at'] as String)
          : null,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() => {
    'signal_id': signalId,
    'channel': channel.value,
    'source_group_id': sourceGroupId,
    'sender_hash': senderHash,
    'raw_text': rawText,
    'extracted_sku': extractedSku,
    'product_title': productTitle,
    'category': category,
    'wholesale_cost': wholesaleCost,
    'currency': currency,
    'in_stock': inStock,
    'confidence_score': confidenceScore,
    'captured_at': capturedAt.toIso8601String(),
    'metadata': metadata,
  };

  /// Calcula el margen y spread de arbitraje si se vende al precio minorista objetivo.
  Map<String, dynamic> calculateArbitrageOpportunity({
    required double targetRetailPrice,
  }) {
    if (targetRetailPrice <= wholesaleCost) {
      return {
        'viable': false,
        'spread_usd': targetRetailPrice - wholesaleCost,
        'margin_percent': 0.0,
        'reason': 'targetRetailPrice inferior o igual al costo mayorista',
      };
    }

    final spread = targetRetailPrice - wholesaleCost;
    final marginPercent = (spread / targetRetailPrice) * 100.0;
    return {
      'viable': marginPercent >= 20.0,
      'spread_usd': double.parse(spread.toStringAsFixed(2)),
      'margin_percent': double.parse(marginPercent.toStringAsFixed(2)),
      'is_high_margin': marginPercent >= 50.0,
    };
  }
}
