import 'dart:io';
import 'dispatch_manifest.dart';

/// Motor determinista de hidratación de prompts de despacho para workers automatizados (Jules).
/// Reemplaza exhaustivamente las 8 variables requeridas y valida la ausencia de placeholders residuales (§4, §12.b).
class PromptHydrator {
  static const List<String> requiredPlaceholders = <String>[
    '{{EXECUTION_ID}}',
    '{{TASK_ID}}',
    '{{TASK_TITLE}}',
    '{{SATELLITE}}',
    '{{TASK_DESC}}',
    '{{ALLOWED_FILES}}',
    '{{ACCEPTANCE_CRITERIA}}',
    '{{VERIFICATION_COMMAND}}',
  ];

  /// Formatea la lista de archivos autorizados respetando sangría markdown.
  static String formatAllowedFiles(List<String> files) {
    if (files.isEmpty) return '- (Ninguno declarado)';
    return files.map((String f) => '- `$f`').join('\n  ');
  }

  /// Formatea la lista de criterios de aceptación respetando sangría markdown.
  static String formatAcceptanceCriteria(List<String> criteria) {
    if (criteria.isEmpty) return '- (Ninguno declarado)';
    return criteria.map((String c) => '- $c').join('\n  ');
  }

  /// Hidrata el contenido de una plantilla con los datos del manifiesto.
  /// Lanza [FormatException] si alguna variable residual permanece sin sustituir.
  static String hydrate({
    required String templateContent,
    required DispatchManifest manifest,
  }) {
    if (templateContent.trim().isEmpty) {
      throw const FormatException(
        'La plantilla del prompt no puede estar vacía.',
      );
    }

    final String formattedFiles = formatAllowedFiles(manifest.targetFiles);
    final String formattedCriteria = formatAcceptanceCriteria(
      manifest.acceptanceCriteria,
    );

    String rendered = templateContent
        .replaceAll('{{EXECUTION_ID}}', manifest.executionId)
        .replaceAll('{{TASK_ID}}', manifest.taskId)
        .replaceAll('{{TASK_TITLE}}', manifest.taskTitle)
        .replaceAll('{{SATELLITE}}', manifest.satellite)
        .replaceAll('{{TASK_DESC}}', manifest.taskDesc)
        .replaceAll('{{ALLOWED_FILES}}', formattedFiles)
        .replaceAll('{{ACCEPTANCE_CRITERIA}}', formattedCriteria)
        .replaceAll('{{VERIFICATION_COMMAND}}', manifest.verificationCommand);

    // Verificación antagónica de residuos
    final RegExp residualRegex = RegExp(r'\{\{[A-Z0-9_]+\}\}');
    final Set<String> matches = residualRegex
        .allMatches(rendered)
        .map((RegExpMatch m) => m.group(0)!)
        .toSet();
    if (matches.isNotEmpty) {
      throw FormatException(
        'Hydration Sad Path: se detectaron variables sin sustituir en el prompt renderizado: ${matches.join(", ")}',
      );
    }

    return rendered;
  }

  /// Hidrata a partir de archivos en disco y guarda el artefacto renderizado.
  static File hydrateAndSave({
    required File templateFile,
    required File manifestFile,
    required Directory outputDir,
  }) {
    if (!templateFile.existsSync()) {
      throw FileSystemException('Plantilla no encontrada', templateFile.path);
    }
    if (!manifestFile.existsSync()) {
      throw FileSystemException('Manifiesto no encontrado', manifestFile.path);
    }

    final String templateContent = templateFile.readAsStringSync();
    final String manifestContent = manifestFile.readAsStringSync();
    final DispatchManifest manifest = DispatchManifest.fromJsonString(
      manifestContent,
    );

    final String rendered = hydrate(
      templateContent: templateContent,
      manifest: manifest,
    );

    if (!outputDir.existsSync()) {
      outputDir.createSync(recursive: true);
    }

    final File outputFile = File(
      '${outputDir.path}/prompt_${manifest.taskId}.md',
    );
    outputFile.writeAsStringSync(rendered);
    return outputFile;
  }
}
