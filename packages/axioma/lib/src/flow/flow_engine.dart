// 🎯 Motor FSM Puro con Salida Socrática Asertiva — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios,
// §12.b Límite 5 archivos, §40 Thin Client, §48 Cierre Autárquico, Calm Error UX.

import 'flow_state.dart';
import 'flow_violations.dart';

export 'flow_state.dart';
export 'flow_violations.dart';

/// Motor de Máquina de Estados Finita (FSM) Pure Dart determinista sin I/O (§39).
///
/// Implementa la función pura [reduce] que transforma [FlowState] ante [FlowEvent],
/// aplicando control estricto anti-ciclos ([maxTransitions]), validación de slots
/// y política bimodal de salida amable ante [TurnBudgetExceeded] (Defaulting Asertivo
/// o Handoff Especializado) garantizando cero exposición de errores técnicos al cliente.
class FlowEngine {
  /// Límite máximo de transiciones internas para prevenir bucles infinitos o sin progreso.
  final int maxTransitions;

  /// Presupuesto máximo de turnos conversacionales antes de activar salida amable o violación.
  final int maxTurns;

  /// Modo por defecto de salida amable ante agotamiento de turnos.
  final GentleExitMode defaultGentleExitMode;

  /// Si es `true`, al superar [maxTurns] se transiciona amablemente sin arrojar excepción técnica.
  /// Si es `false`, arroja [TurnBudgetExceeded] (§6 Sad Path).
  final bool autoGentleExitOnTurnBudget;

  /// Mapa canónico de transiciones permitidas: `paso_origen -> {pasos_destino_válidos}`.
  final Map<String, Set<String>> allowedTransitions;

  /// Validadores de slots registrados por nombre: `slot_name -> validador(valor)`.
  final Map<String, bool Function(Object?)> slotValidators;

  /// Paso reservado para estados terminales de salida amable.
  final String gentleExitStep;

  /// Generadores de mensajes socráticos personalizados para salida amable.
  final Map<GentleExitMode, String Function(FlowState state, String reason)>?
  socraticMessageGenerators;

  const FlowEngine({
    this.maxTransitions = 20,
    this.maxTurns = 5,
    this.defaultGentleExitMode = GentleExitMode.assertiveDefault,
    this.autoGentleExitOnTurnBudget = true,
    this.allowedTransitions = const <String, Set<String>>{},
    this.slotValidators = const <String, bool Function(Object?)>{},
    this.gentleExitStep = 'gentle_exit',
    this.socraticMessageGenerators,
  }) : assert(maxTransitions > 0, 'maxTransitions debe ser mayor a 0.'),
       assert(maxTurns > 0, 'maxTurns debe ser mayor a 0.');

  /// Función pura reductora: `reduce(FlowState, FlowEvent) -> FlowState` sin efectos secundarios ni I/O.
  ///
  /// Transforma determinísticamente el estado del flujo evaluando invariantes de ciclo,
  /// transiciones legales, contratos de slots y presupuesto de turnos.
  FlowState reduce(FlowState state, FlowEvent event) {
    // 1. Detección de bucle o presupuesto de transiciones agotado (Anti-Loop Guard).
    if (state.transitionCount >= maxTransitions) {
      throw FlowBudgetExceeded(
        currentTransitions: state.transitionCount,
        maxTransitions: maxTransitions,
        reason:
            'Límite de transiciones anti-ciclo alcanzado ($maxTransitions) sin convergencia.',
      );
    }

    // 2. Procesamiento exhaustivo según tipo de evento sellado.
    return switch (event) {
      FlowSlotUpdateEvent e => _reduceSlotUpdate(state, e),
      FlowStepTransitionEvent e => _reduceStepTransition(state, e),
      FlowIntentEvent e => _reduceIntent(state, e),
      FlowTurnBudgetExceededEvent e => _reduceTurnBudgetExceeded(state, e),
      FlowCustomEvent e => _reduceCustom(state, e),
    };
  }

