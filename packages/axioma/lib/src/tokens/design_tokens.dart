/// CONEXT Fleet Design Tokens Standard
///
/// Modelos tipados y constantes inmutables para el sistema de diseño transversal
/// de toda la flota CONEXT. Adhiere estrictamente a Pure Dart Core (§39).
library;

/// Validación estricta de color hexadecimal (#RRGGBB o #RRGGBBAA).
bool isValidHexColor(String hex) {
  final RegExp hexRegex = RegExp(r'^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$');
  return hexRegex.hasMatch(hex.trim());
}

/// Colores estándar de la flota.
class FleetColors {
  final String bgDark;
  final String cardBg;
  final String textMain;
  final String textMuted;
  final String primary;
  final String success;
  final String warning;
  final String danger;
  final String purple;

  const FleetColors({
    required this.bgDark,
    required this.cardBg,
    required this.textMain,
    required this.textMuted,
    required this.primary,
    required this.success,
    required this.warning,
    required this.danger,
    required this.purple,
  });

  /// Instancia canónica inmutable según vault/contracts/design_tokens.json.
  static const FleetColors canonical = FleetColors(
    bgDark: '#070a13',
    cardBg: '#0f172a',
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
    primary: '#38bdf8',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#a855f7',
  );

  factory FleetColors.fromJson(Map<String, dynamic> json) {
    for (final String key in <String>[
      'bg_dark',
      'card_bg',
      'text_main',
      'text_muted',
      'primary',
      'success',
      'warning',
      'danger',
      'purple',
    ]) {
      if (!json.containsKey(key) || json[key] == null) {
        throw FormatException('FleetColors carece del campo obligatorio: $key');
      }
      final String val = json[key].toString();
      if (!isValidHexColor(val)) {
        throw FormatException(
          'FleetColors campo "$key" no tiene un formato hexadecimal válido: "$val"',
        );
      }
    }

    return FleetColors(
      bgDark: json['bg_dark'] as String,
      cardBg: json['card_bg'] as String,
      textMain: json['text_main'] as String,
      textMuted: json['text_muted'] as String,
      primary: json['primary'] as String,
      success: json['success'] as String,
      warning: json['warning'] as String,
      danger: json['danger'] as String,
      purple: json['purple'] as String,
    );
  }

  Map<String, String> toJson() => <String, String>{
    'bg_dark': bgDark,
    'card_bg': cardBg,
    'text_main': textMain,
    'text_muted': textMuted,
    'primary': primary,
    'success': success,
    'warning': warning,
    'danger': danger,
    'purple': purple,
  };
}

/// Tipografía estándar de la flota.
class FleetTypography {
  final String fontFamilySans;
  final String fontFamilyMono;
  final String fontSizeXs;
  final String fontSizeSm;
  final String fontSizeBase;
  final String fontSizeLg;
  final String fontSizeXl;

  const FleetTypography({
    required this.fontFamilySans,
    required this.fontFamilyMono,
    required this.fontSizeXs,
    required this.fontSizeSm,
    required this.fontSizeBase,
    required this.fontSizeLg,
    required this.fontSizeXl,
  });

  static const FleetTypography canonical = FleetTypography(
    fontFamilySans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontFamilyMono:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSizeXs: '12px',
    fontSizeSm: '14px',
    fontSizeBase: '16px',
    fontSizeLg: '18px',
    fontSizeXl: '24px',
  );

  factory FleetTypography.fromJson(Map<String, dynamic> json) {
    for (final String key in <String>[
      'font_family_sans',
      'font_family_mono',
      'font_size_xs',
      'font_size_sm',
      'font_size_base',
      'font_size_lg',
      'font_size_xl',
    ]) {
      if (!json.containsKey(key) || json[key] == null) {
        throw FormatException(
          'FleetTypography carece del campo obligatorio: $key',
        );
      }
    }

    return FleetTypography(
      fontFamilySans: json['font_family_sans'] as String,
      fontFamilyMono: json['font_family_mono'] as String,
      fontSizeXs: json['font_size_xs'] as String,
      fontSizeSm: json['font_size_sm'] as String,
      fontSizeBase: json['font_size_base'] as String,
      fontSizeLg: json['font_size_lg'] as String,
      fontSizeXl: json['font_size_xl'] as String,
    );
  }

  Map<String, String> toJson() => <String, String>{
    'font_family_sans': fontFamilySans,
    'font_family_mono': fontFamilyMono,
    'font_size_xs': fontSizeXs,
    'font_size_sm': fontSizeSm,
    'font_size_base': fontSizeBase,
    'font_size_lg': fontSizeLg,
    'font_size_xl': fontSizeXl,
  };
}

/// Radios de borde estándar.
class FleetRadii {
  final String radiusSm;
  final String radiusMd;
  final String radiusLg;
  final String radiusFull;

  const FleetRadii({
    required this.radiusSm,
    required this.radiusMd,
    required this.radiusLg,
    required this.radiusFull,
  });

  static const FleetRadii canonical = FleetRadii(
    radiusSm: '4px',
    radiusMd: '8px',
    radiusLg: '16px',
    radiusFull: '9999px',
  );

  factory FleetRadii.fromJson(Map<String, dynamic> json) {
    for (final String key in <String>[
      'radius_sm',
      'radius_md',
      'radius_lg',
      'radius_full',
    ]) {
      if (!json.containsKey(key) || json[key] == null) {
        throw FormatException('FleetRadii carece del campo obligatorio: $key');
      }
    }

    return FleetRadii(
      radiusSm: json['radius_sm'] as String,
      radiusMd: json['radius_md'] as String,
      radiusLg: json['radius_lg'] as String,
      radiusFull: json['radius_full'] as String,
    );
  }

