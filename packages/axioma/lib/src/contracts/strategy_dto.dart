// 🎯 Strategy DTO Contract — Contrato Canónico de Orquestación Estratégica (§39, §60.2)
import 'satellite_payload.dart';

/// DTO de orquestación estratégica emitido por Smart hacia workers y satélites.
class StrategyDTO {
  final String sprintId;
  final String priority; // CRITICAL, HIGH, MEDIUM, LOW
  final String objective;
  final List<SatellitePayload> satelliteJobs;
  final Map<String, dynamic> metadata;
  final DateTime createdAt;

  StrategyDTO({
    required this.sprintId,
    required this.priority,
    required this.objective,
    required this.satelliteJobs,
    required this.metadata,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now().toUtc() {
    if (sprintId.trim().isEmpty) {
      throw FormatException('sprintId no puede ser vacío');
    }
    if (objective.trim().isEmpty) {
      throw FormatException('objective no puede ser vacío');
    }
    final String pUpper = priority.toUpperCase();
    if (!const <String>{'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'}.contains(pUpper)) {
      throw FormatException('Prioridad desconocida: $priority');
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'sprint_id': sprintId,
    'priority': priority.toUpperCase(),
    'objective': objective,
    'satellite_jobs': satelliteJobs.map((e) => e.toJson()).toList(),
    'metadata': metadata,
    'created_at': createdAt.toIso8601String(),
  };

  factory StrategyDTO.fromJson(Map<String, dynamic> json) {
    final dynamic sId = json['sprint_id'];
    final dynamic prio = json['priority'];
    final dynamic obj = json['objective'];

    if (sId is! String || sId.trim().isEmpty) {
      throw FormatException('sprint_id inválido o ausente');
    }
    if (prio is! String || prio.trim().isEmpty) {
      throw FormatException('priority inválido o ausente');
    }
    if (obj is! String || obj.trim().isEmpty) {
      throw FormatException('objective inválido o ausente');
    }

    final List<dynamic>? rawJobs = json['satellite_jobs'] as List<dynamic>?;
    final List<SatellitePayload> jobs = rawJobs != null
        ? rawJobs
              .map((e) => SatellitePayload.fromJson(e as Map<String, dynamic>))
              .toList()
        : <SatellitePayload>[];

    return StrategyDTO(
      sprintId: sId,
      priority: prio,
      objective: obj,
      satelliteJobs: jobs,
      metadata:
          (json['metadata'] as Map<String, dynamic>?) ?? <String, dynamic>{},
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now().toUtc(),
    );
  }
}
