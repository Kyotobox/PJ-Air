/// Immutable Semantic Color Tokens & WCAG 2.1 AA Enforcement (§39 Pure Dart Core)
///
/// Implements strictly paired semantic tokens where every surface / background
/// color is paired with its verified contrast text color.
///
/// Guaranteed invariants:
/// - Immutable tokens and pairs.
/// - Minimum contrast ratio >= 4.5:1 for normal text (WCAG 2.1 AA).
/// - Minimum contrast ratio >= 3.0:1 for large text (WCAG 2.1 AA).
/// - ContrastDeficitException thrown on registration or resolution of any deficit pair.
library;

import 'contrast_calculator.dart';
import 'ui_exceptions.dart';

/// An immutable pair consisting of a background/surface color and its contrasting text color.
final class SemanticColorPair {
  /// Canonical semantic identifier (e.g. 'primary', 'muted', 'surface').
  final String name;

  /// Background / surface color in normalized `#rrggbb` format.
  final String surface;

  /// Foreground / text color in normalized `#rrggbb` format.
  final String onSurface;

  /// Mathematical WCAG 2.1 contrast ratio between [surface] and [onSurface].
  final double contrastRatio;

  /// If true, this pair is certified only for large text (>= 18pt or 14pt bold, min 3.0:1).
  final bool isLargeTextOnly;

  SemanticColorPair({
    required this.name,
    required String surface,
    required String onSurface,
    this.isLargeTextOnly = false,
    bool validate = true,
  }) : surface = ContrastCalculator.normalizeHex(surface),
       onSurface = ContrastCalculator.normalizeHex(onSurface),
       contrastRatio = ContrastCalculator.contrastRatio(surface, onSurface) {
    if (validate) {
      final double minRequired = isLargeTextOnly
          ? ContrastCalculator.minLargeTextRatio
          : ContrastCalculator.minNormalTextRatio;
      if (contrastRatio < minRequired) {
        throw ContrastDeficitException(
          contrastRatio: contrastRatio,
          requiredRatio: minRequired,
          backgroundHex: this.surface,
          foregroundHex: this.onSurface,
          tokenName: name,
        );
      }
    }
  }

  /// Convenience alias for [onSurface].
  String get text => onSurface;

