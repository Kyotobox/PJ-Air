/// ontological_scope_gate.dart — Compuerta Mecánica de Alcance Ontológico (§12.b, §39, §60.1, §60.8, §62).
///
/// Implementa la doctrina de Autonomía Delimitada por Contrato (ADLC) en Pure Dart:
/// 1. Confinamiento ontológico de satélites de producto (prohibición de intromisión en infraestructura/servidores/gobernanza).
/// 2. Confinamiento ontológico de gobernanza/Hub (prohibición de sobrealcance en UI y lógica directa de producto).
/// 3. Validación de integridad de perfiles y manifiestos de flota.
/// 4. Mapeo determinista de códigos de salida (Exit Code 42 para Scope Violation, 43 para Governance Overreach, 55 para Manifest Integrity).
library;

/// Excepción base de alcance ontológico.
abstract class OntologicalScopeException implements Exception {
  final String message;
  final int exitCode;
  final String? originNodeId;
  final String? targetNodeId;
  final List<String> violations;

  const OntologicalScopeException(
    this.message, {
    required this.exitCode,
    this.originNodeId,
    this.targetNodeId,
    this.violations = const <String>[],
  });

  @override
  String toString() =>
      '$runtimeType(exitCode: $exitCode): $message ${violations.isNotEmpty ? "(Violaciones: ${violations.join(', ')})" : ""}';
}

/// Excepción arrojada cuando un satélite de producto intenta intrometerse en infraestructura,
/// servidores o modificar recursos de otros nodos (§60.8, §62).
class ScopeViolationException extends OntologicalScopeException {
  const ScopeViolationException(
    super.message, {
    super.exitCode = 42,
    super.originNodeId,
    super.targetNodeId,
    super.violations,
  });
}

/// Excepción arrojada cuando un nodo de gobernanza/hub sobrepasa sus límites ontológicos
/// intentando inyectar código directo de UI o de negocio de satélites sin delegación (§40, §62).
class GovernanceOverreachException extends OntologicalScopeException {
  const GovernanceOverreachException(
    super.message, {
    super.exitCode = 43,
    super.originNodeId,
    super.targetNodeId,
    super.violations,
  });
}

/// Excepción arrojada cuando el perfil de búnker o el manifiesto de flota carece de integridad,
/// está malformado o no reconoce el rol ontológico del nodo (§54.7, §62).
class ManifestIntegrityException extends OntologicalScopeException {
  const ManifestIntegrityException(
    super.message, {
    super.exitCode = 55,
    super.originNodeId,
    super.targetNodeId,
    super.violations,
  });
}

/// Resultado estructurado e inmutable de la evaluación ontológica de alcance.
class OntologicalScopeResult {
  final bool isApproved;
  final int exitCode;
  final String originNodeId;
  final String originBunkerType;
  final String? targetNodeId;
  final List<String> targetFiles;
  final List<String> violations;
  final List<String> reasons;
  final DateTime timestamp;

  const OntologicalScopeResult({
    required this.isApproved,
    required this.exitCode,
    required this.originNodeId,
    required this.originBunkerType,
    this.targetNodeId,
    this.targetFiles = const <String>[],
    this.violations = const <String>[],
    this.reasons = const <String>[],
    required this.timestamp,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'is_approved': isApproved,
    'exit_code': exitCode,
    'origin_node_id': originNodeId,
    'origin_bunker_type': originBunkerType,
    if (targetNodeId != null) 'target_node_id': targetNodeId,
    'target_files': targetFiles,
    'violations': violations,
    'reasons': reasons,
    'timestamp': timestamp.toIso8601String(),
  };

  @override
  String toString() =>
      '[ONTOLOGICAL-SCOPE-RESULT] Node: $originNodeId ($originBunkerType) | Approved: $isApproved | ExitCode: $exitCode | Violations: ${violations.length}';
}

/// Compuerta de Alcance Ontológico Pure Dart (ADLC) (§39, §62).
class OntologicalScopeGate {
  OntologicalScopeGate._();

