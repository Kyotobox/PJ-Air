// 🎯 Synapse Task Dispatcher — Coordinador de Despacho y Soberanía Inter-Nodo (§4, §6, §39, §45, §60.5, §60.8)
import 'dart:convert';
import '../contracts/context_passport.dart';
import '../contracts/synapse_bridge.dart';
import '../dtos/synapse_task_payload.dart';
import '../protocol/cross_node_exceptions.dart';
import '../protocol/uds_connector_transport.dart';
import 'queue_bridge.dart';

/// Coordinador de despacho de tareas Synapse con soporte dual y separación estricta de planos:
/// 1. Plano de Control (UDS): Latidos, tokens y comandos livianos que requieren confirmación inmediata.
/// 2. Plano de Datos (SQLite WAL): Inferencias y procesamiento pesado con durabilidad offline (§45).
class SynapseTaskDispatcher {
  final SynapseQueueBridge? queueBridge;
  final UdsConnectorTransport? directTransport;
  final bool fallbackToQueue;
  final bool strictControlPlane;

  const SynapseTaskDispatcher({
    this.queueBridge,
    this.directTransport,
    this.fallbackToQueue = true,
    this.strictControlPlane = false,
  });

  /// Despacha una tarea Synapse garantizando la validación soberana del [ContextPassport].
  ///
  /// Sad Paths:
  /// - Lanza [NodeSovereigntyException] si el pasaporte no es válido, está expirado o caller está vacío (§60.8).
  /// - Lanza [StateError] si no hay ni transporte directo ni queueBridge disponible.
  /// - Relanza [NodeUnreachableException] o [NodeTimeoutException] si falla la conexión directa y:
  ///   (a) fallbackToQueue es false, O
  ///   (b) la tarea pertenece a [SynapseExecutionPlane.controlPlane] y strictControlPlane es true (§6, §60.5).
  Future<SynapseExecutionResult> dispatch(
    SynapseTaskPayload task, {
    String sprintId = 'N165',
    Duration directTimeout = const Duration(seconds: 5),
    bool? overrideStrictControlPlane,
  }) async {
    // 1. Verificación previa de soberanía y validez temporal (§60.8)
    if (!task.passport.isValid()) {
      throw NodeSovereigntyException(
        'El ContextPassport "${task.passport.passportId}" no es válido o ha expirado (§60.8)',
        nodeId: task.passport.targetNode,
        reason: 'EXPIRED_PASSPORT',
        context: <String, dynamic>{
          'passport_id': task.passport.passportId,
          'target_skill': task.passport.targetSkill,
          'expires_at': task.passport.expiresAt.toIso8601String(),
        },
      );
    }

    if (task.passport.callerIdentity.trim().isEmpty) {
      throw NodeSovereigntyException(
        'callerIdentity no puede estar vacío en el ContextPassport (§60.8)',
        nodeId: task.passport.targetNode,
        reason: 'EMPTY_CALLER_IDENTITY',
      );
    }

    final bool enforceStrictControl =
        overrideStrictControlPlane ?? strictControlPlane;

    // 2. Intento de despacho directo si el transporte está configurado
    if (directTransport != null) {
      try {
        final String rawResponse = await directTransport!.sendRequest(
          targetNode: task.passport.targetNode,
          payload: jsonEncode(task.toJson()),
          timeout: directTimeout,
        );

        final Map<String, dynamic> decoded =
            jsonDecode(rawResponse) as Map<String, dynamic>;
        return SynapseExecutionResult.fromJson(decoded);
      } on NodeUnreachableException {
        // En Plano de Control estricto, no se admite fallback asíncrono (§60.5)
        if (task.executionPlane == SynapseExecutionPlane.controlPlane &&
            enforceStrictControl) {
          rethrow;
        }
        if (!fallbackToQueue || queueBridge == null) {
          rethrow;
        }
        return _enqueueDeferred(
          task,
          sprintId,
          'Direct transport unreachable, retained in inference_queue.db (§45)',
        );
      } on NodeTimeoutException {
        if (task.executionPlane == SynapseExecutionPlane.controlPlane &&
            enforceStrictControl) {
          rethrow;
        }
        if (!fallbackToQueue || queueBridge == null) {
          rethrow;
        }
        return _enqueueDeferred(
          task,
          sprintId,
          'Direct transport timeout, retained in inference_queue.db (§45)',
        );
      }
    }

    // 3. Despacho diferido nativo a cola SQLite WAL (§45)
    if (queueBridge != null) {
      if (task.executionPlane == SynapseExecutionPlane.controlPlane &&
          enforceStrictControl) {
        throw NodeUnreachableException(
          'No se puede despachar tarea de Plano de Control a cola diferida con strictControlPlane activo.',
          nodeId: task.passport.targetNode,
        );
      }
      return _enqueueDeferred(
        task,
        sprintId,
        'Enqueued directly to inference_queue.db (offline-first mode §45)',
      );
    }

    throw StateError(
      'No hay transporte directo ni cola disponible para despachar la tarea ${task.taskId}.',
    );
  }

  SynapseExecutionResult _enqueueDeferred(
    SynapseTaskPayload task,
    String sprintId,
    String reason,
  ) {
    final String ticketId = queueBridge!.enqueueTask(
      task: task,
      sprintId: sprintId,
    );

    return SynapseExecutionResult(
      taskId: task.taskId,
      success: true,
      statusCode: 202, // 202 Accepted (offline-first retention)
      output: <String, dynamic>{
        'status': 'QUEUED_OFFLINE',
        'ticket_id': ticketId,
        'reason': reason,
        'target_node': task.passport.targetNode,
        'target_skill': task.passport.targetSkill,
        'execution_plane': task.executionPlane.value,
      },
      executionDurationMs: 0,
    );
  }
}
