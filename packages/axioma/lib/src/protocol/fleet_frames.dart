import 'dart:convert';
import 'dart:typed_data';

/// Esquemas canónicos Protobuf y Protocolo de Tramas Inter-Runtime (§39, §45).
///
/// Implementación Pure Dart de serialización y deserialización binaria compatible
/// con Protobuf v3 para comunicación de ultra baja latencia entre satélites
/// y el Kernel sobre sockets Unix Domain (UDS).

/// Definición canónica del archivo .proto (§45)
abstract final class FleetFramesProto {
  static const String schemaDefinition = r'''
syntax = "proto3";

package fleet.protocol;

enum FrameType {
  FRAME_TYPE_UNSPECIFIED = 0;
  FRAME_TYPE_HANDSHAKE = 1;
  FRAME_TYPE_HEARTBEAT = 2;
  FRAME_TYPE_DISPATCH = 3;
  FRAME_TYPE_RESULT = 4;
}

message HandshakeFrame {
  string satellite_id = 1;
  string version = 2;
  repeated string capabilities = 3;
  map<string, string> metadata = 4;
  int64 timestamp_utc_ms = 5;
}

message HeartbeatFrame {
  string satellite_id = 1;
  int64 sequence_number = 2;
  double load_average = 3;
  int64 memory_usage_bytes = 4;
  int64 timestamp_utc_ms = 5;
}

message DispatchFrame {
  string command_id = 1;
  string target_satellite_id = 2;
  string action = 3;
  string payload_json = 4;
  int64 timeout_ms = 5;
  int32 priority = 6;
  int64 timestamp_utc_ms = 7;
}

message ResultFrame {
  string command_id = 1;
  string satellite_id = 2;
  bool success = 3;
  string result_payload_json = 4;
  string error_message = 5;
  int64 execution_time_ms = 6;
  int64 timestamp_utc_ms = 7;
}

message FleetFrame {
  FrameType type = 1;
  int64 sequence = 2;
  oneof payload {
    HandshakeFrame handshake = 3;
    HeartbeatFrame heartbeat = 4;
    DispatchFrame dispatch = 5;
    ResultFrame result = 6;
  }
}
''';
}

/// Tipo de trama binaria en el protocolo de flota
enum FrameType {
  unspecified(0),
  handshake(1),
  heartbeat(2),
  dispatch(3),
  result(4);

  final int value;
  const FrameType(this.value);

  static FrameType fromValue(int value) {
    for (final FrameType type in FrameType.values) {
      if (type.value == value) return type;
    }
    throw InvalidFrameTypeException('Tipo de trama desconocido: $value');
  }
}

/// Excepción base de tramas binarias (§6)
abstract class FleetFrameException implements Exception {
  final String message;
  const FleetFrameException(this.message);

  @override
  String toString() => 'FleetFrameException: $message';
}

/// Excepción lanzada cuando los bytes de una trama están corruptos o truncados (§6)
class CorruptedFrameException extends FleetFrameException {
  final int? offset;
  const CorruptedFrameException(super.message, {this.offset});
}

/// Excepción lanzada cuando el tipo de trama no es admitido (§6)
class InvalidFrameTypeException extends FleetFrameException {
  const InvalidFrameTypeException(super.message);
}

/// Excepción lanzada cuando una trama excede el límite máximo de tamaño (§6)
class FrameSizeLimitException extends FleetFrameException {
  final int sizeBytes;
  final int maxBytes;
  const FrameSizeLimitException(
    super.message, {
    required this.sizeBytes,
    required this.maxBytes,
  });
}

/// Interfaz para payloads de trama de flota
abstract interface class FleetFramePayload {
  FrameType get frameType;
  Uint8List toProtoBytes();
  Map<String, dynamic> toJson();
}

/// Lector binario de tipos wire Protobuf v3 en memoria Pure Dart
class ProtobufReader {
  final Uint8List _bytes;
  int _offset = 0;

  ProtobufReader(this._bytes);

  int get offset => _offset;
  int get remaining => _bytes.length - _offset;
  bool get isAtEnd => _offset >= _bytes.length;

