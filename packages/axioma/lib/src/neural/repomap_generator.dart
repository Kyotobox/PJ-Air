/// RepoMapGenerator — Generador de mapas estructurales de repositorio en Pure Dart (§39).
///
/// Procesa una colección de archivos de código fuente, extrae sus definiciones
/// estructurales (clases, enums, funciones públicas y firmas clave), computa
/// la centralidad de cada archivo mediante PageRank determinista sobre el grafo
/// de dependencias/referencias, y ensambla un resumen conciso empaquetado
/// dentro de un presupuesto estricto de tokens para LLMs.
library;

/// Excepción lanzada cuando ocurre un error en la configuración o generación
/// del mapa estructural del repositorio.
final class RepoMapException implements Exception {
  final String message;
  final dynamic cause;

  const RepoMapException(this.message, [this.cause]);

  @override
  String toString() =>
      'RepoMapException: $message${cause != null ? ' (Cause: $cause)' : ''}';
}

/// Símbolo estructural extraído de un archivo de código.
final class RepoSymbol {
  final String name;
  final String kind; // 'class', 'enum', 'mixin', 'extension', 'function'
  final List<String> memberSignatures;

  const RepoSymbol({
    required this.name,
    required this.kind,
    this.memberSignatures = const <String>[],
  });

  /// Estima la cantidad de tokens que ocupa la definición del símbolo.
  int estimateTokens() {
    int chars = name.length + kind.length + 4;
    for (final String sig in memberSignatures) {
      chars += sig.length + 2;
    }
    return (chars / 3.5).ceil();
  }

  @override
  String toString() {
    final StringBuffer sb = StringBuffer();
    sb.writeln('  $kind $name {');
    for (final String sig in memberSignatures) {
      sb.writeln('    $sig;');
    }
    sb.writeln('  }');
    return sb.toString();
  }
}

/// Outline estructural extraído de un archivo fuente individual.
final class FileOutline {
  final String path;
  final List<RepoSymbol> symbols;
  final Set<String> referencedIdentifiers;

  const FileOutline({
    required this.path,
    required this.symbols,
    required this.referencedIdentifiers,
  });

  /// Estima los tokens necesarios para renderizar el outline completo del archivo.
  int estimateTokens() {
    int chars = path.length + 8;
    for (final RepoSymbol sym in symbols) {
      chars += sym.name.length + sym.kind.length + 8;
      for (final String sig in sym.memberSignatures) {
        chars += sig.length + 6;
      }
    }
    return (chars / 3.5).ceil();
  }

  /// Renderiza el outline en formato de pseudocódigo limpio.
  String render() {
    final StringBuffer sb = StringBuffer();
    sb.writeln('📄 $path:');
    if (symbols.isEmpty) {
      sb.writeln('  (Sin símbolos estructurales mayores)');
    } else {
      for (final RepoSymbol sym in symbols) {
        sb.write(sym.toString());
      }
    }
    return sb.toString();
  }
}

/// Resultado consolidado de la generación del mapa de repositorio.
final class RepoMap {
  /// Texto estructurado formateado con el outline priorizado por PageRank.
  final String formattedOutline;

  /// Puntuaciones de PageRank calculadas para cada archivo analizado.
  final Map<String, double> fileScores;

  /// Estimación total de tokens consumidos por el texto empaquetado.
  final int totalTokensEstimate;

  /// Lista de rutas de archivo efectivamente incluidas dentro del presupuesto.
  final List<String> includedFiles;

  /// Lista de rutas omitidas o truncadas debido al límite de presupuesto de tokens.
  final List<String> omittedFiles;

  const RepoMap({
    required this.formattedOutline,
    required this.fileScores,
    required this.totalTokensEstimate,
    required this.includedFiles,
    required this.omittedFiles,
  });
}

/// Motor de generación de mapas de repositorios con PageRank determinista y control de tokens.
class RepoMapGenerator {
  /// Presupuesto máximo de tokens permitidos en la salida final.
  final int maxTokens;

  /// Factor de amortiguamiento para PageRank (estándar: 0.85).
  final double dampingFactor;

  /// Número máximo de iteraciones para la convergencia de PageRank.
  final int maxIterations;

  /// Umbral de convergencia de PageRank (diferencia L1 máxima entre iteraciones).
  final double convergenceThreshold;

  const RepoMapGenerator({
    this.maxTokens = 1024,
    this.dampingFactor = 0.85,
    this.maxIterations = 25,
    this.convergenceThreshold = 1e-5,
  }) : assert(maxTokens > 0, 'maxTokens debe ser estrictamente positivo'),
       assert(
         dampingFactor > 0.0 && dampingFactor < 1.0,
         'dampingFactor debe estar en el intervalo (0.0, 1.0)',
       ),
       assert(maxIterations > 0, 'maxIterations debe ser mayor a 0');

