/// automotive: Entry Point Granular para el Dominio Automotriz y Catálogo de Autopartes (§39, §56).
///
/// Segrega diccionarios de autopartes, fitment engines, modelos de vehículos y repuestos
/// para aislar la lógica específica de producto fuera del núcleo compartido.
library;

// Automotive Enums & Regexes
export 'src/shared/enums/automotive_enums.dart';
export 'src/shared/utils/part_domain_regex.dart';

// Fitment & Search Engines
export 'src/search/fitment_regex_engine.dart';
export 'src/search/fallback_fitment_extractor.dart';
export 'src/search/hybrid_fitment_service.dart';
export 'src/search/quarantine_service.dart';
export 'src/search/unified_fitment_cache.dart';
export 'src/search/unified_fitment_engine.dart';

// Lexical Parser & Cleaners
export 'src/parser/lexical_parser.dart';
export 'src/cleaner/oem_cleaner.dart';

// Catalog & Fitment Models
export 'src/models/catalog_ledger.dart';
export 'src/models/catalog_update_result.dart';
export 'src/models/catalog_part.dart';
export 'src/models/vehicle_entity.dart';
export 'src/models/part_category.dart';
export 'src/models/wholesaler_entity.dart';
export 'src/models/cross_fitment_dto.dart';

// Automotive Dictionaries (Segregados de los barrels transversales)
export 'src/dictionaries/brand_dictionary.dart';
export 'src/dictionaries/part_brand_dictionary.dart';
export 'src/dictionaries/taxonomy_matrix.dart';
export 'src/dictionaries/jargon_dictionary.dart';
export 'src/dictionaries/generation_matrix.dart';
export 'src/dictionaries/engine_family_dictionary.dart';
export 'src/dictionaries/model_alias_dictionary.dart';
