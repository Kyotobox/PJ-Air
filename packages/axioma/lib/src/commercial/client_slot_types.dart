// client_slot_types.dart — Enums y Tipos de Slots para ADN de Clientes (§39, §60.2)
library;

/// Nivel epistémico de veracidad para hechos del cliente (§47, §54.6).
enum EpistemicStatus {
  /// Hecho certificado con cita observable (ticket, factura, mensaje explícito).
  confirmed('CONFIRMADO'),

  /// Hecho deducido por inferencia estadística o contextual con score de confianza.
  inferred('INFERIDO'),

  /// Ausencia formal de dato o valor desconocido.
  unknown('SIN_DATO');

  final String wireName;

  const EpistemicStatus(this.wireName);

  /// Parsea una cadena al enum correspondiente o lanza [ArgumentError] ante valor inválido.
  static EpistemicStatus fromString(String val) {
    final String clean = val.trim().toUpperCase();
    for (final EpistemicStatus status in EpistemicStatus.values) {
      if (status.name.toUpperCase() == clean || status.wireName == clean) {
        return status;
      }
    }
    throw ArgumentError.value(
      val,
      'val',
      'Estado epistémico desconocido: "$val". Esperado: CONFIRMADO, INFERIDO o SIN_DATO.',
    );
  }

  /// Indica si el estado tiene certeza suficiente para decisiones comerciales críticas.
  bool get isConfirmed => this == EpistemicStatus.confirmed;
}

/// Clasificación canónica del tipo de cliente.
enum ClientType {
  /// Cliente empresarial / Flotas / Mayoristas.
  b2b('B2B'),

  /// Consumidor final / Minorista.
  b2c('B2C');

  final String wireName;

  const ClientType(this.wireName);

  /// Parsea [val] a [ClientType] o lanza [ArgumentError] si no es válido.
  static ClientType fromString(String val) {
    final String clean = val.trim().toUpperCase();
    for (final ClientType type in ClientType.values) {
      if (type.name.toUpperCase() == clean || type.wireName == clean) {
        return type;
      }
    }
    throw ArgumentError.value(
      val,
      'val',
      'Tipo de cliente inválido: "$val". Esperado: B2B o B2C.',
    );
  }
}

/// Catálogo cerrado de slots de hechos para ADN de cliente B2B y B2C.
enum ClientSlotType {
  // Slots B2B
  b2bFleetSize('b2b_fleet_size', isB2B: true),
  b2bPreferredSku('b2b_preferred_sku', isB2B: true),
  b2bCreditLimit('b2b_credit_limit', isB2B: true),
  b2bPaymentTerms('b2b_payment_terms', isB2B: true),
  b2bTaxId('b2b_tax_id', isB2B: true),
  b2bBusinessName('b2b_business_name', isB2B: true),
  b2bIndustry('b2b_industry', isB2B: true),

  // Slots B2C
  b2cOrderHistory('b2c_order_history', isB2C: true),
  b2cPreferredChannel('b2c_preferred_channel', isB2C: true),
  b2cLanguage('b2c_language', isB2C: true),
  b2cDeliveryAddress('b2c_delivery_address', isB2C: true),
  b2cContactPhone('b2c_contact_phone', isB2C: true),
  b2cPaymentMethod('b2c_payment_method', isB2C: true),

  // Slots Generales / Operacionales
  customerSegment('customer_segment', isB2B: true, isB2C: true),
  riskLevel('risk_level', isB2B: true, isB2C: true),
  notes('notes', isB2B: true, isB2C: true);

  final String wireName;
  final bool isB2B;
  final bool isB2C;

  const ClientSlotType(this.wireName, {this.isB2B = false, this.isB2C = false});

  /// Parsea [val] a [ClientSlotType] o arroja [ArgumentError] si el slot no está en catálogo.
  static ClientSlotType fromString(String val) {
    final String clean = val.trim().toLowerCase();
    for (final ClientSlotType slot in ClientSlotType.values) {
      if (slot.name.toLowerCase() == clean || slot.wireName == clean) {
        return slot;
      }
    }
    throw ArgumentError.value(
      val,
      'val',
      'SlotType desconocido o fuera de catálogo cerrado: "$val".',
    );
  }

  /// Valida restricciones del valor asignado al slot (§6).
  void validateValue(dynamic value) {
    if (value == null) {
      throw ArgumentError.notNull('value');
    }
    switch (this) {
      case ClientSlotType.b2bFleetSize:
        if (value is! int || value < 0) {
          throw ArgumentError(
            'b2bFleetSize debe ser un entero no negativo. Recibido: $value',
          );
        }
      case ClientSlotType.b2bCreditLimit:
        if ((value is! num) || value < 0) {
          throw ArgumentError(
            'b2bCreditLimit debe ser un número >= 0. Recibido: $value',
          );
        }
      case ClientSlotType.b2bTaxId:
      case ClientSlotType.b2bBusinessName:
      case ClientSlotType.b2cContactPhone:
      case ClientSlotType.b2cLanguage:
        if (value is! String || value.trim().isEmpty) {
          throw ArgumentError(
            '$name requiere un texto no vacío. Recibido: $value',
          );
        }
      default:
        // Otros slots admiten cadenas, números, listas o mapas válidos.
        break;
    }
  }
}
