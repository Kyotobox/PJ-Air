import 'dart:convert';

/// Contrato canónico Pure Dart para ofertas comerciales y carritos en WhatsApp (§39).
/// Totalmente agnóstico y multimoneda (soporta USD, VES BCV, COP).
class WhatsAppOfferDTO {
  /// Identificador único de la oferta o ítem de catálogo.
  final String offerId;

  /// Título comercial del producto o activo.
  final String title;

  /// Descripción corta o viñeta de venta.
  final String description;

  /// Código ISO de la moneda base ('USD', 'VES', 'COP', etc.).
  final String currency;

  /// Precio numérico en la moneda base (> 0.0).
  final double basePrice;

  /// Moneda secundaria para cotización dual (ej. 'VES' cuando base es 'USD').
  final String? secondaryCurrency;

  /// Tasa de cambio de referencia respecto a la moneda secundaria (ej. tasa BCV).
  final double? exchangeRate;

  /// URL de checkout directo o catálogo PWA (*.lev.st o bluemarket.app).
  final String checkoutUrl;

  /// URL de la imagen promocional o portada en Cloudflare R2 (opcional).
  final String? imageUrl;

  /// Indica si es un activo digital (sin flete ni stock físico) o bien tangible.
  final bool isDigital;

  /// Call to action personalizado (opcional)
  final String? customCta;
  final String? customProductId;

  WhatsAppOfferDTO({
    required this.offerId,
    required this.title,
    required this.description,
    required this.currency,
    required this.basePrice,
    this.secondaryCurrency,
    this.exchangeRate,
    required this.checkoutUrl,
    this.imageUrl,
    this.isDigital = false,
    this.customCta,
    this.customProductId,
  }) {
    _validate();
  }

  void _validate() {
    if (offerId.trim().isEmpty) {
      throw ArgumentError.value(
        offerId,
        'offerId',
        'El offerId no puede estar vacío.',
      );
    }
    if (title.trim().isEmpty) {
      throw ArgumentError.value(
        title,
        'title',
        'El título no puede estar vacío.',
      );
    }
    if (description.trim().isEmpty) {
      throw ArgumentError.value(
        description,
        'description',
        'La descripción no puede estar vacía.',
      );
    }
    if (currency.trim().isEmpty) {
      throw ArgumentError.value(
        currency,
        'currency',
        'La moneda base no puede estar vacía.',
      );
    }
    if (basePrice <= 0.0) {
      throw ArgumentError.value(
        basePrice,
        'basePrice',
        'El precio base debe ser mayor a cero.',
      );
    }
    if (exchangeRate != null && exchangeRate! <= 0.0) {
      throw ArgumentError.value(
        exchangeRate,
        'exchangeRate',
        'La tasa de cambio debe ser mayor a cero si se especifica.',
      );
    }
    if (checkoutUrl.trim().isEmpty || !checkoutUrl.startsWith('http')) {
      throw ArgumentError.value(
        checkoutUrl,
        'checkoutUrl',
        'La URL de checkout debe ser una URL válida que inicie con http/https.',
      );
    }
  }

  /// Compatibility getters (§58, §60)
  String get productId => customProductId ?? offerId;
  String get headline => title;
  double get priceUsd => basePrice;
  double get bcvRate => exchangeRate ?? 0.0;
  String get formattedBody => description;
  double get priceVesBcv =>
      convertedPrice ?? (basePrice * (exchangeRate ?? 0.0));
  String get callToActionText => customCta ?? 'Comprar Ahora';

  /// Calcula el precio convertido en la moneda secundaria (si hay tasa definida).
  double? get convertedPrice {
    if (exchangeRate != null && exchangeRate! > 0.0) {
      return double.parse((basePrice * exchangeRate!).toStringAsFixed(2));
    }
    return null;
  }

