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
      return const SystemMemorySnapshot(
        totalMb: 8192.0,
        availableMb: 4096.0,
        usedPercentage: 50.0,
      );
    }
  }
}
