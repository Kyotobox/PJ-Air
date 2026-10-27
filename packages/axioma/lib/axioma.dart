/// axioma: Núcleo de ADN Axioma (Shared Kernel)
///
/// Fuente Única de Verdad (SSSoT) para los modelos, enums e interfaces
/// transversales del ecosistema Antigravity y el fundamento de la arquitectura Axioma.
library;

// Enums
export 'src/shared/enums/automotive_enums.dart';
export 'src/shared/enums/asset_enums.dart';
export 'src/shared/enums/cash_enums.dart';
export 'src/shared/enums/catalog_enums.dart';
export 'src/shared/utils/forensic_utils.dart';

// Models
export 'src/axiom_version.dart';
export 'src/shared/models/signature_model.dart';
export 'src/shared/models/nexus_state.dart';

// Interfaces
export 'src/interfaces/atomic_contract.dart';
export 'src/interfaces/product_essence.dart';
export 'src/interfaces/user_identity_essence.dart';
export 'src/interfaces/i_canonical_matcher.dart';

// New Axioms & Engines
export 'src/shared/utils/part_domain_regex.dart';
export 'src/search/fitment_regex_engine.dart';
export 'src/search/fallback_fitment_extractor.dart';
export 'src/search/hybrid_fitment_service.dart';

// Promoción Sprint B99
export 'src/parser/lexical_parser.dart';
export 'src/cleaner/oem_cleaner.dart';
export 'src/models/catalog_ledger.dart';
export 'src/models/catalog_update_result.dart';

// Dictionaries
export 'src/dictionaries/brand_dictionary.dart';
export 'src/dictionaries/part_brand_dictionary.dart';
export 'src/dictionaries/taxonomy_matrix.dart';
export 'src/dictionaries/jargon_dictionary.dart';
export 'src/dictionaries/generation_matrix.dart';
export 'src/dictionaries/engine_family_dictionary.dart';
export 'src/dictionaries/model_alias_dictionary.dart';

// Automotive Models (Promoted Phase 1 & 2)
export 'src/models/catalog_part.dart';
export 'src/models/vehicle_entity.dart';
export 'src/models/part_category.dart';
export 'src/models/wholesaler_entity.dart';
export 'src/models/cross_fitment_dto.dart';

// Ingestion Promoted Models (TASK-G142-02)

// Promoción Sprint B118
export 'src/semantic/semantic_loader.dart';

// Testing Infrastructure (TASK-G173-03)
export 'src/testing/test_database_factory.dart';

// LLM Infrastructure (TASK-G188-02)
export 'src/shared/key_pool_base.dart';
export 'src/shared/gemini_key_pool.dart';

// Satellite Dispatch & Dynamic Batching (TASK-G196-01)
export 'src/factory/dynamic_task_batcher.dart';

// Fleet Design Tokens (TASK-G202-01)
export 'src/tokens/tokens.dart';

// Cryptographic Moat & PTG-Token (TASK-G205-01 / TASK-G205-02)
export 'src/crypto/ptg_token_verifier.dart';
export 'src/shared/claude_key_pool.dart';

// 529 Resilience & Global Circuit Breaker (TASK-G205-03)
export 'src/shared/global_circuit_breaker.dart';
export 'src/shared/resource_guard.dart';
export 'src/shared/isolate_throttle.dart';

// Process Performance Models - CMMI Nivel 5 (TASK-G220-01)
export 'src/spc/ppm_prediction_engine.dart';

// CAR Ast Variance Stabilizer - CMMI Nivel 5 (TASK-G220-02)
export 'src/car/ast_variance_stabilizer.dart';

// CAR Quarantine Lifecycle Evaluator - CMMI Nivel 5 (TASK-G220-05)
export 'src/car/quarantine_lifecycle_evaluator.dart';
export 'src/car/ast_signature_extractor.dart';
export 'src/car/car_engine.dart';

// Canonical Fleet Governance & Catalog Extensions (§8)
export 'src/search/quarantine_service.dart';
export 'src/search/unified_fitment_cache.dart';
export 'src/search/unified_fitment_engine.dart';
export 'src/schema/control_registry.dart';
export 'src/test_axiom.dart';

// Neural AST Vectorization & RepoMap (TASK-NEURAL-01, TASK-N3-02)
export 'src/neural/ast_feature_extractor.dart';
export 'src/neural/repomap_generator.dart';

// Static Analysis & Product Leak Prevention (§1, §2, §39, §47)
export 'src/analysis/product_leak_linter.dart';
