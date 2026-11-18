/// currency_scale_guard.dart — Guardián de Escala Financiera y Precisión en Céntimos (§4, §6, §39, §56).
///
/// Guardián financiero Pure Dart agnóstico de producto (§39).
/// Protege los flujos de ingesta, tarificación, arbitraje y transacciones contra:
/// - Saltos de orden de magnitud (desbordamientos y subdesbordamientos).
/// - Pérdida de precisión por aritmética flotante IEEE 754.
/// - Violaciones de escala decimal (fracciones de céntimo no permitidas).
///
/// Implementa conversión determinista a céntimos enteros (minor units) conforme a estándares bancarios.
library;

import 'dart:math' as math;

// =============================================================================
// EXCEPCIONES TIPADAS DE ESCALA FINANCIERA (§6 SAD PATH MANDATORIO)
// =============================================================================

/// Excepción base arrojada ante anomalías de escala financiera, precisión o magnitud (§6).
class CurrencyScaleException implements Exception {
  final double? price;
  final int? cents;
  final String currency;
  final String reason;
  final String message;
  final int? scale;

  const CurrencyScaleException({
    this.price,
    this.cents,
    required this.currency,
    required this.reason,
    String? message,
    this.scale,
  }) : message =
           message ??
           'Anomalía de escala financiera para divisa $currency: $reason';

  @override
  String toString() => 'CurrencyScaleException [$reason]: $message';
}

// =============================================================================
// RESULTADO DE VALIDACIÓN INMUTABLE
// =============================================================================

/// Resultado inmutable de una validación de escala financiera y precisión de divisa.
class ScaleValidationResult {
  final bool isValid;
  final String? reason;
  final String? message;
  final int? cents;
  final double? normalizedPrice;
  final int? scale;

  const ScaleValidationResult({
    required this.isValid,
    this.reason,
    this.message,
    this.cents,
    this.normalizedPrice,
    this.scale,
  });

  /// Instancia exitosa de validación.
  factory ScaleValidationResult.valid({
    int? cents,
    double? normalizedPrice,
    int? scale,
  }) => ScaleValidationResult(
    isValid: true,
    cents: cents,
    normalizedPrice: normalizedPrice,
    scale: scale,
  );

  /// Instancia rechazada de validación con motivo y mensaje explícito.
  factory ScaleValidationResult.rejected({
    required String reason,
    required String message,
    int? scale,
  }) => ScaleValidationResult(
    isValid: false,
    reason: reason,
    message: message,
    scale: scale,
  );
}

// =============================================================================
// GUARDIÁN DE ESCALA Y PRECISIÓN FINANCIERA EN CÉNTIMOS (CURRENCY SCALE GUARD)
// =============================================================================

/// Guardián financiero Pure Dart agnóstico de frameworks de UI (§39).
/// Valida escala, magnitud y precisión en céntimos enteros sin acoplamiento a producto (§56).
class CurrencyScaleGuard {
  /// Escala canónica por defecto (posiciones decimales / minor units) por divisa.
  /// La inmensa mayoría opera en escala 2 (céntimos). JPY/CLP operan en escala 0.
  static const Map<String, int> defaultCurrencyScales = <String, int>{
    'USD': 2,
    'EUR': 2,
    'GBP': 2,
    'COP': 2,
    'VES': 2,
    'BRL': 2,
    'MXN': 2,
    'ARS': 2,
    'CAD': 2,
    'AUD': 2,
    'CLP': 0,
    'JPY': 0,
    'USDT': 2,
    'USDC': 2,
  };

  /// Umbrales máximos verosímiles de magnitud nominal para prevenir desbordamientos o errores de coma.
  static const Map<String, double> defaultMaxThresholds = <String, double>{
    'USD': 500000.0,
    'EUR': 500000.0,
    'GBP': 500000.0,
    'CAD': 500000.0,
    'AUD': 500000.0,
    'COP': 5000000000.0,
    'VES': 100000000000.0,
    'BRL': 2500000.0,
    'MXN': 10000000.0,
    'ARS': 500000000.0,
    'CLP': 500000000.0,
    'JPY': 50000000.0,
    'USDT': 500000.0,
    'USDC': 500000.0,
  };

  /// Umbrales mínimos verosímiles de magnitud nominal para prevenir subdesbordamientos o precios nulos.
  static const Map<String, double> defaultMinThresholds = <String, double>{
    'USD': 0.01,
    'EUR': 0.01,
    'GBP': 0.01,
    'CAD': 0.01,
    'AUD': 0.01,
    'COP': 100.0,
    'VES': 1.0,
    'BRL': 0.1,
    'MXN': 0.5,
    'ARS': 1.0,
    'CLP': 10.0,
    'JPY': 1.0,
    'USDT': 0.01,
    'USDC': 0.01,
  };

