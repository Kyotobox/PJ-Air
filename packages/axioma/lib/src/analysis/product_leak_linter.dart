import 'dart:io';

/// Excepción lanzada cuando se detectan fugas de producto en modo restrictivo (`enforce: true`).
class ProductLeakException implements Exception {
  final String message;
  final String? filePath;
  final List<ProductLeakMatch> matches;

  const ProductLeakException(
    this.message, {
    this.filePath,
    this.matches = const <ProductLeakMatch>[],
  });

  @override
  String toString() {
    final StringBuffer sb = StringBuffer('[PRODUCT_LEAK_ERROR] $message');
    if (filePath != null) sb.write(' en $filePath');
    sb.write(' (${matches.length} incidencias encontradas):');
    for (final ProductLeakMatch match in matches) {
      sb.write(
        '\n  - Línea ${match.line}:${match.column} [${match.term}]: ${match.lineContent.trim()}',
      );
    }
    return sb.toString();
  }
}

/// Registro individual de un término satelital prohibido detectado en el código.
class ProductLeakMatch {
  final String term;
  final int line;
  final int column;
  final String lineContent;
  final String? filePath;

  const ProductLeakMatch({
    required this.term,
    required this.line,
    required this.column,
    required this.lineContent,
    this.filePath,
  });

  @override
  String toString() =>
      '[PRODUCT_LEAK_WARN] $term en ${filePath != null ? "$filePath:" : ""}$line:$column -> "${lineContent.trim()}"';
}

/// Linter estático para detectar contaminación y fugas de conceptos de satélites
/// (`fitment`, `catalog_part`, `part_taxonomy`, `oem_cleaner`) dentro del Kernel Core (§1, §2, §39, §47).
class ProductLeakLinter {
  static const List<String> kDefaultProhibitedTerms = <String>[
    'fitment',
    'catalog_part',
    'part_taxonomy',
    'oem_cleaner',
  ];

  const ProductLeakLinter();

  /// Compila patrones regex para cubrir variantes de los términos (snake_case, camelCase, PascalCase).
  List<RegExp> _buildPatterns(List<String> terms) {
    final List<RegExp> patterns = <RegExp>[];
    for (final String term in terms) {
      final String patternStr = term.replaceAll('_', '_?');
      patterns.add(RegExp(patternStr, caseSensitive: false));
    }
    return patterns;
  }

  /// Analiza código fuente Dart y reporta incidencias de términos satelitales.
  /// Si [enforce] es `true` y se detectan coincidencias, lanza [ProductLeakException].
  List<ProductLeakMatch> lintSource(
    String source, {
    String? filePath,
    bool enforce = false,
    List<String>? customProhibitedTerms,
  }) {
    final List<String> terms = customProhibitedTerms ?? kDefaultProhibitedTerms;
    final List<RegExp> patterns = _buildPatterns(terms);
    final List<String> lines = source.split('\n');
    final List<ProductLeakMatch> matches = <ProductLeakMatch>[];

    for (int i = 0; i < lines.length; i++) {
      final String line = lines[i];
      final String trimmed = line.trim();
      // Omitir líneas de comentarios de directiva del propio linter
      if (trimmed.startsWith('//') && trimmed.contains('product_leak')) {
        continue;
      }

      for (final RegExp regex in patterns) {
        for (final Match match in regex.allMatches(line)) {
          final String matchedText = match.group(0)!;
          matches.add(
            ProductLeakMatch(
              term: matchedText,
              line: i + 1,
              column: match.start + 1,
              lineContent: line,
              filePath: filePath,
            ),
          );
        }
      }
    }

    if (enforce && matches.isNotEmpty) {
      throw ProductLeakException(
        'Se detectaron términos de satélite prohibidos en el Kernel/Hub',
        filePath: filePath,
        matches: matches,
      );
    }

    return matches;
  }

  /// Analiza un archivo Dart en disco.
  Future<List<ProductLeakMatch>> lintFile(
    File file, {
    bool enforce = false,
    List<String>? customProhibitedTerms,
  }) async {
    if (!await file.exists()) return <ProductLeakMatch>[];
    final String content = await file.readAsString();
    return lintSource(
      content,
      filePath: file.path,
      enforce: enforce,
      customProhibitedTerms: customProhibitedTerms,
    );
  }

  /// Analiza recursivamente un directorio buscando archivos `.dart`.
  Future<List<ProductLeakMatch>> lintDirectory(
    Directory dir, {
    bool enforce = false,
    List<String>? customProhibitedTerms,
    List<String> excludePaths = const <String>[],
  }) async {
    final List<ProductLeakMatch> allMatches = <ProductLeakMatch>[];
    if (!await dir.exists()) return allMatches;

    await for (final FileSystemEntity entity in dir.list(recursive: true)) {
      if (entity is File && entity.path.endsWith('.dart')) {
        final bool isExcluded = excludePaths.any(
          (String ex) => entity.path.contains(ex),
        );
        if (isExcluded) continue;

        final List<ProductLeakMatch> fileMatches = await lintFile(
          entity,
          enforce: false,
          customProhibitedTerms: customProhibitedTerms,
        );
        allMatches.addAll(fileMatches);
      }
    }

    if (enforce && allMatches.isNotEmpty) {
      throw ProductLeakException(
        'Se detectaron términos de satélite prohibidos en el directorio ${dir.path}',
        filePath: dir.path,
        matches: allMatches,
      );
    }

    return allMatches;
  }
}