  int readVarint() {
    int result = 0;
    int shift = 0;
    while (_offset < _bytes.length) {
      final int b = _bytes[_offset++];
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) == 0) {
        return result;
      }
      shift += 7;
      if (shift >= 64) {
        throw CorruptedFrameException(
          'Varint excede el límite de 64 bits',
          offset: _offset,
        );
      }
    }
    throw CorruptedFrameException(
      'Varint truncado al final del buffer',
      offset: _offset,
    );
  }

  (int fieldNumber, int wireType) readTag() {
    if (isAtEnd) return (0, 0);
    final int tag = readVarint();
    final int wireType = tag & 0x07;
    final int fieldNumber = tag >> 3;
    return (fieldNumber, wireType);
  }

  void skipField(int wireType) {
    switch (wireType) {
      case 0: // Varint
        readVarint();
      case 1: // 64-bit
        if (remaining < 8) {
          throw CorruptedFrameException(
            'Truncado en campo 64-bit',
            offset: _offset,
          );
        }
        _offset += 8;
      case 2: // Length-delimited
        final int len = readVarint();
        if (remaining < len) {
          throw CorruptedFrameException(
            'Truncado en campo length-delimited',
            offset: _offset,
          );
        }
        _offset += len;
      case 5: // 32-bit
        if (remaining < 4) {
          throw CorruptedFrameException(
            'Truncado en campo 32-bit',
            offset: _offset,
          );
        }
        _offset += 4;
      default:
        throw CorruptedFrameException(
          'WireType desconocido: $wireType',
          offset: _offset,
        );
    }
  }

  int readInt64() => readVarint();

  int readInt32() => readVarint();

  bool readBool() => readVarint() != 0;

  double readDouble() {
    if (remaining < 8) {
      throw CorruptedFrameException(
        'Truncado al leer float64/double',
        offset: _offset,
      );
    }
    final ByteData bd = ByteData.sublistView(_bytes, _offset, _offset + 8);
    _offset += 8;
    return bd.getFloat64(0, Endian.little);
  }

  Uint8List readBytes() {
    final int len = readVarint();
    if (len < 0 || remaining < len) {
      throw CorruptedFrameException(
        'Longitud de bytes inválida o truncada ($len)',
        offset: _offset,
      );
    }
    final Uint8List slice = Uint8List.sublistView(
      _bytes,
      _offset,
      _offset + len,
    );
    _offset += len;
    return slice;
  }

  String readString() {
    final Uint8List slice = readBytes();
    try {
      return utf8.decode(slice);
    } catch (e) {
      throw CorruptedFrameException(
        'Cadena UTF-8 corrupta: $e',
        offset: _offset,
      );
    }
  }

  ProtobufReader readSubMessage() {
    final Uint8List slice = readBytes();
    return ProtobufReader(slice);
  }
}

/// Escritor binario de tipos wire Protobuf v3 en memoria Pure Dart
class ProtobufWriter {
  final BytesBuilder _builder = BytesBuilder();

  void writeVarint(int value) {
    int v = value;
    while (v >= 0x80) {
      _builder.addByte((v & 0x7f) | 0x80);
      v >>= 7;
    }
    _builder.addByte(v & 0x7f);
  }

  void writeTag(int fieldNumber, int wireType) {
    writeVarint((fieldNumber << 3) | (wireType & 0x07));
  }

  void writeInt64(int fieldNumber, int value) {
    writeTag(fieldNumber, 0);
    writeVarint(value);
  }

  void writeInt32(int fieldNumber, int value) {
    writeTag(fieldNumber, 0);
    writeVarint(value);
  }

  void writeBool(int fieldNumber, bool value) {
    writeTag(fieldNumber, 0);
    writeVarint(value ? 1 : 0);
  }

  void writeDouble(int fieldNumber, double value) {
    writeTag(fieldNumber, 1);
    final ByteData bd = ByteData(8);
    bd.setFloat64(0, value, Endian.little);
    _builder.add(bd.buffer.asUint8List());
  }

  void writeBytes(int fieldNumber, List<int> bytes) {
    writeTag(fieldNumber, 2);
    writeVarint(bytes.length);
    _builder.add(bytes);
  }

