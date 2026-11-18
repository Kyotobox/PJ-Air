/// platform_guard.dart — Módulo Centralizado de Paridad y Discriminación de Plataforma (§39, Art. Multi-OS).
///
/// Shared Kernel Pure Dart agnóstico de UI. Centraliza toda la lógica condicional
/// dependiente del sistema operativo para erradicar divergencias entre Windows y Linux.
library;

import 'dart:io' as io;
import 'package:path/path.dart' as p;

/// Tipo canónico de sistema operativo soportado en la flota CONEXT.
enum SupportedPlatform {
  windows,
  linux,
  macos,
  unknown;

  bool get isWindows => this == SupportedPlatform.windows;
  bool get isLinux => this == SupportedPlatform.linux;
  bool get isPosix =>
      this == SupportedPlatform.linux || this == SupportedPlatform.macos;
}

/// Información de recursos de memoria física del sistema operativo.
class SystemMemorySnapshot {
  /// Memoria total estimada en Megabytes.
  final double totalMb;

  /// Memoria disponible real estimada en Megabytes (reclamable + libre).
  final double availableMb;

  /// Porcentaje de memoria utilizada (0.0 a 100.0).
  final double usedPercentage;

  const SystemMemorySnapshot({
    required this.totalMb,
    required this.availableMb,
    required this.usedPercentage,
  });

  /// Indica si la memoria usada supera el umbral de seguridad de gobernanza (85%).
  bool get exceedsSafetyThreshold => usedPercentage >= 85.0;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'total_mb': totalMb,
    'available_mb': availableMb,
    'used_percentage': usedPercentage,
    'exceeds_threshold': exceedsSafetyThreshold,
  };
}

/// Resultado sellado de la resolución canónica multi-OS de transcript (§39, Art. Multi-OS).
sealed class TranscriptResolutionResult {
  const TranscriptResolutionResult();

  /// Retorna true si el transcript fue resuelto físicamente en disco.
  bool get isResolved => this is TranscriptResolved;

  /// Retorna true si el transcript no pudo resolverse y operó en modo degradado.
  bool get isDegraded => this is TranscriptDegraded;

  /// Retorna los bytes del offset si fue resuelto, o 0 en modo degradado.
  int get offsetBytes => switch (this) {
    TranscriptResolved(:final int offsetBytes) => offsetBytes,
    TranscriptDegraded() => 0,
  };
}

/// Transcripción canónica resuelta exitosamente con anclaje físico comprobado.
final class TranscriptResolved extends TranscriptResolutionResult {
  /// Ruta física absoluta del archivo transcript.jsonl.
  final String path;

  /// Tamaño en bytes del archivo transcript.jsonl en el momento de la resolución.
  @override
  final int offsetBytes;

  /// Identificador de la conversación resuelta.
  final String conversationId;

  const TranscriptResolved({
    required this.path,
    required this.offsetBytes,
    required this.conversationId,
  });

  @override
  String toString() =>
      'TranscriptResolved(conversationId: $conversationId, path: $path, offsetBytes: $offsetBytes)';
}

/// Transcripción no resoluble físicamente; degradación controlada (§45, Calm Error UX).
final class TranscriptDegraded extends TranscriptResolutionResult {
  /// Motivo técnico de la degradación.
  final String reason;

  /// Lista de rutas candidatas inspeccionadas durante la resolución.
  final List<String> candidates;

  const TranscriptDegraded({
    required this.reason,
    this.candidates = const <String>[],
  });

  @override
  String toString() =>
      'TranscriptDegraded(reason: $reason, candidates: ${candidates.length})';
}

/// Guardián unificado de plataforma para la flota CONEXT (Art. Multi-OS.1, Multi-OS.2).
class PlatformGuard {
  final SupportedPlatform platform;
  final p.Context pathContext;

  PlatformGuard({SupportedPlatform? platform, p.Context? pathContext})
    : platform = platform ?? _detectCurrentPlatform(),
      pathContext =
          pathContext ??
          _createPathContext(platform ?? _detectCurrentPlatform());

  static SupportedPlatform _detectCurrentPlatform() {
    if (io.Platform.isWindows) return SupportedPlatform.windows;
    if (io.Platform.isLinux) return SupportedPlatform.linux;
    if (io.Platform.isMacOS) return SupportedPlatform.macos;
    return SupportedPlatform.unknown;
  }

  static p.Context _createPathContext(SupportedPlatform platform) {
    if (platform.isWindows) {
      return p.Context(style: p.Style.windows);
    }
    return p.Context(style: p.Style.posix);
  }

  /// Retorna true si el entorno actual es Windows.
  bool get isWindows => platform.isWindows;

  /// Retorna true si el entorno actual es Linux.
  bool get isLinux => platform.isLinux;

  /// Retorna true si el entorno es compatible con estándares POSIX (Linux o macOS).
  bool get isPosix => platform.isPosix;

