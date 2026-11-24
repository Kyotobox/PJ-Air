import 'dart:convert';
import 'dart:io' as io;

/// Monitor de Recursos y Cuotas Cgroups v2 en Pure Dart (§39, §45).
///
/// Provee inspección, lectura de métricas y aplicación de límites para memoria (`memory.max`),
/// eventos OOM (`memory.events`) y cuotas de entrada/salida (`io.max`, `io.stat`).

/// Excepción base de Cgroups v2 (§6)
abstract class CgroupsException implements Exception {
  final String message;
  final String? cgroupPath;
  const CgroupsException(this.message, {this.cgroupPath});

  @override
  String toString() => cgroupPath != null
      ? 'CgroupsException($cgroupPath): $message'
      : 'CgroupsException: $message';
}

/// Excepción lanzada cuando la jerarquía o archivo de cgroup no existe (§6)
class CgroupsNotFoundException extends CgroupsException {
  const CgroupsNotFoundException(super.message, {super.cgroupPath});
}

/// Excepción lanzada por permisos insuficientes para leer o escribir en cgroups (§6)
class CgroupsPermissionException extends CgroupsException {
  const CgroupsPermissionException(super.message, {super.cgroupPath});
}

/// Excepción lanzada cuando los datos de cgroup tienen formato inválido (§6)
class CgroupsParsingException extends CgroupsException {
  final String? rawContent;
  const CgroupsParsingException(
    super.message, {
    this.rawContent,
    super.cgroupPath,
  });
}

/// Métricas de consumo y límites de memoria en cgroups v2 (§45)
class CgroupsV2MemoryMetrics {
  final int currentBytes;
  final int? maxBytes;
  final int oomKillCount;
  final int oomCount;

  const CgroupsV2MemoryMetrics({
    required this.currentBytes,
    this.maxBytes,
    this.oomKillCount = 0,
    this.oomCount = 0,
  });

  /// Porcentaje de uso respecto al límite max (0.0 a 100.0). Retorna 0.0 si maxBytes es ilimitado.
  double get usagePercentage {
    if (maxBytes == null || maxBytes! <= 0) return 0.0;
    return (currentBytes / maxBytes!) * 100.0;
  }

  /// Retorna true si el consumo supera el umbral porcentual especificado
  bool isNearLimit(double thresholdPct) => usagePercentage >= thresholdPct;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'current_bytes': currentBytes,
    'current_mb': (currentBytes / (1024 * 1024)).toStringAsFixed(2),
    'max_bytes': maxBytes,
    'usage_percentage': double.parse(usagePercentage.toStringAsFixed(2)),
    'oom_kill_count': oomKillCount,
    'oom_count': oomCount,
  };

  factory CgroupsV2MemoryMetrics.fromJson(Map<String, dynamic> json) =>
      CgroupsV2MemoryMetrics(
        currentBytes: (json['current_bytes'] as int?) ?? 0,
        maxBytes: json['max_bytes'] as int?,
        oomKillCount: (json['oom_kill_count'] as int?) ?? 0,
        oomCount: (json['oom_count'] as int?) ?? 0,
      );
}

/// Métricas de entrada/salida (I/O) en cgroups v2 (§45)
class CgroupsV2IoMetrics {
  final int readBytes;
  final int writeBytes;
  final int readIops;
  final int writeIops;
  final String? rawLimits;

  const CgroupsV2IoMetrics({
    this.readBytes = 0,
    this.writeBytes = 0,
    this.readIops = 0,
    this.writeIops = 0,
    this.rawLimits,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'read_bytes': readBytes,
    'write_bytes': writeBytes,
    'read_iops': readIops,
    'write_iops': writeIops,
    if (rawLimits != null) 'raw_limits': rawLimits,
  };

  factory CgroupsV2IoMetrics.fromJson(Map<String, dynamic> json) =>
      CgroupsV2IoMetrics(
        readBytes: (json['read_bytes'] as int?) ?? 0,
        writeBytes: (json['write_bytes'] as int?) ?? 0,
        readIops: (json['read_iops'] as int?) ?? 0,
        writeIops: (json['write_iops'] as int?) ?? 0,
        rawLimits: json['raw_limits'] as String?,
      );
}

/// Instantánea consolidada de cgroups v2 para un grupo de control (§45)
class CgroupsV2Snapshot {
  final String cgroupPath;
  final CgroupsV2MemoryMetrics memory;
  final CgroupsV2IoMetrics io;
  final List<int> pids;
  final DateTime timestamp;

