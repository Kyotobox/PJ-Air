// 🎯 UdsConnectorTransport — Transporte Local Conector UDS Inter-Nodo (§39, §45, §60.8)
import 'dart:async';
import 'dart:convert';
import 'dart:io' as io;

import 'package:axioma/src/platform_guard.dart';
import 'cross_node_exceptions.dart';

/// Manejador de ciclo de vida de un servidor UDS activo.
class UdsServerHandle {
  final io.ServerSocket _server;
  final String socketPath;
  final bool isUnixSocket;

  UdsServerHandle({
    required io.ServerSocket server,
    required this.socketPath,
    required this.isUnixSocket,
  }) : _server = server;

  /// Cierra el servidor y purga el archivo de socket físico en disco (§48, §60.6).
  Future<void> close() async {
    await _server.close();
    if (isUnixSocket) {
      final io.File socketFile = io.File(socketPath);
      if (socketFile.existsSync()) {
        try {
          socketFile.deleteSync();
        } catch (_) {
          // INTENTIONAL: Socket file puede haber sido purgado por el SO (§10, §42)
        }
      }
    }
  }
}

/// Conector de transporte local de ultra baja latencia para comunicación inter-nodo sobre UDS.
class UdsConnectorTransport {
  final String nodeId;
  final String socketPath;
  final Duration defaultTimeout;
  final PlatformGuard platformGuard;

  UdsConnectorTransport({
    required this.nodeId,
    required this.socketPath,
    this.defaultTimeout = const Duration(seconds: 3),
    PlatformGuard? platformGuard,
  }) : platformGuard = platformGuard ?? PlatformGuard() {
    if (nodeId.trim().isEmpty) {
      throw const FormatException('nodeId no puede estar vacío');
    }
    if (socketPath.trim().isEmpty) {
      throw const FormatException('socketPath no puede estar vacío');
    }
  }

  /// Inicia un servidor local UDS para atender solicitudes de otros nodos o workers.
  Future<UdsServerHandle> startServer({
    required Future<String> Function(String request) onMessage,
  }) async {
    final bool isPosix = platformGuard.platform.isPosix;

    // Purga preventiva de socket huérfano previo si existe
    if (isPosix) {
      final io.File oldSocket = io.File(socketPath);
      if (oldSocket.existsSync()) {
        try {
          oldSocket.deleteSync();
        } catch (_) {
          // INTENTIONAL: Permiso o lock transitorio (§10, §42)
        }
      }
    }

    final io.ServerSocket server;
    try {
      if (isPosix) {
        final io.InternetAddress addr = io.InternetAddress(
          socketPath,
          type: io.InternetAddressType.unix,
        );
        server = await io.ServerSocket.bind(addr, 0);
      } else {
        // En Windows fallback determinista loopback
        server = await io.ServerSocket.bind(io.InternetAddress.loopbackIPv4, 0);
      }
    } catch (e) {
      throw NodeUnreachableException(
        'Fallo al iniciar servidor en socket "$socketPath": $e',
        nodeId: nodeId,
        socketPath: socketPath,
      );
    }

    server.listen((io.Socket client) {
      client
          .cast<List<int>>()
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen(
            (String line) async {
              if (line.trim().isEmpty) return;
              try {
                final String response = await onMessage(line);
                client.writeln(response);
                await client.flush();
              } catch (err) {
                final String errJson = jsonEncode(<String, dynamic>{
                  'error': true,
                  'message': err.toString(),
                });
                client.writeln(errJson);
                await client.flush();
              }
            },
            onError: (dynamic _) {
              client.destroy();
            },
            onDone: () {
              client.destroy();
            },
            cancelOnError: true,
          );
    });

    return UdsServerHandle(
      server: server,
      socketPath: socketPath,
      isUnixSocket: isPosix,
    );
  }

  /// Envía una solicitud síncrona/espera respuesta hacia un nodo o worker destino.
  Future<String> sendRequest({
    required String targetNode,
    required String payload,
    String? targetSocketPath,
    Duration? timeout,
  }) async {
    if (targetNode.trim().isEmpty) {
      throw const FormatException('targetNode no puede estar vacío');
    }
    if (payload.trim().isEmpty) {
      throw const FormatException('payload no puede estar vacío');
    }

    final Duration effectiveTimeout = timeout ?? defaultTimeout;
    final String destSocket = targetSocketPath ?? socketPath;
    final bool isPosix = platformGuard.platform.isPosix;

    final io.Socket client;
    try {
      if (isPosix) {
        final io.InternetAddress addr = io.InternetAddress(
          destSocket,
          type: io.InternetAddressType.unix,
        );
        client = await io.Socket.connect(addr, 0).timeout(
          effectiveTimeout,
          onTimeout: () {
            throw NodeTimeoutException(
              'Timeout de conexión al nodo "$targetNode" en "$destSocket"',
              nodeId: targetNode,
              timeout: effectiveTimeout,
            );
          },
        );
      } else {
        client = await io.Socket.connect(io.InternetAddress.loopbackIPv4, 8080)
            .timeout(
              effectiveTimeout,
              onTimeout: () {
                throw NodeTimeoutException(
                  'Timeout de conexión loopback a "$targetNode"',
                  nodeId: targetNode,
                  timeout: effectiveTimeout,
                );
              },
            );
      }
    } catch (e) {
      if (e is NodeTimeoutException) rethrow;
      throw NodeUnreachableException(
        'Nodo "$targetNode" no alcanzable en socket "$destSocket": $e',
        nodeId: targetNode,
        socketPath: destSocket,
      );
    }

    final Completer<String> completer = Completer<String>();

    final StreamSubscription<String> sub = client
        .cast<List<int>>()
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen(
          (String line) {
            if (!completer.isCompleted) {
              completer.complete(line);
            }
          },
          onError: (dynamic err) {
            if (!completer.isCompleted) {
              completer.completeError(
                NodeUnreachableException(
                  'Error en streaming con nodo "$targetNode": $err',
                  nodeId: targetNode,
                  socketPath: destSocket,
                ),
              );
            }
          },
          onDone: () {
            if (!completer.isCompleted) {
              completer.completeError(
                NodeUnreachableException(
                  'Conexión cerrada prematuramente por el nodo "$targetNode"',
                  nodeId: targetNode,
                  socketPath: destSocket,
                ),
              );
            }
          },
          cancelOnError: true,
        );

    // Enviar solicitud delimitada por línea
    client.writeln(payload.replaceAll('\n', ' '));
    await client.flush();

    try {
      final String response = await completer.future.timeout(
        effectiveTimeout,
        onTimeout: () {
          throw NodeTimeoutException(
            'Timeout esperando respuesta del nodo "$targetNode" (${effectiveTimeout.inMilliseconds}ms)',
            nodeId: targetNode,
            timeout: effectiveTimeout,
          );
        },
      );
      return response;
    } finally {
      await sub.cancel();
      client.destroy();
    }
  }

  /// Realiza un sondeo (ping) rápido de conectividad hacia el nodo destino.
  Future<bool> ping(
    String targetNode, {
    String? targetSocketPath,
    Duration timeout = const Duration(milliseconds: 500),
  }) async {
    try {
      final String res = await sendRequest(
        targetNode: targetNode,
        targetSocketPath: targetSocketPath,
        payload: jsonEncode(<String, dynamic>{'type': 'PING', 'node': nodeId}),
        timeout: timeout,
      );
      return res.isNotEmpty;
    } catch (_) {
      // INTENTIONAL: Ping fallido retorna false limpiamente (§10, §42)
      return false;
    }
  }
}
