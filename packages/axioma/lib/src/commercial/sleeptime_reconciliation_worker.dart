// sleeptime_reconciliation_worker.dart — Contratos Pure Dart de Coalescencia y Reconciliación (§39, §45, §60.2, §60.6)
library;

import 'client_dna_models.dart';
import 'client_slot_types.dart';

/// Acción resultante de la reconciliación determinista.
enum ReconciliationAction {
  add('ADD'),
  update('UPDATE'),
  invalidate('INVALIDATE'),
  noop('NOOP');

  final String wireName;

  const ReconciliationAction(this.wireName);
}

/// Registro individual de una operación de reconciliación.
class ReconciliationOperation {
  final ReconciliationAction action;
  final ClientSlotType slotType;
  final dynamic oldValue;
  final dynamic newValue;
  final EpistemicStatus epistemicStatus;
  final double confidence;
  final String sourceCitation;
  final String? reason;

  const ReconciliationOperation({
    required this.action,
    required this.slotType,
    this.oldValue,
    this.newValue,
    required this.epistemicStatus,
    required this.confidence,
    required this.sourceCitation,
    this.reason,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'action': action.wireName,
    'slot_type': slotType.wireName,
    'old_value': oldValue,
    'new_value': newValue,
    'epistemic_status': epistemicStatus.wireName,
    'confidence': confidence,
    'source_citation': sourceCitation,
    'reason': reason,
  };
}

/// Resultado consolidado de un ciclo de reconciliación determinista.
class ReconciliationResult {
  final String clientId;
  final int totalProcessed;
  final int added;
  final int updated;
  final int invalidated;
  final int noops;
  final List<ReconciliationOperation> operations;
  final DateTime executedAt;

  const ReconciliationResult({
    required this.clientId,
    required this.totalProcessed,
    required this.added,
    required this.updated,
    required this.invalidated,
    required this.noops,
    required this.operations,
    required this.executedAt,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'client_id': clientId,
    'total_processed': totalProcessed,
    'added': added,
    'updated': updated,
    'invalidated': invalidated,
    'noops': noops,
    'operations': operations
        .map((ReconciliationOperation op) => op.toJson())
        .toList(),
    'executed_at': executedAt.toIso8601String(),
  };
}

/// Mensaje encolado para coalescencia asíncrona.
class CoalescenceMessage {
  final String id;
  final String clientId;
  final String channel;
  final String content;
  final DateTime timestamp;

  CoalescenceMessage({
    required this.id,
    required this.clientId,
    required this.channel,
    required this.content,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now().toUtc() {
    if (id.trim().isEmpty) {
      throw ArgumentError.value(
        id,
        'id',
        'El ID del mensaje no puede estar vacío.',
      );
    }
    if (clientId.trim().isEmpty) {
      throw ArgumentError.value(
        clientId,
        'clientId',
        'El clientId no puede estar vacío.',
      );
    }
    if (content.trim().isEmpty) {
      throw ArgumentError.value(
        content,
        'content',
        'El contenido no puede estar vacío.',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'client_id': clientId,
    'channel': channel,
    'content': content,
    'timestamp': timestamp.toIso8601String(),
  };
}

/// Motor determinista de reconciliación sin dependencias de I/O o red (§39, §60.2).
class DeterministicReconciliationEngine {
  const DeterministicReconciliationEngine();

  /// Evalúa una lista de hechos existentes contra una propuesta de hecho y decide la acción.
  ReconciliationOperation reconcileFact({
    required List<ClientFact> existingFacts,
    required ClientSlotType slotType,
    required dynamic proposedValue,
    required String sourceCitation,
    double confidence = 1.0,
    EpistemicStatus epistemicStatus = EpistemicStatus.confirmed,
  }) {
    if (sourceCitation.trim().isEmpty) {
      throw ArgumentError.value(
        sourceCitation,
        'sourceCitation',
        'La cita de fuente es obligatoria para la reconciliación (§47).',
      );
    }

    final List<ClientFact> matching = existingFacts
        .where((ClientFact f) => f.slotType == slotType && !f.isInvalidated)
        .toList();

    if (matching.isEmpty) {
      return ReconciliationOperation(
        action: ReconciliationAction.add,
        slotType: slotType,
        newValue: proposedValue,
        epistemicStatus: epistemicStatus,
        confidence: confidence,
        sourceCitation: sourceCitation,
        reason: 'Nuevo hecho registrado para slot vacío.',
      );
    }

    final ClientFact current = matching.last;
    if (current.value == proposedValue) {
      return ReconciliationOperation(
        action: ReconciliationAction.noop,
        slotType: slotType,
        oldValue: current.value,
        newValue: proposedValue,
        epistemicStatus: current.epistemicStatus,
        confidence: current.confidence,
        sourceCitation: sourceCitation,
        reason: 'Valor idéntico al actual, sin mutación.',
      );
    }

    // Si el valor difiere, es un UPDATE
    return ReconciliationOperation(
      action: ReconciliationAction.update,
      slotType: slotType,
      oldValue: current.value,
      newValue: proposedValue,
      epistemicStatus: epistemicStatus,
      confidence: confidence,
      sourceCitation: sourceCitation,
      reason: 'Valor actualizado por nueva evidencia observable.',
    );
  }
}
