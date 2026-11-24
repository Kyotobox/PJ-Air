// 🎯 Broadcast Campaign Validator & Anti-Ban Policies — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios, §45 Soberanía Offline.

import 'broadcast_campaign_dto.dart';

/// Excepción base para violaciones de validación de campañas de difusión.
abstract class BroadcastCampaignValidationException implements Exception {
  final String message;
  final String campaignId;

  const BroadcastCampaignValidationException({
    required this.message,
    required this.campaignId,
  });

  @override
  String toString() => '$runtimeType: [Campaña: $campaignId] $message';
}

/// Violación de políticas de seguridad anti-baneo (cadencia, retardo, jitter).
class AntiBanPolicyException extends BroadcastCampaignValidationException {
  final int currentDelay;
  final int minRequiredDelay;

  const AntiBanPolicyException({
    required super.message,
    required super.campaignId,
    required this.currentDelay,
    required this.minRequiredDelay,
  });
}

/// Violación de ventana horaria permitida para difusión masiva.
class BroadcastWindowViolationException
    extends BroadcastCampaignValidationException {
  final DateTime scheduledAt;
  final List<TimeWindow> allowedWindows;

  const BroadcastWindowViolationException({
    required super.message,
    required super.campaignId,
    required this.scheduledAt,
    required this.allowedWindows,
  });
}

/// Violación de cuota máxima de envíos para un pool de difusión.
class PoolQuotaExceededException extends BroadcastCampaignValidationException {
  final String poolId;
  final int targetCount;
  final int maxAllowedQuota;

  const PoolQuotaExceededException({
    required super.message,
    required super.campaignId,
    required this.poolId,
    required this.targetCount,
    required this.maxAllowedQuota,
  });
}

/// Ventana horaria de difusión en formato hora:minuto (00:00 a 23:59).
class TimeWindow {
  final int startHour;
  final int startMinute;
  final int endHour;
  final int endMinute;

  const TimeWindow({
    required this.startHour,
    this.startMinute = 0,
    required this.endHour,
    this.endMinute = 0,
  }) : assert(
         startHour >= 0 && startHour <= 23,
         'startHour debe estar entre 0 y 23',
       ),
       assert(endHour >= 0 && endHour <= 23, 'endHour debe estar entre 0 y 23'),
       assert(
         startMinute >= 0 && startMinute <= 59,
         'startMinute debe estar entre 0 y 59',
       ),
       assert(
         endMinute >= 0 && endMinute <= 59,
         'endMinute debe estar entre 0 y 59',
       );

  /// Ventana comercial estándar (08:00 a 20:00).
  factory TimeWindow.businessHours() =>
      const TimeWindow(startHour: 8, startMinute: 0, endHour: 20, endMinute: 0);

  /// Ventana 24 horas completa.
  factory TimeWindow.allDay() => const TimeWindow(
    startHour: 0,
    startMinute: 0,
    endHour: 23,
    endMinute: 59,
  );

