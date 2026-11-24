// 🎯 AstGovernanceValidator — Validador Estático y Procesador de AST en Pure Dart (§39, §46)
// Shared Kernel Pure Dart: evalúa código y procesa reportes JSON de ast-grep con cero dependencias externas.

import 'dart:convert';
import 'dart:io';
import 'validation_codes.dart';

/// Ítem individual de violación AST detectado
class AstViolationItem {
  final String ruleId;
  final String filePath;
  final int lineNumber;
  final int column;
  final String matchedText;
  final String message;
  final String severity;
  final AstValidationCode code;

  const AstViolationItem({
    required this.ruleId,
    required this.filePath,
    required this.lineNumber,
    required this.column,
    required this.matchedText,
    required this.message,
    this.severity = 'error',
    required this.code,
  });

  factory AstViolationItem.fromJson(Map<String, dynamic> json) {
    final String ruleId = json['rule_id'] as String? ?? 'unknown-rule';
    final String filePath = json['file_path'] as String? ?? '';
    final int lineNumber = (json['line_number'] as num?)?.toInt() ?? 1;
    final int column = (json['column'] as num?)?.toInt() ?? 1;
    final String matchedText = json['matched_text'] as String? ?? '';
    final String message =
        json['message'] as String? ?? 'Violación AST detectada';
    final String severity = json['severity'] as String? ?? 'error';

    return AstViolationItem(
      ruleId: ruleId,
      filePath: filePath,
      lineNumber: lineNumber,
      column: column,
      matchedText: matchedText,
      message: message,
      severity: severity,
      code: AstValidationCode.fromRuleId(ruleId),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'rule_id': ruleId,
    'file_path': filePath,
    'line_number': lineNumber,
    'column': column,
    'matched_text': matchedText,
    'message': message,
    'severity': severity,
    'code': code.label,
    'exit_code': code.exitCode,
  };
}

/// Resultado de la validación de gobernanza AST
class AstValidationReport {
  final bool isClean;
  final int violationsCount;
  final int scannedFilesCount;
  final double elapsedMs;
  final List<AstViolationItem> violations;
  final int maxExitCode;

  const AstValidationReport({
    required this.isClean,
    required this.violationsCount,
    required this.scannedFilesCount,
    required this.elapsedMs,
    required this.violations,
    required this.maxExitCode,
  });

  factory AstValidationReport.clean({
    int scannedFiles = 0,
    double elapsed = 0.0,
  }) {
    return AstValidationReport(
      isClean: true,
      violationsCount: 0,
      scannedFilesCount: scannedFiles,
      elapsedMs: elapsed,
      violations: const <AstViolationItem>[],
      maxExitCode: 0,
    );
  }
}

/// Motor de validación de gobernanza AST en Pure Dart
class AstGovernanceValidator {
  static final RegExp _dartEmptyCatch = RegExp(
    r'(?:(?:on\s+[\w<>]+\s+)?catch\s*\([^\)]*\)|on\s+[\w<>]+)\s*\{\s*\}',
    multiLine: true,
  );

  static final RegExp _dartMockImport = RegExp(
    r"""import\s+['"](package:mockito|package:mocktail)[^'"]*['"]""",
    caseSensitive: false,
  );

  static final RegExp _dartMockClass = RegExp(
    r'\bclass\s+\w+\s+(?:extends|implements|with)\s+.*?\bMock\b',
  );

  static final RegExp _dartPerimeterImport = RegExp(
    r"""import\s+['"]([^'"]*(?:/automa/|/conext_core/|/opt/automa/|package:automa|package:conext_core|\.\./\.\.)[^'"]*)['"]""",
  );

  static final RegExp _dartInternalSrcImport = RegExp(
    r"""import\s+['"](package:[^/'"]+/src/[^'"]*)['"]""",
  );

  static final RegExp _dartTautologicalTest = RegExp(
    r'\bexpect\s*\(\s*(true\s*,\s*(?:isTrue|true)|1\s*,\s*1)\s*\)',
  );

