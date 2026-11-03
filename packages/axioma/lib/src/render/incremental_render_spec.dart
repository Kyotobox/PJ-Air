import 'dart:convert';
import 'package:crypto/crypto.dart';

/// Excepción lanzada cuando una especificación de render incremental viola invariantes de dominio.
class IncrementalRenderSpecValidationException implements Exception {
  final String message;
  const IncrementalRenderSpecValidationException(this.message);

  @override
  String toString() => 'IncrementalRenderSpecValidationException: $message';
}

/// Excepción lanzada cuando una clave CAS o metadato de almacenamiento es inválido.
class CasKeyValidationException implements Exception {
  final String message;
  const CasKeyValidationException(this.message);

  @override
  String toString() => 'CasKeyValidationException: $message';
}

/// Excepción lanzada cuando la resolución de dependencias o empalme falla.
class SplicePlanResolutionException implements Exception {
  final String message;
  const SplicePlanResolutionException(this.message);

  @override
  String toString() => 'SplicePlanResolutionException: $message';
}

/// Tipos de segmentos modulares en el timeline de renderizado audiovisual.
enum RenderSegmentType {
  hook('hook'),
  body('body'),
  cta('cta'),
  voiceTrack('voice_track'),
  musicTrack('music_track'),
  subtitlesTrack('subtitles_track'),
  overlay('overlay'),
  fullComposite('full_composite');

  final String value;
  const RenderSegmentType(this.value);

  static RenderSegmentType fromString(String raw) {
    final String normalized = raw.trim().toLowerCase();
    for (final RenderSegmentType type in RenderSegmentType.values) {
      if (type.value == normalized || type.name.toLowerCase() == normalized) {
        return type;
      }
    }
    throw IncrementalRenderSpecValidationException(
      'Tipo de segmento desconocido: "$raw". Válidos: '
      '${RenderSegmentType.values.map((RenderSegmentType e) => e.value).join(", ")}',
    );
  }
}

/// Métodos de empalme y ensamblaje de pistas multimedia.
enum SpliceMethod {
  fastStreamCopyConcat('fast_stream_copy_concat'),
  reencodeTransition('reencode_transition'),
  audioMuxOnly('audio_mux_only'),
  overlayComposite('overlay_composite');

  final String value;
  const SpliceMethod(this.value);

  static SpliceMethod fromString(String raw) {
    final String normalized = raw.trim().toLowerCase();
    for (final SpliceMethod method in SpliceMethod.values) {
      if (method.value == normalized ||
          method.name.toLowerCase() == normalized) {
        return method;
      }
    }
    throw IncrementalRenderSpecValidationException(
      'Método de empalme desconocido: "$raw". Válidos: '
      '${SpliceMethod.values.map((SpliceMethod e) => e.value).join(", ")}',
    );
  }
}

/// Estrategias de desalojo para almacenamiento CAS (TASK-N54-02).
enum CasEvictionStrategy {
  lru('lru'),
  lfu('lfu'),
  fifo('fifo'),
  pinNeverEvict('pin_never_evict');

  final String value;
  const CasEvictionStrategy(this.value);

  static CasEvictionStrategy fromString(String raw) {
    final String normalized = raw.trim().toLowerCase();
    for (final CasEvictionStrategy strategy in CasEvictionStrategy.values) {
      if (strategy.value == normalized ||
          strategy.name.toLowerCase() == normalized) {
        return strategy;
      }
    }
    throw CasKeyValidationException(
      'Estrategia de desalojo desconocida: "$raw". Válidos: '
      '${CasEvictionStrategy.values.map((CasEvictionStrategy e) => e.value).join(", ")}',
    );
  }
}

/// Clave de Contenido Inmutable (Content-Addressable Key) basada en SHA-256.
class CasKey {
  static final RegExp _hexRegex = RegExp(r'^[a-f0-9]{64}$');

  final String value;

  CasKey(this.value) {
    final String trimmed = value.trim();
    if (trimmed.length != 64 || !_hexRegex.hasMatch(trimmed)) {
      throw CasKeyValidationException(
        'Clave CAS inválida. Debe ser un hash SHA-256 de 64 caracteres hexadecimales en minúsculas. Recibido: "$value"',
      );
    }
  }

  factory CasKey.fromString(String raw) => CasKey(raw);

