/// ModelAliasDictionary almacena el mapa de alias y apodos comerciales de modelos de vehículos en VE, CO y LATAM.
class ModelAliasDictionary {
  static const Map<String, Map<String, String>>
  aliasesToCanonicalMap = <String, Map<String, String>>{
    'BABY CAMRY': <String, String>{'make': 'TOYOTA', 'model': 'COROLLA'},
    'PANTALLITA': <String, String>{'make': 'TOYOTA', 'model': 'COROLLA'},
    'ARAYA': <String, String>{'make': 'TOYOTA', 'model': 'COROLLA'},
    'SENSACION': <String, String>{'make': 'TOYOTA', 'model': 'COROLLA'},
    'SENSACIÓN': <String, String>{'make': 'TOYOTA', 'model': 'COROLLA'},
    'KAVAK': <String, String>{'make': 'TOYOTA', 'model': 'HILUX'},
    'MERU': <String, String>{'make': 'TOYOTA', 'model': 'LAND CRUISER'},
    'MERÚ': <String, String>{'make': 'TOYOTA', 'model': 'LAND CRUISER'},
    'RORAIMA': <String, String>{'make': 'TOYOTA', 'model': 'LAND CRUISER'},
    'MACHITO': <String, String>{'make': 'TOYOTA', 'model': 'LAND CRUISER'},
    'AUTANA': <String, String>{'make': 'TOYOTA', 'model': 'LAND CRUISER'},
    'AVEO SPEED': <String, String>{'make': 'CHEVROLET', 'model': 'AVEO'},
    'AVEO LT': <String, String>{'make': 'CHEVROLET', 'model': 'AVEO'},
    'AVEO LS': <String, String>{'make': 'CHEVROLET', 'model': 'AVEO'},
    'OPTRA DESIGN': <String, String>{'make': 'CHEVROLET', 'model': 'OPTRA'},
    'OPTRA ADVANCE': <String, String>{'make': 'CHEVROLET', 'model': 'OPTRA'},
    'OPTRA LIMITED': <String, String>{'make': 'CHEVROLET', 'model': 'OPTRA'},
    'FIESTA POWER': <String, String>{'make': 'FORD', 'model': 'FIESTA'},
    'FIESTA MAX': <String, String>{'make': 'FORD', 'model': 'FIESTA'},
    'FIESTA MOVE': <String, String>{'make': 'FORD', 'model': 'FIESTA'},
    'LANCER TOURING': <String, String>{'make': 'MITSUBISHI', 'model': 'LANCER'},
    'TOURING': <String, String>{'make': 'MITSUBISHI', 'model': 'LANCER'},
    'CHEVETTE': <String, String>{'make': 'CHEVROLET', 'model': 'CHEVETTE'},
    'BALITA': <String, String>{'make': 'HYUNDAI', 'model': 'ACCENT'},
  };

  /// Obtiene la marca y modelo canónico para un alias o apodo de vehículo.
  static Map<String, String>? resolveAlias(String alias) {
    if (alias.trim().isEmpty) return null;
    final String clean = alias.toUpperCase().trim();
    return aliasesToCanonicalMap[clean];
  }
}
