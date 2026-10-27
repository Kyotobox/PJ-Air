/// JargonDictionary define la matriz de jerga local hispanohablante y modismos regionales (VE, MX, CO, AR, CL, LATAM).
class JargonDictionary {
  /// Mapeo de términos de jerga local a la categoría canónica correspondiente.
  static const Map<String, String> jargonToCanonicalCategory = <String, String>{
    // Bombas de Gasolina
    'pila de araya': 'Bomba de Gasolina',
    'pila de gasolina': 'Bomba de Gasolina',
    'pila de inyeccion': 'Bomba de Gasolina',
    'pila gasolina': 'Bomba de Gasolina',
    'pila inyeccion': 'Bomba de Gasolina',

    // Brazos de Control / Suspensión
    'meseta': 'Brazo de Control',
    'mesetas': 'Brazo de Control',
    'horquilla': 'Brazo de Control',
    'horquillas': 'Brazo de Control',
    'tijera': 'Brazo de Control',
    'tijeras': 'Brazo de Control',
    'parrilla de suspension': 'Brazo de Control',
    'parrillas de suspension': 'Brazo de Control',
    'brazo de suspension': 'Brazo de Control',

    // Juntas Homocinéticas / Tripoides
    'tripoide': 'Junta Homocinetica',
    'tripoides': 'Junta Homocinetica',
    'espiga': 'Junta Homocinetica',
    'espigas': 'Junta Homocinetica',
    'punta de eje': 'Junta Homocinetica',
    'puntas de eje': 'Junta Homocinetica',

    // Rótulas
    'muñon': 'Rotula de Suspension',
    'muñon de suspension': 'Rotula de Suspension',
    'muñones': 'Rotula de Suspension',
    'rotula': 'Rotula de Suspension',
    'rotulas': 'Rotula de Suspension',

    // Embrague / Clutch
    'croche': 'Kit de Embrague',
    'kit de croche': 'Kit de Embrague',
    'clutch': 'Kit de Embrague',
    'kit de clutch': 'Kit de Embrague',
    'embrague': 'Kit de Embrague',
    'bombin de croche': 'Cilindro Maestro de Embrague',
    'bombin inferior': 'Cilindro Esclavo de Embrague',
    'bombin superior': 'Cilindro Maestro de Embrague',

    // Empacaduras / Juntas
    'empacadura de camara': 'Empaque de Tapa de Cilindros',
    'empaque de cabeza': 'Empaque de Tapa de Cilindros',
    'empaque de culata': 'Empaque de Tapa de Cilindros',
    'junta de tapa de cilindros': 'Empaque de Tapa de Cilindros',

    // Rodamientos / Ruedas
    'rolinera': 'Rodamiento de Rueda',
    'rolineras': 'Rodamiento de Rueda',
    'balero': 'Rodamiento de Rueda',
    'baleros': 'Rodamiento de Rueda',
    'ruleman': 'Rodamiento de Rueda',
    'rulemanes': 'Rodamiento de Rueda',
    'mozo': 'Bocin de Rueda',
    'mozos': 'Bocin de Rueda',
    'maza': 'Bocin de Rueda',
    'mazas': 'Bocin de Rueda',
    'bocin': 'Bocin de Rueda',
    'bocines': 'Bocin de Rueda',

    // Tricetas
    'tripoidina': 'Triceta Homocinetica',
    'tripoidinas': 'Triceta Homocinetica',
    'triceta': 'Triceta Homocinetica',
    'tricetas': 'Triceta Homocinetica',

    // Depósitos / Refrigeración
    'envase de agua': 'Deposito de Refrigerante',
    'tanque de agua': 'Deposito de Refrigerante',
    'deposito de anticongelante': 'Deposito de Refrigerante',

    // Dirección
    'cremallera de direccion': 'Caja de Direccion',
    'cajetin de direccion': 'Caja de Direccion',
    'cajetin': 'Caja de Direccion',

    // Frenos
    'pastillas de freno': 'Pastillas de Freno',
    'balatas': 'Pastillas de Freno',
    'balatas de freno': 'Pastillas de Freno',
    'bandas de freno': 'Zapatas de Freno',
    'zapatas de freno': 'Zapatas de Freno',
  };

  /// Normaliza un término de jerga o modismo hacia su categoría canónica si existe.
  static String? getCanonicalCategory(String term) {
    if (term.trim().isEmpty) return null;
    final String clean = term.toLowerCase().trim();
    return jargonToCanonicalCategory[clean];
  }
}
