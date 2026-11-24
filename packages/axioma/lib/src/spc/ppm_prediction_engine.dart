import 'dart:math' as math;

/// Nivel o zona de riesgo de una tarea de desarrollo.
enum TaskRiskZone {
  green,
  amber,
  red;

  static TaskRiskZone fromString(String raw) {
    switch (raw.toUpperCase()) {
      case 'AMBER':
        return TaskRiskZone.amber;
      case 'RED':
      case 'ROJA':
        return TaskRiskZone.red;
      case 'GREEN':
      case 'VERDE':
      default:
        return TaskRiskZone.green;
    }
  }

  double get riskMultiplier {
    switch (this) {
      case TaskRiskZone.green:
        return 1.0;
      case TaskRiskZone.amber:
        return 1.6;
      case TaskRiskZone.red:
        return 2.5;
    }
  }
}

/// Registro histórico de ejecución para calibrar modelos PPM.
class ExecutionTelemetryRecord {
  final String sprintId;
  final String taskId;
  final int filesChanged;
  final int promptTokens;
  final TaskRiskZone zone;
  final double durationSeconds;
  final bool failed;
  final double testPassRatio;

  const ExecutionTelemetryRecord({
    required this.sprintId,
    required this.taskId,
    required this.filesChanged,
    required this.promptTokens,
    required this.zone,
    required this.durationSeconds,
    required this.failed,
    this.testPassRatio = 1.0,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'sprint_id': sprintId,
    'task_id': taskId,
    'files_changed': filesChanged,
    'prompt_tokens': promptTokens,
    'zone': zone.name,
    'duration_seconds': durationSeconds,
    'failed': failed,
    'test_pass_ratio': testPassRatio,
  };
}

/// Parámetros de entrada para perfilar y pronosticar un ticket.
class PpmTicketProfile {
  final int filesCount;
  final int promptTokens;
  final TaskRiskZone zone;
  final int historicalDefectDensity;

  const PpmTicketProfile({
    required this.filesCount,
    required this.promptTokens,
    this.zone = TaskRiskZone.green,
    this.historicalDefectDensity = 0,
  });

  void validate() {
    if (filesCount <= 0) {
      throw ArgumentError.value(
        filesCount,
        'filesCount',
        'El número de archivos debe ser mayor a 0.',
      );
    }
    if (promptTokens < 0) {
      throw ArgumentError.value(
        promptTokens,
        'promptTokens',
        'El tamaño de prompt no puede ser negativo.',
      );
    }
    if (historicalDefectDensity < 0) {
      throw ArgumentError.value(
        historicalDefectDensity,
        'historicalDefectDensity',
        'La densidad de defectos no puede ser negativa.',
      );
    }
  }
}

/// Intervalo de confianza estadístico para una métrica continua.
class ConfidenceInterval {
  final double lowerBound;
  final double upperBound;
  final double confidenceLevel;

  const ConfidenceInterval({
    required this.lowerBound,
    required this.upperBound,
    this.confidenceLevel = 0.95,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'lower_bound': lowerBound,
    'upper_bound': upperBound,
    'confidence_level': confidenceLevel,
  };

  @override
  String toString() =>
      '[$lowerBound, $upperBound] (${(confidenceLevel * 100).toStringAsFixed(1)}%)';
}

/// Resultado de la predicción cuantitativa emitida por el motor PPM.
class PpmPredictionResult {
  final double failureProbability;
  final double expectedDurationSeconds;
  final int expectedTokenConsumption;
  final ConfidenceInterval durationConfidenceInterval;
  final ConfidenceInterval failureConfidenceInterval;

  const PpmPredictionResult({
    required this.failureProbability,
    required this.expectedDurationSeconds,
    required this.expectedTokenConsumption,
    required this.durationConfidenceInterval,
    required this.failureConfidenceInterval,
  });

