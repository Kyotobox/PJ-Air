// 🎯 Turn-0 Deterministic Intent Router Unit & Sad Path Tests (§4, §6, §39, §43)
// Conforme a: Tolerancia Cero a Mocks (§4), Sad Path Mandatorio (§6), Calm Error UX.

import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('Turn0IntentRouter Deterministic Triaje Engine (§4, §6, §39, §43)', () {
    const Turn0IntentRouter router = Turn0IntentRouter();
    final DateTime now = DateTime.utc(2026, 11, 9, 20, 0, 0);

    InboundMessage createMessage(String text) {
      return InboundMessage(
        channel: ChannelType.whatsapp,
        senderId: '+584121234567',
        senderName: 'Cliente Prueba',
        text: text,
        providerMessageId: 'msg-turn0-${DateTime.now().microsecondsSinceEpoch}',
        timestamp: now,
      );
    }

    group(
      'Happy Path: Deterministic Fast-Track Routing (zero-cost LLM bypass)',
      () {
        test(
          'Identifies catalog request and routes to fastTrack with category extraction',
          () {
            final InboundMessage msg = createMessage(
              'Hola, quiero ver el catálogo de repuestos',
            );
            final TriageDecision decision = router.route(msg);

            expect(decision.route, equals(TriageRoute.fastTrack));
            expect(decision.intent, equals(TriageIntent.inquiry));
            expect(decision.confidence, equals(1.0));
            expect(decision.extractedParams['action'], equals('view_catalog'));
            expect(decision.extractedParams['pattern'], equals('catalog'));
            expect(decision.extractedParams['category'], equals('repuestos'));
            expect(decision.reason, contains('Fast-Track'));
          },
        );

        test('Identifies "ver productos" phrase deterministically', () {
          final InboundMessage msg = createMessage('Por favor ver productos');
          final TriageDecision decision = router.route(msg);

          expect(decision.route, equals(TriageRoute.fastTrack));
          expect(decision.intent, equals(TriageIntent.inquiry));
          expect(decision.extractedParams['action'], equals('view_catalog'));
        });

        test('Identifies price inquiry and extracts target query', () {
          final InboundMessage msg = createMessage(
            '¿Cuál es el precio de pastillas de freno?',
          );
          final TriageDecision decision = router.route(msg);

          expect(decision.route, equals(TriageRoute.fastTrack));
          expect(decision.intent, equals(TriageIntent.inquiry));
          expect(decision.confidence, equals(1.0));
          expect(decision.extractedParams['action'], equals('price_inquiry'));
          expect(decision.extractedParams['pattern'], equals('price'));
          expect(
            decision.extractedParams['query'],
            equals('pastillas de freno'),
          );
        });

        test('Identifies direct purchase by SKU with quantity extraction', () {
          final InboundMessage msg = createMessage(
            'Quiero comprar 3 unidades de SKU-FRENO-402',
          );
          final TriageDecision decision = router.route(msg);

          expect(decision.route, equals(TriageRoute.fastTrack));
          expect(decision.intent, equals(TriageIntent.order));
          expect(decision.confidence, equals(1.0));
          expect(decision.extractedParams['action'], equals('purchase_sku'));
          expect(decision.extractedParams['sku'], equals('SKU-FRENO-402'));
          expect(decision.extractedParams['quantity'], equals(3));
        });

        test('Identifies purchase with labelled SKU (SKU: 9988)', () {
          final InboundMessage msg = createMessage('comprar SKU: 9988');
          final TriageDecision decision = router.route(msg);

          expect(decision.route, equals(TriageRoute.fastTrack));
          expect(decision.intent, equals(TriageIntent.order));
          expect(decision.extractedParams['sku'], equals('SKU-9988'));
        });

        test('Supports custom catalog keywords in router configuration', () {
          const Turn0IntentRouter customRouter = Turn0IntentRouter(
            customCatalogKeywords: <String>['folleto digital', 'muestrario'],
          );
          final InboundMessage msg = createMessage(
            'Me envías el folleto digital?',
          );
          final TriageDecision decision = customRouter.route(msg);

          expect(decision.route, equals(TriageRoute.fastTrack));
          expect(decision.intent, equals(TriageIntent.inquiry));
          expect(decision.extractedParams['action'], equals('view_catalog'));
        });
      },
    );

    group('Happy Path: Deterministic Socratic Routing (conversational & advice)', () {
      test('Routes open consultation/advice to socratic route', () {
        final InboundMessage msg = createMessage(
          '¿Qué aceite de motor sintético me recomiendas para un auto con 150,000 km?',
        );
        final TriageDecision decision = router.route(msg);

        expect(decision.route, equals(TriageRoute.socratic));
        expect(decision.intent, equals(TriageIntent.consultation));
        expect(decision.confidence, equals(0.70));
        expect(decision.reason, contains('Socratic'));
      });

      test(
        'Routes technical support and claim inquiry to socratic route with support intent',
        () {
          final InboundMessage msg = createMessage(
            'Hola, tengo un problema con mi pedido anterior, vino con avería y requiero garantía',
          );
          final TriageDecision decision = router.route(msg);

          expect(decision.route, equals(TriageRoute.socratic));
          expect(decision.intent, equals(TriageIntent.support));
          expect(decision.route, equals(TriageRoute.socratic));
        },
      );
    });

    group('Sad Path (§6) & Calm Error UX: Corrupt & Empty Payload Handling', () {
      test(
        'Sad Path (§6): Throws TriageRoutingException on empty or whitespace message in strict mode',
        () {
          final InboundMessage emptyMsg = createMessage('     ');

          expect(
            () => router.route(emptyMsg, strict: true),
            throwsA(
              isA<TriageRoutingException>().having(
                (TriageRoutingException e) => e.message,
                'message',
                contains('no puede estar vacío'),
              ),
            ),
          );
        },
      );

      test(
        'Sad Path (§6): Throws TriageRoutingException on corrupted/null-byte payload in strict mode',
        () {
          final InboundMessage corruptMsg = createMessage(
            'catálogo \x00 corrupto \uFFFD',
          );

          expect(
            () => router.route(corruptMsg, strict: true),
            throwsA(
              isA<TriageRoutingException>().having(
                (TriageRoutingException e) => e.message,
                'message',
                contains('caracteres corruptos'),
              ),
            ),
          );
        },
      );

      test(
        'Calm Error UX: routeSafely degrades gently to socratic on empty message without throwing',
        () {
          final InboundMessage emptyMsg = createMessage('   ');
          final TriageDecision decision = router.routeSafely(emptyMsg);

          expect(decision.route, equals(TriageRoute.socratic));
          expect(decision.intent, equals(TriageIntent.unknown));
          expect(decision.confidence, equals(0.0));
          expect(decision.reason, contains('degradando suavemente'));
        },
      );

      test(
        'Calm Error UX: route(strict: false) degrades gently to socratic on corrupt message',
        () {
          final InboundMessage corruptMsg = createMessage(
            'precio \x00\x01\x02',
          );
          final TriageDecision decision = router.route(
            corruptMsg,
            strict: false,
          );

          expect(decision.route, equals(TriageRoute.socratic));
          expect(decision.intent, equals(TriageIntent.unknown));
          expect(decision.confidence, equals(0.0));
          expect(decision.reason, contains('degradando suavemente'));
        },
      );

      test(
        'TriageRoutingException serializes message and toString clearly',
        () {
          const TriageRoutingException ex = TriageRoutingException(
            'Falla de prueba',
          );
          expect(
            ex.toString(),
            equals('TriageRoutingException: Falla de prueba'),
          );
        },
      );
    });
  });
}
