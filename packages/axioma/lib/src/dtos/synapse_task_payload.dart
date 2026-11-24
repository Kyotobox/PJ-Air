// 🎯 SynapseTaskPayload DTO — Carga Inmutable de Tareas Synapse (§39, §60.5, §60.8)
import '../contracts/context_passport.dart';

/// Plano arquitectónico de ejecución para tareas Synapse (§39, §60.5).
enum SynapseExecutionPlane {
  /// Plano de Control: Baja latencia, heartbeats, tokens, sincronización y comandos de nodo.
  controlPlane('CONTROL_PLANE'),

  /// Plano de Datos: Durabilidad, inferencias pesadas, rendering y jobs asíncronos en cola WAL.
  dataPlane('DATA_PLANE');

  final String value;
  const SynapseExecutionPlane(this.value);

  static SynapseExecutionPlane fromString(String? val) {
    if (val == null) return SynapseExecutionPlane.dataPlane;
    return SynapseExecutionPlane.values.firstWhere(
      (SynapseExecutionPlane e) =>
          e.value.toLowerCase() == val.trim().toLowerCase() ||
          e.name.toLowerCase() == val.trim().toLowerCase(),
      orElse: () => SynapseExecutionPlane.dataPlane,
    );
  }
}

/// DTO inmutable para transporte y despacho de tareas hacia Skills a través de Synapse.
class SynapseTaskPayload {
  final String taskId;
  final ContextPassport passport;
  final String action;
  final Map<String, dynamic> parameters;
  final DateTime createdAt;
  final int schemaVersion;
  final SynapseExecutionPlane executionPlane;

  SynapseTaskPayload({
    required this.taskId,
    required this.passport,
    required this.action,
    required this.parameters,
    DateTime? createdAt,
    this.schemaVersion = 1,
    this.executionPlane = SynapseExecutionPlane.dataPlane,
  }) : createdAt = (createdAt ?? DateTime.now()).toUtc() {
    if (taskId.trim().isEmpty) {
      throw const FormatException('taskId no puede estar vacío');
    }
    if (action.trim().isEmpty) {
      throw const FormatException('action no puede estar vacío');
    }
    if (schemaVersion <= 0) {
      throw const FormatException('schemaVersion debe ser positivo (> 0)');
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'task_id': taskId,
    'passport': passport.toJson(),
    'action': action,
    'parameters': parameters,
    'created_at': createdAt.toIso8601String(),
    'schema_version': schemaVersion,
    'execution_plane': executionPlane.value,
  };

  factory SynapseTaskPayload.fromJson(Map<String, dynamic> json) {
    final dynamic tId = json['task_id'];
    final dynamic passRaw = json['passport'];
    final dynamic act = json['action'];
    final dynamic sVer = json['schema_version'];

    if (tId is! String || tId.trim().isEmpty) {
      throw const FormatException('task_id inválido o ausente');
    }
    if (passRaw is! Map<String, dynamic>) {
      throw const FormatException('passport inválido o ausente');
    }
    if (act is! String || act.trim().isEmpty) {
      throw const FormatException('action inválido o ausente');
    }
    if (sVer != null && (sVer is! int || sVer <= 0)) {
      throw const FormatException('schema_version inválido');
    }

    final ContextPassport passport = ContextPassport.fromJson(passRaw);

    final DateTime? createdAt = json['created_at'] is String
        ? DateTime.tryParse(json['created_at'] as String)?.toUtc()
        : null;

    final SynapseExecutionPlane plane = SynapseExecutionPlane.fromString(
      json['execution_plane'] as String?,
    );

    return SynapseTaskPayload(
      taskId: tId,
      passport: passport,
      action: act,
      parameters:
          (json['parameters'] as Map<String, dynamic>?) ?? <String, dynamic>{},
      createdAt: createdAt,
      schemaVersion: (sVer as int?) ?? 1,
      executionPlane: plane,
    );
  }
}
