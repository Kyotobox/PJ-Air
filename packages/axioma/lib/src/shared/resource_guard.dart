/// ResourceGuard: Salvaguarda de Recursos Físicos del SO (§33 / Pure Dart §39)
///
/// Evalúa la presión de memoria RAM del SO e impide la saturación física del sistema
/// asegurando que el consumo no exceda el umbral mandatorio del 85% (§33).
library;

import 'dart:io';

/// Excepción lanzada cuando la presión de memoria RAM supera el umbral permitido.
class ResourceGuardException implements Exception {
  final double currentPressureRatio;
  final double maxPressureThreshold;
  final int currentUsedBytes;
  final int totalMemoryBytes;
  final String message;

  const ResourceGuardException({
    required this.currentPressureRatio,
    required this.maxPressureThreshold,
    required this.currentUsedBytes,
    required this.totalMemoryBytes,
    this.message = 'Presión de memoria RAM excede el umbral de seguridad.',
  });

  @override
  String toString() =>
      '[RESOURCE_GUARD_PRESSURE_EXCEEDED] Presión de memoria RAM '
      '(${(currentPressureRatio * 100).toStringAsFixed(1)}%) '
      'supera el umbral máximo de ${(maxPressureThreshold * 100).toStringAsFixed(1)}%: '
      '$message (Usado: $currentUsedBytes bytes, Total: $totalMemoryBytes bytes)';
}

/// Reporte inmutable del estado de presión de memoria RAM.
class MemoryReport {
  final int usedBytes;
  final int totalBytes;
  final double pressureRatio;
  final double threshold;
  final bool isSafe;

  const MemoryReport({
    required this.usedBytes,
    required this.totalBytes,
    required this.pressureRatio,
    required this.threshold,
    required this.isSafe,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'used_bytes': usedBytes,
    'total_bytes': totalBytes,
    'pressure_ratio': pressureRatio,
    'threshold': threshold,
    'is_safe': isSafe,
  };

  @override
  String toString() =>
      'MemoryReport(used: ${usedBytes ~/ (1024 * 1024)}MB, '
      'total: ${totalBytes ~/ (1024 * 1024)}MB, '
      'pressure: ${(pressureRatio * 100).toStringAsFixed(1)}%, '
      'safe: $isSafe)';
}

/// Guardián físico de recursos de memoria RAM (§33).
class ResourceGuard {
  /// Umbral mandatorio constitucional: 85% (0.85).
  static const double defaultMaxPressureRatio = 0.85;

  /// Memoria base por defecto si el SO no provee total absoluto: 8 GB (8589934592 bytes).
  static const int defaultFallbackTotalMemoryBytes = 8 * 1024 * 1024 * 1024;

  final double maxPressureRatio;
  final int? _configuredTotalMemoryBytes;
  final int Function()? _rssBytesProvider;
  final int Function()? _totalBytesProvider;

  const ResourceGuard({
    this.maxPressureRatio = defaultMaxPressureRatio,
    int? totalMemoryBytes,
    int Function()? rssBytesProvider,
    int Function()? totalBytesProvider,
  }) : _configuredTotalMemoryBytes = totalMemoryBytes,
       _rssBytesProvider = rssBytesProvider,
       _totalBytesProvider = totalBytesProvider;

  /// Retorna los bytes RSS actualmente en uso por el proceso.
  int getCurrentRssBytes() {
    if (_rssBytesProvider != null) {
      return _rssBytesProvider();
    }
    return ProcessInfo.currentRss;
  }

  /// Retorna los bytes totales de memoria del sistema o el fallback configurado.
  int getTotalMemoryBytes() {
    if (_totalBytesProvider != null) {
      return _totalBytesProvider();
    }
    if (_configuredTotalMemoryBytes != null &&
        _configuredTotalMemoryBytes > 0) {
      return _configuredTotalMemoryBytes;
    }
    return defaultFallbackTotalMemoryBytes;
  }

  /// Genera un [MemoryReport] examinando el estado de memoria actual o personalizado.
  MemoryReport inspectMemory({int? customUsedBytes, int? customTotalBytes}) {
    final int used = customUsedBytes ?? getCurrentRssBytes();
    final int total = customTotalBytes ?? getTotalMemoryBytes();

    if (total <= 0) {
      throw ArgumentError.value(
        total,
        'totalBytes',
        'La memoria total debe ser mayor a 0 bytes.',
      );
    }

    if (used < 0) {
      throw ArgumentError.value(
        used,
        'usedBytes',
        'La memoria usada no puede ser negativa.',
      );
    }

    final double ratio = used / total;
    final bool safe = ratio < maxPressureRatio;

    return MemoryReport(
      usedBytes: used,
      totalBytes: total,
      pressureRatio: ratio,
      threshold: maxPressureRatio,
      isSafe: safe,
    );
  }

  /// Determina si la memoria actual se encuentra dentro del rango seguro (<85%).
  bool isMemorySafe({int? customUsedBytes, int? customTotalBytes}) {
    return inspectMemory(
      customUsedBytes: customUsedBytes,
      customTotalBytes: customTotalBytes,
    ).isSafe;
  }

  /// Evalúa la presión de memoria y lanza [ResourceGuardException] si excede el umbral (§33).
  void checkMemoryPressure({int? customUsedBytes, int? customTotalBytes}) {
    final MemoryReport report = inspectMemory(
      customUsedBytes: customUsedBytes,
      customTotalBytes: customTotalBytes,
    );

    if (!report.isSafe) {
      throw ResourceGuardException(
        currentPressureRatio: report.pressureRatio,
        maxPressureThreshold: report.threshold,
        currentUsedBytes: report.usedBytes,
        totalMemoryBytes: report.totalBytes,
      );
    }
  }
}
