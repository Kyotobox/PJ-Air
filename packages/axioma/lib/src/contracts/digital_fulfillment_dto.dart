// 🎯 Canonical Digital Fulfillment & Ephemeral Delivery DTO — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios, §45 Soberanía Offline.

import 'dart:convert';

/// Versión canónica del esquema de Digital Fulfillment.
const String kDigitalFulfillmentSchemaVersion = '1.0.0';

/// DTO Canónico para la entrega atómica de activos digitales post-pago
/// mediante URLs efímeras protegidas de Cloudflare R2 (<15s timeout) (§39, §45).
class DigitalFulfillmentDTO {
  static const String currentSchemaVersion = kDigitalFulfillmentSchemaVersion;
  static const String defaultSchemaVersion = currentSchemaVersion;

  /// Expresión regular para validar hash criptográfico SHA-256 (64 caracteres hexadecimales).
  static final RegExp _sha256Regex = RegExp(r'^[a-fA-F0-9]{64}$');

  /// Versión del contrato.
  final String schemaVersion;

  /// Identificador único del evento o recibo de entrega digital.
  final String fulfillmentId;

  /// Identificador de la orden comercial o transacción de pago asociada.
  final String orderId;

  /// Código de producto o SKU digital entregado.
  final String sku;

  /// Identificador del cliente receptor.
  final String customerId;

  /// URL prefirmada efímera de Cloudflare R2 con expiración estricta (<15s).
  final String ephemeralR2Url;

  /// Token criptográfico de autorización de descarga única.
  final String downloadToken;

  /// Suma de comprobación SHA-256 del binario o activo digital para verificación de integridad.
  final String sha256Checksum;

  /// Fecha y hora UTC en la que se generó la entrega efímera.
  final DateTime createdAt;

  /// Fecha y hora UTC en la que expira irrevocablemente la URL efímera.
  final DateTime expiresAt;

  /// Metadatos adicionales de entrega (tamaño de archivo, MIME type, etc.).
  final Map<String, dynamic> metadata;

  DigitalFulfillmentDTO({
    this.schemaVersion = defaultSchemaVersion,
    required this.fulfillmentId,
    required this.orderId,
    required this.sku,
    required this.customerId,
    required this.ephemeralR2Url,
    required this.downloadToken,
    required this.sha256Checksum,
    DateTime? createdAt,
    required this.expiresAt,
    this.metadata = const <String, dynamic>{},
  }) : createdAt = (createdAt ?? DateTime.now()).toUtc() {
    _validate();
  }

  void _validate() {
    if (schemaVersion.trim().isEmpty) {
      throw ArgumentError.value(
        schemaVersion,
        'schemaVersion',
        'La versión del esquema no puede estar vacía.',
      );
    }
    if (fulfillmentId.trim().isEmpty) {
      throw ArgumentError.value(
        fulfillmentId,
        'fulfillmentId',
        'El fulfillmentId no puede estar vacío.',
      );
    }
    if (orderId.trim().isEmpty) {
      throw ArgumentError.value(
        orderId,
        'orderId',
        'El orderId no puede estar vacío.',
      );
    }
    if (sku.trim().isEmpty) {
      throw ArgumentError.value(sku, 'sku', 'El SKU no puede estar vacío.');
    }
    if (customerId.trim().isEmpty) {
      throw ArgumentError.value(
        customerId,
        'customerId',
        'El customerId no puede estar vacío.',
      );
    }
    if (ephemeralR2Url.trim().isEmpty) {
      throw ArgumentError.value(
        ephemeralR2Url,
        'ephemeralR2Url',
        'La URL efímera de R2 no puede estar vacía.',
      );
    }
    final Uri? parsedUri = Uri.tryParse(ephemeralR2Url);
    if (parsedUri == null ||
        !parsedUri.hasScheme ||
        !parsedUri.hasAuthority ||
        (!parsedUri.isScheme('http') && !parsedUri.isScheme('https'))) {
      throw ArgumentError.value(
        ephemeralR2Url,
        'ephemeralR2Url',
        'La URL efímera de R2 debe ser una URI válida con esquema HTTP/HTTPS.',
      );
    }
    if (downloadToken.trim().isEmpty) {
      throw ArgumentError.value(
        downloadToken,
        'downloadToken',
        'El downloadToken no puede estar vacío.',
      );
    }
    if (sha256Checksum.trim().isEmpty) {
      throw ArgumentError.value(
        sha256Checksum,
        'sha256Checksum',
        'El sha256Checksum no puede estar vacío.',
      );
    }
    if (!_sha256Regex.hasMatch(sha256Checksum.trim())) {
      throw ArgumentError.value(
        sha256Checksum,
        'sha256Checksum',
        'El sha256Checksum debe ser una cadena hexadecimal válida de 64 caracteres.',
      );
    }
    if (!expiresAt.toUtc().isAfter(createdAt)) {
      throw ArgumentError(
        'La fecha de expiración ($expiresAt) debe ser posterior a la fecha de creación ($createdAt).',
      );
    }
  }

