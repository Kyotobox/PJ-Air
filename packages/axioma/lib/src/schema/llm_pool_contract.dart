/// llm_pool_contract.dart — Puerto Abstracto y Contratos del Pool de LLMs (§39, §45, §47, §53).
///
/// Define el puerto canónico abstracto [LlmPoolPort] para la federación y consumo de modelos de lenguaje
/// en toda la flota Conext, adhiriendo a:
/// - Pure Dart Core (§39): Completamente desacoplado de infraestructura (sin HTTP, sockets ni SDKs de terceros).
/// - Federación del Consejo y Piso Cognitivo Tier-2 Mandatorio (§53): Soporte nativo para jerarquías de modelos,
///   discriminación de tiers (Tier-1, Tier-2 SOTA, Tier-3 Deep) y compuerta fail-closed [LlmTierFloorUnmetException].
/// - Soberanía Offline-First (§45): DTOs preparados para retención asíncrona en colas SQLite WAL.
/// - Verdad Atómica (§47): Registro inmutable de tokens consumidos, proveedor real, modelo ejecutado y costo estimado.
library;

// =============================================================================
// ENUMS CANÓNICOS DEL SUBSISTEMA LLM POOL (§53)
// =============================================================================

/// Nivel o piso cognitivo del modelo de lenguaje (§53).
enum LlmTier {
  /// Tier 1: Inferencia ágil, volumen masivo y baja latencia (Gemini 2.0/2.5 Flash, Claude Haiku, GPT-4o-mini).
  tier1Fast('TIER_1_FAST', 1),

  /// Tier 2: Modelos SOTA para deliberación del Consejo, arquitectura y auditoría antagónica
  /// (Claude Opus/Sonnet 5.5, OpenAI GPT-6 Astra/o3-pro, Gemini 3.8 Pro).
  tier2Sota('TIER_2_SOTA', 2),

  /// Tier 3: Modelos de razonamiento profundo extremo o benchmarks de alta densidad (o3-pro, DeepSeek R1).
  tier3Deep('TIER_3_DEEP', 3);

  final String canonicalName;
  final int level;

  const LlmTier(this.canonicalName, this.level);

  /// Retorna true si este tier cumple o supera el nivel cognitivo de [requiredTier].
  bool meetsFloor(LlmTier requiredTier) => level >= requiredTier.level;

  /// Retorna true si corresponde a un modelo de alta capacidad Tier-2 o superior (§53).
  bool get isTier2OrHigher => level >= 2;

  /// Parsea un identificador textual a su enum canónico.
  static LlmTier fromString(String raw) {
    final String normalized = raw
        .trim()
        .toUpperCase()
        .replaceAll('-', '_')
        .replaceAll(' ', '_');
    switch (normalized) {
      case 'TIER1':
      case 'TIER_1':
      case 'TIER_1_FAST':
      case 'FAST':
      case 'FLASH':
      case 'HAIKU':
        return LlmTier.tier1Fast;
      case 'TIER2':
      case 'TIER_2':
      case 'TIER_2_SOTA':
      case 'SOTA':
      case 'SONNET':
      case 'OPUS':
      case 'PRO':
        return LlmTier.tier2Sota;
      case 'TIER3':
      case 'TIER_3':
      case 'TIER_3_DEEP':
      case 'DEEP':
      case 'REASONING':
        return LlmTier.tier3Deep;
      default:
        throw LlmPoolValidationException(
          'Nivel cognitivo LlmTier no reconocido: "$raw".',
          field: 'tier',
          rejectedValue: raw,
        );
    }
  }
}

/// Tipo de tarea especializada para optimizar la selección de modelo y prompt.
enum LlmTaskType {
  /// Dictamen o arbitraje del Consejo de Gobernanza (§53).
  governanceCouncil('GOVERNANCE_COUNCIL'),

  /// Síntesis de código, parsers o linters AST (§46).
  codeGeneration('CODE_GENERATION'),

  /// Razonamiento deliberativo o deducción de causa raíz.
  reasoning('REASONING'),

  /// Clasificación categórica de texto o intención.
  classification('CLASSIFICATION'),

  /// Extracción de entidades estructuradas (JSON).
  extraction('EXTRACTION'),

  /// Ingesta multimodal de documentos o imágenes.
  multimodal('MULTIMODAL'),

