// 🎯 FleetTopoValidator — Validador Puro de Topología Nexus y Grafos de Flota (§39, §54.7, §60.8)

/// Resultado inmutable de la validación topológica de flota.
class FleetTopoValidationResult {
  final bool isValid;
  final int totalNodes;
  final List<String> nodeIds;
  final List<String> warnings;
  final List<String> errors;

  const FleetTopoValidationResult({
    required this.isValid,
    required this.totalNodes,
    required this.nodeIds,
    this.warnings = const <String>[],
    this.errors = const <String>[],
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'is_valid': isValid,
    'total_nodes': totalNodes,
    'node_ids': nodeIds,
    'warnings': warnings,
    'errors': errors,
  };
}

/// Validador sin I/O (Pure Dart §39) para el manifiesto topológico Nexus y detección de ciclos DAG.
class FleetTopoValidator {
  static const Set<String> validBunkerTypes = <String>{
    'kernel',
    'control_plane',
    'hub',
    'satellite',
    'worker',
    'gateway',
    'infra',
    'product_satellite',
    'central_triad',
    'shared',
  };

  /// Valida exhaustivamente la estructura topológica de un manifiesto de flota declarativo.
  ///
  /// Lanza [FormatException] ante violaciones estructurales críticas o ciclos (§6, §60.7).
  static FleetTopoValidationResult validateManifest(
    Map<String, dynamic> manifest, {
    bool strict = true,
  }) {
    if (manifest.isEmpty) {
      throw const FormatException(
        'El manifiesto de flota no puede estar vacío',
      );
    }

    final dynamic fleetVersion = manifest['fleet_version'];
    if (fleetVersion is! String || fleetVersion.trim().isEmpty) {
      throw const FormatException('fleet_version inválido o ausente');
    }

    final dynamic topology = manifest['topology'];
    if (topology is! String || topology.trim().isEmpty) {
      throw const FormatException('topology inválido o ausente');
    }

    final dynamic rawNodes = manifest['nodes'];
    if (rawNodes is! List || rawNodes.isEmpty) {
      throw const FormatException(
        'El manifiesto debe contener una lista no vacía de nodos',
      );
    }

    final Set<String> seenIds = <String>{};
    final List<String> nodeIds = <String>[];
    final Map<String, List<String>> dependencyGraph = <String, List<String>>{};
    final List<String> warnings = <String>[];
    final List<String> errors = <String>[];

    for (final dynamic item in rawNodes) {
      if (item is! Map<String, dynamic>) {
        throw const FormatException('Entrada de nodo malformada: debe ser Map');
      }

      final dynamic id = item['id'];
      if (id is! String || id.trim().isEmpty) {
        throw const FormatException('Nodo sin campo "id" válido');
      }

      final String cleanId = id.trim();
      if (seenIds.contains(cleanId)) {
        throw FormatException(
          'Nodo duplicado detectado en topología: $cleanId',
        );
      }
      seenIds.add(cleanId);
      nodeIds.add(cleanId);

      final dynamic bType = item['bunker_type'] ?? item['layer'];
      if (bType != null && bType is String) {
        if (!validBunkerTypes.contains(bType.trim().toLowerCase())) {
          throw FormatException(
            'bunker_type desconocido para nodo "$cleanId": $bType',
          );
        }
      }

      final dynamic pathTpl = item['path_template'];
      if (strict &&
          (pathTpl == null || (pathTpl is String && pathTpl.trim().isEmpty))) {
        throw FormatException(
          'path_template ausente o vacío para nodo "$cleanId"',
        );
      }

      final dynamic rawDeps = item['dependencies'] ?? item['upstream'];
      if (rawDeps != null) {
        if (rawDeps is! List) {
          throw FormatException('Dependencias inválidas para nodo "$cleanId"');
        }
        dependencyGraph[cleanId] = rawDeps
            .map((dynamic d) => d.toString().trim())
            .toList();
      } else {
        dependencyGraph[cleanId] = <String>[];
      }
    }

    // Validación de integridad referencial: dependencias deben existir en seenIds
    for (final MapEntry<String, List<String>> entry
        in dependencyGraph.entries) {
      final String fromNode = entry.key;
      for (final String dep in entry.value) {
        if (!seenIds.contains(dep)) {
          throw FormatException(
            'Dependencia huérfana en nodo "$fromNode": destino "$dep" no existe en la flota',
          );
        }
      }
    }

    // Detección de ciclos en el grafo dirigido de dependencias (DFS de 3 colores)
    _detectCycles(dependencyGraph);

    return FleetTopoValidationResult(
      isValid: errors.isEmpty,
      totalNodes: nodeIds.length,
      nodeIds: nodeIds,
      warnings: warnings,
      errors: errors,
    );
  }

