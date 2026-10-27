/// BrandDictionary define la lista blanca estricta y alias de marcas de vehículos globales y regionales.
class BrandDictionary {
  static Set<String> get values => whitelist;

  /// Lista Blanca Estricta (SSSoT). Marcas vehiculares legítimas a nivel global y regional.
  static const Set<String> whitelist = <String>{
    'TOYOTA',
    'CHEVROLET',
    'FORD',
    'MAZDA',
    'HYUNDAI',
    'KIA',
    'NISSAN',
    'FIAT',
    'JEEP',
    'DAEWOO',
    'DODGE',
    'RENAULT',
    'MITSUBISHI',
    'HONDA',
    'SUZUKI',
    'VOLKSWAGEN',
    'PEUGEOT',
    'CHERY',
    'ISUZU',
    'RAM',
    'CHRYSLER',
    'JAC',
    'DAIHATSU',
    'SEAT',
    'DONGFENG',
    'DACIA',
    'AUDI',
    'GREAT WALL',
    'BMW',
    'MERCEDES-BENZ',
    'VOLVO',
    'LAND ROVER',
    'PORSCHE',
    'SUBARU',
    'LEXUS',
    'ACURA',
    'INFINITI',
    'ALFA ROMEO',
    'ASTON MARTIN',
    'BENTLEY',
    'BUGATTI',
    'BUICK',
    'CADILLAC',
    'CITROEN',
    'FERRARI',
    'GMC',
    'JAGUAR',
    'LAMBORGHINI',
    'LINCOLN',
    'MASERATI',
    'MCLAREN',
    'MINI',
    'PONTIAC',
    'ROLLS-ROYCE',
    'SAAB',
    'SMART',
    'TESLA',
    'LADA',
    'SKODA',
    'SSANGYONG',
    'TATA',
    'MAHINDRA',
    'CHANA',
    'GEELY',
    'ZOTYE',
    'CHANGAN',
    'BYD',
    'BAIC',
    'MG',
    'ROVER',
    'OPEL',
    'VAUXHALL',
    'LANCIA',
    'SCANIA',
    'IVECO',
    'MACK',
    'KENWORTH',
    'FREIGHTLINER',
    'INTERNATIONAL',
    'PETERBILT',
    'HINO',
    'CUMMINS',
    'DETROIT DIESEL',
    'CATERPILLAR',
    'VOLKSWAGEN CAMINHÕES',
    'UNIVERSAL',
  };

  /// Diccionario de Aliases y Corrección Ortotipográfica
  static const Map<String, String> aliases = <String, String>{
    'VW': 'VOLKSWAGEN',
    'CHEVY': 'CHEVROLET',
    'CHEV': 'CHEVROLET',
    'CHEVROLET,': 'CHEVROLET',
    'MERCEDES': 'MERCEDES-BENZ',
    'MERCEDES BENZ': 'MERCEDES-BENZ',
    'MB': 'MERCEDES-BENZ',
    'LANDROVER': 'LAND ROVER',
    'ALFA': 'ALFA ROMEO',
    'CITROËN': 'CITROEN',
    'SSANG YONG': 'SSANGYONG',
    'GREATWALL': 'GREAT WALL',
    'MITSUBICHI': 'MITSUBISHI',
    'DODGE/RAM': 'DODGE',
  };

  /// Normaliza una marca cruda.
  /// Si retorna null, significa que es ruido/basura y debe ser destruido.
  static String? normalize(String rawMake) {
    String make = rawMake.toUpperCase().trim();

    // 1. Limpieza de ruido superficial
    make = make.replaceAll(
      RegExp(r'[^\w\s\-]'),
      '',
    ); // Elimina puntuación extraña excepto guiones
    make = make.trim();

    // 2. Aplicar Alias
    if (aliases.containsKey(make)) {
      make = aliases[make]!;
    }

    // Reglas heurísticas rápidas antes de la whitelist estricta
    if (make.startsWith('CHEV')) {
      make = 'CHEVROLET'; // Captura 'CHEVROLET  ', 'CHEV.'
    }
    if (make == 'VW') make = 'VOLKSWAGEN';

    // 3. Validar contra Whitelist Estricta
    if (whitelist.contains(make)) {
      return make;
    }

    // 4. Búsqueda flexible de la Whitelist como substring (peligroso, pero útil para "FORD TRUCK")
    for (String valid in whitelist) {
      if (make.contains(valid)) {
        // Ej: "TOYOTA TRUCK" -> "TOYOTA"
        return valid;
      }
    }

    return null;
  }
}