  /// Genera un [RepoMap] a partir de un mapa de rutas y contenidos en memoria.
  ///
  /// Lanza [RepoMapException] si los parámetros de configuración son inválidos
  /// o la colección de archivos está vacía.
  RepoMap generateFromSourceMap(Map<String, String> files) {
    if (maxTokens <= 0) {
      throw const RepoMapException('El presupuesto maxTokens debe ser > 0');
    }
    if (dampingFactor <= 0.0 || dampingFactor >= 1.0) {
      throw const RepoMapException(
        'El factor de amortiguamiento debe estar entre 0.0 y 1.0',
      );
    }
    if (files.isEmpty) {
      throw const RepoMapException('No se proporcionaron archivos para mapear');
    }

    // 1. Extraer outlines estructurales
    final Map<String, FileOutline> outlines = <String, FileOutline>{};
    for (final MapEntry<String, String> entry in files.entries) {
      outlines[entry.key] = parseDartSource(entry.key, entry.value);
    }

    // 2. Calcular PageRank determinista
    final Map<String, double> scores = computePageRank(outlines);

    // 3. Ensamblar mapa priorizado dentro del presupuesto de tokens
    return _assembleRepoMap(outlines, scores);
  }

  /// Parsea un archivo fuente Dart extrayendo símbolos y referencias mediante Pure Dart AST heuristics.
  FileOutline parseDartSource(String path, String source) {
    final List<RepoSymbol> symbols = <RepoSymbol>[];
    final Set<String> referencedIdentifiers = <String>{};

    // Extraer identificadores generales referenciados (palabras de 3+ letras)
    final RegExp identRegex = RegExp(r'\b[A-Za-z_][A-Za-z0-9_]{2,}\b');
    for (final Match m in identRegex.allMatches(source)) {
      final String val = m.group(0)!;
      referencedIdentifiers.add(val);
    }

    // Heurísticas limpias de clases, enums, mixins y extensiones
    final RegExp classRegex = RegExp(
      r'(?:abstract\s+|sealed\s+|base\s+|interface\s+|final\s+)?(class|enum|mixin|extension)\s+([A-Za-z0-9_]+)',
    );

    final List<Match> typeMatches = classRegex.allMatches(source).toList();
    for (final Match match in typeMatches) {
      final String kind = match.group(1)!;
      final String name = match.group(2)!;

      // Buscar métodos públicos inmediatos para este tipo
      final List<String> memberSignatures = <String>[];
      final int startPos = match.end;
      final int openBrace = source.indexOf('{', startPos);
      if (openBrace != -1) {
        int closeBrace = _findMatchingClosingBrace(source, openBrace);
        if (closeBrace != -1) {
          final String body = source.substring(openBrace + 1, closeBrace);
          memberSignatures.addAll(_extractMemberSignatures(body));
        }
      }

      symbols.add(
        RepoSymbol(
          name: name,
          kind: kind,
          memberSignatures: memberSignatures.take(8).toList(),
        ),
      );
    }

    // Funciones de nivel superior (si no hay clases o adicionales)
    final RegExp topLevelFuncRegex = RegExp(
      r'^(?:void|Future<[^>]+>|[A-Za-z0-9_<>]+)\s+([a-z][A-Za-z0-9_]*)\s*\([^)]*\)',
      multiLine: true,
    );
    for (final Match match in topLevelFuncRegex.allMatches(source)) {
      final String funcName = match.group(1)!;
      // Evitar colisiones si ya está adentro de una clase
      if (!symbols.any(
        (RepoSymbol s) =>
            s.memberSignatures.any((String m) => m.contains(funcName)),
      )) {
        symbols.add(
          RepoSymbol(
            name: funcName,
            kind: 'function',
            memberSignatures: <String>[match.group(0)!.trim()],
          ),
        );
      }
    }

    return FileOutline(
      path: path,
      symbols: symbols,
      referencedIdentifiers: referencedIdentifiers,
    );
  }

