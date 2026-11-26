// 🎯 Canonical LeadCapturedEvent — Pure Dart (§39, §45, §47)
// Contrato inmutable emitido por ECHO tras capturar y anonimizar prospectos en el perímetro de mensajería.

import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'omnichannel_envelope.dart';

/// DTO Canónico emitido por satélites de ingesta perimetral (ECHO) al detectar actividad comercial.
class LeadCapturedEvent {
  static const String currentSchemaVersion = '1.0.0';

  final String eventId;
  final String traceId;
  final ChannelType channel;
  final String senderHmac;
  final String rawContent;
  final String? sourceGroupId;
  final DateTime capturedAt;
  final Map<String, dynamic> metadata;

  const LeadCapturedEvent._({
    required this.eventId,
    required this.traceId,
    required this.channel,
    required this.senderHmac,
    required this.rawContent,
    this.sourceGroupId,
    required this.capturedAt,
    required this.metadata,
  });

  /// Factory constructor con validaciones rigurosas de integridad y seguridad (§4, §6).
  factory LeadCapturedEvent.validated({
    required String eventId,
    required String traceId,
    required dynamic channel,
    required String senderHmac,
    required String rawContent,
    String? sourceGroupId,
    DateTime? capturedAt,
    Map<String, dynamic>? metadata,
  }) {
    final cleanEventId = eventId.trim();
    if (cleanEventId.isEmpty) {
      throw ArgumentError.value(
        eventId,
        'eventId',
        'eventId no puede estar vacío.',
      );
    }

    final cleanTraceId = traceId.trim();
    if (cleanTraceId.isEmpty) {
      throw ArgumentError.value(
        traceId,
        'traceId',
        'traceId es obligatorio según la directiva de trazabilidad (§47).',
      );
    }

    final cleanHmac = senderHmac.trim();
    if (cleanHmac.isEmpty) {
      throw ArgumentError.value(
        senderHmac,
        'senderHmac',
        'senderHmac no puede estar vacío; la anonimización perimetral es obligatoria.',
      );
    }

    final cleanContent = rawContent.trim();
    if (cleanContent.isEmpty) {
      throw ArgumentError.value(
        rawContent,
        'rawContent',
        'rawContent no puede estar vacío.',
      );
    }

    final resolvedChannel = channel is ChannelType
        ? channel
        : ChannelType.fromString(channel.toString());

    return LeadCapturedEvent._(
      eventId: cleanEventId,
      traceId: cleanTraceId,
      channel: resolvedChannel,
      senderHmac: cleanHmac,
      rawContent: cleanContent,
      sourceGroupId: sourceGroupId?.trim().isEmpty == true
          ? null
          : sourceGroupId?.trim(),
      capturedAt: capturedAt?.toUtc() ?? DateTime.now().toUtc(),
      metadata: Map<String, dynamic>.unmodifiable(
        metadata ?? const <String, dynamic>{},
      ),
    );
  }

  /// Función utilitaria determinista para anonimizar identificadores (teléfono, userId) mediante HMAC-SHA256.
  static String computeSenderHmac(
    String rawSenderId, {
    String salt = 'conext_lead_anonymizer_salt',
  }) {
    final clean = rawSenderId.trim();
    if (clean.isEmpty) {
      throw ArgumentError('rawSenderId no puede estar vacío.');
    }
    final key = utf8.encode(salt);
    final bytes = utf8.encode(clean);
    final hmac = Hmac(sha256, key);
    return hmac.convert(bytes).toString();
  }

  /// Deserializador JSON con validación atómica.
  factory LeadCapturedEvent.fromJson(Map<String, dynamic> json) {
    final eventId = json['event_id'] as String? ?? '';
    final traceId = json['trace_id'] as String? ?? '';
    final channelStr = json['channel'] as String? ?? '';
    final senderHmac = json['sender_hmac'] as String? ?? '';
    final rawContent = json['raw_content'] as String? ?? '';

    return LeadCapturedEvent.validated(
      eventId: eventId,
      traceId: traceId,
      channel: channelStr,
      senderHmac: senderHmac,
      rawContent: rawContent,
      sourceGroupId: json['source_group_id'] as String?,
      capturedAt: json['captured_at'] != null
          ? DateTime.parse(json['captured_at'] as String)
          : null,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  /// Serializador JSON inmutable.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'schema_version': currentSchemaVersion,
    'event_id': eventId,
    'trace_id': traceId,
    'channel': channel.value,
    'sender_hmac': senderHmac,
    'raw_content': rawContent,
    if (sourceGroupId != null) 'source_group_id': sourceGroupId,
    'captured_at': capturedAt.toIso8601String(),
    'metadata': metadata,
  };
}
