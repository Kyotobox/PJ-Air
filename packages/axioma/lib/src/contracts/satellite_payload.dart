// 🎯 Satellite Payload Contract — Contrato Canónico Pure Dart para Satélites (§39, §60.2)

/// Contrato tipado de carga de trabajo / job para satélites de producto.
class SatellitePayload {
  final String satelliteId;
  final String jobType;
  final String traceId;
  final Map<String, dynamic> data;
  final DateTime timestamp;
  final int schemaVersion;

  SatellitePayload({
    required this.satelliteId,
    required this.jobType,
    required this.traceId,
    required this.data,
    DateTime? timestamp,
    this.schemaVersion = 1,
  }) : timestamp = timestamp ?? DateTime.now().toUtc() {
    if (satelliteId.trim().isEmpty) {
      throw FormatException('satelliteId no puede ser vacío');
    }
    if (jobType.trim().isEmpty) {
      throw FormatException('jobType no puede ser vacío');
    }
    if (traceId.trim().isEmpty) {
      throw FormatException('traceId no puede ser vacío');
    }
    if (schemaVersion <= 0) {
      throw FormatException('schemaVersion debe ser positivo (> 0)');
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'satellite_id': satelliteId,
    'job_type': jobType,
    'trace_id': traceId,
    'data': data,
    'timestamp': timestamp.toIso8601String(),
    'schema_version': schemaVersion,
  };

  factory SatellitePayload.fromJson(Map<String, dynamic> json) {
    final dynamic sId = json['satellite_id'];
    final dynamic jType = json['job_type'];
    final dynamic tId = json['trace_id'];
    final dynamic sVer = json['schema_version'];

    if (sId is! String || sId.trim().isEmpty) {
      throw FormatException('satellite_id inválido o ausente');
    }
    if (jType is! String || jType.trim().isEmpty) {
      throw FormatException('job_type inválido o ausente');
    }
    if (tId is! String || tId.trim().isEmpty) {
      throw FormatException('trace_id inválido o ausente');
    }
    if (sVer != null && (sVer is! int || sVer <= 0)) {
      throw FormatException('schema_version inválido: $sVer');
    }

    return SatellitePayload(
      satelliteId: sId,
      jobType: jType,
      traceId: tId,
      data: (json['data'] as Map<String, dynamic>?) ?? <String, dynamic>{},
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'] as String)
          : DateTime.now().toUtc(),
      schemaVersion: (sVer as int?) ?? 1,
    );
  }
}
