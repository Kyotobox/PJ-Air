// 🎯 Canonical Studio Headless Render Contract — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths, §40 Thin Client.

/// Arquetipos de composición visual soportados por Studio.
enum StudioArchetype {
  packshotHero('packshot_hero', 'png', 'packshot_hero'),
  socialPost('social_qa_post', 'svg', 'social_qa_post'),
  vectorBadge('vector_badge', 'svg', 'vector_badge'),
  receiptTicket('receipt_ticket', 'png', 'packshot_hero'),
  digitalAssetMockup('digital_asset_mockup', 'png', 'packshot_hero');

  final String value;
  final String defaultFormat;
  final String studioDeliverableType;

  const StudioArchetype(
    this.value,
    this.defaultFormat,
    this.studioDeliverableType,
  );

  static StudioArchetype fromString(String raw) {
    final String clean = raw.trim().toLowerCase();
    for (final StudioArchetype a in StudioArchetype.values) {
      if (a.value == clean || a.name.toLowerCase() == clean) return a;
    }
    throw ArgumentError.value(
      raw,
      'raw',
      'Arquetipo de Studio desconocido: "$raw". Válidos: '
          '${StudioArchetype.values.map((StudioArchetype e) => e.value).join(", ")}',
    );
  }
}

/// Formatos de salida para renderizado desatendido.
enum StudioRenderFormat {
  png('png'),
  svg('svg'),
  mp4('mp4');

  final String value;
  const StudioRenderFormat(this.value);

  static StudioRenderFormat fromString(String raw) {
    final String clean = raw.trim().toLowerCase();
    for (final StudioRenderFormat f in StudioRenderFormat.values) {
      if (f.value == clean || f.name.toLowerCase() == clean) return f;
    }
    throw ArgumentError.value(
      raw,
      'raw',
      'Formato de salida desconocido: "$raw". Válidos: png, svg, mp4',
    );
  }
}

/// Solicitud estructurada de renderizado enviada a Studio por satélites (Levita, BlueMarket, etc.).
class StudioRenderOrderRequest {
  final String orderId;
  final String tenantId;
  final String title;
  final StudioArchetype archetype;
  final StudioRenderFormat format;
  final String? priceTag;
  final String? currency;
  final String? productImageUrl;
  final Map<String, dynamic> metadata;

  StudioRenderOrderRequest({
    required this.orderId,
    required this.tenantId,
    required this.title,
    required this.archetype,
    StudioRenderFormat? format,
    this.priceTag,
    this.currency,
    this.productImageUrl,
    this.metadata = const <String, dynamic>{},
  }) : format =
           format ?? StudioRenderFormat.fromString(archetype.defaultFormat) {
    if (orderId.trim().isEmpty) {
      throw ArgumentError.value(
        orderId,
        'orderId',
        'El orderId no puede estar vacío.',
      );
    }
    if (tenantId.trim().isEmpty) {
      throw ArgumentError.value(
        tenantId,
        'tenantId',
        'El tenantId no puede estar vacío (debe especificar el satélite o boutique emisor).',
      );
    }
    if (title.trim().isEmpty) {
      throw ArgumentError.value(
        title,
        'title',
        'El título del entregable gráfico no puede estar vacío.',
      );
    }
  }