  /// Valida una cadena de texto en memoria
  AstValidationReport validateContent(
    String content, {
    required String filePath,
    bool isTestFile = false,
  }) {
    if (filePath.trim().isEmpty) {
      throw const AstValidationException(
        'La ruta del archivo no puede estar vacía.',
        code: AstValidationCode.corruptConfigOrSyntax,
      );
    }

    final List<AstViolationItem> violations = <AstViolationItem>[];
    final List<String> lines = content.split('\n');

    // 1. Empty catch (en archivos que no sean tests)
    if (!isTestFile) {
      for (final RegExpMatch m in _dartEmptyCatch.allMatches(content)) {
        final int start = m.start;
        final int lineNo = content.substring(0, start).split('\n').length;
        final int startLine = (lineNo - 2).clamp(0, lines.length);
        final int endLine = (lineNo + 2).clamp(0, lines.length);
        final String surrounding = lines.sublist(startLine, endLine).join('\n');
        if (!surrounding.contains('INTENTIONAL:') &&
            !surrounding.contains('intentional:')) {
          violations.add(
            AstViolationItem(
              ruleId: 'dart-empty-catch',
              filePath: filePath,
              lineNumber: lineNo,
              column: 1,
              matchedText: m.group(0) ?? '',
              message:
                  '[GOV-RULE-10] Bloque catch vacío sin justificación // INTENTIONAL:',
              code: AstValidationCode.emptyCatch,
            ),
          );
        }
      }

      // 2. Mock imports y clases Mock
      for (int i = 0; i < lines.length; i++) {
        final String line = lines[i].trim();
        if (line.startsWith('//')) continue;
        if (_dartMockImport.hasMatch(line)) {
          violations.add(
            AstViolationItem(
              ruleId: 'dart-unauthorized-mock',
              filePath: filePath,
              lineNumber: i + 1,
              column: 1,
              matchedText: line,
              message:
                  '[GOV-RULE-4] Tolerancia Cero: Mock no autorizado en producción.',
              code: AstValidationCode.unauthorizedMock,
            ),
          );
        } else if (_dartMockClass.hasMatch(line)) {
          violations.add(
            AstViolationItem(
              ruleId: 'dart-unauthorized-mock-class',
              filePath: filePath,
              lineNumber: i + 1,
              column: 1,
              matchedText: line,
              message:
                  '[GOV-RULE-4] Tolerancia Cero: Declaración de clase Mock en producción.',
              code: AstValidationCode.unauthorizedMock,
            ),
          );
        }
      }

      // 3. Perímetro sónico
      for (int i = 0; i < lines.length; i++) {
        final String line = lines[i].trim();
        if (line.startsWith('//')) continue;
        if (_dartPerimeterImport.hasMatch(line)) {
          violations.add(
            AstViolationItem(
              ruleId: 'dart-illegal-import-perimeter',
              filePath: filePath,
              lineNumber: i + 1,
              column: 1,
              matchedText: line,
              message:
                  '[GOV-RULE-2] Perímetro Sónico: Import ilegal fuera del búnker.',
              code: AstValidationCode.illegalPerimeter,
            ),
          );
        }
      }

      // 4. Imports internos src/ de dependencias externas (§46)
      for (int i = 0; i < lines.length; i++) {
        final String line = lines[i].trim();
        if (line.startsWith('//')) continue;
        final RegExpMatch? m = _dartInternalSrcImport.firstMatch(line);
        if (m != null) {
          violations.add(
            AstViolationItem(
              ruleId: 'dart-no-internal-package-src-import',
              filePath: filePath,
              lineNumber: i + 1,
              column: 1,
              matchedText: line,
              message:
                  '[GOV-RULE-CAR-01] Import ilegal de submódulo interno src/ de dependencia externa.',
              code: AstValidationCode.internalPackageImport,
            ),
          );
        }
      }
    }

    // 5. Tautological tests (en archivos de test)
    if (isTestFile) {
      for (int i = 0; i < lines.length; i++) {
        final String line = lines[i].trim();
        if (line.startsWith('//')) continue;
        if (_dartTautologicalTest.hasMatch(line)) {
          violations.add(
            AstViolationItem(
              ruleId: 'dart-no-tautological-test',
              filePath: filePath,
              lineNumber: i + 1,
              column: 1,
              matchedText: line,
              message:
                  '[GOV-RULE-CAR-02] Aserción tautológica prohibida por §4 y §6.',
              code: AstValidationCode.tautologicalTest,
            ),
          );
        }
      }
    }

    int maxCode = 0;
    for (final AstViolationItem v in violations) {
      if (v.code.exitCode > maxCode) {
        maxCode = v.code.exitCode;
      }
    }

    return AstValidationReport(
      isClean: violations.isEmpty,
      violationsCount: violations.length,
      scannedFilesCount: 1,
      elapsedMs: 1.0,
      violations: violations,
      maxExitCode: violations.isEmpty ? 0 : (maxCode == 0 ? 1 : maxCode),
    );
  }

  /// Procesa la salida JSON generada por `bin/ast-grep --json`
  AstValidationReport parseAstGrepJson(String jsonString) {
    final String clean = jsonString.trim();
    if (clean.isEmpty) {
      throw const AstValidationException(
        'El payload JSON de ast-grep no puede estar vacío.',
        code: AstValidationCode.corruptConfigOrSyntax,
      );
    }

    final dynamic parsed;
    try {
      parsed = jsonDecode(clean);
    } catch (e) {
      throw AstValidationException(
        'Formato JSON corrupto o inválido en reporte ast-grep: $e',
        code: AstValidationCode.corruptConfigOrSyntax,
      );
    }

    if (parsed is! Map<String, dynamic>) {
      throw const AstValidationException(
        'El reporte JSON de ast-grep debe ser un objeto Map.',
        code: AstValidationCode.corruptConfigOrSyntax,
      );
    }

    final bool success = parsed['success'] as bool? ?? false;
    final int scannedFiles = (parsed['scanned_files'] as num?)?.toInt() ?? 0;
    final double elapsedMs = (parsed['elapsed_ms'] as num?)?.toDouble() ?? 0.0;
    final List<dynamic> rawViolations =
        parsed['violations'] as List<dynamic>? ?? <dynamic>[];

    final List<AstViolationItem> items = rawViolations
        .whereType<Map<String, dynamic>>()
        .map((Map<String, dynamic> j) => AstViolationItem.fromJson(j))
        .toList();

    int maxCode = 0;
    for (final AstViolationItem item in items) {
      if (item.code.exitCode > maxCode) {
        maxCode = item.code.exitCode;
      }
    }

    return AstValidationReport(
      isClean: success && items.isEmpty,
      violationsCount: items.length,
      scannedFilesCount: scannedFiles,
      elapsedMs: elapsedMs,
      violations: items,
      maxExitCode: items.isEmpty ? 0 : (maxCode == 0 ? 1 : maxCode),
    );
  }

  /// Valida un archivo físico en disco
  Future<AstValidationReport> validateFile(File file) async {
    if (!await file.exists()) {
      throw AstValidationException(
        'El archivo objetivo no existe en disco: ${file.path}',
        filePath: file.path,
        code: AstValidationCode.corruptConfigOrSyntax,
      );
    }

    final String content = await file.readAsString();
    final bool isTest =
        file.path.contains('/test/') || file.path.endsWith('_test.dart');
    return validateContent(content, filePath: file.path, isTestFile: isTest);
  }
}
