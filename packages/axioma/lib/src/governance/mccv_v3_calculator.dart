/// mccv_v3_calculator.dart — Calculador Matemático Puro de Complejidad Cognitiva v3 (MCCV v3) (§4, §6, §39, §50, §60.2).
///
/// Implementa el Motor Matemático Canónico MCCV v3 acordado por el Consejo Tier-2:
/// - Desmantela la heurística de bytes crudos y el techo estático de 500kB.
/// - Integra la telemetría real de tokens (input_tokens + cache_read_tokens) contra la ventana nominal del modelo.
/// - Aplica umbrales relativos Lean: Verde <40%, Ámbar 40%-60%, Roja >60% (exit code 2 bloqueante).
library;

import 'dart:math';
import 'model_capability_profile.dart';
import 'token_telemetry_extractor.dart';

/// Ponderaciones dimensionales normalizadas del vector MCCV v3 (§50).
class MccvV3Weights {
  /// Peso de la saturación de contexto (0.30).
  final double contextSaturation;

  /// Peso de la densidad de llamadas a herramientas (0.30).
  final double toolCallDensity;

  /// Peso de la dispersión de mutaciones sobre archivos (0.20).
  final double mutationDispersion;

  /// Peso de la entropía de pasos fallidos o errores (0.20).
  final double failureEntropy;

  const MccvV3Weights({
    this.contextSaturation = 0.30,
    this.toolCallDensity = 0.30,
    this.mutationDispersion = 0.20,
    this.failureEntropy = 0.20,
  });

