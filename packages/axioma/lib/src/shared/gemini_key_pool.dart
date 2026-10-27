/// GeminiKeyPool & Rotation Engine (SPEC-LLM-POOL-01 / TASK-G188-02)
///
/// Implementa rotación Round-Robin de API Keys de Google Gemini, discriminación dual
/// de fallos (Cuota diaria vs Rate-limit temporal) y gestión de cooldowns.
/// Adhiere estrictamente a Pure Dart Core (§39).
library;

import 'dart:io';

import 'key_pool_base.dart';

/// Excepción lanzada cuando todas las claves del pool están en cooldown.
class GeminiPoolExhaustedException implements Exception {
  final int totalKeys;
  final String message;

  const GeminiPoolExhaustedException(
    this.totalKeys, [
    this.message = 'Todas las claves se encuentran en cooldown activo.',
  ]);

  @override
  String toString() =>
      '[GEMINI_POOL_EXHAUSTED] ($totalKeys claves agotadas): $message';
}

/// Gestor y pool multi-llave para Gemini API con rotación Round-Robin y mitigación de cuotas.
class GeminiKeyPool implements KeyPool {
  final List<String> _keys;
  final Map<String, DateTime> _cooldowns;
  int _currentIndex;

  GeminiKeyPool({
    required List<String> keys,
    Map<String, DateTime>? initialCooldowns,
    int initialIndex = 0,
  }) : _keys = List<String>.from(keys.where((String k) => k.trim().isNotEmpty)),
       _cooldowns = initialCooldowns != null
           ? Map<String, DateTime>.from(initialCooldowns)
           : <String, DateTime>{},
       _currentIndex = initialIndex {
    if (_keys.isEmpty) {
      throw ArgumentError.value(
        keys,
        'keys',
        'El pool de Gemini requiere al menos una clave válida.',
      );
    }
  }

  /// Claves registradas en el pool (inmutables desde el exterior).
  List<String> get keys => List<String>.unmodifiable(_keys);

  /// Cooldowns activos (clave -> DateTime hasta el cual no puede usarse).
  Map<String, DateTime> get cooldowns =>
      Map<String, DateTime>.unmodifiable(_cooldowns);

  /// Índice circular actual del pool.
  int get currentIndex => _currentIndex;

  /// Cantidad total de claves registradas.
  int get length => _keys.length;

  /// Retorna si una clave específica está disponible para despacho.
  bool isKeyAvailable(String key, {DateTime? now}) {
    if (!_keys.contains(key)) return false;
    final DateTime current = now ?? DateTime.now();
    final DateTime? cooldownUntil = _cooldowns[key];
    if (cooldownUntil == null) return true;
    return current.isAfter(cooldownUntil) ||
        current.isAtSameMomentAs(cooldownUntil);
  }

  /// Obtiene la siguiente clave disponible mediante rotación Round-Robin.
  /// Si una clave está en cooldown, se salta automáticamente a la siguiente.
  /// Si todas las claves están en cooldown, lanza [GeminiPoolExhaustedException].
  String get nextKey => acquireNextKey();

  /// Adquiere la siguiente clave disponible avanzando el puntero de rotación.
  String acquireNextKey({DateTime? now}) {
    final DateTime current = now ?? DateTime.now();
    final int count = _keys.length;

    for (int i = 0; i < count; i++) {
      final int candidateIndex = (_currentIndex + i) % count;
      final String candidate = _keys[candidateIndex];

      if (isKeyAvailable(candidate, now: current)) {
        _currentIndex = (candidateIndex + 1) % count;
        return candidate;
      }
    }

    throw GeminiPoolExhaustedException(
      count,
      'Todas las $count claves de Gemini se encuentran en cooldown activo.',
    );
  }

  /// Marca una clave como agotada por cuota diaria (RPD / TPD / RESOURCE_EXHAUSTED).
  /// Aplica un cooldown de 24 horas por defecto.
  void markQuotaExhausted(
    String key, {
    Duration duration = const Duration(hours: 24),
    DateTime? now,
  }) {
    final DateTime current = now ?? DateTime.now();
    _cooldowns[key] = current.add(duration);
  }

  /// Marca una clave con rate-limit temporal (RPM / HTTP 429).
  /// Aplica un cooldown breve según el parámetro `cooldownSec` (por defecto 60s).
  void markRateLimited(String key, {double cooldownSec = 60.0, DateTime? now}) {
    final DateTime current = now ?? DateTime.now();
    final int millis = (cooldownSec * 1000).round();
    _cooldowns[key] = current.add(Duration(milliseconds: millis));
  }

  /// Limpia el cooldown de una clave específica.
  void resetCooldown(String key) {
    _cooldowns.remove(key);
  }

  /// Limpia todos los cooldowns registrados en el pool.
  void clearAllCooldowns() {
    _cooldowns.clear();
  }

  /// Carga el pool desde variables de entorno según un prefijo estándar.
  /// Ejemplo: GEMINI_API_KEY, GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.
  factory GeminiKeyPool.fromEnvironment({
    String prefix = 'GEMINI_API_KEY',
    Map<String, String>? environment,
  }) {
    final Map<String, String> env = environment ?? Platform.environment;
    final List<String> gatheredKeys = <String>[];

    // 1. Variable singular principal
    final String? singular = env[prefix]?.trim();
    if (singular != null && singular.isNotEmpty) {
      gatheredKeys.add(singular);
    }

    // 2. Variables numeradas GEMINI_API_KEY_1, _2, etc.
    for (int i = 1; i <= 50; i++) {
      final String? indexedKey = env['${prefix}_$i']?.trim();
      if (indexedKey != null &&
          indexedKey.isNotEmpty &&
          !gatheredKeys.contains(indexedKey)) {
        gatheredKeys.add(indexedKey);
      }
    }

    if (gatheredKeys.isEmpty) {
      throw StateError(
        'No se encontraron claves de Gemini en el entorno con prefijo "$prefix".',
      );
    }

    return GeminiKeyPool(keys: gatheredKeys);
  }

  /// Determina si un mensaje de error corresponde a un agotamiento de cuota diaria.
  static bool isDailyLimit(String error) {
    final String lower = error.toLowerCase();
    return lower.contains('generaterequestsperday') ||
        lower.contains('resource_exhausted') ||
        lower.contains('daily quota') ||
        lower.contains('tpd') ||
        lower.contains('quota exceeded');
  }

  /// Determina si un mensaje de error corresponde a un rate-limit temporal (RPM).
  static bool isRateLimit(String error) {
    final String lower = error.toLowerCase();
    return lower.contains('429') ||
        lower.contains('rate limit') ||
        lower.contains('tokens per minute') ||
        lower.contains('rpm') ||
        lower.contains('retry in');
  }

  /// Extrae el retardo sugerido (en segundos) de un error con patrón "retry in X.Xs".
  static double extractRetryDelaySec(
    String error, {
    double defaultDelay = 15.0,
  }) {
    final RegExp regex = RegExp(
      r'retry in\s+([0-9.]+)\s*s',
      caseSensitive: false,
    );
    final RegExpMatch? match = regex.firstMatch(error);
    if (match != null && match.groupCount >= 1) {
      final String? valStr = match.group(1);
      if (valStr != null) {
        final double? parsed = double.tryParse(valStr);
        if (parsed != null && parsed > 0) return parsed;
      }
    }
    return defaultDelay;
  }
}
