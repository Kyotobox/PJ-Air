/// ⚙️ MEKA ENGINE: MOTOR DE BÚSQUEDA Y RELACIÓN RELACIONAL N2 (REGEXP)
///
/// Este motor procesa descripciones crudas de repuestos y determina de forma
/// determinista si son compatibles con modelos vehiculares específicos de la capa N2.
/// Previene falsos positivos graves como asociar "AROS DE PISTÓN" al vehículo "ARO 10".
class FitmentRegexEngine {
  // Mapa de alias comunes del parque automotor venezolano/colombiano
  static const Map<String, List<String>> modelAliases = <String, List<String>>{
    'corolla': <String>['baby camry', 'pantallita', 'araya', 'sensación'],
    'allegro': <String>['323 allegro', 'allegro 1.3', 'allegro 1.6'],
    'aveo': <String>['aveo lt', 'aveo speed'],
    'lancer': <String>['lancer touring', 'touring'],
    'optra': <String>['optra design', 'optra advance', 'optra limited'],
    'fiesta': <String>['fiesta power', 'fiesta max', 'fiesta move'],
  };

  // Palabras prohibidas (Stopwords) que anulan emparejamientos de modelos específicos
  static const Map<String, List<String>> stopwordsByModel =
      <String, List<String>>{
        'aro': <String>[
          'aros',
          'aro de volante',
          'aro volante',
          'aros de piston',
          'aros de pistón',
          'aros piston',
          'faro',
          'faros',
          'aro piston',
        ],
        'corolla': <String>[
          'camry',
          'yaris',
          'tercel',
        ], // Evitar solapamientos cruzados de Toyota
        'lancer': <String>['balanceador', 'balancin', 'balancines'],
      };

  // Diccionario de equivalencias de marcas principales para prevención de colisiones
  static const Map<String, List<String>> brandEquivalences =
      <String, List<String>>{
        'chevrolet': <String>['chevrolet', 'chev', 'chevy', 'chevrol', 'chevr'],
        'toyota': <String>['toyota', 'toy'],
        'mitsubishi': <String>['mitsubishi', 'mitsu', 'mitsub'],
        'ford': <String>['ford'],
        'fiat': <String>['fiat'],
        'hyundai': <String>['hyundai', 'hyu'],
        'honda': <String>['honda'],
        'nissan': <String>['nissan'],
        'mazda': <String>['mazda'],
        'renault': <String>['renault', 'ren'],
        'peugeot': <String>['peugeot', 'peug'],
        'jeep': <String>['jeep'],
        'dodge': <String>['dodge'],
        'chrysler': <String>['chrysler', 'chry'],
        'volkswagen': <String>['volkswagen', 'vw', 'volks'],
        'chery': <String>['chery', 'cher'],
        'dongfeng': <String>['dongfeng', 'dfsk', 'dong', 'feng'],
        'byd': <String>['byd'],
        'saipa': <String>['saipa', 'saip'],
        'great wall': <String>['great wall', 'gwm', 'greatwall'],
        'jac': <String>['jac'],
      };

