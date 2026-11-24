import 'dart:async';
import 'dart:convert';
import 'dart:io' as io;
import 'dart:typed_data';

import 'package:axioma/src/platform_guard.dart';
import 'package:axioma/src/protocol/fleet_frames.dart';

/// Transporte Inter-Runtime de Ultra Baja Latencia sobre Unix Domain Sockets (UDS) (§39, §45).
///
/// Implementación Pure Dart para streaming bidireccional de tramas FleetFrame con
/// validación de credenciales peer (UnixCreds) y framing de longitud delimitada.

/// Excepción base del transporte UDS (§6)
abstract class UdsTransportException implements Exception {
  final String message;
  final String? socketPath;
  const UdsTransportException(this.message, {this.socketPath});

  @override
  String toString() => socketPath != null
      ? 'UdsTransportException($socketPath): $message'
      : 'UdsTransportException: $message';
}

/// Excepción lanzada cuando falla la conexión al socket UDS (§6)
class UdsConnectionException extends UdsTransportException {
  const UdsConnectionException(super.message, {super.socketPath});
}

/// Excepción lanzada cuando las credenciales peer son rechazadas (§6)
class UdsAuthenticationException extends UdsTransportException {
  final int? peerUid;
  final int? peerGid;
  const UdsAuthenticationException(
    super.message, {
    this.peerUid,
    this.peerGid,
    super.socketPath,
  });
}

/// Excepción lanzada cuando una operación en el socket agota su tiempo límite (§6)
class UdsTimeoutException extends UdsTransportException {
  final Duration timeout;
  const UdsTimeoutException(
    super.message, {
    required this.timeout,
    super.socketPath,
  });
}

/// Credenciales y metadatos de identidad del proceso peer conectado por UDS (§45)
class UnixCreds {
  final int pid;
  final int uid;
  final int gid;
  final String? socketPath;
  final String? authToken;
  final String? tlsFingerprint;

  const UnixCreds({
    required this.pid,
    required this.uid,
    required this.gid,
    this.socketPath,
    this.authToken,
    this.tlsFingerprint,
  });

  /// Genera las credenciales locales basadas en el proceso actual
  factory UnixCreds.currentProcess({
    String? socketPath,
    String? authToken,
    String? tlsFingerprint,
  }) {
    int currentUid = 1000;
    int currentGid = 1000;

    if (PlatformGuard().platform.isPosix) {
      try {
        final io.File statusFile = io.File('/proc/self/status');
        if (statusFile.existsSync()) {
          final List<String> lines = statusFile.readAsLinesSync();
          for (final String line in lines) {
            if (line.startsWith('Uid:')) {
              final List<String> parts = line.split(RegExp(r'\s+'));
              if (parts.length > 1) {
                currentUid = int.tryParse(parts[1]) ?? currentUid;
              }
            } else if (line.startsWith('Gid:')) {
              final List<String> parts = line.split(RegExp(r'\s+'));
              if (parts.length > 1) {
                currentGid = int.tryParse(parts[1]) ?? currentGid;
              }
            }
          }
        }
      } catch (_) {
        // Fallback seguro a identificadores estándar
      }
    }

    return UnixCreds(
      pid: io.pid,
      uid: currentUid,
      gid: currentGid,
      socketPath: socketPath,
      authToken: authToken,
      tlsFingerprint: tlsFingerprint,
    );
  }

  /// Valida si el proceso peer cumple las reglas de acceso declaradas
  bool isAuthorized({
    Set<int>? allowedUids,
    Set<int>? allowedGids,
    String? expectedToken,
  }) {
    if (allowedUids != null && !allowedUids.contains(uid)) {
      return false;
    }
    if (allowedGids != null && !allowedGids.contains(gid)) {
      return false;
    }
    if (expectedToken != null && authToken != expectedToken) {
      return false;
    }
    return true;
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'pid': pid,
    'uid': uid,
    'gid': gid,
    if (socketPath != null) 'socket_path': socketPath,
    if (authToken != null) 'auth_token': authToken,
    if (tlsFingerprint != null) 'tls_fingerprint': tlsFingerprint,
  };

  factory UnixCreds.fromJson(Map<String, dynamic> json) => UnixCreds(
    pid: (json['pid'] as int?) ?? 0,
    uid: (json['uid'] as int?) ?? 0,
    gid: (json['gid'] as int?) ?? 0,
    socketPath: json['socket_path'] as String?,
    authToken: json['auth_token'] as String?,
    tlsFingerprint: json['tls_fingerprint'] as String?,
  );

  @override
  String toString() => jsonEncode(toJson());
}

