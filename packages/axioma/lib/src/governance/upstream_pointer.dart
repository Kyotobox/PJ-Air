import 'dart:convert';
import 'dart:io';

/// Orígenes formales de linaje y trazabilidad SSSoT (§55.4).
enum UpstreamOrigin {
  upstreamCaldaro('upstream_caldaro'),
  harvestInterno('harvest_interno'),
  nexusKernel('nexus_kernel');

  final String value;
  const UpstreamOrigin(this.value);

  static UpstreamOrigin fromString(String raw) {
    for (final UpstreamOrigin origin in UpstreamOrigin.values) {
      if (origin.value == raw ||
          origin.name.toLowerCase() == raw.toLowerCase()) {
        return origin;
      }
    }
    throw UpstreamPointerValidationException(
      'Linaje de upstream no reconocido: "$raw". Valores válidos: '
      '${UpstreamOrigin.values.map((UpstreamOrigin e) => e.value).join(", ")}',
    );
  }
}

/// Operaciones de lectura e inspección permitidas sobre satélites upstream.
enum UpstreamReadOperation {
  astInspection('AST_INSPECTION'),
  contractRead('CONTRACT_READ'),
  skillHarvest('SKILL_HARVEST'),
  schemaQuery('SCHEMA_QUERY'),
  exportDispatch('EXPORT_DISPATCH');

  final String code;
  const UpstreamReadOperation(this.code);

  static UpstreamReadOperation fromString(String raw) {
    final String normalized = raw.trim().toUpperCase();
    for (final UpstreamReadOperation op in UpstreamReadOperation.values) {
      if (op.code == normalized || op.name.toUpperCase() == normalized) {
        return op;
      }
    }
    throw UpstreamPointerValidationException(
      'Operación de lectura no reconocida: "$raw"',
    );
  }
}

/// Operaciones mutativas prohibidas en modo solo lectura (§2 Perímetro Sónico).
enum UpstreamMutationOperation {
  writeFile('WRITE_FILE'),
  deleteFile('DELETE_FILE'),
  gitCommit('GIT_COMMIT'),
  gitPush('GIT_PUSH'),
  schemaMigration('SCHEMA_MIGRATION'),
  executeDestructive('EXECUTE_DESTRUCTIVE');

  final String code;
  const UpstreamMutationOperation(this.code);

  static UpstreamMutationOperation fromString(String raw) {
    final String normalized = raw.trim().toUpperCase();
    for (final UpstreamMutationOperation op
        in UpstreamMutationOperation.values) {
      if (op.code == normalized || op.name.toUpperCase() == normalized) {
        return op;
      }
    }
    throw UpstreamPointerValidationException(
      'Operación mutativa no reconocida: "$raw"',
    );
  }
}

/// Excepción emitida cuando se intenta ejecutar una mutación prohibida
/// sobre un puntero de solo lectura sin la firma de override constitucional.
class UpstreamMutationBlockedException implements Exception {
  final String nodeId;
  final String operation;
  final String reason;

  const UpstreamMutationBlockedException({
    required this.nodeId,
    required this.operation,
    required this.reason,
  });

  @override
  String toString() =>
      'UpstreamMutationBlockedException: Intento de mutación "$operation" bloqueado '
      'sobre el nodo upstream "$nodeId" (§2 Perímetro Sónico, §55). Motivo: $reason';
}

/// Excepción emitida ante violaciones de validación en punteros o esquemas upstream.
class UpstreamPointerValidationException implements Exception {
  final String message;
  final String? field;

  const UpstreamPointerValidationException(this.message, {this.field});

  @override
  String toString() =>
      'UpstreamPointerValidationException: $message${field != null ? " (Campo: $field)" : ""}';
}

/// Excepción emitida cuando un puntero upstream requerido no se encuentra registrado.
class UpstreamPointerNotFoundException implements Exception {
  final String nodeId;

  const UpstreamPointerNotFoundException(this.nodeId);

  @override
  String toString() =>
      'UpstreamPointerNotFoundException: Puntero no registrado para el nodo upstream "$nodeId".';
}

/// Entidad pura del Shared Kernel que define un puntero upstream desacoplado
/// y su contrato de solo lectura (§2, §39, §45, §48, §54, §55).
class UpstreamPointer {
  static const List<String> canonicalCaldaroNodes = <String>[
    'ARGOS',
    'taxi-marketing-os',
    'MarkOS',
  ];

