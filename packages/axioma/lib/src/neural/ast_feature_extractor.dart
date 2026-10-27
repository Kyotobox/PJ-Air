/// AstFeatureExtractor — Motor de vectorización numérica de fragmentos de código Dart.
///
/// Extrae métricas estructurales de un fragmento de código fuente y las
/// representa como un vector tipado [AstVector]. Es 100% Pure Dart (§39),
/// sin dependencias de UI ni paquetes externos pesados.
///
/// Métricas extraídas:
/// - [lineCount]           : Número de líneas no vacías.
/// - [methodCount]         : Número de funciones/métodos declarados.
/// - [conditionalCount]    : Número de bloques condicionales (if/else/switch/ternarios).
/// - [maxNestingDepth]     : Profundidad máxima de anidamiento por llaves `{}`.
/// - [cyclomaticComplexity]: Complejidad ciclomática estimada (McCabe).
library;

/// Vector numérico tipado que representa las métricas estructurales de un
/// fragmento de código fuente.
///
/// Todos los campos son `final` e inmutables. Para transformaciones
/// algebraicas, use [toList] o [toNormalizedList].
final class AstVector {
  /// Número de líneas no vacías (sin contar líneas en blanco o solo espacios).
  final int lineCount;

  /// Número de funciones o métodos declarados en el fragmento.
  ///
  /// Detecta: `void foo()`, `int bar(...)`, `Future<X> baz(...)`,
  /// funciones de flecha `=>`, y constructores nombrados.
  final int methodCount;

  /// Número de bloques de control de flujo condicional.
  ///
  /// Incluye: `if`, `else if`, `switch`, y operadores ternarios `?`.
  final int conditionalCount;

  /// Profundidad máxima de anidamiento por delimitadores `{}`.
  final int maxNestingDepth;

  /// Complejidad ciclomática estimada según la fórmula de McCabe:
  /// `CC = 1 + #(if) + #(else if) + #(for) + #(while) + #(do) + #(switch case) + #(catch) + #(&&) + #(||) + #(?)`
  final int cyclomaticComplexity;

  const AstVector({
    required this.lineCount,
    required this.methodCount,
    required this.conditionalCount,
    required this.maxNestingDepth,
    required this.cyclomaticComplexity,
  });

  /// Devuelve el vector como lista de enteros en orden canónico:
  /// `[lineCount, methodCount, conditionalCount, maxNestingDepth, cyclomaticComplexity]`
  List<int> toList() => <int>[
    lineCount,
    methodCount,
    conditionalCount,
    maxNestingDepth,
    cyclomaticComplexity,
  ];

  /// Devuelve el vector normalizado entre 0.0 y 1.0 usando
  /// valores de referencia razonables para fragmentos de código.
  ///
  /// Útil para pipelines de inferencia o embedding.
  List<double> toNormalizedList({
    int maxLines = 500,
    int maxMethods = 50,
    int maxConditionals = 100,
    int maxDepth = 10,
    int maxCC = 50,
  }) {
    return <double>[
      lineCount.clamp(0, maxLines) / maxLines,
      methodCount.clamp(0, maxMethods) / maxMethods,
      conditionalCount.clamp(0, maxConditionals) / maxConditionals,
      maxNestingDepth.clamp(0, maxDepth) / maxDepth,
      cyclomaticComplexity.clamp(0, maxCC) / maxCC,
    ];
  }

  @override
  String toString() =>
      'AstVector(lines=$lineCount, methods=$methodCount, '
      'conditionals=$conditionalCount, depth=$maxNestingDepth, cc=$cyclomaticComplexity)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AstVector &&
          lineCount == other.lineCount &&
          methodCount == other.methodCount &&
          conditionalCount == other.conditionalCount &&
          maxNestingDepth == other.maxNestingDepth &&
          cyclomaticComplexity == other.cyclomaticComplexity;

  @override
  int get hashCode => Object.hash(
    lineCount,
    methodCount,
    conditionalCount,
    maxNestingDepth,
    cyclomaticComplexity,
  );
}

/// Motor de extracción de características AST mediante análisis léxico-regex.
///
/// No depende de `package:analyzer` ni de ningún framework de UI (§39).
/// Usa expresiones regulares deterministas y un rastreador de profundidad de
/// llaves basado en caracteres.
///
/// ### Uso
/// ```dart
/// const extractor = AstFeatureExtractor();
/// final vector = extractor.extract('''
///   void greet(String name) {
///     if (name.isEmpty) {
///       throw ArgumentError('empty name');
///     }
///     print('Hello, \$name');
///   }
/// ''');
/// print(vector); // AstVector(lines=6, methods=1, conditionals=1, depth=2, cc=2)
/// ```
final class AstFeatureExtractor {
  const AstFeatureExtractor();

