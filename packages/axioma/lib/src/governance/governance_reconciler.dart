/// governance_reconciler.dart — Reconciliación Viva de Estado contra inference_queue.db y Grafo Git (§1, §4, §6, §12.b, §39, §42, §45, §51, §54).
///
/// Motor canónico de reconciliación de gobernanza (Pure Dart Core §39).
/// Reconcilia el estado físico en disco contra la cola SQLite WAL de workers (inference_queue.db)
/// y el historial de commits en Git, sincronizando atómicamente task.md y backlog.json.
library;

import 'dart:convert';
import 'dart:io' as io;
import 'package:path/path.dart' as p;
import 'package:sqlite3/sqlite3.dart';

import '../platform_guard.dart';

/// Excepción base para el subsistema de reconciliación de gobernanza (§6).
abstract class GovernanceReconciliationException implements Exception {
  final String message;
  const GovernanceReconciliationException(this.message);

  @override
  String toString() => message;
}

/// Excepción arrojada ante fallas o inconsistencias en la base de datos de cola (§6, §45).
class QueueDatabaseException extends GovernanceReconciliationException {
  const QueueDatabaseException(super.message);
}

/// Excepción arrojada ante corrupción o ausencia de documentos de gobernanza (task.md, backlog.json) (§6, §51).
class GovernanceDocumentException extends GovernanceReconciliationException {
  const GovernanceDocumentException(super.message);
}

/// Excepción arrojada ante violaciones estrictas de sincronización en modo verificación (§6, §54).
class DesyncViolationException extends GovernanceReconciliationException {
  final List<String> desyncedTasks;

  const DesyncViolationException(
    super.message, {
    this.desyncedTasks = const <String>[],
  });
}

/// Resultado canónico de la reconciliación viva de gobernanza (§1, §18).
class GovernanceReconciliationResult {
  final bool isAligned;
  final int totalTasksInspected;
  final int tasksReconciled;
  final int divergencesDetected;
  final List<String> reconciledTaskIds;
  final List<String> auditLog;
  final Map<String, String> resolvedStatuses;

  const GovernanceReconciliationResult({
    required this.isAligned,
    required this.totalTasksInspected,
    required this.tasksReconciled,
    required this.divergencesDetected,
    required this.reconciledTaskIds,
    required this.auditLog,
    required this.resolvedStatuses,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'is_aligned': isAligned,
    'total_tasks_inspected': totalTasksInspected,
    'tasks_reconciled': tasksReconciled,
    'divergences_detected': divergencesDetected,
    'reconciled_task_ids': reconciledTaskIds,
    'audit_log': auditLog,
    'resolved_statuses': resolvedStatuses,
  };

  @override
  String toString() =>
      'GovernanceReconciliationResult(aligned: $isAligned, inspected: $totalTasksInspected, '
      'reconciled: $tasksReconciled, divergences: $divergencesDetected)';
}

/// Reconciliador de estado de gobernanza contra inference_queue.db y el grafo Git (§1, §42, §45, §51).
class GovernanceReconciler {
  final String rootPath;
  final String? customQueueDbPath;
  final String? customTaskMdPath;
  final String? customBacklogJsonPath;

  const GovernanceReconciler({
    required this.rootPath,
    this.customQueueDbPath,
    this.customTaskMdPath,
    this.customBacklogJsonPath,
  });