  /// Serialización estándar del contrato DTO.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'order_id': orderId.trim(),
    'tenant_id': tenantId.trim(),
    'title': title.trim(),
    'archetype': archetype.value,
    'format': format.value,
    if (priceTag != null) 'price_tag': priceTag,
    if (currency != null) 'currency': currency,
    if (productImageUrl != null) 'product_image_url': productImageUrl,
    if (metadata.isNotEmpty) 'metadata': metadata,
  };

  /// Transforma la solicitud a la especificación canónica esperada por bin/studio_render.dart.
  Map<String, dynamic> toCreativeOrderJson() {
    final Map<String, dynamic> deliverableMeta = <String, dynamic>{
      'format': format.value,
      'archetype': archetype.value,
      if (priceTag != null) 'price_tag': priceTag,
      if (currency != null) 'currency': currency,
      if (productImageUrl != null) 'product_image_url': productImageUrl,
      ...metadata,
    };

    return <String, dynamic>{
      'id': orderId.trim(),
      'tenant_id': tenantId.trim(),
      'title': title.trim(),
      'status': 'PENDING',
      'latitude': 0.2,
      'hard_constraints': <String, dynamic>{
        'require_logo': true,
        'required_aspect_ratio': format == StudioRenderFormat.mp4
            ? '9:16'
            : '1:1',
      },
      'soft_constraints': <String, dynamic>{
        'preferred_style_archetype': archetype.value,
      },
      'deliverables': <Map<String, dynamic>>[
        <String, dynamic>{
          'type': archetype.studioDeliverableType,
          'aspect_ratio': format == StudioRenderFormat.mp4 ? '9:16' : '1:1',
          'metadata': deliverableMeta,
        },
      ],
      'created_at': DateTime.now().toUtc().toIso8601String(),
    };
  }

  factory StudioRenderOrderRequest.fromJson(Map<String, dynamic> json) {
    final String? orderId = json['order_id'] as String?;
    final String? tenantId = json['tenant_id'] as String?;
    final String? title = json['title'] as String?;
    final String? archetypeStr = json['archetype'] as String?;

    if (orderId == null || orderId.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "order_id" faltante en StudioRenderOrderRequest.',
      );
    }
    if (tenantId == null || tenantId.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "tenant_id" faltante en StudioRenderOrderRequest.',
      );
    }
    if (title == null || title.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "title" faltante en StudioRenderOrderRequest.',
      );
    }
    if (archetypeStr == null || archetypeStr.trim().isEmpty) {
      throw ArgumentError(
        'Campo obligatorio "archetype" faltante en StudioRenderOrderRequest.',
      );
    }

    final String? formatStr = json['format'] as String?;
    final StudioRenderFormat? fmt = formatStr != null
        ? StudioRenderFormat.fromString(formatStr)
        : null;

    return StudioRenderOrderRequest(
      orderId: orderId,
      tenantId: tenantId,
      title: title,
      archetype: StudioArchetype.fromString(archetypeStr),
      format: fmt,
      priceTag: json['price_tag'] as String?,
      currency: json['currency'] as String?,
      productImageUrl: json['product_image_url'] as String?,
      metadata:
          (json['metadata'] as Map<String, dynamic>?) ??
          const <String, dynamic>{},
    );
  }
}

/// Resultado retornado tras la ejecución de renderizado por Studio.
class StudioRenderResult {
  final String orderId;
  final String tenantId;
  final bool success;
  final String? outputPath;
  final String format;
  final int durationMs;
  final String? error;

  StudioRenderResult({
    required this.orderId,
    required this.tenantId,
    required this.success,
    this.outputPath,
    required this.format,
    required this.durationMs,
    this.error,
  }) {
    if (orderId.trim().isEmpty) {
      throw ArgumentError('orderId no puede estar vacío.');
    }
    if (tenantId.trim().isEmpty) {
      throw ArgumentError('tenantId no puede estar vacío.');
    }
    if (success && (outputPath == null || outputPath!.trim().isEmpty)) {
      throw ArgumentError('Un resultado exitoso exige un outputPath válido.');
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'order_id': orderId.trim(),
    'tenant_id': tenantId.trim(),
    'success': success,
    if (outputPath != null) 'output_path': outputPath,
    'format': format,
    'duration_ms': durationMs,
    if (error != null) 'error': error,
  };

  factory StudioRenderResult.fromJson(Map<String, dynamic> json) {
    final String? orderId = json['order_id'] as String?;
    final String? tenantId = json['tenant_id'] as String?;
    final bool? success = json['success'] as bool?;
    final String? format = json['format'] as String?;
    final num? durationMs = json['duration_ms'] as num?;

    if (orderId == null ||
        tenantId == null ||
        success == null ||
        format == null ||
        durationMs == null) {
      throw ArgumentError(
        'Campos obligatorios faltantes en StudioRenderResult JSON.',
      );
    }

    return StudioRenderResult(
      orderId: orderId,
      tenantId: tenantId,
      success: success,
      outputPath: json['output_path'] as String?,
      format: format,
      durationMs: durationMs.toInt(),
      error: json['error'] as String?,
    );
  }
}
