import 'dart:core';

/// Definición de tarea individual para el empaquetador elástico.
class TaskDefinition {
  final String id;
  final List<String> predictedFiles;
  final bool requiresSadPaths;
  final String? title;
  final String? desc;
  final String? zone;

  const TaskDefinition({
    required this.id,
    required this.predictedFiles,
    this.requiresSadPaths = false,
    this.title,
    this.desc,
    this.zone,
  });

  factory TaskDefinition.fromJson(Map<String, dynamic> json) {
    final List<dynamic> rawFiles =
        (json['predicted_files'] as List<dynamic>?) ??
        (json['predictedFiles'] as List<dynamic>?) ??
        <dynamic>[];
    return TaskDefinition(
      id: json['id']?.toString() ?? '',
      predictedFiles: rawFiles.map((dynamic e) => e.toString()).toList(),
      requiresSadPaths:
          json['requires_sad_paths'] == true ||
          json['requiresSadPaths'] == true,
      title: json['title']?.toString(),
      desc: json['desc']?.toString(),
      zone: json['zone']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'predicted_files': predictedFiles,
    'requires_sad_paths': requiresSadPaths,
    if (title != null) 'title': title,
    if (desc != null) 'desc': desc,
    if (zone != null) 'zone': zone,
  };
}

/// Lote atómico de tareas empaquetadas (Micro-lote conforme a SPEC-SATELLITE-DISPATCH-01).
class TaskBatch {
  final String batchId;
  final List<String> taskIds;
  final List<String> predictedFiles;
  final String status;
  final String? assignedKeyId;
  final String? prUrl;
  final String? branch;

  const TaskBatch({
    required this.batchId,
    required this.taskIds,
    required this.predictedFiles,
    this.status = 'QUEUED',
    this.assignedKeyId,
    this.prUrl,
    this.branch,
  });

  factory TaskBatch.fromJson(Map<String, dynamic> json) {
    final List<dynamic> rawTasks =
        (json['task_ids'] as List<dynamic>?) ??
        (json['taskIds'] as List<dynamic>?) ??
        <dynamic>[];
    final List<dynamic> rawFiles =
        (json['predicted_files'] as List<dynamic>?) ??
        (json['predictedFiles'] as List<dynamic>?) ??
        <dynamic>[];
    return TaskBatch(
      batchId:
          json['batch_id']?.toString() ?? json['batchId']?.toString() ?? '',
      taskIds: rawTasks.map((dynamic e) => e.toString()).toList(),
      predictedFiles: rawFiles.map((dynamic e) => e.toString()).toList(),
      status: json['status']?.toString() ?? 'QUEUED',
      assignedKeyId:
          json['assigned_key_id']?.toString() ??
          json['assignedKeyId']?.toString(),
      prUrl: json['pr_url']?.toString() ?? json['prUrl']?.toString(),
      branch: json['branch']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'batch_id': batchId,
    'task_ids': taskIds,
    'predicted_files': predictedFiles,
    'status': status,
    if (assignedKeyId != null) 'assigned_key_id': assignedKeyId,
    if (prUrl != null) 'pr_url': prUrl,
    if (branch != null) 'branch': branch,
  };
}

/// Motor de Empaquetado Dinámico Elástico (Dynamic Bin Packing).
/// Cumple con SPEC-SATELLITE-DISPATCH-01 y reglas §12.b, §39, §44.
class DynamicTaskBatcher {
  static const int maxTasksPerBatch = 3;
  static const int maxFilesPerBatch = 5;

  const DynamicTaskBatcher();

  /// Agrupa la lista de tareas [tasks] en micro-lotes que satisfacen:
  /// 1. Máximo 3 tareas por lote.
  /// 2. Máximo 5 archivos únicos acumulados por lote.
  ///
  /// Lanza [ArgumentError] si [tasks] está vacía.
  /// Lanza [FormatException] si una tarea individual excede [maxFilesPerBatch] archivos.
  List<TaskBatch> batchTasks(
    List<TaskDefinition> tasks, {
    String batchPrefix = 'BATCH',
  }) {
    if (tasks.isEmpty) {
      throw ArgumentError('Task list cannot be empty.');
    }

    // Validación individual previa: regla §12.b indivisible
    for (final TaskDefinition task in tasks) {
      final Set<String> uniqueFiles = task.predictedFiles.toSet();
      if (uniqueFiles.length > maxFilesPerBatch) {
        throw FormatException(
          'Task "${task.id}" predicts ${uniqueFiles.length} files, which exceeds '
          'the constitutional limit of $maxFilesPerBatch files (§12.b). Sub-task fragmentation required.',
        );
      }
    }

    final List<TaskBatch> batches = <TaskBatch>[];
    List<TaskDefinition> currentBatchTasks = <TaskDefinition>[];
    Set<String> currentUniqueFiles = <String>{};

    void finalizeCurrentBatch() {
      if (currentBatchTasks.isEmpty) return;
      final int batchIndex = batches.length + 1;
      final String batchId =
          '$batchPrefix-${batchIndex.toString().padLeft(2, '0')}';
      final List<String> sortedFiles = currentUniqueFiles.toList()..sort();
      batches.add(
        TaskBatch(
          batchId: batchId,
          taskIds: currentBatchTasks.map((TaskDefinition t) => t.id).toList(),
          predictedFiles: sortedFiles,
          status: 'QUEUED',
        ),
      );
      currentBatchTasks = <TaskDefinition>[];
      currentUniqueFiles = <String>{};
    }

    for (final TaskDefinition task in tasks) {
      final Set<String> taskFiles = task.predictedFiles.toSet();
      final Set<String> candidateFiles = currentUniqueFiles.union(taskFiles);

      final bool canFitTasks = currentBatchTasks.length < maxTasksPerBatch;
      final bool canFitFiles = candidateFiles.length <= maxFilesPerBatch;

      if (canFitTasks && canFitFiles) {
        currentBatchTasks.add(task);
        currentUniqueFiles = candidateFiles;
      } else {
        finalizeCurrentBatch();
        currentBatchTasks.add(task);
        currentUniqueFiles = taskFiles;
      }
    }

    finalizeCurrentBatch();
    return batches;
  }

  /// Valida un [TaskBatch] existente contra los invariantes constitucionales.
  /// Lanza [ArgumentError] si el lote está vacío.
  /// Lanza [FormatException] si viola los límites de tareas o archivos.
  void validateBatch(TaskBatch batch) {
    if (batch.taskIds.isEmpty) {
      throw ArgumentError('Batch "${batch.batchId}" contains 0 tasks.');
    }
    if (batch.taskIds.length > maxTasksPerBatch) {
      throw FormatException(
        'Batch "${batch.batchId}" contains ${batch.taskIds.length} tasks, '
        'exceeding max allowed ($maxTasksPerBatch).',
      );
    }
    final Set<String> uniqueFiles = batch.predictedFiles.toSet();
    if (uniqueFiles.length > maxFilesPerBatch) {
      throw FormatException(
        'Batch "${batch.batchId}" contains ${uniqueFiles.length} unique files, '
        'exceeding max allowed ($maxFilesPerBatch per §12.b).',
      );
    }
  }
}
