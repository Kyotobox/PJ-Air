// client_dna_models.dart — DTOs Inmutables Pure Dart para Hechos y Entidades de Clientes (§39, §47, §54.6, §60.2)
library;

import 'client_slot_types.dart';

/// Hecho bitemporal y epistémico asociado a una entidad de cliente.
class ClientFact {
  final String id;
  final String clientId;
  final ClientSlotType slotType;
  final dynamic value;
  final EpistemicStatus epistemicStatus;
  final double confidence;
  final String? sourceCitation;
  final DateTime validFrom;
  final DateTime? validTo;
  final DateTime ingestedAt;
  final bool isInvalidated;
  final Map<String, dynamic> metadata;

  ClientFact({
    required this.id,
    required this.clientId,
    required this.slotType,
    required this.value,
    this.epistemicStatus = EpistemicStatus.confirmed,
    this.confidence = 1.0,
    this.sourceCitation,
    DateTime? validFrom,
    this.validTo,
    DateTime? ingestedAt,
    this.isInvalidated = false,
    Map<String, dynamic>? metadata,
  }) : validFrom = validFrom ?? DateTime.now().toUtc(),
       ingestedAt = ingestedAt ?? DateTime.now().toUtc(),
       metadata = Map<String, dynamic>.unmodifiable(
         metadata ?? <String, dynamic>{},
       ) {
    if (id.trim().isEmpty) {
      throw ArgumentError.value(
        id,
        'id',
        'El ID del hecho no puede estar vacío.',
      );
    }
    if (clientId.trim().isEmpty) {
      throw ArgumentError.value(
        clientId,
        'clientId',
        'El clientId no puede estar vacío.',
      );
    }
    if (confidence < 0.0 || confidence > 1.0) {
      throw ArgumentError.value(
        confidence,
        'confidence',
        'El nivel de confianza debe estar en el rango [0.0, 1.0].',
      );
    }
    // Guardrail §47 / §54.6: Hechos CONFIRMADOS deben poseer cita observable
    if (epistemicStatus == EpistemicStatus.confirmed) {
      if (sourceCitation == null || sourceCitation!.trim().isEmpty) {
        throw StateError(
          'Guardrail de Verdad Atómica (§47): Todo hecho CONFIRMADO exige sourceCitation verificable.',
        );
      }
    }
    // Validación de integridad del valor del slot
    slotType.validateValue(value);
  }

  /// Verifica si el hecho está vigente en un instante temporal dado.
  bool isActiveAt(DateTime instant) {
    if (isInvalidated) return false;
    final bool afterStart =
        validFrom.isBefore(instant) || validFrom.isAtSameMomentAs(instant);
    final bool beforeEnd = validTo == null || validTo!.isAfter(instant);
    return afterStart && beforeEnd;
  }

  /// Invalida este hecho bitemporalmente en un instante determinado.
  ClientFact invalidate(DateTime atInstant, {String? reason}) {
    final Map<String, dynamic> newMeta = Map<String, dynamic>.from(metadata);
    if (reason != null && reason.trim().isNotEmpty) {
      newMeta['invalidation_reason'] = reason.trim();
    }
    return ClientFact(
      id: id,
      clientId: clientId,
      slotType: slotType,
      value: value,
      epistemicStatus: epistemicStatus,
      confidence: confidence,
      sourceCitation: sourceCitation,
      validFrom: validFrom,
      validTo: atInstant,
      ingestedAt: ingestedAt,
      isInvalidated: true,
      metadata: newMeta,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'client_id': clientId,
    'slot_type': slotType.wireName,
    'value': value,
    'epistemic_status': epistemicStatus.wireName,
    'confidence': confidence,
    'source_citation': sourceCitation,
    'valid_from': validFrom.toIso8601String(),
    'valid_to': validTo?.toIso8601String(),
    'ingested_at': ingestedAt.toIso8601String(),
    'is_invalidated': isInvalidated,
    'metadata': metadata,
  };

  factory ClientFact.fromJson(Map<String, dynamic> json) {
    final String slotRaw = json['slot_type'] as String? ?? '';
    final String epistemicRaw =
        json['epistemic_status'] as String? ?? 'CONFIRMADO';
    return ClientFact(
      id: json['id'] as String? ?? '',
      clientId: json['client_id'] as String? ?? '',
      slotType: ClientSlotType.fromString(slotRaw),
      value: json['value'],
      epistemicStatus: EpistemicStatus.fromString(epistemicRaw),
      confidence: (json['confidence'] as num?)?.toDouble() ?? 1.0,
      sourceCitation: json['source_citation'] as String?,
      validFrom: json['valid_from'] != null
          ? DateTime.parse(json['valid_from'] as String)
          : null,
      validTo: json['valid_to'] != null
          ? DateTime.parse(json['valid_to'] as String)
          : null,
      ingestedAt: json['ingested_at'] != null
          ? DateTime.parse(json['ingested_at'] as String)
          : null,
      isInvalidated: json['is_invalidated'] as bool? ?? false,
      metadata: json['metadata'] != null
          ? Map<String, dynamic>.from(json['metadata'] as Map<Object?, Object?>)
          : null,
    );
  }
}

/// Entidad unificada de cliente (B2B o B2C) con resolución multicanal.
class ClientEntity {
  final String id;
  final String tenantId;
  final ClientType clientType;
  final List<String> aliases;
  final String primaryName;
  final DateTime createdAt;
  final DateTime updatedAt;
  final Map<String, dynamic> metadata;

