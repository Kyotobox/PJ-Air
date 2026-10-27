import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('B99 Axioma Promotion Unit Tests', () {
    test('LexicalParser classifies descriptions correctly', () {
      final LexicalParser parser = LexicalParser();
      expect(parser.classify('FILTRO ACEITE CRUZE'), equals('FILTRO'));
      expect(parser.classify('BOMBA AGUA AVEO'), equals('BOMBA'));
      expect(parser.classify('CORREA TIEMPO OPTRA'), equals('CORREA'));
      expect(parser.classify('PASTILLA FRENO DELANTERA'), equals('FRENO'));
      expect(parser.classify('DESCRIPCION DESCONOCIDA XYZ'), isNull);
    });

    test('OemCleaner cleans and validates OEM references', () {
      expect(OemCleaner.clean(' W-712/83 '), equals('W71283'));
      expect(OemCleaner.cleanWithValidation('AB'), equals(''));
      expect(OemCleaner.cleanWithValidation('ABC'), equals('ABC'));
      expect(OemCleaner.isMatch('W-712/83', 'W71283'), isTrue);
      expect(OemCleaner.isMatch('W71283', 'W71284'), isFalse);
    });

    test('CatalogLedger serializes to and from JSON', () {
      final DateTime now = DateTime.now();
      final CatalogLedger ledger = CatalogLedger(
        catalogId: 'CAT-BOSCH-V1',
        sourceName: 'bosch_2026.txt',
        providerOrBrand: 'BOSCH',
        fileHash: 'abc123hash',
        versionLabel: 'V1',
        recordsCount: 1500,
        ingestedAt: now,
      );

      final Map<String, dynamic> jsonMap = ledger.toJson();
      final CatalogLedger restored = CatalogLedger.fromJson(jsonMap);

      expect(restored.catalogId, equals('CAT-BOSCH-V1'));
      expect(restored.recordsCount, equals(1500));
      expect(restored.fileHash, equals('abc123hash'));
    });

    test('CatalogUpdateResult serializes to and from JSON', () {
      final CatalogUpdateResult result = const CatalogUpdateResult(
        catalogIdNew: 'CAT-BOSCH-V2',
        catalogIdSuperseded: 'CAT-BOSCH-V1',
        recordsMaintained: 1000,
        recordsDeprecated: 100,
        recordsAdded: 200,
        generatedAt: '2026-08-05T18:00:00.000Z',
      );

      final Map<String, dynamic> jsonMap = result.toJson();
      final CatalogUpdateResult restored = CatalogUpdateResult.fromJson(
        jsonMap,
      );

      expect(restored.catalogIdNew, equals('CAT-BOSCH-V2'));
      expect(restored.recordsAdded, equals(200));
      expect(restored.recordsDeprecated, equals(100));
    });
  });
}
