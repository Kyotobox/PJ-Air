// 🎯 Synapse Bridge Contracts — Interfaces Canónicas de Transporte y Salud Synapse (§39, §60.8)
import '../dtos/synapse_task_payload.dart';

/// Resultado estructurado e inmutable de la ejecución de una tarea Synapse.
class SynapseExecutionResult {
  final String taskId;
  final bool success;
  final int statusCode;
  final Map<String, dynamic> output;
  final String? errorMessage;
  final int executionDurationMs;
  final DateTime completedAt;

  SynapseExecutionResult({
    required this.taskId,
    required this.success,
    required this.statusCode,
    required this.output,
    this.errorMessage,
    required this.executionDurationMs,
    DateTime? completedAt,
  }) : completedAt = (completedAt ?? DateTime.now()).toUtc() {
    if (taskId.trim().isEmpty) {
      throw const FormatException('taskId no puede estar vacío');
    }
    if (executionDurationMs < 0) {
      throw const FormatException('executionDurationMs no puede ser negativo');
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'task_id': taskId,
    'success': success,
    'status_code': statusCode,
    'output': output,
    'error_message': errorMessage,
    'execution_duration_ms': executionDurationMs,
    'completed_at': completedAt.toIso8601String(),
  };

  factory SynapseExecutionResult.fromJson(Map<String, dynamic> json) {
    final dynamic tId = json['task_id'];
    final dynamic succ = json['success'];
    final dynamic code = json['status_code'];
    final dynamic dur = json['execution_duration_ms'];

    if (tId is! String || tId.trim().isEmpty) {
      throw const FormatException('task_id inválido o ausente');
    }
    if (succ is! bool) {
      throw const FormatException('success inválido o ausente');
    }
    if (code is! int) {
      throw const FormatException('status_code inválido o ausente');
    }
    if (dur is! int || dur < 0) {
      throw const FormatException('execution_duration_ms inválido');
    }

    final DateTime? completedAt = json['completed_at'] is String
        ? DateTime.tryParse(json['completed_at'] as String)?.toUtc()
        : null;

    return SynapseExecutionResult(
      taskId: tId,
      success: succ,
      statusCode: code,
      output: (json['output'] as Map<String, dynamic>?) ?? <String, dynamic>{},
      errorMessage: json['error_message'] as String?,
      executionDurationMs: dur,
      completedAt: completedAt,
    );
  }
}

/// Estado de conectividad y salud de un nodo en el ecosistema Synapse.
class SynapseHealthStatus {
  final String nodeId;
  final bool isReachable;
  final int latencyMs;
  final List<String> activeSkills;
  final DateTime timestamp;

  SynapseHealthStatus({
    required this.nodeId,
    required this.isReachable,
    required this.latencyMs,
    this.activeSkills = const <String>[],
    DateTime? timestamp,
  }) : timestamp = (timestamp ?? DateTime.now()).toUtc() {
    if (nodeId.trim().isEmpty) {
      throw const FormatException('nodeId no puede estar vacío');
    }
    if (latencyMs < 0) {
      throw const FormatException('latencyMs no puede ser negativo');
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'node_id': nodeId,
    'is_reachable': isReachable,
    'latency_ms': latencyMs,
    'active_skills': activeSkills,
    'timestamp': timestamp.toIso8601String(),
  };

  factory SynapseHealthStatus.fromJson(Map<String, dynamic> json) {
    final dynamic nId = json['node_id'];
    final dynamic reach = json['is_reachable'];
    final dynamic lat = json['latency_ms'];

    if (nId is! String || nId.trim().isEmpty) {
      throw const FormatException('node_id inválido o ausente');
    }
    if (reach is! bool) {
      throw const FormatException('is_reachable inválido o ausente');
    }
    if (lat is! int || lat < 0) {
      throw const FormatException('latency_ms inválido');
    }

    final List<dynamic>? rawSkills = json['active_skills'] as List<dynamic>?;
    final List<String> skills = rawSkills != null
        ? rawSkills.map((dynamic e) => e.toString()).toList()
        : <String>[];

    final DateTime? timestamp = json['timestamp'] is String
        ? DateTime.tryParse(json['timestamp'] as String)?.toUtc()
        : null;

    return SynapseHealthStatus(
      nodeId: nId,
      isReachable: reach,
      latencyMs: lat,
      activeSkills: skills,
      timestamp: timestamp,
    );
  }
}

/// Contrato abstracto para el puente de despacho y ejecución Synapse.
abstract class FleetSynapseBridge {
  /// Despacha una tarea Synapse hacia el skill y nodo especificados en el pasaporte.
  Future<SynapseExecutionResult> dispatch(SynapseTaskPayload payload);

  /// Sondea el estado de salud y latencia del nodo destino.
  Future<SynapseHealthStatus> checkHealth(String targetNode);
}