  /// Reduce la actualización de un slot verificando validadores semánticos.
  FlowState _reduceSlotUpdate(FlowState state, FlowSlotUpdateEvent event) {
    final String slot = event.slotName.trim();
    if (slot.isEmpty) {
      throw InvalidSlotViolation(
        slotName: event.slotName,
        invalidValue: event.value,
        reason: 'El nombre del slot no puede ser vacío.',
      );
    }

    // Validar con la regla semántica registrada si existe
    final bool Function(Object?)? validator = slotValidators[slot];
    if (validator != null && !validator(event.value)) {
      throw InvalidSlotViolation(
        slotName: slot,
        invalidValue: event.value,
        reason:
            'El valor provisto no satisface las restricciones semánticas del slot "$slot".',
      );
    }

    final Map<String, dynamic> updatedSlots = Map<String, dynamic>.from(
      state.slots,
    );
    if (event.value == null) {
      updatedSlots.remove(slot);
    } else {
      updatedSlots[slot] = event.value;
    }

    return state.copyWith(
      slots: updatedSlots,
      transitionCount: state.transitionCount + 1,
    );
  }

  /// Reduce una transición explícita de paso validando el grafo de estados.
  FlowState _reduceStepTransition(
    FlowState state,
    FlowStepTransitionEvent event,
  ) {
    final String target = event.targetStep.trim();
    _assertValidTransition(state.currentStep, target, event.name);

    final List<String> history = List<String>.from(state.stepHistory)
      ..add(target);

    return state.copyWith(
      currentStep: target,
      stepHistory: history,
      transitionCount: state.transitionCount + 1,
      isCompleted:
          target == gentleExitStep || event.payload['is_completed'] == true,
    );
  }

  /// Reduce la llegada de un evento de intención canónica [IntentSignature].
  FlowState _reduceIntent(FlowState state, FlowIntentEvent event) {
    final int nextTurns = state.turnCount + 1;

    // Verificar si se agota el presupuesto de turnos
    if (nextTurns > maxTurns) {
      if (!autoGentleExitOnTurnBudget) {
        throw TurnBudgetExceeded(
          currentTurn: nextTurns,
          maxTurns: maxTurns,
          reason:
              'Presupuesto de turnos conversacionales agotado con la intención "${event.intent.canonicalKey}".',
        );
      }

      return _applyGentleExit(
        state.copyWith(
          turnCount: nextTurns,
          transitionCount: state.transitionCount + 1,
        ),
        mode: defaultGentleExitMode,
        reason: 'Presupuesto de turnos agotado ($nextTurns/$maxTurns)',
      );
    }

    // Extraer destino si el payload lo especifica
    final String? requestedTarget = event.payload['target_step'] as String?;
    final String nextStep = requestedTarget?.trim() ?? state.currentStep;

    if (nextStep != state.currentStep) {
      _assertValidTransition(state.currentStep, nextStep, event.name);
    }

    // Actualizar slots si vienen en el payload
    final Map<String, dynamic> newSlots = Map<String, dynamic>.from(
      state.slots,
    );
    final Object? rawPayloadSlots = event.payload['slots'];
    if (rawPayloadSlots is Map<String, dynamic>) {
      for (final MapEntry<String, dynamic> entry in rawPayloadSlots.entries) {
        final bool Function(Object?)? val = slotValidators[entry.key];
        if (val != null && !val(entry.value)) {
          throw InvalidSlotViolation(
            slotName: entry.key,
            invalidValue: entry.value,
          );
        }
        newSlots[entry.key] = entry.value;
      }
    }

    final List<String> history = List<String>.from(state.stepHistory);
    if (nextStep != state.currentStep) {
      history.add(nextStep);
    }

    final Map<String, dynamic> meta = Map<String, dynamic>.from(state.metadata)
      ..['last_intent'] = event.intent.canonicalKey
      ..['last_intent_hash'] = event.intent.hash;

    return state.copyWith(
      currentStep: nextStep,
      slots: newSlots,
      turnCount: nextTurns,
      transitionCount: state.transitionCount + 1,
      stepHistory: history,
      metadata: meta,
    );
  }