  bool exceedsRiskThreshold([double threshold = 0.35]) =>
      failureProbability >= threshold;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'failure_probability': failureProbability,
    'expected_duration_seconds': expectedDurationSeconds,
    'expected_token_consumption': expectedTokenConsumption,
    'duration_ci': durationConfidenceInterval.toJson(),
    'failure_ci': failureConfidenceInterval.toJson(),
    'high_risk_flag': exceedsRiskThreshold(),
  };
}

/// Motor de Predicción de Rendimiento de Procesos (PPM - CMMI Nivel 5).
///
/// Modela empíricamente y pronostica el comportamiento de tareas de desarrollo
/// antes de su ejecución o despacho a runners.
class PpmPredictionEngine {
  double _baseFailureProb = 0.05;
  final double _fileRiskSlope = 0.045;
  final double _tokenRiskSlope = 0.000015;
  final double _defectMultiplier = 0.03;

  double _baseDurationSec = 12.0;
  final double _fileDurationSlope = 7.5;
  final double _tokenDurationSlope = 0.0012;

  double _durationVariance = 16.0;
  bool _isCalibrated = false;

  bool get isCalibrated => _isCalibrated;

  /// Calibra los coeficientes estadísticos utilizando observaciones reales.
  void calibrate(List<ExecutionTelemetryRecord> observations) {
    if (observations.length < 3) {
      throw StateError(
        'Muestra de calibración insuficiente: se requieren al menos 3 observaciones históricas.',
      );
    }

    final double meanDuration =
        observations
            .map((ExecutionTelemetryRecord e) => e.durationSeconds)
            .reduce((double a, double b) => a + b) /
        observations.length;

    double varianceDuration = 0.0;
    for (final ExecutionTelemetryRecord obs in observations) {
      varianceDuration += math.pow(obs.durationSeconds - meanDuration, 2);
    }
    varianceDuration /= (observations.length - 1);

    if (varianceDuration <= 0.00001) {
      throw StateError(
        'Muestra de calibración degenerada: varianza nula detectada en la duración.',
      );
    }

    final int failCount = observations
        .where((ExecutionTelemetryRecord e) => e.failed)
        .length;
    _baseFailureProb = math.max(0.01, failCount / observations.length);
    _baseDurationSec = math.max(5.0, meanDuration * 0.4);
    _durationVariance = varianceDuration;
    _isCalibrated = true;
  }

  /// Ejecuta el pronóstico cuantitativo para un perfil de tarea.
  PpmPredictionResult predict(PpmTicketProfile profile) {
    profile.validate();

    final double zoneMultiplier = profile.zone.riskMultiplier;
    final double rawFailProb =
        (_baseFailureProb +
            (profile.filesCount * _fileRiskSlope) +
            (profile.promptTokens * _tokenRiskSlope) +
            (profile.historicalDefectDensity * _defectMultiplier)) *
        zoneMultiplier;

    final double failureProbability = math.min(1.0, math.max(0.0, rawFailProb));

    final double expectedDuration = math.max(
      1.0,
      (_baseDurationSec +
              (profile.filesCount * _fileDurationSlope) +
              (profile.promptTokens * _tokenDurationSlope)) *
          zoneMultiplier,
    );

    final int expectedTokens =
        profile.promptTokens + (profile.filesCount * 650);

    final double stdDevDuration = math.sqrt(_durationVariance);
    final double marginDuration =
        1.96 * (stdDevDuration / math.sqrt(profile.filesCount + 1));

    final ConfidenceInterval durationCi = ConfidenceInterval(
      lowerBound:
          math.max(1.0, (expectedDuration - marginDuration) * 100).round() /
          100,
      upperBound: ((expectedDuration + marginDuration) * 100).round() / 100,
      confidenceLevel: 0.95,
    );

    final double marginFail = math.min(0.20, failureProbability * 0.35);
    final ConfidenceInterval failureCi = ConfidenceInterval(
      lowerBound: math.max(
        0.0,
        ((failureProbability - marginFail) * 1000).round() / 1000,
      ),
      upperBound: math.min(
        1.0,
        ((failureProbability + marginFail) * 1000).round() / 1000,
      ),
      confidenceLevel: 0.95,
    );

    return PpmPredictionResult(
      failureProbability: (failureProbability * 1000).round() / 1000,
      expectedDurationSeconds: (expectedDuration * 100).round() / 100,
      expectedTokenConsumption: expectedTokens,
      durationConfidenceInterval: durationCi,
      failureConfidenceInterval: failureCi,
    );
  }
}
