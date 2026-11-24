// 🎯 Contratos Canónicos de Producción Creativa y AdTech (Levita Studio) — SPRINT S03 (TASK-S03-03)
// Conforme a Doctrinas: §4 Zero Mocks, §6 Sad Paths, §39 Pure Dart Core, §45 Offline-First, §47 Verdad Atómica.

/// Códigos auditables de error para contratos de producción creativa de Levita Studio (§4, §6).
abstract final class CreativeStudioContractErrorCodes {
  /// Campo obligatorio vacío o en blanco.
  static const String emptyField = 'ERR_STUDIO_EMPTY_FIELD';

  /// Arquetipo visual no reconocido o inválido.
  static const String invalidArchetype = 'ERR_STUDIO_INVALID_ARCHETYPE';

  /// Formato publicitario objetivo no reconocido.
  static const String invalidTargetFormat = 'ERR_STUDIO_INVALID_TARGET_FORMAT';

  /// Código hexadecimal de color inválido (debe cumplir regex #RGB o #RRGGBB).
  static const String invalidColorHex = 'ERR_STUDIO_INVALID_COLOR_HEX';

  /// Dimensiones en píxeles inválidas (deben ser mayores a cero).
  static const String invalidDimensions = 'ERR_STUDIO_INVALID_DIMENSIONS';

  /// Tamaño de archivo en bytes inválido.
  static const String invalidFileSize = 'ERR_STUDIO_INVALID_FILE_SIZE';

  /// Estado de renderizado no reconocido.
  static const String invalidStatus = 'ERR_STUDIO_INVALID_STATUS';

  /// Tiempo de renderizado inválido (no puede ser negativo).
  static const String invalidRenderTime = 'ERR_STUDIO_INVALID_RENDER_TIME';
}

/// Excepción de validación de contratos de producción creativa (§6).
class CreativeStudioContractException extends FormatException {
  /// Código canónico auditable del error.
  final String errorCode;

  /// Nombre del campo causal de la violación (si aplica).
  final String? field;

  /// Valor que detonó el rechazo (si aplica).
  final dynamic rejectedValue;

  const CreativeStudioContractException(
    super.message, {
    required this.errorCode,
    this.field,
    this.rejectedValue,
  });

  @override
  String toString() =>
      'CreativeStudioContractException[$errorCode]: $message'
      '${field != null ? ' (field: $field)' : ''}';
}

/// Los 3 Arquetipos Visuales de producción canónica en Levita Studio.
enum VisualArchetype {
  /// Recorte de fotos de producto real (rembg), sombra de contacto y lienzo de marca.
  packshotHero('packshot_hero'),

  /// Composición puramente vectorial SVG con insignias tipográficas a costo $0.00.
  vectorTypography('vector_typography'),

  /// Escenografía y fondos aspiracionales generados con Flux Schnell en Cloudflare Workers AI.
  lifestyleScenic('lifestyle_scenic');

  final String value;
  const VisualArchetype(this.value);

  /// Resuelve el arquetipo visual desde texto plano, arrojando [CreativeStudioContractException] ante valores inválidos (§6).
  static VisualArchetype fromValue(String raw) {
    final String normalized = raw.trim().toLowerCase();
    for (final VisualArchetype arch in VisualArchetype.values) {
      if (arch.value == normalized) {
        return arch;
      }
    }
    throw CreativeStudioContractException(
      'Arquetipo visual no reconocido: "$raw". '
      'Permitidos: ${VisualArchetype.values.map((VisualArchetype e) => e.value).join(", ")}',
      errorCode: CreativeStudioContractErrorCodes.invalidArchetype,
      field: 'archetype',
      rejectedValue: raw,
    );
  }

  String toJson() => value;
}

/// Formatos publicitarios estándar de salida.
enum TargetAdFormat {
  /// Feed cuadrado 1:1 (1080 x 1080 px).
  feedSquare1x1('feed_square_1x1', 1080, 1080),

  /// Story / Reel vertical 9:16 (1080 x 1920 px).
  storyReel9x16('story_reel_9x16', 1080, 1920),