  /// Consulta general agnóstica.
  general('GENERAL');

  final String code;
  const LlmTaskType(this.code);

  static LlmTaskType fromString(String raw) {
    final String normalized = raw
        .trim()
        .toUpperCase()
        .replaceAll('-', '_')
        .replaceAll(' ', '_');
    for (final LlmTaskType type in LlmTaskType.values) {
      if (type.code == normalized || type.name.toUpperCase() == normalized) {
        return type;
      }
    }
    return LlmTaskType.general;
  }
}

/// Estado del resultado de despacho del pool.
enum LlmPoolStatus {
  /// Inferencia completada con éxito en el proveedor y modelo nominal.
  success('SUCCESS'),

  /// Inferencia resuelta tras conmutación a modelo secundario del mismo tier.
  fallbackDegraded('FALLBACK_DEGRADED'),

  /// Fallo definitivo en la ejecución.
  failed('FAILED'),

  /// Rechazo fail-closed por violación del piso cognitivo Tier-2 (§53).
  tierFloorUnmet('TIER_FLOOR_UNMET'),

  /// Todas las claves o proveedores del tier se encuentran agotados o en cooldown.
  quotaExhausted('QUOTA_EXHAUSTED'),

  /// Solicitud retenida de forma offline en SQLite WAL ante partición (§45).
  offlineRetained('OFFLINE_RETAINED');

  final String code;
  const LlmPoolStatus(this.code);
}

// =============================================================================
// EXCEPCIONES TIPADAS DEL SUBSISTEMA LLM POOL (§6 SAD PATH MANDATORIO)
// =============================================================================

/// Excepción base para fallos del subsistema de pools de LLM.
abstract class LlmPoolException implements Exception {
  final String message;
  final dynamic details;

  const LlmPoolException(this.message, {this.details});

  @override
  String toString() =>
      '$runtimeType: $message${details != null ? ' ($details)' : ''}';
}

/// Sad Path (§6): Violación de parámetros de la solicitud al pool.
class LlmPoolValidationException extends LlmPoolException {
  final String? field;
  final dynamic rejectedValue;

  const LlmPoolValidationException(
    super.message, {
    this.field,
    this.rejectedValue,
    super.details,
  });
}

/// Sad Path (§53): Principio de Piso Cognitivo violado (rechazo fail-closed).
class LlmTierFloorUnmetException extends LlmPoolException {
  final LlmTier requiredTier;
  final LlmTier? availableTier;

  LlmTierFloorUnmetException({
    required this.requiredTier,
    this.availableTier,
    String? message,
    super.details,
  }) : super(
         message ??
             'Violación de Piso Cognitivo (§53): Se requiere ${requiredTier.canonicalName}, '
                 'pero el tier disponible es ${availableTier?.canonicalName ?? "NINGUNO"}. '
                 'Degradación a modelos menores estrictamente prohibida.',
       );
}

/// Sad Path (§6): Todas las claves del proveedor o tier se encuentran agotadas o en cooldown.
class LlmPoolExhaustedException extends LlmPoolException {
  final String provider;
  final LlmTier? tier;
  final int totalKeys;

  LlmPoolExhaustedException({
    required this.provider,
    this.tier,
    this.totalKeys = 0,
    String? message,
    super.details,
  }) : super(
         message ??
             'Todas las claves registradas ($totalKeys) para el proveedor "$provider" '
                 '${tier != null ? "en tier ${tier.canonicalName} " : ""}se encuentran en cooldown o cuota agotada.',
       );
}

/// Sad Path (§6): Timeout en el despacho de inferencia.
class LlmPoolTimeoutException extends LlmPoolException {
  final Duration timeoutDuration;

  LlmPoolTimeoutException({
    required this.timeoutDuration,
    String? message,
    super.details,
  }) : super(
         message ??
             'La solicitud de inferencia excedió el tiempo límite de ${timeoutDuration.inSeconds}s.',
       );
}

/// Sad Path (§6): Fallo de autenticación o seguridad en claves del pool.
class LlmPoolSecurityException extends LlmPoolException {
  const LlmPoolSecurityException(super.message, {super.details});
}

// =============================================================================
// DTOS INMUTABLES DE ENTRADA Y SALIDA (§39, §47)
// =============================================================================

