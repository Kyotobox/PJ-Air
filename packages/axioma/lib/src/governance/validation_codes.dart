// 🎯 Códigos de Validación y Excepciones Tipadas de Gobernanza AST (§39, §46)
// Shared Kernel Pure Dart — Desacoplado de frameworks de UI o I/O foráneo.

/// Códigos de salida y clasificación de violaciones AST
enum AstValidationCode {
  clean(0, 'CLEAN', 'Sin violaciones detectadas'),
  emptyCatch(
    10,
    'EMPTY_CATCH',
    'Bloque catch/except vacío sin justificación // INTENTIONAL:',
  ),
  unauthorizedMock(
    4,
    'UNAUTHORIZED_MOCK',
    'Tolerancia Cero: Mock no autorizado en código de producción (§4)',
  ),
  illegalPerimeter(
    2,
    'ILLEGAL_PERIMETER',
    'Perímetro Sónico: Import o ruta que traspasa la frontera del búnker (§2)',
  ),
  internalPackageImport(
    461,
    'INTERNAL_SRC_IMPORT',
    'Import ilegal de submódulos internos src/ de dependencias externas (§46)',
  ),
  tautologicalTest(
    6,
    'TAUTOLOGICAL_ASSERTION',
    'Aserción tautológica en pruebas sin verificación empírica real (§4, §6)',
  ),
  hardcodedDevUrl(
    45,
    'HARDCODED_DEV_URL',
    'URL hardcodeada de desarrollo o puerto efímero (§45)',
  ),
  corruptConfigOrSyntax(
    55,
    'CORRUPT_CONFIG_OR_SYNTAX',
    'Error de sintaxis o archivo de reglas corrupto',
  ),
  generalViolation(
    1,
    'GENERAL_VIOLATION',
    'Violación general de compuerta AST',
  );

  final int exitCode;
  final String label;
  final String description;

  const AstValidationCode(this.exitCode, this.label, this.description);

  static AstValidationCode fromRuleId(String ruleId) {
    final String r = ruleId.toLowerCase();
    if (r.contains('empty-catch') || r.contains('empty-except')) {
      return AstValidationCode.emptyCatch;
    }
    if (r.contains('mock')) {
      return AstValidationCode.unauthorizedMock;
    }
    if (r.contains('perimeter')) {
      return AstValidationCode.illegalPerimeter;
    }
    if (r.contains('internal-package') || r.contains('internal-src')) {
      return AstValidationCode.internalPackageImport;
    }
    if (r.contains('tautological')) {
      return AstValidationCode.tautologicalTest;
    }
    if (r.contains('hardcoded')) {
      return AstValidationCode.hardcodedDevUrl;
    }
    return AstValidationCode.generalViolation;
  }
}

/// Excepción formal de violación de gobernanza AST (§6, §39, §46, §60.7)
class AstValidationException implements Exception {
  final String message;
  final AstValidationCode code;
  final String? ruleId;
  final String? filePath;
  final int? lineNumber;
  final String? matchedText;
  final Map<String, dynamic>? details;

  const AstValidationException(
    this.message, {
    this.code = AstValidationCode.generalViolation,
    this.ruleId,
    this.filePath,
    this.lineNumber,
    this.matchedText,
    this.details,
  });

  @override
  String toString() {
    final StringBuffer sb = StringBuffer();
    sb.write(
      'AstValidationException [${code.label} (code ${code.exitCode})]: $message',
    );
    if (filePath != null) {
      sb.write(' at $filePath');
      if (lineNumber != null) {
        sb.write(':$lineNumber');
      }
    }
    if (matchedText != null && matchedText!.isNotEmpty) {
      sb.write(' -> "$matchedText"');
    }
    return sb.toString();
  }
}
