// 🎯 Canonical Channel Sender Interface & Dispatch Result — Pure Dart (§39, §56)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios, §45 Soberanía Offline.

import 'dart:async';
import 'omnichannel_envelope.dart';

/// Excepción base para operaciones del despachador omnicanal.
abstract class ChannelSenderException implements Exception {
  final String message;
  final ChannelType? channel;

  const ChannelSenderException(this.message, {this.channel});

  @override
  String toString() =>
      '$runtimeType: ${channel != null ? "[Canal: ${channel!.value}] " : ""}$message';
}

/// Excepción lanzada cuando no existe un [ChannelSender] registrado para un canal determinado.
class UnsupportedChannelException extends ChannelSenderException {
  const UnsupportedChannelException(ChannelType channel)
    : super(
        'No existe un ejecutor ChannelSender registrado para el canal.',
        channel: channel,
      );
}

/// Excepción en tiempo de despacho o transporte del mensaje.
class ChannelDispatchException extends ChannelSenderException {
  final String? errorCode;

  const ChannelDispatchException(
    super.message, {
    super.channel,
    this.errorCode,
  });
}

/// Resultado atómico del despacho de un [OutboundMessage] por un [ChannelSender].
class ChannelDispatchResult {
  /// Si el envío fue aceptado exitosamente por la plataforma de transporte.
  final bool success;

  /// Clave de idempotencia única del mensaje saliente despachado.
  final String idempotencyKey;

  /// Canal a través del cual se despachó o intentó el envío.
  final ChannelType channel;

  /// Resultado formal de envío ([SendResult]), si está disponible.
  final SendResult? sendResult;

  /// ID del mensaje asignado por el proveedor de transporte (WhatsApp wamid, Telegram message_id, etc.).
  final String? providerMessageId;

  /// Código de error en caso de fallo (ej. 'RATE_LIMITED', 'INVALID_RECIPIENT').
  final String? errorCode;

  /// Mensaje descriptivo de error en caso de fallo.
  final String? errorMessage;

  /// Latencia observada de la llamada de transporte.
  final Duration latency;

  /// Payload crudo de respuesta retornado por el proveedor.
  final Map<String, dynamic> rawResponse;

  const ChannelDispatchResult({
    required this.success,
    required this.idempotencyKey,
    required this.channel,
    this.sendResult,
    this.providerMessageId,
    this.errorCode,
    this.errorMessage,
    this.latency = Duration.zero,
    this.rawResponse = const <String, dynamic>{},
  });

  /// Constructor factory para un despacho exitoso.
  factory ChannelDispatchResult.success({
    required OutboundMessage message,
    required String providerMessageId,
    Duration latency = Duration.zero,
    SendStatus status = SendStatus.sent,
    Map<String, dynamic> rawResponse = const <String, dynamic>{},
    DateTime? timestamp,
  }) {
    if (providerMessageId.trim().isEmpty) {
      throw ArgumentError.value(
        providerMessageId,
        'providerMessageId',
        'El providerMessageId no puede estar vacío en un despacho exitoso.',
      );
    }
    final SendResult result = message.createSuccessResult(
      messageId: providerMessageId,
      status: status,
      timestamp: timestamp,
      metadata: rawResponse,
    );

    return ChannelDispatchResult(
      success: true,
      idempotencyKey: message.idempotencyKey,
      channel: message.channel,
      sendResult: result,
      providerMessageId: providerMessageId.trim(),
      latency: latency,
      rawResponse: rawResponse,
    );
  }