  /// Obtiene la escala decimal canónica para una divisa (por defecto 2).
  static int getScale(String declaredCurrency) {
    final String curr = declaredCurrency.trim().toUpperCase();
    return defaultCurrencyScales[curr] ?? 2;
  }

  /// Retorna el factor multiplicador entero (ej. 10^scale) para convertir a céntimos.
  static int getScaleFactor(String declaredCurrency) {
    final int scale = getScale(declaredCurrency);
    return math.pow(10, scale).toInt();
  }

  /// Evalúa si el precio presenta una anomalía crítica de magnitud o escala para la divisa declarada.
  ///
  /// Mantiene compatibilidad total con el contrato de gobernanza de DataDictionary.
  static ScaleValidationResult validateScale({
    required double price,
    required String declaredCurrency,
    double? customMaxThreshold,
    double? customMinThreshold,
    bool allowZero = false,
    bool strictScale = false,
  }) {
    if (price.isNaN || price.isInfinite) {
      throw ArgumentError.value(
        price,
        'price',
        'El precio debe ser un número real finito válido.',
      );
    }

    if (price < 0 || (!allowZero && price == 0)) {
      throw ArgumentError.value(
        price,
        'price',
        'El precio debe ser un valor numérico estrictamente positivo.',
      );
    }

    final String curr = declaredCurrency.trim().toUpperCase();
    final double max =
        customMaxThreshold ?? defaultMaxThresholds[curr] ?? 1000000.0;
    final double min = customMinThreshold ?? defaultMinThresholds[curr] ?? 0.01;

    if (price > max) {
      return ScaleValidationResult.rejected(
        reason: 'CURRENCY_MAGNITUDE_OVERFLOW',
        message:
            'Precio $price $curr excede el umbral máximo verosímil ($max).',
        scale: getScale(curr),
      );
    }

    if (price < min && price > 0) {
      return ScaleValidationResult.rejected(
        reason: 'CURRENCY_MAGNITUDE_UNDERFLOW',
        message:
            'Precio $price $curr es inverosímil por estar debajo del mínimo ($min).',
        scale: getScale(curr),
      );
    }

    final int scale = getScale(curr);

    if (strictScale) {
      final ScaleValidationResult precisionCheck = validatePrecision(
        price: price,
        declaredCurrency: curr,
      );
      if (!precisionCheck.isValid) {
        return precisionCheck;
      }
    }

    final int factor = getScaleFactor(curr);
    final int cents = (price * factor).round();

    return ScaleValidationResult.valid(
      cents: cents,
      normalizedPrice: price,
      scale: scale,
    );
  }

  /// Valida de forma estricta que [price] no posea fracciones que excedan la escala decimal permitida
  /// para [declaredCurrency] (ej. sub-céntimos en USD como $10.999 o $0.005).
  static ScaleValidationResult validatePrecision({
    required double price,
    required String declaredCurrency,
  }) {
    if (price.isNaN || price.isInfinite) {
      throw ArgumentError.value(
        price,
        'price',
        'El precio debe ser un número real finito válido.',
      );
    }

    final String curr = declaredCurrency.trim().toUpperCase();
    final int scale = getScale(curr);
    final double factor = math.pow(10, scale).toDouble();
    final double scaled = price * factor;
    final double rounded = scaled.roundToDouble();

    // Tolerancia epsilon para absorber imprecisión inevitable de IEEE 754
    const double epsilon = 1e-4;
    final double delta = (scaled - rounded).abs();

    if (delta > epsilon) {
      return ScaleValidationResult.rejected(
        reason: 'CURRENCY_PRECISION_OVERFLOW',
        message:
            'Precio $price $curr viola la precisión requerida ($scale decimales/céntimos). '
            'Se detectaron fracciones sub-céntimo no admitidas.',
        scale: scale,
      );
    }

    return ScaleValidationResult.valid(
      cents: rounded.toInt(),
      normalizedPrice: rounded / factor,
      scale: scale,
    );
  }