  // -------------------------------------------------------------------------
  // Patrones regex internos (compilados una sola vez)
  // -------------------------------------------------------------------------

  /// Detecta declaraciones de función/método/constructor en Dart.
  /// Ejemplos: `void foo()`, `Future<T> bar(...)`, `MyClass.named(...)`,
  /// funciones arrow anónimas asignadas `final f = () =>`.
  static final RegExp _methodRegex = RegExp(
    r'(?:^|[\n;{])\s*'
    r'(?:(?:static|async|external|factory|get|set|operator)\s+)*'
    r'(?:(?:[A-Za-z_\$][A-Za-z0-9_\$<>?,\s\[\]*]*)\s+)'
    r'(?:[A-Za-z_\$][A-Za-z0-9_\$.]*)\s*'
    r'(?:<[^>]*>)?\s*'
    r'\([^)]*\)'
    r'(?:\s*(?:async\*?|sync\*?))?\s*'
    r'(?:\{|=>)',
    multiLine: true,
  );

  /// Detecta `if`, `else if`, `switch`, y ternarios `?` en contexto de
  /// expresión (excluyendo comentarios y strings — tratamiento best-effort).
  static final RegExp _ifRegex = RegExp(r'\bif\s*\(', multiLine: true);
  static final RegExp _elseIfRegex = RegExp(
    r'\belse\s+if\s*\(',
    multiLine: true,
  );
  static final RegExp _switchRegex = RegExp(r'\bswitch\s*\(', multiLine: true);
  static final RegExp _ternaryRegex = RegExp(
    r'(?<![?!])\?(?![?.:])',
    multiLine: true,
  );

  // Operadores lógicos (para CC)
  static final RegExp _andRegex = RegExp(r'&&', multiLine: true);
  static final RegExp _orRegex = RegExp(r'\|\|', multiLine: true);

  // Bucles (para CC)
  static final RegExp _forRegex = RegExp(r'\bfor\s*\(', multiLine: true);
  static final RegExp _whileRegex = RegExp(r'\bwhile\s*\(', multiLine: true);
  static final RegExp _doRegex = RegExp(r'\bdo\s*\{', multiLine: true);

  // Case de switch (para CC)
  static final RegExp _caseRegex = RegExp(r'\bcase\s+.+:', multiLine: true);

  // Catch (para CC)
  static final RegExp _catchRegex = RegExp(r'\bcatch\s*\(', multiLine: true);

  // -------------------------------------------------------------------------
  // API pública
  // -------------------------------------------------------------------------

  /// Extrae el [AstVector] de un fragmento de código Dart.
  ///
  /// Lanza [FormatException] si [source] está vacío o solo contiene
  /// espacios en blanco (§6: Sad Path mandatorio).
  AstVector extract(String source) {
    if (source.trim().isEmpty) {
      throw FormatException(
        'AstFeatureExtractor: el fragmento de código no puede estar vacío.',
        source,
      );
    }

    // Normalizamos saltos de línea
    final String normalized = source
        .replaceAll('\r\n', '\n')
        .replaceAll('\r', '\n');

    // Eliminamos strings multilínea y comentarios para reducir falsos positivos
    final String sanitized = _sanitizeCommentsAndStrings(normalized);

    return AstVector(
      lineCount: _countNonEmptyLines(normalized),
      methodCount: _countMethods(sanitized),
      conditionalCount: _countConditionals(sanitized),
      maxNestingDepth: _computeMaxNestingDepth(sanitized),
      cyclomaticComplexity: _computeCyclomaticComplexity(sanitized),
    );
  }

  // -------------------------------------------------------------------------
  // Métricas individuales
  // -------------------------------------------------------------------------

  int _countNonEmptyLines(String source) {
    return source
        .split('\n')
        .where((String line) => line.trim().isNotEmpty)
        .length;
  }

  int _countMethods(String sanitized) {
    return _methodRegex.allMatches(sanitized).length;
  }