  /// Resuelve la ruta física hacia inference_queue.db (§45).
  String? resolveQueueDbPath() {
    if (customQueueDbPath != null && customQueueDbPath!.trim().isNotEmpty) {
      return p.normalize(customQueueDbPath!.trim());
    }

    final String? envDb = io.Platform.environment['AUTOMA_QUEUE_DB'];
    if (envDb != null &&
        envDb.trim().isNotEmpty &&
        io.File(envDb.trim()).existsSync()) {
      return p.normalize(envDb.trim());
    }

    // 1. Local bunker vault/runtime/inference_queue.db
    final String localBunker = p.join(
      rootPath,
      'vault',
      'runtime',
      'inference_queue.db',
    );
    if (io.File(localBunker).existsSync()) {
      return localBunker;
    }

    // 2. Local root inference_queue.db
    final String localRoot = p.join(rootPath, 'inference_queue.db');
    if (io.File(localRoot).existsSync()) {
      return localRoot;
    }

    // 3. Parent bunker si nos encontramos en un git worktree
    final io.File gitPointer = io.File(p.join(rootPath, '.git'));
    if (gitPointer.existsSync()) {
      try {
        final String content = gitPointer.readAsStringSync().trim();
        if (content.startsWith('gitdir:')) {
          final String gitdir = content.substring(7).trim();
          final String worktreeMarker =
              '${p.separator}.git${p.separator}worktrees';
          final int worktreeIdx = gitdir.indexOf(worktreeMarker);
          if (worktreeIdx != -1) {
            final String parentRoot = gitdir.substring(0, worktreeIdx);
            final String parentDb = p.join(
              parentRoot,
              'vault',
              'runtime',
              'inference_queue.db',
            );
            if (io.File(parentDb).existsSync()) {
              return parentDb;
            }
          }
        }
      } catch (_) {
        // Calm Error UX
      }
    }

    // 4. Ruta por defecto Automa VM
    final String defaultAutoma = PlatformGuard().isWindows
        ? r'C:\opt\automa\data\inference_queue.db'
        : '/opt/automa/data/inference_queue.db';
    if (io.File(defaultAutoma).existsSync()) {
      return defaultAutoma;
    }

    return localBunker;
  }

  /// Consulta el estado de los tickets en SQLite WAL (inference_queue.db) (§4, §45).
  Map<String, String> queryQueueTasks({
    String? dbPathOverride,
    Database? injectedDb,
  }) {
    Database? db = injectedDb;
    bool shouldCloseDb = false;

    try {
      if (db == null) {
        final String? dbPath = dbPathOverride ?? resolveQueueDbPath();
        if (dbPath == null || !io.File(dbPath).existsSync()) {
          return <String, String>{};
        }
        db = sqlite3.open(dbPath, mode: OpenMode.readOnly);
        shouldCloseDb = true;
      }

      // Validar si existe la tabla inference_queue
      final ResultSet tableCheck = db.select(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='inference_queue';",
      );
      if (tableCheck.isEmpty) {
        return <String, String>{};
      }

      final ResultSet rows = db.select(
        'SELECT task_id, status FROM inference_queue;',
      );

      final Map<String, List<String>> statusGroups = <String, List<String>>{};
      for (final Row row in rows) {
        final dynamic rawTaskId = row['task_id'];
        final dynamic rawStatus = row['status'];
        if (rawTaskId == null || rawStatus == null) continue;
        final String taskId = rawTaskId.toString().trim().toUpperCase();
        final String status = rawStatus.toString().trim().toUpperCase();
        if (taskId.isEmpty) continue;
        statusGroups.putIfAbsent(taskId, () => <String>[]).add(status);
      }

      final Map<String, String> canonicalStatus = <String, String>{};
      for (final MapEntry<String, List<String>> entry in statusGroups.entries) {
        final List<String> statuses = entry.value;
        if (statuses.any(
          (String s) => s == 'MERGED' || s == 'COMPLETED' || s == 'DELIVERED',
        )) {
          canonicalStatus[entry.key] = 'DONE';
        } else if (statuses.any(
          (String s) => s == 'VETOED' || s == 'QUARANTINED',
        )) {
          canonicalStatus[entry.key] = 'REJECTED';
        } else if (statuses.any(
          (String s) =>
              s == 'IN_PROGRESS' || s == 'RUNNING' || s == 'PR_CREATED',
        )) {
          canonicalStatus[entry.key] = 'IN_PROGRESS';
        } else {
          canonicalStatus[entry.key] = statuses.last;
        }
      }

      return canonicalStatus;
    } catch (_) {
      return <String, String>{};
    } finally {
      if (shouldCloseDb && db != null) {
        db.close();
      }
    }
  }

