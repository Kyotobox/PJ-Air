// 🎯 Motor Puente de Pricing y Arbitraje (Telegram ➔ Levita WhatsApp)
// Doctrinas: §4 Zero Mocks, §6 Sad Paths, §39 Pure Dart Core, §45 Offline-First.

import 'arbitrage_contracts.dart';

/// Motor puente de fijación de precios psicológicos y conversión de divisas para arbitraje.
abstract final class PricingArbitrageBridge {
  /// Puntos de precio psicológicos estándar en USD para productos digitales.
  static const List<double> canonicalPricePoints = <double>[
    1.99,
    2.99,
    3.99,
    4.99,
    5.99,
    6.99,
    7.99,
    8.99,
    9.99,
    11.99,
    14.99,
    19.99,
    24.99,
    29.99,
    39.99,
    49.99,
    59.99,
    79.99,
    99.99,
  ];

  /// Calcula el precio de venta sugerido basado en puntos psicológicos y margen objetivo.
  static double resolvePsychologicalPrice({
    required double wholesaleCostUsd,
    double targetMarginRatio = 0.40, // 40% margen por defecto
  }) {
    if (wholesaleCostUsd < 0) {
      throw const ArbitrageContractException(
        'wholesaleCostUsd no puede ser negativo',
        errorCode: ArbitrageContractErrorCodes.negativePrice,
        field: 'wholesaleCostUsd',
      );
    }
    if (targetMarginRatio <= 0 || targetMarginRatio >= 1.0) {
      throw const ArbitrageContractException(
        'targetMarginRatio debe estar entre 0.01 y 0.99',
        errorCode: ArbitrageContractErrorCodes.marginDeficit,
        field: 'targetMarginRatio',
      );
    }

    final minPriceRequired = wholesaleCostUsd / (1.0 - targetMarginRatio);

    for (final price in canonicalPricePoints) {
      if (price >= minPriceRequired) {
        return price;
      }
    }

    // Si supera la tabla canónica, redondear al .99 superior
    final ceilingInt = minPriceRequired.ceil();
    return ceilingInt - 0.01;
  }

  /// Construye un ArbitrageProductDTO certificado a partir de un mensaje de proveedor.
  static ArbitrageProductDTO createProductFromSupplierMessage({
    required SupplierMessageDTO message,
    required String productId,
    required String sku,
    required String title,
    required String category,
    double targetMarginRatio = 0.40,
    String warrantyPeriod = '30 días',
  }) {
    final cost = message.detectedCost ?? 0.0;
    final retailPrice = resolvePsychologicalPrice(
      wholesaleCostUsd: cost,
      targetMarginRatio: targetMarginRatio,
    );

    return ArbitrageProductDTO.validated(
      productId: productId,
      sku: sku,
      title: title,
      category: category,
      wholesaleCostUsd: cost,
      retailPriceUsd: retailPrice,
      warrantyPeriod: message.warrantyTerms ?? warrantyPeriod,
      inStock: true,
      supplierRefId: message.supplierChatId,
      deliveryInstructions: {
        'source_message_id': message.messageId,
        'captured_at': message.capturedAt.toIso8601String(),
      },
    );
  }

  /// Construye la oferta lista para despachar en WhatsApp.
  static WhatsAppOfferDTO createWhatsAppOffer({
    required ArbitrageProductDTO product,
    required double bcvRate,
    String? creativeAssetUrl,
    String? creativeAssetLocalPath,
    String? customCallToAction,
  }) {
    if (bcvRate <= 0) {
      throw const ArbitrageContractException(
        'bcvRate debe ser mayor a cero',
        errorCode: ArbitrageContractErrorCodes.negativePrice,
        field: 'bcvRate',
      );
    }

    final headline = '⚡ ¡OFERTA FLASH: ${product.title.toUpperCase()}!';
    final vesPrice = double.parse(
      (product.retailPriceUsd * bcvRate).toStringAsFixed(2),
    );

    final buffer = StringBuffer()
      ..writeln('*${product.title}*')
      ..writeln('🛡️ Garantía: ${product.warrantyPeriod}')
      ..writeln(
        '💵 Precio: *\$${product.retailPriceUsd.toStringAsFixed(2)} USD*',
      )
      ..writeln('🇻🇪 Tasa Oficial BCV: *Bs. $vesPrice*')
      ..writeln('⚡ Entrega inmediata y soporte 24/7.')
      ..writeln()
      ..writeln('💳 Métodos de Pago: Pago Móvil, Binance Pay, Zinli.');

    return WhatsAppOfferDTO.validated(
      offerId: 'OFFER_${product.sku}_${DateTime.now().millisecondsSinceEpoch}',
      productId: product.productId,
      headline: headline,
      formattedBody: buffer.toString(),
      priceUsd: product.retailPriceUsd,
      bcvRate: bcvRate,
      priceVesBcv: vesPrice,
      creativeAssetUrl: creativeAssetUrl,
      creativeAssetLocalPath: creativeAssetLocalPath,
      callToActionText:
          customCallToAction ??
          'Escribe *COMPRAR* o responde a este mensaje para activar tu cuenta ya.',
    );
  }
}
