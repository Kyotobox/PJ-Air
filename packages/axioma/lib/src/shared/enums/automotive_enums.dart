import 'package:json_annotation/json_annotation.dart';

/// Tipo de cálculo aplicado a una condición de precio.
enum CalculationType {
  @JsonValue('PERCENTAGE')
  percentage,
  @JsonValue('FIXED_AMOUNT')
  fixedAmount,
}

/// Operación aritmética de la condición.
enum ConditionOperation {
  @JsonValue('ADD')
  add,
  @JsonValue('SUBTRACT')
  subtract,
}

/// Alcance de la aplicación de la condición.
enum ConditionScope {
  @JsonValue('PER_ITEM')
  perItem,
  @JsonValue('GLOBAL')
  global,
}
