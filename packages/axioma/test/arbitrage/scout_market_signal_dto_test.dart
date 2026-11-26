import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

void main() {
  group('ScoutMarketSignalDTO Canonical Contract Suite (§4, §6, §39)', () {
    test(
      'Happy Path: ScoutMarketSignalDTO validado, roundtrip JSON y cálculo de spread',
      () {
        final ScoutMarketSignalDTO signal = ScoutMarketSignalDTO.validated(
          signalId: 'SIG-001',
          channel: ScoutChannel.telegram,
          sourceGroupId: 'grp-suppliers-01',
          senderHash: 'hmac-abc123',
          rawText: 'Pack UI SaaS Kit \$12 mayor',
          extractedSku: 'sku-ui-kit-01',
          productTitle: 'Pack UI SaaS Kit',
          category: 'templates',
          wholesaleCost: 12.0,
          currency: 'USD',
          confidenceScore: 0.92,
        );

        expect(signal.extractedSku, equals('SKU-UI-KIT-01'));
        expect(signal.category, equals('TEMPLATES'));
        expect(signal.channel, equals(ScoutChannel.telegram));

        final Map<String, dynamic> opp = signal.calculateArbitrageOpportunity(
          targetRetailPrice: 35.0,
        );
        expect(opp['viable'], isTrue);
        expect(opp['is_high_margin'], isTrue);
        expect((opp['margin_percent'] as num).toDouble(), greaterThan(60.0));

        final ScoutMarketSignalDTO roundtrip = ScoutMarketSignalDTO.fromJson(
          signal.toJson(),
        );
        expect(roundtrip.signalId, equals('SIG-001'));
        expect(roundtrip.wholesaleCost, equals(12.0));
      },
    );

    test(
      'Sad Path (§6): Rechaza canal inválido, costo no positivo y confianza fuera de rango',
      () {
        expect(
          () => ScoutMarketSignalDTO.validated(
            signalId: 'SIG-BAD-1',
            channel: 'irc_legacy',
            sourceGroupId: 'grp-1',
            senderHash: 'h1',
            rawText: 'oferta',
            extractedSku: 'SKU-1',
            productTitle: 'Item',
            category: 'DIGITAL',
            wholesaleCost: 10.0,
          ),
          throwsA(
            isA<ArbitrageContractException>().having(
              (ArbitrageContractException e) => e.errorCode,
              'errorCode',
              ArbitrageContractErrorCodes.invalidChannel,
            ),
          ),
        );

        expect(
          () => ScoutMarketSignalDTO.validated(
            signalId: 'SIG-BAD-2',
            channel: ScoutChannel.whatsapp,
            sourceGroupId: 'grp-1',
            senderHash: 'h1',
            rawText: 'oferta',
            extractedSku: 'SKU-1',
            productTitle: 'Item',
            category: 'DIGITAL',
            wholesaleCost: 0.0,
          ),
          throwsA(
            isA<ArbitrageContractException>().having(
              (ArbitrageContractException e) => e.errorCode,
              'errorCode',
              ArbitrageContractErrorCodes.negativePrice,
            ),
          ),
        );

        expect(
          () => ScoutMarketSignalDTO.validated(
            signalId: 'SIG-BAD-3',
            channel: ScoutChannel.discord,
            sourceGroupId: 'grp-1',
            senderHash: 'h1',
            rawText: 'oferta',
            extractedSku: 'SKU-1',
            productTitle: 'Item',
            category: 'DIGITAL',
            wholesaleCost: 10.0,
            confidenceScore: 1.5,
          ),
          throwsA(
            isA<ArbitrageContractException>().having(
              (ArbitrageContractException e) => e.errorCode,
              'errorCode',
              ArbitrageContractErrorCodes.invalidConfidenceScore,
            ),
          ),
        );
      },
    );
  });
}
