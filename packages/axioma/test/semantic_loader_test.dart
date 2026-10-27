import 'package:axioma/axioma.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:test/test.dart';

void main() {
  group('SemanticLoader Unit Tests', () {
    test('fromDb carga search_aliases, regional_aliases y taxonomyRules de DB en memoria', () {
      final Database db = sqlite3.openInMemory();
      db.execute('''
        CREATE TABLE search_aliases (
          id INTEGER PRIMARY KEY,
          alias_term TEXT NOT NULL,
          canonical_category TEXT NOT NULL,
          alias_type TEXT
        );
      ''');
      db.execute('''
        CREATE TABLE regional_aliases (
          id INTEGER PRIMARY KEY,
          raw_term TEXT NOT NULL,
          canonical_term TEXT NOT NULL,
          region TEXT,
          source TEXT
        );
      ''');
      db.execute('''
        CREATE TABLE canonical_taxonomy_matrix (
          id INTEGER PRIMARY KEY,
          raw_input TEXT NOT NULL,
          canonical_l1 TEXT NOT NULL,
          canonical_l2 TEXT NOT NULL,
          confidence REAL,
          source TEXT
        );
      ''');

      db.execute(
        "INSERT INTO search_aliases VALUES (1, 'pastilla', 'FRENO', 'SYNONYM');",
      );
      db.execute(
        "INSERT INTO regional_aliases VALUES (1, 'croche', 'EMBRAGUE', 'VE', 'LOCAL');",
      );
      db.execute(
        "INSERT INTO canonical_taxonomy_matrix VALUES (1, 'pastillas freno', 'FRENO', 'PASTILLAS', 0.95, 'RULE');",
      );

      final SemanticLoader loader = SemanticLoader.fromDb(db);

      expect(loader.searchAliases['PASTILLA'], equals('FRENO'));
      expect(loader.regionalAliases['CROCHE'], equals('EMBRAGUE'));
      expect(loader.taxonomyRules, hasLength(1));
      expect(loader.taxonomyRules.first['canonical_l1'], equals('FRENO'));

      db.close();
    });

    test('fromDb con DB vacía no arroja excepción y retorna loader con mapas vacíos', () {
      final Database db = sqlite3.openInMemory();
      final SemanticLoader loader = SemanticLoader.fromDb(db);

      expect(loader.searchAliases, isEmpty);
      expect(loader.regionalAliases, isEmpty);
      expect(loader.taxonomyRules, isEmpty);
      expect(loader.descriptionTokens, isNotEmpty); // fallback por defecto

      db.close();
    });

    test('fromSeedMeta lee description_tokens desde snapshot_meta', () {
      final Database db = sqlite3.openInMemory();
      db.execute('''
        CREATE TABLE snapshot_meta (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      ''');
      const String tokensJson = '{"category_tokens": {"CORREA": "MOTOR"}}';
      db.execute(
        "INSERT INTO snapshot_meta VALUES ('description_tokens', '$tokensJson');",
      );

      final SemanticLoader loader = SemanticLoader.fromSeedMeta(db);

      expect(loader.descriptionTokens.containsKey('category_tokens'), isTrue);
      final Map<String, dynamic> catTokens =
          loader.descriptionTokens['category_tokens'] as Map<String, dynamic>;
      expect(catTokens['CORREA'], equals('MOTOR'));

      db.close();
    });

    test('fallback() genera la instancia mínima sin error', () {
      final SemanticLoader loader = SemanticLoader.fallback();
      expect(loader.searchAliases, isEmpty);
      expect(loader.descriptionTokens['category_tokens'], isNotNull);
    });
  });
}
