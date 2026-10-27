/// Barrel and unified tokens provider for CONEXT Fleet
///
/// Adheres to Pure Dart Core (§39).
library;

import 'design_tokens.dart';

export 'design_tokens.dart';

/// Fachada estática de acceso directo a los tokens canónicos de la flota.
abstract final class FleetTokens {
  static const DesignTokens current = DesignTokens.canonical;

  static const FleetColors colors = FleetColors.canonical;
  static const FleetTypography typography = FleetTypography.canonical;
  static const FleetRadii radii = FleetRadii.canonical;
  static const FleetShadows shadows = FleetShadows.canonical;
  static const FleetTransitions transitions = FleetTransitions.canonical;
}