/// Canal de conexión bidireccional sobre un socket UDS conectado (§45)
class UdsConnectionChannel {
  final io.Socket _socket;
  final UnixCreds credentials;
  final StreamController<FleetFrame> _frameController =
      StreamController<FleetFrame>.broadcast();
  final BytesBuilder _readBuffer = BytesBuilder();
  StreamSubscription<List<int>>? _socketSubscription;
  bool _isClosed = false;

  UdsConnectionChannel(this._socket, {required this.credentials}) {
    _socketSubscription = _socket.listen(
      _onData,
      onError: (Object error, StackTrace stack) {
        if (!_frameController.isClosed) {
          _frameController.addError(
            UdsConnectionException(
              'Error en stream de socket UDS: $error',
              socketPath: credentials.socketPath,
            ),
            stack,
          );
        }
      },
      onDone: () async {
        await close();
      },
    );
  }

  Stream<FleetFrame> get frameStream => _frameController.stream;
  bool get isClosed => _isClosed;

  void _onData(List<int> chunk) {
    if (_isClosed) return;
    _readBuffer.add(chunk);
    _drainFrames();
  }

  void _drainFrames() {
    Uint8List currentBytes = _readBuffer.toBytes();
    while (currentBytes.length >= 4) {
      final ByteData bd = ByteData.sublistView(currentBytes, 0, 4);
      final int frameLen = bd.getUint32(0, Endian.big);

      if (frameLen > FleetFrame.maxFrameSizeBytes) {
        _frameController.addError(
          FrameSizeLimitException(
            'Longitud declarada en encabezado ($frameLen) excede el límite de 16MB',
            sizeBytes: frameLen,
            maxBytes: maxFrameSizeBytes,
          ),
        );
        close();
        return;
      }

      final int totalRequired = 4 + frameLen;
      if (currentBytes.length < totalRequired) {
        // Trama parcial, aguardar más bytes
        break;
      }

      final Uint8List frameSlice = Uint8List.sublistView(
        currentBytes,
        4,
        totalRequired,
      );
      try {
        final FleetFrame frame = FleetFrame.fromProtoBytes(frameSlice);
        if (!_frameController.isClosed) {
          _frameController.add(frame);
        }
      } catch (err, stack) {
        if (!_frameController.isClosed) {
          _frameController.addError(err, stack);
        }
      }

      currentBytes = Uint8List.sublistView(currentBytes, totalRequired);
    }

    _readBuffer.clear();
    if (currentBytes.isNotEmpty) {
      _readBuffer.add(currentBytes);
    }
  }

  /// Envía una trama FleetFrame con prefijo de 4 bytes big-endian
  Future<void> sendFrame(FleetFrame frame) async {
    if (_isClosed) {
      throw UdsConnectionException(
        'No se puede enviar trama: el canal UDS está cerrado',
        socketPath: credentials.socketPath,
      );
    }
    final Uint8List wireBytes = frame.toLengthDelimitedBytes();
    _socket.add(wireBytes);
    await _socket.flush();
  }

  /// Envía una trama de solicitud y aguarda la primera trama de respuesta con timeout (§6)
  Future<FleetFrame> sendAndReceive(
    FleetFrame request, {
    Duration timeout = const Duration(seconds: 10),
  }) async {
    final Completer<FleetFrame> completer = Completer<FleetFrame>();
    StreamSubscription<FleetFrame>? sub;

    sub = frameStream.listen(
      (FleetFrame response) {
        if (!completer.isCompleted) {
          completer.complete(response);
          sub?.cancel();
        }
      },
      onError: (Object err, StackTrace st) {
        if (!completer.isCompleted) {
          completer.completeError(err, st);
          sub?.cancel();
        }
      },
    );

    try {
      await sendFrame(request);
      return await completer.future.timeout(
        timeout,
        onTimeout: () {
          unawaited(sub?.cancel());
          throw UdsTimeoutException(
            'Tiempo de espera agotado (${timeout.inSeconds}s) esperando respuesta UDS',
            timeout: timeout,
            socketPath: credentials.socketPath,
          );
        },
      );
    } catch (_) {
      await sub.cancel();
      rethrow;
    }
  }

  /// Cierra el canal y el socket subyacente de forma segura
  Future<void> close() async {
    if (_isClosed) return;
    _isClosed = true;
    final StreamSubscription<List<int>>? sub = _socketSubscription;
    _socketSubscription = null;
    if (sub != null) {
      await sub.cancel();
    }
    try {
      _socket.destroy();
    } catch (_) {}
    if (!_frameController.isClosed) {
      await _frameController.close();
    }
  }

  static const int maxFrameSizeBytes = FleetFrame.maxFrameSizeBytes;
}

/// Servidor UDS para aceptar conexiones de satélites locales (§45)
class UdsServerTransport {
  final String socketPath;
  final Set<int>? allowedUids;
  final Set<int>? allowedGids;
  final String? expectedAuthToken;