/// Solicitud tipada e inmutable de inferencia dirigida al pool de LLMs.
class LlmPoolRequest {
  final String id;
  final String sourceNode;
  final LlmTaskType taskType;
  final String prompt;
  final String systemInstruction;
  final LlmTier requiredTier;
  final String? preferredModel;
  final String? preferredProvider;
  final double temperature;
  final int? maxTokens;
  final Map<String, dynamic>? jsonSchema;
  final Duration timeout;
  final String idempotencyKey;
  final Map<String, dynamic> metadata;
  final List<Map<String, dynamic>> multimodalAttachments;

  LlmPoolRequest({
    required this.id,
    required this.sourceNode,
    this.taskType = LlmTaskType.general,
    required this.prompt,
    this.systemInstruction = '',
    this.requiredTier = LlmTier.tier1Fast,
    this.preferredModel,
    this.preferredProvider,
    this.temperature = 0.1,
    this.maxTokens,
    this.jsonSchema,
    this.timeout = const Duration(seconds: 15),
    String? idempotencyKey,
    Map<String, dynamic>? metadata,
    List<Map<String, dynamic>>? multimodalAttachments,
  }) : idempotencyKey = idempotencyKey ?? 'IDEM-$sourceNode-$id',
       metadata = Map<String, dynamic>.unmodifiable(
         metadata ?? <String, dynamic>{},
       ),
       multimodalAttachments = List<Map<String, dynamic>>.unmodifiable(
         multimodalAttachments ?? <Map<String, dynamic>>[],
       ) {
    if (id.trim().isEmpty) {
      throw const LlmPoolValidationException(
        'El identificador "id" de la solicitud no puede estar vacío.',
        field: 'id',
      );
    }
    if (sourceNode.trim().isEmpty) {
      throw const LlmPoolValidationException(
        'El nodo origen "sourceNode" no puede estar vacío (§56).',
        field: 'sourceNode',
      );
    }
    if (prompt.trim().isEmpty) {
      throw const LlmPoolValidationException(
        'El contenido del "prompt" no puede estar vacío.',
        field: 'prompt',
      );
    }
    if (temperature < 0.0 || temperature > 2.0) {
      throw LlmPoolValidationException(
        'La temperatura debe estar en el rango [0.0, 2.0]. Recibido: $temperature.',
        field: 'temperature',
        rejectedValue: temperature,
      );
    }
  }

  /// Constructor especializado para deliberaciones del Consejo (§53).
  /// Exige de forma inmutable el piso cognitivo [LlmTier.tier2Sota].
  factory LlmPoolRequest.council({
    required String id,
    required String sourceNode,
    required String prompt,
    String systemInstruction = '',
    String? preferredModel,
    String? idempotencyKey,
    Duration timeout = const Duration(seconds: 45),
    Map<String, dynamic>? metadata,
  }) => LlmPoolRequest(
    id: id,
    sourceNode: sourceNode,
    taskType: LlmTaskType.governanceCouncil,
    prompt: prompt,
    systemInstruction: systemInstruction,
    requiredTier: LlmTier.tier2Sota,
    preferredModel: preferredModel,
    idempotencyKey: idempotencyKey,
    timeout: timeout,
    metadata: metadata,
  );

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'source_node': sourceNode,
    'task_type': taskType.code,
    'prompt': prompt,
    'system_instruction': systemInstruction,
    'required_tier': requiredTier.canonicalName,
    if (preferredModel != null) 'preferred_model': preferredModel,
    if (preferredProvider != null) 'preferred_provider': preferredProvider,
    'temperature': temperature,
    if (maxTokens != null) 'max_tokens': maxTokens,
    if (jsonSchema != null) 'json_schema': jsonSchema,
    'timeout_ms': timeout.inMilliseconds,
    'idempotency_key': idempotencyKey,
    'metadata': metadata,
    'multimodal_attachments': multimodalAttachments,
  };

  factory LlmPoolRequest.fromJson(Map<String, dynamic> json) {
    return LlmPoolRequest(
      id: json['id'] as String? ?? '',
      sourceNode: json['source_node'] as String? ?? '',
      taskType: json['task_type'] != null
          ? LlmTaskType.fromString(json['task_type'] as String)
          : LlmTaskType.general,
      prompt: json['prompt'] as String? ?? '',
      systemInstruction: json['system_instruction'] as String? ?? '',
      requiredTier: json['required_tier'] != null
          ? LlmTier.fromString(json['required_tier'] as String)
          : LlmTier.tier1Fast,
      preferredModel: json['preferred_model'] as String?,
      preferredProvider: json['preferred_provider'] as String?,
      temperature: (json['temperature'] as num?)?.toDouble() ?? 0.1,
      maxTokens: json['max_tokens'] as int?,
      jsonSchema: json['json_schema'] as Map<String, dynamic>?,
      timeout: Duration(milliseconds: json['timeout_ms'] as int? ?? 15000),
      idempotencyKey: json['idempotency_key'] as String?,
      metadata:
          (json['metadata'] as Map<String, dynamic>?) ?? <String, dynamic>{},
      multimodalAttachments: (json['multimodal_attachments'] as List<dynamic>?)
          ?.map((dynamic e) => e as Map<String, dynamic>)
          .toList(),
    );
  }
}

