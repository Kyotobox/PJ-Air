/// PartBrandDictionary define la lista blanca estricta y alias de marcas de autopartes (Aftermarket y OEM).
class PartBrandDictionary {
  static Set<String> get values => whitelist;

  /// Lista Blanca Estricta (SSSoT) de Fabricantes de Autopartes (Aftermarket y OEM)
  static const Set<String> whitelist = <String>{
    'SKF',
    'DORMAN',
    'K&N FILTERS',
    'MHW',
    'WPI',
    'STANDARD MOTOR PRODUCTS',
    'EMASA',
    'AISIN',
    'NAVC',
    'NAVCAR',
    'VULKO',
    'CAP',
    'SABO',
    'MAHLE',
    'CAUPLAS',
    'CHAMPION',
    'PERFECT',
    'SAKURA',
    'NGK',
    'NTK',
    'WIX',
    'SPICER',
    'BOSCH',
    'ACDELCO',
    'BREMBO',
    'GABRIEL',
    'MILLARD',
    'AKRON',
    'GOLD',
    'TAIKEN',
    'KOYO',
    'NPR',
    'FRAC',
    'FRACO',
    'RIK',
    'TP',
    'FKG',
    'MASTER',
    'EXACT',
    'DAIMOKU',
    'F1 RACING',
    'VALEO',
    'DELPHI',
    'DENSO',
    'HELLA',
    'TRW',
    'MONROE',
    'KYB',
    'LUK',
    'INA',
    'FAG',
    'DAYCO',
    'GATES',
    'MANN-FILTER',
    'FRAM',
    'MAHLE ORIGINAL',
    'MOOG',
    'FEL-PRO',
    'TIMKEN',
    'MOTORCRAFT',
    'MOPAR',
    'GENUINE PARTS',
    'OEM',
    'UNKNOWN',
    'CHEVROLET',
    'TOYOTA',
    'FORD',
    'HYUNDAI',
    'KIA',
    'HONDA',
    'RENAULT',
    'VOLKSWAGEN',
    'FIAT',
    'PEUGEOT',
    'CHRYSLER',
    'DODGE',
    'JEEP',
    'NISSAN',
    'MITSUBISHI',
    'MAZDA',
  };

  /// Aliases para normalizar variantes comunes
  static const Map<String, String> aliases = <String, String>{
    'K&N': 'K&N FILTERS',
    'SMP': 'STANDARD MOTOR PRODUCTS',
    'XYAISIN': 'AISIN',
    'CAUP': 'CAUPLAS',
    'NGK/NTK': 'NGK',
    'BOSC': 'BOSCH',
    'VW': 'VOLKSWAGEN',
  };

  /// Normaliza una marca de autoparte.
  /// Retorna un string "UNKNOWN" si es considerada basura, para no descartar la pieza.
  static String normalize(String? rawBrand) {
    if (rawBrand == null || rawBrand.trim().isEmpty) return 'UNKNOWN';
    String brand = rawBrand.toUpperCase().trim();

    // 1. Limpieza inicial de basuras comunes de extensiones y sufijos
    if (brand.contains('WEB') ||
        brand.contains('CATALOGO') ||
        brand.contains('FINAL') ||
        brand.contains('.XLSX') ||
        brand.contains('.CSV') ||
        brand.contains('.PDF')) {
      return 'UNKNOWN';
    }

    // 2. Aplicar Alias
    if (aliases.containsKey(brand)) {
      brand = aliases[brand]!;
    }

    // 3. Validar contra Whitelist
    if (whitelist.contains(brand)) {
      return brand;
    }

    // 4. Heurística: Si la marca tiene más de 30 caracteres, probablemente es una descripción mal parseada
    if (brand.length > 30) {
      return 'UNKNOWN';
    }

    // 5. Heurística: Si la marca tiene dígitos en el medio estructurados como un SKU (ej. "ga 21 17"), es basura
    if (RegExp(r'^\w+\s\d+\s\d+$').hasMatch(brand) ||
        RegExp(r'\d{4,}').hasMatch(brand)) {
      return 'UNKNOWN';
    }

    // 6. Remover ruido de puntuación (excepto guiones, ampersands, slashes)
    brand = brand.replaceAll(RegExp(r'[^\w\s\-\&\/]'), '').trim();
    if (brand.isEmpty) return 'UNKNOWN';

    // Como dice la instruccion, no descartamos piezas legítimas, asi que si no es ruido obvio, lo mantenemos.
    return brand;
  }
}
