import 'dart:async';
import 'dart:convert';

/// Estado operativo del Runner gRPC Satelital (§39, §45)
enum RunnerState { idle, running, draining, stopped, error }

/// Excepción base del protocolo satelital (§6)
abstract class SatelliteProtocolException implements Exception {
  final String message;
  final String? satelliteId;
  const SatelliteProtocolException(this.message, {this.satelliteId});

  @override
  String toString() => satelliteId != null
      ? 'SatelliteProtocolException($satelliteId): $message'
      : 'SatelliteProtocolException: $message';
}

/// Excepción lanzada cuando una operación o stream agota su tiempo límite (§6)
class SatelliteStreamTimeoutException extends SatelliteProtocolException {
  final Duration timeout;
  final String? commandId;
  const SatelliteStreamTimeoutException(
    super.message, {
    required this.timeout,
    this.commandId,
    super.satelliteId,
  });
}

/// Excepción lanzada cuando el canal satelital se desconecta inesperadamente (§6)
class SatelliteDisconnectedException extends SatelliteProtocolException {
  const SatelliteDisconnectedException(super.message, {super.satelliteId});
}

/// Excepción lanzada cuando el graceful drain excede su ventana de tiempo (§6)
class SatelliteDrainTimeoutException extends SatelliteProtocolException {
  final Duration drainWindow;
  const SatelliteDrainTimeoutException(
    super.message, {
    required this.drainWindow,
    super.satelliteId,
  });
}

/// Excepción lanzada ante payloads corruptos o inválidos (§6)
class InvalidProtocolPayloadException extends SatelliteProtocolException {
  final Object? rawPayload;
  const InvalidProtocolPayloadException(
    super.message, {
    this.rawPayload,
    super.satelliteId,
  });
}

/// Comando despachado hacia un satélite a través del stream bidireccional
class SatelliteCommandDispatch {
  final String commandId;
  final String satelliteId;
  final String action;
  final Map<String, dynamic> payload;
  final int timeoutMs;
  final DateTime timestamp;

