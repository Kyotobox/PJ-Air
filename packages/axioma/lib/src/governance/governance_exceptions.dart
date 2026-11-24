/// governance_exceptions.dart — Excepciones Tipadas de Gobernanza y Contrapeso (§6, §39, §46, §47, §61.2, §63).
///
/// Define el catálogo formal de excepciones arrojadas por las compuertas de contrapeso
/// crítico, anti-servilismo y trabajo conjunto bidireccional en Pure Dart.
library;

/// Excepción base de gobernanza y contrapeso crítico (§63).
abstract class CounterweightException implements Exception {
  final String message;
  final int exitCode;
  final List<String> details;

  const CounterweightException(
    this.message, {
    this.exitCode = 1,
    this.details = const <String>[],
  });

  @override
  String toString() =>
      '$runtimeType(exitCode: $exitCode): $message ${details.isNotEmpty ? "[Detalles: ${details.join(', ')}]" : ""}';
}

/// Excepción arrojada cuando se intenta ejecutar una directiva destructiva
/// sin proveer el bloque obligatorio de Verificación de Causa Raíz y Contrapeso (§63.2).
class MissingRootCauseBlockException extends CounterweightException {
  final List<String> missingSections;

  const MissingRootCauseBlockException(
    super.message, {
    super.exitCode = 46,
    this.missingSections = const <String>[],
  }) : super(details: missingSections);
}

/// Excepción arrojada cuando se detecta complacencia cognitiva, afirmaciones
/// serviles o acríticas sin inferencia física (§47, §61.2, §63.4).
class SycophancyDetectedException extends CounterweightException {
  final String matchedPattern;

  SycophancyDetectedException(
    super.message, {
    super.exitCode = 47,
    this.matchedPattern = '',
  }) : super(
         details: matchedPattern.isNotEmpty
             ? <String>[matchedPattern]
             : const <String>[],
       );
}

/// Excepción arrojada cuando el impacto colateral (Blast Radius) de una acción
/// excede los límites admisibles y destruye valor operativo de negocio (§63.2).
class BlastRadiusExceededException extends CounterweightException {
  final String impactAnalysis;

  BlastRadiusExceededException(
    super.message, {
    super.exitCode = 48,
    this.impactAnalysis = '',
  }) : super(
         details: impactAnalysis.isNotEmpty
             ? <String>[impactAnalysis]
             : const <String>[],
       );
}
