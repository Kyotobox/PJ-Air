/// ⚙️ MEKA HEURISTIC FALLBACK FITMENT EXTRACTOR
///
/// Este extractor heurístico procesa descripciones y marcas para extraer compatibilidades
/// básicas cuando no se detecta ninguna coincidencia determinista mediante Regex.
/// Implementa filtros para reducir falsos positivos y ruido del catálogo.
class FallbackFitmentExtractor {
  static const List<String> makes = <String>[
    'TOYOTA',
    'FORD',
    'CHEVROLET',
    'VW',
    'VOLKSWAGEN',
    'NISSAN',
    'HONDA',
    'HYUNDAI',
    'KIA',
    'MAZDA',
    'MITSUBISHI',
    'RENAULT',
    'FIAT',
    'PEUGEOT',
    'CHEVY',
    'AUDI',
    'SEAT',
    'JEEP',
    'DODGE',
    'RAM',
    'CHRYSLER',
    'SUZUKI',
    'DAEWOO',
    'DACIA',
  ];

  // Filtros de ruido para evitar que nombres de partes u otras palabras sean considerados modelos
  static const Set<String> invalidModels = <String>{
    'PASTILLA',
    'PASTILLAS',
    'ANILLO',
    'ANILLOS',
    'CORREA',
    'CORREAS',
    'FILTRO',
    'FILTROS',
    'BUJIA',
    'BUJIAS',
    'BUJÍAS',
    'MUÑON',
    'MUÑON DETALLES',
    'TERMINAL',
    'TERMINALES',
    'BASE',
    'BASES',
    'SENSOR',
    'SENSORES',
    'EMPACADURA',
    'EMPACADURAS',
    'EST',
    'EST A/L',
    'DETALLE',
    'UNIVERSAL',
    'MARCA',
    'GENERICO',
    'SINC.',
    'SINC',
    'AUT',
    'AUTOMATICO',
    'N/A',
    'N/D',
    'VER',
    'VER MAS',
    'KIT',
    'KITS',
    'PAR',
    'PARES',
    'JUEGO',
    'JUEGOS',
  };

  /// Procesa una descripción y extrae posibles compatibilidades.
  List<ExtractedFitment> extract(String description) {
    final List<ExtractedFitment> results = <ExtractedFitment>[];
    final String text = description.toUpperCase().trim();

    for (final String make in makes) {
      if (!text.contains(make)) continue;

      final int makeIndex = text.indexOf(make);
      final String afterMake = text.substring(makeIndex + make.length).trim();
      final List<String> words = afterMake.split(RegExp(r'\s+'));

      String model = 'N/A';
      if (words.isNotEmpty && words[0].isNotEmpty) {
        final String firstWord = words[0];

        // Ignorar palabras de ruido o que contengan caracteres extraños/paréntesis
        if (firstWord.startsWith('(') ||
            firstWord.startsWith('[') ||
            firstWord.startsWith('*') ||
            (firstWord.length <= 2 &&
                int.tryParse(firstWord) == null &&
                firstWord != 'KA' &&
                firstWord != 'IQ') ||
            invalidModels.contains(firstWord)) {
          continue;
        }

        model = firstWord;

        // Intentar agregar una segunda palabra si califica y no es año/número
        if (words.length > 1 &&
            words[1].isNotEmpty &&
            !RegExp(r'^\d+$').hasMatch(words[1]) &&
            !RegExp(r'^\d{2,4}-\d{2,4}$').hasMatch(words[1]) &&
            words[1].length > 2 &&
            !words[1].startsWith('[') &&
            !words[1].startsWith('(') &&
            !words[1].startsWith('*') &&
            !invalidModels.contains(words[1])) {
          model += ' ${words[1]}';
        }
      }

      if (model == 'N/A' || invalidModels.contains(model)) {
        continue;
      }

      // Extraer años
      String vehicleYear = 'N/A';
      int? yearFrom;
      int? yearTo;

      final RegExpMatch? rangeMatch = RegExp(
        r'\b(19\d{2}|20\d{2})-(19\d{2}|20\d{2})\b',
      ).firstMatch(afterMake);
      final RegExpMatch? shortRange = RegExp(r'\b(\d{2})-(\d{2})\b')
          .firstMatch(afterMake);
      final RegExpMatch? single = RegExp(r'\b(19\d{2}|20\d{2})\b')
          .firstMatch(afterMake);

      if (rangeMatch != null) {
        vehicleYear = rangeMatch.group(0)!;
        yearFrom = int.tryParse(rangeMatch.group(1)!);
        yearTo = int.tryParse(rangeMatch.group(2)!);
      } else if (shortRange != null) {
        vehicleYear = shortRange.group(0)!;
        final int? y1 = int.tryParse(shortRange.group(1)!);
        final int? y2 = int.tryParse(shortRange.group(2)!);
        if (y1 != null && y2 != null) {
          yearFrom = y1 > 50 ? 1900 + y1 : 2000 + y1;
          yearTo = y2 > 50 ? 1900 + y2 : 2000 + y2;
        }
      } else if (single != null) {
        vehicleYear = single.group(0)!;
        yearFrom = int.tryParse(vehicleYear);
        yearTo = yearFrom;
      }

      final String canonicalMake = make == 'VOLKSWAGEN' || make == 'VW'
          ? 'VW'
          : make;

      results.add(
        ExtractedFitment(
          make: canonicalMake,
          model: model,
          year: vehicleYear,
          yearFrom: yearFrom,
          yearTo: yearTo,
        ),
      );
    }
    return results;
  }
}

class ExtractedFitment {
  final String make;
  final String model;
  final String year;
  final int? yearFrom;
  final int? yearTo;

  ExtractedFitment({
    required this.make,
    required this.model,
    required this.year,
    this.yearFrom,
    this.yearTo,
  });
}