  /// Coerce y valida precio arrojando [CurrencyScaleException] si se rechaza.
  static double enforceValidPrice({
    required double price,
    required String declaredCurrency,
    double? customMaxThreshold,
    double? customMinThreshold,
    bool allowZero = false,
    bool strictScale = false,
  }) {
    final ScaleValidationResult result = validateScale(
      price: price,
      declaredCurrency: declaredCurrency,
      customMaxThreshold: customMaxThreshold,
      customMinThreshold: customMinThreshold,
      allowZero: allowZero,
      strictScale: strictScale,
    );
    if (!result.isValid) {
      throw CurrencyScaleException(
        price: price,
        currency: declaredCurrency,
        reason: result.reason ?? 'UNKNOWN',
        message: result.message,
        scale: result.scale,
      );
    }
    return price;
  }

  /// Convierte deterministamente un precio decimal a céntimos enteros (minor units),
  /// aplicando validación estricta de escala y umbrales.
  ///
  /// Arroja [CurrencyScaleException] si el precio tiene sub-céntimos o desborda la escala.
  static int toCents({
    required double price,
    required String declaredCurrency,
    bool allowZero = false,
    bool strictScale = true,
    double? customMaxThreshold,
    double? customMinThreshold,
  }) {
    final double validPrice = enforceValidPrice(
      price: price,
      declaredCurrency: declaredCurrency,
      customMaxThreshold: customMaxThreshold,
      customMinThreshold: customMinThreshold,
      allowZero: allowZero,
      strictScale: strictScale,
    );

    final String curr = declaredCurrency.trim().toUpperCase();
    final int factor = getScaleFactor(curr);
    return (validPrice * factor).round();
  }

  /// Convierte céntimos enteros a su representación decimal de precio según la escala de la divisa.
  static double fromCents({
    required int cents,
    required String declaredCurrency,
    bool allowZero = false,
  }) {
    if (cents < 0 || (!allowZero && cents == 0)) {
      throw ArgumentError.value(
        cents,
        'cents',
        'Los céntimos deben ser un valor entero estrictamente positivo.',
      );
    }

    final String curr = declaredCurrency.trim().toUpperCase();
    final int factor = getScaleFactor(curr);
    final double price = cents / factor.toDouble();

    // Validar magnitud contra umbrales por divisa
    enforceValidPrice(
      price: price,
      declaredCurrency: curr,
      allowZero: allowZero,
      strictScale: false,
    );

    return price;
  }

  /// Valida directamente un valor entero de céntimos contra umbrales máximos y mínimos.
  static int enforceValidCents({
    required int cents,
    required String declaredCurrency,
    int? customMaxCents,
    int? customMinCents,
    bool allowZero = false,
  }) {
    if (cents < 0 || (!allowZero && cents == 0)) {
      throw ArgumentError.value(
        cents,
        'cents',
        'Los céntimos deben ser un valor entero estrictamente positivo.',
      );
    }

    final String curr = declaredCurrency.trim().toUpperCase();
    final int factor = getScaleFactor(curr);
    final int maxCents =
        customMaxCents ??
        ((defaultMaxThresholds[curr] ?? 1000000.0) * factor).round();
    final int minCents =
        customMinCents ??
        ((defaultMinThresholds[curr] ?? 0.01) * factor).round();

    if (cents > maxCents) {
      throw CurrencyScaleException(
        cents: cents,
        currency: curr,
        reason: 'CURRENCY_MAGNITUDE_OVERFLOW',
        message:
            'Céntimos $cents $curr exceden el umbral máximo verosímil ($maxCents).',
        scale: getScale(curr),
      );
    }

    if (cents < minCents && cents > 0) {
      throw CurrencyScaleException(
        cents: cents,
        currency: curr,
        reason: 'CURRENCY_MAGNITUDE_UNDERFLOW',
        message:
            'Céntimos $cents $curr son inverosímiles por estar debajo del mínimo ($minCents).',
        scale: getScale(curr),
      );
    }

    return cents;
  }

  /// Redondea un valor decimal a la escala canónica exacta de la divisa.
  static double roundToScale(double price, String declaredCurrency) {
    if (price.isNaN || price.isInfinite) {
      throw ArgumentError.value(price, 'price');
    }
    final int factor = getScaleFactor(declaredCurrency);
    return (price * factor).round() / factor.toDouble();
  }

  /// Formatea céntimos enteros a una cadena canónica legible con su código de divisa.
  static String formatCents(int cents, String declaredCurrency) {
    final String curr = declaredCurrency.trim().toUpperCase();
    final int scale = getScale(curr);
    final int factor = getScaleFactor(curr);
    final double value = cents / factor.toDouble();
    return '${value.toStringAsFixed(scale)} $curr';
  }
}
