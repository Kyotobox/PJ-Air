// client_dna_contracts.dart — Contratos Inmutables Pure Dart de Cliente y Core Memory (§39, §47, §54.6, §60.2, §60.9)
library;

import 'active_commitment.dart';
import 'client_dna_models.dart';
import 'renderers/core_memory_renderer.dart';
import 'validators/commercial_guardrails.dart';
import 'validators/fact_citation_validator.dart';

export 'active_commitment.dart';
export 'client_dna_models.dart';
export 'client_slot_types.dart';
export 'renderers/core_memory_renderer.dart';

/// Perfil completo e inmutable de ADN de Cliente con proyección de memoria determinista.
class ClientDnaProfile {
  final ClientEntity entity;
  final List<ClientFact> activeFacts;
  final List<ActiveCommitment> commitments;
  final String renderedMemoryBlock;
  final DateTime generatedAt;
  final String tenantId;

  ClientDnaProfile({
    required this.entity,
    required List<ClientFact> activeFacts,
    List<ActiveCommitment>? commitments,
    String? renderedMemoryBlock,
    DateTime? generatedAt,
    String? tenantId,
  }) : activeFacts = List<ClientFact>.unmodifiable(activeFacts),
       commitments = List<ActiveCommitment>.unmodifiable(
         commitments ?? const <ActiveCommitment>[],
       ),
       tenantId = tenantId ?? entity.tenantId,
       generatedAt = generatedAt ?? DateTime.now().toUtc(),
       renderedMemoryBlock =
           renderedMemoryBlock ??
           const CoreMemoryRenderer().render(
             entity: entity,
             activeFacts: activeFacts,
             commitments: commitments,
           ) {
    if (entity.id.trim().isEmpty) {
      throw ArgumentError.value(
        entity.id,
        'entity.id',
        'El ID de la entidad de cliente no puede estar vacío.',
      );
    }
    if (this.tenantId.trim().isEmpty) {
      throw ArgumentError.value(
        this.tenantId,
        'tenantId',
        'El tenantId no puede estar vacío.',
      );
    }

    // Validación de presupuesto de memoria (<150 tokens) según §47 / §60.2
    final int estimatedTokens = CoreMemoryRenderer.estimateTokens(
      this.renderedMemoryBlock,
    );
    if (estimatedTokens > CoreMemoryRenderer.kMaxTokens) {
      throw CoreMemoryBudgetException(
        'El bloque de memoria excede el límite de tokens permitido',
        estimatedTokens: estimatedTokens,
        maxTokens: CoreMemoryRenderer.kMaxTokens,
      );
    }
  }

  /// Crea un perfil generando automáticamente el bloque de Core Memory.
  static ClientDnaProfile create({
    required ClientEntity entity,
    required List<ClientFact> facts,
    List<ActiveCommitment>? commitments,
    CoreMemoryRenderer renderer = const CoreMemoryRenderer(),
  }) {
    final String block = renderer.render(
      entity: entity,
      activeFacts: facts,
      commitments: commitments,
    );
    return ClientDnaProfile(
      entity: entity,
      activeFacts: facts,
      commitments: commitments,
      renderedMemoryBlock: block,
      generatedAt: DateTime.now().toUtc(),
      tenantId: entity.tenantId,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'entity': entity.toJson(),
    'tenant_id': tenantId,
    'active_facts': activeFacts.map((ClientFact f) => f.toJson()).toList(),
    'commitments': commitments.map((ActiveCommitment c) => c.toJson()).toList(),
    'rendered_memory_block': renderedMemoryBlock,
    'generated_at': generatedAt.toIso8601String(),
  };
}

/// Carga útil para sincronización segura y atómica de ADN de clientes entre nodos satélite (§60.2).
class ClientDnaSyncPayload {
  final String syncId;
  final String tenantId;
  final String targetNode;
  final List<ClientDnaProfile> profiles;
  final DateTime timestamp;
  final String schemaVersion;

