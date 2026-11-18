/// data_dictionary.dart — Diccionario y Mapeador Canónico de Atributos Pure Dart (§4, §6, §39, §58).
///
/// Define el catálogo transversal de dominios y sinónimos para la normalización
/// determinista de datos en la flota (ingesta, XLSX, CSV, APIs).
library;

import 'data_contract.dart';

// =============================================================================
// EXCEPCIONES TIPADAS DE DICCIONARIO (§6 SAD PATH MANDATORIO)
// =============================================================================

/// Excepción base del diccionario de datos.
abstract class DataDictionaryException implements Exception {
  final String message;
  final dynamic details;

  const DataDictionaryException(this.message, [this.details]);

  @override
  String toString() =>
      'DataDictionaryException: $message${details != null ? ' (Detalles: $details)' : ''}';
}

/// Sad Path: Dominio de datos no reconocido.
class UnknownDomainException extends DataDictionaryException {
  final String domainName;

  const UnknownDomainException(this.domainName)
    : super('Dominio de datos canónico no reconocido: "$domainName".');
}

/// Sad Path: Escala o magnitud de divisa fuera de rango verosímil.
class CurrencyScaleException extends DataDictionaryException {
  final double price;
  final String currency;
  final String reason;

  const CurrencyScaleException({
    required this.price,
    required this.currency,
    required this.reason,
    String? message,
  }) : super(
         message ??
             'Anomalía de escala financiera para precio $price $currency: $reason',
       );
}

// =============================================================================
// RESULTADO DE VALIDACIÓN Y GUARDIÁN DE ESCALA DE DIVISAS (CURRENCY SCALE GUARD)
// =============================================================================

/// Resultado de una validación de escala financiera.
class ScaleValidationResult {
  final bool isValid;
  final String? reason;
  final String? message;

  const ScaleValidationResult({
    required this.isValid,
    this.reason,
    this.message,
  });

  factory ScaleValidationResult.valid() =>
      const ScaleValidationResult(isValid: true);

  factory ScaleValidationResult.rejected({
    required String reason,
    required String message,
  }) => ScaleValidationResult(isValid: false, reason: reason, message: message);
}

/// Guardián financiero Pure Dart agnóstico de producto (§39).
/// Protege los flujos de ingesta contra saltos de orden de magnitud y errores decimales.
class CurrencyScaleGuard {
  static const Map<String, double> _defaultMaxThresholds = <String, double>{
    'USD': 500000.0,
    'EUR': 500000.0,
    'COP': 5000000000.0,
    'VES': 100000000000.0,
  };

  static const Map<String, double> _defaultMinThresholds = <String, double>{
    'USD': 0.01,
    'EUR': 0.01,
    'COP': 100.0,
    'VES': 1.0,
  };

  /// Evalúa si el precio presenta una anomalía crítica de magnitud para la divisa declarada.
  static ScaleValidationResult validateScale({
    required double price,
    required String declaredCurrency,
    double? customMaxThreshold,
    double? customMinThreshold,
    bool allowZero = false,
  }) {
    if (price < 0 || (!allowZero && price == 0)) {
      throw ArgumentError.value(
        price,
        'price',
        'El precio debe ser un valor numérico estrictamente positivo.',
      );
    }

    final String curr = declaredCurrency.trim().toUpperCase();
    final double max =
        customMaxThreshold ?? _defaultMaxThresholds[curr] ?? 1000000.0;
    final double min =
        customMinThreshold ?? _defaultMinThresholds[curr] ?? 0.01;

    if (price > max) {
      return ScaleValidationResult.rejected(
        reason: 'CURRENCY_MAGNITUDE_OVERFLOW',
        message:
            'Precio $price $curr excede el umbral máximo verosímil ($max).',
      );
    }

    if (price < min && price > 0) {
      return ScaleValidationResult.rejected(
        reason: 'CURRENCY_MAGNITUDE_UNDERFLOW',
        message:
            'Precio $price $curr es inverosímil por estar debajo del mínimo ($min).',
      );
    }

    return ScaleValidationResult.valid();
  }

