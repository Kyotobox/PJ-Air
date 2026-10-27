/// TaxonomyMatrix define qué atributos son válidos o aplicables a cada categoría de autoparte
/// para evitar falsos positivos de deuda técnica (evaluando incompletitud).
class TaxonomyMatrix {
  static const Map<String, List<String>>
  categoryAttributes = <String, List<String>>{
    'FRENO': <String>[
      'posicion',
      'material',
      'espesor',
      'diametro',
      'sistema_freno',
    ],
    'AMORTIGUADOR': <String>[
      'posicion',
      'lado',
      'tipo_gas_aceite',
      'longitud_comprimida',
      'longitud_extendida',
    ],
    'FILTRO': <String>['tipo_filtro', 'altura', 'diametro_exterior', 'rosca'],
    'CORREA': <String>['longitud', 'ancho', 'numero_dientes', 'perfil'],
    'MOTOR': <String>[
      'cilindrada',
      'cilindros',
      'combustible',
      'familia_motor',
    ],
    'ANILLOS': <String>[
      'medida_estandar_sobremedida',
      'diametro_piston',
      'espesor_anillo',
    ],
    'EMPAQUE': <String>['material', 'espesor', 'ubicacion'],
    'RODAMIENTO': <String>['diametro_interior', 'diametro_exterior', 'ancho'],
    'SENSOR': <String>['numero_pines', 'voltaje', 'tipo_conexion'],
  };

  /// Verifica si un atributo aplica formalmente a una categoría de producto
  static bool isAttributeApplicable(String category, String attributeName) {
    final String normalizedCategory = category.trim().toUpperCase();
    final String normalizedAttr = attributeName.trim().toLowerCase();

    final List<String>? validAttrs = categoryAttributes[normalizedCategory];
    if (validAttrs == null) return false;
    return validAttrs.contains(normalizedAttr);
  }

  /// Retorna la lista de atributos esperados para una categoría
  static List<String> getExpectedAttributes(String category) {
    final String normalizedCategory = category.trim().toUpperCase();
    return categoryAttributes[normalizedCategory] ?? const <String>[];
  }
}
