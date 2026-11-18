// 🎯 Estados y Eventos Inmutables de Flujo FSM — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios,
// §12.b Límite 5 archivos, §40 Thin Client, §48 Cierre Autárquico, Calm Error UX.

import '../messaging/intent_signature.dart';

/// Modalidad bimodal de salida socrática y asertiva ante TurnBudgetExceeded o agotamiento de flujo (§40).
enum GentleExitMode {
  /// Defaulting Asertivo: El sistema asume una opción por defecto razonable o guía socráticamente con opciones concretas.
  assertiveDefault('assertive_default'),

  /// Handoff Especializado: El sistema escala la interacción a un especialista o agente avanzado sin emitir errores técnicos.
  specializedHandoff('specialized_handoff');

  final String value;
  const GentleExitMode(this.value);

  static GentleExitMode fromString(String raw) {
    final String clean = raw.trim().toLowerCase();
    for (final GentleExitMode m in GentleExitMode.values) {
      if (m.value == clean || m.name.toLowerCase() == clean) return m;
    }
    throw ArgumentError.value(
      raw,
      'raw',
      'Modo de salida amable desconocido: "$raw". Válidos: ${GentleExitMode.values.map((GentleExitMode e) => e.value).join(", ")}',
    );
  }
}

/// Resultado estructurado de una salida amable socrática asertiva (Calm Error UX / Zero Technical Exposure).
class GentleExitResult {
  final GentleExitMode mode;
  final String userMessage;
  final String reason;
  final Map<String, dynamic> metadata;

  const GentleExitResult({
    required this.mode,
    required this.userMessage,
    required this.reason,
    this.metadata = const <String, dynamic>{},
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'mode': mode.value,
    'user_message': userMessage,
    'reason': reason,
    'metadata': metadata,
  };

  @override
  String toString() =>
      'GentleExitResult(mode: ${mode.value}, userMessage: "$userMessage", reason: "$reason")';
}

/// Jerarquía sellada de eventos procesables por el motor FSM puro (§39).
sealed class FlowEvent {
  final String name;
  final Map<String, dynamic> payload;

  const FlowEvent({
    required this.name,
    this.payload = const <String, dynamic>{},
  });
}

/// Evento disparado por la resolución de una intención canónica [IntentSignature].
final class FlowIntentEvent extends FlowEvent {
  final IntentSignature intent;

  FlowIntentEvent({
    required this.intent,
    super.payload = const <String, dynamic>{},
  }) : super(name: 'intent:${intent.canonicalKey}');
}

/// Evento de actualización o asignación de un slot conversacional.
final class FlowSlotUpdateEvent extends FlowEvent {
  final String slotName;
  final Object? value;

  FlowSlotUpdateEvent({
    required this.slotName,
    required this.value,
    super.payload = const <String, dynamic>{},
  }) : super(name: 'update_slot:$slotName');
}

/// Evento explícito de transición hacia un paso objetivo de la FSM.
final class FlowStepTransitionEvent extends FlowEvent {
  final String targetStep;

  FlowStepTransitionEvent({
    required this.targetStep,
    super.payload = const <String, dynamic>{},
  }) : super(name: 'transition_to:$targetStep');
}

/// Evento de agotamiento de presupuesto de turnos conversacionales con modo de salida sugerido.
final class FlowTurnBudgetExceededEvent extends FlowEvent {
  final GentleExitMode preferredMode;
  final String? customMessage;
  final String reason;

  FlowTurnBudgetExceededEvent({
    this.preferredMode = GentleExitMode.assertiveDefault,
    this.customMessage,
    this.reason = 'Presupuesto de turnos conversacionales alcanzado.',
    super.payload = const <String, dynamic>{},
  }) : super(name: 'turn_budget_exceeded');
}

/// Evento genérico o de integración personalizada para flujos de dominio.
final class FlowCustomEvent extends FlowEvent {
  const FlowCustomEvent({
    required super.name,
    super.payload = const <String, dynamic>{},
  });
}

/// Estado inmutable de la máquina de estados finita FSM Pure Dart (§39).
class FlowState {
  final String currentStep;
  final Map<String, dynamic> slots;
  final int turnCount;
  final int transitionCount;
  final bool isCompleted;
  final GentleExitResult? gentleExit;
  final List<String> stepHistory;
  final Map<String, dynamic> metadata;

  const FlowState({
    required this.currentStep,
    this.slots = const <String, dynamic>{},
    this.turnCount = 0,
    this.transitionCount = 0,
    this.isCompleted = false,
    this.gentleExit,
    this.stepHistory = const <String>[],
    this.metadata = const <String, dynamic>{},
  });

  /// Crea un nuevo estado inicial para un flujo conversacional o de proceso.
  factory FlowState.initial({
    String initialStep = 'initial',
    Map<String, dynamic> initialSlots = const <String, dynamic>{},
    Map<String, dynamic> metadata = const <String, dynamic>{},
  }) {
    if (initialStep.trim().isEmpty) {
      throw ArgumentError.value(
        initialStep,
        'initialStep',
        'El paso inicial de FlowState no puede ser vacío.',
      );
    }
    return FlowState(
      currentStep: initialStep.trim(),
      slots: Map<String, dynamic>.unmodifiable(initialSlots),
      stepHistory: List<String>.unmodifiable(<String>[initialStep.trim()]),
      metadata: Map<String, dynamic>.unmodifiable(metadata),
    );
  }

  /// Retorna una copia con propiedades modificadas asegurando inmutabilidad.
  FlowState copyWith({
    String? currentStep,
    Map<String, dynamic>? slots,
    int? turnCount,
    int? transitionCount,
    bool? isCompleted,
    GentleExitResult? gentleExit,
    bool clearGentleExit = false,
    List<String>? stepHistory,
    Map<String, dynamic>? metadata,
  }) {
    return FlowState(
      currentStep: currentStep ?? this.currentStep,
      slots: slots != null
          ? Map<String, dynamic>.unmodifiable(slots)
          : this.slots,
      turnCount: turnCount ?? this.turnCount,
      transitionCount: transitionCount ?? this.transitionCount,
      isCompleted: isCompleted ?? this.isCompleted,
      gentleExit: clearGentleExit ? null : (gentleExit ?? this.gentleExit),
      stepHistory: stepHistory != null
          ? List<String>.unmodifiable(stepHistory)
          : this.stepHistory,
      metadata: metadata != null
          ? Map<String, dynamic>.unmodifiable(metadata)
          : this.metadata,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'current_step': currentStep,
    'slots': slots,
    'turn_count': turnCount,
    'transition_count': transitionCount,
    'is_completed': isCompleted,
    'gentle_exit': gentleExit?.toJson(),
    'step_history': stepHistory,
    'metadata': metadata,
  };

  @override
  String toString() =>
      'FlowState(step: $currentStep, turns: $turnCount, transitions: $transitionCount, isCompleted: $isCompleted, slots: ${slots.keys.toList()})';
}