  void writeString(int fieldNumber, String value) {
    final List<int> encoded = utf8.encode(value);
    writeBytes(fieldNumber, encoded);
  }

  void writeMessage(int fieldNumber, List<int> messageBytes) {
    writeBytes(fieldNumber, messageBytes);
  }

  void writeStringList(int fieldNumber, List<String> list) {
    for (final String item in list) {
      writeString(fieldNumber, item);
    }
  }

  void writeStringMap(int fieldNumber, Map<String, String> map) {
    for (final MapEntry<String, String> entry in map.entries) {
      final ProtobufWriter entryWriter = ProtobufWriter();
      entryWriter.writeString(1, entry.key);
      entryWriter.writeString(2, entry.value);
      writeMessage(fieldNumber, entryWriter.toBytes());
    }
  }

  Uint8List toBytes() => _builder.toBytes();
}

/// Trama de Handshake enviada al establecer conexión UDS (§45)
class HandshakeFrame implements FleetFramePayload {
  final String satelliteId;
  final String version;
  final List<String> capabilities;
  final Map<String, String> metadata;
  final int timestampUtcMs;

  HandshakeFrame({
    required this.satelliteId,
    required this.version,
    List<String>? capabilities,
    Map<String, String>? metadata,
    int? timestampUtcMs,
  }) : capabilities = List<String>.unmodifiable(capabilities ?? <String>[]),
       metadata = Map<String, String>.unmodifiable(
         metadata ?? <String, String>{},
       ),
       timestampUtcMs =
           timestampUtcMs ?? DateTime.now().toUtc().millisecondsSinceEpoch {
    if (satelliteId.trim().isEmpty) {
      throw const CorruptedFrameException(
        'satellite_id no puede estar vacío en HandshakeFrame',
      );
    }
    if (version.trim().isEmpty) {
      throw const CorruptedFrameException(
        'version no puede estar vacío en HandshakeFrame',
      );
    }
  }

  @override
  FrameType get frameType => FrameType.handshake;

  @override
  Uint8List toProtoBytes() {
    final ProtobufWriter w = ProtobufWriter();
    w.writeString(1, satelliteId);
    w.writeString(2, version);
    w.writeStringList(3, capabilities);
    w.writeStringMap(4, metadata);
    w.writeInt64(5, timestampUtcMs);
    return w.toBytes();
  }

  factory HandshakeFrame.fromProtoBytes(Uint8List bytes) {
    final ProtobufReader r = ProtobufReader(bytes);
    String satId = '';
    String ver = '';
    final List<String> caps = <String>[];
    final Map<String, String> meta = <String, String>{};
    int ts = 0;

    while (!r.isAtEnd) {
      final (int fieldNumber, int wireType) = r.readTag();
      if (fieldNumber == 0) break;
      switch (fieldNumber) {
        case 1:
          satId = r.readString();
        case 2:
          ver = r.readString();
        case 3:
          caps.add(r.readString());
        case 4:
          final ProtobufReader entryReader = r.readSubMessage();
          String k = '';
          String v = '';
          while (!entryReader.isAtEnd) {
            final (int eField, _) = entryReader.readTag();
            if (eField == 1) k = entryReader.readString();
            if (eField == 2) v = entryReader.readString();
          }
          if (k.isNotEmpty) meta[k] = v;
        case 5:
          ts = r.readInt64();
        default:
          r.skipField(wireType);
      }
    }

    return HandshakeFrame(
      satelliteId: satId,
      version: ver,
      capabilities: caps,
      metadata: meta,
      timestampUtcMs: ts,
    );
  }

  @override
  Map<String, dynamic> toJson() => <String, dynamic>{
    'satellite_id': satelliteId,
    'version': version,
    'capabilities': capabilities,
    'metadata': metadata,
    'timestamp_utc_ms': timestampUtcMs,
  };