  final String pointerId;
  final String nodeId;
  final String pathTemplate;
  final UpstreamOrigin origin;
  final bool readOnlyUpstream;
  final String domain;
  final Set<UpstreamReadOperation> allowedReadOperations;
  final Set<UpstreamMutationOperation> forbiddenMutations;
  final Map<String, dynamic> metadata;

  const UpstreamPointer({
    required this.pointerId,
    required this.nodeId,
    required this.pathTemplate,
    required this.origin,
    required this.readOnlyUpstream,
    required this.domain,
    required this.allowedReadOperations,
    required this.forbiddenMutations,
    this.metadata = const <String, dynamic>{},
  });

  /// Crea un puntero canónico pre-configurado para un nodo del ecosistema Caldaro.
  factory UpstreamPointer.forNode(
    String nodeId, {
    String? customPath,
    String? customDomain,
    Map<String, dynamic>? extraMetadata,
  }) {
    final String cleanNode = nodeId.trim();
    if (!canonicalCaldaroNodes.contains(cleanNode)) {
      throw UpstreamPointerValidationException(
        'El nodo "$cleanNode" no pertenece al catálogo canónico de Caldaro: '
        '${canonicalCaldaroNodes.join(", ")}',
        field: 'node_id',
      );
    }

    final String pointerId =
        'ptr_upstream_${cleanNode.toLowerCase().replaceAll('-', '_')}';
    final String path = customPath ?? '/home/opc/code/$cleanNode';

    _validatePathTemplate(path);

    String domain;
    Set<UpstreamReadOperation> reads;
    switch (cleanNode) {
      case 'ARGOS':
        domain =
            customDomain ??
            'Sistema de monitoreo, NLP y coordinación de campañas.';
        reads = <UpstreamReadOperation>{
          UpstreamReadOperation.astInspection,
          UpstreamReadOperation.contractRead,
          UpstreamReadOperation.skillHarvest,
          UpstreamReadOperation.schemaQuery,
        };
        break;
      case 'taxi-marketing-os':
        domain =
            customDomain ??
            'Sistema de adquisición y marketing para movilidad y taxis.';
        reads = <UpstreamReadOperation>{
          UpstreamReadOperation.astInspection,
          UpstreamReadOperation.contractRead,
          UpstreamReadOperation.skillHarvest,
          UpstreamReadOperation.schemaQuery,
        };
        break;
      case 'MarkOS':
        domain =
            customDomain ??
            'Sistema operativo para agencias de publicidad digital y producción audiovisual.';
        reads = <UpstreamReadOperation>{
          UpstreamReadOperation.astInspection,
          UpstreamReadOperation.contractRead,
          UpstreamReadOperation.skillHarvest,
          UpstreamReadOperation.schemaQuery,
          UpstreamReadOperation.exportDispatch,
        };
        break;
      default:
        throw UpstreamPointerValidationException('Nodo no mapeado: $cleanNode');
    }

    const Set<UpstreamMutationOperation> mutations =
        <UpstreamMutationOperation>{
          UpstreamMutationOperation.writeFile,
          UpstreamMutationOperation.deleteFile,
          UpstreamMutationOperation.gitCommit,
          UpstreamMutationOperation.gitPush,
          UpstreamMutationOperation.schemaMigration,
          UpstreamMutationOperation.executeDestructive,
        };

    return UpstreamPointer(
      pointerId: pointerId,
      nodeId: cleanNode,
      pathTemplate: path,
      origin: UpstreamOrigin.upstreamCaldaro,
      readOnlyUpstream: true,
      domain: domain,
      allowedReadOperations: reads,
      forbiddenMutations: mutations,
      metadata: extraMetadata ?? const <String, dynamic>{},
    );
  }

