import 'dart:convert';

/// Modelo tipado e inmutable para Manifiestos de Despacho de la Factoría Jules.
/// Cumple con la doctrina Pure Dart (§39) y las restricciones de gobernanza (§12.b).
class DispatchManifest {
  final String manifestVersion;
  final String taskId;
  final String taskTitle;
  final String taskDesc;
  final String satellite;
  final String? satellitePath;
  final String branch;
  final String baseBranch;
  final String zone;
  final List<String> targetFiles;
  final String verificationCommand;
  final String? admissionToken;
  final Map<String, dynamic> constraints;
  final List<String> acceptanceCriteria;
  final String executionId;

  const DispatchManifest({
    required this.manifestVersion,
    required this.taskId,
    required this.taskTitle,
    required this.taskDesc,
    required this.satellite,
    this.satellitePath,
    required this.branch,
    this.baseBranch = 'master',
    this.zone = 'GREEN',
    required this.targetFiles,
    required this.verificationCommand,
    this.admissionToken,
    this.constraints = const <String, dynamic>{},
    required this.acceptanceCriteria,
    required this.executionId,
  });

  /// Parsea un manifiesto desde un mapa JSON validando campos obligatorios.
  factory DispatchManifest.fromJson(Map<String, dynamic> json) {
    final String? taskId = json['task_id'] as String?;
    if (taskId == null || taskId.trim().isEmpty) {
      throw const FormatException(
        'DispatchManifest requiere "task_id" no vacío',
      );
    }

    final String? taskTitle = json['task_title'] as String?;
    if (taskTitle == null || taskTitle.trim().isEmpty) {
      throw const FormatException(
        'DispatchManifest requiere "task_title" no vacío',
      );
    }

    final String? satellite = json['satellite'] as String?;
    if (satellite == null || satellite.trim().isEmpty) {
      throw const FormatException(
        'DispatchManifest requiere "satellite" no vacío',
      );
    }

    final String? branch = json['branch'] as String?;
    if (branch == null || branch.trim().isEmpty) {
      throw const FormatException(
        'DispatchManifest requiere "branch" no vacío',
      );
    }

    final Object? rawFiles = json['target_files'];
    if (rawFiles is! List || rawFiles.isEmpty) {
      throw const FormatException(
        'DispatchManifest requiere "target_files" como lista no vacía',
      );
    }
    final List<String> targetFiles = rawFiles
        .map((dynamic e) => e.toString())
        .toList();
    if (targetFiles.length > 5) {
      throw const FormatException(
        'DispatchManifest excede el tope de atomicidad (§12.b): máximo 5 archivos',
      );
    }

    final String? verificationCommand = json['verification_command'] as String?;
    if (verificationCommand == null || verificationCommand.trim().isEmpty) {
      throw const FormatException(
        'DispatchManifest requiere "verification_command" no vacío',
      );
    }

    final Object? rawCriteria = json['acceptance_criteria'];
    if (rawCriteria is! List || rawCriteria.isEmpty) {
      throw const FormatException(
        'DispatchManifest requiere "acceptance_criteria" como lista no vacía',
      );
    }
    final List<String> acceptanceCriteria = rawCriteria
        .map((dynamic e) => e.toString())
        .toList();

    // Extraer o inferir executionId
    String executionId = json['execution_id'] as String? ?? '';
    if (executionId.isEmpty) {
      final RegExpMatch? match = RegExp(r'factory/([^/]+)/').firstMatch(branch);
      if (match != null && match.group(1) != null) {
        executionId = match.group(1)!;
      } else {
        executionId = 'exec-001';
      }
    }

    final String taskDesc = json['task_desc'] as String? ?? taskTitle;

    return DispatchManifest(
      manifestVersion: json['manifest_version'] as String? ?? '1.0.0',
      taskId: taskId,
      taskTitle: taskTitle,
      taskDesc: taskDesc,
      satellite: satellite,
      satellitePath: json['satellite_path'] as String?,
      branch: branch,
      baseBranch: json['base_branch'] as String? ?? 'master',
      zone: json['zone'] as String? ?? 'GREEN',
      targetFiles: targetFiles,
      verificationCommand: verificationCommand,
      admissionToken: json['admission_token'] as String?,
      constraints:
          (json['constraints'] as Map<String, dynamic>?) ??
          const <String, dynamic>{},
      acceptanceCriteria: acceptanceCriteria,
      executionId: executionId,
    );
  }

  /// Parsea desde string JSON.
  factory DispatchManifest.fromJsonString(String source) {
    final Object? decoded = json.decode(source);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('El JSON de manifiesto debe ser un objeto.');
    }
    return DispatchManifest.fromJson(decoded);
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'manifest_version': manifestVersion,
    'task_id': taskId,
    'task_title': taskTitle,
    'task_desc': taskDesc,
    'satellite': satellite,
    if (satellitePath != null) 'satellite_path': satellitePath,
    'branch': branch,
    'base_branch': baseBranch,
    'zone': zone,
    'target_files': targetFiles,
    'verification_command': verificationCommand,
    if (admissionToken != null) 'admission_token': admissionToken,
    'constraints': constraints,
    'acceptance_criteria': acceptanceCriteria,
    'execution_id': executionId,
  };
}
