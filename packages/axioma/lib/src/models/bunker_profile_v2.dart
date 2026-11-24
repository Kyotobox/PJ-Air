/// bunker_profile_v2.dart — Contrato de Perfil de Búnker SemVer 2.0 y Negociación de Handshake (§39, §43)
library;

import 'dart:convert';

/// Excepción arrojada ante versiones incompatibles de búnker en el handshake (§6, §43)
class IncompatibleBunkerVersionException implements Exception {
  final String serverVersion;
  final String clientVersion;
  final String message;

  const IncompatibleBunkerVersionException({
    required this.serverVersion,
    required this.clientVersion,
    required this.message,
  });

  @override
  String toString() =>
      'IncompatibleBunkerVersionException: $message (Server: $serverVersion, Client: $clientVersion)';
}

/// Excepción arrojada cuando el perfil de búnker no cumple el formato SemVer 2.0
class BunkerProfileVersionException implements Exception {
  final String message;
  const BunkerProfileVersionException(this.message);

  @override
  String toString() => 'BunkerProfileVersionException: $message';
}

/// Modelo de Perfil de Búnker SemVer 2.0 canónico (§39, §43)
class BunkerProfileV2 {
  final String schemaVersion;
  final String id;
  final String name;
  final String type;
  final String canonicalBranch;
  final List<String> capabilities;
  final List<String> activeGates;
  final String satelliteProtocolVersion;
  final Map<String, dynamic> metadata;

  const BunkerProfileV2({
    this.schemaVersion = '2.0.0',
    required this.id,
    required this.name,
    required this.type,
    this.canonicalBranch = 'master',
    this.capabilities = const <String>[],
    this.activeGates = const <String>[],
    this.satelliteProtocolVersion = '1.0.0',
    this.metadata = const <String, dynamic>{},
  });

  factory BunkerProfileV2.fromJson(Map<String, dynamic> json) {
    final dynamic rawVer = json['schema_version'] ?? json['version'];
    final String version = rawVer is String && rawVer.isNotEmpty
        ? rawVer
        : '2.0.0';

    if (!version.startsWith('2.')) {
      throw BunkerProfileVersionException(
        'El perfil no cumple con la especificación SemVer 2.0 (versión detectada: $version)',
      );
    }

    final dynamic rawId = json['id'] ?? json['bunker_id'];
    if (rawId == null || rawId is! String || rawId.trim().isEmpty) {
      throw const BunkerProfileVersionException(
        'El campo id o bunker_id es mandatorio',
      );
    }

    final dynamic rawName = json['name'] ?? rawId;
    final dynamic rawType = json['type'] ?? json['bunker_type'] ?? 'satellite';
    final dynamic rawBranch = json['canonical_branch'] ?? 'master';

    final List<String> caps = (json['capabilities'] is List)
        ? (json['capabilities'] as List<dynamic>)
              .map((dynamic e) => e.toString())
              .toList()
        : <String>[];

    final List<String> gates = (json['active_gates'] is List)
        ? (json['active_gates'] as List<dynamic>)
              .map((dynamic e) => e.toString())
              .toList()
        : <String>[];

    final String satProto = json['satellite_protocol_version'] is String
        ? json['satellite_protocol_version'] as String
        : '1.0.0';

    final Map<String, dynamic> meta = json['metadata'] is Map<String, dynamic>
        ? json['metadata'] as Map<String, dynamic>
        : <String, dynamic>{};

    return BunkerProfileV2(
      schemaVersion: version,
      id: rawId.trim(),
      name: rawName.toString(),
      type: rawType.toString(),
      canonicalBranch: rawBranch.toString(),
      capabilities: caps,
      activeGates: gates,
      satelliteProtocolVersion: satProto,
      metadata: meta,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'schema_version': schemaVersion,
    'id': id,
    'name': name,
    'type': type,
    'canonical_branch': canonicalBranch,
    'capabilities': capabilities,
    'active_gates': activeGates,
    'satellite_protocol_version': satelliteProtocolVersion,
    'metadata': metadata,
  };

  /// Negocia el protocolo satelital en el Handshake (§39, §43)
  Map<String, dynamic> negotiateHandshake({
    required String clientVersion,
    required List<String> clientCapabilities,
  }) {
    final List<String> serverParts = satelliteProtocolVersion.split('.');
    final List<String> clientParts = clientVersion.split('.');

    if (serverParts.isEmpty || clientParts.isEmpty) {
      throw IncompatibleBunkerVersionException(
        serverVersion: satelliteProtocolVersion,
        clientVersion: clientVersion,
        message: 'Versión semver corrupta o vacía',
      );
    }

    // Validación de paridad de versión Major
    if (serverParts[0] != clientParts[0]) {
      throw IncompatibleBunkerVersionException(
        serverVersion: satelliteProtocolVersion,
        clientVersion: clientVersion,
        message: 'Discrepancia de Major Version en handshake satelital',
      );
    }

    // Intersección de capacidades autorizadas
    final Set<String> commonCapabilities = capabilities.toSet().intersection(
      clientCapabilities.toSet(),
    );

    return <String, dynamic>{
      'status': 'ACCEPTED',
      'negotiated_version': satelliteProtocolVersion,
      'shared_capabilities': commonCapabilities.toList(),
      'bunker_id': id,
      'canonical_branch': canonicalBranch,
    };
  }

  @override
  String toString() => jsonEncode(toJson());
}