  /// Convenience alias for [surface].
  String get background => surface;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'name': name,
    'surface': surface,
    'on_surface': onSurface,
    'contrast_ratio': double.parse(contrastRatio.toStringAsFixed(2)),
    'is_large_text_only': isLargeTextOnly,
  };

  factory SemanticColorPair.fromJson(Map<String, dynamic> json) {
    return SemanticColorPair(
      name: json['name'] as String,
      surface: json['surface'] as String,
      onSurface:
          (json['on_surface'] ?? json['text'] ?? json['onSurface']) as String,
      isLargeTextOnly: (json['is_large_text_only'] ?? false) as bool,
      validate: true,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SemanticColorPair &&
          runtimeType == other.runtimeType &&
          name == other.name &&
          surface == other.surface &&
          onSurface == other.onSurface &&
          isLargeTextOnly == other.isLargeTextOnly;

  @override
  int get hashCode => Object.hash(name, surface, onSurface, isLargeTextOnly);

  @override
  String toString() =>
      'SemanticColorPair($name: surface: $surface <-> onSurface: $onSurface, ratio: ${contrastRatio.toStringAsFixed(2)}:1)';
}

/// Accessor for surface / background colors of paired semantic tokens.
final class SurfaceTokens {
  final SemanticColorPair _primary;
  final SemanticColorPair _muted;
  final SemanticColorPair _surface;
  final SemanticColorPair _card;
  final SemanticColorPair _success;
  final SemanticColorPair _warning;
  final SemanticColorPair _danger;
  final SemanticColorPair _accent;
  final Map<String, SemanticColorPair> _custom;

  const SurfaceTokens({
    required SemanticColorPair primary,
    required SemanticColorPair muted,
    required SemanticColorPair surface,
    required SemanticColorPair card,
    required SemanticColorPair success,
    required SemanticColorPair warning,
    required SemanticColorPair danger,
    required SemanticColorPair accent,
    Map<String, SemanticColorPair> custom = const <String, SemanticColorPair>{},
  }) : _primary = primary,
       _muted = muted,
       _surface = surface,
       _card = card,
       _success = success,
       _warning = warning,
       _danger = danger,
       _accent = accent,
       _custom = custom;

  String get primary => _primary.surface;
  String get muted => _muted.surface;
  String get surface => _surface.surface;
  String get background => _surface.surface;
  String get card => _card.surface;
  String get success => _success.surface;
  String get warning => _warning.surface;
  String get danger => _danger.surface;
  String get accent => _accent.surface;

  /// Resolves surface color by name (e.g. 'primary' or 'surfacePrimary').
  String? operator [](String name) {
    switch (name) {
      case 'primary':
      case 'surfacePrimary':
        return primary;
      case 'muted':
      case 'surfaceMuted':
        return muted;
      case 'surface':
      case 'background':
      case 'surfaceBackground':
        return surface;
      case 'card':
      case 'surfaceCard':
        return card;
      case 'success':
      case 'surfaceSuccess':
        return success;
      case 'warning':
      case 'surfaceWarning':
        return warning;
      case 'danger':
      case 'surfaceDanger':
        return danger;
      case 'accent':
      case 'surfaceAccent':
        return accent;
      default:
        final SemanticColorPair? direct = _custom[name];
        if (direct != null) return direct.surface;
        if (name.startsWith('surface') && name.length > 7) {
          final String key =
              name.substring(7, 8).toLowerCase() + name.substring(8);
          return _custom[key]?.surface;
        }
        return null;
    }
  }

  Map<String, String> toMap() {
    final Map<String, String> map = <String, String>{
      'primary': primary,
      'muted': muted,
      'surface': surface,
      'background': background,
      'card': card,
      'success': success,
      'warning': warning,
      'danger': danger,
      'accent': accent,
    };
    for (final MapEntry<String, SemanticColorPair> entry in _custom.entries) {
      map[entry.key] = entry.value.surface;
    }
    return map;
  }
}

/// Accessor for text / contrast colors of paired semantic tokens.
final class TextTokens {
  final SemanticColorPair _primary;
  final SemanticColorPair _muted;
  final SemanticColorPair _surface;
  final SemanticColorPair _card;
  final SemanticColorPair _success;
  final SemanticColorPair _warning;
  final SemanticColorPair _danger;
  final SemanticColorPair _accent;
  final Map<String, SemanticColorPair> _custom;

  const TextTokens({
    required SemanticColorPair primary,
    required SemanticColorPair muted,
    required SemanticColorPair surface,
    required SemanticColorPair card,
    required SemanticColorPair success,
    required SemanticColorPair warning,
    required SemanticColorPair danger,
    required SemanticColorPair accent,
    Map<String, SemanticColorPair> custom = const <String, SemanticColorPair>{},
  }) : _primary = primary,
       _muted = muted,
       _surface = surface,
       _card = card,
       _success = success,
       _warning = warning,
       _danger = danger,
       _accent = accent,
       _custom = custom;

  String get onPrimary => _primary.onSurface;
  String get onMuted => _muted.onSurface;
  String get onSurface => _surface.onSurface;
  String get onBackground => _surface.onSurface;
  String get onCard => _card.onSurface;
  String get onSuccess => _success.onSurface;
  String get onWarning => _warning.onSurface;
  String get onDanger => _danger.onSurface;
  String get onAccent => _accent.onSurface;

  /// Resolves text color by token name (e.g. 'onPrimary' or 'primary').
  String? operator [](String name) {
    switch (name) {
      case 'onPrimary':
      case 'primary':
        return onPrimary;
      case 'onMuted':
      case 'muted':
        return onMuted;
      case 'onSurface':
      case 'surface':
      case 'onBackground':
      case 'background':
        return onSurface;
      case 'onCard':
      case 'card':
        return onCard;
      case 'onSuccess':
      case 'success':
        return onSuccess;
      case 'onWarning':
      case 'warning':
        return onWarning;
      case 'onDanger':
      case 'danger':
        return onDanger;
      case 'onAccent':
      case 'accent':
        return onAccent;
      default:
        final SemanticColorPair? direct = _custom[name];
        if (direct != null) return direct.onSurface;
        if (name.startsWith('on') && name.length > 2) {
          final String key =
              name.substring(2, 3).toLowerCase() + name.substring(3);
          return _custom[key]?.onSurface;
        }
        return null;
    }
  }

  Map<String, String> toMap() {
    final Map<String, String> map = <String, String>{
      'onPrimary': onPrimary,
      'onMuted': onMuted,
      'onSurface': onSurface,
      'onBackground': onBackground,
      'onCard': onCard,
      'onSuccess': onSuccess,
      'onWarning': onWarning,
      'onDanger': onDanger,
      'onAccent': onAccent,
    };
    for (final MapEntry<String, SemanticColorPair> entry in _custom.entries) {
      map['on${entry.key[0].toUpperCase()}${entry.key.substring(1)}'] =
          entry.value.onSurface;
    }
    return map;
  }
}

/// Immutable Semantic Color Tokens specification enforcing paired contrast.
final class AxiomaColorTokens {
  final SemanticColorPair primary;
  final SemanticColorPair muted;
  final SemanticColorPair surfacePair;
  final SemanticColorPair card;
  final SemanticColorPair success;
  final SemanticColorPair warning;
  final SemanticColorPair danger;
  final SemanticColorPair accent;
  final Map<String, SemanticColorPair> customPairs;

  /// Structured accessor for all surface / background tokens.
  final SurfaceTokens surface;

  /// Structured accessor for all text / on-surface tokens.
  final TextTokens text;

  AxiomaColorTokens({
    required this.primary,
    required this.muted,
    required this.surfacePair,
    required this.card,
    required this.success,
    required this.warning,
    required this.danger,
    required this.accent,
    Map<String, SemanticColorPair> customPairs =
        const <String, SemanticColorPair>{},
  }) : customPairs = Map<String, SemanticColorPair>.unmodifiable(customPairs),
       surface = SurfaceTokens(
         primary: primary,
         muted: muted,
         surface: surfacePair,
         card: card,
         success: success,
         warning: warning,
         danger: danger,
         accent: accent,
         custom: customPairs,
       ),
       text = TextTokens(
         primary: primary,
         muted: muted,
         surface: surfacePair,
         card: card,
         success: success,
         warning: warning,
         danger: danger,
         accent: accent,
         custom: customPairs,
       );

  /// Canonical Dark Theme Tokens conforming strictly to WCAG 2.1 AA.
  static final AxiomaColorTokens canonicalDark = AxiomaColorTokens(
    primary: SemanticColorPair(
      name: 'primary',
      surface: '#38bdf8', // Sky 400
      onSurface: '#0f172a', // Navy 900 (ratio 8.23:1)
    ),
    muted: SemanticColorPair(
      name: 'muted',
      surface: '#1e293b', // Slate 800
      onSurface: '#94a3b8', // Slate 400 (ratio 5.59:1)
    ),
    surfacePair: SemanticColorPair(
      name: 'surface',
      surface: '#070a13', // Deep Dark
      onSurface: '#f8fafc', // Slate 50 (ratio 18.9:1)
    ),
    card: SemanticColorPair(
      name: 'card',
      surface: '#0f172a', // Slate 900
      onSurface: '#f8fafc', // Slate 50 (ratio 16.0:1)
    ),
    success: SemanticColorPair(
      name: 'success',
      surface: '#10b981', // Emerald 500
      onSurface: '#022c22', // Emerald 950 (ratio 6.52:1)
    ),
    warning: SemanticColorPair(
      name: 'warning',
      surface: '#f59e0b', // Amber 500
      onSurface: '#451a03', // Amber 950 (ratio 7.09:1)
    ),
    danger: SemanticColorPair(
      name: 'danger',
      surface: '#991b1b', // Red 800
      onSurface: '#fef2f2', // Red 50 (ratio 9.17:1)
    ),
    accent: SemanticColorPair(
      name: 'accent',
      surface: '#581c87', // Purple 900
      onSurface: '#faf5ff', // Purple 50 (ratio 10.8:1)
    ),
  );

  /// Canonical Light Theme Tokens conforming strictly to WCAG 2.1 AA.
  static final AxiomaColorTokens canonicalLight = AxiomaColorTokens(
    primary: SemanticColorPair(
      name: 'primary',
      surface: '#0369a1', // Sky 700
      onSurface: '#ffffff', // White (ratio 5.95:1)
    ),
    muted: SemanticColorPair(
      name: 'muted',
      surface: '#f1f5f9', // Slate 100
      onSurface: '#334155', // Slate 700 (ratio 8.52:1)
    ),
    surfacePair: SemanticColorPair(
      name: 'surface',
      surface: '#ffffff', // Pure White
      onSurface: '#0f172a', // Navy 900 (ratio 18.2:1)
    ),
    card: SemanticColorPair(
      name: 'card',
      surface: '#f8fafc', // Slate 50
      onSurface: '#0f172a', // Navy 900 (ratio 17.4:1)
    ),
    success: SemanticColorPair(
      name: 'success',
      surface: '#15803d', // Green 700
      onSurface: '#ffffff', // White (ratio 4.71:1)
    ),
    warning: SemanticColorPair(
      name: 'warning',
      surface: '#fef3c7', // Amber 100
      onSurface: '#78350f', // Amber 900 (ratio 8.84:1)
    ),
    danger: SemanticColorPair(
      name: 'danger',
      surface: '#b91c1c', // Red 700
      onSurface: '#ffffff', // White (ratio 5.91:1)
    ),
    accent: SemanticColorPair(
      name: 'accent',
      surface: '#7e22ce', // Purple 700
      onSurface: '#ffffff', // White (ratio 6.72:1)
    ),
  );

  /// Registers a new immutable semantic color pair.
  ///
  /// Sad Path: Throws [ContrastDeficitException] if the contrast ratio between
  /// [surfaceHex] and [onSurfaceHex] is less than 4.5:1 (or 3.0:1 if [isLargeTextOnly] is true).
  AxiomaColorTokens register(
    String name,
    String surfaceHex,
    String onSurfaceHex, {
    bool isLargeTextOnly = false,
  }) {
    final SemanticColorPair newPair = SemanticColorPair(
      name: name,
      surface: surfaceHex,
      onSurface: onSurfaceHex,
      isLargeTextOnly: isLargeTextOnly,
      validate: true,
    );

    final Map<String, SemanticColorPair> updated =
        Map<String, SemanticColorPair>.from(customPairs);
    updated[name] = newPair;

    return AxiomaColorTokens(
      primary: name == 'primary' ? newPair : primary,
      muted: name == 'muted' ? newPair : muted,
      surfacePair: (name == 'surface' || name == 'background')
          ? newPair
          : surfacePair,
      card: name == 'card' ? newPair : card,
      success: name == 'success' ? newPair : success,
      warning: name == 'warning' ? newPair : warning,
      danger: name == 'danger' ? newPair : danger,
      accent: name == 'accent' ? newPair : accent,
      customPairs: updated,
    );
  }

  /// Static helper to construct and validate a standalone [SemanticColorPair].
  ///
  /// Sad Path: Throws [ContrastDeficitException] if contrast ratio < 4.5:1 (or < 3.0:1 if large text).
  static SemanticColorPair registerPair(
    String name,
    String surfaceHex,
    String onSurfaceHex, {
    bool isLargeTextOnly = false,
  }) {
    return SemanticColorPair(
      name: name,
      surface: surfaceHex,
      onSurface: onSurfaceHex,
      isLargeTextOnly: isLargeTextOnly,
      validate: true,
    );
  }

  /// Resolves an arbitrary or custom pair by hex color values, enforcing WCAG 2.1 AA.
  ///
  /// Sad Path: Throws [ContrastDeficitException] if contrast ratio is inferior to 4.5:1 (or 3.0:1).
  static SemanticColorPair resolvePair(
    String surfaceHex,
    String onSurfaceHex, {
    String name = 'resolved_pair',
    bool isLargeTextOnly = false,
  }) {
    return SemanticColorPair(
      name: name,
      surface: surfaceHex,
      onSurface: onSurfaceHex,
      isLargeTextOnly: isLargeTextOnly,
      validate: true,
    );
  }

  /// Resolves a pair given token paths (e.g. 'surface.primary' and 'text.onPrimary')
  /// or raw hex colors, validating the contrast ratio.
  ///
  /// Sad Path: Throws [ContrastDeficitException] if the resolved colors have contrast < 4.5:1.
  SemanticColorPair resolve(
    String surfaceTokenOrHex,
    String textTokenOrHex, {
    String? pairName,
    bool isLargeTextOnly = false,
  }) {
    final String surfaceColor = _resolveColor(
      surfaceTokenOrHex,
      isSurface: true,
    );
    final String textColor = _resolveColor(textTokenOrHex, isSurface: false);

    return SemanticColorPair(
      name: pairName ?? '$surfaceTokenOrHex<->$textTokenOrHex',
      surface: surfaceColor,
      onSurface: textColor,
      isLargeTextOnly: isLargeTextOnly,
      validate: true,
    );
  }

  /// Resolves a registered pair by its canonical name.
  ///
  /// Throws [ArgumentError] if the pair is not found.
  SemanticColorPair resolveByName(String name) {
    final SemanticColorPair? pair = getPair(name);
    if (pair == null) {
      throw ArgumentError('Token pair with name "$name" not found.');
    }
    // Re-validate against WCAG 2.1 AA
    final double minRequired = pair.isLargeTextOnly
        ? ContrastCalculator.minLargeTextRatio
        : ContrastCalculator.minNormalTextRatio;
    if (pair.contrastRatio < minRequired) {
      throw ContrastDeficitException(
        contrastRatio: pair.contrastRatio,
        requiredRatio: minRequired,
        backgroundHex: pair.surface,
        foregroundHex: pair.onSurface,
        tokenName: pair.name,
      );
    }
    return pair;
  }

  /// Retrieves a pair by name, or returns null if not registered.
  SemanticColorPair? getPair(String name) {
    switch (name) {
      case 'primary':
        return primary;
      case 'muted':
        return muted;
      case 'surface':
      case 'background':
        return surfacePair;
      case 'card':
        return card;
      case 'success':
        return success;
      case 'warning':
        return warning;
      case 'danger':
        return danger;
      case 'accent':
        return accent;
      default:
        return customPairs[name];
    }
  }

  /// Returns a list of all active pairs.
  List<SemanticColorPair> get allPairs => <SemanticColorPair>[
    primary,
    muted,
    surfacePair,
    card,
    success,
    warning,
    danger,
    accent,
    ...customPairs.values,
  ];

  String _resolveColor(String tokenOrHex, {required bool isSurface}) {
    final String trimmed = tokenOrHex.trim();
    if (trimmed.startsWith('#') ||
        (trimmed.length == 6 && int.tryParse(trimmed, radix: 16) != null) ||
        (trimmed.length == 3 && int.tryParse(trimmed, radix: 16) != null)) {
      return ContrastCalculator.normalizeHex(trimmed);
    }

    // Resolve semantic path e.g. "surface.primary", "text.onPrimary"
    if (trimmed.startsWith('surface.')) {
      final String key = trimmed.substring('surface.'.length);
      final String? color = surface[key];
      if (color != null) return color;
    } else if (trimmed.startsWith('text.')) {
      final String key = trimmed.substring('text.'.length);
      final String? color = text[key];
      if (color != null) return color;
    }

    // Direct key lookup
    final String? directColor = isSurface ? surface[trimmed] : text[trimmed];
    if (directColor != null) return directColor;

    throw ArgumentError(
      'Unable to resolve ${isSurface ? "surface" : "text"} color token for "$tokenOrHex".',
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'primary': primary.toJson(),
    'muted': muted.toJson(),
    'surface': surfacePair.toJson(),
    'card': card.toJson(),
    'success': success.toJson(),
    'warning': warning.toJson(),
    'danger': danger.toJson(),
    'accent': accent.toJson(),
    'custom_pairs': customPairs.map(
      (String k, SemanticColorPair v) =>
          MapEntry<String, dynamic>(k, v.toJson()),
    ),
  };

  factory AxiomaColorTokens.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? custom =
        json['custom_pairs'] as Map<String, dynamic>?;
    final Map<String, SemanticColorPair> customMap =
        <String, SemanticColorPair>{};
    if (custom != null) {
      for (final MapEntry<String, dynamic> entry in custom.entries) {
        customMap[entry.key] = SemanticColorPair.fromJson(
          entry.value as Map<String, dynamic>,
        );
      }
    }

    return AxiomaColorTokens(
      primary: SemanticColorPair.fromJson(
        json['primary'] as Map<String, dynamic>,
      ),
      muted: SemanticColorPair.fromJson(json['muted'] as Map<String, dynamic>),
      surfacePair: SemanticColorPair.fromJson(
        (json['surface'] ?? json['surface_pair']) as Map<String, dynamic>,
      ),
      card: SemanticColorPair.fromJson(json['card'] as Map<String, dynamic>),
      success: SemanticColorPair.fromJson(
        json['success'] as Map<String, dynamic>,
      ),
      warning: SemanticColorPair.fromJson(
        json['warning'] as Map<String, dynamic>,
      ),
      danger: SemanticColorPair.fromJson(
        json['danger'] as Map<String, dynamic>,
      ),
      accent: SemanticColorPair.fromJson(
        json['accent'] as Map<String, dynamic>,
      ),
      customPairs: customMap,
    );
  }
}
