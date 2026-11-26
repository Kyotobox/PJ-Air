// 🎯 LeadCapturedEvent Test Suite — Pure Dart (§4, §6, §39, §47)

import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

void main() {
  group('LeadCapturedEvent Canonical Contract Suite', () {
    test(
      'Happy Path: computeSenderHmac generates deterministic SHA-256 HMAC',
      () {
        final hmac1 = LeadCapturedEvent.computeSenderHmac('+584121234567');
        final hmac2 = LeadCapturedEvent.computeSenderHmac('+584121234567');
        final hmacDifferent = LeadCapturedEvent.computeSenderHmac(
          '+584149876543',
        );

        expect(hmac1, equals(hmac2));
        expect(hmac1, isNot(equals(hmacDifferent)));
        expect(hmac1.length, equals(64)); // SHA-256 hex string
      },
    );

    test('Happy Path: Event creation, serialization and roundtrip JSON', () {
      final now = DateTime.now().toUtc();
      final senderHmac = LeadCapturedEvent.computeSenderHmac('+584121234567');

      final event = LeadCapturedEvent.validated(
        eventId: 'EVT-1795644028908-001',
        traceId: 'TRC-1795644028908-ECHO',
        channel: ChannelType.whatsapp,
        senderHmac: senderHmac,
        rawContent:
            'Hola, me interesa comprar una batería para Toyota Corolla 2012',
        sourceGroupId: '120363045678901234@g.us',
        capturedAt: now,
        metadata: {'platform': 'baileys', 'intent_probe': 'pricing'},
      );

      expect(event.eventId, equals('EVT-1795644028908-001'));
      expect(event.traceId, equals('TRC-1795644028908-ECHO'));
      expect(event.channel, equals(ChannelType.whatsapp));
      expect(event.senderHmac, equals(senderHmac));
      expect(event.rawContent, contains('Toyota Corolla'));
      expect(event.sourceGroupId, equals('120363045678901234@g.us'));

      final json = event.toJson();
      expect(json['schema_version'], equals('1.0.0'));
      expect(json['channel'], equals('whatsapp'));
      expect(json['sender_hmac'], equals(senderHmac));

      final restored = LeadCapturedEvent.fromJson(json);
      expect(restored.eventId, equals(event.eventId));
      expect(restored.traceId, equals(event.traceId));
      expect(restored.channel, equals(event.channel));
      expect(restored.senderHmac, equals(event.senderHmac));
      expect(restored.rawContent, equals(event.rawContent));
      expect(restored.sourceGroupId, equals(event.sourceGroupId));
    });

    test('Sad Path (§6): computeSenderHmac throws on empty sender', () {
      expect(
        () => LeadCapturedEvent.computeSenderHmac('   '),
        throwsA(isA<ArgumentError>()),
      );
    });

    test(
      'Sad Path (§6): Rejection of empty eventId, traceId, senderHmac or rawContent',
      () {
        expect(
          () => LeadCapturedEvent.validated(
            eventId: '',
            traceId: 'TRC-1',
            channel: ChannelType.telegram,
            senderHmac: 'hmac123',
            rawContent: 'test',
          ),
          throwsA(isA<ArgumentError>()),
        );

        expect(
          () => LeadCapturedEvent.validated(
            eventId: 'EVT-1',
            traceId: '   ',
            channel: ChannelType.telegram,
            senderHmac: 'hmac123',
            rawContent: 'test',
          ),
          throwsA(isA<ArgumentError>()),
        );

        expect(
          () => LeadCapturedEvent.validated(
            eventId: 'EVT-1',
            traceId: 'TRC-1',
            channel: ChannelType.telegram,
            senderHmac: '',
            rawContent: 'test',
          ),
          throwsA(isA<ArgumentError>()),
        );

        expect(
          () => LeadCapturedEvent.validated(
            eventId: 'EVT-1',
            traceId: 'TRC-1',
            channel: ChannelType.telegram,
            senderHmac: 'hmac123',
            rawContent: '  ',
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test('Sad Path (§6): Rejection of invalid channel type', () {
      expect(
        () => LeadCapturedEvent.validated(
          eventId: 'EVT-1',
          traceId: 'TRC-1',
          channel: 'unsupported_channel_xyz',
          senderHmac: 'hmac123',
          rawContent: 'valid content',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });
  });
}