  /// Calcula determinísticamente el hash SHA-256 normalizando parámetros y orden lexicográfico.
  static CasKey compute({
    required RenderSegmentType segmentType,
    required String sourceFingerprint,
    required Map<String, dynamic> parameters,
  }) {
    if (sourceFingerprint.trim().isEmpty) {
      throw const CasKeyValidationException(
        'sourceFingerprint no puede ser vacío',
      );
    }

    final Object canonicalParams = _canonicalize(parameters);
    final Map<String, dynamic> payload = <String, dynamic>{
      'type': segmentType.value,
      'fingerprint': sourceFingerprint.trim(),
      'params': canonicalParams,
    };

    final String jsonStr = jsonEncode(payload);
    final Digest digest = sha256.convert(utf8.encode(jsonStr));
    return CasKey(digest.toString());
  }

  /// Retorna la ruta física de partición de dos niveles para el sistema de archivos:
  /// `cas/sha256/xx/yy/{hash}.{ext}`
  String partitionPath({String extension = 'mp4'}) {
    final String cleanExt = extension.startsWith('.')
        ? extension.substring(1).trim().toLowerCase()
        : extension.trim().toLowerCase();
    final String p1 = value.substring(0, 2);
    final String p2 = value.substring(2, 4);
    return 'cas/sha256/$p1/$p2/$value.$cleanExt';
  }

  static Object _canonicalize(dynamic obj) {
    if (obj is Map) {
      final List<String> sortedKeys =
          obj.keys.map((dynamic k) => k.toString()).toList()..sort();
      final Map<String, dynamic> result = <String, dynamic>{};
      for (final String key in sortedKeys) {
        result[key] = _canonicalize(obj[key]);
      }
      return result;
    } else if (obj is List) {
      return obj.map(_canonicalize).toList();
    } else if (obj is double) {
      // Normalización a 4 decimales para eliminar indeterminismo IEEE-754 cross-platform
      return double.parse(obj.toStringAsFixed(4));
    }
    return obj;
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) || (other is CasKey && other.value == value);

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => value;
}

/// Metadatos inmutables de un artefacto alojado en CAS.
class CasMetadata {
  final CasKey casKey;
  final RenderSegmentType segmentType;
  final String mimeType;
  final int sizeBytes;
  final int durationMs;
  final int? width;
  final int? height;
  final double? fps;
  final String codec;
  final String createdAt;
  final String lastAccessedAt;
  final int accessCount;
  final bool isPinned;

  CasMetadata({
    required this.casKey,
    required this.segmentType,
    required this.mimeType,
    required this.sizeBytes,
    required this.durationMs,
    this.width,
    this.height,
    this.fps,
    required this.codec,
    required this.createdAt,
    required this.lastAccessedAt,
    this.accessCount = 0,
    this.isPinned = false,
  }) {
    if (sizeBytes < 0) {
      throw CasKeyValidationException(
        'sizeBytes no puede ser negativo: $sizeBytes',
      );
    }
    if (durationMs < 0) {
      throw CasKeyValidationException(
        'durationMs no puede ser negativo: $durationMs',
      );
    }
    if (width != null && width! <= 0) {
      throw CasKeyValidationException('width debe ser mayor a 0: $width');
    }
    if (height != null && height! <= 0) {
      throw CasKeyValidationException('height debe ser mayor a 0: $height');
    }
    if (fps != null && fps! <= 0) {
      throw CasKeyValidationException('fps debe ser mayor a 0: $fps');
    }
  }

