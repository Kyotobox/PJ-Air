import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;

import '../platform_guard.dart';
import 'cas_storage_engine.dart';
import 'incremental_render_spec.dart';

/// Excepción base para fallas en el motor de empalme rápido FFmpeg.
class FastSpliceException implements Exception {
  final String message;
  final String? jobId;

  const FastSpliceException(this.message, {this.jobId});

  @override
  String toString() =>
      'FastSpliceException: $message${jobId != null ? ' [Job: $jobId]' : ''}';
}

/// Disparada cuando el binario de FFmpeg o FFprobe no se encuentra en el sistema.
class FastSpliceDependencyException extends FastSpliceException {
  const FastSpliceDependencyException(super.message, {super.jobId});

  @override
  String toString() => 'FastSpliceDependencyException: $message';
}

/// Disparada cuando un clip o artefacto referenciado en el plan no existe en disco.
class FastSpliceMissingArtifactException extends FastSpliceException {
  final String artifactPath;

  const FastSpliceMissingArtifactException(
    super.message, {
    required this.artifactPath,
    super.jobId,
  });

  @override
  String toString() =>
      'FastSpliceMissingArtifactException: $message [Ruta: $artifactPath]';
}

/// Disparada cuando los segmentos no son compatibles para stream-copy (mismatch de códec, resolución o fps).
class FastSpliceIncompatibleStreamsException extends FastSpliceException {
  final List<String> mismatchReasons;

  const FastSpliceIncompatibleStreamsException(
    super.message, {
    this.mismatchReasons = const <String>[],
    super.jobId,
  });

  @override
  String toString() =>
      'FastSpliceIncompatibleStreamsException: $message (${mismatchReasons.join(", ")})';
}

/// Disparada cuando la ejecución física del proceso FFmpeg falla con código de retorno != 0.
class FastSpliceExecutionException extends FastSpliceException {
  final int exitCode;
  final List<String> command;
  final String stderr;
  final String stdout;

  const FastSpliceExecutionException(
    super.message, {
    required this.exitCode,
    required this.command,
    required this.stderr,
    this.stdout = '',
    super.jobId,
  });

  @override
  String toString() =>
      'FastSpliceExecutionException (Exit Code: $exitCode): $message\n'
      'Comando: ${command.join(" ")}\n'
      'Stderr: ${stderr.trim()}';
}

/// Disparada ante planes vacíos, identificadores inválidos o configuraciones contradictorias.
class FastSpliceInvalidPlanException extends FastSpliceException {
  const FastSpliceInvalidPlanException(super.message, {super.jobId});

  @override
  String toString() => 'FastSpliceInvalidPlanException: $message';
}

/// Disparada cuando el proceso de empalme excede el tiempo límite de ejecución.
class FastSpliceTimeoutException extends FastSpliceException {
  final Duration timeout;

  const FastSpliceTimeoutException(
    super.message, {
    required this.timeout,
    super.jobId,
  });

  @override
  String toString() =>
      'FastSpliceTimeoutException: $message (Timeout: ${timeout.inMilliseconds}ms)';
}

/// Abstracción desacoplada para la ejecución de procesos del sistema operativo.
/// Permite ejecutar binarios reales del SO sin utilizar mocks en memoria (§4).
abstract class SpliceProcessExecutor {
  ProcessResult execute(
    String executable,
    List<String> arguments, {
    String? workingDirectory,
    Map<String, String>? environment,
  });

  Future<ProcessResult> executeAsync(
    String executable,
    List<String> arguments, {
    String? workingDirectory,
    Map<String, String>? environment,
  });
}

/// Ejecutor nativo por defecto basado en `dart:io Process.runSync` y `Process.run`.
class NativeSpliceProcessExecutor implements SpliceProcessExecutor {
  final Duration timeout;

  const NativeSpliceProcessExecutor({
    this.timeout = const Duration(seconds: 30),
  });

