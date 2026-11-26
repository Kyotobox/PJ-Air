/// model_capability_profile.dart — Perfiles de Capacidad Nominal de Modelos de Lenguaje (§4, §6, §39, §50, §60.2).
///
/// Registra las ventanas de contexto y umbrales operativos relativos de cada familia
/// de modelos LLM (Gemini 1M, Claude 200k, GPT 128k/200k), garantizando determinismo
/// offline-first para el Odómetro MCCV v3 sin depender de endpoints de red.
library;

/// Clasificación tripartita de zonas telemétricas de complejidad cognitiva (§50).
enum MccvZone {
  /// Zona óptima de inferencia y atención.
  green,

  /// Zona de alerta: memoria activa cercana al umbral de saturación.
  amber,

  /// Zona crítica de sobrecarga cognitiva y riesgo de lost-in-the-middle.
  red;

  String get label => switch (this) {
    MccvZone.green => 'VERDE',
    MccvZone.amber => 'ÁMBAR',
    MccvZone.red => 'ROJA',
  };

  int get exitCode => switch (this) {
    MccvZone.green => 0,
    MccvZone.amber => 1,
    MccvZone.red => 2,
  };

  String get action => switch (this) {
    MccvZone.green => 'CONTINUAR',
    MccvZone.amber => 'ALERTA',
    MccvZone.red => 'BLOQUEO',
  };
}

/// Perfil inmutable de capacidad y límites operativos de un modelo LLM (§50).
class ModelCapabilityProfile {
  /// Nombre identificador de la familia o modelo (ej. 'gemini-3.8-flash-high').
  final String modelFamily;

  /// Tamaño de la ventana de contexto nominal en tokens (ej. 1,000,000 para Gemini).
  final int contextWindow;

  /// Umbral relativo superior de Zona Verde (ej. 0.40 para 40%).
  final double greenThreshold;

  /// Umbral relativo superior de Zona Ámbar (ej. 0.60 para 60%). Superado este umbral, es Zona Roja.
  final double amberThreshold;

  const ModelCapabilityProfile({
    required this.modelFamily,
    required this.contextWindow,
    this.greenThreshold = 0.40,
    this.amberThreshold = 0.60,
  }) : assert(
         contextWindow > 0,
         'La ventana de contexto debe ser mayor a 0 tokens.',
       ),
       assert(
         greenThreshold > 0.0 && greenThreshold < amberThreshold,
         'greenThreshold debe ser > 0 y menor que amberThreshold.',
       ),
       assert(
         amberThreshold < 1.0,
         'amberThreshold debe ser estrictamente menor a 1.0.',
       );

  /// Perfil canónico para familia Gemini 1M (Gemini 3.8 Flash, Gemini 3.8 Pro, Gemini 1.5).
  static const ModelCapabilityProfile gemini1M = ModelCapabilityProfile(
    modelFamily: 'gemini-1m',
    contextWindow: 1000000,
    greenThreshold: 0.40,
    amberThreshold: 0.60,
  );

  /// Perfil canónico para familia Claude 200k (Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude Opus).
  static const ModelCapabilityProfile claude200k = ModelCapabilityProfile(
    modelFamily: 'claude-200k',
    contextWindow: 200000,
    greenThreshold: 0.40,
    amberThreshold: 0.60,
  );

  /// Perfil canónico para familia GPT/OpenAI (GPT-4o, o1, o3-pro).
  static const ModelCapabilityProfile gpt128k = ModelCapabilityProfile(
    modelFamily: 'gpt-128k',
    contextWindow: 128000,
    greenThreshold: 0.40,
    amberThreshold: 0.60,
  );

  /// Perfil fallback predeterminado ante modelos no identificados (200k conservador).
  static const ModelCapabilityProfile fallbackDefault = ModelCapabilityProfile(
    modelFamily: 'fallback-default',
    contextWindow: 200000,
    greenThreshold: 0.40,
    amberThreshold: 0.60,
  );

  /// Resuelve deterministamente el perfil de capacidad a partir del nombre del modelo (§47, §50).
  static ModelCapabilityProfile resolve(String? modelName) {
    if (modelName == null || modelName.trim().isEmpty) {
      return fallbackDefault;
    }

    final String lower = modelName.toLowerCase();
    if (lower.contains('gemini')) {
      return gemini1M;
    } else if (lower.contains('claude')) {
      return claude200k;
    } else if (lower.contains('gpt') ||
        lower.contains('o1') ||
        lower.contains('o3')) {
      return gpt128k;
    }

    return fallbackDefault;
  }

  /// Evalúa la zona operativa correspondiente a un porcentaje de odómetro dado [odometerPct].
  MccvZone evaluateZone(double odometerPct) {
    final double normalized = odometerPct / 100.0;
    if (normalized >= amberThreshold) {
      return MccvZone.red;
    } else if (normalized >= greenThreshold) {
      return MccvZone.amber;
    }
    return MccvZone.green;
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'model_family': modelFamily,
    'context_window': contextWindow,
    'green_threshold': greenThreshold,
    'amber_threshold': amberThreshold,
  };

  factory ModelCapabilityProfile.fromJson(Map<String, dynamic> json) {
    return ModelCapabilityProfile(
      modelFamily: json['model_family'] as String? ?? 'custom',
      contextWindow: (json['context_window'] as num?)?.toInt() ?? 200000,
      greenThreshold: (json['green_threshold'] as num?)?.toDouble() ?? 0.40,
      amberThreshold: (json['amber_threshold'] as num?)?.toDouble() ?? 0.60,
    );
  }
}
