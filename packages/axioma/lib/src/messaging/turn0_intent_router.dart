// 🎯 Turn-0 Deterministic Bimodal Intent Router — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios,
// §12.b Límite 5 archivos, §40 Thin Client, §48 Cierre Autárquico, Calm Error UX.

import 'intent_signature.dart';
import 'omnichannel_envelope.dart';

/// Excepción de dominio arrojada ante fallas de validación, corrupción
/// o mensajes no enrutables en el triaje Turn-0.
class TriageRoutingException implements Exception {
  final String message;
  final InboundMessage? invalidMessage;
  final Object? cause;

  const TriageRoutingException(this.message, {this.invalidMessage, this.cause});

  @override
  String toString() => 'TriageRoutingException: $message';
}

/// Clasificador determinista de intención Turn-0 sin costo de inferencia LLM (bash.00).
///
/// Evalúa el [InboundMessage] entrante y discrimina entre:
/// - [TriageRoute.fastTrack]: Coincidencias exactas o de alta certeza en catálogo,
///   precios, consultas de productos y compras por SKU. Extrae parámetros de forma
///   autárquica.
/// - [TriageRoute.socratic]: Consultas conversacionales, de recomendación, soporte
///   técnico o solicitudes abiertas que requieren diálogo adaptativo.
class Turn0IntentRouter {
  final double fastTrackConfidence;
  final double socraticConfidence;
  final List<String> customCatalogKeywords;

  const Turn0IntentRouter({
    this.fastTrackConfidence = 1.0,
    this.socraticConfidence = 0.70,
    this.customCatalogKeywords = const <String>[],
  });

  // Regex deterministas para SKU y cantidades
  static final RegExp _skuDirectPattern = RegExp(
    r'\b(SKU-[A-Za-z0-9_-]+)\b',
    caseSensitive: false,
  );

  static final RegExp _skuLabeledPattern = RegExp(
    r'\bSKU[:\s#-]+([A-Za-z0-9_-]+)\b',
    caseSensitive: false,
  );

  static final RegExp _skuGenericPattern = RegExp(
    r'\b(?:#)([A-Za-z0-9_-]{3,20})\b',
  );

  static final RegExp _qtyNearBuyPattern = RegExp(
    r'\b(?:comprar|ordenar|pedir|quiero|traer)\s+(\d{1,4})\b',
    caseSensitive: false,
  );

  static final RegExp _qtyWithUnitsPattern = RegExp(
    r'\b(\d{1,4})\s*(?:unidades|unidad|und|piezas|pz|uds|items)\b',
    caseSensitive: false,
  );

  static final RegExp _qtyMultiplyPattern = RegExp(
    r'\b(?:x|por)\s*(\d{1,4})\b',
    caseSensitive: false,
  );

  /// Evalúa el mensaje entrante y emite una [TriageDecision].
  ///
  /// Si [strict] es true (por defecto), arroja [TriageRoutingException] ante
  /// mensajes vacíos o con caracteres corruptos (§6 Sad Path).
  /// Si [strict] es false, degrada suavemente a [TriageRoute.socratic] con
  /// confianza 0.0 (Calm Error UX).
  TriageDecision route(InboundMessage message, {bool strict = true}) {
    final String rawText = message.text;

    // Validación de texto vacío o solo espacios
    if (rawText.trim().isEmpty) {
      if (strict) {
        throw TriageRoutingException(
          'El texto del mensaje entrante no puede estar vacío ni contener solo espacios.',
          invalidMessage: message,
        );
      }
      return _degradedDecision(
        'Mensaje vacío recibido; degradando suavemente a socrático.',
      );
    }

    // Validación de caracteres de control o codificación corrupta
    if (_isCorrupted(rawText)) {
      if (strict) {
        throw TriageRoutingException(
          'El mensaje contiene caracteres corruptos o bytes de control inválidos.',
          invalidMessage: message,
        );
      }
      return _degradedDecision(
        'Contenido corrupto detectado; degradando suavemente a socrático.',
      );
    }

    final String normalized = _normalize(rawText);

    // 1. Detección de SKU
    final String? detectedSku = _extractSku(rawText);
    final int? detectedQty = _extractQuantity(rawText, normalized);

    // 2. Patrones de Compra / Orden Directa (Fast Track)
    if (_matchesOrder(normalized, detectedSku)) {
      final Map<String, dynamic> params = <String, dynamic>{
        'action': 'purchase_sku',
        'pattern': 'order',
        'sku': ?detectedSku,
        'quantity': ?detectedQty,
      };
      return TriageDecision(
        intent: TriageIntent.order,
        route: TriageRoute.fastTrack,
        confidence: fastTrackConfidence,
        extractedParams: params,
        reason:
            'Turn-0 Fast-Track: Orden directa identificada deterministamente${detectedSku != null ? " para SKU $detectedSku" : ""}.',
      );
    }

    // 3. Patrones de Precio / Costo (Fast Track)
    if (_matchesPrice(normalized)) {
      final String? query = _extractPriceQuery(rawText, normalized);
      final Map<String, dynamic> params = <String, dynamic>{
        'action': 'price_inquiry',
        'pattern': 'price',
        'sku': ?detectedSku,
        if (query != null && query.isNotEmpty) 'query': query,
      };
      return TriageDecision(
        intent: TriageIntent.inquiry,
        route: TriageRoute.fastTrack,
        confidence: fastTrackConfidence,
        extractedParams: params,
        reason:
            'Turn-0 Fast-Track: Consulta directa de precio/cotización identificada.',
      );
    }

    // 4. Patrones de Catálogo y Exploración de Productos (Fast Track)
    if (_matchesCatalog(normalized)) {
      final String? category = _extractCategory(rawText, normalized);
      final Map<String, dynamic> params = <String, dynamic>{
        'action': 'view_catalog',
        'pattern': 'catalog',
        'sku': ?detectedSku,
        if (category != null && category.isNotEmpty) 'category': category,
      };
      return TriageDecision(
        intent: TriageIntent.inquiry,
        route: TriageRoute.fastTrack,
        confidence: fastTrackConfidence,
        extractedParams: params,
        reason:
            'Turn-0 Fast-Track: Solicitud determinista de catálogo o listado de productos.',
      );
    }

    // 5. Patrones de Soporte / Reclamos (Socratic)
    if (_matchesSupport(normalized)) {
      return TriageDecision(
        intent: TriageIntent.support,
        route: TriageRoute.socratic,
        confidence: socraticConfidence,
        extractedParams: <String, dynamic>{'action': 'support_request'},
        reason:
            'Turn-0 Socratic: Solicitud de soporte o asistencia técnica canalizada a diálogo socrático.',
      );
    }

    // 6. Consultas Abiertas, Recomendaciones o Conversacionales (Socratic)
    return TriageDecision(
      intent: TriageIntent.consultation,
      route: TriageRoute.socratic,
      confidence: socraticConfidence,
      extractedParams: const <String, dynamic>{},
      reason:
          'Turn-0 Socratic: Consulta abierta o consultiva derivada a diálogo socrático.',
    );
  }