  /// Valida la Fuente Única de Verdad viva observable de la flota en [fleet_state.json] (§54.7).
  static FleetTopoValidationResult validateFleetState(
    Map<String, dynamic> state,
  ) {
    if (state.isEmpty) {
      throw const FormatException(
        'El estado vivo de la flota no puede estar vacío',
      );
    }

    final dynamic kernelVersion = state['kernel_version'];
    if (kernelVersion is! String || kernelVersion.trim().isEmpty) {
      throw const FormatException(
        'kernel_version inválido o ausente en fleet_state.json',
      );
    }

    final dynamic trinity = state['trinity'];
    if (trinity is! Map<String, dynamic>) {
      throw const FormatException(
        'Estructura trinity ausente o inválida en fleet_state.json',
      );
    }

    const List<String> requiredTrinity = <String>['smart', 'core', 'automa'];
    for (final String key in requiredTrinity) {
      if (!trinity.containsKey(key)) {
        throw FormatException(
          'Nodo de la tríada central "$key" ausente en trinity',
        );
      }
    }

    final dynamic rawNodes = state['nodes'];
    if (rawNodes is! List || rawNodes.isEmpty) {
      throw const FormatException(
        'Lista de nodos ausente o vacía en fleet_state.json',
      );
    }

    final Set<String> seenIds = <String>{};
    final List<String> nodeIds = <String>[];

    for (final dynamic item in rawNodes) {
      if (item is! Map<String, dynamic>) {
        throw const FormatException(
          'Entrada de nodo malformada en fleet_state.json',
        );
      }
      final dynamic id = item['id'];
      if (id is! String || id.trim().isEmpty) {
        throw const FormatException('Nodo sin id en fleet_state.json');
      }
      final String cleanId = id.trim();
      if (seenIds.contains(cleanId)) {
        throw FormatException('Nodo duplicado en fleet_state.json: $cleanId');
      }
      seenIds.add(cleanId);
      nodeIds.add(cleanId);
    }

    final dynamic rawActive = state['active_fleet_nodes'];
    if (rawActive is List) {
      for (final dynamic activeId in rawActive) {
        if (!seenIds.contains(activeId.toString())) {
          throw FormatException(
            'active_fleet_nodes contiene "$activeId" que no está registrado en la lista de nodos',
          );
        }
      }
    }

    return FleetTopoValidationResult(
      isValid: true,
      totalNodes: nodeIds.length,
      nodeIds: nodeIds,
    );
  }

  /// Valida el consenso ontológico entre el manifiesto declarativo y el estado vivo observable (§54.7, §60.8).
  static void validateHierarchyConsensus({
    required Map<String, dynamic> declarativeManifest,
    required Map<String, dynamic> runtimeState,
  }) {
    final FleetTopoValidationResult declResult = validateManifest(
      declarativeManifest,
      strict: false,
    );
    final FleetTopoValidationResult runtimeResult = validateFleetState(
      runtimeState,
    );

    final Set<String> declNodes = declResult.nodeIds.toSet();
    for (final String runtimeNode in runtimeResult.nodeIds) {
      if (!declNodes.contains(runtimeNode)) {
        throw FormatException(
          'Discrepancia de consenso SSSoT: Nodo activo "$runtimeNode" en runtimeState no existe en declarativeManifest',
        );
      }
    }
  }

  /// Algoritmo de detección de ciclos topológicos mediante DFS.
  static void _detectCycles(Map<String, List<String>> graph) {
    final Map<String, int> state = <String, int>{};
    for (final String node in graph.keys) {
      state[node] = 0;
    }

    void dfs(String u, List<String> path) {
      state[u] = 1;
      path.add(u);

      for (final String v in graph[u] ?? const <String>[]) {
        final int vState = state[v] ?? 0;
        if (vState == 1) {
          final int cycleStart = path.indexOf(v);
          final String cycleStr =
              path.sublist(cycleStart).join(' -> ') + ' -> $v';
          throw FormatException(
            'Ciclo topológico detectado en grafo de flota: $cycleStr',
          );
        } else if (vState == 0) {
          dfs(v, path);
        }
      }

      path.removeLast();
      state[u] = 2;
    }

    for (final String node in graph.keys) {
      if ((state[node] ?? 0) == 0) {
        dfs(node, <String>[]);
      }
    }
  }
}
