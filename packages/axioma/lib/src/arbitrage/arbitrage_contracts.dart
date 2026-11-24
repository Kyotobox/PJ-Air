// 🎯 Contratos Canónicos de Arbitraje Comercial (Telegram ➔ BlueMarket ➔ Studio ➔ Levita WhatsApp)
// Doctrinas: §4 Zero Mocks, §6 Sad Paths, §39 Pure Dart Core, §45 Offline-First.

import 'dart:convert';

/// Errores auditables para contratos de arbitraje (§6).
abstract final class ArbitrageContractErrorCodes {
  static const String emptyField = 'ERR_ARBITRAGE_EMPTY_FIELD';
  static const String negativePrice = 'ERR_ARBITRAGE_NEGATIVE_PRICE';
  static const String invalidCurrency = 'ERR_ARBITRAGE_INVALID_CURRENCY';
  static const String invalidStatus = 'ERR_ARBITRAGE_INVALID_STATUS';
  static const String marginDeficit = 'ERR_ARBITRAGE_MARGIN_DEFICIT';
}

/// Excepción formal para violaciones en contratos de arbitraje (§6).
class ArbitrageContractException extends FormatException {
  final String errorCode;
  final String? field;
  final dynamic rejectedValue;

  const ArbitrageContractException(
    super.message, {
    required this.errorCode,
    this.field,
    this.rejectedValue,
  });

  @override
  String toString() =>
      'ArbitrageContractException[$errorCode]: $message'
      '${field != null ? ' (field: $field)' : ''}';
}

/// DTO para mensajes de proveedores capturados en Telegram (MTProto / Canales).
class SupplierMessageDTO {
  final String messageId;
  final String supplierChatId;
  final String supplierName;
  final String rawText;
  final double? detectedCost;
  final String currency;
  final String? warrantyTerms;
  final DateTime capturedAt;
  final Map<String, dynamic> metadata;

  SupplierMessageDTO._({
    required this.messageId,
    required this.supplierChatId,
    required this.supplierName,
    required this.rawText,
    required this.detectedCost,
    required this.currency,
    required this.warrantyTerms,
    required this.capturedAt,
    required this.metadata,
  });

  factory SupplierMessageDTO.validated({
    required String messageId,
    required String supplierChatId,
    required String supplierName,
    required String rawText,
    double? detectedCost,
    String currency = 'USD',
    String? warrantyTerms,
    DateTime? capturedAt,
    Map<String, dynamic>? metadata,
  }) {
    if (messageId.trim().isEmpty) {
      throw const ArbitrageContractException(
        'messageId no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'messageId',
      );
    }
    if (supplierChatId.trim().isEmpty) {
      throw const ArbitrageContractException(
        'supplierChatId no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'supplierChatId',
      );
    }
    if (rawText.trim().isEmpty) {
      throw const ArbitrageContractException(
        'rawText no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'rawText',
      );
    }
    if (detectedCost != null && detectedCost < 0) {
      throw ArbitrageContractException(
        'detectedCost no puede ser negativo',
        errorCode: ArbitrageContractErrorCodes.negativePrice,
        field: 'detectedCost',
        rejectedValue: detectedCost,
      );
    }

    final normalizedCurrency = currency.trim().toUpperCase();
    if (normalizedCurrency != 'USD' &&
        normalizedCurrency != 'VES' &&
        normalizedCurrency != 'USDT') {
      throw ArbitrageContractException(
        'Moneda no soportada: $currency',
        errorCode: ArbitrageContractErrorCodes.invalidCurrency,
        field: 'currency',
        rejectedValue: currency,
      );
    }

    return SupplierMessageDTO._(
      messageId: messageId.trim(),
      supplierChatId: supplierChatId.trim(),
      supplierName: supplierName.trim().isEmpty
          ? 'PROVEEDOR_ANON'
          : supplierName.trim(),
      rawText: rawText.trim(),
      detectedCost: detectedCost,
      currency: normalizedCurrency,
      warrantyTerms: warrantyTerms?.trim(),
      capturedAt: capturedAt ?? DateTime.now().toUtc(),
      metadata: Map<String, dynamic>.unmodifiable(
        metadata ?? <String, dynamic>{},
      ),
    );
  }

