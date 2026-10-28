import 'dart:convert';
import 'dart:io';
import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

void main() {
  group('Fleet Design Tokens (TASK-G202-01)', () {
    test('Happy Path: Canonical tokens match design_tokens.json file', () {
      File contractFile = File('vault/contracts/design_tokens.json');
      if (!contractFile.existsSync()) {
        contractFile = File('../../vault/contracts/design_tokens.json');
      }
      expect(contractFile.existsSync(), isTrue);

      final Map<String, dynamic> json =
          jsonDecode(contractFile.readAsStringSync()) as Map<String, dynamic>;

      final DesignTokens parsed = DesignTokens.fromJson(json);

      expect(parsed.version, equals('1.0.0'));
      expect(parsed.name, equals('CONEXT Fleet Design Tokens Standard'));
      expect(parsed.colors.bgDark, equals('#070a13'));
      expect(parsed.colors.cardBg, equals('#0f172a'));
      expect(parsed.colors.primary, equals('#38bdf8'));
      expect(parsed.colors.success, equals('#10b981'));
      expect(parsed.colors.warning, equals('#f59e0b'));
      expect(parsed.colors.danger, equals('#ef4444'));
      expect(parsed.colors.purple, equals('#a855f7'));
      expect(parsed.radii.radiusSm, equals('4px'));
      expect(parsed.radii.radiusFull, equals('9999px'));
      expect(parsed.typography.fontSizeBase, equals('16px'));
      expect(parsed.transitions.transitionFast, equals('all 0.15s ease'));

      // Validate equality with static canonical instance
      expect(FleetTokens.colors.bgDark, equals(parsed.colors.bgDark));
      expect(FleetTokens.colors.primary, equals(parsed.colors.primary));
      expect(FleetTokens.radii.radiusMd, equals(parsed.radii.radiusMd));
    });

    test('Happy Path: Serialization toJson round-trip', () {
      final DesignTokens canonical = FleetTokens.current;
      final Map<String, dynamic> json = canonical.toJson();
      final DesignTokens roundTrip = DesignTokens.fromJson(json);

      expect(roundTrip.version, equals(canonical.version));
      expect(roundTrip.colors.primary, equals(canonical.colors.primary));
      expect(roundTrip.shadows.shadowLg, equals(canonical.shadows.shadowLg));
    });

    test('Sad Path: Throws FormatException on missing required color', () {
      final Map<String, dynamic> invalidColors = <String, dynamic>{
        'bg_dark': '#070a13',
        // 'card_bg' missing
        'text_main': '#f8fafc',
        'text_muted': '#94a3b8',
        'primary': '#38bdf8',
        'success': '#10b981',
        'warning': '#f59e0b',
        'danger': '#ef4444',
        'purple': '#a855f7',
      };

      expect(
        () => FleetColors.fromJson(invalidColors),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path: Throws FormatException on invalid hex color format', () {
      final Map<String, dynamic> invalidColors = <String, dynamic>{
        'bg_dark': 'not-a-hex-color',
        'card_bg': '#0f172a',
        'text_main': '#f8fafc',
        'text_muted': '#94a3b8',
        'primary': '#38bdf8',
        'success': '#10b981',
        'warning': '#f59e0b',
        'danger': '#ef4444',
        'purple': '#a855f7',
      };

      expect(
        () => FleetColors.fromJson(invalidColors),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path: Throws FormatException on missing root object', () {
      expect(
        () => DesignTokens.fromJson(<String, dynamic>{
          'version': '1.0.0',
          'name': 'Test',
          // colors missing
        }),
        throwsA(isA<FormatException>()),
      );
    });
  });
}
