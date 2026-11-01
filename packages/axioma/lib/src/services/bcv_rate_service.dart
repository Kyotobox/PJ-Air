// 🎯 Servicio Canónico de Tasas Oficiales BCV — SPRINT N27 (TASK-N27-04)
// Conforme a Doctrinas: §4 Zero Mocks, §6 Sad Paths, §39 Pure Dart Core, §45 Offline-First, §47 Verdad Atómica.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

/// Excepción base del servicio de tasas BCV.
abstract class BcvException implements Exception {
  final String message;
  final dynamic details;

  const BcvException(this.message, {this.details});

  @override
  String toString() => 'BcvException: $message';
}

/// Excepción cuando falla el transporte HTTP o existe partición de red (§45).
class BcvNetworkException extends BcvException {
  const BcvNetworkException(super.message, {super.details});
}

/// Excepción cuando el HTML del portal oficial no puede ser parseado.
class BcvParseException extends BcvException {
  const BcvParseException(super.message, {super.details});
}

/// Excepción cuando una moneda solicitada no se encuentra disponible.
class BcvRateNotFoundException extends BcvException {
  const BcvRateNotFoundException(super.message, {super.details});
}

/// Entidad inmutable que representa una tasa oficial cambiaria certificada.
class BcvRate {
  final String currency;
  final double rate;
  final DateTime timestamp;
  final String sourceUrl;
  final bool isStale;

  const BcvRate({
    required this.currency,
    required this.rate,
    required this.timestamp,
    required this.sourceUrl,
    this.isStale = false,
  });