  /// Deserializa un puntero desde un mapa JSON validando invariantes constitucionales.
  factory UpstreamPointer.fromJson(Map<String, dynamic> json) {
    final String pointerId = (json['pointer_id'] as String?)?.trim() ?? '';
    final String nodeId = (json['node_id'] as String?)?.trim() ?? '';
    final String pathTemplate =
        (json['path_template'] as String?)?.trim() ?? '';
    final String rawOrigin = (json['origin'] as String?)?.trim() ?? '';
    final bool? readOnly = json['read_only_upstream'] as bool?;
    final String domain = (json['domain'] as String?)?.trim() ?? '';

    if (pointerId.isEmpty) {
      throw const UpstreamPointerValidationException(
        'El campo "pointer_id" es obligatorio.',
        field: 'pointer_id',
      );
    }
    if (nodeId.isEmpty) {
      throw const UpstreamPointerValidationException(
        'El campo "node_id" es obligatorio.',
        field: 'node_id',
      );
    }
    if (pathTemplate.isEmpty) {
      throw const UpstreamPointerValidationException(
        'El campo "path_template" es obligatorio.',
        field: 'path_template',
      );
    }
    _validatePathTemplate(pathTemplate);

    final UpstreamOrigin origin = UpstreamOrigin.fromString(rawOrigin);

    if (readOnly == null || !readOnly) {
      throw const UpstreamPointerValidationException(
        'La bandera "read_only_upstream" debe ser estrictamente true (§2, §55).',
        field: 'read_only_upstream',
      );
    }

    final List<dynamic>? rawReads =
        json['allowed_read_operations'] as List<dynamic>?;
    if (rawReads == null || rawReads.isEmpty) {
      throw const UpstreamPointerValidationException(
        'Se requiere al menos una operación en "allowed_read_operations".',
        field: 'allowed_read_operations',
      );
    }
    final Set<UpstreamReadOperation> reads = rawReads
        .map((dynamic e) => UpstreamReadOperation.fromString(e.toString()))
        .toSet();

    final List<dynamic>? rawMutations =
        json['forbidden_mutations'] as List<dynamic>?;
    if (rawMutations == null || rawMutations.isEmpty) {
      throw const UpstreamPointerValidationException(
        'Se requiere al menos una mutación en "forbidden_mutations".',
        field: 'forbidden_mutations',
      );
    }
    final Set<UpstreamMutationOperation> mutations = rawMutations
        .map((dynamic e) => UpstreamMutationOperation.fromString(e.toString()))
        .toSet();

    final Map<String, dynamic> metadata =
        (json['metadata'] as Map<String, dynamic>?) ?? <String, dynamic>{};

    return UpstreamPointer(
      pointerId: pointerId,
      nodeId: nodeId,
      pathTemplate: pathTemplate,
      origin: origin,
      readOnlyUpstream: readOnly,
      domain: domain,
      allowedReadOperations: reads,
      forbiddenMutations: mutations,
      metadata: metadata,
    );
  }

  /// Serializa el puntero a formato JSON canónico.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'pointer_id': pointerId,
    'node_id': nodeId,
    'path_template': pathTemplate,
    'origin': origin.value,
    'read_only_upstream': readOnlyUpstream,
    'domain': domain,
    'allowed_read_operations': allowedReadOperations
        .map((UpstreamReadOperation op) => op.code)
        .toList(),
    'forbidden_mutations': forbiddenMutations
        .map((UpstreamMutationOperation op) => op.code)
        .toList(),
    if (metadata.isNotEmpty) 'metadata': metadata,
  };

  /// Valida que una operación de lectura esté permitida por el contrato.
  void assertCanRead(UpstreamReadOperation operation) {
    if (!allowedReadOperations.contains(operation)) {
      throw UpstreamPointerValidationException(
        'Operación de lectura "${operation.code}" no admitida por el contrato del nodo "$nodeId".',
      );
    }
  }

  /// Verifica la viabilidad de una mutación. Si el puntero es de solo lectura,
  /// bloquea la ejecución salvo presencia de la firma OVERRIDE_AUTHORIZATION (§2).
  void assertCanMutate(
    UpstreamMutationOperation operation, {
    String? overrideAuthorization,
  }) {
    if (!readOnlyUpstream) {
      return;
    }

    final bool hasValidOverride =
        overrideAuthorization != null &&
        overrideAuthorization.trim().startsWith('OVERRIDE_AUTHORIZATION:') &&
        overrideAuthorization.trim().length > 'OVERRIDE_AUTHORIZATION:'.length;

    if (!hasValidOverride) {
      throw UpstreamMutationBlockedException(
        nodeId: nodeId,
        operation: operation.code,
        reason:
            'Nodo configurado como read_only_upstream=true. Se requiere firma '
            '"OVERRIDE_AUTHORIZATION: [motivo]" para proceder.',
      );
    }
  }

  static void _validatePathTemplate(String path) {
    if (path.contains('..')) {
      throw const UpstreamPointerValidationException(
        'Ruta inválida: detección de posible path traversal ("..").',
        field: 'path_template',
      );
    }
  }
}