  Map<String, String> toJson() => <String, String>{
    'radius_sm': radiusSm,
    'radius_md': radiusMd,
    'radius_lg': radiusLg,
    'radius_full': radiusFull,
  };
}

/// Sombras estándar de elevación.
class FleetShadows {
  final String shadowSm;
  final String shadowMd;
  final String shadowLg;

  const FleetShadows({
    required this.shadowSm,
    required this.shadowMd,
    required this.shadowLg,
  });

  static const FleetShadows canonical = FleetShadows(
    shadowSm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    shadowMd: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
    shadowLg: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
  );

  factory FleetShadows.fromJson(Map<String, dynamic> json) {
    for (final String key in <String>['shadow_sm', 'shadow_md', 'shadow_lg']) {
      if (!json.containsKey(key) || json[key] == null) {
        throw FormatException(
          'FleetShadows carece del campo obligatorio: $key',
        );
      }
    }

    return FleetShadows(
      shadowSm: json['shadow_sm'] as String,
      shadowMd: json['shadow_md'] as String,
      shadowLg: json['shadow_lg'] as String,
    );
  }

  Map<String, String> toJson() => <String, String>{
    'shadow_sm': shadowSm,
    'shadow_md': shadowMd,
    'shadow_lg': shadowLg,
  };
}

/// Transiciones y animaciones estándar.
class FleetTransitions {
  final String transitionFast;
  final String transitionBase;

  const FleetTransitions({
    required this.transitionFast,
    required this.transitionBase,
  });

  static const FleetTransitions canonical = FleetTransitions(
    transitionFast: 'all 0.15s ease',
    transitionBase: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  );

  factory FleetTransitions.fromJson(Map<String, dynamic> json) {
    for (final String key in <String>['transition_fast', 'transition_base']) {
      if (!json.containsKey(key) || json[key] == null) {
        throw FormatException(
          'FleetTransitions carece del campo obligatorio: $key',
        );
      }
    }

    return FleetTransitions(
      transitionFast: json['transition_fast'] as String,
      transitionBase: json['transition_base'] as String,
    );
  }

  Map<String, String> toJson() => <String, String>{
    'transition_fast': transitionFast,
    'transition_base': transitionBase,
  };
}

/// Agregado raíz de tokens de diseño para la flota CONEXT.
class DesignTokens {
  final String version;
  final String name;
  final FleetColors colors;
  final FleetTypography typography;
  final FleetRadii radii;
  final FleetShadows shadows;
  final FleetTransitions transitions;

  const DesignTokens({
    required this.version,
    required this.name,
    required this.colors,
    required this.typography,
    required this.radii,
    required this.shadows,
    required this.transitions,
  });

  /// Instancia canónica estándar de la flota.
  static const DesignTokens canonical = DesignTokens(
    version: '1.0.0',
    name: 'CONEXT Fleet Design Tokens Standard',
    colors: FleetColors.canonical,
    typography: FleetTypography.canonical,
    radii: FleetRadii.canonical,
    shadows: FleetShadows.canonical,
    transitions: FleetTransitions.canonical,
  );

  factory DesignTokens.fromJson(Map<String, dynamic> json) {
    final dynamic ver = json['version'];
    final dynamic nm = json['name'];
    if (ver == null || ver.toString().trim().isEmpty) {
      throw const FormatException(
        'DesignTokens requiere un campo "version" no vacío',
      );
    }
    if (nm == null || nm.toString().trim().isEmpty) {
      throw const FormatException(
        'DesignTokens requiere un campo "name" no vacío',
      );
    }

    if (!json.containsKey('colors') ||
        json['colors'] is! Map<String, dynamic>) {
      throw const FormatException(
        'DesignTokens requiere un objeto "colors" válido',
      );
    }
    if (!json.containsKey('typography') ||
        json['typography'] is! Map<String, dynamic>) {
      throw const FormatException(
        'DesignTokens requiere un objeto "typography" válido',
      );
    }
    if (!json.containsKey('radii') || json['radii'] is! Map<String, dynamic>) {
      throw const FormatException(
        'DesignTokens requiere un objeto "radii" válido',
      );
    }
    if (!json.containsKey('shadows') ||
        json['shadows'] is! Map<String, dynamic>) {
      throw const FormatException(
        'DesignTokens requiere un objeto "shadows" válido',
      );
    }
    if (!json.containsKey('transitions') ||
        json['transitions'] is! Map<String, dynamic>) {
      throw const FormatException(
        'DesignTokens requiere un objeto "transitions" válido',
      );
    }

    return DesignTokens(
      version: ver.toString(),
      name: nm.toString(),
      colors: FleetColors.fromJson(json['colors'] as Map<String, dynamic>),
      typography: FleetTypography.fromJson(
        json['typography'] as Map<String, dynamic>,
      ),
      radii: FleetRadii.fromJson(json['radii'] as Map<String, dynamic>),
      shadows: FleetShadows.fromJson(json['shadows'] as Map<String, dynamic>),
      transitions: FleetTransitions.fromJson(
        json['transitions'] as Map<String, dynamic>,
      ),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'version': version,
    'name': name,
    'colors': colors.toJson(),
    'typography': typography.toJson(),
    'radii': radii.toJson(),
    'shadows': shadows.toJson(),
    'transitions': transitions.toJson(),
  };
}
