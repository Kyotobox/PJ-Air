import 'package:json_annotation/json_annotation.dart';

/// [AxiomVersion] 1.0.0 - Enums fundacionales para el dominio de Caja y Flujo de Efectivo.
enum TransactionType {
  @JsonValue('INGRESO')
  ingreso,
  @JsonValue('EGRESO')
  egreso,
}

enum PaymentSource {
  @JsonValue('CASH')
  cash,
  @JsonValue('TRANSFER')
  transfer,
}
