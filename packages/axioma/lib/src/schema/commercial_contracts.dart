/// commercial_contracts.dart — Contratos de Datos Canónicos Comerciales y Socráticos (§4, §6, §39, §58).
///
/// Define los DTOs inmutables para el flujo comercial trinodal (Smart Core -> Levita -> BlueMarket):
/// - CommercialProductContract: Oferta exportable con margen y validación financiera.
/// - CommercialOrderHandoffContract: Handoff de orden confirmada para aprovisionamiento JIT.
/// - CommercialDeliveryPayload: Payload de entrega digital para despacho al cliente final.
///
/// Pure Dart agnóstico de frameworks de UI (§39).
library;

// =============================================================================
// EXCEPCIONES TIPADAS DE CONTRATOS COMERCIALES (§6 SAD PATH MANDATORIO)
// =============================================================================

/// Excepción base para el subsistema de contratos comerciales.
abstract class CommercialContractException implements Exception {
  final String message;
  final dynamic details;

  const CommercialContractException(this.message, [this.details]);

  @override
  String toString() =>
      'CommercialContractException: $message${details != null ? ' (Detalles: $details)' : ''}';
}

/// Sad Path: Validación fallida en campos de contratos comerciales.
class CommercialValidationException extends CommercialContractException {
  final String fieldName;
  final dynamic rejectedValue;

  const CommercialValidationException({
    required String message,
    required this.fieldName,
    this.rejectedValue,
    dynamic details,
  }) : super(message, details);

  @override
  String toString() =>
      'CommercialValidationException: $message [Campo: $fieldName, Valor: $rejectedValue]';
}

/// Sad Path: Error de coerción o deserialización de datos comerciales.
class CommercialCoercionException extends CommercialContractException {
  final String expectedType;
  final dynamic rawValue;

  const CommercialCoercionException({
    required String message,
    required this.expectedType,
    this.rawValue,
    dynamic details,
  }) : super(message, details);

  @override
  String toString() =>
      'CommercialCoercionException: $message [Esperado: $expectedType, Recibido: $rawValue]';
}

// =============================================================================
// TIPOS DE ENTREGA DIGITAL
// =============================================================================

/// Modalidad de entrega del activo digital.
enum CommercialDeliveryType {
  /// Archivo estático descargable (PDF, ZIP, APK, firmware).
  staticAsset,

  /// Cuenta o credencial dinámica aprovisionada JIT (Telegram bot, streaming, SaaS).
  dynamicAccount,

  /// Clave de licencia o código de activación.
  licenseKey,

  /// Suscripción o servicio recurrente.
  serviceSubscription;

  /// Serialización a String.
  String toJson() => name;

  /// Deserialización segura con Sad Path (§6).
  static CommercialDeliveryType fromJson(dynamic value) {
    if (value is CommercialDeliveryType) return value;
    if (value is! String) {
      throw CommercialCoercionException(
        message: 'El tipo de entrega debe ser un String no nulo.',
        expectedType: 'CommercialDeliveryType (String)',
        rawValue: value,
      );
    }
    for (final CommercialDeliveryType type in CommercialDeliveryType.values) {
      if (type.name.toLowerCase() == value.trim().toLowerCase()) {
        return type;
      }
    }
    throw CommercialCoercionException(
      message: 'Tipo de entrega no reconocido: "$value".',
      expectedType:
          'CommercialDeliveryType (${CommercialDeliveryType.values.map((CommercialDeliveryType e) => e.name).join(', ')})',
      rawValue: value,
    );
  }
}

// =============================================================================
// DTOs INMUTABLES COMERCIALES
// =============================================================================

/// Contrato de oferta de producto exportable (BlueMarket -> Levita).
class CommercialProductContract {
  final String sku;
  final String title;
  final String category;
  final double costUsd;
  final double retailUsd;
  final CommercialDeliveryType deliveryType;
  final int stockAvailable;
  final String? downloadUrl;
  final Map<String, dynamic> metadata;

  CommercialProductContract({
    required this.sku,
    required this.title,
    this.category = 'digital_goods',
    required this.costUsd,
    required this.retailUsd,
    required this.deliveryType,
    required this.stockAvailable,
    this.downloadUrl,
    Map<String, dynamic>? metadata,
  }) : metadata = Map.unmodifiable(metadata ?? const <dynamic, dynamic>{}) {
    _validate();
  }

