/// axioma: Núcleo de ADN Axioma (Shared Kernel)
///
/// Fuente Única de Verdad (SSSoT) para los modelos, enums e interfaces
/// transversales del ecosistema Antigravity y el fundamento de la arquitectura Axioma.
@Deprecated(
  'Import granular thematic entry points instead: package:axioma/messaging.dart, '
  'package:axioma/geo.dart, package:axioma/render.dart, package:axioma/flow.dart, '
  'or package:axioma/automotive.dart. '
  'The monolithic axioma.dart barrel is scheduled for retirement in Sprint N106 (§39, §48).',
)
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
export 'src/parser/fast_xlsx_reader.dart';
export 'src/parser/schema_mapping_bridge.dart';
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

// Storage & Testing Infrastructure (TASK-N147-03)
export 'src/storage/test_database_factory.dart';

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
export 'src/schema/data_contract.dart';
export 'src/schema/data_dictionary.dart'
    hide CurrencyScaleGuard, ScaleValidationResult, CurrencyScaleException;
export 'src/schema/currency_scale_guard.dart';
export 'src/schema/llm_pool_contract.dart';
export 'src/schema/commercial_contracts.dart';
export 'src/test_axiom.dart';

// Neural AST Vectorization & RepoMap (TASK-NEURAL-01, TASK-N3-02)
export 'src/neural/ast_feature_extractor.dart';
export 'src/neural/repomap_generator.dart';

// Static Analysis & Product Leak Prevention (§1, §2, §39, §47)
export 'src/analysis/product_leak_linter.dart';

// Transversal Connectors & Official Rate Services (§39, §45, §47)
export 'src/services/bcv_rate_service.dart';
export 'src/services/database_path_resolver.dart';

// Fleet Council & Cognitive Cascade Services (§39, §45, §47, TASK-N30-03)
export 'src/services/fleet_council_client.dart';

// Geo Domain Axioms (Sprint N32 - Pure Dart)
export 'src/geo/geo_point.dart';
export 'src/geo/bounding_box.dart';
export 'src/geo/haversine_calculator.dart';
export 'src/geo/address_normalizer.dart';
export 'src/geo/google_maps_url_builder.dart';

// Messaging Domain Axioms & Channels (Sprint N32 / N103 - Pure Dart)
export 'src/messaging/whatsapp_models.dart';
export 'src/messaging/phone_sanitizer.dart';
export 'src/messaging/telegram_models.dart';
export 'src/messaging/discord_models.dart';
export 'src/messaging/omnichannel_envelope.dart';
export 'src/messaging/turn0_intent_router.dart';
export 'src/messaging/intent_signature.dart';
export 'src/messaging/adapters/whatsapp_envelope_adapter.dart';
export 'src/messaging/adapters/telegram_envelope_adapter.dart';
export 'src/messaging/adapters/discord_envelope_adapter.dart';

// Webhook Security & HMAC Verification (Sprint N32 / N103 - Pure Dart)
export 'src/crypto/webhook_hmac_verifier.dart';
export 'src/security/security_exceptions.dart';
export 'src/security/webhook_signature_validator.dart';
export 'src/security/prompt_sanitizer.dart';

// Multi-OS Parity & Platform Guard (Sprint G1 - Pure Dart, Art. Multi-OS)
export 'src/platform_guard.dart';

// Governance & Anti-Rebound Lifecycle Gate (§4, §6, §39, §50, §62)
export 'src/governance/sprint_sequence_validator.dart';
export 'src/governance/takeover_rebound_gate.dart';
export 'src/governance/upstream_pointer.dart';
export 'src/governance/bunker_skill_filter.dart';
export 'src/governance/atomic_task_bifurcator.dart';
export 'src/governance/governance_reconciler.dart';
export 'src/governance/deferred_trigger.dart';
export 'src/governance/ontological_scope_gate.dart';
export 'src/governance/cross_node_policy_gate.dart';
export 'src/governance/backlog_validator.dart';
export 'src/governance/validation_codes.dart';
export 'src/governance/ast_validator.dart';

// Incremental Render & Content-Addressable Storage (CAS) Contracts (Sprint N54, §39)
export 'src/render/incremental_render_spec.dart';
export 'src/render/cas_storage_engine.dart';
export 'src/render/fast_splice_engine.dart';
export 'src/render/incremental_render_canary.dart';
export 'src/render/studio_render_contract.dart';
export 'src/render/creative_render_job_dto.dart';

// Adaptive User Signal & CAR Linter Synthesis (Sprint N54, §39, §46)
export 'src/car/user_signal_car_connector.dart';

// Canonical Tactical Directives (Sprint N89 - Pure Dart, TASK-N89-01, §4, §6, §39)
export 'src/contracts/tactical_directive.dart';
export 'src/contracts/directive_acknowledgement.dart';
export 'src/contracts/merchant_onboarding_dto.dart';

// Levita Autonomous Commerce & Messaging Contracts (§39)
export 'src/messaging/broadcast_campaign_dto.dart';
export 'src/messaging/whatsapp_offer_dto.dart';

// UI Contracts, Defensive State Machine & Semantic Tokens (Sprint N91 / N94, §8, §39, TASK-N94-01)
export 'src/ui/action_lock.dart';
export 'src/ui/contrast_calculator.dart';
export 'src/ui/semantic_tokens.dart';
export 'src/ui/ui_exceptions.dart';
export 'src/ui/ui_state_machine.dart';
export 'src/ui/viewport_test_runner.dart';

// Pure FSM Engine & Socratic Gentle Exit Policy (TASK-N104-04 / TASK-N104-05, §39)
export 'src/flow/flow_engine.dart';
export 'src/flow/flow_state.dart';
export 'src/flow/flow_violations.dart';

// Absorbed Shared Kernel Utilities (§39, §52, TASK-N126-03)
export 'council.dart';
export 'src/contracts/creative_studio_contracts.dart';
export 'src/arbitrage/arbitrage_contracts.dart' hide WhatsAppOfferDTO;
export 'src/arbitrage/studio_offer_bridge.dart';

// Counterweight Gate & Anti-Sycophancy Governance (Sprint N152, §39, §46, §47, §61.2, §63)
export 'src/governance/governance_exceptions.dart';
export 'src/governance/directive_classifier.dart';
export 'src/governance/counterweight_gate.dart';

// Canonical Synapse Primitive, ContextPassport & Topology Validators (Sprint N153, §39, §60.8)
export 'synapse.dart';
export 'src/validators/fleet_topo.dart';
export 'src/validators/synapse_health_check.dart';
export 'src/protocol/uds_connector_transport.dart';
export 'src/protocol/cross_node_exceptions.dart';

// Rules Budget & Modular Governance Gate (Sprint N169, §4, §6, §39, §50, §55)
export 'src/governance/rules_budget_validator.dart';

// Fleet Mechanical Vaccine Models & Deterministic AST Scanner (Sprint N172, §4, §6, §39, §58, §60.7)
export 'src/governance/satellite_vaccine_models.dart';