/// Respuesta tipada e inmutable resultante de la ejecución en el pool.
class LlmPoolResponse {
  final String requestId;
  final String idempotencyKey;
  final String provider;
  final String modelUsed;
  final LlmTier modelTier;
  final String? keyId;
  final double latencyMs;
  final int inputTokens;
  final int outputTokens;
  final int totalTokens;
  final String rawText;
  final Map<String, dynamic>? structuredData;
  final LlmPoolStatus status;
  final double costUsd;
  final bool isCached;
  final String? errorDetails;

  const LlmPoolResponse({
    required this.requestId,
    required this.idempotencyKey,
    required this.provider,
    required this.modelUsed,
    required this.modelTier,
    this.keyId,
    required this.latencyMs,
    required this.inputTokens,
    required this.outputTokens,
    required this.totalTokens,
    required this.rawText,
    this.structuredData,
    this.status = LlmPoolStatus.success,
    this.costUsd = 0.0,
    this.isCached = false,
    this.errorDetails,
  });

  /// Factory para respuestas fallidas.
  factory LlmPoolResponse.failed({
    required String requestId,
    required String idempotencyKey,
    required String provider,
    required String modelUsed,
    required LlmTier modelTier,
    required String errorDetails,
    LlmPoolStatus status = LlmPoolStatus.failed,
    double latencyMs = 0.0,
  }) => LlmPoolResponse(
    requestId: requestId,
    idempotencyKey: idempotencyKey,
    provider: provider,
    modelUsed: modelUsed,
    modelTier: modelTier,
    latencyMs: latencyMs,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    rawText: '',
    status: status,
    errorDetails: errorDetails,
  );

  Map<String, dynamic> toJson() => <String, dynamic>{
    'request_id': requestId,
    'idempotency_key': idempotencyKey,
    'provider': provider,
    'model_used': modelUsed,
    'model_tier': modelTier.canonicalName,
    if (keyId != null) 'key_id': keyId,
    'latency_ms': latencyMs,
    'tokens': <String, dynamic>{
      'input': inputTokens,
      'output': outputTokens,
      'total': totalTokens,
    },
    'raw_text': rawText,
    if (structuredData != null) 'structured_data': structuredData,
    'status': status.code,
    'cost_usd': costUsd,
    'is_cached': isCached,
    if (errorDetails != null) 'error_details': errorDetails,
  };

  factory LlmPoolResponse.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> tokens =
        (json['tokens'] as Map<String, dynamic>?) ?? <String, dynamic>{};
    return LlmPoolResponse(
      requestId: json['request_id'] as String? ?? '',
      idempotencyKey: json['idempotency_key'] as String? ?? '',
      provider: json['provider'] as String? ?? '',
      modelUsed: json['model_used'] as String? ?? '',
      modelTier: json['model_tier'] != null
          ? LlmTier.fromString(json['model_tier'] as String)
          : LlmTier.tier1Fast,
      keyId: json['key_id'] as String?,
      latencyMs: (json['latency_ms'] as num?)?.toDouble() ?? 0.0,
      inputTokens: tokens['input'] as int? ?? 0,
      outputTokens: tokens['output'] as int? ?? 0,
      totalTokens: tokens['total'] as int? ?? 0,
      rawText: json['raw_text'] as String? ?? '',
      structuredData: json['structured_data'] as Map<String, dynamic>?,
      status: json['status'] != null
          ? LlmPoolStatus.values.firstWhere(
              (LlmPoolStatus s) => s.code == json['status'],
              orElse: () => LlmPoolStatus.failed,
            )
          : LlmPoolStatus.success,
      costUsd: (json['cost_usd'] as num?)?.toDouble() ?? 0.0,
      isCached: json['is_cached'] as bool? ?? false,
      errorDetails: json['error_details'] as String?,
    );
  }
}