  int _countConditionals(String sanitized) {
    // Restamos `else if` de `if` para no contar doble,
    // luego agregamos `else if`, `switch` y ternarios
    final int ifCount = _ifRegex.allMatches(sanitized).length;
    final int elseIfCount = _elseIfRegex.allMatches(sanitized).length;
    final int pureIfCount = ifCount - elseIfCount;
    final int switchCount = _switchRegex.allMatches(sanitized).length;
    final int ternaryCount = _ternaryRegex.allMatches(sanitized).length;

    return pureIfCount + elseIfCount + switchCount + ternaryCount;
  }

  /// Computa la profundidad máxima de anidamiento rastreando `{` y `}`.
  int _computeMaxNestingDepth(String sanitized) {
    int depth = 0;
    int maxDepth = 0;
    for (int i = 0; i < sanitized.length; i++) {
      final String ch = sanitized[i];
      if (ch == '{') {
        depth++;
        if (depth > maxDepth) maxDepth = depth;
      } else if (ch == '}') {
        if (depth > 0) depth--;
      }
    }
    return maxDepth;
  }

  /// Complejidad ciclomática McCabe estimada:
  /// `CC = 1 + #if + #else_if + #for + #while + #do + #case + #catch + #&& + #|| + #?`
  int _computeCyclomaticComplexity(String sanitized) {
    final int ifCount = _ifRegex.allMatches(sanitized).length;
    final int forCount = _forRegex.allMatches(sanitized).length;
    final int whileCount = _whileRegex.allMatches(sanitized).length;
    final int doCount = _doRegex.allMatches(sanitized).length;
    final int caseCount = _caseRegex.allMatches(sanitized).length;
    final int catchCount = _catchRegex.allMatches(sanitized).length;
    final int andCount = _andRegex.allMatches(sanitized).length;
    final int orCount = _orRegex.allMatches(sanitized).length;
    final int ternaryCount = _ternaryRegex.allMatches(sanitized).length;

    return 1 +
        ifCount +
        forCount +
        whileCount +
        doCount +
        caseCount +
        catchCount +
        andCount +
        orCount +
        ternaryCount;
  }

  // -------------------------------------------------------------------------
  // Sanitización best-effort de comentarios y strings literales
  // -------------------------------------------------------------------------

  /// Elimina comentarios `//` y `/* */`, y reemplaza strings con placeholders
  /// para reducir falsos positivos en los conteos regex.
  ///
  /// Implementación best-effort: no es un parser completo, pero es suficiente
  /// para código Dart convencional.
  String _sanitizeCommentsAndStrings(String source) {
    final StringBuffer buffer = StringBuffer();
    int i = 0;
    final int len = source.length;

    while (i < len) {
      // Comentario de bloque /* ... */
      if (i + 1 < len && source[i] == '/' && source[i + 1] == '*') {
        final int end = source.indexOf('*/', i + 2);
        if (end == -1) {
          // Comentario sin cerrar: consumir hasta el final
          break;
        }
        // Preservar saltos de línea dentro del comentario para mantener
        // el conteo de líneas coherente con el original
        final String block = source.substring(i, end + 2);
        buffer.write(block.replaceAll(RegExp(r'[^\n]'), ' '));
        i = end + 2;
        continue;
      }

      // Comentario de línea //
      if (i + 1 < len && source[i] == '/' && source[i + 1] == '/') {
        final int end = source.indexOf('\n', i + 2);
        if (end == -1) {
          break;
        }
        // Reemplazar todo el comentario por espacios, preservando el \n
        buffer.write(' ');
        i = end; // el \n se procesa en la siguiente iteración
        continue;
      }

      // String multilínea ''' o """
      if (i + 2 < len &&
          ((source[i] == "'" && source[i + 1] == "'" && source[i + 2] == "'") ||
              (source[i] == '"' &&
                  source[i + 1] == '"' &&
                  source[i + 2] == '"'))) {
        final String quote = source.substring(i, i + 3);
        final int end = source.indexOf(quote, i + 3);
        if (end == -1) break;
        final String block = source.substring(i, end + 3);
        buffer.write(block.replaceAll(RegExp(r'[^\n]'), ' '));
        i = end + 3;
        continue;
      }

      // String simple ' o "
      if (source[i] == "'" || source[i] == '"') {
        final String quote = source[i];
        int j = i + 1;
        while (j < len && source[j] != quote && source[j] != '\n') {
          if (source[j] == '\\') j++; // escape
          j++;
        }
        // Reemplazar contenido del string con espacios
        buffer.write(' ' * (j - i + 1));
        i = j + 1;
        continue;
      }

      buffer.write(source[i]);
      i++;
    }

    return buffer.toString();
  }
}
