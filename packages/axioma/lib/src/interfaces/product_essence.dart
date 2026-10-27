import '../axiom_version.dart';

/// ProductEssence: Interfaz mínima para la interoperabilidad de productos en el bus Nexus.
/// Define el "ADN" básico que cualquier nodo debe proveer para ser reconocido como un producto.
@AxiomVersion('1.0.0')
abstract class ProductEssence {
  /// Identificador único del producto en el ecosistema.
  String get productId;

  /// Nombre comercial del producto.
  String get productName;

  /// Precio base sin impuestos ni descuentos.
  double get basePrice;

  /// Stock unitario (opcional, null si es servicio).
  double? get stock;

  /// Código SKU o EAN para identificación física.
  String? get sku;

  /// Metadatos extendidos de la esencia.
  Map<String, dynamic> get metadata;
}