  ClientDnaSyncPayload({
    required this.syncId,
    required this.tenantId,
    required this.targetNode,
    required List<ClientDnaProfile> profiles,
    DateTime? timestamp,
    this.schemaVersion = '1.0.0',
  }) : profiles = List<ClientDnaProfile>.unmodifiable(profiles),
       timestamp = timestamp ?? DateTime.now().toUtc() {
    if (syncId.trim().isEmpty) {
      throw ArgumentError.value(
        syncId,
        'syncId',
        'El syncId no puede estar vacío.',
      );
    }
    if (tenantId.trim().isEmpty) {
      throw ArgumentError.value(
        tenantId,
        'tenantId',
        'El tenantId no puede estar vacío.',
      );
    }
    if (targetNode.trim().isEmpty) {
      throw ArgumentError.value(
        targetNode,
        'targetNode',
        'El targetNode no puede estar vacío.',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'sync_id': syncId,
    'tenant_id': tenantId,
    'target_node': targetNode,
    'profiles_count': profiles.length,
    'profiles': profiles.map((ClientDnaProfile p) => p.toJson()).toList(),
    'timestamp': timestamp.toIso8601String(),
    'schema_version': schemaVersion,
  };

  factory ClientDnaSyncPayload.fromJson(Map<String, dynamic> json) {
    if (!json.containsKey('sync_id') || json['sync_id'] == null) {
      throw const FormatException('Falta el campo obligatorio sync_id');
    }
    if (!json.containsKey('tenant_id') || json['tenant_id'] == null) {
      throw const FormatException('Falta el campo obligatorio tenant_id');
    }
    if (!json.containsKey('target_node') || json['target_node'] == null) {
      throw const FormatException('Falta el campo obligatorio target_node');
    }

    final dynamic rawProfiles = json['profiles'];
    final List<ClientDnaProfile> parsedProfiles = <ClientDnaProfile>[];
    if (rawProfiles is List) {
      for (final dynamic item in rawProfiles) {
        if (item is Map<String, dynamic>) {
          final ClientEntity entity = ClientEntity.fromJson(
            item['entity'] as Map<String, dynamic>,
          );
          final dynamic rawFacts = item['active_facts'];
          final List<ClientFact> facts = rawFacts is List
              ? rawFacts
                    .map(
                      (dynamic f) =>
                          ClientFact.fromJson(f as Map<String, dynamic>),
                    )
                    .toList()
              : <ClientFact>[];
          final dynamic rawCommitments = item['commitments'];
          final List<ActiveCommitment> commitments = rawCommitments is List
              ? rawCommitments
                    .map(
                      (dynamic c) =>
                          ActiveCommitment.fromJson(c as Map<String, dynamic>),
                    )
                    .toList()
              : <ActiveCommitment>[];
          parsedProfiles.add(
            ClientDnaProfile(
              entity: entity,
              activeFacts: facts,
              commitments: commitments,
              renderedMemoryBlock: item['rendered_memory_block'] as String?,
              generatedAt: item['generated_at'] != null
                  ? DateTime.parse(item['generated_at'] as String)
                  : null,
              tenantId: item['tenant_id'] as String?,
            ),
          );
        }
      }
    }

    return ClientDnaSyncPayload(
      syncId: json['sync_id'] as String,
      tenantId: json['tenant_id'] as String,
      targetNode: json['target_node'] as String,
      profiles: parsedProfiles,
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'] as String)
          : null,
      schemaVersion: json['schema_version'] as String? ?? '1.0.0',
    );
  }
}

/// Validador de Pure Dart y Anti-Huérfano para Contratos de Cliente (§39, §60.2, §60.9).
class ClientDnaContractValidator {
  const ClientDnaContractValidator();

  /// Verifica la integridad de un perfil y sus hechos asociados.
  void validateProfile(ClientDnaProfile profile) {
    const FactCitationValidator citationValidator = FactCitationValidator();
    for (final ClientFact fact in profile.activeFacts) {
      citationValidator.assertValid(fact);
      CommercialGuardrails.validateFact(fact.slotType, fact.value);
    }
    final int tokens = CoreMemoryRenderer.estimateTokens(
      profile.renderedMemoryBlock,
    );
    if (tokens > CoreMemoryRenderer.kMaxTokens) {
      throw CoreMemoryBudgetException(
        'El perfil viola el presupuesto de tokens',
        estimatedTokens: tokens,
        maxTokens: CoreMemoryRenderer.kMaxTokens,
      );
    }
  }
}