  CasMetadata recordAccess({DateTime? timestamp}) {
    final String ts = (timestamp ?? DateTime.now().toUtc()).toIso8601String();
    return CasMetadata(
      casKey: casKey,
      segmentType: segmentType,
      mimeType: mimeType,
      sizeBytes: sizeBytes,
      durationMs: durationMs,
      width: width,
      height: height,
      fps: fps,
      codec: codec,
      createdAt: createdAt,
      lastAccessedAt: ts,
      accessCount: accessCount + 1,
      isPinned: isPinned,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'cas_key': casKey.value,
    'segment_type': segmentType.value,
    'mime_type': mimeType,
    'size_bytes': sizeBytes,
    'duration_ms': durationMs,
    if (width != null) 'width': width,
    if (height != null) 'height': height,
    if (fps != null) 'fps': fps,
    'codec': codec,
    'created_at': createdAt,
    'last_accessed_at': lastAccessedAt,
    'access_count': accessCount,
    'is_pinned': isPinned,
  };

  factory CasMetadata.fromJson(Map<String, dynamic> json) {
    return CasMetadata(
      casKey: CasKey(json['cas_key'] as String),
      segmentType: RenderSegmentType.fromString(json['segment_type'] as String),
      mimeType: json['mime_type'] as String,
      sizeBytes: (json['size_bytes'] as num).toInt(),
      durationMs: (json['duration_ms'] as num).toInt(),
      width: json['width'] != null ? (json['width'] as num).toInt() : null,
      height: json['height'] != null ? (json['height'] as num).toInt() : null,
      fps: json['fps'] != null ? (json['fps'] as num).toDouble() : null,
      codec: json['codec'] as String,
      createdAt: json['created_at'] as String,
      lastAccessedAt: json['last_accessed_at'] as String,
      accessCount: json['access_count'] != null
          ? (json['access_count'] as num).toInt()
          : 0,
      isPinned: json['is_pinned'] as bool? ?? false,
    );
  }
}

/// Especificación de un segmento atómico dentro de un timeline de composición.
class RenderSegmentSpec {
  final String segmentId;
  final RenderSegmentType type;
  final int startTimeMs;
  final int durationMs;
  final String sourceAssetUri;
  final String sourceFingerprint;
  final Map<String, dynamic> parameters;
  final List<String> dependencies;
  final CasKey? cachedArtifactKey;
  final bool isDirty;

  RenderSegmentSpec({
    required this.segmentId,
    required this.type,
    required this.startTimeMs,
    required this.durationMs,
    required this.sourceAssetUri,
    required this.sourceFingerprint,
    this.parameters = const <String, dynamic>{},
    this.dependencies = const <String>[],
    this.cachedArtifactKey,
    this.isDirty = false,
  }) {
    if (segmentId.trim().isEmpty) {
      throw const IncrementalRenderSpecValidationException(
        'segmentId no puede ser vacío',
      );
    }
    if (startTimeMs < 0) {
      throw IncrementalRenderSpecValidationException(
        'startTimeMs no puede ser negativo en "$segmentId": $startTimeMs',
      );
    }
    if (durationMs <= 0) {
      throw IncrementalRenderSpecValidationException(
        'durationMs debe ser mayor a 0 en "$segmentId": $durationMs',
      );
    }
    if (sourceAssetUri.trim().isEmpty) {
      throw IncrementalRenderSpecValidationException(
        'sourceAssetUri no puede ser vacío en "$segmentId"',
      );
    }
    if (sourceFingerprint.trim().isEmpty) {
      throw IncrementalRenderSpecValidationException(
        'sourceFingerprint no puede ser vacío en "$segmentId"',
      );
    }
  }

  /// Calcula determinísticamente la clave CAS del segmento.
  CasKey calculateCasKey() {
    final Map<String, dynamic> effectiveParams = <String, dynamic>{
      'start_time_ms': startTimeMs,
      'duration_ms': durationMs,
      ...parameters,
    };
    return CasKey.compute(
      segmentType: type,
      sourceFingerprint: sourceFingerprint,
      parameters: effectiveParams,
    );
  }

