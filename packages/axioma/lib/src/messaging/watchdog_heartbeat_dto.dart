// 🎯 Cerbero Heartbeat DTO — Pure Dart (§39, §45, §47)
// Contrato canónico de supervisión por silencio (Dead-Man's Switch) para la flota CONEXT.

/// Estados de salud operacional del nodo satélite.
enum NodeHealthStatus {
  healthy('HEALTHY'),
  degraded('DEGRADED'),
  draining('DRAINING'),
  stopping('STOPPING');

  final String value;
  const NodeHealthStatus(this.value);

  static NodeHealthStatus fromString(String raw) {
    final clean = raw.trim().toUpperCase();
    for (final s in NodeHealthStatus.values) {
      if (s.value == clean || s.name.toUpperCase() == clean) return s;
    }
    throw ArgumentError.value(
      raw,
      'raw',
      'Estado de salud desconocido: "$raw". Válidos: '
          '${NodeHealthStatus.values.map((e) => e.value).join(", ")}',
    );
  }
}

/// DTO Canónico emitido periódicamente por cada nodo satélite hacia el Daemon Guardián (Cerbero).
class CerberoHeartbeatDTO {
  static const String currentSchemaVersion = '1.0.0';

  final String schemaVersion;
  final String traceId;
  final String nodeId;
  final String role;
  final DateTime timestamp;
  final int sequenceNumber;
  final double cpuUsagePercent;
  final double memoryUsageMb;
  final int activeSessions;
  final NodeHealthStatus status;
  final Map<String, dynamic> metadata;

  const CerberoHeartbeatDTO._({
    required this.schemaVersion,
    required this.traceId,
    required this.nodeId,
    required this.role,
    required this.timestamp,
    required this.sequenceNumber,
    required this.cpuUsagePercent,
    required this.memoryUsageMb,
    required this.activeSessions,
    required this.status,
    required this.metadata,
  });

  /// Factory constructor con validación rigurosa de invariantes (§4, §6).
  factory CerberoHeartbeatDTO.validated({
    String schemaVersion = currentSchemaVersion,
    required String traceId,
    required String nodeId,
    required String role,
    DateTime? timestamp,
    required int sequenceNumber,
    required double cpuUsagePercent,
    required double memoryUsageMb,
    int activeSessions = 0,
    dynamic status = NodeHealthStatus.healthy,
    Map<String, dynamic>? metadata,
  }) {
    final cleanTraceId = traceId.trim();
    if (cleanTraceId.isEmpty) {
      throw ArgumentError.value(
        traceId,
        'traceId',
        'traceId es mandatorio por condición de trazabilidad del Consejo (§47).',
      );
    }

    final cleanNodeId = nodeId.trim();
    if (cleanNodeId.isEmpty) {
      throw ArgumentError.value(
        nodeId,
        'nodeId',
        'nodeId no puede estar vacío.',
      );
    }

    final cleanRole = role.trim();
    if (cleanRole.isEmpty) {
      throw ArgumentError.value(role, 'role', 'role no puede estar vacío.');
    }

    if (sequenceNumber < 0) {
      throw ArgumentError.value(
        sequenceNumber,
        'sequenceNumber',
        'sequenceNumber debe ser mayor o igual a cero.',
      );
    }

    if (cpuUsagePercent < 0.0 || cpuUsagePercent > 100.0) {
      throw ArgumentError.value(
        cpuUsagePercent,
        'cpuUsagePercent',
        'cpuUsagePercent debe estar entre 0.0 y 100.0.',
      );
    }

    if (memoryUsageMb < 0.0) {
      throw ArgumentError.value(
        memoryUsageMb,
        'memoryUsageMb',
        'memoryUsageMb no puede ser negativo.',
      );
    }

    if (activeSessions < 0) {
      throw ArgumentError.value(
        activeSessions,
        'activeSessions',
        'activeSessions no puede ser negativo.',
      );
    }

    final resolvedStatus = status is NodeHealthStatus
        ? status
        : NodeHealthStatus.fromString(status.toString());

    return CerberoHeartbeatDTO._(
      schemaVersion: schemaVersion.trim(),
      traceId: cleanTraceId,
      nodeId: cleanNodeId,
      role: cleanRole,
      timestamp: timestamp?.toUtc() ?? DateTime.now().toUtc(),
      sequenceNumber: sequenceNumber,
      cpuUsagePercent: cpuUsagePercent,
      memoryUsageMb: memoryUsageMb,
      activeSessions: activeSessions,
      status: resolvedStatus,
      metadata: Map<String, dynamic>.unmodifiable(
        metadata ?? const <String, dynamic>{},
      ),
    );
  }

  factory CerberoHeartbeatDTO.fromJson(Map<String, dynamic> json) {
    return CerberoHeartbeatDTO.validated(
      schemaVersion: json['schema_version'] as String? ?? currentSchemaVersion,
      traceId: json['trace_id'] as String? ?? '',
      nodeId: json['node_id'] as String? ?? '',
      role: json['role'] as String? ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'] as String)
          : null,
      sequenceNumber: (json['sequence_number'] as num?)?.toInt() ?? 0,
      cpuUsagePercent: (json['cpu_usage_percent'] as num?)?.toDouble() ?? 0.0,
      memoryUsageMb: (json['memory_usage_mb'] as num?)?.toDouble() ?? 0.0,
      activeSessions: (json['active_sessions'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? 'HEALTHY',
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'schema_version': schemaVersion,
    'trace_id': traceId,
    'node_id': nodeId,
    'role': role,
    'timestamp': timestamp.toIso8601String(),
    'sequence_number': sequenceNumber,
    'cpu_usage_percent': cpuUsagePercent,
    'memory_usage_mb': memoryUsageMb,
    'active_sessions': activeSessions,
    'status': status.value,
    'metadata': metadata,
  };

  /// Determina si este latido ha expirado respecto a la ventana de tolerancia.
  bool isExpired({required Duration tolerance, DateTime? now}) {
    final current = now?.toUtc() ?? DateTime.now().toUtc();
    return current.difference(timestamp).abs() > tolerance;
  }

  /// Certifica si el proceso está en riesgo de bucle infinito (CPU > 90%).
  bool get isHighCpuWarning => cpuUsagePercent >= 90.0;
}

/// Alias retrocompatible para transición fluida de la flota.
typedef WatchdogHeartbeatDTO = CerberoHeartbeatDTO;