  SatelliteCommandDispatch({
    required this.commandId,
    required this.satelliteId,
    required this.action,
    required this.payload,
    this.timeoutMs = 30000,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now().toUtc();

  factory SatelliteCommandDispatch.fromJson(Map<String, dynamic> json) {
    final dynamic cmdId = json['command_id'];
    final dynamic satId = json['satellite_id'];
    final dynamic act = json['action'];
    final dynamic rawPayload = json['payload'];

    if (cmdId == null || cmdId is! String || cmdId.trim().isEmpty) {
      throw InvalidProtocolPayloadException(
        'El campo command_id es obligatorio y no puede estar vacío',
        rawPayload: json,
      );
    }
    if (satId == null || satId is! String || satId.trim().isEmpty) {
      throw InvalidProtocolPayloadException(
        'El campo satellite_id es obligatorio y no puede estar vacío',
        rawPayload: json,
      );
    }
    if (act == null || act is! String || act.trim().isEmpty) {
      throw InvalidProtocolPayloadException(
        'El campo action es obligatorio y no puede estar vacío',
        rawPayload: json,
      );
    }
    if (rawPayload != null && rawPayload is! Map<String, dynamic>) {
      throw InvalidProtocolPayloadException(
        'El payload debe ser un objeto JSON (Map<String, dynamic>)',
        rawPayload: rawPayload,
      );
    }

    return SatelliteCommandDispatch(
      commandId: cmdId,
      satelliteId: satId,
      action: act,
      payload: (rawPayload as Map<String, dynamic>?) ?? <String, dynamic>{},
      timeoutMs: json['timeout_ms'] is int ? json['timeout_ms'] as int : 30000,
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'].toString())
          : DateTime.now().toUtc(),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'command_id': commandId,
    'satellite_id': satelliteId,
    'action': action,
    'payload': payload,
    'timeout_ms': timeoutMs,
    'timestamp': timestamp.toIso8601String(),
  };

  @override
  String toString() => jsonEncode(toJson());
}

/// Resultado retornado por el satélite tras ejecutar un comando
class SatelliteResultSink {
  final String commandId;
  final String satelliteId;
  final bool success;
  final Map<String, dynamic> resultPayload;
  final String? errorMessage;
  final int executionTimeMs;
  final DateTime timestamp;

  SatelliteResultSink({
    required this.commandId,
    required this.satelliteId,
    required this.success,
    Map<String, dynamic>? resultPayload,
    this.errorMessage,
    required this.executionTimeMs,
    DateTime? timestamp,
  }) : resultPayload = resultPayload ?? <String, dynamic>{},
       timestamp = timestamp ?? DateTime.now().toUtc();

  factory SatelliteResultSink.fromJson(Map<String, dynamic> json) {
    final dynamic cmdId = json['command_id'];
    final dynamic satId = json['satellite_id'];
    final dynamic succ = json['success'];

    if (cmdId == null || cmdId is! String || cmdId.trim().isEmpty) {
      throw InvalidProtocolPayloadException(
        'El campo command_id es obligatorio en SatelliteResultSink',
        rawPayload: json,
      );
    }
    if (satId == null || satId is! String || satId.trim().isEmpty) {
      throw InvalidProtocolPayloadException(
        'El campo satellite_id es obligatorio en SatelliteResultSink',
        rawPayload: json,
      );
    }
    if (succ == null || succ is! bool) {
      throw InvalidProtocolPayloadException(
        'El campo success debe ser un booleano',
        rawPayload: json,
      );
    }

    return SatelliteResultSink(
      commandId: cmdId,
      satelliteId: satId,
      success: succ,
      resultPayload: json['result_payload'] is Map<String, dynamic>
          ? json['result_payload'] as Map<String, dynamic>
          : <String, dynamic>{},
      errorMessage: json['error_message'] as String?,
      executionTimeMs: json['execution_time_ms'] is int
          ? json['execution_time_ms'] as int
          : 0,
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'].toString())
          : DateTime.now().toUtc(),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'command_id': commandId,
    'satellite_id': satelliteId,
    'success': success,
    'result_payload': resultPayload,
    if (errorMessage != null) 'error_message': errorMessage,
    'execution_time_ms': executionTimeMs,
    'timestamp': timestamp.toIso8601String(),
  };

  @override
  String toString() => jsonEncode(toJson());
}

/// Latido de salud y carga transmitido en el stream keep-alive (§45)
class SatelliteHeartbeat {
  final String satelliteId;
  final int sequenceNumber;
  final double loadAverage;
  final DateTime timestamp;

  SatelliteHeartbeat({
    required this.satelliteId,
    required this.sequenceNumber,
    required this.loadAverage,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now().toUtc();

  factory SatelliteHeartbeat.fromJson(Map<String, dynamic> json) {
    final dynamic satId = json['satellite_id'];
    final dynamic seq = json['sequence_number'];

    if (satId == null || satId is! String || satId.trim().isEmpty) {
      throw InvalidProtocolPayloadException(
        'satellite_id es requerido en SatelliteHeartbeat',
        rawPayload: json,
      );
    }
    if (seq == null || seq is! int) {
      throw InvalidProtocolPayloadException(
        'sequence_number es requerido y debe ser int',
        rawPayload: json,
      );
    }

    return SatelliteHeartbeat(
      satelliteId: satId,
      sequenceNumber: seq,
      loadAverage: (json['load_average'] is num)
          ? (json['load_average'] as num).toDouble()
          : 0.0,
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'].toString())
          : DateTime.now().toUtc(),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'satellite_id': satelliteId,
    'sequence_number': sequenceNumber,
    'load_average': loadAverage,
    'timestamp': timestamp.toIso8601String(),
  };

  @override
  String toString() => jsonEncode(toJson());
}

/// Canal bidireccional abstracto de streaming satelital (§39)
abstract interface class ISatelliteStreamChannel {
  Stream<SatelliteCommandDispatch> get commandStream;
  StreamSink<SatelliteResultSink> get resultSink;
  Stream<SatelliteHeartbeat> get heartbeatStream;
  StreamSink<SatelliteHeartbeat> get outboundHeartbeatSink;
  Future<void> close();
  bool get isClosed;
}

/// Implementación en memoria 100% Pure Dart del canal de streaming (§4, §39)
class InMemorySatelliteStreamChannel implements ISatelliteStreamChannel {
  final StreamController<SatelliteCommandDispatch> _commandController =
      StreamController<SatelliteCommandDispatch>.broadcast();
  final StreamController<SatelliteResultSink> _resultController =
      StreamController<SatelliteResultSink>.broadcast();
  final StreamController<SatelliteHeartbeat> _heartbeatController =
      StreamController<SatelliteHeartbeat>.broadcast();
  final StreamController<SatelliteHeartbeat> _outboundHeartbeatController =
      StreamController<SatelliteHeartbeat>.broadcast();

  bool _isClosed = false;

  @override
  Stream<SatelliteCommandDispatch> get commandStream =>
      _commandController.stream;

  StreamSink<SatelliteCommandDispatch> get inboundCommandSink =>
      _commandController.sink;

  @override
  StreamSink<SatelliteResultSink> get resultSink => _resultController.sink;

  Stream<SatelliteResultSink> get outboundResultStream =>
      _resultController.stream;

  @override
  Stream<SatelliteHeartbeat> get heartbeatStream => _heartbeatController.stream;

  StreamSink<SatelliteHeartbeat> get inboundHeartbeatSink =>
      _heartbeatController.sink;

  @override
  StreamSink<SatelliteHeartbeat> get outboundHeartbeatSink =>
      _outboundHeartbeatController.sink;

  Stream<SatelliteHeartbeat> get emittedHeartbeatStream =>
      _outboundHeartbeatController.stream;

  @override
  bool get isClosed => _isClosed;

  @override
  Future<void> close() async {
    if (_isClosed) return;
    _isClosed = true;
    await _commandController.close();
    await _resultController.close();
    await _heartbeatController.close();
    await _outboundHeartbeatController.close();
  }
}