  /// Reduce el evento explícito de presupuesto de turnos excedido activando la salida amable bimodal.
  FlowState _reduceTurnBudgetExceeded(
    FlowState state,
    FlowTurnBudgetExceededEvent event,
  ) {
    return _applyGentleExit(
      state.copyWith(transitionCount: state.transitionCount + 1),
      mode: event.preferredMode,
      reason: event.reason,
      customMessage: event.customMessage,
    );
  }

  /// Reduce eventos personalizados garantizando validación y preservación del grafo.
  FlowState _reduceCustom(FlowState state, FlowCustomEvent event) {
    final String? requestedTarget = event.payload['target_step'] as String?;
    final String nextStep = requestedTarget?.trim() ?? state.currentStep;

    if (nextStep != state.currentStep) {
      _assertValidTransition(state.currentStep, nextStep, event.name);
    }

    final List<String> history = List<String>.from(state.stepHistory);
    if (nextStep != state.currentStep) {
      history.add(nextStep);
    }

    return state.copyWith(
      currentStep: nextStep,
      stepHistory: history,
      transitionCount: state.transitionCount + 1,
      isCompleted:
          nextStep == gentleExitStep || event.payload['is_completed'] == true,
    );
  }

  /// Valida que la transición entre [fromStep] y [targetStep] esté registrada y sea legal.
  void _assertValidTransition(
    String fromStep,
    String targetStep,
    String eventName,
  ) {
    if (targetStep == gentleExitStep) {
      return; // La salida amable siempre es accesible como compuerta de seguridad
    }

    if (allowedTransitions.isNotEmpty) {
      final Set<String>? validTargets = allowedTransitions[fromStep];
      if (validTargets == null || !validTargets.contains(targetStep)) {
        throw UnknownTransitionViolation(
          fromStep: fromStep,
          attemptedStep: targetStep,
          eventName: eventName,
        );
      }
    }
  }

  /// Aplica la política bimodal de salida amable socrática asertiva.
  FlowState _applyGentleExit(
    FlowState state, {
    required GentleExitMode mode,
    required String reason,
    String? customMessage,
  }) {
    final String userMessage =
        customMessage ?? _resolveSocraticMessage(state, mode, reason);

    final GentleExitResult exitResult = GentleExitResult(
      mode: mode,
      userMessage: userMessage,
      reason: reason,
      metadata: <String, dynamic>{
        'turn_count': state.turnCount,
        'transition_count': state.transitionCount,
        'previous_step': state.currentStep,
      },
    );

    final List<String> history = List<String>.from(state.stepHistory)
      ..add(gentleExitStep);

    return state.copyWith(
      currentStep: gentleExitStep,
      isCompleted: true,
      gentleExit: exitResult,
      stepHistory: history,
    );
  }

  /// Resuelve el mensaje socrático sin errores técnicos acorde a la modalidad seleccionada.
  String _resolveSocraticMessage(
    FlowState state,
    GentleExitMode mode,
    String reason,
  ) {
    if (socraticMessageGenerators != null &&
        socraticMessageGenerators!.containsKey(mode)) {
      return socraticMessageGenerators![mode]!(state, reason);
    }

    return switch (mode) {
      GentleExitMode.assertiveDefault =>
        'Para asegurarnos de avanzar en lo que necesitas, te propongo revisar las opciones principales del catálogo o reiniciar tu consulta.',
      GentleExitMode.specializedHandoff =>
        'Para darte la atención detallada que requiere tu consulta, he transferido nuestra conversación a un especialista de nuestro equipo.',
    };
  }

  /// Dispara manualmente una salida amable socrática sobre un estado de forma pura.
  FlowState triggerGentleExit(
    FlowState state, {
    GentleExitMode? mode,
    String reason = 'Salida socrática solicitada directamente por el flujo.',
    String? customMessage,
  }) {
    return _applyGentleExit(
      state.copyWith(transitionCount: state.transitionCount + 1),
      mode: mode ?? defaultGentleExitMode,
      reason: reason,
      customMessage: customMessage,
    );
  }
}