  factory SupplierMessageDTO.fromJson(Map<String, dynamic> json) {
    return SupplierMessageDTO.validated(
      messageId: json['message_id'] as String? ?? '',
      supplierChatId: json['supplier_chat_id'] as String? ?? '',
      supplierName: json['supplier_name'] as String? ?? 'PROVEEDOR_ANON',
      rawText: json['raw_text'] as String? ?? '',
      detectedCost: (json['detected_cost'] as num?)?.toDouble(),
      currency: json['currency'] as String? ?? 'USD',
      warrantyTerms: json['warranty_terms'] as String?,
      capturedAt: json['captured_at'] != null
          ? DateTime.parse(json['captured_at'] as String)
          : null,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() => {
    'message_id': messageId,
    'supplier_chat_id': supplierChatId,
    'supplier_name': supplierName,
    'raw_text': rawText,
    if (detectedCost != null) 'detected_cost': detectedCost,
    'currency': currency,
    if (warrantyTerms != null) 'warranty_terms': warrantyTerms,
    'captured_at': capturedAt.toIso8601String(),
    'metadata': metadata,
  };
}

/// DTO de producto normalizado listo para arbitraje comercial.
class ArbitrageProductDTO {
  final String productId;
  final String sku;
  final String title;
  final String category;
  final double wholesaleCostUsd;
  final double retailPriceUsd;
  final double grossMarginPercent;
  final String warrantyPeriod;
  final bool inStock;
  final String? supplierRefId;
  final Map<String, dynamic> deliveryInstructions;

  ArbitrageProductDTO._({
    required this.productId,
    required this.sku,
    required this.title,
    required this.category,
    required this.wholesaleCostUsd,
    required this.retailPriceUsd,
    required this.grossMarginPercent,
    required this.warrantyPeriod,
    required this.inStock,
    required this.supplierRefId,
    required this.deliveryInstructions,
  });

  factory ArbitrageProductDTO.validated({
    required String productId,
    required String sku,
    required String title,
    required String category,
    required double wholesaleCostUsd,
    required double retailPriceUsd,
    String warrantyPeriod = '30 días',
    bool inStock = true,
    String? supplierRefId,
    Map<String, dynamic>? deliveryInstructions,
  }) {
    if (productId.trim().isEmpty) {
      throw const ArbitrageContractException(
        'productId no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'productId',
      );
    }
    if (sku.trim().isEmpty) {
      throw const ArbitrageContractException(
        'sku no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'sku',
      );
    }
    if (title.trim().isEmpty) {
      throw const ArbitrageContractException(
        'title no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'title',
      );
    }
    if (wholesaleCostUsd < 0) {
      throw ArbitrageContractException(
        'wholesaleCostUsd no puede ser negativo',
        errorCode: ArbitrageContractErrorCodes.negativePrice,
        field: 'wholesaleCostUsd',
        rejectedValue: wholesaleCostUsd,
      );
    }
    if (retailPriceUsd <= 0) {
      throw ArbitrageContractException(
        'retailPriceUsd debe ser estrictamente mayor a 0',
        errorCode: ArbitrageContractErrorCodes.negativePrice,
        field: 'retailPriceUsd',
        rejectedValue: retailPriceUsd,
      );
    }
    if (retailPriceUsd < wholesaleCostUsd) {
      throw ArbitrageContractException(
        'retailPriceUsd ($retailPriceUsd) no puede ser menor a wholesaleCostUsd ($wholesaleCostUsd)',
        errorCode: ArbitrageContractErrorCodes.marginDeficit,
        field: 'retailPriceUsd',
        rejectedValue: retailPriceUsd,
      );
    }

    final margin = retailPriceUsd > 0
        ? ((retailPriceUsd - wholesaleCostUsd) / retailPriceUsd) * 100.0
        : 0.0;

    return ArbitrageProductDTO._(
      productId: productId.trim(),
      sku: sku.trim().toUpperCase(),
      title: title.trim(),
      category: category.trim().toUpperCase(),
      wholesaleCostUsd: wholesaleCostUsd,
      retailPriceUsd: retailPriceUsd,
      grossMarginPercent: double.parse(margin.toStringAsFixed(2)),
      warrantyPeriod: warrantyPeriod.trim().isEmpty
          ? '30 días'
          : warrantyPeriod.trim(),
      inStock: inStock,
      supplierRefId: supplierRefId?.trim(),
      deliveryInstructions: Map<String, dynamic>.unmodifiable(
        deliveryInstructions ?? <String, dynamic>{},
      ),
    );
  }

  factory ArbitrageProductDTO.fromJson(Map<String, dynamic> json) {
    return ArbitrageProductDTO.validated(
      productId: json['product_id'] as String? ?? '',
      sku: json['sku'] as String? ?? '',
      title: json['title'] as String? ?? '',
      category: json['category'] as String? ?? 'DIGITAL',
      wholesaleCostUsd: (json['wholesale_cost_usd'] as num?)?.toDouble() ?? 0.0,
      retailPriceUsd: (json['retail_price_usd'] as num?)?.toDouble() ?? 0.0,
      warrantyPeriod: json['warranty_period'] as String? ?? '30 días',
      inStock: json['in_stock'] as bool? ?? true,
      supplierRefId: json['supplier_ref_id'] as String?,
      deliveryInstructions:
          json['delivery_instructions'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() => {
    'product_id': productId,
    'sku': sku,
    'title': title,
    'category': category,
    'wholesale_cost_usd': wholesaleCostUsd,
    'retail_price_usd': retailPriceUsd,
    'gross_margin_percent': grossMarginPercent,
    'warranty_period': warrantyPeriod,
    'in_stock': inStock,
    if (supplierRefId != null) 'supplier_ref_id': supplierRefId,
    'delivery_instructions': deliveryInstructions,
  };
}

/// DTO para la oferta enriquecida lista para despachar en WhatsApp (Levita Engine).
class WhatsAppOfferDTO {
  final String offerId;
  final String productId;
  final String headline;
  final String formattedBody;
  final double priceUsd;
  final double priceVesBcv;
  final double bcvRate;
  final String? creativeAssetUrl;
  final String? creativeAssetLocalPath;
  final String callToActionText;
  final DateTime generatedAt;

  WhatsAppOfferDTO._({
    required this.offerId,
    required this.productId,
    required this.headline,
    required this.formattedBody,
    required this.priceUsd,
    required this.priceVesBcv,
    required this.bcvRate,
    required this.creativeAssetUrl,
    required this.creativeAssetLocalPath,
    required this.callToActionText,
    required this.generatedAt,
  });

  factory WhatsAppOfferDTO.validated({
    required String offerId,
    required String productId,
    required String headline,
    required String formattedBody,
    required double priceUsd,
    required double bcvRate,
    double? priceVesBcv,
    String? creativeAssetUrl,
    String? creativeAssetLocalPath,
    String callToActionText =
        'Escribe COMPRAR para activar tu cuenta inmediatamente 🚀',
    DateTime? generatedAt,
  }) {
    if (offerId.trim().isEmpty) {
      throw const ArbitrageContractException(
        'offerId no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'offerId',
      );
    }
    if (productId.trim().isEmpty) {
      throw const ArbitrageContractException(
        'productId no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'productId',
      );
    }
    if (headline.trim().isEmpty) {
      throw const ArbitrageContractException(
        'headline no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'headline',
      );
    }
    if (priceUsd <= 0) {
      throw ArbitrageContractException(
        'priceUsd debe ser mayor a cero',
        errorCode: ArbitrageContractErrorCodes.negativePrice,
        field: 'priceUsd',
        rejectedValue: priceUsd,
      );
    }
    if (bcvRate <= 0) {
      throw ArbitrageContractException(
        'bcvRate debe ser mayor a cero',
        errorCode: ArbitrageContractErrorCodes.negativePrice,
        field: 'bcvRate',
        rejectedValue: bcvRate,
      );
    }

    final calculatedVes = priceVesBcv ?? (priceUsd * bcvRate);

    return WhatsAppOfferDTO._(
      offerId: offerId.trim(),
      productId: productId.trim(),
      headline: headline.trim(),
      formattedBody: formattedBody.trim(),
      priceUsd: priceUsd,
      priceVesBcv: double.parse(calculatedVes.toStringAsFixed(2)),
      bcvRate: bcvRate,
      creativeAssetUrl: creativeAssetUrl?.trim(),
      creativeAssetLocalPath: creativeAssetLocalPath?.trim(),
      callToActionText: callToActionText.trim(),
      generatedAt: generatedAt ?? DateTime.now().toUtc(),
    );
  }

  factory WhatsAppOfferDTO.fromJson(Map<String, dynamic> json) {
    return WhatsAppOfferDTO.validated(
      offerId: json['offer_id'] as String? ?? '',
      productId: json['product_id'] as String? ?? '',
      headline: json['headline'] as String? ?? '',
      formattedBody: json['formatted_body'] as String? ?? '',
      priceUsd: (json['price_usd'] as num?)?.toDouble() ?? 0.0,
      bcvRate: (json['bcv_rate'] as num?)?.toDouble() ?? 1.0,
      priceVesBcv: (json['price_ves_bcv'] as num?)?.toDouble(),
      creativeAssetUrl: json['creative_asset_url'] as String?,
      creativeAssetLocalPath: json['creative_asset_local_path'] as String?,
      callToActionText:
          json['call_to_action_text'] as String? ??
          'Escribe COMPRAR para activar tu cuenta inmediatamente 🚀',
      generatedAt: json['generated_at'] != null
          ? DateTime.parse(json['generated_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'offer_id': offerId,
    'product_id': productId,
    'headline': headline,
    'formatted_body': formattedBody,
    'price_usd': priceUsd,
    'price_ves_bcv': priceVesBcv,
    'bcv_rate': bcvRate,
    if (creativeAssetUrl != null) 'creative_asset_url': creativeAssetUrl,
    if (creativeAssetLocalPath != null)
      'creative_asset_local_path': creativeAssetLocalPath,
    'call_to_action_text': callToActionText,
    'generated_at': generatedAt.toIso8601String(),
  };
}

/// DTO para cumplimiento y entrega de credenciales digitales.
class DeliveryFulfillmentDTO {
  final String orderId;
  final String customerWaId;
  final String productId;
  final Map<String, String> credentials;
  final DateTime fulfilledAt;
  final String securityChecksum;

  DeliveryFulfillmentDTO._({
    required this.orderId,
    required this.customerWaId,
    required this.productId,
    required this.credentials,
    required this.fulfilledAt,
    required this.securityChecksum,
  });

  factory DeliveryFulfillmentDTO.validated({
    required String orderId,
    required String customerWaId,
    required String productId,
    required Map<String, String> credentials,
    DateTime? fulfilledAt,
  }) {
    if (orderId.trim().isEmpty) {
      throw const ArbitrageContractException(
        'orderId no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'orderId',
      );
    }
    if (customerWaId.trim().isEmpty) {
      throw const ArbitrageContractException(
        'customerWaId no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'customerWaId',
      );
    }
    if (credentials.isEmpty) {
      throw const ArbitrageContractException(
        'credentials no puede estar vacío',
        errorCode: ArbitrageContractErrorCodes.emptyField,
        field: 'credentials',
      );
    }

    final ts = fulfilledAt ?? DateTime.now().toUtc();
    final rawSign =
        '${orderId.trim()}:${customerWaId.trim()}:${credentials.length}:${ts.millisecondsSinceEpoch}';
    final checksum = base64Url.encode(utf8.encode(rawSign));

    return DeliveryFulfillmentDTO._(
      orderId: orderId.trim(),
      customerWaId: customerWaId.trim(),
      productId: productId.trim(),
      credentials: Map<String, String>.unmodifiable(credentials),
      fulfilledAt: ts,
      securityChecksum: checksum,
    );
  }

  factory DeliveryFulfillmentDTO.fromJson(Map<String, dynamic> json) {
    return DeliveryFulfillmentDTO.validated(
      orderId: json['order_id'] as String? ?? '',
      customerWaId: json['customer_wa_id'] as String? ?? '',
      productId: json['product_id'] as String? ?? '',
      credentials: Map<String, String>.from(json['credentials'] as Map? ?? {}),
      fulfilledAt: json['fulfilled_at'] != null
          ? DateTime.parse(json['fulfilled_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'order_id': orderId,
    'customer_wa_id': customerWaId,
    'product_id': productId,
    'credentials': credentials,
    'fulfilled_at': fulfilledAt.toIso8601String(),
    'security_checksum': securityChecksum,
  };
}