  factory WhatsAppOfferDTO.validated({
    String offerId = '',
    String title = '',
    String description = '',
    String? formattedBody,
    String currency = 'USD',
    double basePrice = 0.0,
    String? secondaryCurrency,
    double? exchangeRate,
    String checkoutUrl = 'https://lev.st',
    String? imageUrl,
    String? callToActionText,
    bool isDigital = false,
    String? productId,
    String? headline,
    double? priceUsd,
    double? bcvRate,
  }) {
    final finalId = offerId.isNotEmpty
        ? offerId
        : ((productId != null && productId.isNotEmpty)
              ? productId
              : 'OFFER_DEFAULT');
    final finalTitle = title.isNotEmpty
        ? title
        : ((headline != null && headline.isNotEmpty)
              ? headline
              : 'OFERTA DESTACADA');
    final finalDesc = description.isNotEmpty
        ? description
        : ((formattedBody != null && formattedBody.isNotEmpty)
              ? formattedBody
              : 'OFERTA DISPONIBLE');
    final finalPrice = basePrice > 0
        ? basePrice
        : ((priceUsd != null && priceUsd > 0) ? priceUsd : 1.0);
    final finalRate = (exchangeRate != null && exchangeRate > 0)
        ? exchangeRate
        : ((bcvRate != null && bcvRate > 0) ? bcvRate : null);

    return WhatsAppOfferDTO(
      offerId: finalId,
      title: finalTitle,
      description: finalDesc,
      currency: currency,
      basePrice: finalPrice,
      secondaryCurrency: secondaryCurrency,
      exchangeRate: finalRate,
      checkoutUrl: checkoutUrl,
      imageUrl: imageUrl,
      isDigital: isDigital,
      customCta: callToActionText,
      customProductId: productId,
    );
  }

  factory WhatsAppOfferDTO.fromJson(Map<String, dynamic> json) {
    final id =
        json['offer_id'] as String? ?? json['product_id'] as String? ?? '';
    final title = json['title'] as String? ?? json['headline'] as String? ?? '';
    final desc =
        json['description'] as String? ??
        json['formatted_body'] as String? ??
        '';
    final price =
        (json['base_price'] as num?)?.toDouble() ??
        (json['price_usd'] as num?)?.toDouble() ??
        0.0;
    final rate =
        (json['exchange_rate'] as num?)?.toDouble() ??
        (json['bcv_rate'] as num?)?.toDouble();
    final cta =
        json['call_to_action_text'] as String? ??
        json['call_to_action'] as String?;

    return WhatsAppOfferDTO(
      offerId: id,
      title: title,
      description: desc,
      currency: json['currency'] as String? ?? 'USD',
      basePrice: price,
      secondaryCurrency: json['secondary_currency'] as String?,
      exchangeRate: rate,
      checkoutUrl: json['checkout_url'] as String? ?? 'https://lev.st',
      imageUrl: json['image_url'] as String?,
      isDigital: json['is_digital'] as bool? ?? false,
      customCta: cta,
      customProductId: json["product_id"] as String?,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'offer_id': offerId.trim(),
    'title': title.trim(),
    'description': description.trim(),
    'currency': currency.trim().toUpperCase(),
    'base_price': basePrice,
    if (secondaryCurrency != null)
      'secondary_currency': secondaryCurrency!.trim().toUpperCase(),
    if (exchangeRate != null) 'exchange_rate': exchangeRate,
    if (convertedPrice != null) 'converted_price': convertedPrice,
    'checkout_url': checkoutUrl.trim(),
    if (imageUrl != null) 'image_url': imageUrl!.trim(),
    'is_digital': isDigital,
    if (customCta != null) 'call_to_action_text': customCta,
  };

  String toJsonString({bool pretty = false}) {
    if (pretty) {
      return const JsonEncoder.withIndent('  ').convert(toJson());
    }
    return jsonEncode(toJson());
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is WhatsAppOfferDTO &&
          runtimeType == other.runtimeType &&
          offerId == other.offerId &&
          title == other.title &&
          currency == other.currency &&
          basePrice == other.basePrice &&
          checkoutUrl == other.checkoutUrl &&
          isDigital == other.isDigital;

  @override
  int get hashCode =>
      Object.hash(offerId, title, currency, basePrice, checkoutUrl, isDigital);

  @override
  String toString() =>
      'WhatsAppOfferDTO(id: $offerId, title: $title, price: $basePrice $currency, isDigital: $isDigital)';
}
