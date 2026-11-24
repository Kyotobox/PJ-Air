// ast_anti_mock_checker.dart — Evaluador Anti-Mocks en Producción con Soporte de Fakes en Memoria (§4, §39).
library;

/// Tipo de violación a la doctrina de Tolerancia Cero a Mocks (§4).
enum MockViolationType {
  /// Importación de frameworks de mocks (mockito, mocktail, etc.) en código de producción.
  mockImport(
    'mock_import',
    'Importación de librería de mock prohibida en lib/',
  ),

  /// Herencia o implementación de la clase Mock en código de producción.
  mockInheritance('mock_inheritance', 'Clase hereda o implementa Mock en lib/'),

  /// Uso de anotaciones de generación de mocks (@GenerateMocks) en producción.
  mockAnnotation('mock_annotation', 'Anotación de generación de mocks en lib/');

  final String code;
  final String description;

  const MockViolationType(this.code, this.description);
}

/// Representa una infracción individual a la doctrina anti-mocks (§4).
class AstMockViolation {
  final MockViolationType type;
  final String filePath;
  final int lineNumber;
  final String matchedToken;
  final String message;

  const AstMockViolation({
    required this.type,
    required this.filePath,
    required this.lineNumber,
    required this.matchedToken,
    required this.message,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'type': type.code,
    'file_path': filePath,
    'line_number': lineNumber,
    'matched_token': matchedToken,
    'message': message,
  };

  @override
  String toString() =>
      '[${type.code}] $filePath:$lineNumber - $message (Token: "$matchedToken")';
}

/// Reporte de evaluación anti-mocks.
class AstMockReport {
  final String filePath;
  final bool isClean;
  final List<AstMockViolation> violations;
  final int scannedLines;

  const AstMockReport({
    required this.filePath,
    required this.isClean,
    required this.violations,
    required this.scannedLines,
  });

  int get violationsCount => violations.length;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'file_path': filePath,
    'is_clean': isClean,
    'violations_count': violations.length,
    'scanned_lines': scannedLines,
    'violations': violations.map((AstMockViolation v) => v.toJson()).toList(),
  };

  @override
  String toString() =>
      'AstMockReport(clean: $isClean, violations: ${violations.length}, file: $filePath)';
}

/// Excepción formal arrojada ante la presencia de mocks en código de producción (§4).
class MockDoctrineViolationException implements Exception {
  final String filePath;
  final String message;
  final List<AstMockViolation> violations;

  const MockDoctrineViolationException({
    required this.filePath,
    required this.message,
    this.violations = const <AstMockViolation>[],
  });

  @override
  String toString() =>
      'MockDoctrineViolationException: [$filePath] $message\n${violations.map((AstMockViolation v) => "  - $v").join("\n")}';
}

/// Evaluador Pure Dart para erradicación de mocks en código de producción (§4, §39).
class AstAntiMockChecker {
  const AstAntiMockChecker();

  static final RegExp _mockImportRegex = RegExp(
    r"""import\s+['"](package:mockito|package:mocktail|package:mock_web_server)[^'"]*['"]""",
    caseSensitive: false,
  );

  static final RegExp _mockClassRegex = RegExp(
    r'\bclass\s+\w+\s+(extends|implements|with)\s+.*?\bMock\b',
  );

  static final RegExp _mockAnnotationRegex = RegExp(
    r'@(GenerateMocks|GenerateNiceMocks)\s*\(',
  );

  /// Evalúa el código fuente de un archivo en busca de mocks ilegítimos.
  ///
  /// El código de producción (`lib/`, `packages/*/lib/`) tiene tolerancia cero (§4).
  /// Se admiten explícitamente fakes de dominio en memoria (`class Fake... extends Fake`).
  AstMockReport checkSource(
    String source, {
    String filePath = 'lib/src/domain_service.dart',
    bool throwOnError = false,
  }) {
    if (source.trim().isEmpty) {
      throw ArgumentError.value(
        source,
        'source',
        'El código fuente no puede estar vacío.',
      );
    }

    final bool isProductionCode =
        filePath.contains('lib/') || !filePath.contains('test/');

    final List<AstMockViolation> violations = <AstMockViolation>[];
    final List<String> lines = source.split('\n');

    if (isProductionCode) {
      for (int i = 0; i < lines.length; i++) {
        final String line = lines[i];
        final int lineNum = i + 1;

        // 1. Detectar imports de mockito/mocktail
        final Match? importMatch = _mockImportRegex.firstMatch(line);
        if (importMatch != null) {
          violations.add(
            AstMockViolation(
              type: MockViolationType.mockImport,
              filePath: filePath,
              lineNumber: lineNum,
              matchedToken: importMatch.group(0) ?? line.trim(),
              message:
                  '🚨 [VIOLACIÓN §4] Importación de framework de mocks en código de producción. '
                  'Use implementaciones reales en memoria o fakes tipados.',
            ),
          );
        }

        // 2. Detectar herencia de Mock
        final Match? classMatch = _mockClassRegex.firstMatch(line);
        if (classMatch != null) {
          violations.add(
            AstMockViolation(
              type: MockViolationType.mockInheritance,
              filePath: filePath,
              lineNumber: lineNum,
              matchedToken: classMatch.group(0) ?? line.trim(),
              message:
                  '🚨 [VIOLACIÓN §4] Clase en producción hereda o implementa Mock. '
                  'Tolerancia cero a datos sintéticos simulados.',
            ),
          );
        }

        // 3. Detectar anotaciones @GenerateMocks
        final Match? annotationMatch = _mockAnnotationRegex.firstMatch(line);
        if (annotationMatch != null) {
          violations.add(
            AstMockViolation(
              type: MockViolationType.mockAnnotation,
              filePath: filePath,
              lineNumber: lineNum,
              matchedToken: annotationMatch.group(0) ?? line.trim(),
              message:
                  '🚨 [VIOLACIÓN §4] Generación automática de mocks prohibida en código de producción.',
            ),
          );
        }
      }
    }

    final AstMockReport report = AstMockReport(
      filePath: filePath,
      isClean: violations.isEmpty,
      violations: violations,
      scannedLines: lines.length,
    );

    if (!report.isClean && throwOnError) {
      throw MockDoctrineViolationException(
        filePath: filePath,
        message:
            'Tolerancia Cero a Mocks violada en código de producción (§4).',
        violations: violations,
      );
    }

    return report;
  }
}