  /// Constructor factory para un despacho fallido.
  factory ChannelDispatchResult.failure({
    required OutboundMessage message,
    required String errorCode,
    required String errorMessage,
    Duration latency = Duration.zero,
    Map<String, dynamic> rawResponse = const <String, dynamic>{},
    DateTime? timestamp,
  }) {
    if (errorCode.trim().isEmpty) {
      throw ArgumentError.value(
        errorCode,
        'errorCode',
        'El errorCode no puede estar vacío en un fallo de despacho.',
      );
    }
    if (errorMessage.trim().isEmpty) {
      throw ArgumentError.value(
        errorMessage,
        'errorMessage',
        'El errorMessage no puede estar vacío en un fallo de despacho.',
      );
    }
    final SendResult result = message.createFailureResult(
      errorCode: errorCode.trim(),
      errorMessage: errorMessage.trim(),
      timestamp: timestamp,
      metadata: rawResponse,
    );

    return ChannelDispatchResult(
      success: false,
      idempotencyKey: message.idempotencyKey,
      channel: message.channel,
      sendResult: result,
      errorCode: errorCode.trim(),
      errorMessage: errorMessage.trim(),
      latency: latency,
      rawResponse: rawResponse,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'success': success,
    'idempotency_key': idempotencyKey,
    'channel': channel.value,
    if (sendResult != null) 'send_result': sendResult!.toJson(),
    if (providerMessageId != null) 'provider_message_id': providerMessageId,
    if (errorCode != null) 'error_code': errorCode,
    if (errorMessage != null) 'error_message': errorMessage,
    'latency_ms': latency.inMilliseconds,
    if (rawResponse.isNotEmpty) 'raw_response': rawResponse,
  };

  factory ChannelDispatchResult.fromJson(Map<String, dynamic> json) {
    final bool? success = json['success'] as bool?;
    final String? idempotencyKey = json['idempotency_key'] as String?;
    final String? channelStr = json['channel'] as String?;

    if (success == null || idempotencyKey == null || channelStr == null) {
      throw ArgumentError(
        'Campos obligatorios (success, idempotency_key, channel) faltantes en ChannelDispatchResult JSON.',
      );
    }

    final ChannelType channel = ChannelType.fromString(channelStr);
    final dynamic rawSendResult = json['send_result'];
    final SendResult? sendResult = rawSendResult is Map<String, dynamic>
        ? SendResult.fromJson(rawSendResult)
        : null;

    final int latencyMs = json['latency_ms'] as int? ?? 0;

    return ChannelDispatchResult(
      success: success,
      idempotencyKey: idempotencyKey,
      channel: channel,
      sendResult: sendResult,
      providerMessageId: json['provider_message_id'] as String?,
      errorCode: json['error_code'] as String?,
      errorMessage: json['error_message'] as String?,
      latency: Duration(milliseconds: latencyMs),
      rawResponse:
          (json['raw_response'] as Map<String, dynamic>?) ??
          const <String, dynamic>{},
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ChannelDispatchResult &&
          runtimeType == other.runtimeType &&
          success == other.success &&
          idempotencyKey == other.idempotencyKey &&
          channel == other.channel &&
          providerMessageId == other.providerMessageId &&
          errorCode == other.errorCode;

  @override
  int get hashCode => Object.hash(
    success,
    idempotencyKey,
    channel,
    providerMessageId,
    errorCode,
  );

  @override
  String toString() =>
      'ChannelDispatchResult(success: $success, channel: ${channel.value}, id: $providerMessageId, error: $errorCode)';
}

/// Contrato canónico y abstracto para ejecutores de transporte omnicanal (§39, §56).
///
/// Permite que motores como OmniFlow (`omni_flow`) o adaptadores de satélites
/// operen desacoplados de la lógica comercial o infraestructura externa de red.
abstract class ChannelSender {
  /// Canal de mensajería que este ejecutor sabe despachar.
  ChannelType get supportedChannel;

  /// Ejecuta el despacho físico de un [OutboundMessage].
  Future<ChannelDispatchResult> send(OutboundMessage message);

  /// Sonda de vida o conectividad del canal de transporte.
  Future<bool> ping();
}

/// Registro desacoplado de ejecutores [ChannelSender] para enrutamiento dinámico.
class ChannelSenderRegistry {
  final Map<ChannelType, ChannelSender> _senders =
      <ChannelType, ChannelSender>{};

  /// Registra un ejecutor para su canal correspondiente.
  void register(ChannelSender sender) {
    _senders[sender.supportedChannel] = sender;
  }

  /// Remueve el ejecutor asociado al canal indicado.
  void unregister(ChannelType channel) {
    _senders.remove(channel);
  }

  /// Retorna si existe un ejecutor registrado para el canal.
  bool hasSender(ChannelType channel) => _senders.containsKey(channel);

  /// Obtiene el ejecutor registrado para el canal, o lanza [UnsupportedChannelException].
  ChannelSender getSender(ChannelType channel) {
    final ChannelSender? sender = _senders[channel];
    if (sender == null) {
      throw UnsupportedChannelException(channel);
    }
    return sender;
  }

  /// Despacha un [OutboundMessage] hacia el ejecutor registrado para su canal.
  Future<ChannelDispatchResult> dispatch(OutboundMessage message) async {
    final ChannelSender sender = getSender(message.channel);
    return await sender.send(message);
  }
}