  /// Verifica si un [DateTime] dado cae dentro de esta ventana horaria.
  bool contains(DateTime dateTime) {
    final int currentTotalMinutes = dateTime.hour * 60 + dateTime.minute;
    final int startTotalMinutes = startHour * 60 + startMinute;
    final int endTotalMinutes = endHour * 60 + endMinute;

    if (startTotalMinutes <= endTotalMinutes) {
      return currentTotalMinutes >= startTotalMinutes &&
          currentTotalMinutes <= endTotalMinutes;
    } else {
      // Ventana que cruza la medianoche (ej: 22:00 a 04:00)
      return currentTotalMinutes >= startTotalMinutes ||
          currentTotalMinutes <= endTotalMinutes;
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'start_hour': startHour,
    'start_minute': startMinute,
    'end_hour': endHour,
    'end_minute': endMinute,
  };

  factory TimeWindow.fromJson(Map<String, dynamic> json) {
    final int? startH = json['start_hour'] as int?;
    final int? endH = json['end_hour'] as int?;
    if (startH == null || endH == null) {
      throw ArgumentError(
        'Campos obligatorios start_hour y end_hour requeridos en TimeWindow.',
      );
    }
    return TimeWindow(
      startHour: startH,
      startMinute: json['start_minute'] as int? ?? 0,
      endHour: endH,
      endMinute: json['end_minute'] as int? ?? 0,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TimeWindow &&
          runtimeType == other.runtimeType &&
          startHour == other.startHour &&
          startMinute == other.startMinute &&
          endHour == other.endHour &&
          endMinute == other.endMinute;

  @override
  int get hashCode => Object.hash(startHour, startMinute, endHour, endMinute);

  @override
  String toString() =>
      'TimeWindow(${_pad(startHour)}:${_pad(startMinute)} - ${_pad(endHour)}:${_pad(endMinute)})';

  static String _pad(int val) => val.toString().padLeft(2, '0');
}

/// Informe de evaluación detallado de una campaña de difusión.
class BroadcastValidationReport {
  final bool isValid;
  final List<String> violations;
  final String campaignId;
  final String poolId;
  final int targetCount;
  final DateTime evaluatedAt;

  const BroadcastValidationReport({
    required this.isValid,
    required this.violations,
    required this.campaignId,
    required this.poolId,
    required this.targetCount,
    required this.evaluatedAt,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'is_valid': isValid,
    'violations': violations,
    'campaign_id': campaignId,
    'pool_id': poolId,
    'target_count': targetCount,
    'evaluated_at': evaluatedAt.toIso8601String(),
  };

  @override
  String toString() =>
      'BroadcastValidationReport(valid: $isValid, campaign: $campaignId, violations: ${violations.length})';
}

/// Validador canónico de reglas de difusión, ventanas horarias y políticas anti-baneo (§39, §45).
class BroadcastCampaignValidator {
  /// Retardo mínimo por defecto entre mensajes para prevenir bloqueos en WhatsApp (segundos).
  static const int kDefaultMinDelaySeconds = 5;

  /// Cuota por defecto de destinatarios por campaña si el pool no tiene cupo específico.
  static const int kDefaultPoolQuota = 500;

  final int minDelaySeconds;
  final int defaultPoolQuota;
  final Map<String, int> poolQuotas;
  final List<TimeWindow> allowedWindows;

  const BroadcastCampaignValidator({
    this.minDelaySeconds = kDefaultMinDelaySeconds,
    this.defaultPoolQuota = kDefaultPoolQuota,
    this.poolQuotas = const <String, int>{},
    this.allowedWindows = const <TimeWindow>[],
  });

  /// Retorna la cuota máxima permitida para un pool determinado.
  int quotaForPool(String poolId) =>
      poolQuotas[poolId.trim()] ?? defaultPoolQuota;

  /// Valida estrictamente una campaña. Lanza una excepción tipada si alguna regla es violada.
  void validate(BroadcastCampaignDTO campaign, {DateTime? evaluationTime}) {
    final DateTime targetTime = (evaluationTime ?? campaign.scheduledAt)
        .toUtc();

    // 1. Verificación de retardo mínimo anti-baneo
    if (campaign.delaySeconds < minDelaySeconds) {
      throw AntiBanPolicyException(
        message:
            'El retardo configurado (${campaign.delaySeconds}s) es menor al mínimo '
            'de seguridad anti-baneo ($minDelaySeconds s).',
        campaignId: campaign.campaignId,
        currentDelay: campaign.delaySeconds,
        minRequiredDelay: minDelaySeconds,
      );
    }

    // 2. Verificación de cuota de pool
    final int maxQuota = quotaForPool(campaign.poolId);
    if (campaign.targetJids.length > maxQuota) {
      throw PoolQuotaExceededException(
        message:
            'La cantidad de destinatarios (${campaign.targetJids.length}) excede '
            'la cuota máxima autorizada para el pool "${campaign.poolId}" ($maxQuota).',
        campaignId: campaign.campaignId,
        poolId: campaign.poolId,
        targetCount: campaign.targetJids.length,
        maxAllowedQuota: maxQuota,
      );
    }

    // 3. Verificación de ventanas horarias permitidas
    if (allowedWindows.isNotEmpty) {
      final bool inWindow = allowedWindows.any(
        (TimeWindow window) => window.contains(targetTime),
      );
      if (!inWindow) {
        throw BroadcastWindowViolationException(
          message:
              'La hora programada ($targetTime UTC) está fuera de las ventanas '
              'de difusión permitidas: ${allowedWindows.join(", ")}.',
          campaignId: campaign.campaignId,
          scheduledAt: targetTime,
          allowedWindows: List<TimeWindow>.unmodifiable(allowedWindows),
        );
      }
    }
  }

  /// Evalúa una campaña sin lanzar excepciones, retornando un informe de auditoría.
  BroadcastValidationReport evaluate(
    BroadcastCampaignDTO campaign, {
    DateTime? evaluationTime,
  }) {
    final List<String> violations = <String>[];
    final DateTime targetTime = (evaluationTime ?? campaign.scheduledAt)
        .toUtc();

    if (campaign.delaySeconds < minDelaySeconds) {
      violations.add(
        'Retardo anti-baneo insuficiente: ${campaign.delaySeconds}s < ${minDelaySeconds}s.',
      );
    }

    final int maxQuota = quotaForPool(campaign.poolId);
    if (campaign.targetJids.length > maxQuota) {
      violations.add(
        'Cuota de pool excedida: ${campaign.targetJids.length} > $maxQuota en pool "${campaign.poolId}".',
      );
    }

    if (allowedWindows.isNotEmpty) {
      final bool inWindow = allowedWindows.any(
        (TimeWindow window) => window.contains(targetTime),
      );
      if (!inWindow) {
        violations.add(
          'Fuera de ventana de difusión: $targetTime UTC no coincide con ninguna ventana.',
        );
      }
    }

    return BroadcastValidationReport(
      isValid: violations.isEmpty,
      violations: List<String>.unmodifiable(violations),
      campaignId: campaign.campaignId,
      poolId: campaign.poolId,
      targetCount: campaign.targetJids.length,
      evaluatedAt: DateTime.now().toUtc(),
    );
  }
}