  /// Valida que la suma de pesos sea exactamente 1.0 dentro de un margen épsilon.
  void validate() {
    final double sum =
        contextSaturation +
        toolCallDensity +
        mutationDispersion +
        failureEntropy;
    if ((sum - 1.0).abs() > 1e-6) {
      throw ArgumentError(
        'La suma de las ponderaciones de MCCV v3 debe ser exactamente 1.0 (actual: $sum).',
      );
    }
    if (contextSaturation < 0.0 ||
        toolCallDensity < 0.0 ||
        mutationDispersion < 0.0 ||
        failureEntropy < 0.0) {
      throw ArgumentError(
        'Ninguna ponderación dimensional de MCCV v3 puede ser negativa.',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'context_saturation': contextSaturation,
    'tool_call_density': toolCallDensity,
    'mutation_dispersion': mutationDispersion,
    'failure_entropy': failureEntropy,
  };
}

/// Resultado inmutable estructurado de la evaluación MCCV v3 (§50).
class MccvV3Result {
  final double contextSaturation;
  final double toolCallDensity;
  final double mutationDispersion;
  final double failureEntropy;
  final double compositeScore;
  final double odometerPct;
  final double peakDepth;
  final MccvZone zone;
  final int exitCode;
  final String action;
  final ModelCapabilityProfile profile;
  final int activeTokens;
  final int toolCallsCount;
  final int userTurnsCount;
  final int touchedFilesCount;
  final int failedStepsCount;

  const MccvV3Result({
    required this.contextSaturation,
    required this.toolCallDensity,
    required this.mutationDispersion,
    required this.failureEntropy,
    required this.compositeScore,
    required this.odometerPct,
    required this.peakDepth,
    required this.zone,
    required this.exitCode,
    required this.action,
    required this.profile,
    required this.activeTokens,
    required this.toolCallsCount,
    required this.userTurnsCount,
    required this.touchedFilesCount,
    required this.failedStepsCount,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'context_saturation': contextSaturation,
    'tool_call_density': toolCallDensity,
    'mutation_dispersion': mutationDispersion,
    'failure_entropy': failureEntropy,
    'composite_score': compositeScore,
    'odometer_pct': odometerPct,
    'peak_depth': peakDepth,
    'zone': zone.label,
    'exit_code': exitCode,
    'action': action,
    'profile': profile.toJson(),
    'active_tokens': activeTokens,
    'tool_calls_count': toolCallsCount,
    'user_turns_count': userTurnsCount,
    'touched_files_count': touchedFilesCount,
    'failed_steps_count': failedStepsCount,
  };
}

/// Motor calculador puro de Complejidad Cognitiva v3 (MCCV v3) (§4, §39, §50).
class MccvV3Calculator {
  final MccvV3Weights weights;

  const MccvV3Calculator({this.weights = const MccvV3Weights()});

  /// Computa el vector multidimensional MCCV v3 y evalúa la zona de odómetro resultante.
  MccvV3Result compute({
    required TokenTelemetrySnapshot telemetry,
    required int toolCallsCount,
    required int userTurnsCount,
    required int touchedFilesCount,
    required int failedStepsCount,
    ModelCapabilityProfile? profile,
    double priorPeakDepth = 0.0,
  }) {
    weights.validate();

    if (toolCallsCount < 0) {
      throw ArgumentError(
        'toolCallsCount no puede ser negativo: $toolCallsCount',
      );
    }
    if (userTurnsCount < 0) {
      throw ArgumentError(
        'userTurnsCount no puede ser negativo: $userTurnsCount',
      );
    }
    if (touchedFilesCount < 0) {
      throw ArgumentError(
        'touchedFilesCount no puede ser negativo: $touchedFilesCount',
      );
    }
    if (failedStepsCount < 0) {
      throw ArgumentError(
        'failedStepsCount no puede ser negativo: $failedStepsCount',
      );
    }
    if (priorPeakDepth < 0.0 || priorPeakDepth > 100.0) {
      throw ArgumentError(
        'priorPeakDepth debe estar entre 0.0 y 100.0: $priorPeakDepth',
      );
    }

    final ModelCapabilityProfile resolvedProfile =
        profile ?? ModelCapabilityProfile.resolve(telemetry.model);

    // 1. Dimensión 1: Saturación de Contexto (ContextSat)
    final double contextSat;
    final int activeTokens = telemetry.currentContextTokens;
    if (activeTokens > 0) {
      contextSat = min(
        1.0,
        max(
          0.0,
          activeTokens.toDouble() / resolvedProfile.contextWindow.toDouble(),
        ),
      );
    } else {
      // Fallback heurístico si no hay telemetría de tokens en sesión
      contextSat = min(1.0, max(0.0, userTurnsCount.toDouble() / 25.0));
    }

    // 2. Dimensión 2: Densidad de Llamadas a Herramientas (ToolDensity)
    final int effectiveTurns = max(3, userTurnsCount);
    final int netTools = max(0, toolCallsCount - 4);
    final double toolDensity = min(
      1.0,
      netTools.toDouble() / (effectiveTurns.toDouble() * 12.0),
    );

    // 3. Dimensión 3: Dispersión de Mutaciones (MutationDisp)
    final double mutationDisp = min(1.0, touchedFilesCount.toDouble() / 10.0);

    // 4. Dimensión 4: Entropía de Fallos (FailEntropy)
    final int totalEvents = max(1, userTurnsCount + toolCallsCount);
    final double failEntropy = failedStepsCount > 0
        ? min(1.0, failedStepsCount.toDouble() / totalEvents.toDouble())
        : 0.0;

    // Ponderación canónica
    final double compositeScore =
        (contextSat * weights.contextSaturation) +
        (toolDensity * weights.toolCallDensity) +
        (mutationDisp * weights.mutationDispersion) +
        (failEntropy * weights.failureEntropy);

    final double rawOdometerPct = compositeScore * 100.0;
    final double peakDepth = max(priorPeakDepth, rawOdometerPct);

    final MccvZone zone = resolvedProfile.evaluateZone(peakDepth);

    return MccvV3Result(
      contextSaturation: contextSat,
      toolCallDensity: toolDensity,
      mutationDispersion: mutationDisp,
      failureEntropy: failEntropy,
      compositeScore: compositeScore,
      odometerPct: rawOdometerPct,
      peakDepth: peakDepth,
      zone: zone,
      exitCode: zone.exitCode,
      action: zone.action,
      profile: resolvedProfile,
      activeTokens: activeTokens,
      toolCallsCount: toolCallsCount,
      userTurnsCount: userTurnsCount,
      touchedFilesCount: touchedFilesCount,
      failedStepsCount: failedStepsCount,
    );
  }
}
