import '../../axiom_version.dart';

/// [TASK-C08-01] Centralización de Expresiones Regulares para el Dominio Automotriz.
@AxiomVersion('1.0.0')
abstract class PartDomainRegex {
  /// Identificación de código OEM/SKU que contiene letras y números.
  static final RegExp alphanumericPartCode = RegExp(
    r'^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]+$',
  );

  /// Identificación de código OEM/SKU que contiene solo números (mínimo 3).
  static final RegExp numericPartCode = RegExp(r'^[0-9]{3,}$');

  /// Detección de columna de aplicación / vehículo / modelo / motor.
  static final RegExp applicationKeyword = RegExp(
    r'aplicaci[oó]n|modelo|vehiculo|veh[ií]culo|motor',
    caseSensitive: false,
  );

  /// Separador de referencias múltiples fusionadas.
  static final RegExp referenceSeparator = RegExp(r'[/|]');

  /// Detección de código y descripción fusionados en una celda.
  static final RegExp fusedCodeDescription = RegExp(
    r'^([A-Z0-9-]+)\s+([A-Za-zñÑáéíóúÁÉÍÓÚ].+)$',
  );

  /// Normalización de ruido alfanumérico en precios.
  static final RegExp nonNumericPrice = RegExp(r'[^0-9.,]');

  /// Stock fusionado con precio (ej: "29,11 4").
  static final RegExp fusedPriceStock = RegExp(r'^(\d+[,.]\d+)\s+(\d+)$');

  /// Normalización de espacios en blanco múltiples.
  static final RegExp whitespaceNormalize = RegExp(r'\s+');
}
