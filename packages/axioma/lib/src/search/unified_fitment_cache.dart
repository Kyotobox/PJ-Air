import 'dart:convert';
import 'dart:io';
import '../models/fitment_entity.dart';

/// Servicio de Caché Base Unificada de Fitments y Grafos
///
/// Permite cargar de forma inmediata el universo de compatibilidades pre-calculadas
/// en `vault/runtime/` sin tener que volver a procesar descripciones en caliente.
class UnifiedFitmentCache {
  final String _fitmentsPath;
  final String _graphPath;

  bool _isLoaded = false;
  final Map<String, List<FitmentEntity>> _fitments =
      <String, List<FitmentEntity>>{};
  final Map<String, Map<String, Map<String, int>>> _graph =
      <String, Map<String, Map<String, int>>>{};

  UnifiedFitmentCache({String? fitmentsPath, String? graphPath})
    : _fitmentsPath = fitmentsPath ?? 'vault/runtime/unified_fitments.json',
      _graphPath = graphPath ?? 'vault/runtime/compatibility_graph.json';

  bool get isLoaded => _isLoaded;

  /// Carga asíncrona de los archivos de caché estructurados.
  Future<void> load() async {
    if (_isLoaded) return;

    final File fitmentsFile = File(_fitmentsPath);
    if (await fitmentsFile.exists()) {
      final String content = await fitmentsFile.readAsString();
      final Map<String, dynamic> decoded =
          jsonDecode(content) as Map<String, dynamic>;

      decoded.forEach((String sku, list) {
        if (list is List) {
          _fitments[sku] = list
              .map(
                (item) => FitmentEntity.fromJson(
                  Map<String, dynamic>.from(item as Map),
                ),
              )
              .toList();
        }
      });
    }

    final File graphFile = File(_graphPath);
    if (await graphFile.exists()) {
      final String content = await graphFile.readAsString();
      final Map<String, dynamic> decoded =
          jsonDecode(content) as Map<String, dynamic>;

      decoded.forEach((String node, neighbors) {
        if (neighbors is Map) {
          final Map<String, Map<String, int>> neighborMap =
              <String, Map<String, int>>{};
          neighbors.forEach((neighbor, categories) {
            if (categories is Map) {
              final Map<String, int> catMap = <String, int>{};
              categories.forEach((cat, count) {
                if (count is int) {
                  catMap[cat] = count;
                }
              });
              neighborMap[neighbor] = catMap;
            }
          });
          _graph[node] = neighborMap;
        }
      });
    }

    _isLoaded = true;
  }

  /// Retorna las compatibilidades vehiculares asociadas a un SKU.
  List<FitmentEntity> getFitmentsForSku(String sku) {
    return _fitments[sku] ?? const <FitmentEntity>[];
  }

  /// Retorna los enlaces de co-ocurrencia del grafo de compatibilidad para un nodo de vehículo.
  /// Formato del nodo: "MARCA:MODELO" (ej: "TOYOTA:COROLLA").
  Map<String, Map<String, int>> getSharedCompatibility(String vehicleNode) {
    return _graph[vehicleNode.toUpperCase()] ??
        const <String, Map<String, int>>{};
  }

  /// Verifica si existe relación de compatibilidad indirecta (arista en el grafo).
  bool isCompatible(String vehicleA, String vehicleB) {
    final Map<String, dynamic> neighbors = getSharedCompatibility(vehicleA);
    return neighbors.containsKey(vehicleB.toUpperCase());
  }

  /// Cantidad total de SKUs cacheados.
  int get totalSkus => _fitments.length;

  /// Cantidad total de nodos del grafo.
  int get totalNodes => _graph.length;
}