  // Modelos autorizados para cruzar marcas específicas en mercados geolocalizados
  // Estructura: 'modelo': {'marca_canonica_original': ['marcas_cruzadas_admitidas']}
  static const Map<String, Map<String, List<String>>> allowedCrossBrands =
      <String, Map<String, List<String>>>{
        'grand vitara': <String, List<String>>{
          'suzuki': <String>['suzuki', 'chevrolet', 'chev', 'chevy'],
          'chevrolet': <String>['suzuki', 'chevrolet', 'chev', 'chevy'],
        },
        'vitara': <String, List<String>>{
          'suzuki': <String>['suzuki', 'chevrolet', 'chev', 'chevy'],
          'chevrolet': <String>['suzuki', 'chevrolet', 'chev', 'chevy'],
        },
        'swift': <String, List<String>>{
          'suzuki': <String>['suzuki', 'chevrolet', 'chev', 'chevy'],
          'chevrolet': <String>['suzuki', 'chevrolet', 'chev', 'chevy'],
        },
        'esteem': <String, List<String>>{
          'suzuki': <String>['suzuki', 'chevrolet', 'chev', 'chevy'],
          'chevrolet': <String>['suzuki', 'chevrolet', 'chev', 'chevy'],
        },
        'jimny': <String, List<String>>{
          'suzuki': <String>['suzuki', 'chevrolet', 'chev', 'chevy'],
          'chevrolet': <String>['suzuki', 'chevrolet', 'chev', 'chevy'],
        },
        'spark': <String, List<String>>{
          'daewoo': <String>['daewoo', 'chevrolet', 'chev', 'chevy'],
          'chevrolet': <String>['daewoo', 'chevrolet', 'chev', 'chevy'],
        },
        'aveo': <String, List<String>>{
          'daewoo': <String>['daewoo', 'chevrolet', 'chev', 'chevy'],
          'chevrolet': <String>['daewoo', 'chevrolet', 'chev', 'chevy'],
        },
        'optra': <String, List<String>>{
          'daewoo': <String>['daewoo', 'chevrolet', 'chev', 'chevy'],
          'chevrolet': <String>['daewoo', 'chevrolet', 'chev', 'chevy'],
        },
        'logan': <String, List<String>>{
          'dacia': <String>['dacia', 'renault', 'ren'],
          'renault': <String>['dacia', 'renault', 'ren'],
        },
        'sandero': <String, List<String>>{
          'dacia': <String>['dacia', 'renault', 'ren'],
          'renault': <String>['dacia', 'renault', 'ren'],
        },
        'duster': <String, List<String>>{
          'dacia': <String>['dacia', 'renault', 'ren'],
          'renault': <String>['dacia', 'renault', 'ren'],
        },
        'fiorino': <String, List<String>>{
          'fiat': <String>['fiat', 'ram', 'dodge'],
          'ram': <String>['fiat', 'ram', 'dodge'],
        },
        'siena': <String, List<String>>{
          'fiat': <String>['fiat', 'dodge'],
          'dodge': <String>['fiat', 'dodge'],
        },
        'forza': <String, List<String>>{
          'fiat': <String>['fiat', 'dodge'],
          'dodge': <String>['fiat', 'dodge'],
        },
      };

  // Caché de expresiones regulares compiladas para optimizar el procesamiento masivo
  final Map<String, RegExp> _regexCache = <String, RegExp>{};

  /// Normaliza una marca de entrada a su nombre de clave canónica en brandEquivalences
  String _getCanonicalBrand(String brand) {
    final String clean = brand.toLowerCase().trim();
    for (final MapEntry<String, List<String>> entry
        in brandEquivalences.entries) {
      if (entry.key == clean || entry.value.contains(clean)) {
        return entry.key;
      }
    }
    return clean;
  }

  /// Construye una expresión regular con tolerancia a guiones, espacios
  /// y transiciones alfanuméricas de forma determinista.
  RegExp _buildTolerantRegExp(String term) {
    final String cleanTerm = term.toLowerCase().trim();
    if (_regexCache.containsKey(cleanTerm)) {
      return _regexCache[cleanTerm]!;
    }
    String escaped = RegExp.escape(cleanTerm);
    // Permitir guiones o espacios de forma intercambiable
    escaped = escaped.replaceAll(RegExp(r'[-\s]+'), r'[- ]?');
    // Tolerancia entre letras y números (ej. f150 -> f[- ]?150)
    escaped = escaped.replaceAllMapped(
      RegExp(r'([a-zA-Z])(\d)'),
      (Match m) => '${m[1]}[- ]?${m[2]}',
    );
    escaped = escaped.replaceAllMapped(
      RegExp(r'(\d)([a-zA-Z])'),
      (Match m) => '${m[1]}[- ]?${m[2]}',
    );
    final RegExp regex = RegExp('\\b$escaped\\b');
    _regexCache[cleanTerm] = regex;
    return regex;
  }

