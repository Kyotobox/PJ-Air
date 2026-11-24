// 🎯 SynapseHealthValidator — Validador Puro de Métricas y Pulsos de Salud Synapse (§39, §60.8)

/// Resultado inmutable de la evaluación de salud Synapse sin I/O.
class HealthValidationResult {
  final bool isHealthy;
  final String nodeId;
  final int latencyMs;
  final bool isDegraded;
  final List<String> activeSkills;
  final List<String> anomalies;

  const HealthValidationResult({
    required this.isHealthy,
    required this.nodeId,
    required this.latencyMs,
    required this.isDegraded,
    this.activeSkills = const <String>[],
    this.anomalies = const <String>[],
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'is_healthy': isHealthy,
    'node_id': nodeId,
    'latency_ms': latencyMs,
    'is_degraded': isDegraded,
    'active_skills': activeSkills,
    'anomalies': anomalies,
  };
}

/// Validador puramente matemático y algorítmico (Pure Dart §39) para estados de salud Synapse.
class SynapseHealthValidator {
  static const int defaultMaxLatencyMs = 2000;
  static const int defaultWarningLatencyMs = 800;
  static const Duration maxFutureSkew = Duration(minutes: 5);

  /// Valida una carga útil de reporte de salud emitido por un nodo Synapse.
  static HealthValidationResult validateHealthReport(
    Map<String, dynamic> report, {
    int maxLatencyMs = defaultMaxLatencyMs,
    DateTime? referenceTime,
  }) {
    if (report.isEmpty) {
      throw const FormatException('El reporte de salud no puede estar vacío');
    }

    final dynamic nId = report['node_id'];
    if (nId is! String || nId.trim().isEmpty) {
      throw const FormatException(
        'node_id inválido o ausente en reporte de salud',
      );
    }
    final String cleanNodeId = nId.trim();

    final dynamic lat = report['latency_ms'];
    if (lat is! int || lat < 0) {
      throw const FormatException(
        'latency_ms inválido: debe ser un entero no negativo',
      );
    }

    final dynamic reach = report['is_reachable'];
    if (reach is! bool) {
      throw const FormatException('is_reachable inválido: debe ser booleano');
    }

    final dynamic tsStr = report['timestamp'];
    if (tsStr is! String || tsStr.trim().isEmpty) {
      throw const FormatException(
        'timestamp inválido o ausente en reporte de salud',
      );
    }

    final DateTime reportTime;
    try {
      reportTime = DateTime.parse(tsStr).toUtc();
    } catch (_) {
      throw const FormatException('Formato de fecha inválido en timestamp');
    }

    final DateTime now = (referenceTime ?? DateTime.now()).toUtc();
    if (reportTime.isAfter(now.add(maxFutureSkew))) {
      throw FormatException(
        'Timestamp en el futuro detectado (desfase > 5min): $tsStr',
      );
    }

    final List<String> anomalies = <String>[];
    final bool isDegraded =
        lat >= defaultWarningLatencyMs || lat > maxLatencyMs;

    if (lat > maxLatencyMs) {
      anomalies.add('Latencia crítica excedida ($lat ms > $maxLatencyMs ms)');
    } else if (lat >= defaultWarningLatencyMs) {
      anomalies.add(
        'Latencia en zona de advertencia ($lat ms >= $defaultWarningLatencyMs ms)',
      );
    }

    if (!reach) {
      anomalies.add('Nodo reportado como no alcanzable');
    }

    final List<dynamic>? rawSkills = report['active_skills'] as List<dynamic>?;
    final List<String> skills = rawSkills != null
        ? rawSkills.map((dynamic e) => e.toString().trim()).toList()
        : <String>[];

    final bool isHealthy = reach && lat <= maxLatencyMs && anomalies.isEmpty;

    return HealthValidationResult(
      isHealthy: isHealthy,
      nodeId: cleanNodeId,
      latencyMs: lat,
      isDegraded: isDegraded || !reach,
      activeSkills: skills,
      anomalies: anomalies,
    );
  }

  /// Valida una sonda atómica de ping sin I/O.
  static HealthValidationResult validatePingPayload({
    required String nodeId,
    required int latencyMs,
    required DateTime timestamp,
    int maxAllowedLatencyMs = defaultMaxLatencyMs,
    DateTime? referenceTime,
  }) {
    if (nodeId.trim().isEmpty) {
      throw const FormatException('nodeId no puede estar vacío');
    }
    if (latencyMs < 0) {
      throw const FormatException('latencyMs no puede ser negativo');
    }

    final DateTime now = (referenceTime ?? DateTime.now()).toUtc();
    final DateTime checkTs = timestamp.toUtc();
    if (checkTs.isAfter(now.add(maxFutureSkew))) {
      throw const FormatException(
        'Timestamp en el futuro detectado en payload de ping',
      );
    }

    final List<String> anomalies = <String>[];
    if (latencyMs > maxAllowedLatencyMs) {
      anomalies.add('Latencia excede el umbral máximo ($latencyMs ms)');
    }

    final bool isDegraded = latencyMs >= defaultWarningLatencyMs;

    return HealthValidationResult(
      isHealthy: anomalies.isEmpty,
      nodeId: nodeId.trim(),
      latencyMs: latencyMs,
      isDegraded: isDegraded,
      anomalies: anomalies,
    );
  }
}
