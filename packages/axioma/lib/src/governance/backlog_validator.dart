/// backlog_validator.dart — Validador Estructural y Ontológico de Backlog y Tickets (§12.b, §39, §51, §60.8, §62).
///
/// Integra [OntologicalScopeGate] y las reglas de atomicidad de sprints (§12.b, §44)
/// para certificar que ningún ticket viole los límites ontológicos del nodo ni el Perímetro Sónico.
library;

import 'ontological_scope_gate.dart';

/// Resultado de la validación estructural y ontológica del backlog.
class BacklogValidationReport {
  final bool isValid;
  final int exitCode;
  final String nodeId;
  final String bunkerType;
  final int totalSprints;
  final int totalTasks;
  final List<String> violations;
  final List<String> warnings;
  final List<String> approvedTaskIds;

  const BacklogValidationReport({
    required this.isValid,
    required this.exitCode,
    required this.nodeId,
    required this.bunkerType,
    required this.totalSprints,
    required this.totalTasks,
    this.violations = const <String>[],
    this.warnings = const <String>[],
    this.approvedTaskIds = const <String>[],
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'is_valid': isValid,
    'exit_code': exitCode,
    'node_id': nodeId,
    'bunker_type': bunkerType,
    'total_sprints': totalSprints,
    'total_tasks': totalTasks,
    'violations': violations,
    'warnings': warnings,
    'approved_task_ids': approvedTaskIds,
  };

  @override
  String toString() =>
      '[BACKLOG-VALIDATION] Valid: $isValid (ExitCode: $exitCode) | Node: $nodeId ($bunkerType) | Tasks: $totalTasks | Violations: ${violations.length}';
}

/// Validador de tickets y backlog con compuerta ontológica incorporada (§62).
class BacklogOntologicalValidator {
  BacklogOntologicalValidator._();

  /// Valida una tarea individual contra el perfil ontológico del nodo emisor.
  static OntologicalScopeResult validateTask({
    required String originNodeId,
    required String originBunkerType,
    required Map<String, dynamic> task,
    bool throwOnError = true,
  }) {
    final String? targetNodeId = task['node_id']?.toString();
    final List<dynamic>? rawAllowed = task['allowed_files'] as List<dynamic>?;
    final List<String> allowedFiles =
        rawAllowed?.map((dynamic e) => e.toString()).toList() ??
        const <String>[];

    return OntologicalScopeGate.evaluate(
      originNodeId: originNodeId,
      originBunkerType: originBunkerType,
      targetNodeId: targetNodeId,
      targetFiles: allowedFiles,
      throwOnError: throwOnError,
    );
  }

  /// Valida un mapa de backlog completo (con sprints y tasks).
  static BacklogValidationReport validateBacklog({
    required String originNodeId,
    required String originBunkerType,
    required Map<String, dynamic> backlog,
    bool throwOnError = false,
  }) {
    final List<String> violations = <String>[];
    final List<String> warnings = <String>[];
    final List<String> approvedTaskIds = <String>[];
    int totalTasks = 0;

    final List<dynamic>? sprints = backlog['sprints'] as List<dynamic>?;
    final int totalSprints = sprints?.length ?? 0;

    if (sprints != null) {
      for (final dynamic sprintRaw in sprints) {
        if (sprintRaw is! Map<String, dynamic>) continue;
        final List<dynamic>? tasks = sprintRaw['tasks'] as List<dynamic>?;
        if (tasks == null) continue;

        for (final dynamic taskRaw in tasks) {
          if (taskRaw is! Map<String, dynamic>) continue;
          totalTasks++;
          final String taskId = taskRaw['id']?.toString() ?? 'TASK-$totalTasks';

          final OntologicalScopeResult scopeResult = validateTask(
            originNodeId: originNodeId,
            originBunkerType: originBunkerType,
            task: taskRaw,
            throwOnError: false,
          );

          if (!scopeResult.isApproved) {
            for (final String v in scopeResult.violations) {
              violations.add('[$taskId] $v');
            }
          } else {
            approvedTaskIds.add(taskId);
          }
        }
      }
    }

    final bool isValid = violations.isEmpty;
    final int exitCode = isValid
        ? 0
        : (violations.any(
                (String v) =>
                    v.contains('Perímetro Sónico') ||
                    v.contains('Infraestructura Prohibida'),
              )
              ? 42
              : (violations.any(
                      (String v) => v.contains('Extralimitación de Gobernanza'),
                    )
                    ? 43
                    : 55));

    if (!isValid && throwOnError) {
      if (exitCode == 42) {
        throw ScopeViolationException(
          'El backlog contiene violaciones ontológicas para el nodo "$originNodeId".',
          originNodeId: originNodeId,
          violations: violations,
        );
      } else if (exitCode == 43) {
        throw GovernanceOverreachException(
          'El backlog contiene violaciones de sobrealcance de gobernanza para el nodo "$originNodeId".',
          originNodeId: originNodeId,
          violations: violations,
        );
      } else {
        throw ManifestIntegrityException(
          'El backlog contiene errores de integridad de manifiesto para el nodo "$originNodeId".',
          originNodeId: originNodeId,
          violations: violations,
        );
      }
    }

    return BacklogValidationReport(
      isValid: isValid,
      exitCode: exitCode,
      nodeId: originNodeId,
      bunkerType: originBunkerType,
      totalSprints: totalSprints,
      totalTasks: totalTasks,
      violations: violations,
      warnings: warnings,
      approvedTaskIds: approvedTaskIds,
    );
  }
}
