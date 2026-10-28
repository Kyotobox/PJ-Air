/// ClaudeKeyPool & Cryptographic Slot Manager (SPEC-PTG-TOKEN-01 / TASK-G205-02)
///
/// Gestiona cuotas multi-clave para APIs de Claude, imponiendo la compuerta
/// criptográfica de PTG-Token para slots de Tier 2 con fail-safe downgrade a Tier 1.
/// Adhiere estrictamente a Pure Dart Core (§39).
library;

import 'dart:io';
import '../crypto/ptg_token_verifier.dart';
import 'key_pool_base.dart';

/// Niveles de servicio de inferencia en la factoría CONEXT
enum ClaudeTier {
  /// Modelos ligeros y rápidos (Haiku 3.5, Sonnet 3.5 básico)
  tier1,

  /// Modelos de alta capacidad restringidos por Moat Criptográfico (Sonnet 5.5, Opus 5)
  tier2,
}

/// Concesión inmutable de slot para consumo de LLM
class ClaudeSlotGrant {
  final String key;
  final ClaudeTier tier;
  final String model;
  final bool isDowngraded;
  final String? downgradeReason;
  final String? ptgJti;

  const ClaudeSlotGrant({
    required this.key,
    required this.tier,
    required this.model,
    this.isDowngraded = false,
    this.downgradeReason,
    this.ptgJti,
  });

  @override
  String toString() {
    if (isDowngraded) {
      return '[CLAUDE_SLOT: DOWNGRADED -> TIER 1] Model: $model | Reason: $downgradeReason';
    }
    return '[CLAUDE_SLOT: ${tier.name.toUpperCase()}] Model: $model | JTI: $ptgJti';
  }
}

/// Excepción lanzada cuando no hay claves disponibles en el pool solicitado
class ClaudePoolExhaustedException implements Exception {
  final int totalKeys;
  final ClaudeTier tier;
  final String message;

  const ClaudePoolExhaustedException({
    required this.totalKeys,
    required this.tier,
    this.message =
        'Todas las claves del pool se encuentran en cooldown activo.',
  });

  @override
  String toString() =>
      '[CLAUDE_POOL_EXHAUSTED] (${tier.name}, $totalKeys claves): $message';
}

/// Gestor multi-clave para Claude con compuerta PTG-Token y fail-safe downgrade
class ClaudeKeyPool implements KeyPool {
  final List<String> _keys;
  final Map<String, DateTime> _cooldowns;
  final PtgTokenVerifier _verifier;
  final String defaultTier1Model;
  final void Function(String message)? auditLogger;
  int _currentIndex;
  int _totalGrants = 0;
  int _totalDowngrades = 0;
  String? _lastDowngradeReason;

  ClaudeKeyPool({
    required List<String> keys,
    PtgTokenVerifier? verifier,
    String? publicKeyPemPath,
    List<int>? defaultPublicKeyBytes,
    Map<String, DateTime>? initialCooldowns,
    this.defaultTier1Model = 'claude-3-5-haiku',
    this.auditLogger,
    int initialIndex = 0,
  }) : _keys = List<String>.from(keys.where((String k) => k.trim().isNotEmpty)),
       _cooldowns = initialCooldowns != null
           ? Map<String, DateTime>.from(initialCooldowns)
           : <String, DateTime>{},
       _verifier =
           verifier ??
           PtgTokenVerifier(
             defaultPublicKeyBytes: defaultPublicKeyBytes,
             publicKeyPemPath: publicKeyPemPath,
           ),
       _currentIndex = initialIndex {
    if (_keys.isEmpty) {
      throw ArgumentError.value(
        keys,
        'keys',
        'El pool de Claude requiere al menos una clave válida.',
      );
    }
  }

  /// Total de concesiones Tier 2 aprobadas criptográficamente
  int get totalGrants => _totalGrants;

  /// Total de solicitudes Tier 2 degradadas a Tier 1
  int get totalDowngrades => _totalDowngrades;

  /// Último motivo de degradación registrado
  String? get lastDowngradeReason => _lastDowngradeReason;

  /// Claves registradas (inmutables)
  @override
  List<String> get keys => List<String>.unmodifiable(_keys);

  /// Cooldowns activos
  @override
  Map<String, DateTime> get cooldowns =>
      Map<String, DateTime>.unmodifiable(_cooldowns);

  /// Verificador criptográfico asociado
  PtgTokenVerifier get verifier => _verifier;

  /// Índice circular actual del pool
  @override
  int get currentIndex => _currentIndex;

  /// Cantidad total de claves válidas registradas
  @override
  int get length => _keys.length;

  /// Obtiene la siguiente clave disponible
  @override
  String get nextKey => acquireNextKey();

  /// Adquiere la siguiente clave disponible avanzando el puntero de rotación
  @override
  String acquireNextKey({DateTime? now}) => _acquireNextKey(now: now);

  /// Retorna si una clave está disponible para despacho
  @override
  bool isKeyAvailable(String key, {DateTime? now}) {
    if (!_keys.contains(key)) return false;
    final DateTime current = now ?? DateTime.now();
    final DateTime? cooldownUntil = _cooldowns[key];
    if (cooldownUntil == null) return true;
    return current.isAfter(cooldownUntil) ||
        current.isAtSameMomentAs(cooldownUntil);
  }