  /// Banner horizontal landscape 16:9 (1920 x 1080 px).
  bannerLandscape16x9('banner_landscape_16x9', 1920, 1080);

  final String value;
  final int defaultWidth;
  final int defaultHeight;

  const TargetAdFormat(this.value, this.defaultWidth, this.defaultHeight);

  static TargetAdFormat fromValue(String raw) {
    final String normalized = raw.trim().toLowerCase();
    for (final TargetAdFormat f in TargetAdFormat.values) {
      if (f.value == normalized) {
        return f;
      }
    }
    throw CreativeStudioContractException(
      'Formato publicitario no reconocido: "$raw". '
      'Permitidos: ${TargetAdFormat.values.map((TargetAdFormat e) => e.value).join(", ")}',
      errorCode: CreativeStudioContractErrorCodes.invalidTargetFormat,
      field: 'targetFormat',
      rejectedValue: raw,
    );
  }

  String toJson() => value;
}

/// Estados del ciclo de vida del trabajo de renderizado.
enum RenderJobStatus {
  queued('QUEUED'),
  processing('PROCESSING'),
  completed('COMPLETED'),
  failed('FAILED'),
  cancelled('CANCELLED');

  final String value;
  const RenderJobStatus(this.value);

  static RenderJobStatus fromValue(String raw) {
    final String normalized = raw.trim().toUpperCase();
    for (final RenderJobStatus s in RenderJobStatus.values) {
      if (s.value == normalized) {
        return s;
      }
    }
    throw CreativeStudioContractException(
      'Estado de renderizado no reconocido: "$raw".',
      errorCode: CreativeStudioContractErrorCodes.invalidStatus,
      field: 'status',
      rejectedValue: raw,
    );
  }

  String toJson() => value;
}

/// DTO Canónico de Directrices de Identidad de Marca (Brand Guidelines).
class BrandGuidelinesDTO {
  final String brandSlug;
  final String brandName;
  final String primaryColorHex;
  final String secondaryColorHex;
  final String accentColorHex;
  final String fontFamilyTitle;
  final String fontFamilyBody;
  final String? logoSvgPath;
  final String? tagline;
  final String? toneOfVoice;
  final Map<String, dynamic>? rules;

  const BrandGuidelinesDTO._({
    required this.brandSlug,
    required this.brandName,
    required this.primaryColorHex,
    required this.secondaryColorHex,
    required this.accentColorHex,
    required this.fontFamilyTitle,
    required this.fontFamilyBody,
    this.logoSvgPath,
    this.tagline,
    this.toneOfVoice,
    this.rules,
  });

  static final RegExp _hexColorRegex = RegExp(
    r'^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$',
  );

