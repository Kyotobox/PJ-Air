/// gate_cache.dart — LRU Cache y Latency Budget para Compuertas Mecánicas Pure Dart (§39, §43, §48, §52).
library;

import 'dart:collection';

/// Excepción formal arrojada cuando se excede el presupuesto de latencia de compuertas (§52).
class LatencyBudgetExceededException implements Exception {
  final String message;
  final String? gateName;
  final int elapsedMs;
  final int budgetMs;

  const LatencyBudgetExceededException(
    this.message, {
    this.gateName,
    required this.elapsedMs,
    required this.budgetMs,
  });

  @override
  String toString() => 'LatencyBudgetExceededException: $message';
}

/// Entrada individual dentro del [LruGateCache] con soporte de expiración (TTL).
class GateCacheEntry<V> {
  final V value;
  final DateTime createdAt;
  DateTime lastAccessed;
  int accessCount;
  final Duration? ttl;

  GateCacheEntry(this.value, {DateTime? createdAt, this.ttl})
    : createdAt = createdAt ?? DateTime.now(),
      lastAccessed = createdAt ?? DateTime.now(),
      accessCount = 1;

  bool get isExpired {
    if (ttl == null) return false;
    return DateTime.now().difference(createdAt) > ttl!;
  }

  void touch() {
    lastAccessed = DateTime.now();
    accessCount++;
  }
}

/// Cache LRU (Least Recently Used) genérico y puro en Dart para compuertas idempotentes (§39, §52).
class LruGateCache<K, V> {
  final int maxCapacity;
  final Duration? defaultTtl;
  final LinkedHashMap<K, GateCacheEntry<V>> _cache =
      LinkedHashMap<K, GateCacheEntry<V>>();

  int _hits = 0;
  int _misses = 0;
  int _evictions = 0;

  LruGateCache({this.maxCapacity = 128, this.defaultTtl}) {
    if (maxCapacity <= 0) {
      throw ArgumentError.value(
        maxCapacity,
        'maxCapacity',
        'La capacidad máxima de la caché LRU debe ser estrictamente mayor a 0.',
      );
    }
  }

  int get size => _cache.length;
  int get hits => _hits;
  int get misses => _misses;
  int get evictions => _evictions;
  double get hitRatio =>
      (_hits + _misses == 0) ? 0.0 : _hits / (_hits + _misses);

  /// Obtiene un valor de la caché. Si expira o no existe, retorna null.
  V? get(K key) {
    final GateCacheEntry<V>? entry = _cache[key];
    if (entry == null) {
      _misses++;
      return null;
    }

    if (entry.isExpired) {
      _cache.remove(key);
      _misses++;
      return null;
    }

    // Mover al final para reflejar acceso reciente (LRU)
    _cache.remove(key);
    entry.touch();
    _cache[key] = entry;
    _hits++;
    return entry.value;
  }

  /// Almacena un valor en la caché. Si se alcanza la capacidad, desaloja el elemento más antiguo.
  void put(K key, V value, {Duration? ttl}) {
    final Duration? effectiveTtl = ttl ?? defaultTtl;

    if (_cache.containsKey(key)) {
      _cache.remove(key);
    } else if (_cache.length >= maxCapacity) {
      final K oldestKey = _cache.keys.first;
      _cache.remove(oldestKey);
      _evictions++;
    }

    _cache[key] = GateCacheEntry<V>(value, ttl: effectiveTtl);
  }

  /// Verifica si una clave existe y no está expirada sin afectar el orden de acceso.
  bool containsKey(K key) {
    final GateCacheEntry<V>? entry = _cache[key];
    if (entry == null) return false;
    if (entry.isExpired) {
      _cache.remove(key);
      return false;
    }
    return true;
  }

  /// Invalida y remueve una clave.
  V? invalidate(K key) {
    final GateCacheEntry<V>? entry = _cache.remove(key);
    return entry?.value;
  }

  /// Limpia la totalidad de la caché.
  void clear() {
    _cache.clear();
  }

  /// Exporta estadísticas telemétricas de la caché.
  Map<String, dynamic> getStats() => <String, dynamic>{
    'size': size,
    'max_capacity': maxCapacity,
    'hits': hits,
    'misses': misses,
    'evictions': evictions,
    'hit_ratio': hitRatio,
  };
}

/// Definición declarativa de presupuestos de latencia por compuerta (§52).
class LatencyBudget {
  final int maxDurationMs;
  final Map<String, int> gateBudgets;

  const LatencyBudget({
    this.maxDurationMs = 500,
    this.gateBudgets = const <String, int>{
      'atomicity': 50,
      'monotonicity': 50,
      'state_ledger': 150,
      'cyclomatic_complexity': 100,
      'triage': 100,
      'scope_drift': 100,
      'sad_path_evidence': 100,
      'schema_truth': 100,
    },
  });

  int budgetFor(String gateName) => gateBudgets[gateName] ?? maxDurationMs;
}

/// Registro individual de latencia observada en una compuerta.
class LatencyRecord {
  final String gateName;
  final int elapsedMs;
  final int budgetMs;

  const LatencyRecord({
    required this.gateName,
    required this.elapsedMs,
    required this.budgetMs,
  });

  bool get exceeded => elapsedMs > budgetMs;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'gate_name': gateName,
    'elapsed_ms': elapsedMs,
    'budget_ms': budgetMs,
    'exceeded': exceeded,
  };
}

/// Rastreador e instrumentador de latencias en vuelo (§52).
class LatencyTracker {
  final LatencyBudget budget;
  final List<LatencyRecord> _records = <LatencyRecord>[];

  LatencyTracker({LatencyBudget? budget})
    : budget = budget ?? const LatencyBudget();

  List<LatencyRecord> get records => List<LatencyRecord>.unmodifiable(_records);
  bool get hasViolations => _records.any((LatencyRecord r) => r.exceeded);
  List<LatencyRecord> get violations =>
      _records.where((LatencyRecord r) => r.exceeded).toList();
  int get totalElapsedMs =>
      _records.fold(0, (int sum, LatencyRecord r) => sum + r.elapsedMs);

  LatencyRecord record(String gateName, int elapsedMs, {bool strict = false}) {
    final int b = budget.budgetFor(gateName);
    final LatencyRecord rec = LatencyRecord(
      gateName: gateName,
      elapsedMs: elapsedMs,
      budgetMs: b,
    );
    _records.add(rec);

    if (strict && rec.exceeded) {
      throw LatencyBudgetExceededException(
        '❌ [LATENCY_BUDGET_EXCEEDED] Compuerta $gateName excedió el presupuesto de latencia '
        '(${elapsedMs}ms > ${b}ms) (§52).',
        gateName: gateName,
        elapsedMs: elapsedMs,
        budgetMs: b,
      );
    }
    return rec;
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'total_elapsed_ms': totalElapsedMs,
    'max_budget_ms': budget.maxDurationMs,
    'has_violations': hasViolations,
    'violations_count': violations.length,
    'records': _records.map((LatencyRecord r) => r.toJson()).toList(),
  };
}
