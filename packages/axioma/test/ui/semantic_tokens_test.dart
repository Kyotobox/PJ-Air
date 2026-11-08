import 'package:axioma/src/ui/contrast_calculator.dart';
import 'package:axioma/src/ui/semantic_tokens.dart';
import 'package:axioma/src/ui/ui_exceptions.dart';
import 'package:test/test.dart';

void main() {
  group('ContrastCalculator - WCAG 2.1 AA Math Engine', () {
    test('computes relative luminance of black and white accurately', () {
      final double blackLum = ContrastCalculator.relativeLuminance('#000000');
      final double whiteLum = ContrastCalculator.relativeLuminance('#ffffff');

      expect(blackLum, equals(0.0));
      expect(whiteLum, equals(1.0));
    });

    test(
      'computes exact 21:1 contrast ratio between pure black and pure white',
      () {
        final double ratio = ContrastCalculator.contrastRatio(
          '#000000',
          '#ffffff',
        );
        expect(ratio, closeTo(21.0, 0.01));

        // Commutative property: order of arguments does not affect the ratio
        final double reversed = ContrastCalculator.contrastRatio(
          '#ffffff',
          '#000000',
        );
        expect(reversed, equals(ratio));
      },
    );

    test('computes 1:1 contrast ratio for identical colors', () {
      final double ratio = ContrastCalculator.contrastRatio(
        '#4a5568',
        '#4a5568',
      );
      expect(ratio, closeTo(1.0, 0.001));
    });

    test('normalizes 3-digit, 6-digit, and 8-digit hex strings', () {
      expect(ContrastCalculator.normalizeHex('#fff'), equals('#ffffff'));
      expect(ContrastCalculator.normalizeHex('fff'), equals('#ffffff'));
      expect(ContrastCalculator.normalizeHex('#0F172A'), equals('#0f172a'));
      expect(ContrastCalculator.normalizeHex('#0f172aff'), equals('#0f172a'));
    });

    test('validates passesWcagAA and passesWcagAAA predicates', () {
      // #000000 on #ffffff is 21:1 -> passes both AA and AAA
      expect(ContrastCalculator.passesWcagAA('#000000', '#ffffff'), isTrue);
      expect(ContrastCalculator.passesWcagAAA('#000000', '#ffffff'), isTrue);

      // Low contrast (gray on dark gray)
      expect(ContrastCalculator.passesWcagAA('#808080', '#707070'), isFalse);
      expect(ContrastCalculator.passesWcagAAA('#808080', '#707070'), isFalse);
    });

    test(
      'Sad Path: validateContrast throws ContrastDeficitException for gray on gray',
      () {
        expect(
          () => ContrastCalculator.validateContrast(
            '#808080',
            '#707070',
            tokenName: 'test_deficit',
          ),
          throwsA(
            isA<ContrastDeficitException>()
                .having(
                  (ContrastDeficitException e) => e.contrastRatio,
                  'contrastRatio',
                  lessThan(4.5),
                )
                .having(
                  (ContrastDeficitException e) => e.requiredRatio,
                  'requiredRatio',
                  equals(4.5),
                )
                .having(
                  (ContrastDeficitException e) => e.backgroundHex,
                  'backgroundHex',
                  equals('#808080'),
                )
                .having(
                  (ContrastDeficitException e) => e.foregroundHex,
                  'foregroundHex',
                  equals('#707070'),
                )
                .having(
                  (ContrastDeficitException e) => e.tokenName,
                  'tokenName',
                  equals('test_deficit'),
                ),
          ),
        );
      },
    );

    test(
      'Sad Path: parseHexRgb throws FormatException on invalid hex string',
      () {
        expect(
          () => ContrastCalculator.parseHexRgb('invalid-hex'),
          throwsA(isA<FormatException>()),
        );
        expect(
          () => ContrastCalculator.parseHexRgb('#12'),
          throwsA(isA<FormatException>()),
        );
      },
    );
  });

  group('SemanticColorPair Contract & WCAG Enforcement', () {
    test('creates valid paired token when contrast >= 4.5:1', () {
      final SemanticColorPair pair = SemanticColorPair(
        name: 'test_primary',
        surface: '#0f172a',
        onSurface: '#f8fafc',
      );

      expect(pair.name, equals('test_primary'));
      expect(pair.surface, equals('#0f172a'));
      expect(pair.onSurface, equals('#f8fafc'));
      expect(pair.contrastRatio, greaterThanOrEqualTo(4.5));
      expect(pair.background, equals(pair.surface));
      expect(pair.text, equals(pair.onSurface));
    });

    test(
      'Sad Path: throws ContrastDeficitException on creation if ratio < 4.5:1',
      () {
        expect(
          () => SemanticColorPair(
            name: 'invalid_gray',
            surface: '#808080',
            onSurface: '#707070',
          ),
          throwsA(
            isA<ContrastDeficitException>()
                .having(
                  (ContrastDeficitException e) => e.contrastRatio,
                  'contrastRatio',
                  closeTo(1.25, 0.1),
                )
                .having(
                  (ContrastDeficitException e) => e.requiredRatio,
                  'requiredRatio',
                  equals(4.5),
                )
                .having(
                  (ContrastDeficitException e) => e.tokenName,
                  'tokenName',
                  equals('invalid_gray'),
                ),
          ),
        );
      },
    );

    test(
      'large text pair accepts 3.0:1 <= ratio < 4.5:1 when isLargeTextOnly is true',
      () {
        // #0284c7 (sky 600) on #ffffff (white) yields ratio ~4.10:1 (valid for large text, invalid for normal text)
        final double ratio = ContrastCalculator.contrastRatio(
          '#0284c7',
          '#ffffff',
        );
        expect(ratio, greaterThanOrEqualTo(3.0));
        expect(ratio, lessThan(4.5));

        // Should succeed with isLargeTextOnly: true
        final SemanticColorPair pair = SemanticColorPair(
          name: 'large_heading',
          surface: '#0284c7',
          onSurface: '#ffffff',
          isLargeTextOnly: true,
        );
        expect(pair.isLargeTextOnly, isTrue);
        expect(pair.contrastRatio, equals(ratio));

        // Sad Path: Normal text mode throws ContrastDeficitException for the same colors
        expect(
          () => SemanticColorPair(
            name: 'normal_text_fail',
            surface: '#0284c7',
            onSurface: '#ffffff',
            isLargeTextOnly: false,
          ),
          throwsA(isA<ContrastDeficitException>()),
        );
      },
    );

    test(
      'Sad Path: large text pair throws ContrastDeficitException if ratio < 3.0:1',
      () {
        expect(
          () => SemanticColorPair(
            name: 'large_text_deficit',
            surface: '#808080',
            onSurface: '#707070',
            isLargeTextOnly: true,
          ),
          throwsA(
            isA<ContrastDeficitException>().having(
              (ContrastDeficitException e) => e.requiredRatio,
              'requiredRatio',
              equals(3.0),
            ),
          ),
        );
      },
    );
  });

  group('AxiomaColorTokens - Canonical Themes & Accessors', () {
    test(
      'canonicalDark theme certifies all standard pairs meet WCAG 2.1 AA (>= 4.5:1)',
      () {
        final AxiomaColorTokens tokens = AxiomaColorTokens.canonicalDark;

        for (final SemanticColorPair pair in tokens.allPairs) {
          expect(
            pair.contrastRatio,
            greaterThanOrEqualTo(4.5),
            reason:
                'Token "${pair.name}" in canonicalDark must satisfy WCAG 2.1 AA (>= 4.5:1), '
                'got ${pair.contrastRatio}:1 (surface: ${pair.surface}, onSurface: ${pair.onSurface})',
          );
        }
      },
    );

    test(
      'canonicalLight theme certifies all standard pairs meet WCAG 2.1 AA (>= 4.5:1)',
      () {
        final AxiomaColorTokens tokens = AxiomaColorTokens.canonicalLight;

        for (final SemanticColorPair pair in tokens.allPairs) {
          expect(
            pair.contrastRatio,
            greaterThanOrEqualTo(4.5),
            reason:
                'Token "${pair.name}" in canonicalLight must satisfy WCAG 2.1 AA (>= 4.5:1), '
                'got ${pair.contrastRatio}:1 (surface: ${pair.surface}, onSurface: ${pair.onSurface})',
          );
        }
      },
    );

    test(
      'paired accessors strictly couple surface and text contrast colors',
      () {
        final AxiomaColorTokens tokens = AxiomaColorTokens.canonicalDark;

        // Primary pair coupling
        expect(tokens.surface.primary, equals(tokens.primary.surface));
        expect(tokens.text.onPrimary, equals(tokens.primary.onSurface));

        // Muted pair coupling
        expect(tokens.surface.muted, equals(tokens.muted.surface));
        expect(tokens.text.onMuted, equals(tokens.muted.onSurface));

        // Card pair coupling
        expect(tokens.surface.card, equals(tokens.card.surface));
        expect(tokens.text.onCard, equals(tokens.card.onSurface));

        // General surface pair coupling
        expect(tokens.surface.surface, equals(tokens.surfacePair.surface));
        expect(tokens.text.onSurface, equals(tokens.surfacePair.onSurface));
      },
    );

    test('toMap() on surface and text tokens yields complete dictionary', () {
      final AxiomaColorTokens tokens = AxiomaColorTokens.canonicalDark;
      final Map<String, String> surfaceMap = tokens.surface.toMap();
      final Map<String, String> textMap = tokens.text.toMap();

      expect(surfaceMap.containsKey('primary'), isTrue);
      expect(surfaceMap.containsKey('muted'), isTrue);
      expect(textMap.containsKey('onPrimary'), isTrue);
      expect(textMap.containsKey('onMuted'), isTrue);
    });
  });

  group('AxiomaColorTokens - Registration & Resolution (Sad & Happy Paths)', () {
    test('registers custom pair and maintains immutability', () {
      final AxiomaColorTokens original = AxiomaColorTokens.canonicalDark;
      final AxiomaColorTokens updated = original.register(
        'brand',
        '#1e1b4b',
        '#f5f3ff',
      );

      expect(original.customPairs.containsKey('brand'), isFalse);
      expect(updated.customPairs.containsKey('brand'), isTrue);
      expect(updated.surface['brand'], equals('#1e1b4b'));
      expect(updated.text['onBrand'], equals('#f5f3ff'));
      expect(
        updated.resolveByName('brand').contrastRatio,
        greaterThanOrEqualTo(4.5),
      );
    });

    test(
      'Sad Path: register() throws ContrastDeficitException when registering deficit pair',
      () {
        final AxiomaColorTokens tokens = AxiomaColorTokens.canonicalDark;

        expect(
          () => tokens.register('unreadable_gray', '#808080', '#707070'),
          throwsA(
            isA<ContrastDeficitException>()
                .having(
                  (ContrastDeficitException e) => e.tokenName,
                  'tokenName',
                  equals('unreadable_gray'),
                )
                .having(
                  (ContrastDeficitException e) => e.contrastRatio,
                  'contrastRatio',
                  lessThan(4.5),
                ),
          ),
        );
      },
    );

    test(
      'Sad Path: static registerPair() throws ContrastDeficitException on deficit',
      () {
        expect(
          () => AxiomaColorTokens.registerPair(
            'static_bad',
            '#606060',
            '#555555',
          ),
          throwsA(isA<ContrastDeficitException>()),
        );
      },
    );

    test(
      'Sad Path: static resolvePair() throws ContrastDeficitException on deficit',
      () {
        expect(
          () => AxiomaColorTokens.resolvePair('#808080', '#707070'),
          throwsA(isA<ContrastDeficitException>()),
        );
      },
    );

    test('resolve() resolves token paths with valid contrast', () {
      final AxiomaColorTokens tokens = AxiomaColorTokens.canonicalDark;
      final SemanticColorPair resolved = tokens.resolve(
        'surface.primary',
        'text.onPrimary',
      );

      expect(resolved.surface, equals(tokens.surface.primary));
      expect(resolved.onSurface, equals(tokens.text.onPrimary));
      expect(resolved.contrastRatio, greaterThanOrEqualTo(4.5));
    });

    test(
      'Sad Path: resolve() throws ContrastDeficitException when resolving mismatched low-contrast tokens',
      () {
        final AxiomaColorTokens tokens = AxiomaColorTokens.canonicalDark;

        // Resolving surface.primary (#38bdf8 sky) with white text (#ffffff) has ratio ~2.14:1 (< 4.5:1)
        expect(
          () => tokens.resolve('surface.primary', '#ffffff'),
          throwsA(
            isA<ContrastDeficitException>().having(
              (ContrastDeficitException e) => e.contrastRatio,
              'contrastRatio',
              lessThan(4.5),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path: resolveByName() throws ArgumentError for unknown token name',
      () {
        final AxiomaColorTokens tokens = AxiomaColorTokens.canonicalDark;

        expect(
          () => tokens.resolveByName('non_existent_token'),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test(
      'Sad Path: resolve() throws ArgumentError for unresolvable token string',
      () {
        final AxiomaColorTokens tokens = AxiomaColorTokens.canonicalDark;

        expect(
          () => tokens.resolve('invalid_token_identifier', '#ffffff'),
          throwsA(isA<ArgumentError>()),
        );
      },
    );
  });

  group('AxiomaColorTokens - JSON Serialization Roundtrip', () {
    test(
      'serializes and deserializes canonicalDark without loss of contrast invariants',
      () {
        final AxiomaColorTokens original = AxiomaColorTokens.canonicalDark;
        final Map<String, dynamic> json = original.toJson();

        final AxiomaColorTokens deserialized = AxiomaColorTokens.fromJson(json);

        expect(deserialized.surface.primary, equals(original.surface.primary));
        expect(deserialized.text.onPrimary, equals(original.text.onPrimary));
        expect(deserialized.surface.muted, equals(original.surface.muted));
        expect(deserialized.text.onMuted, equals(original.text.onMuted));
        expect(
          deserialized.primary.contrastRatio,
          equals(original.primary.contrastRatio),
        );
      },
    );

    test(
      'Sad Path: fromJson throws ContrastDeficitException if corrupted JSON has deficit pair',
      () {
        final Map<String, dynamic> json = AxiomaColorTokens.canonicalDark
            .toJson();
        // Corrupt primary pair to low-contrast gray on gray
        json['primary'] = <String, dynamic>{
          'name': 'primary',
          'surface': '#808080',
          'on_surface': '#707070',
          'is_large_text_only': false,
        };

        expect(
          () => AxiomaColorTokens.fromJson(json),
          throwsA(isA<ContrastDeficitException>()),
        );
      },
    );
  });
}