  /// Extrae del historial de commits de Git (Grafo Git) los identificadores de tareas completadas (§1, §42).
  Set<String> queryGitCompletedTasks({
    String? customGitLog,
    int commitCount = 60,
  }) {
    String logOutput = customGitLog ?? '';
    if (customGitLog == null) {
      try {
        final io.ProcessResult result = io.Process.runSync('git', <String>[
          'log',
          '--oneline',
          '-n',
          '$commitCount',
        ], workingDirectory: rootPath);
        if (result.exitCode == 0) {
          logOutput = result.stdout.toString();
        }
      } catch (_) {
        logOutput = '';
      }
    }

    if (logOutput.trim().isEmpty) return <String>{};

    final Set<String> completedTasks = <String>{};
    final RegExp taskRegex = RegExp(
      r'\b(TASK-[A-Za-z0-9_-]+)\b',
      caseSensitive: false,
    );
    for (final RegExpMatch match in taskRegex.allMatches(logOutput)) {
      final String? taskId = match.group(1);
      if (taskId != null) {
        completedTasks.add(taskId.toUpperCase());
      }
    }
    return completedTasks;
  }

  /// Reconcilia el estado físico en disco de task.md y backlog.json (§1, §18, §45, §51).
  GovernanceReconciliationResult reconcile({
    bool applyChanges = true,
    String? customGitLog,
    Database? injectedDb,
    bool throwOnError = false,
  }) {
    final List<String> auditLog = <String>[];
    final List<String> reconciledTaskIds = <String>[];
    final Map<String, String> resolvedStatuses = <String, String>{};
    int divergencesDetected = 0;
    int tasksReconciled = 0;
    int totalTasksInspected = 0;

    final String taskMdPath = customTaskMdPath ?? p.join(rootPath, 'task.md');
    final String backlogJsonPath =
        customBacklogJsonPath ?? p.join(rootPath, 'backlog.json');

    final io.File taskFile = io.File(taskMdPath);
    if (!taskFile.existsSync()) {
      if (throwOnError) {
        throw GovernanceDocumentException(
          'Documento task.md no encontrado en ruta: $taskMdPath (§51)',
        );
      }
      return GovernanceReconciliationResult(
        isAligned: false,
        totalTasksInspected: 0,
        tasksReconciled: 0,
        divergencesDetected: 1,
        reconciledTaskIds: const <String>[],
        auditLog: <String>['[WARN] task.md no encontrado en: $taskMdPath'],
        resolvedStatuses: const <String, String>{},
      );
    }

    // 1. Obtener estados de la cola SQLite y del historial de Git
    final Map<String, String> queueStatuses = queryQueueTasks(
      injectedDb: injectedDb,
    );
    final Set<String> gitTasks = queryGitCompletedTasks(
      customGitLog: customGitLog,
    );

    // 2. Parsear y reconciliar task.md
    String taskContent;
    try {
      taskContent = taskFile.readAsStringSync();
    } catch (e) {
      if (throwOnError) {
        throw GovernanceDocumentException('Error al leer task.md: $e');
      }
      taskContent = '';
    }

    final List<String> taskLines = taskContent.split('\n');
    final RegExp taskRegex = RegExp(
      r'^(\s*-\s*\[)([ xX])(\]\s+\*\*([A-Za-z0-9_-]+)\*\*.*)$',
    );
    bool taskMdMutated = false;

    for (int i = 0; i < taskLines.length; i++) {
      final String line = taskLines[i];
      final Match? match = taskRegex.firstMatch(line);
      if (match == null) continue;

      totalTasksInspected++;
      final String prefix = match.group(1)!;
      final bool isChecked = match.group(2)!.toLowerCase() == 'x';
      final String suffix = match.group(3)!;
      final String taskId = match.group(4)!.toUpperCase();

      final String? queueStatus = queueStatuses[taskId];
      final bool isQueueDone = queueStatus == 'DONE';
      final bool isQueueRejected = queueStatus == 'REJECTED';
      final bool isGitDone = gitTasks.contains(taskId);

      final bool isPhysicallyCompleted = isQueueDone || isGitDone;

      if (isPhysicallyCompleted) {
        resolvedStatuses[taskId] = 'COMPLETED';
        if (!isChecked) {
          // Reconciliar: marcar [x] por evidencia física en cola/git (§1, §18)
          taskLines[i] =
              '$prefix'
              'x'
              '$suffix';
          taskMdMutated = true;
          divergencesDetected++;
          tasksReconciled++;
          reconciledTaskIds.add(taskId);
          final String source = isQueueDone && isGitDone
              ? 'cola + git'
              : isQueueDone
              ? 'inference_queue.db'
              : 'grafo git';
          auditLog.add(
            '[ALIGN-CHECK] Tarea $taskId marcada [x] (evidencia: $source).',
          );
        }
      } else if (isQueueRejected && isChecked && !isGitDone) {
        // Preclusión por traza (§18): revertir a [ ] si la cola reporta rechazo y no hay commit compensatorio
        taskLines[i] =
            '$prefix'
            ' '
            '$suffix';
        taskMdMutated = true;
        divergencesDetected++;
        tasksReconciled++;
        reconciledTaskIds.add(taskId);
        resolvedStatuses[taskId] = 'FAILED';
        auditLog.add(
          '[ALIGN-REVERT] Tarea $taskId revertida a [ ] por estado REJECTED en cola.',
        );
      } else if (isChecked) {
        resolvedStatuses[taskId] = 'COMPLETED';
      } else {
        resolvedStatuses[taskId] = 'PENDING';
      }
    }

    // 3. Reconciliar backlog.json si existe
    final io.File backlogFile = io.File(backlogJsonPath);
    Map<String, dynamic>? backlogJson;
    bool backlogMutated = false;

    if (backlogFile.existsSync()) {
      try {
        backlogJson =
            jsonDecode(backlogFile.readAsStringSync()) as Map<String, dynamic>;
      } catch (e) {
        if (throwOnError) {
          throw GovernanceDocumentException(
            'Error al parsear backlog.json: $e',
          );
        }
      }
    }

    if (backlogJson != null) {
      final List<dynamic>? sprints = backlogJson['sprints'] as List<dynamic>?;
      if (sprints != null) {
        for (final dynamic sprint in sprints) {
          if (sprint is! Map<String, dynamic>) continue;
          final List<dynamic>? tasks = sprint['tasks'] as List<dynamic>?;
          if (tasks == null) continue;

          for (final dynamic task in tasks) {
            if (task is! Map<String, dynamic>) continue;
            final dynamic rawId = task['id'];
            if (rawId == null) continue;
            final String taskId = rawId.toString().trim().toUpperCase();

            final String? canonicalStatus = resolvedStatuses[taskId];
            if (canonicalStatus == null) continue;

            final String currentStatus =
                (task['status']?.toString() ?? 'PLANNED').toUpperCase();

            if (canonicalStatus == 'COMPLETED' &&
                currentStatus != 'COMPLETED') {
              task['status'] = 'COMPLETED';
              backlogMutated = true;
              divergencesDetected++;
              if (!reconciledTaskIds.contains(taskId)) {
                tasksReconciled++;
                reconciledTaskIds.add(taskId);
              }
              auditLog.add(
                '[ALIGN-BACKLOG] Tarea $taskId actualizada a COMPLETED en backlog.json.',
              );
            } else if (canonicalStatus == 'FAILED' &&
                currentStatus == 'COMPLETED') {
              task['status'] = 'FAILED';
              backlogMutated = true;
              divergencesDetected++;
              if (!reconciledTaskIds.contains(taskId)) {
                tasksReconciled++;
                reconciledTaskIds.add(taskId);
              }
              auditLog.add(
                '[ALIGN-BACKLOG] Tarea $taskId actualizada a FAILED en backlog.json.',
              );
            }
          }
        }
      }
    }

    // 4. Persistir cambios si se autorizó la aplicación
    if (applyChanges) {
      if (taskMdMutated) {
        taskFile.writeAsStringSync(taskLines.join('\n'));
      }
      if (backlogMutated && backlogJson != null) {
        backlogFile.writeAsStringSync(
          const JsonEncoder.withIndent('  ').convert(backlogJson),
        );
      }
    }

    final bool isAligned = divergencesDetected == 0;

    if (!isAligned && throwOnError && !applyChanges) {
      throw DesyncViolationException(
        'Desincronización viva detectada en $divergencesDetected elemento(s): $reconciledTaskIds (§54).',
        desyncedTasks: reconciledTaskIds,
      );
    }

    return GovernanceReconciliationResult(
      isAligned: isAligned,
      totalTasksInspected: totalTasksInspected,
      tasksReconciled: tasksReconciled,
      divergencesDetected: divergencesDetected,
      reconciledTaskIds: reconciledTaskIds,
      auditLog: auditLog,
      resolvedStatuses: resolvedStatuses,
    );
  }
}
