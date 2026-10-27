import 'dart:convert';

import 'package:sqlite3/sqlite3.dart';

/// **SemanticLoader** — Motor puro y sin estado para cargar diccionarios y
/// tokens semánticos desde cualquier base de datos SQLite con el esquema
/// del Seed Meka / Ruedas.
class SemanticLoader {
  /// Tokens de diccionarios listos para `DescriptionParser`
  final Map<String, dynamic> descriptionTokens;

  /// Map de alias de búsqueda: `alias_term.toUpperCase() -> canonical_category`
  final Map<String, String> searchAliases;

  /// Map de alias regionales: `raw_term.toUpperCase() -> canonical_term`
  final Map<String, String> regionalAliases;

  /// Lista de reglas de taxonomía canónica
  final List<Map<String, dynamic>> taxonomyRules;

  const SemanticLoader._({
    required this.descriptionTokens,
    required this.searchAliases,
    required this.regionalAliases,
    required this.taxonomyRules,
  });

  /// Carga diccionarios desde cualquier DB con el esquema completo (Universal o Seed).
  /// Lee las tablas: `search_aliases`, `regional_aliases`, `canonical_taxonomy_matrix`.
  static SemanticLoader fromDb(Database db) {
    final Map<String, String> searchAliasesMap = <String, String>{};
    final Map<String, String> regionalAliasesMap = <String, String>{};
    final List<Map<String, dynamic>> taxonomyList = <Map<String, dynamic>>[];

    try {
      final ResultSet saRs = db.select(
        'SELECT alias_term, canonical_category FROM search_aliases;',
      );
      for (final Row r in saRs) {
        final String? alias = r['alias_term'] as String?;
        final String? cat = r['canonical_category'] as String?;
        if (alias != null && cat != null && alias.isNotEmpty) {
          searchAliasesMap[alias.trim().toUpperCase()] = cat
              .trim()
              .toUpperCase();
        }
      }
    } catch (_) {
      // Ignorar si la tabla no existe
    }

    try {
      final ResultSet raRs = db.select(
        'SELECT raw_term, canonical_term FROM regional_aliases;',
      );
      for (final Row r in raRs) {
        final String? raw = r['raw_term'] as String?;
        final String? can = r['canonical_term'] as String?;
        if (raw != null && can != null && raw.isNotEmpty) {
          regionalAliasesMap[raw.trim().toUpperCase()] = can
              .trim()
              .toUpperCase();
        }
      }
    } catch (_) {
      // Ignorar si la tabla no existe
    }

    try {
      final ResultSet ctmRs = db.select(
        'SELECT raw_input, canonical_l1, canonical_l2, confidence FROM canonical_taxonomy_matrix;',
      );
      for (final Row r in ctmRs) {
        taxonomyList.add(<String, dynamic>{
          'raw_input': r['raw_input'],
          'canonical_l1': r['canonical_l1'],
          'canonical_l2': r['canonical_l2'],
          'confidence': r['confidence'],
        });
      }
    } catch (_) {
      // Ignorar si la tabla no existe
    }

    return SemanticLoader._(
      descriptionTokens: fallbackTokens(),
      searchAliases: searchAliasesMap,
      regionalAliases: regionalAliasesMap,
      taxonomyRules: taxonomyList,
    );
  }

  /// Variante optimizada para el Seed: lee `description_tokens` desde `snapshot_meta`
  /// y el resto de tablas de diccionario.
  static SemanticLoader fromSeedMeta(Database seedDb) {
    final SemanticLoader loader = fromDb(seedDb);
    Map<String, dynamic> parsedTokens = loader.descriptionTokens;

    try {
      final ResultSet metaRs = seedDb.select(
        "SELECT value FROM snapshot_meta WHERE key = 'description_tokens';",
      );
      if (metaRs.isNotEmpty) {
        final String? jsonStr = metaRs.first['value'] as String?;
        if (jsonStr != null && jsonStr.isNotEmpty) {
          final dynamic decoded = jsonDecode(jsonStr);
          if (decoded is Map<String, dynamic>) {
            parsedTokens = decoded;
          }
        }
      }
    } catch (_) {
      // Fallback a tokens por defecto en caso de error o ausencia
    }

    return SemanticLoader._(
      descriptionTokens: parsedTokens,
      searchAliases: loader.searchAliases,
      regionalAliases: loader.regionalAliases,
      taxonomyRules: loader.taxonomyRules,
    );
  }

  /// Bootstrap mínimo para entornos sin DB o tests unitarios puros.
  static SemanticLoader fallback() {
    return SemanticLoader._(
      descriptionTokens: fallbackTokens(),
      searchAliases: const <String, String>{},
      regionalAliases: const <String, String>{},
      taxonomyRules: const <Map<String, dynamic>>[],
    );
  }

  /// Tokens de fallback mínimos si no se provee un JSON externo.
  static Map<String, dynamic> fallbackTokens() {
    return <String, dynamic>{
      'category_tokens': <String, String>{
        'PASTILLA': 'FRENO',
        'PASTILLAS': 'FRENO',
        'DISCO': 'FRENO',
        'AMORTIGUADOR': 'AMORTIGUADOR',
        'FILTRO': 'FILTRO',
        'BOMBA': 'BOMBA',
      },
      'position_tokens': <String, String>{
        'DELANTERO': 'FRONT',
        'DELANTERA': 'FRONT',
        'TRASERO': 'REAR',
        'TRASERA': 'REAR',
        'IZQUIERDO': 'LEFT',
        'DERECHO': 'RIGHT',
      },
    };
  }
}