  factory BcvRate.fromJson(Map<String, dynamic> json) {
    return BcvRate(
      currency: json['currency'] as String,
      rate: (json['rate'] as num).toDouble(),
      timestamp: DateTime.parse(json['timestamp'] as String),
      sourceUrl: json['sourceUrl'] as String? ?? 'https://www.bcv.org.ve',
      isStale: json['isStale'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'currency': currency,
    'rate': rate,
    'timestamp': timestamp.toIso8601String(),
    'sourceUrl': sourceUrl,
    'isStale': isStale,
  };

  /// Realiza la conversión matemática entre divisas.
  /// Si [toBs] es true, convierte divisa -> Bs (amount * rate).
  /// Si [toBs] es false, convierte Bs -> divisa (amount / rate).
  double convert(double amount, {bool toBs = true}) {
    if (amount < 0) {
      throw ArgumentError.value(
        amount,
        'amount',
        'El monto no puede ser negativo.',
      );
    }
    if (rate <= 0) {
      throw StateError('La tasa cambiaria debe ser mayor a cero.');
    }
    return toBs ? amount * rate : amount / rate;
  }
}

/// Servicio desacoplado y agnóstico de consulta de tasas oficiales del BCV.
class BcvRateService {
  final String baseUrl;
  final Duration timeout;
  final HttpClient _httpClient;
  final Map<String, BcvRate> _cache = <String, BcvRate>{};

  BcvRateService({
    this.baseUrl = 'https://www.bcv.org.ve',
    this.timeout = const Duration(seconds: 10),
    HttpClient? httpClient,
    Map<String, BcvRate>? initialCache,
  }) : _httpClient = httpClient ?? HttpClient() {
    _httpClient.connectionTimeout = timeout;
    if (initialCache != null) {
      _cache.addAll(initialCache);
    }
  }

  /// Retorna las tasas actualmente en caché en memoria (§45).
  Map<String, BcvRate> get cachedRates =>
      Map<String, BcvRate>.unmodifiable(_cache);

  /// Obtiene una tasa oficial específica (por defecto 'USD').
  /// Si ocurre un fallo de red y [fallbackToCache] es true, retorna la tasa de caché con [isStale] = true.
  Future<BcvRate> fetchRate({
    String currency = 'USD',
    bool fallbackToCache = true,
  }) async {
    final String targetCurrency = currency.toUpperCase().trim();
    try {
      final Map<String, BcvRate> allRates = await fetchAllRates();
      final BcvRate? rate = allRates[targetCurrency];
      if (rate == null) {
        throw BcvRateNotFoundException(
          'Moneda "$targetCurrency" no encontrada en la publicación del BCV.',
        );
      }
      return rate;
    } on BcvNetworkException {
      if (fallbackToCache && _cache.containsKey(targetCurrency)) {
        final BcvRate cached = _cache[targetCurrency]!;
        return BcvRate(
          currency: cached.currency,
          rate: cached.rate,
          timestamp: cached.timestamp,
          sourceUrl: cached.sourceUrl,
          isStale: true,
        );
      }
      rethrow;
    }
  }

  /// Consulta la página del BCV y extrae todas las tasas oficiales disponibles.
  Future<Map<String, BcvRate>> fetchAllRates() async {
    final Uri uri = Uri.parse(baseUrl);
    try {
      final HttpClientRequest request = await _httpClient
          .getUrl(uri)
          .timeout(timeout);
      request.headers.set(
        HttpHeaders.userAgentHeader,
        'Mozilla/5.0 (Compatible; Conext-Axioma-RateService/4.0)',
      );
      request.headers.set(
        HttpHeaders.acceptHeader,
        'text/html,application/xhtml+xml',
      );

      final HttpClientResponse response = await request.close().timeout(
        timeout,
      );
      if (response.statusCode != 200) {
        throw BcvNetworkException(
          'El portal del BCV respondió con código HTTP no exitoso: ${response.statusCode}',
          details: response.statusCode,
        );
      }

      final String html = await utf8.decoder.bind(response).join();
      final Map<String, BcvRate> parsed = parseBcvHtml(
        html,
        sourceUrl: baseUrl,
      );
      if (parsed.isEmpty) {
        throw const BcvParseException(
          'No se pudo extraer ninguna tasa oficial válida del documento HTML.',
        );
      }

      // Actualizar caché atómicamente
      _cache.addAll(parsed);
      return parsed;
    } on SocketException catch (e) {
      throw BcvNetworkException(
        'Partición de red o servidor BCV inaccesible: ${e.message}',
        details: e,
      );
    } on TimeoutException catch (e) {
      throw BcvNetworkException(
        'Timeout al consultar el portal del BCV (${timeout.inSeconds}s)',
        details: e,
      );
    } on BcvException {
      rethrow;
    } catch (e) {
      throw BcvNetworkException(
        'Error inesperado al consultar tasas: $e',
        details: e,
      );
    }
  }

  /// Parser determinista de HTML de tasas del BCV (§4, §39).
  static Map<String, BcvRate> parseBcvHtml(
    String html, {
    required String sourceUrl,
  }) {
    final Map<String, BcvRate> rates = <String, BcvRate>{};
    final DateTime now = DateTime.now().toUtc();

    // Extrae bloques estándar del BCV: id="dolar", id="euro", etc.
    final List<Map<String, String>> targets = <Map<String, String>>[
      <String, String>{'code': 'USD', 'id': 'dolar'},
      <String, String>{'code': 'EUR', 'id': 'euro'},
      <String, String>{'code': 'CNY', 'id': 'yuan'},
      <String, String>{'code': 'TRY', 'id': 'lira'},
      <String, String>{'code': 'RUB', 'id': 'rublo'},
    ];

    for (final Map<String, String> target in targets) {
      final String code = target['code']!;
      final String tagId = target['id']!;

      // Patrón 1: Bloque con id="dolar" y strong dentro
      final RegExp blockRegex = RegExp(
        'id=[\'"]$tagId[\'"][^>]*>([\\s\\S]*?)<\\/div>',
        caseSensitive: false,
      );
      final Match? blockMatch = blockRegex.firstMatch(html);

      String? valueStr;
      if (blockMatch != null) {
        final String inner = blockMatch.group(1)!;
        final RegExp strongRegex = RegExp('<strong>([0-9.,\\s]+)<\\/strong>');
        final Match? strongMatch = strongRegex.firstMatch(inner);
        if (strongMatch != null) {
          valueStr = strongMatch.group(1);
        }
      }

      // Patrón 2: Búsqueda flexible de número con coma decimal tras el nombre de la divisa
      if (valueStr == null) {
        final RegExp fallbackRegex = RegExp(
          '$tagId[\\s\\S]{1,150}?([0-9]{1,3}(?:\\.[0-9]{3})*,[0-9]{2,8})',
          caseSensitive: false,
        );
        final Match? fallbackMatch = fallbackRegex.firstMatch(html);
        if (fallbackMatch != null) {
          valueStr = fallbackMatch.group(1);
        }
      }

      if (valueStr != null) {
        // Normalizar formato numérico venezolano (12.345,67 -> 12345.67)
        final String normalized = valueStr
            .replaceAll(' ', '')
            .replaceAll('.', '')
            .replaceAll(',', '.');

        final double? parsedVal = double.tryParse(normalized);
        if (parsedVal != null && parsedVal > 0) {
          rates[code] = BcvRate(
            currency: code,
            rate: parsedVal,
            timestamp: now,
            sourceUrl: sourceUrl,
          );
        }
      }
    }

    return rates;
  }

  /// Cierra el cliente HTTP.
  void close({bool force = false}) {
    _httpClient.close(force: force);
  }
}