  /// Normaliza una ruta asegurando el uso de los separadores canónicos de la plataforma.
  String normalizePath(String rawPath) {
    if (rawPath.isEmpty) return rawPath;
    return pathContext.normalize(rawPath);
  }

  /// Convierte cualquier ruta a formato cross-platform seguro con barras inclinadas forward (`/`).
  String toForwardSlashes(String rawPath) {
    return rawPath.replaceAll(r'\', '/');
  }

  /// Retorna la ruta relativa calculada desde [from] hacia [to] con el contexto de la plataforma.
  String relativePath(String to, {required String from}) {
    return pathContext.relative(to, from: from);
  }

  /// Retorna el ejecutable de shell nativo adecuado para la plataforma.
  String get defaultShellExecutable {
    if (isWindows) {
      return 'cmd.exe';
    }
    return 'bash';
  }

  /// Retorna los argumentos de shell estándar para ejecutar un comando en una sola línea.
  List<String> buildShellArguments(String command) {
    if (command.trim().isEmpty) {
      throw ArgumentError('El comando de shell no puede estar vacío.');
    }
    if (isWindows) {
      return <String>['/c', command];
    }
    return <String>['-c', command];
  }

  /// Lee el estado de memoria del sistema operativo de forma determinista y segura.
  SystemMemorySnapshot readMemoryUsage({String? meminfoOverride}) {
    if (isLinux) {
      return _parseLinuxMeminfo(meminfoOverride);
    }
    // Fallback conservador para Windows / macOS cuando no hay hook nativo FFI
    return const SystemMemorySnapshot(
      totalMb: 16384.0,
      availableMb: 8192.0,
      usedPercentage: 50.0,
    );
  }

  SystemMemorySnapshot _parseLinuxMeminfo(String? overrideContent) {
    try {
      final String content;
      if (overrideContent != null) {
        content = overrideContent;
      } else {
        final io.File file = io.File('/proc/meminfo');
        if (!file.existsSync()) {
          return const SystemMemorySnapshot(
            totalMb: 8192.0,
            availableMb: 4096.0,
            usedPercentage: 50.0,
          );
        }
        content = file.readAsStringSync();
      }

      double? totalKb;
      double? availableKb;

      for (final String line in content.split('\n')) {
        final List<String> parts = line.split(':');
        if (parts.length < 2) continue;

        final String key = parts[0].trim();
        final String valueRaw = parts[1].trim().split(' ').first;
        final double? val = double.tryParse(valueRaw);
        if (val == null) continue;

        if (key == 'MemTotal') totalKb = val;
        if (key == 'MemAvailable') availableKb = val;
      }

      if (totalKb == null || totalKb <= 0) {
        throw const FormatException(
          'No se pudo determinar MemTotal en /proc/meminfo',
        );
      }

      final double available = availableKb ?? (totalKb * 0.5);
      final double totalMb = totalKb / 1024.0;
      final double availableMb = available / 1024.0;
      final double usedMb = totalMb - availableMb;
      final double usedPercentage = (usedMb / totalMb) * 100.0;

      return SystemMemorySnapshot(
        totalMb: double.parse(totalMb.toStringAsFixed(2)),
        availableMb: double.parse(availableMb.toStringAsFixed(2)),
        usedPercentage: double.parse(usedPercentage.toStringAsFixed(2)),
      );
    } catch (_) {
      // INTENTIONAL: Fallback seguro a snapshot conservador ante error de lectura o parsing de /proc/meminfo
      return const SystemMemorySnapshot(
        totalMb: 8192.0,
        availableMb: 4096.0,
        usedPercentage: 50.0,
      );
    }
  }

  /// Resuelve canónicamente el transcript para un [conversationId] dado (§39, Art. Multi-OS).
  ///
  /// Retorna [TranscriptResolved] con [TranscriptResolved.offsetBytes] si el archivo físico existe,
  /// o [TranscriptDegraded] con la lista de rutas candidatas evaluadas ante rutas inexistentes
  /// o directorio home/brain no resoluble sin crashear (Calm Error UX, §45).
  static TranscriptResolutionResult resolveTranscript({
    String? conversationId,
    String? overrideHome,
    String? brainPath,
    SupportedPlatform? platform,
    Map<String, String>? environment,
    p.Context? pathContext,
  }) {
    final SupportedPlatform effectivePlatform =
        platform ?? _detectCurrentPlatform();
    final p.Context ctx = pathContext ?? _createPathContext(effectivePlatform);
    final Map<String, String> env = environment ?? io.Platform.environment;

    if (conversationId == null || conversationId.trim().isEmpty) {
      return const TranscriptDegraded(
        reason: 'El conversationId está vacío o es nulo.',
        candidates: <String>[],
      );
    }
    final String cleanConvId = conversationId.trim();

    // 1. Resolver home directory de forma Multi-OS agnóstica sin rutas hardcoded
    String? resolvedHome = overrideHome?.trim();
    if (resolvedHome == null || resolvedHome.isEmpty) {
      if (effectivePlatform.isWindows) {
        resolvedHome = env['USERPROFILE'] ?? env['HOME'];
        if ((resolvedHome == null || resolvedHome.isEmpty) &&
            env['HOMEDRIVE'] != null &&
            env['HOMEPATH'] != null) {
          resolvedHome = '${env['HOMEDRIVE']}${env['HOMEPATH']}';
        }
      } else {
        resolvedHome = env['HOME'] ?? env['USERPROFILE'];
      }
    }

    final List<String> candidatePaths = <String>[];

    // 2. Si se proporciona brainPath explícito, evaluar sus rutas canónicas primero
    if (brainPath != null && brainPath.trim().isNotEmpty) {
      final String cleanBrain = brainPath.trim();
      candidatePaths.add(
        ctx.join(
          cleanBrain,
          cleanConvId,
          '.system_generated',
          'logs',
          'transcript.jsonl',
        ),
      );
      candidatePaths.add(ctx.join(cleanBrain, cleanConvId, 'transcript.jsonl'));
      candidatePaths.add(
        ctx.join(cleanBrain, '.system_generated', 'logs', 'transcript.jsonl'),
      );
      candidatePaths.add(ctx.join(cleanBrain, 'transcript.jsonl'));
    }

    // 3. Evaluar ubicaciones canónicas bajo resolvedHome si está disponible
    if (resolvedHome != null && resolvedHome.isNotEmpty) {
      final List<String> brainBases = <String>[
        ctx.join(resolvedHome, '.gemini', 'antigravity-cli', 'brain'),
        ctx.join(resolvedHome, '.gemini', 'antigravity-ide', 'brain'),
        ctx.join(resolvedHome, '.gemini', 'brain'),
        ctx.join(resolvedHome, '.gemini', 'antigravity', 'brain'),
      ];

      for (final String base in brainBases) {
        candidatePaths.add(
          ctx.join(
            base,
            cleanConvId,
            '.system_generated',
            'logs',
            'transcript.jsonl',
          ),
        );
        candidatePaths.add(ctx.join(base, cleanConvId, 'transcript.jsonl'));
      }
    } else if (candidatePaths.isEmpty) {
      return const TranscriptDegraded(
        reason:
            'No se pudo resolver el directorio home del usuario en la plataforma activa.',
        candidates: <String>[],
      );
    }

    // 4. Evaluar existencia física real (§4, SSSoT Física)
    for (final String candidate in candidatePaths) {
      try {
        final io.File file = io.File(candidate);
        if (file.existsSync()) {
          final int length = file.lengthSync();
          return TranscriptResolved(
            path: candidate,
            offsetBytes: length,
            conversationId: cleanConvId,
          );
        }
      } on io.FileSystemException {
        // INTENTIONAL: Fallback a siguiente candidato si ocurre error de I/O en sistema de archivos
      } catch (_) {
        // INTENTIONAL: Fallback seguro a siguiente candidato ante error de acceso o parsing de la ruta
      }
    }

    return TranscriptDegraded(
      reason:
          'No se encontró ningún archivo transcript.jsonl físico en los candidatos evaluados.',
      candidates: List<String>.unmodifiable(candidatePaths),
    );
  }

  /// Aserción estricta de transcript resuelto (§4, Fast-fail / Sad Path con excepción tipada).
  static TranscriptResolved requireTranscript({
    String? conversationId,
    String? overrideHome,
    String? brainPath,
    SupportedPlatform? platform,
    Map<String, String>? environment,
    p.Context? pathContext,
  }) {
    final TranscriptResolutionResult result = resolveTranscript(
      conversationId: conversationId,
      overrideHome: overrideHome,
      brainPath: brainPath,
      platform: platform,
      environment: environment,
      pathContext: pathContext,
    );
    return switch (result) {
      TranscriptResolved resolved => resolved,
      TranscriptDegraded degraded => throw io.PathNotFoundException(
        degraded.candidates.isNotEmpty ? degraded.candidates.first : '',
        const io.OSError('Transcript no encontrado o no resoluble', 2),
        degraded.reason,
      ),
    };
  }
}

/// Extensión de conveniencia para invocar [PlatformGuard.resolveTranscript] sobre una instancia.
extension PlatformGuardTranscriptExtension on PlatformGuard {
  TranscriptResolutionResult resolveTranscript({
    String? conversationId,
    String? overrideHome,
    String? brainPath,
    Map<String, String>? environment,
  }) => PlatformGuard.resolveTranscript(
    conversationId: conversationId,
    overrideHome: overrideHome,
    brainPath: brainPath,
    platform: platform,
    pathContext: pathContext,
    environment: environment,
  );

  TranscriptResolved requireTranscript({
    String? conversationId,
    String? overrideHome,
    String? brainPath,
    Map<String, String>? environment,
  }) => PlatformGuard.requireTranscript(
    conversationId: conversationId,
    overrideHome: overrideHome,
    brainPath: brainPath,
    platform: platform,
    pathContext: pathContext,
    environment: environment,
  );
}