/// Estado de una clave individual dentro del pool.
class LlmKeyStatus {
  final String keyId;
  final String provider;
  final bool isAvailable;
  final DateTime? cooldownUntil;
  final int totalRequests;
  final int totalErrors;

  const LlmKeyStatus({
    required this.keyId,
    required this.provider,
    required this.isAvailable,
    this.cooldownUntil,
    this.totalRequests = 0,
    this.totalErrors = 0,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'key_id': keyId,
    'provider': provider,
    'is_available': isAvailable,
    'cooldown_until': cooldownUntil?.toIso8601String(),
    'total_requests': totalRequests,
    'total_errors': totalErrors,
  };
}

/// Informe de disponibilidad y salud operativa del pool de LLMs.
class LlmPoolHealthReport {
  final DateTime timestamp;
  final int totalKeys;
  final int availableKeys;
  final int cooldownKeys;
  final Map<String, int> keysPerProvider;
  final Map<LlmTier, bool> tierAvailability;

  const LlmPoolHealthReport({
    required this.timestamp,
    required this.totalKeys,
    required this.availableKeys,
    required this.cooldownKeys,
    required this.keysPerProvider,
    required this.tierAvailability,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'timestamp': timestamp.toIso8601String(),
    'total_keys': totalKeys,
    'available_keys': availableKeys,
    'cooldown_keys': cooldownKeys,
    'keys_per_provider': keysPerProvider,
    'tier_availability': tierAvailability.map(
      (LlmTier tier, bool isAvail) =>
          MapEntry<String, bool>(tier.canonicalName, isAvail),
    ),
  };
}

// =============================================================================
// PUERTO ABSTRACTO CANÓNICO LLM POOL (PORTS & ADAPTERS / §39, §53)
// =============================================================================

/// Puerto abstracto canónico para pools de LLMs (§39 Pure Dart, §53 Federación del Consejo).
///
/// Desacopla estrictamente los Casos de Uso del dominio y la gobernanza de cualquier
/// implementación de infraestructura concreta (HTTP, WebSockets, colas, sockets o SDKs).
abstract class LlmPoolPort {
  /// Ejecuta una solicitud de inferencia a través del pool con rotación, mitigación de rate limits
  /// y cumplimiento estricto del piso cognitivo solicitado (§53).
  Future<LlmPoolResponse> execute(LlmPoolRequest request);

  /// Adquiere la siguiente API Key o credencial activa para un proveedor y/o tier específico.
  Future<String> acquireKey({
    String? provider,
    LlmTier? tier,
    String? model,
    DateTime? now,
  });

  /// Notifica que una clave completó exitosamente una invocación.
  void reportSuccess(
    String key, {
    required String provider,
    String? model,
    int? tokensConsumed,
  });

  /// Notifica que una clave recibió un HTTP 429 o rate limit temporal, activando su cooldown.
  void reportRateLimited(
    String key, {
    required String provider,
    Duration cooldown = const Duration(seconds: 60),
    DateTime? now,
  });

  /// Notifica que una clave agotó su cuota (HTTP 402/429 RESOURCE_EXHAUSTED), activando cooldown de 24h.
  void reportQuotaExhausted(
    String key, {
    required String provider,
    Duration cooldown = const Duration(hours: 24),
    DateTime? now,
  });

  /// Consulta si un nivel cognitivo [tier] cuenta con modelos y claves operativas en este instante.
  bool isTierAvailable(LlmTier tier, {DateTime? now});

  /// Genera un informe canónico del estado de salud del pool.
  LlmPoolHealthReport getHealthReport({DateTime? now});

  /// Lista de proveedores registrados y habilitados en el pool (ej. 'google', 'anthropic', 'openai').
  List<String> get registeredProviders;

  /// Lista de modelos disponibles actualmente (opcionalmente filtrados por [tier]).
  List<String> getAvailableModels({LlmTier? tier});
}
