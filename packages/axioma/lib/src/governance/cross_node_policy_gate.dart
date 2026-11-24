/// cross_node_policy_gate.dart — Compuerta Pure Dart de Observabilidad Cross-Node (§2, §39, §60.8, §62).
///
/// Valida mecánicamente la política `vault/intel/CROSS_NODE_READ_POLICY.md`:
/// 1. Bloquea lectura de secretos (`DENY_LIST`) con Exit Code 42.
/// 2. Restringe lectura cross-node a nodos ACTIVE/DORMANT registrados en `vault/fleet.json` (Exit Code 55).
/// 3. Impide escaneo libre de `~/.gemini/antigravity-*/brain/` y exige vínculo 1:1 con `.meta/session.relay` (Exit Code 43).
library;

import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as p;

/// Excepción base de política cross-node (§2, §60.8).
abstract class CrossNodePolicyException implements Exception {
  final String path;
  final int exitCode;
  final String message;

  const CrossNodePolicyException({
    required this.path,
    required this.exitCode,
    required this.message,
  });

  @override
  String toString() =>
      '$runtimeType(exitCode: $exitCode, path: $path): $message';
}

/// Excepción arrojada cuando el nodo destino no está en `vault/fleet.json` o es `LEGACY_EXCLUDED` (Exit Code 55).
class NodeNotInFleetException extends CrossNodePolicyException {
  const NodeNotInFleetException({required super.path, required super.message})
    : super(exitCode: 55);
}

/// Excepción arrojada ante intento de lectura de secretos en la `DENY_LIST` (Exit Code 42).
class SecretLeakViolationException extends CrossNodePolicyException {
  const SecretLeakViolationException({
    required super.path,
    required super.message,
  }) : super(exitCode: 42);
}

/// Excepción arrojada ante escaneo libre o no vinculado de sesiones `brain/` (Exit Code 43).
class BrainSessionContaminationException extends CrossNodePolicyException {
  const BrainSessionContaminationException({
    required super.path,
    required super.message,
  }) : super(exitCode: 43);
}

/// Descriptor mínimo de nodo cargado desde `vault/fleet.json`.
class FleetNodeDescriptor {
  final String id;
  final String pathTemplate;
  final String status;

  const FleetNodeDescriptor({
    required this.id,
    required this.pathTemplate,
    required this.status,
  });

  bool get isReadableStatus {
    final String upper = status.trim().toUpperCase();
    return upper == 'ACTIVE' || upper == 'DORMANT';
  }
}

/// Compuerta mecánica de lectura segura entre Hub y satélites (§2, §60.8).
class CrossNodePolicyGate {
  static const List<String> deniedExactBasenames = <String>[
    '.env',
    'portal_auth.json',
    'portal_session_secret.key',
  ];

  static const List<String> deniedExtensions = <String>['.key', '.pem'];

  CrossNodePolicyGate._();

  static String _norm(String rawPath) =>
      p.canonicalize(rawPath).replaceAll('\\', '/');

  /// Verifica si la ruta apunta a un secreto prohibido por la `DENY_LIST`.
  static void assertNotSecret(String targetPath) {
    final String norm = targetPath.replaceAll('\\', '/').trim();
    final String base = p.basename(norm).toLowerCase();

    if (deniedExactBasenames.contains(base) || base.startsWith('.env.')) {
      throw SecretLeakViolationException(
        path: targetPath,
        message:
            'Lectura bloqueada por DENY_LIST de secretos ("$base") (§2, §60.8).',
      );
    }

    for (final String ext in deniedExtensions) {
      if (base.endsWith(ext)) {
        throw SecretLeakViolationException(
          path: targetPath,
          message:
              'Lectura bloqueada por DENY_LIST de llaves/certificados ("$ext") (§2, §60.8).',
        );
      }
    }

    if (norm.contains('/secrets/') || norm.endsWith('/secrets')) {
      throw SecretLeakViolationException(
        path: targetPath,
        message:
            'Lectura bloqueada en directorio restringido "secrets/" (§2, §60.8).',
      );
    }
  }

  /// Carga los nodos declarados en `vault/fleet.json`.
  static List<FleetNodeDescriptor> loadFleetNodes(String fleetJsonPath) {
    final File f = File(fleetJsonPath);
    if (!f.existsSync()) {
      throw NodeNotInFleetException(
        path: fleetJsonPath,
        message:
            'Manifiesto de flota no encontrado en "$fleetJsonPath" (§54.7, §62).',
      );
    }
    final dynamic decoded = jsonDecode(f.readAsStringSync());
    if (decoded is! Map<String, dynamic> || decoded['nodes'] is! List) {
      throw NodeNotInFleetException(
        path: fleetJsonPath,
        message: 'Manifiesto de flota malformado en "$fleetJsonPath".',
      );
    }

    final List<FleetNodeDescriptor> nodes = <FleetNodeDescriptor>[];
    for (final dynamic item in decoded['nodes'] as List<dynamic>) {
      if (item is! Map<String, dynamic>) continue;
      final String id = (item['id'] ?? '').toString().trim();
      final String pathTemplate = (item['path_template'] ?? '')
          .toString()
          .trim();
      final String status = (item['status'] ?? 'ACTIVE').toString().trim();
      if (id.isNotEmpty && pathTemplate.isNotEmpty) {
        nodes.add(
          FleetNodeDescriptor(
            id: id,
            pathTemplate: pathTemplate,
            status: status,
          ),
        );
      }
    }
    return nodes;
  }

