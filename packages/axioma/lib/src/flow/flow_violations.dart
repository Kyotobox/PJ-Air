// 🎯 Jerarquía Sellada de Violaciones de Flujo FSM — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios,
// §12.b Límite 5 archivos, §40 Thin Client, §48 Cierre Autárquico, Calm Error UX.

/// Jerarquía sellada de violaciones operativas y de transición en motores de flujo FSM (§39).
sealed class FlowViolation implements Exception {
  final String message;
  const FlowViolation(this.message);

  @override
  String toString() => '$runtimeType: $message';
}

/// Violación disparada ante un intento de transición no permitida o desconocida en la FSM (§6 Sad Path).
final class UnknownTransitionViolation extends FlowViolation {
  final String fromStep;
  final String attemptedStep;
  final String? eventName;

  const UnknownTransitionViolation({
    required this.fromStep,
    required this.attemptedStep,
    this.eventName,
    String? message,
  }) : super(
         message ??
             'Transición ilegal no registrada desde el paso "$fromStep" hacia "$attemptedStep"'
                 '${eventName != null ? ' mediante el evento "$eventName"' : ''}.',
       );
}

/// Violación disparada cuando un flujo supera el límite de transiciones o presupuesto de turnos sin progreso (§6 Sad Path).
class FlowBudgetExceeded extends FlowViolation {
  final int currentTransitions;
  final int maxTransitions;
  final String reason;

  const FlowBudgetExceeded({
    required this.currentTransitions,
    required this.maxTransitions,
    this.reason =
        'Bucle sin progreso o límite de transiciones excedido en el motor FSM.',
    String? message,
  }) : super(
         message ??
             'Presupuesto de flujo excedido ($currentTransitions/$maxTransitions): $reason',
       );
}

/// Violación disparada cuando se intenta asignar o validar un slot con restricciones no satisfechas (§6 Sad Path).
final class InvalidSlotViolation extends FlowViolation {
  final String slotName;
  final Object? invalidValue;
  final String reason;

  const InvalidSlotViolation({
    required this.slotName,
    required this.invalidValue,
    this.reason =
        'El valor provisto para el slot no satisface las restricciones semánticas o de tipo.',
    String? message,
  }) : super(
         message ??
             'Slot inválido "$slotName" con valor ($invalidValue): $reason',
       );
}

/// Subtipo canónico para cuando el presupuesto de turnos conversacionales ha sido rebasado sin resolución.
final class TurnBudgetExceeded extends FlowBudgetExceeded {
  final int currentTurn;
  final int maxTurns;

  const TurnBudgetExceeded({
    required this.currentTurn,
    required this.maxTurns,
    super.reason =
        'Presupuesto de turnos conversacionales agotado sin resolución.',
    String? message,
  }) : super(
         currentTransitions: currentTurn,
         maxTransitions: maxTurns,
         message:
             message ??
             'TurnBudgetExceeded ($currentTurn/$maxTurns turnos consumidos): $reason',
       );
}
