/// atomic_task_bifurcator.dart — Auto-Bifurcación Atómica ante Exceso de Archivos (§4, §6, §12.b, §39, §45).
///
/// Compuerta en sandbox que detecta listas de archivos o diffs de git >5 archivos
/// y divide la tarea en sub-tareas atómicas conformes a la Regla §12.b sin romper pre-commit.
/// Preserva la zona de seguridad del padre y garantiza degradación Calm UX ante fallas.
library;

import 'dart:convert';
import 'dart:io' as io;
import 'dart:math' as math;
import 'package:path/path.dart' as p;

import '../platform_guard.dart';

/// Excepción arrojada cuando se intenta bifurcar una lista vacía de archivos (§6, §12.b).
class EmptyFileListException implements Exception {
  final String message;

  const EmptyFileListException([
    this.message =
        'La lista de archivos para bifurcar está vacía o no contiene elementos válidos (§12.b).',
  ]);

  @override
  String toString() => 'EmptyFileListException: $message';
}

/// Excepción arrojada cuando los metadatos o el identificador de la tarea son inválidos (§6).
class InvalidTaskMetadataException implements Exception {
  final String message;

  const InvalidTaskMetadataException([
    this.message =
        'Los metadatos o el identificador de la tarea son inválidos (§12.b).',
  ]);

  @override
  String toString() => 'InvalidTaskMetadataException: $message';
}

/// Excepción arrojada cuando la inspección del diff de Git en el sandbox falla (§45).
class GitDiffInspectionException implements Exception {
  final String message;
  final int? exitCode;
  final String? stderr;

  const GitDiffInspectionException(this.message, {this.exitCode, this.stderr});

  @override
  String toString() =>
      'GitDiffInspectionException: $message (exitCode: $exitCode, stderr: $stderr)';
}

/// Excepción arrojada cuando se detecta una violación del tope constitucional de atomicidad (§12.b).
class AtomicityViolationException implements Exception {
  final int filesCount;
  final int maxAllowed;
  final String message;

  AtomicityViolationException({
    required this.filesCount,
    this.maxAllowed = 5,
    String? customMessage,
  }) : message =
           customMessage ??
           '🚨 [VIOLACIÓN-ATOMICIDAD §12.b] Se detectaron $filesCount archivos, superando el tope de $maxAllowed por tarea.';

  @override
  String toString() => 'AtomicityViolationException: $message';
}

/// Sub-tarea atómica generada mediante la bifurcación de una tarea padre (§12.b).
class BifurcatedSubTask {
  final String subTaskId;
  final String parentTaskId;
  final int partIndex;
  final int totalParts;
  final List<String> files;
  final String securityZone;
  final Map<String, dynamic> metadata;

  const BifurcatedSubTask({
    required this.subTaskId,
    required this.parentTaskId,
    required this.partIndex,
    required this.totalParts,
    required this.files,
    this.securityZone = 'GREEN',
    this.metadata = const <String, dynamic>{},
  });

  int get filesCount => files.length;

  bool get satisfiesLimit =>
      files.length <= AtomicTaskBifurcator.kMaxFilesPerSubTask;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'sub_task_id': subTaskId,
    'parent_task_id': parentTaskId,
    'part_index': partIndex,
    'total_parts': totalParts,
    'files': files,
    'files_count': files.length,
    'security_zone': securityZone,
    'metadata': metadata,
  };

  factory BifurcatedSubTask.fromJson(Map<String, dynamic> json) {
    return BifurcatedSubTask(
      subTaskId: json['sub_task_id'] as String,
      parentTaskId: json['parent_task_id'] as String,
      partIndex: json['part_index'] as int,
      totalParts: json['total_parts'] as int,
      files: (json['files'] as List<dynamic>)
          .map((dynamic e) => e.toString())
          .toList(),
      securityZone: json['security_zone'] as String? ?? 'GREEN',
      metadata:
          json['metadata'] as Map<String, dynamic>? ??
          const <String, dynamic>{},
    );
  }

  @override
  String toString() =>
      'BifurcatedSubTask($subTaskId: ${files.length} archivos, zona: $securityZone)';
}

/// Plan y resultado de bifurcación atómica (§12.b).
class BifurcationPlan {
  final bool isSuccess;
  final String originalTaskId;
  final int totalFilesDetected;
  final bool requiresBifurcation;
  final List<BifurcatedSubTask> subTasks;
  final String? errorMessage;
  final String? errorType;
  final Map<String, dynamic> metadata;
  final DateTime timestamp;

