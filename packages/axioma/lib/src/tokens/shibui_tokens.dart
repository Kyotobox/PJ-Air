/// CONEXT Fleet Design System — Shibui Tokens Standard (渋い)
///
/// Implementación de modelos tipados e inmutables para el sistema de diseño
/// sobrio Shibui. Adhiere estrictamente a Pure Dart Core (§39).
library;

import 'dart:io';

/// Excepción formal lanzada ante incumplimientos de tokens Shibui.
class ShibuiTokenValidationException implements Exception {
  final String message;
  final String? ruleViolated;

  const ShibuiTokenValidationException(this.message, [this.ruleViolated]);

  @override
  String toString() =>
      'ShibuiTokenValidationException: $message'
      '${ruleViolated != null ? ' (Regla: $ruleViolated)' : ''}';
}

/// Paleta cromática inmutable de una variante Shibui (Sumi o Washi).
class ShibuiPalette {
  final String name;
  final String bg;
  final String surface;
  final String surfaceSubtle;
  final String border;
  final String borderActive;
  final String textPrimary;
  final String textSecondary;
  final String textTertiary;
  final String accentBlue;
  final String accentGreen;
  final String accentAmber;
  final String accentRed;

  const ShibuiPalette({
    required this.name,
    required this.bg,
    required this.surface,
    required this.surfaceSubtle,
    required this.border,
    required this.borderActive,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.accentBlue,
    required this.accentGreen,
    required this.accentAmber,
    required this.accentRed,
  });

  /// Paleta canónica Sumi (Tinta carbón mate, modo oscuro calm).
  static const ShibuiPalette sumi = ShibuiPalette(
    name: 'Sumi',
    bg: '#0d1117',
    surface: '#161b22',
    surfaceSubtle: '#21262d',
    border: '#30363d',
    borderActive: '#8b949e',
    textPrimary: '#f0f6fc',
    textSecondary: '#8b949e',
    textTertiary: '#6e7681',
    accentBlue: '#58a6ff',
    accentGreen: '#3fb950',
    accentAmber: '#d29922',
    accentRed: '#f85149',
  );

  /// Paleta canónica Washi (Papel artesanal apergaminado, modo claro calm).
  static const ShibuiPalette washi = ShibuiPalette(
    name: 'Washi',
    bg: '#f6f8fa',
    surface: '#ffffff',
    surfaceSubtle: '#eaeef2',
    border: '#d0d7de',
    borderActive: '#57606a',
    textPrimary: '#1f2328',
    textSecondary: '#656d76',
    textTertiary: '#8c959f',
    accentBlue: '#0969da',
    accentGreen: '#1a7f37',
    accentAmber: '#9a6700',
    accentRed: '#cf222e',
  );
}

/// Escala de espaciado negativo intencional Ma (間).
class ShibuiSpacingMa {
  final String ma1;
  final String ma2;
  final String ma3;
  final String ma4;
  final String ma5;
  final String ma6;
  final String ma8;

  const ShibuiSpacingMa({
    required this.ma1,
    required this.ma2,
    required this.ma3,
    required this.ma4,
    required this.ma5,
    required this.ma6,
    required this.ma8,
  });

  static const ShibuiSpacingMa canonical = ShibuiSpacingMa(
    ma1: '4px',
    ma2: '8px',
    ma3: '12px',
    ma4: '16px',
    ma5: '24px',
    ma6: '32px',
    ma8: '48px',
  );
}

/// Geometría neta y bordes 1px Shibui.
class ShibuiGeometry {
  final String borderWidthNet;
  final String radiusNone;
  final String radiusSm;
  final String radiusMd;

  const ShibuiGeometry({
    required this.borderWidthNet,
    required this.radiusNone,
    required this.radiusSm,
    required this.radiusMd,
  });

  static const ShibuiGeometry canonical = ShibuiGeometry(
    borderWidthNet: '1px',
    radiusNone: '0px',
    radiusSm: '3px',
    radiusMd: '6px',
  );
}

/// Validador estricto y auditor de conformidad Shibui (§39, §40).
class ShibuiTokenValidator {
  static const List<String> requiredSumiTokens = <String>[
    '--shibui-bg',
    '--shibui-surface',
    '--shibui-surface-subtle',
    '--shibui-border',
    '--shibui-border-active',
    '--shibui-text-primary',
    '--shibui-text-secondary',
    '--shibui-accent-blue',
    '--shibui-accent-green',
    '--shibui-accent-amber',
    '--shibui-accent-red',
  ];

  static const List<String> requiredWashiTokens = <String>[
    '--shibui-bg',
    '--shibui-surface',
    '--shibui-border',
    '--shibui-text-primary',
    '--shibui-text-secondary',
  ];

  static const List<String> requiredMaTokens = <String>[
    '--ma-1',
    '--ma-2',
    '--ma-3',
    '--ma-4',
    '--ma-5',
    '--ma-6',
    '--ma-8',
  ];

  static const List<String> forbiddenNeonKeywords = <String>[
    'cyber-neon',
    'neon-glow',
    'text-shadow: 0 0',
    'box-shadow: 0 0 15px',
    'box-shadow: 0 0 20px',
    '#00ff',
    '#ff007f',
  ];

  /// Valida el contenido de una especificación CSS de tokens Shibui.
  static void validateCssContent(String cssContent) {
    if (cssContent.trim().isEmpty) {
      throw const ShibuiTokenValidationException(
        'El archivo CSS de tokens Shibui está vacío',
        'EMPTY_SPECIFICATION',
      );
    }

    // 1. Selector de Sumi
    if (!cssContent.contains('[data-theme="sumi"]') &&
        !cssContent.contains(':root')) {
      throw const ShibuiTokenValidationException(
        'Falta el selector de tema [data-theme="sumi"] o :root',
        'MISSING_SUMI_SELECTOR',
      );
    }

    // 2. Selector de Washi
    if (!cssContent.contains('[data-theme="washi"]')) {
      throw const ShibuiTokenValidationException(
        'Falta el selector de tema [data-theme="washi"]',
        'MISSING_WASHI_SELECTOR',
      );
    }

    // 3. Tokens requeridos en Sumi
    for (final String token in requiredSumiTokens) {
      if (!cssContent.contains(token)) {
        throw ShibuiTokenValidationException(
          'Token obligatorio faltante en CSS Shibui: $token',
          'MISSING_TOKEN',
        );
      }
    }

    // 4. Escala de espacio Ma
    for (final String maToken in requiredMaTokens) {
      if (!cssContent.contains(maToken)) {
        throw ShibuiTokenValidationException(
          'Token de espaciado Ma obligatorio faltante: $maToken',
          'MISSING_MA_SPACING',
        );
      }
    }

    // 5. Erradicación estricta de Cyber Neón
    for (final String forbidden in forbiddenNeonKeywords) {
      if (cssContent.toLowerCase().contains(forbidden.toLowerCase())) {
        throw ShibuiTokenValidationException(
          'Se detectó token o estilo proscrito por la doctrina Shibui: $forbidden',
          'PROHIBITED_NEON_STYLE',
        );
      }
    }
  }

  /// Valida físicamente un archivo CSS en el sistema de archivos.
  static void validateCssFile(String filePath) {
    final File file = File(filePath);
    if (!file.existsSync()) {
      throw ShibuiTokenValidationException(
        'El archivo CSS no existe en la ruta física: $filePath',
        'FILE_NOT_FOUND',
      );
    }
    final String content = file.readAsStringSync();
    validateCssContent(content);
  }
}
