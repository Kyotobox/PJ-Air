/// GenerationMatrix define la matriz canónica de generaciones vehiculares y autocompletado de rangos de años.
class GenerationMatrix {
  static const List<Map<String, dynamic>> generations = <Map<String, dynamic>>[
    <String, dynamic>{
      'make': 'TOYOTA',
      'model': 'COROLLA',
      'generation': 'E110',
      'aliases': <String>['ARAYA', 'BABY CAMRY', 'PANTALLITA'],
      'year_start': 1997,
      'year_end': 2002,
    },
    <String, dynamic>{
      'make': 'TOYOTA',
      'model': 'COROLLA',
      'generation': 'E120',
      'aliases': <String>['SENSACION'],
      'year_start': 2003,
      'year_end': 2008,
    },
    <String, dynamic>{
      'make': 'TOYOTA',
      'model': 'HILUX',
      'generation': 'AN10',
      'aliases': <String>['KAVAK'],
      'year_start': 2005,
      'year_end': 2015,
    },
    <String, dynamic>{
      'make': 'TOYOTA',
      'model': 'LAND CRUISER',
      'generation': 'J90',
      'aliases': <String>['MERU'],
      'year_start': 1998,
      'year_end': 2007,
    },
    <String, dynamic>{
      'make': 'TOYOTA',
      'model': 'LAND CRUISER',
      'generation': 'J200',
      'aliases': <String>['RORAIMA'],
      'year_start': 2008,
      'year_end': 2021,
    },
    <String, dynamic>{
      'make': 'CHEVROLET',
      'model': 'AVEO',
      'generation': 'T200',
      'aliases': <String>['AVEO SPEED', 'AVEO LT', 'AVEO LS'],
      'year_start': 2004,
      'year_end': 2015,
    },
    <String, dynamic>{
      'make': 'CHEVROLET',
      'model': 'OPTRA',
      'generation': 'J200',
      'aliases': <String>['OPTRA DESIGN', 'OPTRA ADVANCE', 'OPTRA LIMITED'],
      'year_start': 2004,
      'year_end': 2014,
    },
    <String, dynamic>{
      'make': 'FORD',
      'model': 'FIESTA',
      'generation': 'MK5',
      'aliases': <String>['FIESTA POWER', 'FIESTA MAX', 'FIESTA MOVE'],
      'year_start': 2004,
      'year_end': 2014,
    },
    <String, dynamic>{
      'make': 'MITSUBISHI',
      'model': 'LANCER',
      'generation': 'CS0',
      'aliases': <String>['LANCER TOURING', 'TOURING'],
      'year_start': 2002,
      'year_end': 2015,
    },
    <String, dynamic>{
      'make': 'CHEVROLET',
      'model': 'CHEVETTE',
      'generation': 'T-BODY',
      'aliases': <String>['CHEVETTE'],
      'year_start': 1980,
      'year_end': 1998,
    },
  ];

  /// Busca el rango de años canónico para una marca, modelo o alias.
  static Map<String, int>? findYearRange(String make, String modelOrAlias) {
    final String cleanMake = make.toUpperCase().trim();
    final String cleanModel = modelOrAlias.toUpperCase().trim();

    for (final Map<String, dynamic> gen in generations) {
      final String gMake = (gen['make'] as String).toUpperCase();
      final String gModel = (gen['model'] as String).toUpperCase();
      final List<String> gAliases = (gen['aliases'] as List<String>)
          .map((String a) => a.toUpperCase())
          .toList();

      if (gMake == cleanMake &&
          (gModel == cleanModel || gAliases.contains(cleanModel))) {
        return <String, int>{
          'year_start': gen['year_start'] as int,
          'year_end': gen['year_end'] as int,
        };
      }
    }
    return null;
  }
}