  ClientEntity({
    required this.id,
    this.tenantId = 'default',
    this.clientType = ClientType.b2b,
    List<String>? aliases,
    required this.primaryName,
    DateTime? createdAt,
    DateTime? updatedAt,
    Map<String, dynamic>? metadata,
  }) : aliases = List<String>.unmodifiable(
         (aliases ?? <String>[])
             .map((String s) => s.trim())
             .where((String s) => s.isNotEmpty)
             .toSet()
             .toList(),
       ),
       createdAt = createdAt ?? DateTime.now().toUtc(),
       updatedAt = updatedAt ?? DateTime.now().toUtc(),
       metadata = Map<String, dynamic>.unmodifiable(
         metadata ?? <String, dynamic>{},
       ) {
    if (id.trim().isEmpty) {
      throw ArgumentError.value(
        id,
        'id',
        'El ID de la entidad cliente no puede estar vacío.',
      );
    }
    if (tenantId.trim().isEmpty) {
      throw ArgumentError.value(
        tenantId,
        'tenantId',
        'El tenantId no puede estar vacío.',
      );
    }
    if (primaryName.trim().isEmpty) {
      throw ArgumentError.value(
        primaryName,
        'primaryName',
        'El nombre principal no puede estar vacío.',
      );
    }
  }

  /// Verifica si el cliente posee un alias multicanal dado.
  bool hasAlias(String alias) {
    final String clean = alias.trim().toLowerCase();
    return aliases.any((String a) => a.toLowerCase() == clean);
  }

  /// Retorna una copia con un nuevo alias agregado.
  ClientEntity withAlias(String newAlias) {
    final String clean = newAlias.trim();
    if (clean.isEmpty) {
      throw ArgumentError.value(
        newAlias,
        'newAlias',
        'El alias no puede estar vacío.',
      );
    }
    if (hasAlias(clean)) return this;
    final List<String> updated = List<String>.from(aliases)..add(clean);
    return ClientEntity(
      id: id,
      tenantId: tenantId,
      clientType: clientType,
      aliases: updated,
      primaryName: primaryName,
      createdAt: createdAt,
      updatedAt: DateTime.now().toUtc(),
      metadata: metadata,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'tenant_id': tenantId,
    'client_type': clientType.wireName,
    'aliases': aliases,
    'primary_name': primaryName,
    'created_at': createdAt.toIso8601String(),
    'updated_at': updatedAt.toIso8601String(),
    'metadata': metadata,
  };

  factory ClientEntity.fromJson(Map<String, dynamic> json) {
    final String typeRaw = json['client_type'] as String? ?? 'B2B';
    return ClientEntity(
      id: json['id'] as String? ?? '',
      tenantId: json['tenant_id'] as String? ?? 'default',
      clientType: ClientType.fromString(typeRaw),
      aliases: (json['aliases'] as List<dynamic>?)
          ?.map((dynamic e) => e.toString())
          .toList(),
      primaryName: json['primary_name'] as String? ?? '',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
      metadata: json['metadata'] != null
          ? Map<String, dynamic>.from(json['metadata'] as Map<Object?, Object?>)
          : null,
    );
  }
}