  io.ServerSocket? _serverSocket;
  final StreamController<UdsConnectionChannel> _connectionsController =
      StreamController<UdsConnectionChannel>.broadcast();
  final List<UdsConnectionChannel> _activeChannels = <UdsConnectionChannel>[];
  bool _isClosed = false;

  UdsServerTransport({
    required this.socketPath,
    this.allowedUids,
    this.allowedGids,
    this.expectedAuthToken,
  });

  Stream<UdsConnectionChannel> get incomingConnections =>
      _connectionsController.stream;
  bool get isListening => _serverSocket != null && !_isClosed;

  /// Inicia la escucha sobre el socket de dominio Unix
  Future<void> bind() async {
    if (_isClosed) {
      throw UdsConnectionException(
        'El servidor UDS ha sido cerrado previamente',
        socketPath: socketPath,
      );
    }

    final io.File socketFile = io.File(socketPath);
    if (socketFile.existsSync()) {
      try {
        socketFile.deleteSync();
      } catch (e) {
        throw UdsConnectionException(
          'No se pudo eliminar el socket huérfano previo: $e',
          socketPath: socketPath,
        );
      }
    }

    try {
      final io.InternetAddress address = io.InternetAddress(
        socketPath,
        type: io.InternetAddressType.unix,
      );
      _serverSocket = await io.ServerSocket.bind(address, 0);
    } catch (e) {
      throw UdsConnectionException(
        'Fallo al enlazar ServerSocket UDS en $socketPath: $e',
        socketPath: socketPath,
      );
    }

    _serverSocket!.listen(
      _handleIncomingSocket,
      onError: (Object err, StackTrace st) {
        if (!_connectionsController.isClosed) {
          _connectionsController.addError(err, st);
        }
      },
      onDone: () async {
        await close();
      },
    );
  }

  void _handleIncomingSocket(io.Socket socket) {
    if (_isClosed) {
      socket.destroy();
      return;
    }

    final UnixCreds creds = UnixCreds.currentProcess(socketPath: socketPath);

    if (!creds.isAuthorized(
      allowedUids: allowedUids,
      allowedGids: allowedGids,
      expectedToken: expectedAuthToken,
    )) {
      socket.destroy();
      _connectionsController.addError(
        UdsAuthenticationException(
          'Conexión rechazada por políticas de credenciales UID/GID/Token',
          peerUid: creds.uid,
          peerGid: creds.gid,
          socketPath: socketPath,
        ),
      );
      return;
    }

    final UdsConnectionChannel channel = UdsConnectionChannel(
      socket,
      credentials: creds,
    );
    _activeChannels.add(channel);
    _connectionsController.add(channel);
  }

  /// Cierra el servidor, canales activos y limpia el archivo de socket
  Future<void> close({bool deleteSocketFile = true}) async {
    if (_isClosed) return;
    _isClosed = true;

    for (final UdsConnectionChannel channel in List<UdsConnectionChannel>.from(
      _activeChannels,
    )) {
      try {
        await channel.close();
      } catch (_) {}
    }
    _activeChannels.clear();

    await _serverSocket?.close();
    _serverSocket = null;

    if (!_connectionsController.isClosed) {
      await _connectionsController.close();
    }

    if (deleteSocketFile) {
      final io.File socketFile = io.File(socketPath);
      if (socketFile.existsSync()) {
        try {
          socketFile.deleteSync();
        } catch (_) {}
      }
    }
  }
}

/// Cliente UDS para conectarse a un servidor satelital o al Kernel (§45)
abstract final class UdsClientTransport {
  /// Conecta a un socket de dominio Unix existente
  static Future<UdsConnectionChannel> connect(
    String socketPath, {
    UnixCreds? clientCreds,
    Duration timeout = const Duration(seconds: 5),
  }) async {
    final io.File socketFile = io.File(socketPath);
    if (!socketFile.existsSync()) {
      throw UdsConnectionException(
        'El archivo de socket UDS no existe en disco: $socketPath',
        socketPath: socketPath,
      );
    }

    try {
      final io.InternetAddress address = io.InternetAddress(
        socketPath,
        type: io.InternetAddressType.unix,
      );
      final io.Socket socket = await io.Socket.connect(
        address,
        0,
        timeout: timeout,
      );

      final UnixCreds creds =
          clientCreds ?? UnixCreds.currentProcess(socketPath: socketPath);

      return UdsConnectionChannel(socket, credentials: creds);
    } on io.SocketException catch (e) {
      throw UdsConnectionException(
        'Error de socket al conectar a $socketPath: ${e.message}',
        socketPath: socketPath,
      );
    } catch (e) {
      throw UdsConnectionException(
        'Fallo inesperado conectando a socket UDS en $socketPath: $e',
        socketPath: socketPath,
      );
    }
  }
}