  /// Wrapper seguro que captura cualquier [TriageRoutingException] y degrada suavemente
  /// a [TriageRoute.socratic] con nivel de confianza cero (Calm Error UX).
  TriageDecision routeSafely(InboundMessage message) {
    return route(message, strict: false);
  }

  /// Alias semántico para integración ergonómica.
  TriageDecision evaluate(InboundMessage message, {bool strict = true}) {
    return route(message, strict: strict);
  }

  /// Convierte una [TriageDecision] en su correspondiente [IntentSignature] canónica.
  IntentSignature toSignature(
    TriageDecision decision, {
    String domain = 'catalog',
  }) {
    String verb;
    String object;

    switch (decision.intent) {
      case TriageIntent.order:
        verb = 'buy';
        object = (decision.extractedParams['sku'] as String?) ?? 'sku';
        break;
      case TriageIntent.inquiry:
        final String? action = decision.extractedParams['action'] as String?;
        if (action == 'price_inquiry') {
          verb = 'query';
          object = 'price';
        } else if (action == 'view_catalog') {
          verb = 'view';
          object = 'catalog';
        } else {
          verb = 'query';
          object = 'product';
        }
        break;
      case TriageIntent.support:
        verb = 'request';
        object = 'support';
        break;
      case TriageIntent.consultation:
        verb = 'consult';
        object = 'general';
        break;
      case TriageIntent.unknown:
        verb = 'unknown';
        object = 'input';
        break;
    }

    return IntentSignature(
      verb: verb,
      object: object,
      domain: domain,
      confidence: decision.confidence,
      metadata: decision.extractedParams,
    );
  }

  /// Evalúa un [InboundMessage] y retorna directamente su [IntentSignature] canónica.
  IntentSignature routeSignature(
    InboundMessage message, {
    String domain = 'catalog',
    bool strict = true,
  }) {
    final TriageDecision decision = route(message, strict: strict);
    return toSignature(decision, domain: domain);
  }

  // --- MÉTODOS DE SOPORTE DETERMINISTA ---

  bool _isCorrupted(String text) {
    if (text.contains('\x00') || text.contains('\uFFFD')) {
      return true;
    }
    for (int i = 0; i < text.length; i++) {
      final int code = text.codeUnitAt(i);
      // Caracteres de control ASCII < 32 excluyendo TAB (9), LF (10), CR (13)
      if (code < 32 && code != 9 && code != 10 && code != 13) {
        return true;
      }
    }
    return false;
  }

  String _normalize(String input) {
    return input
        .trim()
        .toLowerCase()
        .replaceAll('á', 'a')
        .replaceAll('é', 'e')
        .replaceAll('í', 'i')
        .replaceAll('ó', 'o')
        .replaceAll('ú', 'u')
        .replaceAll('ü', 'u');
  }

