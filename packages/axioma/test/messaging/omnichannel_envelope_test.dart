import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('Canonical Omnichannel Messaging Envelope & Triage DTOs (§4, §6, §39)', () {
    group('ChannelType & InboundMessage', () {
      test('Happy Path: Creates and serializes valid InboundMessage', () {
        final DateTime now = DateTime.now().toUtc();
        final InboundMessage msg = InboundMessage(
          channel: ChannelType.whatsapp,
          senderId: '+584141234567',
          senderName: 'Boutique Client',
          text: 'Hola, tienen disponible la talla M del vestido azul?',
          providerMessageId: 'wamid.HBgLNTg0MTQxMjM0NTY3FQIAERgSRjQ2M0ExRkEyN',
          timestamp: now,
          rawPayload: <String, dynamic>{'status': 'received'},
        );

        final Map<String, dynamic> json = msg.toJson();
        expect(json['channel'], equals('whatsapp'));
        expect(json['sender_id'], equals('+584141234567'));
        expect(json['sender_name'], equals('Boutique Client'));
        expect(json['provider_message_id'], startsWith('wamid.'));
        expect(json['timestamp'], equals(now.toIso8601String()));

        final InboundMessage roundtrip = InboundMessage.fromJson(json);
        expect(roundtrip.channel, equals(ChannelType.whatsapp));
        expect(roundtrip.senderId, equals('+584141234567'));
        expect(roundtrip.text, equals(msg.text));
        expect(roundtrip.providerMessageId, equals(msg.providerMessageId));
      });

      test(
        'Sad Path (§6): Throws ArgumentError on empty senderId or providerMessageId',
        () {
          final DateTime now = DateTime.now().toUtc();
          expect(
            () => InboundMessage(
              channel: ChannelType.telegram,
              senderId: '   ',
              text: 'Test',
              providerMessageId: 'tg-123',
              timestamp: now,
            ),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => InboundMessage(
              channel: ChannelType.telegram,
              senderId: 'user-123',
              text: 'Test',
              providerMessageId: '',
              timestamp: now,
            ),
            throwsA(isA<ArgumentError>()),
          );
        },
      );

      test(
        'Sad Path (§6): Throws ArgumentError on unknown channel or missing json fields',
        () {
          expect(
            () => ChannelType.fromString('sms_unknown'),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => InboundMessage.fromJson(<String, dynamic>{
              'sender_id': '123',
              'provider_message_id': 'prov-1',
              'timestamp': DateTime.now().toIso8601String(),
            }),
            throwsA(isA<ArgumentError>()),
          );
        },
      );
    });

    group('OutboundMessage', () {
      test('Happy Path: Serializes valid text and media OutboundMessage', () {
        final OutboundMessage outText = OutboundMessage(
          channel: ChannelType.whatsapp,
          recipientId: '+584141234567',
          text: 'Sí, tenemos 3 unidades en talla M.',
          replyToId: 'wamid.123',
        );

        final Map<String, dynamic> jsonText = outText.toJson();
        expect(jsonText['recipient_id'], equals('+584141234567'));
        expect(jsonText['reply_to_id'], equals('wamid.123'));

        final OutboundMessage roundtrip = OutboundMessage.fromJson(jsonText);
        expect(roundtrip.recipientId, equals(outText.recipientId));
        expect(roundtrip.text, equals(outText.text));

        final OutboundMessage outMedia = OutboundMessage(
          channel: ChannelType.telegram,
          recipientId: '@buyer_user',
          text: '',
          mediaUrl: 'https://cdn.levita.dev/flyer_104.png',
          mediaType: 'image',
        );
        expect(outMedia.mediaUrl, isNotNull);
      });

      test(
        'Sad Path (§6): Throws ArgumentError on empty recipientId or missing content',
        () {
          expect(
            () => OutboundMessage(
              channel: ChannelType.whatsapp,
              recipientId: '   ',
              text: 'Mensaje sin destinatario',
            ),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => OutboundMessage(
              channel: ChannelType.whatsapp,
              recipientId: '+584141234567',
              text: '   ',
              mediaUrl: null,
            ),
            throwsA(isA<ArgumentError>()),
          );
        },
      );
    });

    group('TriageDecision & Turn-0 Routing', () {
      test(
        'Happy Path: Creates deterministic fast-track and socratic decisions',
        () {
          final TriageDecision fastTrack = TriageDecision(
            intent: TriageIntent.order,
            route: TriageRoute.fastTrack,
            confidence: 0.95,
            extractedParams: <String, dynamic>{
              'sku': 'VESTIDO-AZUL-M',
              'qty': 1,
            },
            reason: 'El cliente especificó producto y talla exactos',
          );

          final Map<String, dynamic> json = fastTrack.toJson();
          expect(json['intent'], equals('order'));
          expect(json['route'], equals('fast_track'));
          expect(json['confidence'], equals(0.95));

          final TriageDecision roundtrip = TriageDecision.fromJson(json);
          expect(roundtrip.intent, equals(TriageIntent.order));
          expect(roundtrip.route, equals(TriageRoute.fastTrack));
          expect(roundtrip.extractedParams['sku'], equals('VESTIDO-AZUL-M'));

          final TriageDecision socratic = TriageDecision(
            intent: TriageIntent.consultation,
            route: TriageRoute.socratic,
            confidence: 0.70,
            reason: 'Cliente solicita recomendaciones de estilo para boda',
          );
          expect(socratic.route, equals(TriageRoute.socratic));
        },
      );

      test(
        'Sad Path (§6): Throws ArgumentError on invalid confidence or missing json',
        () {
          expect(
            () => TriageDecision(
              intent: TriageIntent.inquiry,
              route: TriageRoute.fastTrack,
              confidence: 1.5,
            ),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => TriageDecision(
              intent: TriageIntent.inquiry,
              route: TriageRoute.fastTrack,
              confidence: -0.1,
            ),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => TriageDecision.fromJson(<String, dynamic>{'intent': 'order'}),
            throwsA(isA<ArgumentError>()),
          );
        },
      );
    });
  });
}
