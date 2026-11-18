// 🎯 Tests de FlowEngine FSM & Salida Socrática Asertiva — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios,
// §12.b Límite 5 archivos, §40 Thin Client, §48 Cierre Autárquico, Calm Error UX.

import 'package:test/test.dart';
import 'package:axioma/src/flow/flow_engine.dart';
import 'package:axioma/src/messaging/intent_signature.dart';

void main() {
  group('FlowEngine — Happy Path & Pure Determinism (§4, §39)', () {
    late FlowEngine engine;

    setUp(() {
      engine = const FlowEngine(
        maxTransitions: 10,
        maxTurns: 3,
        allowedTransitions: <String, Set<String>>{
          'initial': <String>{'collecting_info', 'confirmation'},
          'collecting_info': <String>{'collecting_info', 'confirmation'},
          'confirmation': <String>{'completed'},
        },
      );
    });

    test('reduce es una función pura: no muta el estado de origen', () {
      final FlowState initial = FlowState.initial(initialStep: 'initial');
      final FlowEvent event = FlowStepTransitionEvent(
        targetStep: 'collecting_info',
      );

      final FlowState nextState = engine.reduce(initial, event);

      expect(initial.currentStep, equals('initial'));
      expect(initial.transitionCount, equals(0));
      expect(initial.stepHistory, equals(<String>['initial']));

      expect(nextState.currentStep, equals('collecting_info'));
      expect(nextState.transitionCount, equals(1));
      expect(
        nextState.stepHistory,
        equals(<String>['initial', 'collecting_info']),
      );
    });

    test(
      'actualiza slots correctamente y permite su eliminación pasando null',
      () {
        final FlowState initial = FlowState.initial();
        final FlowState withSlot = engine.reduce(
          initial,
          FlowSlotUpdateEvent(slotName: 'part_number', value: 'BOSCH-0280'),
        );

        expect(withSlot.slots['part_number'], equals('BOSCH-0280'));
        expect(withSlot.transitionCount, equals(1));

        final FlowState clearedSlot = engine.reduce(
          withSlot,
          FlowSlotUpdateEvent(slotName: 'part_number', value: null),
        );

        expect(clearedSlot.slots.containsKey('part_number'), isFalse);
        expect(clearedSlot.transitionCount, equals(2));
      },
    );

    test(
      'procesa FlowIntentEvent actualizando turnCount, metadata y slots empaquetados',
      () {
        final FlowState initial = FlowState.initial();
        final IntentSignature intent = IntentSignature(
          verb: 'buscar',
          object: 'amortiguador',
          domain: 'autopartes',
        );

        final FlowState state = engine.reduce(
          initial,
          FlowIntentEvent(
            intent: intent,
            payload: <String, dynamic>{
              'target_step': 'collecting_info',
              'slots': <String, dynamic>{'category': 'suspension'},
            },
          ),
        );

        expect(state.currentStep, equals('collecting_info'));
        expect(state.turnCount, equals(1));
        expect(state.transitionCount, equals(1));
        expect(state.slots['category'], equals('suspension'));
        expect(
          state.metadata['last_intent'],
          equals('buscar\x00amortiguador\x00autopartes'),
        );
        expect(state.metadata['last_intent_hash'], equals(intent.hash));
      },
    );

    test(
      'política bimodal de salida amable ante agotamiento de turnos (Defaulting Asertivo)',
      () {
        final FlowState initial = FlowState.initial();
        final IntentSignature intent = IntentSignature(
          verb: 'duda',
          object: 'desconocido',
        );

        // Máximo 3 turnos: turno 1, 2, 3
        FlowState current = initial;
        for (int i = 0; i < 3; i++) {
          current = engine.reduce(current, FlowIntentEvent(intent: intent));
          expect(current.isCompleted, isFalse);
        }

        // Turno 4 supera el maxTurns de 3 -> Activa salida amable socrática
        final FlowState gentleExitState = engine.reduce(
          current,
          FlowIntentEvent(intent: intent),
        );

        expect(gentleExitState.isCompleted, isTrue);
        expect(gentleExitState.currentStep, equals('gentle_exit'));
        expect(gentleExitState.gentleExit, isNotNull);
        expect(
          gentleExitState.gentleExit!.mode,
          equals(GentleExitMode.assertiveDefault),
        );
        expect(
          gentleExitState.gentleExit!.userMessage,
          contains('Para asegurarnos de avanzar'),
        );
        // Cero exposición de excepciones técnicas al cliente
        expect(
          gentleExitState.gentleExit!.userMessage,
          isNot(contains('Exception')),
        );
        expect(
          gentleExitState.gentleExit!.userMessage,
          isNot(contains('Stack')),
        );
      },
    );

    test(
      'política bimodal de salida amable ante agotamiento de turnos (Specialized Handoff)',
      () {
        const FlowEngine handoffEngine = FlowEngine(
          maxTurns: 1,
          defaultGentleExitMode: GentleExitMode.specializedHandoff,
        );

        final FlowState initial = FlowState.initial();
        final IntentSignature intent = IntentSignature(
          verb: 'queja',
          object: 'factura',
        );

        // Turno 1
        final FlowState s1 = handoffEngine.reduce(
          initial,
          FlowIntentEvent(intent: intent),
        );
        expect(s1.isCompleted, isFalse);

        // Turno 2 supera límite -> Handoff especializado
        final FlowState handoffState = handoffEngine.reduce(
          s1,
          FlowIntentEvent(intent: intent),
        );

        expect(handoffState.isCompleted, isTrue);
        expect(
          handoffState.gentleExit!.mode,
          equals(GentleExitMode.specializedHandoff),
        );
        expect(
          handoffState.gentleExit!.userMessage,
          contains('he transferido nuestra conversación a un especialista'),
        );
      },
    );

    test(
      'permite generadores socráticos personalizados y activación directa de salida amable',
      () {
        final FlowEngine customEngine = FlowEngine(
          socraticMessageGenerators:
              <GentleExitMode, String Function(FlowState, String)>{
                GentleExitMode.assertiveDefault: (FlowState s, String r) =>
                    'Socrático personalizado para paso ${s.currentStep}.',
              },
        );

        final FlowState state = customEngine.triggerGentleExit(
          FlowState.initial(initialStep: 'menu'),
          mode: GentleExitMode.assertiveDefault,
          reason: 'Demasiadas dudas del usuario',
        );

        expect(state.currentStep, equals('gentle_exit'));
        expect(state.isCompleted, isTrue);
        expect(
          state.gentleExit!.userMessage,
          equals('Socrático personalizado para paso menu.'),
        );
      },
    );
  });

  group('FlowEngine — Sad Paths & Boundary Assertions (§6)', () {
    late FlowEngine strictEngine;

    setUp(() {
      strictEngine = FlowEngine(
        maxTransitions: 4,
        maxTurns: 2,
        autoGentleExitOnTurnBudget: false,
        allowedTransitions: const <String, Set<String>>{
          'initial': <String>{'step_a'},
          'step_a': <String>{'step_b'},
        },
        slotValidators: <String, bool Function(Object?)>{
          'year': (Object? val) => val is int && val >= 1990 && val <= 2027,
          'vin': (Object? val) => val is String && val.length == 17,
        },
      );
    });

    test(
      'Sad Path 1: Transición ilegal arroja UnknownTransitionViolation (§6)',
      () {
        final FlowState state = FlowState.initial(initialStep: 'initial');

        // Intentar saltar directamente a step_b cuando sólo step_a es legal
        expect(
          () => strictEngine.reduce(
            state,
            FlowStepTransitionEvent(targetStep: 'step_b'),
          ),
          throwsA(
            isA<UnknownTransitionViolation>()
                .having(
                  (UnknownTransitionViolation e) => e.fromStep,
                  'fromStep',
                  'initial',
                )
                .having(
                  (UnknownTransitionViolation e) => e.attemptedStep,
                  'attemptedStep',
                  'step_b',
                )
                .having(
                  (UnknownTransitionViolation e) => e.message,
                  'message',
                  contains('Transición ilegal no registrada'),
                ),
          ),
        );
      },
    );

    test(
      'Sad Path 2: Bucle sin progreso o límite de transiciones arroja FlowBudgetExceeded (§6)',
      () {
        // Estado con transitionCount igual o superior a maxTransitions (4)
        const FlowState loopedState = FlowState(
          currentStep: 'step_a',
          transitionCount: 4,
        );

        expect(
          () => strictEngine.reduce(
            loopedState,
            FlowStepTransitionEvent(targetStep: 'step_b'),
          ),
          throwsA(
            isA<FlowBudgetExceeded>()
                .having(
                  (FlowBudgetExceeded e) => e.currentTransitions,
                  'currentTransitions',
                  4,
                )
                .having(
                  (FlowBudgetExceeded e) => e.maxTransitions,
                  'maxTransitions',
                  4,
                )
                .having(
                  (FlowBudgetExceeded e) => e.message,
                  'message',
                  contains('Presupuesto de flujo excedido'),
                ),
          ),
        );
      },
    );

    test('Sad Path 3: Slot inválido arroja InvalidSlotViolation (§6)', () {
      final FlowState state = FlowState.initial();

      // Año menor al rango permitido
      expect(
        () => strictEngine.reduce(
          state,
          FlowSlotUpdateEvent(slotName: 'year', value: 1980),
        ),
        throwsA(
          isA<InvalidSlotViolation>()
              .having(
                (InvalidSlotViolation e) => e.slotName,
                'slotName',
                'year',
              )
              .having(
                (InvalidSlotViolation e) => e.invalidValue,
                'invalidValue',
                1980,
              )
              .having(
                (InvalidSlotViolation e) => e.message,
                'message',
                contains('Slot inválido "year"'),
              ),
        ),
      );

      // VIN con longitud distinta de 17 caracteres
      expect(
        () => strictEngine.reduce(
          state,
          FlowSlotUpdateEvent(slotName: 'vin', value: 'VIN_CORTO'),
        ),
        throwsA(
          isA<InvalidSlotViolation>()
              .having((InvalidSlotViolation e) => e.slotName, 'slotName', 'vin')
              .having(
                (InvalidSlotViolation e) => e.invalidValue,
                'invalidValue',
                'VIN_CORTO',
              ),
        ),
      );

      // Nombre de slot vacío
      expect(
        () => strictEngine.reduce(
          state,
          FlowSlotUpdateEvent(slotName: '   ', value: 'foo'),
        ),
        throwsA(
          isA<InvalidSlotViolation>().having(
            (InvalidSlotViolation e) => e.reason,
            'reason',
            contains('no puede ser vacío'),
          ),
        ),
      );
    });

    test(
      'Sad Path 4: TurnBudgetExceeded arrojado cuando autoGentleExitOnTurnBudget es false (§6)',
      () {
        const FlowState state = FlowState(
          currentStep: 'initial',
          turnCount: 2, // Ya está en el límite maxTurns = 2
        );
        final IntentSignature intent = IntentSignature(
          verb: 'consultar',
          object: 'stock',
        );

        expect(
          () => strictEngine.reduce(state, FlowIntentEvent(intent: intent)),
          throwsA(
            isA<TurnBudgetExceeded>()
                .having(
                  (TurnBudgetExceeded e) => e.currentTurn,
                  'currentTurn',
                  3,
                )
                .having((TurnBudgetExceeded e) => e.maxTurns, 'maxTurns', 2)
                .having(
                  (TurnBudgetExceeded e) => e.message,
                  'message',
                  contains('TurnBudgetExceeded (3/2 turnos consumidos)'),
                ),
          ),
        );
      },
    );

    test(
      'Sad Path 5: Boundary assertions en FlowState y GentleExitMode (§6)',
      () {
        expect(
          () => FlowState.initial(initialStep: '   '),
          throwsA(isA<ArgumentError>()),
        );

        expect(
          () => GentleExitMode.fromString('modo_inexistente'),
          throwsA(isA<ArgumentError>()),
        );
      },
    );
  });
}
