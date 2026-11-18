// 🎯 Contrato y Modelo de Almacén de Sesiones FSM — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios,
// §12.b Límite 5 archivos, §39 Pure Dart, §40 Thin Client, §45 Soberanía Offline-First,
// §48 Cierre Autárquico, Calm Error UX.

import 'flow_state.dart';

/// Excepción canónica arrojada ante conflictos de concurrencia optimista en sesiones FSM (§6 Sad Path).
class OptimisticLockException implements Exception {
  final String sessionId;
  final int expectedVersion;
  final int actualVersion;
  final String message;

  const OptimisticLockException({
    required this.sessionId,
    required this.expectedVersion,
    required this.actualVersion,
    String? message,
  }) : message =
           message ??
           'Conflicto de bloqueo optimista para la sesión "$sessionId": '
               'se esperaba versión $expectedVersion pero la base de datos tiene versión $actualVersion.';

  @override
  String toString() => 'OptimisticLockException: $message';
}

/// Registro inmutable persistible de una sesión FSM con trazabilidad y versionado.
class FlowSessionRecord {
  final String sessionId;
  final FlowState flowState;
  final int stateVersion;
  final DateTime createdAt;
  final DateTime updatedAt;
  final Map<String, dynamic> metadata;

  const FlowSessionRecord({
    required this.sessionId,
    required this.flowState,
    this.stateVersion = 1,
    required this.createdAt,
    required this.updatedAt,
    this.metadata = const <String, dynamic>{},
  }) : assert(sessionId.length > 0, 'sessionId no puede ser vacío.'),
       assert(stateVersion >= 1, 'stateVersion debe ser mayor o igual a 1.');

  /// Fabrica una sesión inicial en versión 1 con timestamps UTC normalizados.
  factory FlowSessionRecord.initial({
    required String sessionId,
    required FlowState flowState,
    DateTime? now,
    Map<String, dynamic> metadata = const <String, dynamic>{},
  }) {
    final String cleanId = sessionId.trim();
    if (cleanId.isEmpty) {
      throw ArgumentError.value(
        sessionId,
        'sessionId',
        'El identificador de sesión no puede ser vacío.',
      );
    }
    final DateTime effectiveNow = (now ?? DateTime.now()).toUtc();
    return FlowSessionRecord(
      sessionId: cleanId,
      flowState: flowState,
      stateVersion: 1,
      createdAt: effectiveNow,
      updatedAt: effectiveNow,
      metadata: Map<String, dynamic>.unmodifiable(metadata),
    );
  }

  /// Genera una nueva versión consecutiva de la sesión (`stateVersion + 1`).
  FlowSessionRecord nextVersion({
    required FlowState flowState,
    DateTime? now,
    Map<String, dynamic>? metadata,
  }) {
    final DateTime effectiveNow = (now ?? DateTime.now()).toUtc();
    return FlowSessionRecord(
      sessionId: sessionId,
      flowState: flowState,
      stateVersion: stateVersion + 1,
      createdAt: createdAt,
      updatedAt: effectiveNow,
      metadata: metadata != null
          ? Map<String, dynamic>.unmodifiable(metadata)
          : this.metadata,
    );
  }

  /// Crea una copia con campos modificados preservando inmutabilidad.
  FlowSessionRecord copyWith({
    String? sessionId,
    FlowState? flowState,
    int? stateVersion,
    DateTime? createdAt,
    DateTime? updatedAt,
    Map<String, dynamic>? metadata,
  }) {
    return FlowSessionRecord(
      sessionId: sessionId ?? this.sessionId,
      flowState: flowState ?? this.flowState,
      stateVersion: stateVersion ?? this.stateVersion,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      metadata: metadata != null
          ? Map<String, dynamic>.unmodifiable(metadata)
          : this.metadata,
    );
  }