  BifurcationPlan({
    required this.isSuccess,
    required this.originalTaskId,
    required this.totalFilesDetected,
    required this.requiresBifurcation,
    required this.subTasks,
    this.errorMessage,
    this.errorType,
    this.metadata = const <String, dynamic>{},
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now().toUtc();

  factory BifurcationPlan.failure({
    required String originalTaskId,
    required String errorMessage,
    required String errorType,
    Map<String, dynamic> metadata = const <String, dynamic>{},
  }) {
    return BifurcationPlan(
      isSuccess: false,
      originalTaskId: originalTaskId,
      totalFilesDetected: 0,
      requiresBifurcation: false,
      subTasks: const <BifurcatedSubTask>[],
      errorMessage: errorMessage,
      errorType: errorType,
      metadata: metadata,
    );
  }

  int get subTasksCount => subTasks.length;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'is_success': isSuccess,
    'original_task_id': originalTaskId,
    'total_files_detected': totalFilesDetected,
    'requires_bifurcation': requiresBifurcation,
    'sub_tasks_count': subTasks.length,
    'sub_tasks': subTasks.map((BifurcatedSubTask t) => t.toJson()).toList(),
    if (errorMessage != null) 'error_message': errorMessage,
    if (errorType != null) 'error_type': errorType,
    'metadata': metadata,
    'timestamp': timestamp.toIso8601String(),
  };

  factory BifurcationPlan.fromJson(Map<String, dynamic> json) {
    return BifurcationPlan(
      isSuccess: json['is_success'] as bool? ?? true,
      originalTaskId: json['original_task_id'] as String,
      totalFilesDetected: json['total_files_detected'] as int? ?? 0,
      requiresBifurcation: json['requires_bifurcation'] as bool? ?? false,
      subTasks: (json['sub_tasks'] as List<dynamic>? ?? const <dynamic>[])
          .map(
            (dynamic e) =>
                BifurcatedSubTask.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
      errorMessage: json['error_message'] as String?,
      errorType: json['error_type'] as String?,
      metadata:
          json['metadata'] as Map<String, dynamic>? ??
          const <String, dynamic>{},
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'] as String)
          : null,
    );
  }

  @override
  String toString() =>
      'BifurcationPlan(task: $originalTaskId, files: $totalFilesDetected, bifurcated: $requiresBifurcation, parts: ${subTasks.length})';
}

/// Validador y motor de auto-bifurcación de tareas atómicas (§12.b, §45).
class AtomicTaskBifurcator {
  /// Límite constitucional estricto para workers automatizados (§12.b)
  static const int kMaxFilesPerSubTask = 5;

  final PlatformGuard platformGuard;
  final int maxFilesPerSubTask;

  AtomicTaskBifurcator({
    PlatformGuard? platformGuard,
    int maxFilesPerSubTask = kMaxFilesPerSubTask,
  }) : platformGuard = platformGuard ?? PlatformGuard(),
       maxFilesPerSubTask = maxFilesPerSubTask {
    if (maxFilesPerSubTask <= 0) {
      throw ArgumentError(
        'maxFilesPerSubTask debe ser estrictamente mayor a 0 (§6).',
      );
    }
  }

  /// Bifurca deterministamente una lista de archivos para una tarea padre (§12.b).
  ///
  /// Si la lista contiene <= [maxFilesPerSubTask] archivos, no se requiere bifurcación
  /// y se retorna 1 única sub-tarea idéntica al padre.
  /// Si excede [maxFilesPerSubTask], se divide en fragmentos contiguos de tamaño máximo
  /// [maxFilesPerSubTask] y las sub-tareas heredan la zona de seguridad y metadatos del padre.
  BifurcationPlan bifurcateTask({
    required String taskId,
    required List<String> files,
    String? securityZone,
    Map<String, dynamic> metadata = const <String, dynamic>{},
    bool throwOnError = true,
  }) {
    final String cleanTaskId = taskId.trim();
    if (cleanTaskId.isEmpty) {
      if (throwOnError) {
        throw const InvalidTaskMetadataException(
          'taskId no puede ser nulo o vacío (§6, §12.b).',
        );
      }
      return BifurcationPlan.failure(
        originalTaskId: taskId,
        errorMessage: 'taskId no puede ser nulo o vacío.',
        errorType: 'INVALID_TASK_METADATA',
        metadata: metadata,
      );
    }

    if (files.isEmpty) {
      if (throwOnError) {
        throw EmptyFileListException(
          'La lista de archivos para la tarea "$cleanTaskId" está vacía (§6, §12.b).',
        );
      }
      return BifurcationPlan.failure(
        originalTaskId: cleanTaskId,
        errorMessage: 'La lista de archivos está vacía.',
        errorType: 'EMPTY_FILE_LIST',
        metadata: metadata,
      );
    }

    // Normalización de rutas cross-platform y deduplicación preservando orden
    final List<String> cleanFiles = <String>[];
    final Set<String> seen = <String>{};

    for (final String raw in files) {
      final String trimmed = raw.trim();
      if (trimmed.isEmpty) continue;
      final String normalized = platformGuard.toForwardSlashes(
        p.normalize(trimmed),
      );
      if (seen.add(normalized)) {
        cleanFiles.add(normalized);
      }
    }

    if (cleanFiles.isEmpty) {
      if (throwOnError) {
        throw EmptyFileListException(
          'Todos los archivos proporcionados para "$cleanTaskId" estaban vacíos o malformados.',
        );
      }
      return BifurcationPlan.failure(
        originalTaskId: cleanTaskId,
        errorMessage: 'Todos los archivos estaban vacíos o malformados.',
        errorType: 'EMPTY_FILE_LIST',
        metadata: metadata,
      );
    }

    final String resolvedSecurityZone =
        securityZone ?? (metadata['security_zone'] as String?) ?? 'GREEN';

    // Caso 1: Dentro del tope constitucional (§12.b: <= 5 archivos)
    if (cleanFiles.length <= maxFilesPerSubTask) {
      final BifurcatedSubTask singleSubTask = BifurcatedSubTask(
        subTaskId: cleanTaskId,
        parentTaskId: cleanTaskId,
        partIndex: 1,
        totalParts: 1,
        files: List<String>.unmodifiable(cleanFiles),
        securityZone: resolvedSecurityZone,
        metadata: Map<String, dynamic>.from(metadata),
      );

      return BifurcationPlan(
        isSuccess: true,
        originalTaskId: cleanTaskId,
        totalFilesDetected: cleanFiles.length,
        requiresBifurcation: false,
        subTasks: <BifurcatedSubTask>[singleSubTask],
        metadata: metadata,
      );
    }

    // Caso 2: Excede el tope constitucional (§12.b: > 5 archivos) -> Auto-bifurcación
    final int totalParts =
        (cleanFiles.length + maxFilesPerSubTask - 1) ~/ maxFilesPerSubTask;
    final List<BifurcatedSubTask> subTasks = <BifurcatedSubTask>[];

    for (int i = 0; i < totalParts; i++) {
      final int start = i * maxFilesPerSubTask;
      final int end = math.min(start + maxFilesPerSubTask, cleanFiles.length);
      final List<String> chunk = cleanFiles.sublist(start, end);
      final int partIndex = i + 1;
      final String subTaskId = '$cleanTaskId-PART$partIndex';

      final Map<String, dynamic> inheritedMetadata = Map<String, dynamic>.from(
        metadata,
      );
      inheritedMetadata['bifurcated_from'] = cleanTaskId;
      inheritedMetadata['part_index'] = partIndex;
      inheritedMetadata['total_parts'] = totalParts;
      inheritedMetadata['bifurcated_at'] = DateTime.now()
          .toUtc()
          .toIso8601String();
      inheritedMetadata['security_zone'] = resolvedSecurityZone;

      subTasks.add(
        BifurcatedSubTask(
          subTaskId: subTaskId,
          parentTaskId: cleanTaskId,
          partIndex: partIndex,
          totalParts: totalParts,
          files: List<String>.unmodifiable(chunk),
          securityZone: resolvedSecurityZone,
          metadata: inheritedMetadata,
        ),
      );
    }

    return BifurcationPlan(
      isSuccess: true,
      originalTaskId: cleanTaskId,
      totalFilesDetected: cleanFiles.length,
      requiresBifurcation: true,
      subTasks: List<BifurcatedSubTask>.unmodifiable(subTasks),
      metadata: metadata,
    );
  }

  /// Inspecciona el diff físico de Git en [repositoryPath] de forma determinista (§4, §45).
  ///
  /// Analiza los cambios en el árbol de trabajo (staged, unstaged y untracked)
  /// retornando la lista canónica de rutas relativas modificadas.
  List<String> inspectGitDiff({
    required String repositoryPath,
    String baseRef = 'HEAD',
    bool includeUntracked = true,
    bool throwOnError = true,
  }) {
    final io.Directory repoDir = io.Directory(repositoryPath);
    if (!repoDir.existsSync()) {
      if (throwOnError) {
        throw GitDiffInspectionException(
          'El directorio del repositorio no existe: "$repositoryPath" (§45).',
        );
      }
      return const <String>[];
    }

    try {
      final List<String> gitArgs = <String>[
        'status',
        '--porcelain',
        '--untracked-files=${includeUntracked ? 'all' : 'no'}',
      ];

      final io.ProcessResult result = io.Process.runSync(
        'git',
        gitArgs,
        workingDirectory: repoDir.path,
      );

      if (result.exitCode != 0) {
        if (throwOnError) {
          throw GitDiffInspectionException(
            'Fallo al ejecutar "git status" en "$repositoryPath".',
            exitCode: result.exitCode,
            stderr: result.stderr.toString(),
          );
        }
        return const <String>[];
      }

      final String stdout = result.stdout.toString();
      final List<String> modifiedFiles = <String>[];
      final Set<String> seen = <String>{};

      for (final String line in stdout.split('\n')) {
        final String trimmed = line.trimRight();
        if (trimmed.length < 3) continue;

        // Formato porcelain: XY PATH o XY OLD_PATH -> NEW_PATH
        String filePathPart = trimmed.substring(3).trim();
        if (filePathPart.contains(' -> ')) {
          filePathPart = filePathPart.split(' -> ').last.trim();
        }

        // Remover comillas si git imprime con escaping
        if (filePathPart.startsWith('"') && filePathPart.endsWith('"')) {
          filePathPart = filePathPart.substring(1, filePathPart.length - 1);
        }

        if (filePathPart.isEmpty) continue;

        final String normalized = platformGuard.toForwardSlashes(
          p.normalize(filePathPart),
        );
        if (seen.add(normalized)) {
          modifiedFiles.add(normalized);
        }
      }

      return List<String>.unmodifiable(modifiedFiles);
    } catch (e) {
      if (e is GitDiffInspectionException) rethrow;
      if (throwOnError) {
        throw GitDiffInspectionException(
          'Error imprevisto inspeccionando git diff: $e',
          stderr: e.toString(),
        );
      }
      // Calm UX fallback
      return const <String>[];
    }
  }

  /// Evalúa el sandbox físico en [repositoryPath] y genera el plan de auto-bifurcación (§12.b, §45).
  BifurcationPlan evaluateSandboxAndBifurcate({
    required String repositoryPath,
    required String taskId,
    String baseRef = 'HEAD',
    String? securityZone,
    Map<String, dynamic> metadata = const <String, dynamic>{},
    bool includeUntracked = true,
    bool throwOnError = true,
  }) {
    final List<String> diffFiles = inspectGitDiff(
      repositoryPath: repositoryPath,
      baseRef: baseRef,
      includeUntracked: includeUntracked,
      throwOnError: throwOnError,
    );

    return bifurcateTask(
      taskId: taskId,
      files: diffFiles,
      securityZone: securityZone,
      metadata: metadata,
      throwOnError: throwOnError,
    );
  }

  /// Validador de compuerta para pre-commit (§12.b).
  ///
  /// Retorna `true` si la lista de archivos cumple con el tope constitucional de 5 archivos.
  /// Si excede, retorna `false` (o arroja [AtomicityViolationException] si [throwOnError] es true).
  bool validatePreCommitGate(List<String> files, {bool throwOnError = false}) {
    if (files.length > maxFilesPerSubTask) {
      if (throwOnError) {
        throw AtomicityViolationException(
          filesCount: files.length,
          maxAllowed: maxFilesPerSubTask,
        );
      }
      return false;
    }
    return true;
  }

  /// Persiste atómicamente el plan de bifurcación en disco (§48, §51).
  io.File persistPlan(BifurcationPlan plan, {io.Directory? outputDirectory}) {
    final io.Directory targetDir =
        outputDirectory ?? io.Directory('vault/runtime/bifurcations');

    if (!targetDir.existsSync()) {
      targetDir.createSync(recursive: true);
    }

    final String sanitizedTaskId = plan.originalTaskId.replaceAll(
      RegExp(r'[^a-zA-Z0-9_\-]'),
      '_',
    );
    final io.File finalFile = io.File(
      p.join(targetDir.path, '$sanitizedTaskId.plan.json'),
    );
    final io.File tempFile = io.File(
      '${finalFile.path}.${io.pid}_${DateTime.now().microsecondsSinceEpoch}.tmp',
    );

    final String content = const JsonEncoder.withIndent(
      '  ',
    ).convert(plan.toJson());
    tempFile.writeAsStringSync(content, flush: true);
    tempFile.renameSync(finalFile.path);

    return finalFile;
  }

  /// Carga y deserializa un plan de bifurcación persistido en disco.
  static BifurcationPlan loadPlanFromFile(io.File file) {
    if (!file.existsSync()) {
      throw io.FileSystemException('El archivo de plan no existe', file.path);
    }
    final String content = file.readAsStringSync();
    final dynamic decoded = jsonDecode(content);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException(
        'El archivo no contiene un JSON de BifurcationPlan válido.',
      );
    }
    return BifurcationPlan.fromJson(decoded);
  }
}