  factory HandshakeFrame.fromJson(Map<String, dynamic> json) => HandshakeFrame(
    satelliteId: (json['satellite_id'] as String?) ?? '',
    version: (json['version'] as String?) ?? '',
    capabilities: (json['capabilities'] as List<dynamic>?)?.cast<String>(),
    metadata: (json['metadata'] as Map<String, dynamic>?)?.map(
      (String k, dynamic v) => MapEntry<String, String>(k, v.toString()),
    ),
    timestampUtcMs: json['timestamp_utc_ms'] as int?,
  );
}

/// Trama de Latido periódico (Keep-Alive) con telemetría viva (§45)
class HeartbeatFrame implements FleetFramePayload {
  final String satelliteId;
  final int sequenceNumber;
  final double loadAverage;
  final int memoryUsageBytes;
  final int timestampUtcMs;

  HeartbeatFrame({
    required this.satelliteId,
    required this.sequenceNumber,
    required this.loadAverage,
    required this.memoryUsageBytes,
    int? timestampUtcMs,
  }) : timestampUtcMs =
           timestampUtcMs ?? DateTime.now().toUtc().millisecondsSinceEpoch {
    if (satelliteId.trim().isEmpty) {
      throw const CorruptedFrameException(
        'satellite_id no puede estar vacío en HeartbeatFrame',
      );
    }
    if (sequenceNumber < 0) {
      throw const CorruptedFrameException(
        'sequence_number no puede ser negativo en HeartbeatFrame',
      );
    }
  }

  @override
  FrameType get frameType => FrameType.heartbeat;

  @override
  Uint8List toProtoBytes() {
    final ProtobufWriter w = ProtobufWriter();
    w.writeString(1, satelliteId);
    w.writeInt64(2, sequenceNumber);
    w.writeDouble(3, loadAverage);
    w.writeInt64(4, memoryUsageBytes);
    w.writeInt64(5, timestampUtcMs);
    return w.toBytes();
  }

  factory HeartbeatFrame.fromProtoBytes(Uint8List bytes) {
    final ProtobufReader r = ProtobufReader(bytes);
    String satId = '';
    int seq = 0;
    double load = 0.0;
    int mem = 0;
    int ts = 0;

    while (!r.isAtEnd) {
      final (int fieldNumber, int wireType) = r.readTag();
      if (fieldNumber == 0) break;
      switch (fieldNumber) {
        case 1:
          satId = r.readString();
        case 2:
          seq = r.readInt64();
        case 3:
          load = r.readDouble();
        case 4:
          mem = r.readInt64();
        case 5:
          ts = r.readInt64();
        default:
          r.skipField(wireType);
      }
    }

    return HeartbeatFrame(
      satelliteId: satId,
      sequenceNumber: seq,
      loadAverage: load,
      memoryUsageBytes: mem,
      timestampUtcMs: ts,
    );
  }

  @override
  Map<String, dynamic> toJson() => <String, dynamic>{
    'satellite_id': satelliteId,
    'sequence_number': sequenceNumber,
    'load_average': loadAverage,
    'memory_usage_bytes': memoryUsageBytes,
    'timestamp_utc_ms': timestampUtcMs,
  };

  factory HeartbeatFrame.fromJson(Map<String, dynamic> json) => HeartbeatFrame(
    satelliteId: (json['satellite_id'] as String?) ?? '',
    sequenceNumber: (json['sequence_number'] as int?) ?? 0,
    loadAverage: ((json['load_average'] as num?) ?? 0.0).toDouble(),
    memoryUsageBytes: (json['memory_usage_bytes'] as int?) ?? 0,
    timestampUtcMs: json['timestamp_utc_ms'] as int?,
  );
}

/// Trama de Despacho de Comandos hacia un satélite (§39, §45)
class DispatchFrame implements FleetFramePayload {
  final String commandId;
  final String targetSatelliteId;
  final String action;
  final String payloadJson;
  final int timeoutMs;
  final int priority;
  final int timestampUtcMs;

  DispatchFrame({
    required this.commandId,
    required this.targetSatelliteId,
    required this.action,
    required this.payloadJson,
    this.timeoutMs = 30000,
    this.priority = 1,
    int? timestampUtcMs,
  }) : timestampUtcMs =
           timestampUtcMs ?? DateTime.now().toUtc().millisecondsSinceEpoch {
    if (commandId.trim().isEmpty) {
      throw const CorruptedFrameException(
        'command_id no puede estar vacío en DispatchFrame',
      );
    }
    if (action.trim().isEmpty) {
      throw const CorruptedFrameException(
        'action no puede estar vacío en DispatchFrame',
      );
    }
  }