  CgroupsV2Snapshot({
    required this.cgroupPath,
    required this.memory,
    required this.io,
    List<int>? pids,
    DateTime? timestamp,
  }) : pids = List<int>.unmodifiable(pids ?? <int>[]),
       timestamp = timestamp ?? DateTime.now().toUtc();

  Map<String, dynamic> toJson() => <String, dynamic>{
    'cgroup_path': cgroupPath,
    'memory': memory.toJson(),
    'io': io.toJson(),
    'pids': pids,
    'timestamp': timestamp.toIso8601String(),
  };

  factory CgroupsV2Snapshot.fromJson(Map<String, dynamic> json) =>
      CgroupsV2Snapshot(
        cgroupPath: (json['cgroup_path'] as String?) ?? '',
        memory: json['memory'] is Map<String, dynamic>
            ? CgroupsV2MemoryMetrics.fromJson(
                json['memory'] as Map<String, dynamic>,
              )
            : const CgroupsV2MemoryMetrics(currentBytes: 0),
        io: json['io'] is Map<String, dynamic>
            ? CgroupsV2IoMetrics.fromJson(json['io'] as Map<String, dynamic>)
            : const CgroupsV2IoMetrics(),
        pids: (json['pids'] as List<dynamic>?)?.cast<int>(),
        timestamp: json['timestamp'] != null
            ? DateTime.parse(json['timestamp'].toString())
            : null,
      );

  @override
  String toString() => jsonEncode(toJson());
}

/// Monitor de Cgroups v2 desacoplado y configurable para inspección y límites (§39, §45)
class CgroupsV2Monitor {
  final String basePath;

  const CgroupsV2Monitor({this.basePath = '/sys/fs/cgroup'});

  /// Verifica si el directorio base de cgroups v2 existe en el sistema
  bool get isAvailable {
    final io.Directory dir = io.Directory(basePath);
    if (!dir.existsSync()) return false;
    final io.File controllers = io.File('$basePath/cgroup.controllers');
    return controllers.existsSync();
  }

  /// Resuelve la ruta canónica para un cgroup relativo o absoluto
  String resolvePath([String relativePath = '']) {
    if (relativePath.isEmpty) return basePath;
    if (relativePath.startsWith('/')) return relativePath;
    return '$basePath/$relativePath';
  }

  /// Inspecciona las métricas de memoria, I/O y procesos de un cgroup
  CgroupsV2Snapshot inspect({String relativePath = ''}) {
    final String targetDir = resolvePath(relativePath);
    final io.Directory dir = io.Directory(targetDir);
    if (!dir.existsSync()) {
      throw CgroupsNotFoundException(
        'El directorio de cgroup no existe: $targetDir',
        cgroupPath: targetDir,
      );
    }

    final CgroupsV2MemoryMetrics mem = _readMemoryMetrics(targetDir);
    final CgroupsV2IoMetrics ioMetrics = _readIoMetrics(targetDir);
    final List<int> pids = _readPids(targetDir);

    return CgroupsV2Snapshot(
      cgroupPath: targetDir,
      memory: mem,
      io: ioMetrics,
      pids: pids,
    );
  }

  /// Aplica límites de memoria y/o I/O escribiendo en los controladores cgroup v2
  void applyLimits({
    String relativePath = '',
    int? memoryMaxBytes,
    String? ioMax,
  }) {
    final String targetDir = resolvePath(relativePath);
    final io.Directory dir = io.Directory(targetDir);
    if (!dir.existsSync()) {
      throw CgroupsNotFoundException(
        'No se pueden aplicar límites: el directorio no existe: $targetDir',
        cgroupPath: targetDir,
      );
    }

    if (memoryMaxBytes != null) {
      final io.File memMaxFile = io.File('$targetDir/memory.max');
      try {
        final String val = memoryMaxBytes > 0 ? '$memoryMaxBytes' : 'max';
        memMaxFile.writeAsStringSync('$val\n');
      } on io.FileSystemException catch (e) {
        throw CgroupsPermissionException(
          'Error de permisos escribiendo en memory.max: ${e.message}',
          cgroupPath: memMaxFile.path,
        );
      }
    }

    if (ioMax != null && ioMax.trim().isNotEmpty) {
      final io.File ioMaxFile = io.File('$targetDir/io.max');
      try {
        ioMaxFile.writeAsStringSync('${ioMax.trim()}\n');
      } on io.FileSystemException catch (e) {
        throw CgroupsPermissionException(
          'Error de permisos escribiendo en io.max: ${e.message}',
          cgroupPath: ioMaxFile.path,
        );
      }
    }
  }