  /// Constructor con validación estricta de identidad gráfica (§4, §6).
  factory BrandGuidelinesDTO.validated({
    required String brandSlug,
    required String brandName,
    required String primaryColorHex,
    required String secondaryColorHex,
    required String accentColorHex,
    required String fontFamilyTitle,
    required String fontFamilyBody,
    String? logoSvgPath,
    String? tagline,
    String? toneOfVoice,
    Map<String, dynamic>? rules,
  }) {
    final String cleanSlug = brandSlug.trim().toLowerCase();
    if (cleanSlug.isEmpty) {
      throw const CreativeStudioContractException(
        'El identificador (slug) de la marca no puede estar vacío.',
        errorCode: CreativeStudioContractErrorCodes.emptyField,
        field: 'brandSlug',
      );
    }

    final String cleanName = brandName.trim();
    if (cleanName.isEmpty) {
      throw const CreativeStudioContractException(
        'El nombre comercial de la marca no puede estar vacío.',
        errorCode: CreativeStudioContractErrorCodes.emptyField,
        field: 'brandName',
      );
    }

    _validateHexColor(primaryColorHex, 'primaryColorHex');
    _validateHexColor(secondaryColorHex, 'secondaryColorHex');
    _validateHexColor(accentColorHex, 'accentColorHex');

    final String cleanTitleFont = fontFamilyTitle.trim();
    if (cleanTitleFont.isEmpty) {
      throw const CreativeStudioContractException(
        'La tipografía de títulos no puede estar vacía.',
        errorCode: CreativeStudioContractErrorCodes.emptyField,
        field: 'fontFamilyTitle',
      );
    }

    final String cleanBodyFont = fontFamilyBody.trim();
    if (cleanBodyFont.isEmpty) {
      throw const CreativeStudioContractException(
        'La tipografía de cuerpo no puede estar vacía.',
        errorCode: CreativeStudioContractErrorCodes.emptyField,
        field: 'fontFamilyBody',
      );
    }

    return BrandGuidelinesDTO._(
      brandSlug: cleanSlug,
      brandName: cleanName,
      primaryColorHex: primaryColorHex.trim().toUpperCase(),
      secondaryColorHex: secondaryColorHex.trim().toUpperCase(),
      accentColorHex: accentColorHex.trim().toUpperCase(),
      fontFamilyTitle: cleanTitleFont,
      fontFamilyBody: cleanBodyFont,
      logoSvgPath: logoSvgPath?.trim(),
      tagline: tagline?.trim(),
      toneOfVoice: toneOfVoice?.trim(),
      rules: rules != null ? Map<String, dynamic>.unmodifiable(rules) : null,
    );
  }

  static void _validateHexColor(String hex, String fieldName) {
    final String trimmed = hex.trim();
    if (!_hexColorRegex.hasMatch(trimmed)) {
      throw CreativeStudioContractException(
        'Color hexadecimal inválido "$hex" para $fieldName. Debe coincidir con formato #RGB o #RRGGBB.',
        errorCode: CreativeStudioContractErrorCodes.invalidColorHex,
        field: fieldName,
        rejectedValue: hex,
      );
    }
  }

