// 🎯 Canonical Agency Subscription Contract — Pure Dart (§39)
// Conforme a: §4 Cero Mocks, §6 Sad Paths, §39 Pure Dart Core, §45 Soberanía Offline.

import 'dart:convert';

/// Contrato canónico Pure Dart para el plan y cuota de suscripción de agencia B2B (§39).
/// Controla la cuota mensual de artes gráficos y diseño asignada a un comercio.
class AgencySubscriptionDTO {
  /// Identificador único o slug del comercio suscriptor.
  final String merchantId;

  /// Nivel o tier del plan suscrito (ej. 'starter', 'growth', 'agency', 'enterprise').
  final String planTier;

  /// Cuota mensual total de diseños asignados para el ciclo.
  final int monthlyQuota;

  /// Cantidad de diseños consumidos / utilizados durante el ciclo vigente.
  final int usedDesigns;

  /// Fecha y hora UTC hasta la cual está activa la suscripción.
  final DateTime activeUntil;

  AgencySubscriptionDTO({
    required this.merchantId,
    required this.planTier,
    required this.monthlyQuota,
    this.usedDesigns = 0,
    required DateTime activeUntil,
  }) : activeUntil = activeUntil.toUtc() {
    _validate();
  }

  void _validate() {
    if (merchantId.trim().isEmpty) {
      throw ArgumentError.value(
        merchantId,
        'merchantId',
        'El identificador del comercio (merchantId) no puede estar vacío.',
      );
    }
    if (planTier.trim().isEmpty) {
      throw ArgumentError.value(
        planTier,
        'planTier',
        'El nivel del plan (planTier) no puede estar vacío.',
      );
    }
    if (monthlyQuota < 0) {
      throw ArgumentError.value(
        monthlyQuota,
        'monthlyQuota',
        'La cuota mensual (monthlyQuota) no puede ser negativa.',
      );
    }
    if (usedDesigns < 0) {
      throw ArgumentError.value(
        usedDesigns,
        'usedDesigns',
        'El contador de diseños usados (usedDesigns) no puede ser negativo.',
      );
    }
  }

  /// Cantidad restante de diseños disponibles en el ciclo.
  int get remainingQuota {
    final int remaining = monthlyQuota - usedDesigns;
    return remaining > 0 ? remaining : 0;
  }

  /// Retorna si el comercio aún cuenta con cuota para generar nuevos diseños.
  bool get hasQuota => usedDesigns < monthlyQuota;

  /// Retorna si la suscripción está vigente respecto a [at] (por defecto hora actual UTC).
  bool isActive({DateTime? at}) {
    final DateTime checkTime = (at ?? DateTime.now()).toUtc();
    return checkTime.isBefore(activeUntil);
  }

  /// Serialización estándar a Map JSON.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'merchant_id': merchantId.trim(),
    'plan_tier': planTier.trim(),
    'monthly_quota': monthlyQuota,
    'used_designs': usedDesigns,
    'active_until': activeUntil.toIso8601String(),
  };

  /// Deserialización desde Map JSON con validación estricta ante corrupción (§6).
  factory AgencySubscriptionDTO.fromJson(Map<String, dynamic> json) {
    final dynamic rawMerchantId = json['merchant_id'] ?? json['merchantId'];
    if (rawMerchantId == null ||
        rawMerchantId is! String ||
        rawMerchantId.trim().isEmpty) {
      throw const FormatException(
        'Campo obligatorio "merchant_id" ausente, corrupto o vacío en AgencySubscriptionDTO.',
      );
    }

    final dynamic rawPlanTier = json['plan_tier'] ?? json['planTier'];
    if (rawPlanTier == null ||
        rawPlanTier is! String ||
        rawPlanTier.trim().isEmpty) {
      throw const FormatException(
        'Campo obligatorio "plan_tier" ausente, corrupto o vacío en AgencySubscriptionDTO.',
      );
    }

    final dynamic rawMonthlyQuota =
        json['monthly_quota'] ?? json['monthlyQuota'];
    if (rawMonthlyQuota == null || rawMonthlyQuota is! int) {
      throw FormatException(
        'Campo obligatorio "monthly_quota" inválido o corrupto: $rawMonthlyQuota',
      );
    }
    if (rawMonthlyQuota < 0) {
      throw FormatException(
        'La cuota mensual "monthly_quota" no puede ser negativa: $rawMonthlyQuota',
      );
    }

    final dynamic rawUsedDesigns = json['used_designs'] ?? json['usedDesigns'];
    final int parsedUsedDesigns;
    if (rawUsedDesigns == null) {
      parsedUsedDesigns = 0;
    } else if (rawUsedDesigns is int) {
      if (rawUsedDesigns < 0) {
        throw FormatException(
          'El valor "used_designs" no puede ser negativo: $rawUsedDesigns',
        );
      }
      parsedUsedDesigns = rawUsedDesigns;
    } else {
      throw FormatException(
        'Campo "used_designs" corrupto (no es entero): $rawUsedDesigns',
      );
    }

    final dynamic rawActiveUntil = json['active_until'] ?? json['activeUntil'];
    if (rawActiveUntil == null || rawActiveUntil is! String) {
      throw FormatException(
        'Campo obligatorio "active_until" ausente o no textual: $rawActiveUntil',
      );
    }
    final DateTime? parsedActiveUntil = DateTime.tryParse(rawActiveUntil);
    if (parsedActiveUntil == null) {
      throw FormatException(
        'Fecha "active_until" corrupta o en formato inválido: $rawActiveUntil',
      );
    }

    return AgencySubscriptionDTO(
      merchantId: rawMerchantId.trim(),
      planTier: rawPlanTier.trim(),
      monthlyQuota: rawMonthlyQuota,
      usedDesigns: parsedUsedDesigns,
      activeUntil: parsedActiveUntil,
    );
  }

  /// Deserialización desde cadena JSON cruda.
  factory AgencySubscriptionDTO.fromJsonString(String source) {
    final dynamic decoded = jsonDecode(source);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException(
        'El contenido decodificado debe ser un objeto JSON (Map<String, dynamic>).',
      );
    }
    return AgencySubscriptionDTO.fromJson(decoded);
  }

  /// Serialización a cadena JSON formateada o compacta.
  String toJsonString({bool pretty = false}) {
    if (pretty) {
      return const JsonEncoder.withIndent('  ').convert(toJson());
    }
    return jsonEncode(toJson());
  }

  /// Creación de copias inmutables con campos modificados.
  AgencySubscriptionDTO copyWith({
    String? merchantId,
    String? planTier,
    int? monthlyQuota,
    int? usedDesigns,
    DateTime? activeUntil,
  }) {
    return AgencySubscriptionDTO(
      merchantId: merchantId ?? this.merchantId,
      planTier: planTier ?? this.planTier,
      monthlyQuota: monthlyQuota ?? this.monthlyQuota,
      usedDesigns: usedDesigns ?? this.usedDesigns,
      activeUntil: activeUntil ?? this.activeUntil,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AgencySubscriptionDTO &&
          runtimeType == other.runtimeType &&
          merchantId == other.merchantId &&
          planTier == other.planTier &&
          monthlyQuota == other.monthlyQuota &&
          usedDesigns == other.usedDesigns &&
          activeUntil == other.activeUntil;

  @override
  int get hashCode =>
      Object.hash(merchantId, planTier, monthlyQuota, usedDesigns, activeUntil);

  @override
  String toString() =>
      'AgencySubscriptionDTO(merchant: $merchantId, tier: $planTier, quota: $usedDesigns/$monthlyQuota, activeUntil: ${activeUntil.toIso8601String()})';
}