  /// Tipos canónicos válidos de búnker en la taxonomía federada.
  static const Set<String> validBunkerTypes = <String>{
    'hub',
    'kernel',
    'satellite',
    'orchestrator',
    'control_plane',
  };

  /// Prefijos de rutas de infraestructura y control vedadas para nodos satélite de producto.
  static const List<String> satelliteRestrictedPathPrefixes = <String>[
    'services/',
    'tools/infra/',
    'vault/fleet.json',
    'packages/axioma/lib/src/governance/',
    'bin/logix',
  ];

  /// Prefijos de rutas de UI/negocio vedadas para el Hub de Gobernanza (Thin Client y Pure Dart Core) (§39, §40).
  static const List<String> governanceRestrictedUiPrefixes = <String>[
    'ui/',
    'frontend/',
    'widgets/',
    'screens/',
  ];

  /// Normaliza una ruta relativa de archivo para comparaciones deterministas multi-OS.
  static String normalizePath(String rawPath) {
    String norm = rawPath.replaceAll('\\', '/').trim();
    if (norm.startsWith('./')) {
      norm = norm.substring(2);
    }
    return norm;
  }

  /// Evalúa la admisibilidad ontológica de una acción, ticket o mutación de archivos.
  ///
  /// Arroja una excepción tipada si [throwOnError] es true.
  static OntologicalScopeResult evaluate({
    required String originNodeId,
    required String originBunkerType,
    String? targetNodeId,
    List<String> targetFiles = const <String>[],
    bool throwOnError = true,
  }) {
    final DateTime now = DateTime.now().toUtc();
    final String cleanOriginType = originBunkerType.trim().toLowerCase();
    final String cleanOriginNode = originNodeId.trim();
    final List<String> violations = <String>[];
    final List<String> reasons = <String>[];

    // 1. Integridad de Manifiesto / Perfil de Búnker
    if (cleanOriginType.isEmpty ||
        !validBunkerTypes.contains(cleanOriginType)) {
      final String msg =
          'Tipo de búnker inválido o corrupto: "$originBunkerType". Tipos admitidos: ${validBunkerTypes.join(', ')}';
      violations.add(msg);
      if (throwOnError) {
        throw ManifestIntegrityException(
          msg,
          originNodeId: cleanOriginNode,
          targetNodeId: targetNodeId,
          violations: violations,
        );
      }
      return OntologicalScopeResult(
        isApproved: false,
        exitCode: 55,
        originNodeId: cleanOriginNode,
        originBunkerType: originBunkerType,
        targetNodeId: targetNodeId,
        targetFiles: targetFiles,
        violations: violations,
        reasons: <String>[msg],
        timestamp: now,
      );
    }

    if (cleanOriginNode.isEmpty) {
      final String msg = 'Identificador de nodo de origen vacío o no definido.';
      violations.add(msg);
      if (throwOnError) {
        throw ManifestIntegrityException(
          msg,
          originNodeId: cleanOriginNode,
          targetNodeId: targetNodeId,
          violations: violations,
        );
      }
      return OntologicalScopeResult(
        isApproved: false,
        exitCode: 55,
        originNodeId: cleanOriginNode,
        originBunkerType: originBunkerType,
        targetNodeId: targetNodeId,
        targetFiles: targetFiles,
        violations: violations,
        reasons: <String>[msg],
        timestamp: now,
      );
    }

    final bool isSatellite = cleanOriginType == 'satellite';
    final bool isHub = cleanOriginType == 'hub' || cleanOriginType == 'kernel';

    // 2. Confinamiento de Satélites de Producto
    if (isSatellite) {
      // (a) Intromisión Cross-Node en Tickets/Tareas
      if (targetNodeId != null &&
          targetNodeId.trim().isNotEmpty &&
          targetNodeId.trim().toLowerCase() != cleanOriginNode.toLowerCase()) {
        final String msg =
            'Violación de Perímetro Sónico (§60.8, §62): El satélite "$cleanOriginNode" no tiene autorización ontológica para crear o modificar tickets en el nodo "$targetNodeId".';
        violations.add(msg);
      }

      // (b) Intromisión en Rutas de Infraestructura / Servidores
      for (final String file in targetFiles) {
        final String norm = normalizePath(file);
        for (final String restricted in satelliteRestrictedPathPrefixes) {
          if (norm.startsWith(restricted) || norm == restricted) {
            final String msg =
                'Intromisión de Infraestructura Prohibida (§62): El satélite "$cleanOriginNode" no puede modificar "$norm" (área reservada a infraestructura/gobernanza).';
            violations.add(msg);
            break;
          }
        }
      }

      // (c) Prohibición de escritura directa en bases de datos ajenas (§60.8)
      for (final String file in targetFiles) {
        final String norm = normalizePath(file).toLowerCase();
        if (norm.endsWith('.db') ||
            norm.endsWith('.sqlite') ||
            norm.endsWith('.sqlite3')) {
          final String msg =
              'Violación de Perímetro Sónico de Datos (§60.8, §62): Prohibida la escritura directa en base de datos ajena "$norm". Todo acceso inter-nodo debe canalizarse mediante ContextPassport y Synapse.';
          violations.add(msg);
          break;
        }
      }

      if (violations.isNotEmpty) {
        if (throwOnError) {
          throw ScopeViolationException(
            'Compuerta Ontológica de Alcance violada por el satélite "$cleanOriginNode".',
            originNodeId: cleanOriginNode,
            targetNodeId: targetNodeId,
            violations: violations,
          );
        }
        return OntologicalScopeResult(
          isApproved: false,
          exitCode: 42,
          originNodeId: cleanOriginNode,
          originBunkerType: originBunkerType,
          targetNodeId: targetNodeId,
          targetFiles: targetFiles,
          violations: violations,
          reasons: violations,
          timestamp: now,
        );
      }
    }

    // 3. Confinamiento de Hub de Gobernanza (Anti-Overreach)
    if (isHub) {
      if (targetNodeId != null &&
          targetNodeId.trim().isNotEmpty &&
          targetNodeId.trim().toLowerCase() != cleanOriginNode.toLowerCase()) {
        for (final String file in targetFiles) {
          final String norm = normalizePath(file);
          for (final String uiPrefix in governanceRestrictedUiPrefixes) {
            if (norm.contains('/$uiPrefix') || norm.startsWith(uiPrefix)) {
              final String msg =
                  'Extralimitación de Gobernanza (§40, §62): El Hub "$cleanOriginNode" no puede inyectar código de interfaz en "$norm" para el nodo satélite "$targetNodeId".';
              violations.add(msg);
              break;
            }
          }
        }
      }

      if (violations.isNotEmpty) {
        if (throwOnError) {
          throw GovernanceOverreachException(
            'Extralimitación de Gobernanza (Overreach) detectada en "$cleanOriginNode".',
            originNodeId: cleanOriginNode,
            targetNodeId: targetNodeId,
            violations: violations,
          );
        }
        return OntologicalScopeResult(
          isApproved: false,
          exitCode: 43,
          originNodeId: cleanOriginNode,
          originBunkerType: originBunkerType,
          targetNodeId: targetNodeId,
          targetFiles: targetFiles,
          violations: violations,
          reasons: violations,
          timestamp: now,
        );
      }
    }

    reasons.add(
      'Acción conforme con la doctrina de Autonomía Delimitada por Contrato (§62).',
    );
    return OntologicalScopeResult(
      isApproved: true,
      exitCode: 0,
      originNodeId: cleanOriginNode,
      originBunkerType: originBunkerType,
      targetNodeId: targetNodeId,
      targetFiles: targetFiles,
      violations: const <String>[],
      reasons: reasons,
      timestamp: now,
    );
  }
}
