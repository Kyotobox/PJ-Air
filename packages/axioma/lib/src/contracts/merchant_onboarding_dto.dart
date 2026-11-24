import 'dart:convert';

/// Contrato canónico Pure Dart para la cualificación y onboarding B2B (§39).
/// Generado por el Agente Socrático de Marketing tras el diagnóstico comercial.
class MerchantOnboardingDTO {
  /// Identificador único o slug del comercio (ej. 'burger-palace').
  final String merchantId;

  /// Nombre comercial o marca del negocio.
  final String businessName;

  /// Código de país ISO 3166-1 alfa-2 (ej. 'VE', 'CO', 'MX').
  final String countryCode;

  /// Número de teléfono en formato internacional E.164 (ej. '+584121234567').
  final String phoneNumber;

  /// Categoría del comercio ('restaurant', 'retail', 'pharmacy', 'services', 'other').
  final String category;

  /// Estimación de pedidos o transacciones diarias diagnosticadas.
  final int dailyOrderVolume;

  /// Resumen del dolor o fricción principal detectado durante el diálogo socrático.
  final String currentFriction;

  /// Subdominio asignado o propuesto para el catálogo PWA (ej. 'burgerpalace' para *.lev.st).
  final String subdomain;

  /// Timestamp de creación del onboarding en formato UTC.
  final DateTime createdAt;

  MerchantOnboardingDTO({
    required this.merchantId,
    required this.businessName,
    required this.countryCode,
    required this.phoneNumber,
    required this.category,
    required this.dailyOrderVolume,
    required this.currentFriction,
    required this.subdomain,
    DateTime? createdAt,
  }) : createdAt = (createdAt ?? DateTime.now()).toUtc() {
    _validate();
  }

  void _validate() {
    if (merchantId.trim().isEmpty) {
      throw ArgumentError.value(
        merchantId,
        'merchantId',
        'El identificador del comercio no puede estar vacío.',
      );
    }
    if (businessName.trim().isEmpty) {
      throw ArgumentError.value(
        businessName,
        'businessName',
        'El nombre comercial no puede estar vacío.',
      );
    }
    final String cleanCountry = countryCode.trim().toUpperCase();
    if (cleanCountry.length != 2) {
      throw ArgumentError.value(
        countryCode,
        'countryCode',
        'El código de país debe ser ISO 3166-1 alfa-2 de 2 caracteres.',
      );
    }
    if (phoneNumber.trim().isEmpty || !phoneNumber.startsWith('+')) {
      throw ArgumentError.value(
        phoneNumber,
        'phoneNumber',
        'El número de teléfono debe estar en formato internacional E.164 (iniciando con +).',
      );
    }
    if (category.trim().isEmpty) {
      throw ArgumentError.value(
        category,
        'category',
        'La categoría comercial no puede estar vacía.',
      );
    }
    if (dailyOrderVolume < 0) {
      throw ArgumentError.value(
        dailyOrderVolume,
        'dailyOrderVolume',
        'El volumen diario de pedidos no puede ser negativo.',
      );
    }
    if (currentFriction.trim().isEmpty) {
      throw ArgumentError.value(
        currentFriction,
        'currentFriction',
        'La descripción de la fricción diagnosticada no puede estar vacía.',
      );
    }
    if (subdomain.trim().isEmpty ||
        !RegExp(r'^[a-z0-9-]+$').hasMatch(subdomain.trim())) {
      throw ArgumentError.value(
        subdomain,
        'subdomain',
        'El subdominio debe contener únicamente letras minúsculas, números o guiones.',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'merchant_id': merchantId.trim(),
    'business_name': businessName.trim(),
    'country_code': countryCode.trim().toUpperCase(),
    'phone_number': phoneNumber.trim(),
    'category': category.trim().toLowerCase(),
    'daily_order_volume': dailyOrderVolume,
    'current_friction': currentFriction.trim(),
    'subdomain': subdomain.trim().toLowerCase(),
    'created_at': createdAt.toIso8601String(),
  };

  factory MerchantOnboardingDTO.fromJson(Map<String, dynamic> json) {
    return MerchantOnboardingDTO(
      merchantId: json['merchant_id'] as String? ?? '',
      businessName: json['business_name'] as String? ?? '',
      countryCode: json['country_code'] as String? ?? '',
      phoneNumber: json['phone_number'] as String? ?? '',
      category: json['category'] as String? ?? '',
      dailyOrderVolume: json['daily_order_volume'] as int? ?? 0,
      currentFriction: json['current_friction'] as String? ?? '',
      subdomain: json['subdomain'] as String? ?? '',
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : null,
    );
  }

  String toJsonString({bool pretty = false}) {
    if (pretty) {
      return const JsonEncoder.withIndent('  ').convert(toJson());
    }
    return jsonEncode(toJson());
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MerchantOnboardingDTO &&
          runtimeType == other.runtimeType &&
          merchantId == other.merchantId &&
          businessName == other.businessName &&
          countryCode == other.countryCode &&
          phoneNumber == other.phoneNumber &&
          subdomain == other.subdomain;

  @override
  int get hashCode => Object.hash(
    merchantId,
    businessName,
    countryCode,
    phoneNumber,
    subdomain,
  );

  @override
  String toString() =>
      'MerchantOnboardingDTO(id: $merchantId, name: $businessName, subdomain: $subdomain.lev.st)';
}
