/// KeyPool Base Interface & Rotation Contracts (SPEC-LLM-POOL-01 / TASK-G50-03)
///
/// Contrato agnóstico multi-proveedor para pools de API Keys con rotación
/// Round-Robin, discriminación de cuotas/rate-limits y gestión de cooldowns.
/// Adhiere a Pure Dart Core (§39).
library;

/// Interfaz base común para todos los pools de claves de Modelos de Lenguaje.
abstract class KeyPool {
  /// Lista inmutable de claves registradas en el pool.
  List<String> get keys;

  /// Mapa de cooldowns activos (clave -> DateTime hasta el cual no puede usarse).
  Map<String, DateTime> get cooldowns;

  /// Índice circular actual del pool.
  int get currentIndex;

  /// Cantidad total de claves válidas registradas.
  int get length;

  /// Retorna si una clave específica está disponible para despacho.
  bool isKeyAvailable(String key, {DateTime? now});

  /// Obtiene la siguiente clave disponible mediante rotación Round-Robin.
  String get nextKey;

  /// Adquiere la siguiente clave disponible avanzando el puntero de rotación.
  String acquireNextKey({DateTime? now});

  /// Marca una clave como agotada por cuota diaria o límite de créditos.
  void markQuotaExhausted(
    String key, {
    Duration duration = const Duration(hours: 24),
    DateTime? now,
  });

  /// Marca una clave con rate-limit temporal (RPM/TPM o HTTP 429).
  void markRateLimited(String key, {double cooldownSec = 60.0, DateTime? now});

  /// Limpia el cooldown de una clave específica.
  void resetCooldown(String key);

  /// Limpia todos los cooldowns registrados en el pool.
  void clearAllCooldowns();
}
