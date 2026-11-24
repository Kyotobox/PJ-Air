import 'dart:convert';

/// Contrato canónico Pure Dart para campañas de difusión y mensajería (§39).
/// Enviado desde Levita Retail o BlueMarket hacia Levita Flow (omni_flow).
class BroadcastCampaignDTO {
  /// Identificador único de la campaña de difusión.
  final String campaignId;

  /// Identificador del inquilino o satélite emisor.
  final String tenantId;

  /// Pool de números de WhatsApp asignado para el despacho.
  final String poolId;

  /// Lista de números de destino o JIDs de grupos de WhatsApp.
  final List<String> targetJids;

  /// Texto del mensaje o plantilla de difusión.
  final String messageText;

  /// URL del archivo multimedia en Cloudflare R2 (opcional).
  final String? mediaUrl;

  /// Retardo base en segundos entre envíos sucesivos (anti-baneo, mínimo 5s).
  final int delaySeconds;

  /// Variación aleatoria de tiempo en segundos (jitter humano ±).
  final double jitterSeconds;

  /// Fecha y hora programada para el inicio del lote (UTC).
  final DateTime scheduledAt;

  BroadcastCampaignDTO({
    required this.campaignId,
    required this.tenantId,
    required this.poolId,
    required this.targetJids,
    required this.messageText,
    this.mediaUrl,
    this.delaySeconds = 12,
    this.jitterSeconds = 4.5,
    DateTime? scheduledAt,
  }) : scheduledAt = (scheduledAt ?? DateTime.now()).toUtc() {
    _validate();
  }

  void _validate() {
    if (campaignId.trim().isEmpty) {
      throw ArgumentError.value(
        campaignId,
        'campaignId',
        'El campaignId no puede estar vacío.',
      );
    }
    if (tenantId.trim().isEmpty) {
      throw ArgumentError.value(
        tenantId,
        'tenantId',
        'El tenantId no puede estar vacío.',
      );
    }
    if (poolId.trim().isEmpty) {
      throw ArgumentError.value(
        poolId,
        'poolId',
        'El poolId no puede estar vacío.',
      );
    }
    if (targetJids.isEmpty) {
      throw ArgumentError.value(
        targetJids,
        'targetJids',
        'La lista de destinos no puede estar vacía.',
      );
    }
    for (int i = 0; i < targetJids.length; i++) {
      if (targetJids[i].trim().isEmpty) {
        throw ArgumentError.value(
          targetJids[i],
          'targetJids[$i]',
          'El destino en el índice $i no puede ser una cadena vacía.',
        );
      }
    }
    if (messageText.trim().isEmpty) {
      throw ArgumentError.value(
        messageText,
        'messageText',
        'El texto del mensaje no puede estar vacío.',
      );
    }
    if (delaySeconds < 5) {
      throw ArgumentError.value(
        delaySeconds,
        'delaySeconds',
        'El retardo mínimo de seguridad anti-baneo es de 5 segundos.',
      );
    }
    if (jitterSeconds < 0.0) {
      throw ArgumentError.value(
        jitterSeconds,
        'jitterSeconds',
        'El jitter no puede ser negativo.',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'campaign_id': campaignId.trim(),
    'tenant_id': tenantId.trim(),
    'pool_id': poolId.trim(),
    'target_jids': List<String>.from(targetJids.map((String e) => e.trim())),
    'message_text': messageText.trim(),
    if (mediaUrl != null) 'media_url': mediaUrl!.trim(),
    'delay_seconds': delaySeconds,
    'jitter_seconds': jitterSeconds,
    'scheduled_at': scheduledAt.toIso8601String(),
  };

  factory BroadcastCampaignDTO.fromJson(Map<String, dynamic> json) {
    final dynamic rawList = json['target_jids'];
    final List<String> targets = rawList is List
        ? rawList.map((dynamic e) => e.toString()).toList()
        : <String>[];

    return BroadcastCampaignDTO(
      campaignId: json['campaign_id'] as String? ?? '',
      tenantId: json['tenant_id'] as String? ?? '',
      poolId: json['pool_id'] as String? ?? '',
      targetJids: targets,
      messageText: json['message_text'] as String? ?? '',
      mediaUrl: json['media_url'] as String?,
      delaySeconds: json['delay_seconds'] as int? ?? 12,
      jitterSeconds: (json['jitter_seconds'] as num?)?.toDouble() ?? 4.5,
      scheduledAt: json['scheduled_at'] != null
          ? DateTime.tryParse(json['scheduled_at'] as String)
          : null,
    );
  }

  String toJsonString({bool pretty = false}) {
    if (pretty) {
      return const JsonEncoder.withIndent('  ').convert(toJson());
    }
    return jsonEncode(toJson());
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BroadcastCampaignDTO &&
          runtimeType == other.runtimeType &&
          campaignId == other.campaignId &&
          tenantId == other.tenantId &&
          poolId == other.poolId &&
          messageText == other.messageText &&
          delaySeconds == other.delaySeconds;

  @override
  int get hashCode =>
      Object.hash(campaignId, tenantId, poolId, messageText, delaySeconds);

  @override
  String toString() =>
      'BroadcastCampaignDTO(id: $campaignId, pool: $poolId, targets: ${targetJids.length}, delay: ${delaySeconds}s)';
}