  @override
  FrameType get frameType => FrameType.dispatch;

  Map<String, dynamic> get decodedPayload {
    try {
      final dynamic decoded = jsonDecode(payloadJson);
      return decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    } catch (_) {
      return <String, dynamic>{'raw': payloadJson};
    }
  }

  @override
  Uint8List toProtoBytes() {
    final ProtobufWriter w = ProtobufWriter();
    w.writeString(1, commandId);
    w.writeString(2, targetSatelliteId);
    w.writeString(3, action);
    w.writeString(4, payloadJson);
    w.writeInt64(5, timeoutMs);
    w.writeInt32(6, priority);
    w.writeInt64(7, timestampUtcMs);
    return w.toBytes();
  }

  factory DispatchFrame.fromProtoBytes(Uint8List bytes) {
    final ProtobufReader r = ProtobufReader(bytes);
    String cmdId = '';
    String tgtSat = '';
    String act = '';
    String payload = '{}';
    int timeout = 30000;
    int prio = 1;
    int ts = 0;

    while (!r.isAtEnd) {
      final (int fieldNumber, int wireType) = r.readTag();
      if (fieldNumber == 0) break;
      switch (fieldNumber) {
        case 1:
          cmdId = r.readString();
        case 2:
          tgtSat = r.readString();
        case 3:
          act = r.readString();
        case 4:
          payload = r.readString();
        case 5:
          timeout = r.readInt64();
        case 6:
          prio = r.readInt32();
        case 7:
          ts = r.readInt64();
        default:
          r.skipField(wireType);
      }
    }

    return DispatchFrame(
      commandId: cmdId,
      targetSatelliteId: tgtSat,
      action: act,
      payloadJson: payload,
      timeoutMs: timeout,
      priority: prio,
      timestampUtcMs: ts,
    );
  }

  @override
  Map<String, dynamic> toJson() => <String, dynamic>{
    'command_id': commandId,
    'target_satellite_id': targetSatelliteId,
    'action': action,
    'payload_json': payloadJson,
    'timeout_ms': timeoutMs,
    'priority': priority,
    'timestamp_utc_ms': timestampUtcMs,
  };

  factory DispatchFrame.fromJson(Map<String, dynamic> json) => DispatchFrame(
    commandId: (json['command_id'] as String?) ?? '',
    targetSatelliteId: (json['target_satellite_id'] as String?) ?? '',
    action: (json['action'] as String?) ?? '',
    payloadJson: (json['payload_json'] as String?) ?? '{}',
    timeoutMs: (json['timeout_ms'] as int?) ?? 30000,
    priority: (json['priority'] as int?) ?? 1,
    timestampUtcMs: json['timestamp_utc_ms'] as int?,
  );
}

/// Trama de Resultado de Ejecución retornada por un satélite (§39, §45)
class ResultFrame implements FleetFramePayload {
  final String commandId;
  final String satelliteId;
  final bool success;
  final String resultPayloadJson;
  final String? errorMessage;
  final int executionTimeMs;
  final int timestampUtcMs;

  ResultFrame({
    required this.commandId,
    required this.satelliteId,
    required this.success,
    required this.resultPayloadJson,
    this.errorMessage,
    required this.executionTimeMs,
    int? timestampUtcMs,
  }) : timestampUtcMs =
           timestampUtcMs ?? DateTime.now().toUtc().millisecondsSinceEpoch {
    if (commandId.trim().isEmpty) {
      throw const CorruptedFrameException(
        'command_id no puede estar vacío en ResultFrame',
      );
    }
  }

  @override
  FrameType get frameType => FrameType.result;

  Map<String, dynamic> get decodedPayload {
    try {
      final dynamic decoded = jsonDecode(resultPayloadJson);
      return decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    } catch (_) {
      return <String, dynamic>{'raw': resultPayloadJson};
    }
  }