  factory BrandGuidelinesDTO.fromJson(Map<String, dynamic> json) {
    return BrandGuidelinesDTO.validated(
      brandSlug:
          json['brandSlug'] as String? ?? json['brand_slug'] as String? ?? '',
      brandName:
          json['brandName'] as String? ?? json['brand_name'] as String? ?? '',
      primaryColorHex:
          json['primaryColorHex'] as String? ??
          json['primary_color_hex'] as String? ??
          '',
      secondaryColorHex:
          json['secondaryColorHex'] as String? ??
          json['secondary_color_hex'] as String? ??
          '',
      accentColorHex:
          json['accentColorHex'] as String? ??
          json['accent_color_hex'] as String? ??
          '',
      fontFamilyTitle:
          json['fontFamilyTitle'] as String? ??
          json['font_family_title'] as String? ??
          '',
      fontFamilyBody:
          json['fontFamilyBody'] as String? ??
          json['font_family_body'] as String? ??
          '',
      logoSvgPath:
          json['logoSvgPath'] as String? ?? json['logo_svg_path'] as String?,
      tagline: json['tagline'] as String?,
      toneOfVoice:
          json['toneOfVoice'] as String? ?? json['tone_of_voice'] as String?,
      rules: json['rules'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'brandSlug': brandSlug,
    'brandName': brandName,
    'primaryColorHex': primaryColorHex,
    'secondaryColorHex': secondaryColorHex,
    'accentColorHex': accentColorHex,
    'fontFamilyTitle': fontFamilyTitle,
    'fontFamilyBody': fontFamilyBody,
    if (logoSvgPath != null) 'logoSvgPath': logoSvgPath,
    if (tagline != null) 'tagline': tagline,
    if (toneOfVoice != null) 'toneOfVoice': toneOfVoice,
    if (rules != null) 'rules': rules,
  };

  BrandGuidelinesDTO copyWith({
    String? brandSlug,
    String? brandName,
    String? primaryColorHex,
    String? secondaryColorHex,
    String? accentColorHex,
    String? fontFamilyTitle,
    String? fontFamilyBody,
    String? logoSvgPath,
    String? tagline,
    String? toneOfVoice,
    Map<String, dynamic>? rules,
  }) {
    return BrandGuidelinesDTO.validated(
      brandSlug: brandSlug ?? this.brandSlug,
      brandName: brandName ?? this.brandName,
      primaryColorHex: primaryColorHex ?? this.primaryColorHex,
      secondaryColorHex: secondaryColorHex ?? this.secondaryColorHex,
      accentColorHex: accentColorHex ?? this.accentColorHex,
      fontFamilyTitle: fontFamilyTitle ?? this.fontFamilyTitle,
      fontFamilyBody: fontFamilyBody ?? this.fontFamilyBody,
      logoSvgPath: logoSvgPath ?? this.logoSvgPath,
      tagline: tagline ?? this.tagline,
      toneOfVoice: toneOfVoice ?? this.toneOfVoice,
      rules: rules ?? this.rules,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BrandGuidelinesDTO &&
          runtimeType == other.runtimeType &&
          brandSlug == other.brandSlug;

  @override
  int get hashCode => brandSlug.hashCode;

  @override
  String toString() => 'BrandGuidelinesDTO($brandSlug: $brandName)';
}

/// DTO Canónico de Activo Creativo en Inventario.
class CreativeAssetDTO {
  final String assetId;
  final String brandSlug;
  final VisualArchetype archetype;
  final String assetName;
  final String filePath;
  final String mimeType;
  final int widthPx;
  final int heightPx;
  final int fileSizeBytes;
  final String checksumSha256;
  final bool hasAlphaChannel;
  final Map<String, dynamic>? metadata;

  const CreativeAssetDTO._({
    required this.assetId,
    required this.brandSlug,
    required this.archetype,
    required this.assetName,
    required this.filePath,
    required this.mimeType,
    required this.widthPx,
    required this.heightPx,
    required this.fileSizeBytes,
    required this.checksumSha256,
    this.hasAlphaChannel = false,
    this.metadata,
  });

  /// Constructor con validación estricta de activo gráfico (§4, §6).
  factory CreativeAssetDTO.validated({
    required String assetId,
    required String brandSlug,
    required VisualArchetype archetype,
    required String assetName,
    required String filePath,
    required String mimeType,
    required int widthPx,
    required int heightPx,
    required int fileSizeBytes,
    required String checksumSha256,
    bool hasAlphaChannel = false,
    Map<String, dynamic>? metadata,
  }) {
    final String cleanAssetId = assetId.trim();
    if (cleanAssetId.isEmpty) {
      throw const CreativeStudioContractException(
        'El identificador del activo no puede estar vacío.',
        errorCode: CreativeStudioContractErrorCodes.emptyField,
        field: 'assetId',
      );
    }

    final String cleanBrand = brandSlug.trim();
    if (cleanBrand.isEmpty) {
      throw const CreativeStudioContractException(
        'El identificador de marca no puede estar vacío.',
        errorCode: CreativeStudioContractErrorCodes.emptyField,
        field: 'brandSlug',
      );
    }

    final String cleanName = assetName.trim();
    if (cleanName.isEmpty) {
      throw const CreativeStudioContractException(
        'El nombre del activo no puede estar vacío.',
        errorCode: CreativeStudioContractErrorCodes.emptyField,
        field: 'assetName',
      );
    }

    final String cleanPath = filePath.trim();
    if (cleanPath.isEmpty) {
      throw const CreativeStudioContractException(
        'La ruta del archivo no puede estar vacía.',
        errorCode: CreativeStudioContractErrorCodes.emptyField,
        field: 'filePath',
      );
    }

    final String cleanMime = mimeType.trim();
    if (cleanMime.isEmpty) {
      throw const CreativeStudioContractException(
        'El tipo MIME no puede estar vacío.',
        errorCode: CreativeStudioContractErrorCodes.emptyField,
        field: 'mimeType',
      );
    }

    if (widthPx <= 0 || heightPx <= 0) {
      throw CreativeStudioContractException(
        'Las dimensiones en píxeles (${widthPx}x$heightPx) deben ser mayores a cero.',
        errorCode: CreativeStudioContractErrorCodes.invalidDimensions,
        field: 'dimensions',
        rejectedValue: '${widthPx}x$heightPx',
      );
    }

    if (fileSizeBytes <= 0) {
      throw CreativeStudioContractException(
        'El tamaño del archivo ($fileSizeBytes bytes) debe ser mayor a cero.',
        errorCode: CreativeStudioContractErrorCodes.invalidFileSize,
        field: 'fileSizeBytes',
        rejectedValue: fileSizeBytes,
      );
    }

    final String cleanSha = checksumSha256.trim();
    if (cleanSha.isEmpty) {
      throw const CreativeStudioContractException(
        'El checksum SHA-256 no puede estar vacío.',
        errorCode: CreativeStudioContractErrorCodes.emptyField,
        field: 'checksumSha256',
      );
    }

    return CreativeAssetDTO._(
      assetId: cleanAssetId,
      brandSlug: cleanBrand,
      archetype: archetype,
      assetName: cleanName,
      filePath: cleanPath,
      mimeType: cleanMime,
      widthPx: widthPx,
      heightPx: heightPx,
      fileSizeBytes: fileSizeBytes,
      checksumSha256: cleanSha,
      hasAlphaChannel: hasAlphaChannel,
      metadata: metadata != null
          ? Map<String, dynamic>.unmodifiable(metadata)
          : null,
    );
  }

  factory CreativeAssetDTO.fromJson(Map<String, dynamic> json) {
    return CreativeAssetDTO.validated(
      assetId: json['assetId'] as String? ?? json['asset_id'] as String? ?? '',
      brandSlug:
          json['brandSlug'] as String? ?? json['brand_slug'] as String? ?? '',
      archetype: VisualArchetype.fromValue(json['archetype'] as String? ?? ''),
      assetName:
          json['assetName'] as String? ?? json['asset_name'] as String? ?? '',
      filePath:
          json['filePath'] as String? ?? json['file_path'] as String? ?? '',
      mimeType:
          json['mimeType'] as String? ?? json['mime_type'] as String? ?? '',
      widthPx: (json['widthPx'] ?? json['width_px']) as int? ?? 0,
      heightPx: (json['heightPx'] ?? json['height_px']) as int? ?? 0,
      fileSizeBytes:
          (json['fileSizeBytes'] ?? json['file_size_bytes']) as int? ?? 0,
      checksumSha256:
          json['checksumSha256'] as String? ??
          json['checksum_sha256'] as String? ??
          '',
      hasAlphaChannel:
          json['hasAlphaChannel'] as bool? ??
          json['has_alpha_channel'] as bool? ??
          false,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'assetId': assetId,
    'brandSlug': brandSlug,
    'archetype': archetype.toJson(),
    'assetName': assetName,
    'filePath': filePath,
    'mimeType': mimeType,
    'widthPx': widthPx,
    'heightPx': heightPx,
    'fileSizeBytes': fileSizeBytes,
    'checksumSha256': checksumSha256,
    'hasAlphaChannel': hasAlphaChannel,
    if (metadata != null) 'metadata': metadata,
  };

  CreativeAssetDTO copyWith({
    String? assetId,
    String? brandSlug,
    VisualArchetype? archetype,
    String? assetName,
    String? filePath,
    String? mimeType,
    int? widthPx,
    int? heightPx,
    int? fileSizeBytes,
    String? checksumSha256,
    bool? hasAlphaChannel,
    Map<String, dynamic>? metadata,
  }) {
    return CreativeAssetDTO.validated(
      assetId: assetId ?? this.assetId,
      brandSlug: brandSlug ?? this.brandSlug,
      archetype: archetype ?? this.archetype,
      assetName: assetName ?? this.assetName,
      filePath: filePath ?? this.filePath,
      mimeType: mimeType ?? this.mimeType,
      widthPx: widthPx ?? this.widthPx,
      heightPx: heightPx ?? this.heightPx,
      fileSizeBytes: fileSizeBytes ?? this.fileSizeBytes,
      checksumSha256: checksumSha256 ?? this.checksumSha256,
      hasAlphaChannel: hasAlphaChannel ?? this.hasAlphaChannel,
      metadata: metadata ?? this.metadata,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CreativeAssetDTO &&
          runtimeType == other.runtimeType &&
          assetId == other.assetId;

  @override
  int get hashCode => assetId.hashCode;

  @override
  String toString() =>
      'CreativeAssetDTO($assetId: $brandSlug - $assetName [${archetype.value}, ${widthPx}x$heightPx])';
}

/// DTO Canónico de Trabajo de Renderizado Publicitario (Render Job).
class StudioRenderJobDTO {
  final String jobId;
  final String brandSlug;
  final VisualArchetype archetype;
  final TargetAdFormat targetFormat;
  final String headline;
  final String? badgeLabel;
  final String callToAction;
  final String? inputImagePath;
  final String? outputImagePath;
  final RenderJobStatus status;
  final String? errorMessage;
  final int? renderTimeMs;
  final String createdAt;
  final String? completedAt;

  const StudioRenderJobDTO._({
    required this.jobId,
    required this.brandSlug,
    required this.archetype,
    required this.targetFormat,
    required this.headline,
    this.badgeLabel,
    required this.callToAction,
    this.inputImagePath,
    this.outputImagePath,
    required this.status,
    this.errorMessage,
    this.renderTimeMs,
    required this.createdAt,
    this.completedAt,
  });

  /// Constructor con validación estricta de trabajo publicitario (§4, §6).
  factory StudioRenderJobDTO.validated({
    required String jobId,
    required String brandSlug,
    required VisualArchetype archetype,
    required TargetAdFormat targetFormat,
    required String headline,
    String? badgeLabel,
    required String callToAction,
    String? inputImagePath,
    String? outputImagePath,
    required RenderJobStatus status,
    String? errorMessage,
    int? renderTimeMs,
    required String createdAt,
    String? completedAt,
  }) {
    final String cleanJobId = jobId.trim();
    if (cleanJobId.isEmpty) {
      throw const CreativeStudioContractException(
        'El identificador del trabajo de renderizado no puede estar vacío.',
        errorCode: CreativeStudioContractErrorCodes.emptyField,
        field: 'jobId',
      );
    }

    final String cleanBrand = brandSlug.trim();
    if (cleanBrand.isEmpty) {
      throw const CreativeStudioContractException(
        'El identificador de marca no puede estar vacío.',
        errorCode: CreativeStudioContractErrorCodes.emptyField,
        field: 'brandSlug',
      );
    }

    final String cleanHeadline = headline.trim();
    if (cleanHeadline.isEmpty) {
      throw const CreativeStudioContractException(
        'El titular (headline) publicitario no puede estar vacío.',
        errorCode: CreativeStudioContractErrorCodes.emptyField,
        field: 'headline',
      );
    }

    final String cleanCta = callToAction.trim();
    if (cleanCta.isEmpty) {
      throw const CreativeStudioContractException(
        'El llamado a la acción (call to action) no puede estar vacío.',
        errorCode: CreativeStudioContractErrorCodes.emptyField,
        field: 'callToAction',
      );
    }

    if (renderTimeMs != null && renderTimeMs < 0) {
      throw CreativeStudioContractException(
        'El tiempo de renderizado ($renderTimeMs ms) no puede ser negativo.',
        errorCode: CreativeStudioContractErrorCodes.invalidRenderTime,
        field: 'renderTimeMs',
        rejectedValue: renderTimeMs,
      );
    }

    return StudioRenderJobDTO._(
      jobId: cleanJobId,
      brandSlug: cleanBrand,
      archetype: archetype,
      targetFormat: targetFormat,
      headline: cleanHeadline,
      badgeLabel: badgeLabel?.trim(),
      callToAction: cleanCta,
      inputImagePath: inputImagePath?.trim(),
      outputImagePath: outputImagePath?.trim(),
      status: status,
      errorMessage: errorMessage?.trim(),
      renderTimeMs: renderTimeMs,
      createdAt: createdAt.trim(),
      completedAt: completedAt?.trim(),
    );
  }

  factory StudioRenderJobDTO.fromJson(Map<String, dynamic> json) {
    return StudioRenderJobDTO.validated(
      jobId: json['jobId'] as String? ?? json['job_id'] as String? ?? '',
      brandSlug:
          json['brandSlug'] as String? ?? json['brand_slug'] as String? ?? '',
      archetype: VisualArchetype.fromValue(json['archetype'] as String? ?? ''),
      targetFormat: TargetAdFormat.fromValue(
        json['targetFormat'] as String? ??
            json['target_format'] as String? ??
            '',
      ),
      headline: json['headline'] as String? ?? '',
      badgeLabel:
          json['badgeLabel'] as String? ?? json['badge_label'] as String?,
      callToAction:
          json['callToAction'] as String? ??
          json['call_to_action'] as String? ??
          '',
      inputImagePath:
          json['inputImagePath'] as String? ??
          json['input_image_path'] as String?,
      outputImagePath:
          json['outputImagePath'] as String? ??
          json['output_image_path'] as String?,
      status: RenderJobStatus.fromValue(json['status'] as String? ?? ''),
      errorMessage:
          json['errorMessage'] as String? ?? json['error_message'] as String?,
      renderTimeMs: (json['renderTimeMs'] ?? json['render_time_ms']) as int?,
      createdAt:
          json['createdAt'] as String? ??
          json['created_at'] as String? ??
          DateTime.now().toIso8601String(),
      completedAt:
          json['completedAt'] as String? ?? json['completed_at'] as String?,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'jobId': jobId,
    'brandSlug': brandSlug,
    'archetype': archetype.toJson(),
    'targetFormat': targetFormat.toJson(),
    'headline': headline,
    if (badgeLabel != null) 'badgeLabel': badgeLabel,
    'callToAction': callToAction,
    if (inputImagePath != null) 'inputImagePath': inputImagePath,
    if (outputImagePath != null) 'outputImagePath': outputImagePath,
    'status': status.toJson(),
    if (errorMessage != null) 'errorMessage': errorMessage,
    if (renderTimeMs != null) 'renderTimeMs': renderTimeMs,
    'createdAt': createdAt,
    if (completedAt != null) 'completedAt': completedAt,
  };

  StudioRenderJobDTO copyWith({
    String? jobId,
    String? brandSlug,
    VisualArchetype? archetype,
    TargetAdFormat? targetFormat,
    String? headline,
    String? badgeLabel,
    String? callToAction,
    String? inputImagePath,
    String? outputImagePath,
    RenderJobStatus? status,
    String? errorMessage,
    int? renderTimeMs,
    String? createdAt,
    String? completedAt,
  }) {
    return StudioRenderJobDTO.validated(
      jobId: jobId ?? this.jobId,
      brandSlug: brandSlug ?? this.brandSlug,
      archetype: archetype ?? this.archetype,
      targetFormat: targetFormat ?? this.targetFormat,
      headline: headline ?? this.headline,
      badgeLabel: badgeLabel ?? this.badgeLabel,
      callToAction: callToAction ?? this.callToAction,
      inputImagePath: inputImagePath ?? this.inputImagePath,
      outputImagePath: outputImagePath ?? this.outputImagePath,
      status: status ?? this.status,
      errorMessage: errorMessage ?? this.errorMessage,
      renderTimeMs: renderTimeMs ?? this.renderTimeMs,
      createdAt: createdAt ?? this.createdAt,
      completedAt: completedAt ?? this.completedAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is StudioRenderJobDTO &&
          runtimeType == other.runtimeType &&
          jobId == other.jobId;

  @override
  int get hashCode => jobId.hashCode;

  @override
  String toString() =>
      'StudioRenderJobDTO($jobId: $brandSlug [${archetype.value}, ${targetFormat.value}], Status=${status.value})';
}