  void _validate() {
    if (sku.trim().isEmpty) {
      throw const CommercialValidationException(
        message: 'El SKU no puede estar vacío ni contener solo espacios.',
        fieldName: 'sku',
      );
    }
    if (title.trim().isEmpty) {
      throw const CommercialValidationException(
        message: 'El título del producto no puede estar vacío.',
        fieldName: 'title',
      );
    }
    if (costUsd < 0.0) {
      throw CommercialValidationException(
        message: 'El costo del producto no puede ser negativo.',
        fieldName: 'costUsd',
        rejectedValue: costUsd,
      );
    }
    if (retailUsd <= 0.0) {
      throw CommercialValidationException(
        message:
            'El precio de venta (retail) debe ser estrictamente mayor a 0.',
        fieldName: 'retailUsd',
        rejectedValue: retailUsd,
      );
    }
    if (retailUsd < costUsd) {
      throw CommercialValidationException(
        message:
            'El precio retail ($retailUsd USD) no puede ser menor al costo ($costUsd USD). Margen negativo prohibido.',
        fieldName: 'retailUsd',
        rejectedValue: retailUsd,
      );
    }
    if (stockAvailable < 0) {
      throw CommercialValidationException(
        message: 'El stock disponible no puede ser un número negativo.',
        fieldName: 'stockAvailable',
        rejectedValue: stockAvailable,
      );
    }
  }

  /// Margen porcentual calculado sobre el precio retail: ((retail - cost) / retail) * 100.
  double get marginPct => ((retailUsd - costUsd) / retailUsd) * 100.0;

  /// Margen neto en dólares.
  double get marginUsd => retailUsd - costUsd;

  /// Clasificación de alto margen comercial (>= 60%).
  bool get isHighMargin => marginPct >= 60.0;