  @override
  Uint8List toProtoBytes() {
    final ProtobufWriter w = ProtobufWriter();
    w.writeString(1, commandId);
    w.writeString(2, satelliteId);
    w.writeBool(3, success);
    w.writeString(4, resultPayloadJson);
    if (errorMessage != null) {
      w.writeString(5, errorMessage!);
    }
    w.writeInt64(6, executionTimeMs);
    w.writeInt64(7, timestampUtcMs);
    return w.toBytes();
  }

  factory ResultFrame.fromProtoBytes(Uint8List bytes) {
    final ProtobufReader r = ProtobufReader(bytes);
    String cmdId = '';
    String satId = '';
    bool succ = false;
    String resPayload = '{}';
    String? err;
    int execMs = 0;
    int ts = 0;

    while (!r.isAtEnd) {
      final (int fieldNumber, int wireType) = r.readTag();
      if (fieldNumber == 0) break;
      switch (fieldNumber) {
        case 1:
          cmdId = r.readString();
        case 2:
          satId = r.readString();
        case 3:
          succ = r.readBool();
        case 4:
          resPayload = r.readString();
        case 5:
          err = r.readString();
        case 6:
          execMs = r.readInt64();
        case 7:
          ts = r.readInt64();
        default:
          r.skipField(wireType);
      }
    }

    return ResultFrame(
      commandId: cmdId,
      satelliteId: satId,
      success: succ,
      resultPayloadJson: resPayload,
      errorMessage: err,
      executionTimeMs: execMs,
      timestampUtcMs: ts,
    );
  }

  @override
  Map<String, dynamic> toJson() => <String, dynamic>{
    'command_id': commandId,
    'satellite_id': satelliteId,
    'success': success,
    'result_payload_json': resultPayloadJson,
    if (errorMessage != null) 'error_message': errorMessage,
    'execution_time_ms': executionTimeMs,
    'timestamp_utc_ms': timestampUtcMs,
  };

  factory ResultFrame.fromJson(Map<String, dynamic> json) => ResultFrame(
    commandId: (json['command_id'] as String?) ?? '',
    satelliteId: (json['satellite_id'] as String?) ?? '',
    success: (json['success'] as bool?) ?? false,
    resultPayloadJson: (json['result_payload_json'] as String?) ?? '{}',
    errorMessage: json['error_message'] as String?,
    executionTimeMs: (json['execution_time_ms'] as int?) ?? 0,
    timestampUtcMs: json['timestamp_utc_ms'] as int?,
  );
}

/// Sobre Canónico FleetFrame que envuelve cualquier payload tipado (§45)
class FleetFrame {
  /// Tamaño máximo de trama admitido: 16 MB (§6, §45)
  static const int maxFrameSizeBytes = 16 * 1024 * 1024;

  final FrameType type;
  final int sequence;
  final FleetFramePayload payload;

  FleetFrame({
    required this.type,
    required this.sequence,
    required this.payload,
  }) {
    if (payload.frameType != type) {
      throw InvalidFrameTypeException(
        'Discrepancia entre type (${type.name}) y payload.frameType (${payload.frameType.name})',
      );
    }
  }

  factory FleetFrame.handshake({
    required int sequence,
    required HandshakeFrame handshake,
  }) => FleetFrame(
    type: FrameType.handshake,
    sequence: sequence,
    payload: handshake,
  );

  factory FleetFrame.heartbeat({
    required int sequence,
    required HeartbeatFrame heartbeat,
  }) => FleetFrame(
    type: FrameType.heartbeat,
    sequence: sequence,
    payload: heartbeat,
  );

  factory FleetFrame.dispatch({
    required int sequence,
    required DispatchFrame dispatch,
  }) => FleetFrame(
    type: FrameType.dispatch,
    sequence: sequence,
    payload: dispatch,
  );

  factory FleetFrame.result({
    required int sequence,
    required ResultFrame result,
  }) => FleetFrame(type: FrameType.result, sequence: sequence, payload: result);

