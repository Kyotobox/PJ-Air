/// Barrel and unified tokens provider for CONEXT Fleet
///
/// Adheres to Pure Dart Core (§39).
library;

import 'design_tokens.dart';
import 'shibui_tokens.dart';

export 'design_tokens.dart';
export 'shibui_tokens.dart';

/// Fachada estática de acceso directo a los tokens canónicos de la flota.
abstract final class FleetTokens {
  static const DesignTokens current = DesignTokens.canonical;

  static const FleetColors colors = FleetColors.canonical;
  static const FleetTypography typography = FleetTypography.canonical;
  static const FleetRadii radii = FleetRadii.canonical;
  static const FleetShadows shadows = FleetShadows.canonical;
  static const FleetTransitions transitions = FleetTransitions.canonical;

  // Shibui Design Tokens (Fase 5.0)
  static const ShibuiPalette sumi = ShibuiPalette.sumi;
  static const ShibuiPalette washi = ShibuiPalette.washi;
  static const ShibuiSpacingMa ma = ShibuiSpacingMa.canonical;
  static const ShibuiGeometry geometry = ShibuiGeometry.canonical;
}