/// Registro y resolvedor de punteros upstream sobre la flota (§2, §55).
class UpstreamPointerRegistry {
  final Map<String, UpstreamPointer> _pointers;

  const UpstreamPointerRegistry(this._pointers);

  /// Construye el registro parseando el archivo `fleet.json`.
  factory UpstreamPointerRegistry.fromFleetJson(String fleetJsonContent) {
    final dynamic parsed = jsonDecode(fleetJsonContent);
    if (parsed is! Map<String, dynamic>) {
      throw const FormatException('fleet.json debe ser un objeto JSON.');
    }

    final dynamic rawNodes = parsed['nodes'];
    if (rawNodes is! List<dynamic>) {
      throw const FormatException(
        'Estructura inválida: falta el arreglo "nodes" en fleet.json.',
      );
    }
    final List<dynamic> nodes = rawNodes;

    final Map<String, UpstreamPointer> pointers = <String, UpstreamPointer>{};

    for (final dynamic item in nodes) {
      if (item is! Map<String, dynamic>) continue;
      final String? id = item['id'] as String?;
      final bool isReadOnlyUpstream =
          item['read_only_upstream'] as bool? ?? false;

      if (id != null && isReadOnlyUpstream) {
        if (UpstreamPointer.canonicalCaldaroNodes.contains(id)) {
          final String? path = item['path_template'] as String?;
          final String? domain =
              (item['domain'] as String?) ?? (item['description'] as String?);
          final UpstreamPointer ptr = UpstreamPointer.forNode(
            id,
            customPath: path,
            customDomain: domain,
            extraMetadata: <String, dynamic>{
              'status': item['status'],
              'layer': item['layer'],
              'axis': item['axis'],
            },
          );
          pointers[id] = ptr;
        } else {
          // Satélite read-only no Caldaro genérico
          final String path =
              (item['path_template'] as String?) ?? '/home/opc/code/$id';
          final UpstreamPointer ptr = UpstreamPointer(
            pointerId: 'ptr_upstream_${id.toLowerCase().replaceAll('-', '_')}',
            nodeId: id,
            pathTemplate: path,
            origin: UpstreamOrigin.harvestInterno,
            readOnlyUpstream: true,
            domain:
                (item['domain'] as String?) ??
                (item['description'] as String?) ??
                'Nodo satélite externo',
            allowedReadOperations: <UpstreamReadOperation>{
              UpstreamReadOperation.astInspection,
              UpstreamReadOperation.contractRead,
            },
            forbiddenMutations: UpstreamMutationOperation.values.toSet(),
            metadata: <String, dynamic>{'status': item['status']},
          );
          pointers[id] = ptr;
        }
      }
    }

    return UpstreamPointerRegistry(pointers);
  }

  /// Construye el registro desde un archivo físico en disco (§4, §45).
  factory UpstreamPointerRegistry.fromFleetFile(File fleetFile) {
    if (!fleetFile.existsSync()) {
      throw FileSystemException(
        'Archivo fleet.json inexistente',
        fleetFile.path,
      );
    }
    return UpstreamPointerRegistry.fromFleetJson(fleetFile.readAsStringSync());
  }

  /// Retorna un puntero si existe, o null.
  UpstreamPointer? getPointer(String nodeId) => _pointers[nodeId];

  /// Retorna un puntero de Caldaro garantizado o lanza `UpstreamPointerNotFoundException`.
  UpstreamPointer getCaldaroPointer(String nodeId) {
    final UpstreamPointer? ptr = _pointers[nodeId];
    if (ptr == null) {
      throw UpstreamPointerNotFoundException(nodeId);
    }
    if (ptr.origin != UpstreamOrigin.upstreamCaldaro) {
      throw UpstreamPointerValidationException(
        'El nodo "$nodeId" está registrado pero su linaje es "${ptr.origin.value}", no "upstream_caldaro".',
      );
    }
    return ptr;
  }

  /// Lista todos los punteros registrados.
  List<UpstreamPointer> listPointers() => _pointers.values.toList();

  /// Lista exclusivamente los punteros con linaje `upstream_caldaro`.
  List<UpstreamPointer> listCaldaroPointers() => _pointers.values
      .where((UpstreamPointer p) => p.origin == UpstreamOrigin.upstreamCaldaro)
      .toList();
}
