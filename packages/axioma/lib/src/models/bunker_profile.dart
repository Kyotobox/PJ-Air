/// bunker_profile.dart — Contrato Modelo de BunkerProfile y Capa Backward-Compat (§39, §43)
library;

import 'dart:convert';
import 'bunker_profile_v2.dart';

export 'bunker_profile_v2.dart';

/// Excepción de migración de perfiles legacy (§6)
class LegacyBunkerMigrationException implements Exception {
  final String message;
  final dynamic originalPayload;

  const LegacyBunkerMigrationException(this.message, {this.originalPayload});

  @override
  String toString() => 'LegacyBunkerMigrationException: $message';
}

/// Capa de compatibilidad hacia atrás para migración v0/v1 a v2 (§39, §43)
class BunkerProfileLegacyAdapter {
  /// Convierte cualquier payload de perfil v0 (sin versión) o v1 (semver 1.x) al contrato SemVer 2.0
  static BunkerProfileV2 migrateToV2(Map<String, dynamic> rawJson) {
    if (rawJson.isEmpty) {
      throw const LegacyBunkerMigrationException(
        'El payload de perfil no puede estar vacío',
      );
    }

    final dynamic rawVer = rawJson['schema_version'] ?? rawJson['version'];

    // Si ya es SemVer 2.x, parsear directamente
    if (rawVer is String && rawVer.startsWith('2.')) {
      return BunkerProfileV2.fromJson(rawJson);
    }

    // Normalizar v0 / v1
    final dynamic rawId = rawJson['bunker_id'] ?? rawJson['id'];
    if (rawId == null || rawId is! String || rawId.trim().isEmpty) {
      throw LegacyBunkerMigrationException(
        'Imposible migrar perfil legacy: carece de id o bunker_id',
        originalPayload: rawJson,
      );
    }

    final String id = rawId.trim();
    final String name = rawJson['name']?.toString() ?? id;
    final String type =
        rawJson['bunker_type']?.toString() ??
        rawJson['type']?.toString() ??
        'satellite';
    final String canonicalBranch =
        rawJson['canonical_branch']?.toString() ?? 'master';

    final List<String> capabilities = <String>[];
    if (rawJson['capabilities'] is List) {
      capabilities.addAll(
        (rawJson['capabilities'] as List<dynamic>).map(
          (dynamic e) => e.toString(),
        ),
      );
    }

    final List<String> activeGates = <String>[];
    if (rawJson['active_gates'] is List) {
      activeGates.addAll(
        (rawJson['active_gates'] as List<dynamic>).map(
          (dynamic e) => e.toString(),
        ),
      );
    }

    // Resguardar campos legados no mapeados en metadata
    final Map<String, dynamic> metadata = Map<String, dynamic>.from(rawJson);
    metadata['legacy_migrated_from'] = rawVer ?? 'v0-unversioned';

    return BunkerProfileV2(
      schemaVersion: '2.0.0',
      id: id,
      name: name,
      type: type,
      canonicalBranch: canonicalBranch,
      capabilities: capabilities,
      activeGates: activeGates,
      satelliteProtocolVersion:
          rawJson['satellite_protocol_version']?.toString() ?? '1.0.0',
      metadata: metadata,
    );
  }

  /// Deserializa string JSON aplicando auto-migración
  static BunkerProfileV2 fromJsonString(String jsonString) {
    try {
      final dynamic decoded = jsonDecode(jsonString);
      if (decoded is! Map<String, dynamic>) {
        throw const LegacyBunkerMigrationException(
          'JSON raíz debe ser un objeto',
        );
      }
      return migrateToV2(decoded);
    } on FormatException catch (e) {
      throw LegacyBunkerMigrationException('JSON malformado: ${e.message}');
    }
  }
}