  /// Adquiere una clave disponible mediante Round-Robin
  String _acquireNextKey({DateTime? now, ClaudeTier tier = ClaudeTier.tier1}) {
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

    throw ClaudePoolExhaustedException(
      totalKeys: count,
      tier: tier,
      message: 'Todas las $count claves de Claude están en cooldown activo.',
    );
  }

  /// Adquiere un slot de inferencia evaluando la autorización criptográfica del PTG-Token
  Future<ClaudeSlotGrant> acquireSlot({
    String? ptgToken,
    String? requestedModel,
    DateTime? now,
    List<int>? customPublicKeyBytes,
  }) async {
    final String targetModel = requestedModel ?? defaultTier1Model;
    final bool requiresTier2 = kTier2AllowedModels.contains(targetModel);

    // Caso 1: Tarea requiere Tier 2
    if (requiresTier2) {
      final PtgTokenValidationResult validation = await _verifier.validate(
        ptgToken,
        currentTime: now,
        customPublicKeyBytes: customPublicKeyBytes,
      );

      if (validation.isValid) {
        // Concesión legítima de Tier 2
        _totalGrants++;
        _emitAuditLog(
          '[SECURITY_AUDIT: PTG_GRANT] Tier: TIER 2 | Model: $targetModel | JTI: ${validation.jti}',
        );
        final String key = _acquireNextKey(now: now, tier: ClaudeTier.tier2);
        return ClaudeSlotGrant(
          key: key,
          tier: ClaudeTier.tier2,
          model: targetModel,
          isDowngraded: false,
          ptgJti: validation.jti,
        );
      }

      // FAIL-SAFE DOWNGRADE: No crashear, degradar a Tier 1 con telemetría de auditoría
      _totalDowngrades++;
      final String reason =
          validation.reason ?? 'Token inválido sin motivo explícito';
      _lastDowngradeReason = reason;
      _emitAuditLog(
        '[SECURITY_AUDIT: PTG_DOWNGRADE] Motivo: $reason | RequestedModel: $targetModel',
      );

      final String key = _acquireNextKey(now: now, tier: ClaudeTier.tier1);
      return ClaudeSlotGrant(
        key: key,
        tier: ClaudeTier.tier1,
        model: defaultTier1Model,
        isDowngraded: true,
        downgradeReason: reason,
      );
    }

    // Caso 2: Tarea en Tier 1 estándar (no requiere PTG-Token)
    final String key = _acquireNextKey(now: now, tier: ClaudeTier.tier1);
    return ClaudeSlotGrant(
      key: key,
      tier: ClaudeTier.tier1,
      model: targetModel,
      isDowngraded: false,
    );
  }

  void _emitAuditLog(String message) {
    if (auditLogger != null) {
      auditLogger!(message);
    } else {
      stderr.writeln(message);
    }
  }

  /// Marca una clave como agotada por cuota diaria
  @override
  void markQuotaExhausted(
    String key, {
    Duration duration = const Duration(hours: 24),
    DateTime? now,
  }) {
    final DateTime current = now ?? DateTime.now();
    _cooldowns[key] = current.add(duration);
  }

  /// Marca una clave con rate-limit temporal (HTTP 429)
  @override
  void markRateLimited(String key, {double cooldownSec = 60.0, DateTime? now}) {
    final DateTime current = now ?? DateTime.now();
    final int millis = (cooldownSec * 1000).round();
    _cooldowns[key] = current.add(Duration(milliseconds: millis));
  }

  /// Limpia el cooldown de una clave
  @override
  void resetCooldown(String key) {
    _cooldowns.remove(key);
  }

  /// Limpia todos los cooldowns registrados
  @override
  void clearAllCooldowns() {
    _cooldowns.clear();
  }

  /// Carga el pool desde variables de entorno
  factory ClaudeKeyPool.fromEnvironment({
    String prefix = 'CLAUDE_API_KEY',
    Map<String, String>? environment,
    PtgTokenVerifier? verifier,
    String? publicKeyPemPath,
    void Function(String message)? auditLogger,
  }) {
    final Map<String, String> env = environment ?? Platform.environment;
    final List<String> gathered = <String>[];

    final String? primary = env[prefix];
    if (primary != null && primary.trim().isNotEmpty) {
      gathered.add(primary.trim());
    }

    for (int i = 1; i <= 20; i++) {
      final String? indexed = env['${prefix}_$i'];
      if (indexed != null && indexed.trim().isNotEmpty) {
        if (!gathered.contains(indexed.trim())) {
          gathered.add(indexed.trim());
        }
      }
    }

    if (gathered.isEmpty) {
      throw StateError(
        'No se encontraron variables de entorno para el pool de Claude con prefijo $prefix',
      );
    }

    final String? pemPath =
        publicKeyPemPath ??
        env['PTG_ORCHESTRATOR_PUBLIC_KEY_PEM_PATH'] ??
        env['PTG_ORCHESTRATOR_PUBLIC_KEY_PATH'];

    return ClaudeKeyPool(
      keys: gathered,
      verifier: verifier,
      publicKeyPemPath: pemPath,
      auditLogger: auditLogger,
    );
  }
}