  @override
  ProcessResult execute(
    String executable,
    List<String> arguments, {
    String? workingDirectory,
    Map<String, String>? environment,
  }) {
    return Process.runSync(
      executable,
      arguments,
      workingDirectory: workingDirectory,
      environment: environment,
    );
  }

  @override
  Future<ProcessResult> executeAsync(
    String executable,
    List<String> arguments, {
    String? workingDirectory,
    Map<String, String>? environment,
  }) {
    return Process.run(
      executable,
      arguments,
      workingDirectory: workingDirectory,
      environment: environment,
    );
  }
}

/// Opciones de configuración para el motor de empalme rápido FastSpliceEngine.
class FastSpliceOptions {
  final String? ffmpegBinary;
  final String? ffprobeBinary;
  final String? tempDirectory;
  final int concurrencyThreads;
  final int slaThresholdMs;
  final bool forceReencodeOnMismatch;
  final bool faststart;
  final SpliceProcessExecutor processExecutor;
  final PlatformGuard platformGuard;
  final String logLevel;

  FastSpliceOptions({
    this.ffmpegBinary,
    this.ffprobeBinary,
    this.tempDirectory,
    this.concurrencyThreads = 2,
    this.slaThresholdMs = 2000,
    this.forceReencodeOnMismatch = false,
    this.faststart = true,
    SpliceProcessExecutor? processExecutor,
    PlatformGuard? platformGuard,
    this.logLevel = 'warning',
  }) : processExecutor = processExecutor ?? const NativeSpliceProcessExecutor(),
       platformGuard = platformGuard ?? PlatformGuard() {
    if (concurrencyThreads < 1) {
      throw const FastSpliceInvalidPlanException(
        'concurrencyThreads debe ser mayor o igual a 1 (§33)',
      );
    }
    if (slaThresholdMs <= 0) {
      throw const FastSpliceInvalidPlanException(
        'slaThresholdMs debe ser un valor positivo mayor a 0ms',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'ffmpeg_binary': ffmpegBinary,
    'ffprobe_binary': ffprobeBinary,
    'temp_directory': tempDirectory,
    'concurrency_threads': concurrencyThreads,
    'sla_threshold_ms': slaThresholdMs,
    'force_reencode_on_mismatch': forceReencodeOnMismatch,
    'faststart': faststart,
    'log_level': logLevel,
  };

  factory FastSpliceOptions.fromJson(Map<String, dynamic> json) {
    return FastSpliceOptions(
      ffmpegBinary: json['ffmpeg_binary'] as String?,
      ffprobeBinary: json['ffprobe_binary'] as String?,
      tempDirectory: json['temp_directory'] as String?,
      concurrencyThreads: (json['concurrency_threads'] as num?)?.toInt() ?? 2,
      slaThresholdMs: (json['sla_threshold_ms'] as num?)?.toInt() ?? 2000,
      forceReencodeOnMismatch:
          (json['force_reencode_on_mismatch'] as bool?) ?? false,
      faststart: (json['faststart'] as bool?) ?? true,
      logLevel: (json['log_level'] as String?) ?? 'warning',
    );
  }
}

/// Informe de compatibilidad de flujos multimedia para stream-copy concatenación.
class StreamCompatibilityReport {
  final bool isCompatible;
  final String? videoCodec;
  final String? audioCodec;
  final int? width;
  final int? height;
  final double? fps;
  final List<String> mismatchReasons;
  final SpliceMethod recommendedMethod;

  const StreamCompatibilityReport({
    required this.isCompatible,
    this.videoCodec,
    this.audioCodec,
    this.width,
    this.height,
    this.fps,
    this.mismatchReasons = const <String>[],
    required this.recommendedMethod,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'is_compatible': isCompatible,
    'video_codec': videoCodec,
    'audio_codec': audioCodec,
    'width': width,
    'height': height,
    'fps': fps,
    'mismatch_reasons': mismatchReasons,
    'recommended_method': recommendedMethod.value,
  };
}

/// Resultado de ejecución física del motor de empalme rápido.
class FastSpliceResult {
  final String jobId;
  final String outputPath;
  final int durationMs;
  final bool isSlaMet;
  final SpliceMethod spliceMethod;
  final int segmentsSpliced;
  final int bytesProcessed;
  final int outputSizeBytes;
  final CasKey? casKey;
  final List<String> ffmpegCommandExecuted;
  final String? concatManifestContent;
  final Map<String, dynamic> metadata;

  const FastSpliceResult({
    required this.jobId,
    required this.outputPath,
    required this.durationMs,
    required this.isSlaMet,
    required this.spliceMethod,
    required this.segmentsSpliced,
    required this.bytesProcessed,
    required this.outputSizeBytes,
    this.casKey,
    required this.ffmpegCommandExecuted,
    this.concatManifestContent,
    this.metadata = const <String, dynamic>{},
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'job_id': jobId,
    'output_path': outputPath,
    'duration_ms': durationMs,
    'is_sla_met': isSlaMet,
    'splice_method': spliceMethod.value,
    'segments_spliced': segmentsSpliced,
    'bytes_processed': bytesProcessed,
    'output_size_bytes': outputSizeBytes,
    'cas_key': casKey?.value,
    'ffmpeg_command': ffmpegCommandExecuted,
    'concat_manifest_content': concatManifestContent,
    'metadata': metadata,
  };

  @override
  String toString() =>
      'FastSpliceResult(job: $jobId, time: ${durationMs}ms, SLA: $isSlaMet, method: ${spliceMethod.value}, size: $outputSizeBytes bytes)';
}

/// Motor físico de empalme rápido de video/audio sin re-encoding (FFmpeg Fast-Splice).
/// Permite iteraciones audiovisuales en menos de 2 segundos (<2s SLA) reutilizando
/// segmentos pre-renderizados desde CAS (§4, §6, §12.b, §39, §43, Política #22).
class FastSpliceEngine {
  final FastSpliceOptions options;
  final PlatformGuard _platformGuard;

  FastSpliceEngine({FastSpliceOptions? options})
    : options = options ?? FastSpliceOptions(),
      _platformGuard = options?.platformGuard ?? PlatformGuard();

  /// Resuelve la ruta ejecutable de FFmpeg verificando su existencia física.
  String resolveFfmpegBinary() {
    if (options.ffmpegBinary != null && options.ffmpegBinary!.isNotEmpty) {
      final String custom = options.ffmpegBinary!;
      final File file = File(custom);
      if (file.existsSync()) {
        return _platformGuard.normalizePath(custom);
      }
      throw FastSpliceDependencyException(
        'El binario de FFmpeg especificado no existe en la ruta: $custom',
      );
    }

    // Búsqueda en PATH del sistema
    final String whichCmd = _platformGuard.isWindows ? 'where' : 'which';
    try {
      final ProcessResult probe = options.processExecutor.execute(
        whichCmd,
        <String>['ffmpeg'],
      );
      if (probe.exitCode == 0) {
        final String found = probe.stdout.toString().trim().split('\n').first;
        if (found.isNotEmpty && File(found.trim()).existsSync()) {
          return _platformGuard.normalizePath(found.trim());
        }
      }
    } catch (_) {
      // Ignora error de comando which/where
    }

    // Rutas canónicas conocidas
    final List<String> canonicalCandidates = _platformGuard.isWindows
        ? <String>[
            r'C:\ffmpeg\bin\ffmpeg.exe',
            r'C:\Program Files\ffmpeg\bin\ffmpeg.exe',
            r'C:\ProgramData\chocolatey\bin\ffmpeg.exe',
          ]
        : <String>[
            '/usr/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
            '/opt/homebrew/bin/ffmpeg',
            '/bin/ffmpeg',
          ];

    for (final String candidate in canonicalCandidates) {
      if (File(candidate).existsSync()) {
        return candidate;
      }
    }

    throw const FastSpliceDependencyException(
      'FFmpeg no está instalado o no se encuentra en el PATH del sistema. '
      'Es necesario para ejecutar el empalme rápido de audio/video (<2s SLA).',
    );
  }

  /// Evalúa la compatibilidad de códec, dimensiones y fps entre segmentos de render.
  StreamCompatibilityReport checkStreamCompatibility(
    List<CasMetadata> segmentMetadatas,
  ) {
    if (segmentMetadatas.isEmpty) {
      return const StreamCompatibilityReport(
        isCompatible: true,
        recommendedMethod: SpliceMethod.fastStreamCopyConcat,
      );
    }

    final List<String> mismatchReasons = <String>[];
    final CasMetadata first = segmentMetadatas.first;

    final String baseCodec = first.codec.toLowerCase();
    final int? baseWidth = first.width;
    final int? baseHeight = first.height;
    final double? baseFps = first.fps;

    for (int i = 1; i < segmentMetadatas.length; i++) {
      final CasMetadata current = segmentMetadatas[i];

      // Verificar compatibilidad de codec de video si ambos tienen información
      if (current.codec.toLowerCase() != baseCodec) {
        mismatchReasons.add(
          'Discrepancia de códec en segmento #${i + 1}: esperado $baseCodec, obtenido ${current.codec}',
        );
      }

      // Verificar resolución para segmentos visuales
      if (baseWidth != null &&
          current.width != null &&
          current.width != baseWidth) {
        mismatchReasons.add(
          'Discrepancia de ancho en segmento #${i + 1}: esperado $baseWidth, obtenido ${current.width}',
        );
      }
      if (baseHeight != null &&
          current.height != null &&
          current.height != baseHeight) {
        mismatchReasons.add(
          'Discrepancia de alto en segmento #${i + 1}: esperado $baseHeight, obtenido ${current.height}',
        );
      }

      // Tolerancia de 0.05 FPS para variaciones menores de contenedor
      if (baseFps != null &&
          current.fps != null &&
          (current.fps! - baseFps).abs() > 0.05) {
        mismatchReasons.add(
          'Discrepancia de FPS en segmento #${i + 1}: esperado $baseFps, obtenido ${current.fps}',
        );
      }
    }

    final bool isCompatible = mismatchReasons.isEmpty;
    final SpliceMethod recommended = isCompatible
        ? SpliceMethod.fastStreamCopyConcat
        : SpliceMethod.reencodeTransition;

    return StreamCompatibilityReport(
      isCompatible: isCompatible,
      videoCodec: baseCodec,
      audioCodec: 'aac',
      width: baseWidth,
      height: baseHeight,
      fps: baseFps,
      mismatchReasons: mismatchReasons,
      recommendedMethod: recommended,
    );
  }

  /// Genera un manifiesto FFmpeg Concat Demuxer (`ffconcat version 1.0`).
  /// Escapa apropiadamente comillas simples y caracteres especiales cross-platform.
  String generateConcatDemuxerFile(
    List<String> filePaths, {
    String? targetDirectory,
    String? filename,
  }) {
    if (filePaths.isEmpty) {
      throw const FastSpliceInvalidPlanException(
        'No se puede generar manifiesto concat con lista vacía de archivos.',
      );
    }

    final String dirPath =
        targetDirectory ??
        options.tempDirectory ??
        Directory.systemTemp.createTempSync('fast_splice_').path;
    final Directory dir = Directory(dirPath);
    if (!dir.existsSync()) {
      dir.createSync(recursive: true);
    }

    final String name =
        filename ?? 'concat_${DateTime.now().millisecondsSinceEpoch}_$pid.txt';
    final String concatFilePath = p.join(dir.path, name);

    final StringBuffer buffer = StringBuffer();
    buffer.writeln('ffconcat version 1.0');

    for (final String rawPath in filePaths) {
      final String normalized = _platformGuard.toForwardSlashes(rawPath);
      // Escape estricto según especificación concat demuxer de FFmpeg:
      // Las comillas simples se escapan como '\''
      final String escaped = normalized.replaceAll("'", r"'\''");
      buffer.writeln("file '$escaped'");
    }

    final File concatFile = File(concatFilePath);
    concatFile.writeAsStringSync(buffer.toString(), flush: true);
    return _platformGuard.normalizePath(concatFile.path);
  }

  /// Construye la lista de argumentos para ejecutar FFmpeg de forma agnóstica.
  List<String> buildFfmpegCommand({
    required SpliceMethod method,
    required String concatFilePath,
    required String outputPath,
    String? audioTrackPath,
    String? musicTrackPath,
    double voiceVolume = 1.0,
    double bgMusicVolume = 0.08,
    int? threads,
    bool? faststart,
  }) {
    final int effectiveThreads = threads ?? options.concurrencyThreads;
    final bool effectiveFaststart = faststart ?? options.faststart;

    final List<String> cmd = <String>[
      '-y',
      '-loglevel',
      options.logLevel,
      '-threads',
      effectiveThreads.toString(),
    ];

    final String normalizedConcat = _platformGuard.toForwardSlashes(
      concatFilePath,
    );
    final String normalizedOutput = _platformGuard.normalizePath(outputPath);

    switch (method) {
      case SpliceMethod.fastStreamCopyConcat:
        cmd.addAll(<String>[
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          normalizedConcat,
        ]);

        if (audioTrackPath != null && audioTrackPath.isNotEmpty) {
          cmd.addAll(<String>[
            '-i',
            _platformGuard.toForwardSlashes(audioTrackPath),
            '-map',
            '0:v:0',
            '-map',
            '1:a:0',
            '-c:v',
            'copy',
            '-c:a',
            'aac',
            '-b:a',
            '192k',
            '-shortest',
          ]);
        } else {
          cmd.addAll(<String>['-c', 'copy']);
        }

        if (effectiveFaststart) {
          cmd.addAll(<String>['-movflags', '+faststart']);
        }
        cmd.add(normalizedOutput);
        break;

      case SpliceMethod.audioMuxOnly:
        // concatFilePath representa en este caso el video maestro pre-ensamblado
        cmd.addAll(<String>['-i', normalizedConcat]);

        if (audioTrackPath == null || audioTrackPath.isEmpty) {
          throw const FastSpliceInvalidPlanException(
            'audioMuxOnly requiere especificar una pista de audio válida (audioTrackPath).',
          );
        }

        cmd.addAll(<String>[
          '-i',
          _platformGuard.toForwardSlashes(audioTrackPath),
          '-map',
          '0:v:0',
          '-map',
          '1:a:0',
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-shortest',
        ]);

        if (effectiveFaststart) {
          cmd.addAll(<String>['-movflags', '+faststart']);
        }
        cmd.add(normalizedOutput);
        break;

      case SpliceMethod.reencodeTransition:
      case SpliceMethod.overlayComposite:
        cmd.addAll(<String>[
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          normalizedConcat,
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          '22',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
        ]);

        if (effectiveFaststart) {
          cmd.addAll(<String>['-movflags', '+faststart']);
        }
        cmd.add(normalizedOutput);
        break;
    }

    return cmd;
  }

  /// Ejecuta el empalme síncrono a partir de una lista plana de archivos de clip.
  FastSpliceResult spliceFilesSync({
    required String jobId,
    required List<String> inputFiles,
    required String outputPath,
    SpliceMethod method = SpliceMethod.fastStreamCopyConcat,
    String? audioTrackPath,
    double voiceVolume = 1.0,
    double bgMusicVolume = 0.08,
  }) {
    if (inputFiles.isEmpty) {
      throw const FastSpliceInvalidPlanException(
        'La lista de archivos de entrada inputFiles no puede estar vacía.',
      );
    }

    // Verificar existencia física de archivos
    int totalBytesIn = 0;
    for (final String path in inputFiles) {
      final File f = File(path);
      if (!f.existsSync()) {
        throw FastSpliceMissingArtifactException(
          'El archivo de entrada no existe físicamente en disco',
          artifactPath: path,
          jobId: jobId,
        );
      }
      totalBytesIn += f.lengthSync();
    }

    if (audioTrackPath != null && audioTrackPath.isNotEmpty) {
      final File audioFile = File(audioTrackPath);
      if (!audioFile.existsSync()) {
        throw FastSpliceMissingArtifactException(
          'La pista de audio especificada no existe físicamente en disco',
          artifactPath: audioTrackPath,
          jobId: jobId,
        );
      }
      totalBytesIn += audioFile.lengthSync();
    }

    final String ffmpegBin = resolveFfmpegBinary();

    // Crear directorio padre de salida
    final File outFile = File(outputPath);
    final Directory outDir = outFile.parent;
    if (!outDir.existsSync()) {
      outDir.createSync(recursive: true);
    }

    // Generar manifiesto concat demuxer
    final String concatFile = generateConcatDemuxerFile(
      inputFiles,
      filename: 'concat_${jobId}_${DateTime.now().millisecondsSinceEpoch}.txt',
    );
    final String manifestContent = File(concatFile).readAsStringSync();

    final List<String> cmdArgs = buildFfmpegCommand(
      method: method,
      concatFilePath: concatFile,
      outputPath: outputPath,
      audioTrackPath: audioTrackPath,
      voiceVolume: voiceVolume,
      bgMusicVolume: bgMusicVolume,
    );

    final Stopwatch stopwatch = Stopwatch()..start();
    final ProcessResult result = options.processExecutor.execute(
      ffmpegBin,
      cmdArgs,
    );
    stopwatch.stop();

    final int durationMs = stopwatch.elapsedMilliseconds;

    if (result.exitCode != 0) {
      throw FastSpliceExecutionException(
        'FFmpeg falló al ejecutar el empalme rápido',
        exitCode: result.exitCode,
        command: <String>[ffmpegBin, ...cmdArgs],
        stderr: result.stderr.toString(),
        stdout: result.stdout.toString(),
        jobId: jobId,
      );
    }

    if (!outFile.existsSync()) {
      throw FastSpliceExecutionException(
        'FFmpeg completó sin error aparente pero el archivo final no fue materializado',
        exitCode: 0,
        command: <String>[ffmpegBin, ...cmdArgs],
        stderr: result.stderr.toString(),
        jobId: jobId,
      );
    }

    final int outputSizeBytes = outFile.lengthSync();
    final bool isSlaMet = durationMs <= options.slaThresholdMs;

    return FastSpliceResult(
      jobId: jobId,
      outputPath: _platformGuard.normalizePath(outputPath),
      durationMs: durationMs,
      isSlaMet: isSlaMet,
      spliceMethod: method,
      segmentsSpliced: inputFiles.length,
      bytesProcessed: totalBytesIn,
      outputSizeBytes: outputSizeBytes,
      ffmpegCommandExecuted: <String>[ffmpegBin, ...cmdArgs],
      concatManifestContent: manifestContent,
      metadata: <String, dynamic>{
        'sla_threshold_ms': options.slaThresholdMs,
        'faststart': options.faststart,
      },
    );
  }

  /// Ejecuta el empalme asíncrono a partir de una lista plana de archivos de clip.
  Future<FastSpliceResult> spliceFiles({
    required String jobId,
    required List<String> inputFiles,
    required String outputPath,
    SpliceMethod method = SpliceMethod.fastStreamCopyConcat,
    String? audioTrackPath,
    double voiceVolume = 1.0,
    double bgMusicVolume = 0.08,
  }) async {
    return spliceFilesSync(
      jobId: jobId,
      inputFiles: inputFiles,
      outputPath: outputPath,
      method: method,
      audioTrackPath: audioTrackPath,
      voiceVolume: voiceVolume,
      bgMusicVolume: bgMusicVolume,
    );
  }

  /// Ejecuta el empalme incremental síncrono guiado por un `RenderSplicePlan` y `CasStorageEngine`.
  FastSpliceResult spliceSync({
    required RenderSplicePlan plan,
    required CasStorageEngine casEngine,
    String? customOutputPath,
    bool storeInCas = false,
    Map<String, CasKey>? resolvedCasKeys,
  }) {
    if (plan.totalSteps == 0) {
      throw FastSpliceInvalidPlanException(
        'El plan de empalme no contiene pasos de ejecución ni de reuso.',
        jobId: plan.jobId,
      );
    }

    final List<String> clipPaths = <String>[];
    final List<CasMetadata> clipMetadatas = <CasMetadata>[];
    int totalBytesIn = 0;

    // Procesar pasos de reuso desde CAS
    for (final RenderExecutionStep step in plan.reuseSteps) {
      final CasKey effectiveKey =
          resolvedCasKeys?[step.casKey.value] ?? step.casKey;

      if (!casEngine.has(effectiveKey)) {
        throw FastSpliceMissingArtifactException(
          'El artefacto requerido para reuso no existe en el índice CAS',
          artifactPath: effectiveKey.value,
          jobId: plan.jobId,
        );
      }

      final File file = casEngine.getFile(effectiveKey);
      clipPaths.add(file.path);
      totalBytesIn += file.lengthSync();

      final CasMetadata? meta = casEngine.getMetadata(effectiveKey);
      if (meta == null) {
        throw FastSpliceMissingArtifactException(
          'Metadatos del artefacto no encontrados en el índice CAS',
          artifactPath: effectiveKey.value,
          jobId: plan.jobId,
        );
      }
      clipMetadatas.add(meta);
    }

    // Procesar pasos de render fresco (deben haber sido compilados o existir en outputUri)
    for (final RenderExecutionStep step in plan.renderSteps) {
      final String uri = step.outputUri;
      final File file = File(uri);
      if (!file.existsSync()) {
        throw FastSpliceMissingArtifactException(
          'El paso de render fresco no ha sido materializado antes del empalme',
          artifactPath: uri,
          jobId: plan.jobId,
        );
      }
      clipPaths.add(file.path);
      totalBytesIn += file.lengthSync();
    }

    // Evaluar compatibilidad de flujos multimedia
    final StreamCompatibilityReport report = checkStreamCompatibility(
      clipMetadatas,
    );
    SpliceMethod effectiveMethod = plan.spliceMethod;

    if (!report.isCompatible) {
      if (options.forceReencodeOnMismatch) {
        effectiveMethod = SpliceMethod.reencodeTransition;
      } else {
        throw FastSpliceIncompatibleStreamsException(
          'Los segmentos no son compatibles para fast-stream-copy concat',
          mismatchReasons: report.mismatchReasons,
          jobId: plan.jobId,
        );
      }
    }

    final String finalOutPath = customOutputPath ?? plan.outputArtifactPath;

    final FastSpliceResult spliceResult = spliceFilesSync(
      jobId: plan.jobId,
      inputFiles: clipPaths,
      outputPath: finalOutPath,
      method: effectiveMethod,
    );

    CasKey? resultingCasKey;
    if (storeInCas) {
      final File finalFile = File(spliceResult.outputPath);
      final List<int> bytes = finalFile.readAsBytesSync();
      final String sha256Hex = sha256.convert(bytes).toString();
      final CasKey casKey = CasKey(sha256Hex);

      final CasMetadata newMeta = CasMetadata(
        casKey: casKey,
        segmentType: RenderSegmentType.fullComposite,
        mimeType: 'video/mp4',
        sizeBytes: bytes.length,
        durationMs: clipMetadatas.fold<int>(
          0,
          (int sum, CasMetadata m) => sum + m.durationMs,
        ),
        width: clipMetadatas.isNotEmpty ? clipMetadatas.first.width : 1080,
        height: clipMetadatas.isNotEmpty ? clipMetadatas.first.height : 1920,
        fps: clipMetadatas.isNotEmpty ? clipMetadatas.first.fps : 30.0,
        codec: clipMetadatas.isNotEmpty ? clipMetadatas.first.codec : 'h264',
        createdAt: DateTime.now().toUtc().toIso8601String(),
        lastAccessedAt: DateTime.now().toUtc().toIso8601String(),
      );

      final CasMetadata storedMeta = casEngine.storeFile(
        sourceFile: finalFile,
        metadata: newMeta,
        extension: 'mp4',
      );
      resultingCasKey = storedMeta.casKey;
    }

    return FastSpliceResult(
      jobId: spliceResult.jobId,
      outputPath: spliceResult.outputPath,
      durationMs: spliceResult.durationMs,
      isSlaMet: spliceResult.isSlaMet,
      spliceMethod: spliceResult.spliceMethod,
      segmentsSpliced: spliceResult.segmentsSpliced,
      bytesProcessed: totalBytesIn,
      outputSizeBytes: spliceResult.outputSizeBytes,
      casKey: resultingCasKey,
      ffmpegCommandExecuted: spliceResult.ffmpegCommandExecuted,
      concatManifestContent: spliceResult.concatManifestContent,
      metadata: <String, dynamic>{
        ...spliceResult.metadata,
        'estimated_savings_ms': plan.estimatedSavingsMs,
        'stored_in_cas': storeInCas,
      },
    );
  }

  /// Ejecuta el empalme incremental asíncrono guiado por un `RenderSplicePlan` y `CasStorageEngine`.
  Future<FastSpliceResult> splice({
    required RenderSplicePlan plan,
    required CasStorageEngine casEngine,
    String? customOutputPath,
    bool storeInCas = false,
    Map<String, CasKey>? resolvedCasKeys,
  }) async {
    return spliceSync(
      plan: plan,
      casEngine: casEngine,
      customOutputPath: customOutputPath,
      storeInCas: storeInCas,
      resolvedCasKeys: resolvedCasKeys,
    );
  }

  /// Ejecuta el flujo integral desde una especificación incremental completa `IncrementalRenderSpec`.
  FastSpliceResult spliceFromSpecSync({
    required IncrementalRenderSpec spec,
    required CasStorageEngine casEngine,
    String? customOutputPath,
    bool storeInCas = false,
  }) {
    spec.validate();

    // Mapear entradas CAS disponibles resolviendo por clave de parámetros o artefacto
    final Map<String, CasMetadata> availableCasEntries =
        <String, CasMetadata>{};
    final Map<String, CasKey> resolvedCasKeys = <String, CasKey>{};

    for (final RenderSegmentSpec seg in spec.segments) {
      final CasKey paramKey = seg.calculateCasKey();
      CasKey? targetKey;
      CasMetadata? meta;

      if (casEngine.has(paramKey)) {
        targetKey = paramKey;
        meta = casEngine.getMetadata(paramKey);
      } else if (seg.cachedArtifactKey != null &&
          casEngine.has(seg.cachedArtifactKey!)) {
        targetKey = seg.cachedArtifactKey!;
        meta = casEngine.getMetadata(seg.cachedArtifactKey!);
      } else {
        try {
          final CasKey fpKey = CasKey(seg.sourceFingerprint);
          if (casEngine.has(fpKey)) {
            targetKey = fpKey;
            meta = casEngine.getMetadata(fpKey);
          }
        } catch (_) {
          // sourceFingerprint no es un hash hexadecimal de 64 caracteres
        }
      }

      if (meta != null && targetKey != null) {
        availableCasEntries[paramKey.value] = meta;
        resolvedCasKeys[paramKey.value] = targetKey;
      }
    }

    final RenderSplicePlan plan = spec.generateSplicePlan(
      availableCasEntries,
      outputArtifactPath: customOutputPath,
    );

    return spliceSync(
      plan: plan,
      casEngine: casEngine,
      customOutputPath: customOutputPath,
      storeInCas: storeInCas,
      resolvedCasKeys: resolvedCasKeys,
    );
  }

  /// Ejecuta el flujo integral asíncrono desde una especificación incremental completa.
  Future<FastSpliceResult> spliceFromSpec({
    required IncrementalRenderSpec spec,
    required CasStorageEngine casEngine,
    String? customOutputPath,
    bool storeInCas = false,
  }) async {
    return spliceFromSpecSync(
      spec: spec,
      casEngine: casEngine,
      customOutputPath: customOutputPath,
      storeInCas: storeInCas,
    );
  }
}