  CgroupsV2MemoryMetrics _readMemoryMetrics(String dirPath) {
    int currentBytes = 0;
    int? maxBytes;
    int oomKill = 0;
    int oom = 0;

    // 1. memory.current
    final io.File currentFile = io.File('$dirPath/memory.current');
    if (currentFile.existsSync()) {
      final String content = currentFile.readAsStringSync().trim();
      currentBytes =
          int.tryParse(content) ??
          (throw CgroupsParsingException(
            'memory.current no es un entero válido: "$content"',
            rawContent: content,
            cgroupPath: currentFile.path,
          ));
    }

    // 2. memory.max
    final io.File maxFile = io.File('$dirPath/memory.max');
    if (maxFile.existsSync()) {
      final String content = maxFile.readAsStringSync().trim();
      if (content != 'max') {
        maxBytes =
            int.tryParse(content) ??
            (throw CgroupsParsingException(
              'memory.max inválido: "$content"',
              rawContent: content,
              cgroupPath: maxFile.path,
            ));
      }
    }

    // 3. memory.events
    final io.File eventsFile = io.File('$dirPath/memory.events');
    if (eventsFile.existsSync()) {
      final List<String> lines = eventsFile.readAsLinesSync();
      for (final String line in lines) {
        final List<String> parts = line.split(RegExp(r'\s+'));
        if (parts.length >= 2) {
          final String key = parts[0].trim();
          final int val = int.tryParse(parts[1].trim()) ?? 0;
          if (key == 'oom_kill') oomKill = val;
          if (key == 'oom') oom = val;
        }
      }
    }

    return CgroupsV2MemoryMetrics(
      currentBytes: currentBytes,
      maxBytes: maxBytes,
      oomKillCount: oomKill,
      oomCount: oom,
    );
  }

  CgroupsV2IoMetrics _readIoMetrics(String dirPath) {
    int rBytes = 0;
    int wBytes = 0;
    int rIops = 0;
    int wIops = 0;
    String? limits;

    final io.File statFile = io.File('$dirPath/io.stat');
    if (statFile.existsSync()) {
      final List<String> lines = statFile.readAsLinesSync();
      for (final String line in lines) {
        final List<String> tokens = line.split(RegExp(r'\s+'));
        for (final String token in tokens) {
          if (token.startsWith('rbytes=')) {
            rBytes += int.tryParse(token.substring(7)) ?? 0;
          } else if (token.startsWith('wbytes=')) {
            wBytes += int.tryParse(token.substring(7)) ?? 0;
          } else if (token.startsWith('rios=')) {
            rIops += int.tryParse(token.substring(5)) ?? 0;
          } else if (token.startsWith('wios=')) {
            wIops += int.tryParse(token.substring(5)) ?? 0;
          }
        }
      }
    }

    final io.File maxFile = io.File('$dirPath/io.max');
    if (maxFile.existsSync()) {
      limits = maxFile.readAsStringSync().trim();
    }

    return CgroupsV2IoMetrics(
      readBytes: rBytes,
      writeBytes: wBytes,
      readIops: rIops,
      writeIops: wIops,
      rawLimits: limits,
    );
  }

  List<int> _readPids(String dirPath) {
    final io.File procsFile = io.File('$dirPath/cgroup.procs');
    if (!procsFile.existsSync()) return <int>[];
    final List<int> pids = <int>[];
    for (final String line in procsFile.readAsLinesSync()) {
      final int? pid = int.tryParse(line.trim());
      if (pid != null && pid > 0) {
        pids.add(pid);
      }
    }
    return pids;
  }
}