  Uint8List toProtoBytes() {
    final ProtobufWriter w = ProtobufWriter();
    w.writeInt32(1, type.value);
    w.writeInt64(2, sequence);
    final Uint8List payloadBytes = payload.toProtoBytes();
    w.writeBytes(type.value + 2, payloadBytes);
    return w.toBytes();
  }

  /// Serializa la trama con prefijo de 4 bytes big-endian (Length-Delimited Wire Framing)
  Uint8List toLengthDelimitedBytes() {
    final Uint8List protoBytes = toProtoBytes();
    if (protoBytes.length > maxFrameSizeBytes) {
      throw FrameSizeLimitException(
        'Trama excede el límite de 16MB',
        sizeBytes: protoBytes.length,
        maxBytes: maxFrameSizeBytes,
      );
    }
    final ByteData header = ByteData(4);
    header.setUint32(0, protoBytes.length, Endian.big);
    final BytesBuilder bb = BytesBuilder();
    bb.add(header.buffer.asUint8List());
    bb.add(protoBytes);
    return bb.toBytes();
  }

  factory FleetFrame.fromProtoBytes(Uint8List bytes) {
    if (bytes.length > maxFrameSizeBytes) {
      throw FrameSizeLimitException(
        'Trama binaria recibida excede el límite de 16MB',
        sizeBytes: bytes.length,
        maxBytes: maxFrameSizeBytes,
      );
    }
    final ProtobufReader r = ProtobufReader(bytes);
    int typeVal = 0;
    int seq = 0;
    Uint8List? rawPayloadBytes;
    int payloadFieldNumber = 0;

    while (!r.isAtEnd) {
      final (int fieldNumber, int wireType) = r.readTag();
      if (fieldNumber == 0) break;
      switch (fieldNumber) {
        case 1:
          typeVal = r.readInt32();
        case 2:
          seq = r.readInt64();
        case 3: // Handshake
        case 4: // Heartbeat
        case 5: // Dispatch
        case 6: // Result
          rawPayloadBytes = r.readBytes();
          payloadFieldNumber = fieldNumber;
        default:
          r.skipField(wireType);
      }
    }

    final FrameType frameType = FrameType.fromValue(typeVal);
    if (rawPayloadBytes == null) {
      throw CorruptedFrameException(
        'FleetFrame sin payload binario para tipo ${frameType.name}',
      );
    }

    final FleetFramePayload payload = switch (frameType) {
      FrameType.handshake => HandshakeFrame.fromProtoBytes(rawPayloadBytes),
      FrameType.heartbeat => HeartbeatFrame.fromProtoBytes(rawPayloadBytes),
      FrameType.dispatch => DispatchFrame.fromProtoBytes(rawPayloadBytes),
      FrameType.result => ResultFrame.fromProtoBytes(rawPayloadBytes),
      FrameType.unspecified => throw const InvalidFrameTypeException(
        'No se puede deserializar una trama de tipo unspecified',
      ),
    };

    if (payloadFieldNumber != frameType.value + 2) {
      throw CorruptedFrameException(
        'Discrepancia entre payload field ($payloadFieldNumber) y frame type ($typeVal)',
      );
    }

    return FleetFrame(type: frameType, sequence: seq, payload: payload);
  }

  /// Deserializa desde bytes con prefijo de 4 bytes big-endian
  factory FleetFrame.fromLengthDelimitedBytes(Uint8List bytes) {
    if (bytes.length < 4) {
      throw const CorruptedFrameException(
        'Encabezado de longitud incompleto (<4 bytes)',
      );
    }
    final ByteData bd = ByteData.sublistView(bytes, 0, 4);
    final int length = bd.getUint32(0, Endian.big);
    if (length > maxFrameSizeBytes) {
      throw FrameSizeLimitException(
        'Longitud declarada excede el límite de 16MB',
        sizeBytes: length,
        maxBytes: maxFrameSizeBytes,
      );
    }
    if (bytes.length < 4 + length) {
      throw CorruptedFrameException(
        'Cuerpo de trama incompleto: esperado $length, recibido ${bytes.length - 4}',
      );
    }
    final Uint8List frameSlice = Uint8List.sublistView(bytes, 4, 4 + length);
    return FleetFrame.fromProtoBytes(frameSlice);
  }
}
