import 'dart:convert';
import '../contracts/creative_studio_contracts.dart';

/// Contrato canónico Pure Dart para órdenes de renderizado publicitario (§39).
/// Enviado desde Levita Retail o BlueMarket hacia Levita Studio.
class CreativeRenderJobDTO {
  /// Identificador único del trabajo de render (UUID).
  final String jobId;

  /// Identificador del inquilino o cliente comercial.
  final String tenantId;

  /// Arquetipo visual ('packshot_hero', 'vector_typography', 'lifestyle_ai', 'video_vertical_9_16').
  final String archetype;

  /// Titular principal o gancho de la pieza publicitaria.
  final String headline;

  /// Subtítulo, precio promocional o llamada a la acción (CTA).
  final String? subheadline;

  /// Insignia o badge promocional específico.
  final String? _badgeLabel;

  /// URL de la imagen del producto (opcional para arquetipos puramente tipográficos).
  final String? productImageUrl;

  /// Configuración de identidad visual del cliente (colores, fuentes, logo).
  final Map<String, dynamic> brandDna;

  /// Formato publicitario objetivo (enum).
  final TargetAdFormat? _targetFormat;

  /// Formato de salida requerido ('svg', 'png', 'mp4').
  final String outputFormat;

  /// Estado del trabajo de renderizado.
  final dynamic status;

  /// URL final del activo en Cloudflare R2 una vez completado el procesamiento.
  final String? resultAssetUrl;

  /// Timestamp UTC de emisión del trabajo.
  final DateTime createdAt;

  static const Set<String> validArchetypes = <String>{
    'packshot_hero',
    'vector_typography',
    'lifestyle_ai',
    'video_vertical_9_16',
  };

  static const Set<String> validFormats = <String>{'svg', 'png', 'mp4'};

  static const Set<String> validStatuses = <String>{
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'QUEUED',
  };

  CreativeRenderJobDTO({
    required this.jobId,
    required this.tenantId,
    required this.archetype,
    required this.headline,
    this.subheadline,
    String? badgeLabel,
    TargetAdFormat? targetFormat,
    this.productImageUrl,
    this.brandDna = const <String, dynamic>{},
    this.outputFormat = 'png',
    this.status = 'PENDING',
    this.resultAssetUrl,
    DateTime? createdAt,
  }) : _badgeLabel = badgeLabel,
       _targetFormat = targetFormat,
       createdAt = (createdAt ?? DateTime.now()).toUtc() {
    _validate();
  }

  String get brandSlug => tenantId;

  String? get badgeLabel => _badgeLabel ?? subheadline;

  TargetAdFormat get targetFormat =>
      _targetFormat ??
      (outputFormat.toLowerCase() == 'mp4'
          ? TargetAdFormat.storyReel9x16
          : TargetAdFormat.feedSquare1x1);

  void _validate() {
    if (jobId.trim().isEmpty) {
      throw ArgumentError.value(
        jobId,
        'jobId',
        'El jobId no puede estar vacío.',
      );
    }
    if (tenantId.trim().isEmpty) {
      throw ArgumentError.value(
        tenantId,
        'tenantId',
        'El tenantId no puede estar vacío.',
      );
    }
    final String cleanArchetype = archetype.trim().toLowerCase();
    if (!validArchetypes.contains(cleanArchetype)) {
      throw ArgumentError.value(
        archetype,
        'archetype',
        'Arquetipo no soportado. Valores válidos: ' +
            validArchetypes.join(', '),
      );
    }
    if (headline.trim().isEmpty) {
      throw ArgumentError.value(
        headline,
        'headline',
        'El titular no puede estar vacío.',
      );
    }
    final String cleanFormat = outputFormat.trim().toLowerCase();
    if (!validFormats.contains(cleanFormat)) {
      throw ArgumentError.value(
        outputFormat,
        'outputFormat',
        'Formato de salida no soportado. Valores válidos: ' +
            validFormats.join(', '),
      );
    }
    final String cleanStatus = (status is RenderJobStatus)
        ? (status as RenderJobStatus).name.toUpperCase()
        : status.toString().trim().toUpperCase();
    if (!validStatuses.contains(cleanStatus)) {
      throw ArgumentError.value(
        status,
        'status',
        'Estado de job no soportado. Valores válidos: ' +
            validStatuses.join(', '),
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'job_id': jobId.trim(),
    'tenant_id': tenantId.trim(),
    'archetype': archetype.trim().toLowerCase(),
    'headline': headline.trim(),
    if (subheadline != null) 'subheadline': subheadline!.trim(),
    if (_badgeLabel != null) 'badge_label': _badgeLabel.trim(),
    if (productImageUrl != null) 'product_image_url': productImageUrl!.trim(),
    'brand_dna': brandDna,
    'output_format': outputFormat.trim().toLowerCase(),
    'status': (status is RenderJobStatus)
        ? (status as RenderJobStatus).name.toUpperCase()
        : status.toString().trim().toUpperCase(),
    if (resultAssetUrl != null) 'result_asset_url': resultAssetUrl!.trim(),
    'created_at': createdAt.toIso8601String(),
  };

  factory CreativeRenderJobDTO.fromJson(Map<String, dynamic> json) {
    return CreativeRenderJobDTO(
      jobId: json['job_id'] as String? ?? '',
      tenantId: json['tenant_id'] as String? ?? '',
      archetype: json['archetype'] as String? ?? '',
      headline: json['headline'] as String? ?? '',
      subheadline: json['subheadline'] as String?,
      badgeLabel: json['badge_label'] as String?,
      productImageUrl: json['product_image_url'] as String?,
      brandDna:
          (json['brand_dna'] as Map<String, dynamic>?) ??
          const <String, dynamic>{},
      outputFormat: json['output_format'] as String? ?? 'png',
      status: json['status'] as String? ?? 'PENDING',
      resultAssetUrl: json['result_asset_url'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
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
      other is CreativeRenderJobDTO &&
          runtimeType == other.runtimeType &&
          jobId == other.jobId &&
          tenantId == other.tenantId &&
          archetype == other.archetype &&
          headline == other.headline &&
          outputFormat == other.outputFormat &&
          status == other.status;

  @override
  int get hashCode =>
      Object.hash(jobId, tenantId, archetype, headline, outputFormat, status);

  @override
  String toString() =>
      'CreativeRenderJobDTO(jobId: , tenant: , archetype: , status: )';
}