  /// Coerce y valida precio arrojando [CurrencyScaleException] si se rechaza.
  static double enforceValidPrice({
    required double price,
    required String declaredCurrency,
    double? customMaxThreshold,
    double? customMinThreshold,
  }) {
    final ScaleValidationResult result = validateScale(
      price: price,
      declaredCurrency: declaredCurrency,
      customMaxThreshold: customMaxThreshold,
      customMinThreshold: customMinThreshold,
    );
    if (!result.isValid) {
      throw CurrencyScaleException(
        price: price,
        currency: declaredCurrency,
        reason: result.reason ?? 'UNKNOWN',
        message: result.message,
      );
    }
    return price;
  }
}

// =============================================================================
// DOMINIOS CANÓNICOS Y DICCIONARIO
// =============================================================================

/// Dominios canónicos en la flota Antigravity.
enum CanonicalDomain {
  automotive,
  geo,
  messaging,
  financial,
  flow,
  governance,
  catalog,
  realEstate;

  static CanonicalDomain fromString(String raw) {
    final String clean = raw.trim().toLowerCase();
    for (final CanonicalDomain d in CanonicalDomain.values) {
      if (d.name.toLowerCase() == clean) return d;
    }
    throw UnknownDomainException(raw);
  }
}

/// Diccionario transversal de sinónimos y resolución de campos canónicos.
class DataDictionary {
  static final DataDictionary _instance = DataDictionary._internal();
  factory DataDictionary() => _instance;
  DataDictionary._internal() {
    _initDefaultAliases();
  }

  final Map<String, String> _aliases = <String, String>{};
  final Map<String, FieldDefinition> _canonicalDefinitions =
      <String, FieldDefinition>{};

  /// Normaliza una cadena de encabezado para comparación insensible a mayúsculas y acentos.
  static String normalizeHeader(String header) {
    return header
        .trim()
        .toLowerCase()
        .replaceAll('á', 'a')
        .replaceAll('é', 'e')
        .replaceAll('í', 'i')
        .replaceAll('ó', 'o')
        .replaceAll('ú', 'u')
        .replaceAll('ñ', 'n')
        .replaceAll(RegExp(r'[^a-z0-9_]'), '_')
        .replaceAll(RegExp(r'_+'), '_')
        .replaceAll(RegExp(r'^_|_$'), '');
  }