  String? _extractSku(String text) {
    final Match? matchDirect = _skuDirectPattern.firstMatch(text);
    if (matchDirect != null) {
      return matchDirect.group(1)?.toUpperCase();
    }
    final Match? matchLabeled = _skuLabeledPattern.firstMatch(text);
    if (matchLabeled != null) {
      final String raw = matchLabeled.group(1)!;
      return raw.startsWith('SKU-')
          ? raw.toUpperCase()
          : 'SKU-${raw.toUpperCase()}';
    }
    final Match? matchGeneric = _skuGenericPattern.firstMatch(text);
    if (matchGeneric != null) {
      return 'SKU-${matchGeneric.group(1)!.toUpperCase()}';
    }
    return null;
  }

  int? _extractQuantity(String rawText, String normalized) {
    final Match? nearBuy = _qtyNearBuyPattern.firstMatch(normalized);
    if (nearBuy != null) {
      return int.tryParse(nearBuy.group(1)!);
    }
    final Match? units = _qtyWithUnitsPattern.firstMatch(normalized);
    if (units != null) {
      return int.tryParse(units.group(1)!);
    }
    final Match? multiply = _qtyMultiplyPattern.firstMatch(normalized);
    if (multiply != null) {
      return int.tryParse(multiply.group(1)!);
    }
    return null;
  }

  bool _matchesOrder(String normalized, String? detectedSku) {
    // Si contiene la palabra comprar / ordenar / pedir con o sin SKU
    const List<String> orderKeywords = <String>[
      'comprar sku',
      'comprar',
      'ordenar',
      'hacer pedido',
      'realizar pedido',
      'adquirir',
      'encargar',
    ];
    for (final String kw in orderKeywords) {
      if (normalized.contains(kw)) return true;
    }
    // Si contiene un SKU específico y la palabra "quiero" o "llevo"
    if (detectedSku != null &&
        (normalized.contains('quiero') ||
            normalized.contains('llevo') ||
            normalized.contains('apartar') ||
            normalized.contains('pago'))) {
      return true;
    }
    return false;
  }

  bool _matchesPrice(String normalized) {
    const List<String> priceKeywords = <String>[
      'precio',
      'precios',
      'cuanto cuesta',
      'cuanto sale',
      'costo',
      'costos',
      'valor',
      'cotizar',
      'cotizacion',
      'presupuesto',
      'en cuanto sale',
      'tarifa',
    ];
    for (final String kw in priceKeywords) {
      if (normalized.contains(kw)) return true;
    }
    return false;
  }

  bool _matchesCatalog(String normalized) {
    const List<String> catalogKeywords = <String>[
      'catalogo',
      'catalog',
      'ver productos',
      'mostrar productos',
      'ver catalogo',
      'lista de productos',
      'productos disponibles',
      'que productos tienen',
      'que venden',
      'portafolio',
      'menu',
      'inventario',
      'mercancia',
      'mercaderia',
    ];
    for (final String kw in catalogKeywords) {
      if (normalized.contains(kw)) return true;
    }
    for (final String kw in customCatalogKeywords) {
      if (normalized.contains(_normalize(kw))) return true;
    }
    // Coincidencia con frase corta de "productos"
    if (normalized == 'productos' || normalized == 'ver productos') {
      return true;
    }
    return false;
  }

  bool _matchesSupport(String normalized) {
    const List<String> supportKeywords = <String>[
      'ayuda',
      'soporte',
      'reclamo',
      'queja',
      'devolucion',
      'reembolso',
      'garantia',
      'averia',
      'falla',
      'problema con mi',
      'no funciona',
      'humano',
      'asesor',
    ];
    for (final String kw in supportKeywords) {
      if (normalized.contains(kw)) return true;
    }
    return false;
  }

  String? _extractPriceQuery(String rawText, String normalized) {
    // Si dice "precio de X", "cuánto cuesta X", "costo de X"
    final RegExp priceOf = RegExp(
      r'(?:precio\s+de|precio\s+del|costo\s+de|costo\s+del|cu[aá]nto\s+cuesta|cu[aá]nto\s+sale)\s+([^?.,;!\n]+)',
      caseSensitive: false,
    );
    final Match? match = priceOf.firstMatch(rawText);
    if (match != null) {
      return match.group(1)?.trim();
    }
    return null;
  }

  String? _extractCategory(String rawText, String normalized) {
    final RegExp catOf = RegExp(
      r'(?:cat[aá]logo\s+de|cat[aá]logo\s+del|productos\s+de|ver\s+productos\s+de)\s+([^?.,;!\n]+)',
      caseSensitive: false,
    );
    final Match? match = catOf.firstMatch(rawText);
    if (match != null) {
      return match.group(1)?.trim();
    }
    return null;
  }

  TriageDecision _degradedDecision(String reason) {
    return TriageDecision(
      intent: TriageIntent.unknown,
      route: TriageRoute.socratic,
      confidence: 0.0,
      extractedParams: const <String, dynamic>{},
      reason: reason,
    );
  }
}
