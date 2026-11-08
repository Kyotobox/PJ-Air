/// WCAG 2.1 AA Relative Luminance & Contrast Calculator (§39 Pure Dart Core)
///
/// Implements the mathematical formulas defined in the W3C Web Content
/// Accessibility Guidelines (WCAG) 2.1 for relative luminance and contrast ratio.
///
/// References:
/// - https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
/// - https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
library;

import 'dart:math' as math;
import 'ui_exceptions.dart';

/// Evaluates and calculates WCAG 2.1 contrast ratios and relative luminance.
abstract final class ContrastCalculator {
  /// Minimum contrast ratio for normal text under WCAG 2.1 Level AA (4.5:1).
  static const double minNormalTextRatio = 4.5;

  /// Minimum contrast ratio for large text (>=18pt or 14pt bold) under WCAG 2.1 Level AA (3.0:1).
  static const double minLargeTextRatio = 3.0;

  /// Minimum contrast ratio for UI components and graphical objects under WCAG 2.1 Level AA (3.0:1).
  static const double minUiComponentRatio = 3.0;

  /// Minimum contrast ratio for normal text under WCAG 2.1 Level AAA (7.0:1).
  static const double minAaaNormalTextRatio = 7.0;

  /// Minimum contrast ratio for large text under WCAG 2.1 Level AAA (4.5:1).
  static const double minAaaLargeTextRatio = 4.5;

  /// Normalizes a hex color string to canonical lowercase `#rrggbb` format.
  ///
  /// Supports:
  /// - `#rgb` or `rgb` (expanded to `#rrggbb`)
  /// - `#rrggbb` or `rrggbb`
  /// - `#rrggbbaa` or `rrggbbaa` (alpha channel ignored for RGB luminance)
  static String normalizeHex(String hex) {
    final (int r, int g, int b) = parseHexRgb(hex);
    final String rStr = r.toRadixString(16).padLeft(2, '0');
    final String gStr = g.toRadixString(16).padLeft(2, '0');
    final String bStr = b.toRadixString(16).padLeft(2, '0');
    return '#$rStr$gStr$bStr';
  }

  /// Parses a hex color string into 8-bit integer RGB components (0-255).
  static (int, int, int) parseHexRgb(String hex) {
    String clean = hex.trim();
    if (clean.startsWith('#')) {
      clean = clean.substring(1);
    }

    if (clean.length == 3) {
      final int? r = int.tryParse('${clean[0]}${clean[0]}', radix: 16);
      final int? g = int.tryParse('${clean[1]}${clean[1]}', radix: 16);
      final int? b = int.tryParse('${clean[2]}${clean[2]}', radix: 16);
      if (r != null && g != null && b != null) {
        return (r, g, b);
      }
    } else if (clean.length == 6 || clean.length == 8) {
      final int? r = int.tryParse(clean.substring(0, 2), radix: 16);
      final int? g = int.tryParse(clean.substring(2, 4), radix: 16);
      final int? b = int.tryParse(clean.substring(4, 6), radix: 16);
      if (r != null && g != null && b != null) {
        return (r, g, b);
      }
    }

    throw FormatException(
      'Invalid hex color format: "$hex". Expected format: #RGB, #RRGGBB, or #RRGGBBAA.',
    );
  }

  /// Converts an 8-bit sRGB channel (0..255) to linear light value (0.0..1.0).
  ///
  /// Formula:
  /// If C_sRGB <= 0.04045 then C_linear = C_sRGB / 12.92
  /// else C_linear = ((C_sRGB + 0.055) / 1.055) ^ 2.4
  static double _channelToLinear(int channel8Bit) {
    final double c = channel8Bit / 255.0;
    if (c <= 0.04045) {
      return c / 12.92;
    } else {
      return math.pow((c + 0.055) / 1.055, 2.4).toDouble();
    }
  }

  /// Computes the WCAG 2.1 relative luminance [0.0..1.0] from 8-bit RGB components.
  ///
  /// L = 0.2126 * R_linear + 0.7152 * G_linear + 0.0722 * B_linear
  static double relativeLuminanceFromRgb(int r, int g, int b) {
    final double rLin = _channelToLinear(r);
    final double gLin = _channelToLinear(g);
    final double bLin = _channelToLinear(b);
    return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
  }

  /// Computes the WCAG 2.1 relative luminance [0.0..1.0] of a hex color string.
  static double relativeLuminance(String hexColor) {
    final (int r, int g, int b) = parseHexRgb(hexColor);
    return relativeLuminanceFromRgb(r, g, b);
  }

  /// Computes the WCAG 2.1 contrast ratio [1.0..21.0] between two colors.
  ///
  /// Formula:
  /// (L1 + 0.05) / (L2 + 0.05), where L1 is the lighter of the two colors
  /// and L2 is the darker of the two colors.
  static double contrastRatio(String color1Hex, String color2Hex) {
    final double lum1 = relativeLuminance(color1Hex);
    final double lum2 = relativeLuminance(color2Hex);

    final double lighter = math.max(lum1, lum2);
    final double darker = math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /// Returns true if the pair passes WCAG 2.1 Level AA threshold.
  ///
  /// [isLargeText] indicates whether the text is >=18pt or 14pt bold (threshold 3.0:1 instead of 4.5:1).
  static bool passesWcagAA(
    String backgroundHex,
    String foregroundHex, {
    bool isLargeText = false,
  }) {
    final double ratio = contrastRatio(backgroundHex, foregroundHex);
    final double threshold = isLargeText
        ? minLargeTextRatio
        : minNormalTextRatio;
    return ratio >= threshold;
  }

  /// Returns true if the pair passes WCAG 2.1 Level AAA threshold.
  static bool passesWcagAAA(
    String backgroundHex,
    String foregroundHex, {
    bool isLargeText = false,
  }) {
    final double ratio = contrastRatio(backgroundHex, foregroundHex);
    final double threshold = isLargeText
        ? minAaaLargeTextRatio
        : minAaaNormalTextRatio;
    return ratio >= threshold;
  }

  /// Validates contrast ratio against WCAG 2.1 AA requirements.
  ///
  /// Throws [ContrastDeficitException] if the computed ratio is below the required threshold.
  static double validateContrast(
    String backgroundHex,
    String foregroundHex, {
    bool isLargeText = false,
    String? tokenName,
  }) {
    final double ratio = contrastRatio(backgroundHex, foregroundHex);
    final double required = isLargeText
        ? minLargeTextRatio
        : minNormalTextRatio;

    if (ratio < required) {
      throw ContrastDeficitException(
        contrastRatio: ratio,
        requiredRatio: required,
        backgroundHex: normalizeHex(backgroundHex),
        foregroundHex: normalizeHex(foregroundHex),
        tokenName: tokenName,
      );
    }

    return ratio;
  }
}