  /// Evalúa si una descripción cruda de repuesto [description] es compatible
  /// con un modelo vehicular específico [modelName].
  ///
  /// Opcionalmente valida [brandName] para evitar colisiones cruzadas.
  bool isCompatible(String description, String modelName, {String? brandName}) {
    final String cleanDesc = description.toLowerCase().trim();
    final String cleanModel = modelName.toLowerCase().trim();

    if (cleanDesc.isEmpty || cleanModel.isEmpty) return false;

    // 0. Especialización para el homónimo 'spark' (Chevrolet Spark vs Bujía / Spark plug)
    if (cleanModel == 'spark') {
      final bool hasChevrolet =
          brandName == 'chevrolet' ||
          cleanDesc.contains('chevrolet') ||
          cleanDesc.contains('chevy') ||
          cleanDesc.contains('chev') ||
          cleanDesc.contains('chevrol') ||
          cleanDesc.contains('chevr');

      final bool hasSparkPlug =
          cleanDesc.contains('spark plug') ||
          cleanDesc.contains('spark plugs') ||
          cleanDesc.contains('spark-plug') ||
          cleanDesc.contains('spark-plugs') ||
          cleanDesc.contains('sparkplug') ||
          cleanDesc.contains('sparkplugs') ||
          cleanDesc.contains('bujia') ||
          cleanDesc.contains('bujias') ||
          cleanDesc.contains('bujías');

      if (hasSparkPlug && !hasChevrolet) {
        final RegExp sparkRegex = RegExp(r'\bspark\b(?!\s*plug)');
        if (!sparkRegex.hasMatch(cleanDesc)) {
          return false;
        }
      }
    }

    // 1. Validación anticolisión de marcas cruzadas
    if (brandName != null) {
      final String canonicalTarget = _getCanonicalBrand(brandName);
      final List<String> targetBrandAliases =
          brandEquivalences[canonicalTarget] ?? <String>[canonicalTarget];

      bool hasConflictingBrand = false;
      bool mentionsOurBrand = false;

      // Determinar si hay marcas cruzadas permitidas para este modelo
      final List<String> allowedBrandsForModel =
          allowedCrossBrands[cleanModel]?[canonicalTarget] ?? <String>[];
      final Set<String> validAliasesForThisCheck = <String>{
        ...targetBrandAliases,
        ...allowedBrandsForModel.map((String b) => b.toLowerCase().trim()),
      };

      for (final String alias in validAliasesForThisCheck) {
        if (cleanDesc.contains(alias)) {
          mentionsOurBrand = true;
          break;
        }
      }

      for (final MapEntry<String, List<String>> entry
          in brandEquivalences.entries) {
        final String canonicalEntry = entry.key;
        if (canonicalEntry == canonicalTarget ||
            allowedBrandsForModel.contains(canonicalEntry)) {
          continue;
        }

        for (final String alias in entry.value) {
          if (cleanDesc.contains(alias)) {
            hasConflictingBrand = true;
            break;
          }
        }
        if (hasConflictingBrand) break;
      }

      if (hasConflictingBrand && !mentionsOurBrand) {
        return false; // Conflicto detectado: descripción menciona otra marca pero no la nuestra o aliada
      }
    }

    // 2. Verificar si coincide con alguno de los alias autorizados
    if (modelAliases.containsKey(cleanModel)) {
      for (final String alias in modelAliases[cleanModel]!) {
        final RegExp regex = _buildTolerantRegExp(alias);
        if (regex.hasMatch(cleanDesc)) {
          return true; // Coincidencia de alias aprobada (bypassa stopwords generales)
        }
      }
    }

    // 3. Aplicar filtros de stopwords restrictivas
    if (stopwordsByModel.containsKey(cleanModel)) {
      for (final String stopword in stopwordsByModel[cleanModel]!) {
        if (cleanDesc.contains(stopword)) {
          return false; // El término prohibido anula la compatibilidad básica
        }
      }
    }

    // 4. Evaluar la compatibilidad del nombre base del modelo con tolerancia sintáctica
    final RegExp regex = _buildTolerantRegExp(cleanModel);
    return regex.hasMatch(cleanDesc);
  }

  /// Extrae posibles nombres de modelos de coches sugeridos dentro de una descripción.
  List<String> extractPotentialModels(
    String description,
    List<String> availableModelsInDb,
  ) {
    final String cleanDesc = description.toLowerCase();
    final List<String> matches = <String>[];

    for (final String model in availableModelsInDb) {
      if (isCompatible(cleanDesc, model)) {
        matches.add(model);
      }
    }

    return matches;
  }
}