  /// Inicializa los alias predeterminados de la flota.
  void _initDefaultAliases() {
    // Automotive / Catálogo
    _register('sku', <String>[
      'sku',
      'codigo',
      'cod',
      'referencia',
      'ref',
      'item_code',
      'numero_parte',
      'part_number',
      'codigo_de_parte',
      'codigo_parte',
      'cod_parte',
    ]);
    _register('oem', <String>[
      'oem',
      'oem_number',
      'numero_oem',
      'parte_original',
      'cod_oem',
    ]);
    _register('brand', <String>['brand', 'marca', 'fabricante', 'make']);
    _register('model', <String>['model', 'modelo', 'linea']);
    _register('year', <String>['year', 'ano', 'anio', 'modelo_ano']);
    _register('price_usd', <String>[
      'price_usd',
      'precio_usd',
      'precio_dolares',
      'valor_usd',
      'usd',
      'precio',
    ]);
    _register('price_cop', <String>[
      'price_cop',
      'precio_cop',
      'precio_pesos',
      'valor_cop',
      'cop',
    ]);
    _register('stock', <String>[
      'stock',
      'cantidad',
      'existencia',
      'qty',
      'inventory',
      'disponible',
    ]);
    _register('description', <String>[
      'description',
      'descripcion',
      'detalle',
      'nombre',
      'name',
    ]);

    // Geo
    _register('latitude', <String>['latitude', 'lat', 'latitud']);
    _register('longitude', <String>['longitude', 'lon', 'lng', 'longitud']);
    _register('address', <String>['address', 'direccion', 'dir']);

    // Messaging
    _register('phone_e164', <String>[
      'phone',
      'telefono',
      'celular',
      'phone_number',
      'msisdn',
      'movil',
      'telefono_celular',
    ]);
    _register('message_text', <String>[
      'message',
      'mensaje',
      'text',
      'texto',
      'body',
      'contenido',
    ]);

    // Flow & Governance
    _register('session_id', <String>[
      'session_id',
      'session_uuid',
      'conversacion_id',
      'conversation_id',
    ]);
    _register('state_name', <String>[
      'state_name',
      'state',
      'estado',
      'fsm_state',
    ]);

    // Standard field definitions
    _canonicalDefinitions['sku'] = const FieldDefinition(
      name: 'sku',
      type: CanonicalDataType.string,
      required: true,
    );
    _canonicalDefinitions['oem'] = const FieldDefinition(
      name: 'oem',
      type: CanonicalDataType.string,
    );
    _canonicalDefinitions['brand'] = const FieldDefinition(
      name: 'brand',
      type: CanonicalDataType.string,
      required: true,
    );
    _canonicalDefinitions['model'] = const FieldDefinition(
      name: 'model',
      type: CanonicalDataType.string,
    );
    _canonicalDefinitions['year'] = const FieldDefinition(
      name: 'year',
      type: CanonicalDataType.integer,
    );
    _canonicalDefinitions['price_usd'] = const FieldDefinition(
      name: 'price_usd',
      type: CanonicalDataType.currency,
      currencyCode: 'USD',
    );
    _canonicalDefinitions['price_cop'] = const FieldDefinition(
      name: 'price_cop',
      type: CanonicalDataType.currency,
      currencyCode: 'COP',
    );
    _canonicalDefinitions['stock'] = const FieldDefinition(
      name: 'stock',
      type: CanonicalDataType.integer,
      defaultValue: 0,
    );
    _canonicalDefinitions['description'] = const FieldDefinition(
      name: 'description',
      type: CanonicalDataType.string,
    );
    _canonicalDefinitions['latitude'] = const FieldDefinition(
      name: 'latitude',
      type: CanonicalDataType.float,
    );
    _canonicalDefinitions['longitude'] = const FieldDefinition(
      name: 'longitude',
      type: CanonicalDataType.float,
    );
    _canonicalDefinitions['address'] = const FieldDefinition(
      name: 'address',
      type: CanonicalDataType.string,
    );
    _canonicalDefinitions['phone_e164'] = const FieldDefinition(
      name: 'phone_e164',
      type: CanonicalDataType.string,
    );
    _canonicalDefinitions['message_text'] = const FieldDefinition(
      name: 'message_text',
      type: CanonicalDataType.string,
    );
    _canonicalDefinitions['session_id'] = const FieldDefinition(
      name: 'session_id',
      type: CanonicalDataType.string,
    );
    _canonicalDefinitions['state_name'] = const FieldDefinition(
      name: 'state_name',
      type: CanonicalDataType.string,
    );
  }

  void _register(String canonical, List<String> aliases) {
    for (final String a in aliases) {
      _aliases[normalizeHeader(a)] = canonical;
    }
  }

  /// Resuelve un encabezado arbitrario a su nombre canónico.
  /// Si no coincide con ningún alias conocido, retorna el encabezado normalizado.
  String resolveCanonicalField(String rawHeader) {
    final String norm = normalizeHeader(rawHeader);
    return _aliases[norm] ?? norm;
  }

  /// Agrega un alias nuevo para un campo canónico.
  void registerAlias(String canonical, String alias) {
    _aliases[normalizeHeader(alias)] = canonical;
  }

  /// Retorna la definición canónica estándar si existe.
  FieldDefinition? getStandardDefinition(String canonicalField) {
    return _canonicalDefinitions[canonicalField];
  }

  /// Limpia los alias personalizados (restaura defaults para tests §4).
  void reset() {
    _aliases.clear();
    _canonicalDefinitions.clear();
    _initDefaultAliases();
  }
}