  /// Calcula el vector de PageRank determinista sobre el grafo de dependencias de los archivos.
  Map<String, double> computePageRank(Map<String, FileOutline> outlines) {
    final List<String> paths = outlines.keys.toList()..sort();
    final int n = paths.length;
    if (n == 0) return <String, double>{};
    if (n == 1) return <String, double>{paths.first: 1.0};

    // Crear mapa de símbolos por archivo para detectar quién depende de quién
    final Map<String, Set<String>> symbolsPerFile = <String, Set<String>>{};
    for (final String path in paths) {
      final Set<String> names = <String>{};
      for (final RepoSymbol sym in outlines[path]!.symbols) {
        names.add(sym.name);
      }
      symbolsPerFile[path] = names;
    }

    // Construir lista de adyacencia: outEdges[A] contiene B si A referencia un símbolo declarado en B (A -> B)
    // En PageRank, si A apunta a B, B recibe importancia.
    final Map<String, Set<String>> outEdges = <String, Set<String>>{};
    for (final String sourcePath in paths) {
      final Set<String> targets = <String>{};
      final Set<String> sourceRefs =
          outlines[sourcePath]!.referencedIdentifiers;

      for (final String targetPath in paths) {
        if (sourcePath == targetPath) continue;
        final Set<String> targetSymbols = symbolsPerFile[targetPath]!;
        if (targetSymbols.any((String sym) => sourceRefs.contains(sym))) {
          targets.add(targetPath);
        }
      }
      outEdges[sourcePath] = targets;
    }

    // Inicialización uniforme
    Map<String, double> ranks = <String, double>{
      for (final String path in paths) path: 1.0 / n,
    };

    // Iteraciones de PageRank
    for (int iter = 0; iter < maxIterations; iter++) {
      final Map<String, double> nextRanks = <String, double>{
        for (final String path in paths) path: (1.0 - dampingFactor) / n,
      };

      // Manejo de nodos colgantes (out-degree = 0)
      double danglingSum = 0.0;
      for (final String path in paths) {
        if (outEdges[path]!.isEmpty) {
          danglingSum += ranks[path]!;
        }
      }
      final double danglingShare = (dampingFactor * danglingSum) / n;
      for (final String path in paths) {
        nextRanks[path] = nextRanks[path]! + danglingShare;
      }

      // Distribución de rango de los enlaces salientes
      for (final String sourcePath in paths) {
        final Set<String> targets = outEdges[sourcePath]!;
        if (targets.isNotEmpty) {
          final double share =
              (dampingFactor * ranks[sourcePath]!) / targets.length;
          for (final String target in targets) {
            nextRanks[target] = nextRanks[target]! + share;
          }
        }
      }

      // Comprobar convergencia L1
      double delta = 0.0;
      for (final String path in paths) {
        delta += (nextRanks[path]! - ranks[path]!).abs();
      }

      ranks = nextRanks;
      if (delta < convergenceThreshold) {
        break;
      }
    }

    return ranks;
  }

  /// Ensambla el [RepoMap] priorizando por ranking descendente hasta copar el límite de tokens.
  RepoMap _assembleRepoMap(
    Map<String, FileOutline> outlines,
    Map<String, double> scores,
  ) {
    // Ordenar archivos de mayor a menor PageRank
    final List<String> sortedPaths = outlines.keys.toList()
      ..sort((String a, String b) {
        final int scoreComp = scores[b]!.compareTo(scores[a]!);
        if (scoreComp != 0) return scoreComp;
        return a.compareTo(b); // Desempate determinista por ruta
      });

    final StringBuffer sb = StringBuffer();
    sb.writeln('=== STRUCTURAL REPOMAP (PAGERANK PRIORITIZED) ===');
    int currentChars = sb.length;
    final int maxChars = (maxTokens * 3.5).floor();

    final List<String> included = <String>[];
    final List<String> omitted = <String>[];
    const int footerSafetyMargin = 70;

    for (final String path in sortedPaths) {
      final FileOutline outline = outlines[path]!;
      final String rendered = outline.render();
      final int addedChars = rendered.length + 1;

      if (currentChars + addedChars + footerSafetyMargin <= maxChars) {
        sb.writeln(rendered);
        currentChars += addedChars;
        included.add(path);
      } else {
        omitted.add(path);
      }
    }

    if (omitted.isNotEmpty) {
      sb.writeln(
        '... [Truncated ${omitted.length} lower-priority files due to token budget of $maxTokens tokens]',
      );
    }

    final int totalTokensEstimate = (sb.length / 3.5).ceil();

    return RepoMap(
      formattedOutline: sb.toString(),
      fileScores: scores,
      totalTokensEstimate: totalTokensEstimate,
      includedFiles: included,
      omittedFiles: omitted,
    );
  }

  int _findMatchingClosingBrace(String source, int openIndex) {
    int depth = 1;
    for (int i = openIndex + 1; i < source.length; i++) {
      final String char = source[i];
      if (char == '{') {
        depth++;
      } else if (char == '}') {
        depth--;
        if (depth == 0) return i;
      }
    }
    return -1;
  }

  List<String> _extractMemberSignatures(String classBody) {
    final List<String> sigs = <String>[];
    final RegExp methodRegex = RegExp(
      r'^\s*(?:@\w+\s+)*(?:static\s+)?(?:final\s+|const\s+)?(?:void|Future<[^>]+>|[A-Za-z0-9_<>]+)\s+([a-zA-Z0-9_]+)\s*\([^)]*\)',
      multiLine: true,
    );

    for (final Match match in methodRegex.allMatches(classBody)) {
      final String sig = match.group(0)!.trim().replaceAll(RegExp(r'\s+'), ' ');
      if (!sig.startsWith('_') && !sigs.contains(sig)) {
        sigs.add(sig);
      }
    }
    return sigs;
  }
}
