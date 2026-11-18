// 🎯 Omnichannel & Pure FSM Engine E2E Integration Suite — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios (6 ramas destructivas con expectLater y throwsA),
// §12.b Límite 5 archivos, §39 Pure Dart Core, §40 Thin Client, §43 Paridad Test-to-Prod, §48 Cierre Autárquico.
library;

import 'dart:async';
import 'package:test/test.dart';

// Entry points canónicos de producción (§43 Paridad Test-to-Prod)
import 'package:axioma/messaging.dart';
import 'package:axioma/flow.dart';

void main() {
  group(
    'TASK-N104-05: Omnichannel FSM E2E Integration Suite (§4, §6, §12.b, §39, §43, §48)',
    () {
      late WhatsAppEnvelopeAdapter waAdapter;
      late TelegramEnvelopeAdapter tgAdapter;
      late DiscordEnvelopeAdapter discordAdapter;
      late Turn0IntentRouter intentRouter;
      late FlowEngine flowEngine;

      setUp(() {
        waAdapter = const WhatsAppEnvelopeAdapter();
        tgAdapter = const TelegramEnvelopeAdapter();
        discordAdapter = DiscordEnvelopeAdapter();
        intentRouter = const Turn0IntentRouter();

        flowEngine = FlowEngine(
          maxTransitions: 15,
          maxTurns: 3,
          autoGentleExitOnTurnBudget: true,
          defaultGentleExitMode: GentleExitMode.assertiveDefault,
          allowedTransitions: const <String, Set<String>>{
            'greeting': <String>{
              'triage',
              'catalog_inquiry',
              'support_flow',
              'gentle_exit',
            },
            'triage': <String>{
              'catalog_inquiry',
              'quote_generation',
              'support_flow',
              'gentle_exit',
            },
            'catalog_inquiry': <String>{
              'quote_generation',
              'support_flow',
              'gentle_exit',
            },
            'quote_generation': <String>{
              'checkout',
              'catalog_inquiry',
              'gentle_exit',
            },
            'checkout': <String>{'completed', 'gentle_exit'},
            'support_flow': <String>{'gentle_exit'},
          },
          slotValidators: <String, bool Function(Object?)>{
            'sku': (Object? v) => v is String && v.trim().length >= 3,
            'quantity': (Object? v) => v is int && v > 0 && v <= 100,
            'customer_email': (Object? v) =>
                v is String && v.contains('@') && v.contains('.'),
          },
          socraticMessageGenerators: <GentleExitMode, String Function(FlowState, String)>{
            GentleExitMode.assertiveDefault: (FlowState state, String reason) =>
                'He recopilado tus requerimientos (${state.slots.keys.join(", ")}). '
                '¿Deseas confirmar la cotización con las opciones disponibles?',
            GentleExitMode
                .specializedHandoff: (FlowState state, String reason) =>
                'Hemos transferido tu consulta técnica a nuestro especialista automotriz. '
                'Pronto recibirás atención personalizada.',
          },
        );
      });

      // ══════════════════════════════════════════════════════════════════════════
      // 1. HAPPY PATH: TRIADA OMNICANAL E2E COMPLETA (WHATSAPP, TELEGRAM, DISCORD)
      // ══════════════════════════════════════════════════════════════════════════
      group(
        '1. Triada Omnicanal E2E Completa (Inbound -> Router -> FSM -> Outbound)',
        () {
          test(
            'WhatsApp E2E Flow: Meta Cloud Webhook -> Intent -> FSM Transition -> Outbound',
            () {
              // 1. Inbound Webhook de WhatsApp (Meta Cloud API)
              final Map<String, dynamic> rawWaWebhook = <String, dynamic>{
                'object': 'whatsapp_business_account',
                'entry': <Map<String, dynamic>>[
                  <String, dynamic>{
                    'id': 'WBA-5511',
                    'changes': <Map<String, dynamic>>[
                      <String, dynamic>{
                        'field': 'messages',
                        'value': <String, dynamic>{
                          'messaging_product': 'whatsapp',
                          'metadata': <String, dynamic>{
                            'display_phone_number': '+582125550000',
                            'phone_number_id': 'PNID-100',
                          },
                          'contacts': <Map<String, dynamic>>[
                            <String, dynamic>{
                              'profile': <String, dynamic>{
                                'name': 'Andres Bello',
                              },
                              'wa_id': '584149998877',
                            },
                          ],
                          'messages': <Map<String, dynamic>>[
                            <String, dynamic>{
                              'from': '584149998877',
                              'id': 'wamid.HBgLNTg0MTQ5OTk4ODc3',
                              'timestamp': '1700005000',
                              'type': 'text',
                              'text': <String, dynamic>{
                                'body':
                                    'Hola, quiero comprar pastillas SKU-BRK-400',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
              };

              expect(waAdapter.isCloudApi(rawWaWebhook), isTrue);
              final InboundMessage inbound = waAdapter.toInboundMessage(
                rawWaWebhook,
              );
              expect(inbound.channel, equals(ChannelType.whatsapp));
              expect(inbound.senderId, equals('+584149998877'));
              expect(
                inbound.text,
                equals('Hola, quiero comprar pastillas SKU-BRK-400'),
              );

              // 2. Intent Routing Turn-0 determinista
              final TriageDecision decision = intentRouter.route(inbound);
              expect(decision.intent, equals(TriageIntent.order));
              expect(decision.extractedParams['sku'], equals('SKU-BRK-400'));

              final IntentSignature signature = intentRouter.toSignature(
                decision,
              );
              expect(signature.verb, equals('buy'));
              expect(signature.object.toLowerCase(), equals('sku-brk-400'));
              expect(signature.canonicalKey, contains('buy\x00sku-brk-400'));

              // 3. FSM Processing (Pure Dart reduce)
              FlowState state = const FlowState(currentStep: 'greeting');

              // Turno 1: Recibe intención y actualiza slots
              final FlowIntentEvent intentEvent = FlowIntentEvent(
                intent: signature,
                payload: <String, dynamic>{
                  'target_step': 'catalog_inquiry',
                  'slots': <String, dynamic>{'sku': 'SKU-BRK-400'},
                },
              );
              state = flowEngine.reduce(state, intentEvent);

              expect(state.currentStep, equals('catalog_inquiry'));
              expect(state.slots['sku'], equals('SKU-BRK-400'));
              expect(state.turnCount, equals(1));
              expect(state.transitionCount, equals(1));
              expect(
                state.metadata['last_intent_hash'],
                equals(signature.hash),
              );

              // Transición a cotización con slot de cantidad
              state = flowEngine.reduce(
                state,
                FlowSlotUpdateEvent(slotName: 'quantity', value: 4),
              );
              state = flowEngine.reduce(
                state,
                FlowStepTransitionEvent(targetStep: 'quote_generation'),
              );
              expect(state.currentStep, equals('quote_generation'));
              expect(state.slots['quantity'], equals(4));

              // 4. Outbound Response Generation
              final OutboundMessage outbound = OutboundMessage(
                channel: inbound.channel,
                recipientId: inbound.senderId,
                text: 'Cotización generada para 4 unidades de SKU-BRK-400.',
              );

              final Map<String, dynamic> waPayload = waAdapter.toPayload(
                outbound,
              );
              expect(waPayload['messaging_product'], equals('whatsapp'));
              expect(waPayload['to'], equals('+584149998877'));
              expect(
                waPayload['text']['body'],
                contains('Cotización generada para 4 unidades'),
              );
            },
          );

          test(
            'Telegram E2E Flow: Update Webhook -> Intent -> FSM Transition -> Outbound',
            () {
              // 1. Inbound Webhook de Telegram
              final Map<String, dynamic> rawTgWebhook = <String, dynamic>{
                'update_id': 99112233,
                'message': <String, dynamic>{
                  'message_id': 884422,
                  'from': <String, dynamic>{
                    'id': 77665544,
                    'is_bot': false,
                    'first_name': 'Gabriel',
                    'username': 'gabriel_repuestos',
                  },
                  'chat': <String, dynamic>{
                    'id': 77665544,
                    'first_name': 'Gabriel',
                    'username': 'gabriel_repuestos',
                    'type': 'private',
                  },
                  'date': 1700006000,
                  'text': '¿Cuál es el precio del amortiguador?',
                },
              };

              expect(tgAdapter.isTelegramUpdate(rawTgWebhook), isTrue);
              final InboundMessage inbound = tgAdapter.toInboundMessage(
                rawTgWebhook,
              );
              expect(inbound.channel, equals(ChannelType.telegram));
              expect(inbound.senderId, equals('77665544'));

              // 2. Intent Routing Turn-0
              final TriageDecision decision = intentRouter.route(inbound);
              expect(decision.intent, equals(TriageIntent.inquiry));
              final IntentSignature signature = intentRouter.toSignature(
                decision,
              );
              expect(signature.verb, equals('query'));
              expect(signature.object, equals('price'));

              // 3. FSM Processing
              FlowState state = const FlowState(currentStep: 'greeting');
              state = flowEngine.reduce(
                state,
                FlowIntentEvent(
                  intent: signature,
                  payload: const <String, dynamic>{
                    'target_step': 'catalog_inquiry',
                  },
                ),
              );
              expect(state.currentStep, equals('catalog_inquiry'));
              expect(state.turnCount, equals(1));

              // 4. Outbound Response Generation
              final OutboundMessage outbound = OutboundMessage(
                channel: inbound.channel,
                recipientId: inbound.senderId,
                text:
                    'El amortiguador consultado tiene un costo de \$45.00 con entrega inmediata.',
              );

              final Map<String, dynamic> tgPayload = tgAdapter.toPayload(
                outbound,
              );
              expect(tgPayload['chat_id'].toString(), equals('77665544'));
              expect(tgPayload['text'], contains('\$45.00'));
            },
          );

          test(
            'Discord E2E Flow: Interaction Webhook -> Intent -> FSM Transition -> Outbound',
            () {
              // 1. Inbound Webhook de Discord
              final Map<String, dynamic> rawDiscordWebhook = <String, dynamic>{
                'id': '909090909090909090',
                'channel_id': '808080808080808080',
                'content': 'Necesito soporte con una pieza defectuosa',
                'author': <String, dynamic>{
                  'id': '334455667788990011',
                  'username': 'taller_central',
                  'global_name': 'Taller Central',
                },
                'timestamp': '2026-11-10T12:00:00.000Z',
              };

              expect(
                discordAdapter.isDiscordPayload(rawDiscordWebhook),
                isTrue,
              );
              final InboundMessage inbound = discordAdapter.toInboundMessage(
                rawDiscordWebhook,
              );
              expect(inbound.channel, equals(ChannelType.discord));
              expect(inbound.senderId, equals('334455667788990011'));

              // 2. Intent Routing Turn-0
              final TriageDecision decision = intentRouter.route(inbound);
              expect(decision.intent, equals(TriageIntent.support));
              final IntentSignature signature = intentRouter.toSignature(
                decision,
              );
              expect(signature.verb, equals('request'));
              expect(signature.object, equals('support'));

              // 3. FSM Processing
              FlowState state = const FlowState(currentStep: 'greeting');
              state = flowEngine.reduce(
                state,
                FlowIntentEvent(
                  intent: signature,
                  payload: const <String, dynamic>{
                    'target_step': 'support_flow',
                  },
                ),
              );
              expect(state.currentStep, equals('support_flow'));

              // 4. Outbound Response Generation
              final OutboundMessage outbound = OutboundMessage(
                channel: inbound.channel,
                recipientId: inbound.senderId,
                text: 'Un agente de soporte técnico ha recibido tu caso.',
              );

              final Map<String, dynamic> discordPayload = discordAdapter
                  .toPayload(outbound);
              expect(
                discordPayload['content'],
                contains('soporte técnico ha recibido tu caso'),
              );
            },
          );
        },
      );

      // ══════════════════════════════════════════════════════════════════════════
      // 2. POLÍTICA BIMODAL DE SALIDA SOCRÁTICA AMABLE (ASSERTIVE & HANDOFF)
      // ══════════════════════════════════════════════════════════════════════════
      group('2. Socratic Gentle Exit Policy (Bimodal & Custom Messages)', () {
        test(
          'Assertive Default Exit: Turn Budget Exceeded auto-transitions to gentle_exit',
          () {
            FlowState state = const FlowState(currentStep: 'greeting');

            final IntentSignature genericIntent = IntentSignature(
              verb: 'inquire',
              object: 'part',
            );

            // Turno 1
            state = flowEngine.reduce(
              state,
              FlowIntentEvent(
                intent: genericIntent,
                payload: const <String, dynamic>{
                  'target_step': 'catalog_inquiry',
                  'slots': <String, dynamic>{'sku': 'SKU-001'},
                },
              ),
            );
            expect(state.turnCount, equals(1));
            expect(state.isCompleted, isFalse);

            // Turno 2
            state = flowEngine.reduce(
              state,
              FlowIntentEvent(intent: genericIntent),
            );
            expect(state.turnCount, equals(2));
            expect(state.isCompleted, isFalse);

            // Turno 3
            state = flowEngine.reduce(
              state,
              FlowIntentEvent(intent: genericIntent),
            );
            expect(state.turnCount, equals(3));
            expect(state.isCompleted, isFalse);

            // Turno 4: Supera maxTurns (3). FlowEngine activa salida amable socrática
            state = flowEngine.reduce(
              state,
              FlowIntentEvent(intent: genericIntent),
            );

            expect(state.isCompleted, isTrue);
            expect(state.currentStep, equals('gentle_exit'));
            expect(state.gentleExit, isNotNull);
            expect(
              state.gentleExit!.mode,
              equals(GentleExitMode.assertiveDefault),
            );
            expect(
              state.gentleExit!.userMessage,
              contains('He recopilado tus requerimientos (sku)'),
            );

            // Generación de OutboundMessage para el usuario
            final OutboundMessage exitOutbound = OutboundMessage(
              channel: ChannelType.whatsapp,
              recipientId: '+584141234567',
              text: state.gentleExit!.userMessage,
            );
            expect(
              exitOutbound.text,
              contains('¿Deseas confirmar la cotización'),
            );
          },
        );

        test(
          'Specialized Handoff Exit: Explicit FlowTurnBudgetExceededEvent triggers handoff',
          () {
            FlowState state = const FlowState(currentStep: 'triage');

            state = flowEngine.reduce(
              state,
              FlowTurnBudgetExceededEvent(
                preferredMode: GentleExitMode.specializedHandoff,
                reason: 'Consulta técnica automotriz de alta complejidad',
              ),
            );

            expect(state.isCompleted, isTrue);
            expect(state.currentStep, equals('gentle_exit'));
            expect(
              state.gentleExit!.mode,
              equals(GentleExitMode.specializedHandoff),
            );
            expect(
              state.gentleExit!.userMessage,
              contains(
                'Hemos transferido tu consulta técnica a nuestro especialista',
              ),
            );
            expect(
              state.gentleExit!.reason,
              equals('Consulta técnica automotriz de alta complejidad'),
            );
          },
        );

        test(
          'triggerGentleExit provides direct pure conversational egress',
          () {
            const FlowState initial = FlowState(
              currentStep: 'quote_generation',
            );

            final FlowState exited = flowEngine.triggerGentleExit(
              initial,
              mode: GentleExitMode.assertiveDefault,
              customMessage:
                  'Tu solicitud de cotización está lista para revisión.',
            );

            expect(exited.isCompleted, isTrue);
            expect(exited.currentStep, equals('gentle_exit'));
            expect(
              exited.gentleExit!.userMessage,
              equals('Tu solicitud de cotización está lista para revisión.'),
            );
          },
        );
      });

      // ══════════════════════════════════════════════════════════════════════════
      // 3. SAD PATH: 6 RAMAS DESTRUCTIVAS CON EXPECTLATER Y THROWSA (§6)
      // ══════════════════════════════════════════════════════════════════════════
      group('3. Sad Path: 6 Destructive Branches with expectLater & throwsA (§6)', () {
        // Rama Destructiva 1: Fallas de Inbound Mutilado / Payload Corrupto en Adaptadores
        test(
          'Destructive Branch 1 (§6): Adapter throws on malformed or empty incoming payload',
          () async {
            // WhatsApp: Payload vacío
            expect(
              () => waAdapter.toInboundMessage(<String, dynamic>{}),
              throwsA(isA<WhatsAppAdapterException>()),
            );

            // Telegram: Payload sin mensaje ni update_id
            expect(
              () => tgAdapter.toInboundMessage(<String, dynamic>{'foo': 'bar'}),
              throwsA(isA<TelegramAdapterException>()),
            );

            // Discord: Payload mutilado sin autor ni contenido
            expect(
              () => discordAdapter.toInboundMessage(<String, dynamic>{
                'unknown_discord': 123,
              }),
              throwsA(isA<DiscordAdapterException>()),
            );

            // Asynchronous check with expectLater
            await expectLater(
              Future<void>.sync(
                () => waAdapter.toInboundMessage(<String, dynamic>{}),
              ),
              throwsA(isA<WhatsAppAdapterException>()),
            );
            await expectLater(
              Future<void>.sync(
                () => tgAdapter.toInboundMessage(<String, dynamic>{
                  'update_id': 1,
                }),
              ),
              throwsA(isA<TelegramAdapterException>()),
            );
            await expectLater(
              Future<void>.sync(
                () => discordAdapter.toInboundMessage(<String, dynamic>{}),
              ),
              throwsA(isA<DiscordAdapterException>()),
            );
          },
        );

        // Rama Destructiva 2: Fallas de Triage y Rutas Corruptas en Turn0IntentRouter
        test(
          'Destructive Branch 2 (§6): Intent router throws TriageRoutingException on empty or corrupt text',
          () async {
            final InboundMessage emptyMsg = InboundMessage(
              channel: ChannelType.whatsapp,
              senderId: '+584141112233',
              text: '     ',
              providerMessageId: 'wam-empty-1',
              timestamp: DateTime.now().toUtc(),
            );

            expect(
              () => intentRouter.route(emptyMsg, strict: true),
              throwsA(isA<TriageRoutingException>()),
            );

            final InboundMessage corruptMsg = InboundMessage(
              channel: ChannelType.telegram,
              senderId: '123456',
              text: 'Consulta de repuesto \x00\x01\x02 corrupta',
              providerMessageId: 'tg-corrupt-1',
              timestamp: DateTime.now().toUtc(),
            );

            expect(
              () => intentRouter.route(corruptMsg, strict: true),
              throwsA(isA<TriageRoutingException>()),
            );

            // Asynchronous check with expectLater
            await expectLater(
              Future<void>.sync(
                () => intentRouter.route(emptyMsg, strict: true),
              ),
              throwsA(isA<TriageRoutingException>()),
            );
            await expectLater(
              Future<void>.sync(
                () => intentRouter.route(corruptMsg, strict: true),
              ),
              throwsA(isA<TriageRoutingException>()),
            );
          },
        );

        // Rama Destructiva 3: Inyección de Colisión y Argumentos Inválidos en IntentSignature
        test(
          'Destructive Branch 3 (§6): IntentSignature throws ArgumentError on null-bytes, empty verb or invalid confidence',
          () async {
            // Intento de inyección con byte nulo delimitador
            expect(
              () => IntentSignature(verb: 'buy\x00tamper', object: 'sku_1'),
              throwsA(isA<ArgumentError>()),
            );

            // Verbo vacío
            expect(
              () => IntentSignature(verb: '   ', object: 'sku_1'),
              throwsA(isA<ArgumentError>()),
            );

            // Confianza fuera de rango [0.0, 1.0]
            expect(
              () => IntentSignature(
                verb: 'buy',
                object: 'sku_1',
                confidence: 1.5,
              ),
              throwsA(isA<ArgumentError>()),
            );
            expect(
              () => IntentSignature(
                verb: 'buy',
                object: 'sku_1',
                confidence: -0.1,
              ),
              throwsA(isA<ArgumentError>()),
            );

            // Asynchronous check with expectLater
            await expectLater(
              Future<void>.sync(
                () => IntentSignature(verb: 'injected\x00verb', object: 'obj'),
              ),
              throwsA(isA<ArgumentError>()),
            );
          },
        );

        // Rama Destructiva 4: Transición Ilegal de Estados en FSM (Grafo Desconocido)
        test(
          'Destructive Branch 4 (§6): FlowEngine throws UnknownTransitionViolation on illegal step',
          () async {
            const FlowState state = FlowState(currentStep: 'greeting');

            // Intento de saltar de 'greeting' a 'checkout' directamente (no permitido en allowedTransitions)
            expect(
              () => flowEngine.reduce(
                state,
                FlowStepTransitionEvent(targetStep: 'checkout'),
              ),
              throwsA(isA<UnknownTransitionViolation>()),
            );

            // Intento de saltar a un paso totalmente inventado
            expect(
              () => flowEngine.reduce(
                state,
                FlowStepTransitionEvent(targetStep: 'hacked_admin_step'),
              ),
              throwsA(isA<UnknownTransitionViolation>()),
            );

            // Asynchronous check with expectLater
            await expectLater(
              Future<void>.sync(
                () => flowEngine.reduce(
                  state,
                  FlowStepTransitionEvent(targetStep: 'checkout'),
                ),
              ),
              throwsA(isA<UnknownTransitionViolation>()),
            );
          },
        );

        // Rama Destructiva 5: Bucle Infinito o Presupuesto de Transiciones Agotado (Anti-Loop Guard)
        test(
          'Destructive Branch 5 (§6): FlowEngine throws FlowBudgetExceeded when transitionCount >= maxTransitions',
          () async {
            // Configurar estado en el límite exacto (15 transiciones)
            const FlowState stateAtLimit = FlowState(
              currentStep: 'catalog_inquiry',
              transitionCount: 15,
            );

            expect(
              () => flowEngine.reduce(
                stateAtLimit,
                FlowSlotUpdateEvent(slotName: 'sku', value: 'SKU-OK-1'),
              ),
              throwsA(isA<FlowBudgetExceeded>()),
            );

            // Asynchronous check with expectLater
            await expectLater(
              Future<void>.sync(
                () => flowEngine.reduce(
                  stateAtLimit,
                  FlowStepTransitionEvent(targetStep: 'quote_generation'),
                ),
              ),
              throwsA(isA<FlowBudgetExceeded>()),
            );
          },
        );

        // Rama Destructiva 6: Violación de Contratos de Slots y Presupuesto de Turnos Estricto
        test(
          'Destructive Branch 6 (§6): FlowEngine throws InvalidSlotViolation on bad slots and TurnBudgetExceeded in strict mode',
          () async {
            const FlowState state = FlowState(currentStep: 'catalog_inquiry');

            // Slot con valor que falla el validador registrado (cantidad negativa o excesiva)
            expect(
              () => flowEngine.reduce(
                state,
                FlowSlotUpdateEvent(slotName: 'quantity', value: -5),
              ),
              throwsA(isA<InvalidSlotViolation>()),
            );
            expect(
              () => flowEngine.reduce(
                state,
                FlowSlotUpdateEvent(slotName: 'quantity', value: 9999),
              ),
              throwsA(isA<InvalidSlotViolation>()),
            );

            // Slot de email con formato inválido
            expect(
              () => flowEngine.reduce(
                state,
                FlowSlotUpdateEvent(
                  slotName: 'customer_email',
                  value: 'not-an-email',
                ),
              ),
              throwsA(isA<InvalidSlotViolation>()),
            );

            // Nombre de slot vacío
            expect(
              () => flowEngine.reduce(
                state,
                FlowSlotUpdateEvent(slotName: '   ', value: 123),
              ),
              throwsA(isA<InvalidSlotViolation>()),
            );

            // Strict mode (autoGentleExitOnTurnBudget: false) throws TurnBudgetExceeded
            const FlowEngine strictEngine = FlowEngine(
              maxTurns: 2,
              autoGentleExitOnTurnBudget: false,
            );
            const FlowState strictState = FlowState(
              currentStep: 'triage',
              turnCount: 2,
            );

            final IntentSignature dummyIntent = IntentSignature(
              verb: 'query',
              object: 'stock',
            );
            expect(
              () => strictEngine.reduce(
                strictState,
                FlowIntentEvent(intent: dummyIntent),
              ),
              throwsA(isA<TurnBudgetExceeded>()),
            );

            // Asynchronous check with expectLater
            await expectLater(
              Future<void>.sync(
                () => flowEngine.reduce(
                  state,
                  FlowSlotUpdateEvent(slotName: 'quantity', value: 0),
                ),
              ),
              throwsA(isA<InvalidSlotViolation>()),
            );
            await expectLater(
              Future<void>.sync(
                () => strictEngine.reduce(
                  strictState,
                  FlowIntentEvent(intent: dummyIntent),
                ),
              ),
              throwsA(isA<TurnBudgetExceeded>()),
            );
          },
        );
      });
    },
  );
}