  /// Extrae el UUID de conversación vinculado a un nodo leyendo su `.meta/session.relay` o `session_odometer.json`.
  static Set<String> collectDeclaredConversationIds(
    List<FleetNodeDescriptor> nodes,
  ) {
    final Set<String> ids = <String>{};
    for (final FleetNodeDescriptor node in nodes) {
      if (!node.isReadableStatus) continue;

      final File relayFile = File(
        p.join(node.pathTemplate, '.meta', 'session.relay'),
      );
      if (relayFile.existsSync()) {
        try {
          final dynamic data = jsonDecode(relayFile.readAsStringSync());
          if (data is Map<String, dynamic>) {
            final String? prevId = data['previous_conversation_id']
                ?.toString()
                .trim();
            if (prevId != null && prevId.isNotEmpty) ids.add(prevId);
            final dynamic summary = data['last_chat_summary'];
            if (summary is Map<String, dynamic>) {
              final String? sumId = summary['conversation_id']
                  ?.toString()
                  .trim();
              if (sumId != null && sumId.isNotEmpty) ids.add(sumId);
            }
          }
        } catch (_) {
          // INTENTIONAL: Ignorar relay corrupto durante recolección defensiva
        }
      }

      final File odoFile = File(
        p.join(node.pathTemplate, 'vault', 'runtime', 'session_odometer.json'),
      );
      if (odoFile.existsSync()) {
        try {
          final dynamic data = jsonDecode(odoFile.readAsStringSync());
          if (data is Map<String, dynamic>) {
            final String? conv = data['conversation_uuid']?.toString().trim();
            if (conv != null && conv.isNotEmpty) ids.add(conv);
          }
        } catch (_) {
          // INTENTIONAL: Ignorar odómetro corrupto durante recolección defensiva
        }
      }
    }
    return ids;
  }

  /// Detecta si la ruta pertenece a un directorio `brain/` de Antigravity.
  static String? extractBrainConversationId(String targetPath) {
    final String norm = _norm(targetPath);
    for (final String marker in <String>[
      '/.gemini/antigravity-cli/brain',
      '/.gemini/antigravity-ide/brain',
    ]) {
      final int idx = norm.indexOf(marker);
      if (idx != -1) {
        final String rest = norm.substring(idx + marker.length);
        if (rest.isEmpty || rest == '/') {
          return ''; // Raíz de brain/ -> intento de escaneo irrestricto
        }
        final String trimmed = rest.startsWith('/') ? rest.substring(1) : rest;
        final String firstSegment = trimmed.split('/').first.trim();
        return firstSegment;
      }
    }
    return null;
  }

  /// Evalúa si una lectura fuera del Hub cumple con `CROSS_NODE_READ_POLICY.md`.
  static void assertReadAllowed({
    required String targetPath,
    required String hubRoot,
    required String fleetJsonPath,
    Set<String>? allowedConversationIds,
  }) {
    assertNotSecret(targetPath);

    final String canonicalHub = _norm(hubRoot);
    final String canonicalTarget = _norm(targetPath);

    if (canonicalTarget == canonicalHub ||
        canonicalTarget.startsWith('$canonicalHub/')) {
      return; // Lectura interna dentro del Hub
    }

    final List<FleetNodeDescriptor> nodes = loadFleetNodes(fleetJsonPath);

    // Verificar aislamiento 1:1 de sesiones brain/
    final String? brainUuid = extractBrainConversationId(canonicalTarget);
    if (brainUuid != null) {
      if (brainUuid.isEmpty) {
        throw BrainSessionContaminationException(
          path: targetPath,
          message:
              'Escaneo libre del directorio raíz brain/ prohibido por contaminación cognitiva (§2, §60.8).',
        );
      }
      final Set<String> validIds =
          allowedConversationIds ?? collectDeclaredConversationIds(nodes);
      if (!validIds.contains(brainUuid)) {
        throw BrainSessionContaminationException(
          path: targetPath,
          message:
              'Sesión brain "$brainUuid" no está vinculada 1:1 en .meta/session.relay de ningún nodo activo en fleet.json (§2).',
        );
      }
      return;
    }

    // Verificar pertenencia a nodo registrado y no excluido en fleet.json
    FleetNodeDescriptor? matchedNode;
    for (final FleetNodeDescriptor node in nodes) {
      final String nodeNorm = _norm(node.pathTemplate);
      if (canonicalTarget == nodeNorm ||
          canonicalTarget.startsWith('$nodeNorm/')) {
        matchedNode = node;
        break;
      }
    }

    if (matchedNode == null) {
      throw NodeNotInFleetException(
        path: targetPath,
        message:
            'Ruta fuera de perímetro no registrada en vault/fleet.json (§2, §54.7).',
      );
    }

    if (!matchedNode.isReadableStatus) {
      throw NodeNotInFleetException(
        path: targetPath,
        message:
            'Nodo "${matchedNode.id}" tiene estado "${matchedNode.status}" (lectura cross-node vetada).',
      );
    }
  }
}
