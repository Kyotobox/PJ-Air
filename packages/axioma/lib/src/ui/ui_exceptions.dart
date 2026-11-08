/// Axioma UI Exceptions & Defensive Contracts (§39 Pure Dart Core)
///
/// Defines exceptions thrown when UI contracts, semantic tokens, or WCAG
/// accessibility requirements are violated.
library;

/// Base exception for all UI domain contract violations in Axioma.
abstract class AxiomaUiException implements Exception {
  final String message;

  const AxiomaUiException(this.message);

  @override
  String toString() => '$runtimeType: $message';
}

/// Thrown when a pair of color tokens fails to meet the minimum WCAG 2.1 AA
/// contrast ratio requirement (4.5:1 for normal text, 3.0:1 for large text).
class ContrastDeficitException extends AxiomaUiException {
  /// The mathematically computed contrast ratio (e.g. 2.14).
  final double contrastRatio;

  /// The minimum contrast ratio required by WCAG 2.1 AA (4.5 or 3.0).
  final double requiredRatio;

  /// The surface / background color in normalized hex format.
  final String backgroundHex;

  /// The text / foreground color in normalized hex format.
  final String foregroundHex;

  /// The semantic token identifier or pair name where the deficit occurred.
  final String? tokenName;

  ContrastDeficitException({
    required this.contrastRatio,
    required this.requiredRatio,
    required this.backgroundHex,
    required this.foregroundHex,
    this.tokenName,
    String? message,
  }) : super(
         message ??
             'WCAG 2.1 AA Contrast Deficit${tokenName != null ? ' in token "$tokenName"' : ''}: '
                 'ratio ${contrastRatio.toStringAsFixed(2)}:1 is below the required threshold '
                 '${requiredRatio.toStringAsFixed(2)}:1 between background "$backgroundHex" '
                 'and foreground "$foregroundHex".',
       );
}