  /// Retorna si el enlace efímero ya ha expirado respecto a [at] (por defecto hora actual UTC).
  bool isExpired({DateTime? at}) {
    final DateTime checkTime = (at ?? DateTime.now()).toUtc();
    return checkTime.isAfter(expiresAt.toUtc());
  }

  /// Tiempo restante de vida del enlace efímero.
  Duration remainingLifetime({DateTime? at}) {
    final DateTime checkTime = (at ?? DateTime.now()).toUtc();
    return expiresAt.toUtc().difference(checkTime);
  }

  /// Certifica si el enlace cumple con la directiva de timeout estricto efímero (<15s) de BlueMarket.
  bool isStrictEphemeral({int maxTimeoutSeconds = 15}) {
    final int ttlSeconds = expiresAt.toUtc().difference(createdAt).inSeconds;
    return ttlSeconds <= maxTimeoutSeconds;
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'schema_version': schemaVersion,
    'fulfillment_id': fulfillmentId.trim(),
    'order_id': orderId.trim(),
    'sku': sku.trim(),
    'customer_id': customerId.trim(),
    'ephemeral_r2_url': ephemeralR2Url.trim(),
    'download_token': downloadToken.trim(),
    'sha256_checksum': sha256Checksum.trim().toLowerCase(),
    'created_at': createdAt.toIso8601String(),
    'expires_at': expiresAt.toUtc().toIso8601String(),
    if (metadata.isNotEmpty) 'metadata': metadata,
  };

  factory DigitalFulfillmentDTO.fromJson(Map<String, dynamic> json) {
    final String? rawSchema = json['schema_version'] as String?;
    if (json.containsKey('schema_version') &&
        (rawSchema == null || rawSchema.trim().isEmpty)) {
      throw ArgumentError(
        'El campo "schema_version" no puede estar vacío en DigitalFulfillmentDTO.',
      );
    }
    final String schemaVersion =
        (rawSchema != null && rawSchema.trim().isNotEmpty)
        ? rawSchema.trim()
        : defaultSchemaVersion;

    final String? fulfillmentId = json['fulfillment_id'] as String?;
    if (fulfillmentId == null || fulfillmentId.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "fulfillment_id" faltante en DigitalFulfillmentDTO.',
      );
    }
    final String? orderId = json['order_id'] as String?;
    if (orderId == null || orderId.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "order_id" faltante en DigitalFulfillmentDTO.',
      );
    }
    final String? sku = json['sku'] as String?;
    if (sku == null || sku.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "sku" faltante en DigitalFulfillmentDTO.',
      );
    }
    final String? customerId = json['customer_id'] as String?;
    if (customerId == null || customerId.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "customer_id" faltante en DigitalFulfillmentDTO.',
      );
    }
    final String? ephemeralR2Url = json['ephemeral_r2_url'] as String?;
    if (ephemeralR2Url == null || ephemeralR2Url.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "ephemeral_r2_url" faltante en DigitalFulfillmentDTO.',
      );
    }
    final String? downloadToken = json['download_token'] as String?;
    if (downloadToken == null || downloadToken.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "download_token" faltante en DigitalFulfillmentDTO.',
      );
    }
    final String? sha256Checksum = json['sha256_checksum'] as String?;
    if (sha256Checksum == null || sha256Checksum.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "sha256_checksum" faltante en DigitalFulfillmentDTO.',
      );
    }
    final String? expiresAtStr = json['expires_at'] as String?;
    if (expiresAtStr == null || expiresAtStr.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "expires_at" faltante en DigitalFulfillmentDTO.',
      );
    }

    final String? createdAtStr = json['created_at'] as String?;
    final DateTime? createdAt = createdAtStr != null
        ? DateTime.tryParse(createdAtStr)
        : null;

    return DigitalFulfillmentDTO(
      schemaVersion: schemaVersion,
      fulfillmentId: fulfillmentId,
      orderId: orderId,
      sku: sku,
      customerId: customerId,
      ephemeralR2Url: ephemeralR2Url,
      downloadToken: downloadToken,
      sha256Checksum: sha256Checksum,
      createdAt: createdAt,
      expiresAt: DateTime.parse(expiresAtStr),
      metadata:
          (json['metadata'] as Map<String, dynamic>?) ??
          const <String, dynamic>{},
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
      other is DigitalFulfillmentDTO &&
          runtimeType == other.runtimeType &&
          schemaVersion == other.schemaVersion &&
          fulfillmentId == other.fulfillmentId &&
          orderId == other.orderId &&
          sku == other.sku &&
          customerId == other.customerId &&
          ephemeralR2Url == other.ephemeralR2Url &&
          downloadToken == other.downloadToken &&
          sha256Checksum == other.sha256Checksum;

  @override
  int get hashCode => Object.hash(
    schemaVersion,
    fulfillmentId,
    orderId,
    sku,
    customerId,
    ephemeralR2Url,
    downloadToken,
    sha256Checksum,
  );

  @override
  String toString() =>
      'DigitalFulfillmentDTO(id: $fulfillmentId, sku: $sku, customer: $customerId, expires: $expiresAt)';
}