  /// Serializa el registro de sesión a un mapa JSON estándar.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'session_id': sessionId,
    'flow_state': flowState.toJson(),
    'state_version': stateVersion,
    'created_at': createdAt.toUtc().toIso8601String(),
    'updated_at': updatedAt.toUtc().toIso8601String(),
    'metadata': metadata,
  };

  /// Deserializa un registro de sesión a partir de un mapa JSON.
  factory FlowSessionRecord.fromJson(Map<String, dynamic> json) {
    final String rawId = json['session_id'] as String? ?? '';
    if (rawId.trim().isEmpty) {
      throw const FormatException(
        'El campo session_id es requerido en FlowSessionRecord.',
      );
    }
    final Map<String, dynamic> stateMap = json['flow_state'] is Map
        ? Map<String, dynamic>.from(json['flow_state'] as Map<dynamic, dynamic>)
        : <String, dynamic>{};
    final int stateVersion = (json['state_version'] as num?)?.toInt() ?? 1;
    final DateTime createdAt = json['created_at'] != null
        ? DateTime.parse(json['created_at'] as String).toUtc()
        : DateTime.now().toUtc();
    final DateTime updatedAt = json['updated_at'] != null
        ? DateTime.parse(json['updated_at'] as String).toUtc()
        : createdAt;
    final Map<String, dynamic> metadata = json['metadata'] is Map
        ? Map<String, dynamic>.from(json['metadata'] as Map<dynamic, dynamic>)
        : const <String, dynamic>{};

    return FlowSessionRecord(
      sessionId: rawId.trim(),
      flowState: flowStateFromJson(stateMap),
      stateVersion: stateVersion,
      createdAt: createdAt,
      updatedAt: updatedAt,
      metadata: Map<String, dynamic>.unmodifiable(metadata),
    );
  }

  @override
  String toString() =>
      'FlowSessionRecord(sessionId: $sessionId, version: $stateVersion, step: ${flowState.currentStep}, updated: $updatedAt)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is FlowSessionRecord &&
          runtimeType == other.runtimeType &&
          sessionId == other.sessionId &&
          stateVersion == other.stateVersion &&
          flowState.currentStep == other.flowState.currentStep &&
          createdAt == other.createdAt &&
          updatedAt == other.updatedAt;

  @override
  int get hashCode =>
      Object.hash(sessionId, stateVersion, createdAt, updatedAt);
}

/// Deserializador tolerante y puro para [FlowState] desde JSON (§39).
FlowState flowStateFromJson(Map<String, dynamic> map) {
  GentleExitResult? gentleExit;
  if (map['gentle_exit'] is Map) {
    final Map<String, dynamic> geMap = Map<String, dynamic>.from(
      map['gentle_exit'] as Map<dynamic, dynamic>,
    );
    gentleExit = GentleExitResult(
      mode: GentleExitMode.fromString(
        geMap['mode'] as String? ?? 'assertive_default',
      ),
      userMessage: geMap['user_message'] as String? ?? '',
      reason: geMap['reason'] as String? ?? '',
      metadata: geMap['metadata'] is Map
          ? Map<String, dynamic>.from(
              geMap['metadata'] as Map<dynamic, dynamic>,
            )
          : const <String, dynamic>{},
    );
  }

  return FlowState(
    currentStep: map['current_step'] as String? ?? 'initial',
    slots: map['slots'] is Map
        ? Map<String, dynamic>.from(map['slots'] as Map<dynamic, dynamic>)
        : const <String, dynamic>{},
    turnCount: (map['turn_count'] as num?)?.toInt() ?? 0,
    transitionCount: (map['transition_count'] as num?)?.toInt() ?? 0,
    isCompleted: map['is_completed'] as bool? ?? false,
    gentleExit: gentleExit,
    stepHistory:
        (map['step_history'] as List<dynamic>?)
            ?.map((dynamic e) => e.toString())
            .toList() ??
        const <String>[],
    metadata: map['metadata'] is Map
        ? Map<String, dynamic>.from(map['metadata'] as Map<dynamic, dynamic>)
        : const <String, dynamic>{},
  );
}

/// Contrato abstracto para almacenamiento y recuperación de sesiones FSM (§39, §45).
abstract interface class FlowSessionStore {
  /// TTL por defecto para sesiones conversacionales inactivas (24 horas).
  static const Duration defaultTtl = Duration(hours: 24);

  /// Carga una sesión activa por [sessionId], purgando perezosamente sesiones expiradas.
  ///
  /// Retorna `null` si la sesión no existe o si ha expirado (> TTL).
  FlowSessionRecord? loadSession(String sessionId, {DateTime? now});

  /// Persiste una sesión aplicando control de versión optimista (stateVersion).
  ///
  /// Arroja [OptimisticLockException] si se detecta colisión o discrepancia de versión.
  void saveSession(
    FlowSessionRecord session, {
    int? expectedVersion,
    DateTime? now,
    bool force = false,
  });

  /// Elimina una sesión por su [sessionId]. Retorna true si existía y fue removida.
  bool deleteSession(String sessionId);

  /// Verifica la existencia de una sesión activa no expirada.
  bool hasSession(String sessionId, {DateTime? now});

  /// Purga deterministamente todas las sesiones expiradas (> TTL).
  /// Retorna la cantidad de sesiones eliminadas.
  int purgeExpiredSessions({DateTime? now});

  /// Libera recursos o conexiones abiertas.
  void close();
}
