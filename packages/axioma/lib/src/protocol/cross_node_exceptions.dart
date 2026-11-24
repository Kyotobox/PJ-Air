// 🎯 CrossNodeException — Excepciones Tipadas para Comunicación Inter-Nodo (§6, §39, §60.7)

/// Excepción base tipada para fallas en la comunicación y transporte entre nodos de la flota.
abstract class CrossNodeException implements Exception {
  final String message;
  final String nodeId;
  final int exitCode;
  final Map<String, dynamic> context;

  CrossNodeException(
    this.message, {
    required this.nodeId,
    this.exitCode = 1,
    this.context = const <String, dynamic>{},
  }) {
    if (message.trim().isEmpty) {
      throw const FormatException(
        'message no puede estar vacío en CrossNodeException',
      );
    }
    if (nodeId.trim().isEmpty) {
      throw const FormatException(
        'nodeId no puede estar vacío en CrossNodeException',
      );
    }
  }

  @override
  String toString() =>
      '$runtimeType(node: $nodeId, exitCode: $exitCode): $message';
}

/// Detonada cuando un nodo o worker destino no puede ser alcanzado físicamente.
class NodeUnreachableException extends CrossNodeException {
  final String? socketPath;

  NodeUnreachableException(
    super.message, {
    required super.nodeId,
    this.socketPath,
    super.exitCode = 75, // EX_TEMPFAIL conforme a §45, §53
    super.context,
  });

  @override
  String toString() => socketPath != null
      ? 'NodeUnreachableException(node: $nodeId, socket: $socketPath, exitCode: $exitCode): $message'
      : super.toString();
}

/// Detonada cuando una solicitud, handshake o ping inter-nodo agota su tiempo límite (§6).
class NodeTimeoutException extends CrossNodeException {
  final Duration timeout;

  NodeTimeoutException(
    super.message, {
    required super.nodeId,
    required this.timeout,
    super.exitCode = 75,
    super.context,
  });

  @override
  String toString() =>
      'NodeTimeoutException(node: $nodeId, timeout: ${timeout.inMilliseconds}ms): $message';
}

/// Detonada cuando la invocación inter-nodo viola el Perímetro Sónico o soberanía (§60.8).
class NodeSovereigntyException extends CrossNodeException {
  final String? reason;

  NodeSovereigntyException(
    super.message, {
    required super.nodeId,
    this.reason,
    super.exitCode = 42, // scope_violation conforme a fleet.json (§62)
    super.context,
  });
}

/// Detonada cuando existe incompatibilidad de protocolo o desalineación de versión SemVer.
class ProtocolMismatchException extends CrossNodeException {
  final String expectedVersion;
  final String actualVersion;

  ProtocolMismatchException(
    super.message, {
    required super.nodeId,
    required this.expectedVersion,
    required this.actualVersion,
    super.exitCode = 55,
    super.context,
  });

  @override
  String toString() =>
      'ProtocolMismatchException(node: $nodeId, expected: $expectedVersion, actual: $actualVersion): $message';
}