  RenderSegmentSpec copyWith({
    String? segmentId,
    RenderSegmentType? type,
    int? startTimeMs,
    int? durationMs,
    String? sourceAssetUri,
    String? sourceFingerprint,
    Map<String, dynamic>? parameters,
    List<String>? dependencies,
    CasKey? cachedArtifactKey,
    bool? isDirty,
  }) {
    return RenderSegmentSpec(
      segmentId: segmentId ?? this.segmentId,
      type: type ?? this.type,
      startTimeMs: startTimeMs ?? this.startTimeMs,
      durationMs: durationMs ?? this.durationMs,
      sourceAssetUri: sourceAssetUri ?? this.sourceAssetUri,
      sourceFingerprint: sourceFingerprint ?? this.sourceFingerprint,
      parameters: parameters ?? this.parameters,
      dependencies: dependencies ?? this.dependencies,
      cachedArtifactKey: cachedArtifactKey ?? this.cachedArtifactKey,
      isDirty: isDirty ?? this.isDirty,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'segment_id': segmentId,
    'type': type.value,
    'start_time_ms': startTimeMs,
    'duration_ms': durationMs,
    'source_asset_uri': sourceAssetUri,
    'source_fingerprint': sourceFingerprint,
    'parameters': parameters,
    'dependencies': dependencies,
    if (cachedArtifactKey != null)
      'cached_artifact_key': cachedArtifactKey!.value,
    'is_dirty': isDirty,
  };

  factory RenderSegmentSpec.fromJson(Map<String, dynamic> json) {
    return RenderSegmentSpec(
      segmentId: json['segment_id'] as String,
      type: RenderSegmentType.fromString(json['type'] as String),
      startTimeMs: (json['start_time_ms'] as num).toInt(),
      durationMs: (json['duration_ms'] as num).toInt(),
      sourceAssetUri: json['source_asset_uri'] as String,
      sourceFingerprint: json['source_fingerprint'] as String,
      parameters:
          (json['parameters'] as Map<String, dynamic>?) ??
          const <String, dynamic>{},
      dependencies:
          (json['dependencies'] as List<dynamic>?)
              ?.map((dynamic e) => e.toString())
              .toList() ??
          const <String>[],
      cachedArtifactKey: json['cached_artifact_key'] != null
          ? CasKey(json['cached_artifact_key'] as String)
          : null,
      isDirty: json['is_dirty'] as bool? ?? false,
    );
  }
}

/// Configuración de mastering de audio global.
class GlobalAudioSpec {
  final double targetLufs;
  final double musicDuckingDb;
  final int sampleRateHz;
  final int channels;

  const GlobalAudioSpec({
    this.targetLufs = -14.0,
    this.musicDuckingDb = -22.0,
    this.sampleRateHz = 48000,
    this.channels = 2,
  });