  /// Serialización a Map JSON.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'sku': sku,
    'title': title,
    'category': category,
    'cost_usd': costUsd,
    'retail_usd': retailUsd,
    'delivery_type': deliveryType.toJson(),
    'stock_available': stockAvailable,
    if (downloadUrl != null) 'download_url': downloadUrl,
    'margin_pct': double.parse(marginPct.toStringAsFixed(2)),
    'metadata': metadata,
  };

  /// Deserialización desde Map JSON con validación y coerción segura (§6).
  factory CommercialProductContract.fromJson(Map<String, dynamic> json) {
    final rawSku = json['sku'] ?? json['id'];
    if (rawSku == null || rawSku.toString().trim().isEmpty) {
      throw const CommercialValidationException(
        message: 'Campo requerido "sku" ausente o vacío en el payload.',
        fieldName: 'sku',
      );
    }

    final rawTitle = json['title'] ?? json['name'];
    if (rawTitle == null || rawTitle.toString().trim().isEmpty) {
      throw const CommercialValidationException(
        message: 'Campo requerido "title" ausente o vacío en el payload.',
        fieldName: 'title',
      );
    }

    final rawCost = json['cost_usd'] ?? json['cost'];
    if (rawCost == null) {
      throw const CommercialValidationException(
        message: 'Campo requerido "cost_usd" ausente en el payload.',
        fieldName: 'cost_usd',
      );
    }
    final double costUsd;
    if (rawCost is num) {
      costUsd = rawCost.toDouble();
    } else {
      costUsd =
          double.tryParse(rawCost.toString()) ??
          (throw CommercialCoercionException(
            message: 'No se puede convertir costo a double: "$rawCost"',
            expectedType: 'double',
            rawValue: rawCost,
          ));
    }

    final rawRetail = json['retail_usd'] ?? json['price_usd'] ?? json['price'];
    if (rawRetail == null) {
      throw const CommercialValidationException(
        message: 'Campo requerido "retail_usd" ausente en el payload.',
        fieldName: 'retail_usd',
      );
    }
    final double retailUsd;
    if (rawRetail is num) {
      retailUsd = rawRetail.toDouble();
    } else {
      retailUsd =
          double.tryParse(rawRetail.toString()) ??
          (throw CommercialCoercionException(
            message: 'No se puede convertir precio a double: "$rawRetail"',
            expectedType: 'double',
            rawValue: rawRetail,
          ));
    }

    final rawType = json['delivery_type'] ?? 'staticAsset';
    final CommercialDeliveryType deliveryType = CommercialDeliveryType.fromJson(
      rawType,
    );

    final rawStock = json['stock_available'] ?? json['stock'] ?? 0;
    final int stockAvailable;
    if (rawStock is int) {
      stockAvailable = rawStock;
    } else if (rawStock is num) {
      stockAvailable = rawStock.toInt();
    } else {
      stockAvailable =
          int.tryParse(rawStock.toString()) ??
          (throw CommercialCoercionException(
            message: 'No se puede convertir stock a int: "$rawStock"',
            expectedType: 'int',
            rawValue: rawStock,
          ));
    }

    final String rawCategory = json['category']?.toString() ?? 'digital_goods';
    final String? rawDownloadUrl = json['download_url']?.toString();
    final Map<String, dynamic> rawMetadata =
        json['metadata'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(json['metadata'] as Map)
        : <String, dynamic>{};

    return CommercialProductContract(
      sku: rawSku.toString().trim(),
      title: rawTitle.toString().trim(),
      category: rawCategory,
      costUsd: costUsd,
      retailUsd: retailUsd,
      deliveryType: deliveryType,
      stockAvailable: stockAvailable,
      downloadUrl: rawDownloadUrl,
      metadata: rawMetadata,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CommercialProductContract &&
          runtimeType == other.runtimeType &&
          sku == other.sku &&
          retailUsd == other.retailUsd &&
          costUsd == other.costUsd;

  @override
  int get hashCode => sku.hashCode ^ retailUsd.hashCode ^ costUsd.hashCode;

  @override
  String toString() =>
      'CommercialProductContract(sku: $sku, title: $title, retail: \$$retailUsd, cost: \$$costUsd, margin: ${marginPct.toStringAsFixed(1)}%)';
}

/// Contrato de handoff de orden comercial confirmada (Levita -> BlueMarket).
class CommercialOrderHandoffContract {
  final String orderId;
  final String tenantId;
  final String customerPhone;
  final String sku;
  final int quantity;
  final double amountPaidUsd;
  final String paymentRef;
  final DateTime timestamp;
  final Map<String, dynamic> metadata;

  CommercialOrderHandoffContract({
    required this.orderId,
    required this.tenantId,
    required this.customerPhone,
    required this.sku,
    this.quantity = 1,
    required this.amountPaidUsd,
    required this.paymentRef,
    DateTime? timestamp,
    Map<String, dynamic>? metadata,
  }) : timestamp = timestamp ?? DateTime.now().toUtc(),
       metadata = Map.unmodifiable(metadata ?? const <dynamic, dynamic>{}) {
    _validate();
  }

  void _validate() {
    if (orderId.trim().isEmpty) {
      throw const CommercialValidationException(
        message: 'El identificador de orden no puede estar vacío.',
        fieldName: 'orderId',
      );
    }
    if (tenantId.trim().isEmpty) {
      throw const CommercialValidationException(
        message: 'El tenant_id no puede estar vacío.',
        fieldName: 'tenantId',
      );
    }
    final String cleanPhone = customerPhone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (cleanPhone.isEmpty || cleanPhone.length < 8) {
      throw CommercialValidationException(
        message:
            'Número de teléfono del cliente inválido o demasiado corto (mínimo 8 dígitos).',
        fieldName: 'customerPhone',
        rejectedValue: customerPhone,
      );
    }
    if (sku.trim().isEmpty) {
      throw const CommercialValidationException(
        message: 'El SKU ordenado no puede estar vacío.',
        fieldName: 'sku',
      );
    }
    if (quantity <= 0) {
      throw CommercialValidationException(
        message: 'La cantidad ordenada debe ser estrictamente mayor a 0.',
        fieldName: 'quantity',
        rejectedValue: quantity,
      );
    }
    if (amountPaidUsd <= 0.0) {
      throw CommercialValidationException(
        message: 'El monto pagado debe ser estrictamente mayor a 0.',
        fieldName: 'amountPaidUsd',
        rejectedValue: amountPaidUsd,
      );
    }
    if (paymentRef.trim().isEmpty) {
      throw const CommercialValidationException(
        message: 'La referencia de pago no puede estar vacía.',
        fieldName: 'paymentRef',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'order_id': orderId,
    'tenant_id': tenantId,
    'customer_phone': customerPhone,
    'sku': sku,
    'quantity': quantity,
    'amount_paid_usd': amountPaidUsd,
    'payment_ref': paymentRef,
    'timestamp': timestamp.toIso8601String(),
    'metadata': metadata,
  };

  factory CommercialOrderHandoffContract.fromJson(Map<String, dynamic> json) {
    final rawOrderId = json['order_id'] ?? json['id'];
    if (rawOrderId == null || rawOrderId.toString().trim().isEmpty) {
      throw const CommercialValidationException(
        message: 'Campo requerido "order_id" ausente o vacío.',
        fieldName: 'order_id',
      );
    }

    final rawTenant = json['tenant_id'] ?? 'bluemarket';
    final rawPhone = json['customer_phone'] ?? json['phone'];
    if (rawPhone == null || rawPhone.toString().trim().isEmpty) {
      throw const CommercialValidationException(
        message: 'Campo requerido "customer_phone" ausente o vacío.',
        fieldName: 'customer_phone',
      );
    }

    final rawSku = json['sku'];
    if (rawSku == null || rawSku.toString().trim().isEmpty) {
      throw const CommercialValidationException(
        message: 'Campo requerido "sku" ausente o vacío.',
        fieldName: 'sku',
      );
    }

    final rawQuantity = json['quantity'] ?? 1;
    final int quantity;
    if (rawQuantity is int) {
      quantity = rawQuantity;
    } else {
      quantity =
          int.tryParse(rawQuantity.toString()) ??
          (throw CommercialCoercionException(
            message: 'No se puede convertir quantity a int: "$rawQuantity"',
            expectedType: 'int',
            rawValue: rawQuantity,
          ));
    }

    final rawAmount = json['amount_paid_usd'] ?? json['amount'];
    if (rawAmount == null) {
      throw const CommercialValidationException(
        message: 'Campo requerido "amount_paid_usd" ausente.',
        fieldName: 'amount_paid_usd',
      );
    }
    final double amountPaidUsd;
    if (rawAmount is num) {
      amountPaidUsd = rawAmount.toDouble();
    } else {
      amountPaidUsd =
          double.tryParse(rawAmount.toString()) ??
          (throw CommercialCoercionException(
            message: 'No se puede convertir amount a double: "$rawAmount"',
            expectedType: 'double',
            rawValue: rawAmount,
          ));
    }

    final rawRef = json['payment_ref'] ?? json['ref'] ?? 'MANUAL_CONFIRMED';
    final rawTimestamp = json['timestamp'];
    final DateTime timestamp;
    if (rawTimestamp != null) {
      timestamp =
          DateTime.tryParse(rawTimestamp.toString())?.toUtc() ??
          DateTime.now().toUtc();
    } else {
      timestamp = DateTime.now().toUtc();
    }

    final Map<String, dynamic> rawMetadata =
        json['metadata'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(json['metadata'] as Map)
        : <String, dynamic>{};

    return CommercialOrderHandoffContract(
      orderId: rawOrderId.toString().trim(),
      tenantId: rawTenant.toString().trim(),
      customerPhone: rawPhone.toString().trim(),
      sku: rawSku.toString().trim(),
      quantity: quantity,
      amountPaidUsd: amountPaidUsd,
      paymentRef: rawRef.toString().trim(),
      timestamp: timestamp,
      metadata: rawMetadata,
    );
  }

  @override
  String toString() =>
      'CommercialOrderHandoffContract(orderId: $orderId, tenant: $tenantId, sku: $sku, amount: \$$amountPaidUsd, phone: $customerPhone)';
}

/// Payload de activo digital entregable (BlueMarket -> WhatsApp cliente).
class CommercialDeliveryPayload {
  final String orderId;
  final CommercialDeliveryType deliveryType;
  final String? licenseKey;
  final String? inviteLink;
  final Map<String, String>? accountCredentials;
  final String instructions;
  final DateTime deliveredAt;
  final Map<String, dynamic> metadata;

  CommercialDeliveryPayload({
    required this.orderId,
    required this.deliveryType,
    this.licenseKey,
    this.inviteLink,
    Map<String, String>? accountCredentials,
    required this.instructions,
    DateTime? deliveredAt,
    Map<String, dynamic>? metadata,
  }) : accountCredentials = accountCredentials != null
           ? Map.unmodifiable(accountCredentials)
           : null,
       deliveredAt = deliveredAt ?? DateTime.now().toUtc(),
       metadata = Map.unmodifiable(metadata ?? const <dynamic, dynamic>{}) {
    _validate();
  }

  void _validate() {
    if (orderId.trim().isEmpty) {
      throw const CommercialValidationException(
        message:
            'El identificador de orden en el payload no puede estar vacío.',
        fieldName: 'orderId',
      );
    }
    if (instructions.trim().isEmpty) {
      throw const CommercialValidationException(
        message: 'Las instrucciones de entrega no pueden estar vacías.',
        fieldName: 'instructions',
      );
    }

    final bool hasLicense = licenseKey != null && licenseKey!.trim().isNotEmpty;
    final bool hasInvite = inviteLink != null && inviteLink!.trim().isNotEmpty;
    final bool hasCreds =
        accountCredentials != null && accountCredentials!.isNotEmpty;

    if (!hasLicense && !hasInvite && !hasCreds) {
      throw const CommercialValidationException(
        message:
            'Al menos un activo de entrega (licencia, enlace o credenciales) debe estar presente y no vacío.',
        fieldName: 'deliveryAsset',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'order_id': orderId,
    'delivery_type': deliveryType.toJson(),
    if (licenseKey != null) 'license_key': licenseKey,
    if (inviteLink != null) 'invite_link': inviteLink,
    if (accountCredentials != null) 'account_credentials': accountCredentials,
    'instructions': instructions,
    'delivered_at': deliveredAt.toIso8601String(),
    'metadata': metadata,
  };

  factory CommercialDeliveryPayload.fromJson(Map<String, dynamic> json) {
    final rawOrderId = json['order_id'];
    if (rawOrderId == null || rawOrderId.toString().trim().isEmpty) {
      throw const CommercialValidationException(
        message: 'Campo requerido "order_id" ausente en payload de entrega.',
        fieldName: 'order_id',
      );
    }

    final rawType = json['delivery_type'];
    if (rawType == null) {
      throw const CommercialValidationException(
        message: 'Campo requerido "delivery_type" ausente.',
        fieldName: 'delivery_type',
      );
    }
    final CommercialDeliveryType deliveryType = CommercialDeliveryType.fromJson(
      rawType,
    );

    final String? rawLicense = json['license_key']?.toString();
    final String? rawInvite = json['invite_link']?.toString();
    Map<String, String>? credentials;
    if (json['account_credentials'] is Map) {
      credentials = (json['account_credentials'] as Map).map(
        (key, value) => MapEntry(key.toString(), value.toString()),
      );
    }

    final String rawInstructions = json['instructions']?.toString() ?? '';
    final rawDeliveredAt = json['delivered_at'];
    final DateTime deliveredAt;
    if (rawDeliveredAt != null) {
      deliveredAt =
          DateTime.tryParse(rawDeliveredAt.toString())?.toUtc() ??
          DateTime.now().toUtc();
    } else {
      deliveredAt = DateTime.now().toUtc();
    }

    final Map<String, dynamic> rawMetadata =
        json['metadata'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(json['metadata'] as Map)
        : <String, dynamic>{};

    return CommercialDeliveryPayload(
      orderId: rawOrderId.toString().trim(),
      deliveryType: deliveryType,
      licenseKey: rawLicense,
      inviteLink: rawInvite,
      accountCredentials: credentials,
      instructions: rawInstructions,
      deliveredAt: deliveredAt,
      metadata: rawMetadata,
    );
  }

  @override
  String toString() =>
      'CommercialDeliveryPayload(orderId: $orderId, type: ${deliveryType.name}, deliveredAt: $deliveredAt)';
}
