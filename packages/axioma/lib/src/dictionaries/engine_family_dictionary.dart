/// EngineFamilyDictionary define la lista blanca y mapa de familias de motores automotrices.
class EngineFamilyDictionary {
  static const Map<String, String> engineFamilies = <String, String>{
    'ZETEC ROCAM': 'Zetec Rocam',
    'ROCAM': 'Zetec Rocam',
    'FIRE EVO': 'Fire EVO',
    'EVO': 'Fire EVO',
    'E-TORQ': 'E-Torq',
    'ETORQ': 'E-Torq',
    'ZETEC': 'Zetec',
    'FIRE': 'Fire',
    'AP': 'AP',
    'CHT': 'CHT',
    'THP': 'THP',
    'TSI': 'TSI',
    'FSI': 'FSI',
    'TFSI': 'TFSI',
    'TDI': 'TDI',
    'HDI': 'HDI',
    'DCI': 'dCi',
    'K4M': 'K4M',
    'F4R': 'F4R',
    'K7M': 'K7M',
    'CUMMINS': 'Cummins',
    'MWM': 'MWM',
    'MAXION': 'Maxion',
    'SPRINTER': 'Sprinter',
  };

  /// Normaliza el nombre de una familia de motor si existe.
  static String? normalizeFamily(String text) {
    final String upper = text.toUpperCase().trim();
    for (final MapEntry<String, String> entry in engineFamilies.entries) {
      if (upper.contains(entry.key)) {
        return entry.value;
      }
    }
    return null;
  }
}