  void validate() {
    if (targetLufs > 0) {
      throw IncrementalRenderSpecValidationException(
        'targetLufs debe ser <= 0 dB (recibido: $targetLufs)',
      );
    }
    if (musicDuckingDb > 0) {
      throw IncrementalRenderSpecValidationException(
        'musicDuckingDb debe ser <= 0 dB (recibido: $musicDuckingDb)',
      );
    }
    if (sampleRateHz != 44100 && sampleRateHz != 48000) {
      throw IncrementalRenderSpecValidationException(
        'sampleRateHz debe ser 44100 o 48000 (recibido: $sampleRateHz)',
      );
    }
    if (channels != 1 && channels != 2) {
      throw IncrementalRenderSpecValidationException(
        'channels debe ser 1 (mono) o 2 (stereo) (recibido: $channels)',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'target_lufs': targetLufs,
    'music_ducking_db': musicDuckingDb,
    'sample_rate_hz': sampleRateHz,
    'channels': channels,
  };

  factory GlobalAudioSpec.fromJson(Map<String, dynamic> json) {
    return GlobalAudioSpec(
      targetLufs: json['target_lufs'] != null
          ? (json['target_lufs'] as num).toDouble()
          : -14.0,
      musicDuckingDb: json['music_ducking_db'] != null
          ? (json['music_ducking_db'] as num).toDouble()
          : -22.0,
      sampleRateHz: json['sample_rate_hz'] != null
          ? (json['sample_rate_hz'] as num).toInt()
          : 48000,
      channels: json['channels'] != null
          ? (json['channels'] as num).toInt()
          : 2,
    );
  }
}

/// Representa el delta de cambios entre dos especificaciones de render.
class RenderDelta {
  final String jobId;
  final Set<String> reusableSegmentIds;
  final Set<String> invalidatedSegmentIds;
  final Set<String> removedSegmentIds;
  final double reusabilityRatio;
  final bool isFullRebuild;
  final bool isNoOp;

  const RenderDelta({
    required this.jobId,
    required this.reusableSegmentIds,
    required this.invalidatedSegmentIds,
    required this.removedSegmentIds,
    required this.reusabilityRatio,
    required this.isFullRebuild,
    required this.isNoOp,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'job_id': jobId,
    'reusable_segment_ids': reusableSegmentIds.toList(),
    'invalidated_segment_ids': invalidatedSegmentIds.toList(),
    'removed_segment_ids': removedSegmentIds.toList(),
    'reusability_ratio': reusabilityRatio,
    'is_full_rebuild': isFullRebuild,
    'is_no_op': isNoOp,
  };
}

/// Paso atómico de ejecución dentro del plan de ensamblaje (Splice Plan).
class RenderExecutionStep {
  final String segmentId;
  final String action; // 'render' o 'reuse'
  final CasKey casKey;
  final String sourceOrCacheUri;
  final String outputUri;
  final Map<String, dynamic> parameters;

  const RenderExecutionStep({
    required this.segmentId,
    required this.action,
    required this.casKey,
    required this.sourceOrCacheUri,
    required this.outputUri,
    this.parameters = const <String, dynamic>{},
  });

  bool get isReuse => action == 'reuse';
  bool get isRender => action == 'render';

  Map<String, dynamic> toJson() => <String, dynamic>{
    'segment_id': segmentId,
    'action': action,
    'cas_key': casKey.value,
    'source_or_cache_uri': sourceOrCacheUri,
    'output_uri': outputUri,
    'parameters': parameters,
  };
}

/// Plan determinista de ensamblaje y empalme rápido para FFmpeg.
class RenderSplicePlan {
  final String jobId;
  final List<RenderExecutionStep> renderSteps;
  final List<RenderExecutionStep> reuseSteps;
  final SpliceMethod spliceMethod;
  final String outputArtifactPath;
  final int estimatedSavingsMs;

  const RenderSplicePlan({
    required this.jobId,
    required this.renderSteps,
    required this.reuseSteps,
    required this.spliceMethod,
    required this.outputArtifactPath,
    this.estimatedSavingsMs = 0,
  });

  int get totalSteps => renderSteps.length + reuseSteps.length;
  bool get canFastStreamCopy =>
      spliceMethod == SpliceMethod.fastStreamCopyConcat;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'job_id': jobId,
    'render_steps': renderSteps
        .map((RenderExecutionStep s) => s.toJson())
        .toList(),
    'reuse_steps': reuseSteps
        .map((RenderExecutionStep s) => s.toJson())
        .toList(),
    'splice_method': spliceMethod.value,
    'output_artifact_path': outputArtifactPath,
    'estimated_savings_ms': estimatedSavingsMs,
  };
}

/// Contrato canónico de especificación de render incremental y CAS.
class IncrementalRenderSpec {
  final String specVersion;
  final String jobId;
  final String campaignId;
  final String targetDeliverable;
  final int canvasWidth;
  final int canvasHeight;
  final double fps;
  final int totalDurationMs;
  final List<RenderSegmentSpec> segments;
  final GlobalAudioSpec? globalAudio;
  final Map<String, dynamic> metadata;

  const IncrementalRenderSpec({
    this.specVersion = '1.0.0',
    required this.jobId,
    required this.campaignId,
    required this.targetDeliverable,
    required this.canvasWidth,
    required this.canvasHeight,
    required this.fps,
    required this.totalDurationMs,
    required this.segments,
    this.globalAudio,
    this.metadata = const <String, dynamic>{},
  });

  /// Valida de forma exhaustiva los invariantes del contrato y el DAG de dependencias.
  void validate() {
    if (jobId.trim().isEmpty) {
      throw const IncrementalRenderSpecValidationException(
        'jobId no puede ser vacío',
      );
    }
    if (campaignId.trim().isEmpty) {
      throw const IncrementalRenderSpecValidationException(
        'campaignId no puede ser vacío',
      );
    }
    if (targetDeliverable.trim().isEmpty) {
      throw const IncrementalRenderSpecValidationException(
        'targetDeliverable no puede ser vacío',
      );
    }
    if (canvasWidth <= 0 || canvasHeight <= 0) {
      throw IncrementalRenderSpecValidationException(
        'Dimensiones del canvas deben ser > 0. Recibido: ${canvasWidth}x$canvasHeight',
      );
    }
    if (fps <= 0) {
      throw IncrementalRenderSpecValidationException(
        'fps debe ser > 0. Recibido: $fps',
      );
    }
    if (totalDurationMs <= 0) {
      throw IncrementalRenderSpecValidationException(
        'totalDurationMs debe ser > 0. Recibido: $totalDurationMs',
      );
    }
    if (segments.isEmpty) {
      throw const IncrementalRenderSpecValidationException(
        'La lista de segmentos no puede estar vacía',
      );
    }

    globalAudio?.validate();

    // Verificación de unicidad de IDs de segmento
    final Set<String> registeredIds = <String>{};
    for (final RenderSegmentSpec seg in segments) {
      if (registeredIds.contains(seg.segmentId)) {
        throw IncrementalRenderSpecValidationException(
          'ID de segmento duplicado detectado: "${seg.segmentId}"',
        );
      }
      registeredIds.add(seg.segmentId);
    }

    // Verificación de existencia de dependencias
    for (final RenderSegmentSpec seg in segments) {
      for (final String depId in seg.dependencies) {
        if (!registeredIds.contains(depId)) {
          throw IncrementalRenderSpecValidationException(
            'El segmento "${seg.segmentId}" declara dependencia de un segmento inexistente: "$depId"',
          );
        }
      }
    }

    // Detección de ciclos de dependencia (DAG)
    _validateNoCyclicDependencies(segments);

    // Validación de límites temporales para segmentos visuales o temporales
    for (final RenderSegmentSpec seg in segments) {
      if (seg.type != RenderSegmentType.musicTrack &&
          seg.type != RenderSegmentType.voiceTrack) {
        if (seg.startTimeMs + seg.durationMs > totalDurationMs) {
          throw IncrementalRenderSpecValidationException(
            'El segmento "${seg.segmentId}" excede la duración total: '
            '${seg.startTimeMs}ms + ${seg.durationMs}ms > ${totalDurationMs}ms',
          );
        }
      }
    }
  }

  /// Calcula el delta contra una especificación previa determinando reusabilidad.
  RenderDelta computeDelta(IncrementalRenderSpec previousSpec) {
    validate();
    previousSpec.validate();

    final Map<String, RenderSegmentSpec> prevMap = <String, RenderSegmentSpec>{
      for (final RenderSegmentSpec s in previousSpec.segments) s.segmentId: s,
    };

    final Set<String> currentIds = <String>{};
    final Set<String> reusable = <String>{};
    final Set<String> invalidated = <String>{};

    for (final RenderSegmentSpec currentSeg in segments) {
      currentIds.add(currentSeg.segmentId);
      final RenderSegmentSpec? prevSeg = prevMap[currentSeg.segmentId];

      if (prevSeg == null || currentSeg.isDirty) {
        invalidated.add(currentSeg.segmentId);
      } else {
        final CasKey currentHash = currentSeg.calculateCasKey();
        final CasKey prevHash = prevSeg.calculateCasKey();
        if (currentHash == prevHash) {
          reusable.add(currentSeg.segmentId);
        } else {
          invalidated.add(currentSeg.segmentId);
        }
      }
    }

    final Set<String> removed = prevMap.keys
        .where((String id) => !currentIds.contains(id))
        .toSet();

    final double ratio = segments.isEmpty
        ? 0.0
        : reusable.length / segments.length;
    final bool isNoOp = invalidated.isEmpty && removed.isEmpty;
    final bool isFullRebuild = reusable.isEmpty;

    return RenderDelta(
      jobId: jobId,
      reusableSegmentIds: reusable,
      invalidatedSegmentIds: invalidated,
      removedSegmentIds: removed,
      reusabilityRatio: double.parse(ratio.toStringAsFixed(4)),
      isFullRebuild: isFullRebuild,
      isNoOp: isNoOp,
    );
  }

  /// Genera el plan de ensamblaje resolviendo cache hits en el índice CAS.
  RenderSplicePlan generateSplicePlan(
    Map<String, CasMetadata> availableCasEntries, {
    String? outputArtifactPath,
  }) {
    validate();

    final List<RenderExecutionStep> renderSteps = <RenderExecutionStep>[];
    final List<RenderExecutionStep> reuseSteps = <RenderExecutionStep>[];

    for (final RenderSegmentSpec seg in segments) {
      final CasKey key = seg.calculateCasKey();
      final bool hasCache = availableCasEntries.containsKey(key.value);

      if (hasCache && !seg.isDirty) {
        reuseSteps.add(
          RenderExecutionStep(
            segmentId: seg.segmentId,
            action: 'reuse',
            casKey: key,
            sourceOrCacheUri: key.partitionPath(),
            outputUri: 'intermediate/${seg.segmentId}.mp4',
            parameters: seg.parameters,
          ),
        );
      } else {
        renderSteps.add(
          RenderExecutionStep(
            segmentId: seg.segmentId,
            action: 'render',
            casKey: key,
            sourceOrCacheUri: seg.sourceAssetUri,
            outputUri: key.partitionPath(),
            parameters: seg.parameters,
          ),
        );
      }
    }

    // Heurística de selección de método de empalme
    SpliceMethod method;
    if (renderSteps.isEmpty) {
      method = SpliceMethod.fastStreamCopyConcat;
    } else {
      final bool onlyAudioRender = renderSteps.every((RenderExecutionStep s) {
        final RenderSegmentSpec seg = segments.firstWhere(
          (RenderSegmentSpec element) => element.segmentId == s.segmentId,
        );
        return seg.type == RenderSegmentType.voiceTrack ||
            seg.type == RenderSegmentType.musicTrack;
      });

      if (onlyAudioRender) {
        method = SpliceMethod.audioMuxOnly;
      } else {
        // Si hay re-render visual, evalúa compatibilidad para fast stream copy
        method = SpliceMethod.fastStreamCopyConcat;
      }
    }

    final int estimatedSavings =
        reuseSteps.length * 4500; // ~4.5s ahorrados por segmento

    return RenderSplicePlan(
      jobId: jobId,
      renderSteps: renderSteps,
      reuseSteps: reuseSteps,
      spliceMethod: method,
      outputArtifactPath: outputArtifactPath ?? 'output/$campaignId/$jobId.mp4',
      estimatedSavingsMs: estimatedSavings,
    );
  }

  static void _validateNoCyclicDependencies(List<RenderSegmentSpec> segments) {
    final Map<String, List<String>> adjList = <String, List<String>>{
      for (final RenderSegmentSpec s in segments) s.segmentId: s.dependencies,
    };

    final Map<String, int> visited = <String, int>{
      for (final RenderSegmentSpec s in segments)
        s.segmentId: 0, // 0=unvisited, 1=visiting, 2=visited
    };

    final List<String> currentPath = <String>[];

    void dfs(String node) {
      visited[node] = 1;
      currentPath.add(node);

      for (final String neighbor in adjList[node] ?? const <String>[]) {
        if (visited[neighbor] == 1) {
          final int cycleStart = currentPath.indexOf(neighbor);
          final List<String> cycle = currentPath.sublist(cycleStart)
            ..add(neighbor);
          throw IncrementalRenderSpecValidationException(
            'Dependencia circular detectada en el grafo de segmentos: ${cycle.join(" -> ")}',
          );
        }
        if (visited[neighbor] == 0) {
          dfs(neighbor);
        }
      }

      currentPath.removeLast();
      visited[node] = 2;
    }

    for (final RenderSegmentSpec s in segments) {
      if (visited[s.segmentId] == 0) {
        dfs(s.segmentId);
      }
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'spec_version': specVersion,
    'job_id': jobId,
    'campaign_id': campaignId,
    'target_deliverable': targetDeliverable,
    'canvas_width': canvasWidth,
    'canvas_height': canvasHeight,
    'fps': fps,
    'total_duration_ms': totalDurationMs,
    'segments': segments.map((RenderSegmentSpec s) => s.toJson()).toList(),
    if (globalAudio != null) 'global_audio': globalAudio!.toJson(),
    'metadata': metadata,
  };

  factory IncrementalRenderSpec.fromJson(Map<String, dynamic> json) {
    return IncrementalRenderSpec(
      specVersion: json['spec_version'] as String? ?? '1.0.0',
      jobId: json['job_id'] as String,
      campaignId: json['campaign_id'] as String,
      targetDeliverable: json['target_deliverable'] as String,
      canvasWidth: (json['canvas_width'] as num).toInt(),
      canvasHeight: (json['canvas_height'] as num).toInt(),
      fps: (json['fps'] as num).toDouble(),
      totalDurationMs: (json['total_duration_ms'] as num).toInt(),
      segments: (json['segments'] as List<dynamic>)
          .map(
            (dynamic e) =>
                RenderSegmentSpec.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
      globalAudio: json['global_audio'] != null
          ? GlobalAudioSpec.fromJson(
              json['global_audio'] as Map<String, dynamic>,
            )
          : null,
      metadata:
          (json['metadata'] as Map<String, dynamic>?) ??
          const <String, dynamic>{},
    );
  }
}
