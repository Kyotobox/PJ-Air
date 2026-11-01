import 'dart:io';
import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

void main() {
  group('Axioma Shibui Tokens Specification & Certification (§4, §6, §39, §40)', () {
    const String cssPath = 'theme/shibui_tokens.css';

    test(
      'Happy Path 1: Archivo theme/shibui_tokens.css existe y pasa validación',
      () {
        final File file = File(cssPath);
        expect(
          file.existsSync(),
          isTrue,
          reason: 'El archivo físico debe existir en theme/',
        );
        expect(
          () => ShibuiTokenValidator.validateCssFile(cssPath),
          returnsNormally,
        );
      },
    );

    test(
      'Happy Path 2: Verificación de paletas duales Sumi (Oscuro) y Washi (Claro)',
      () {
        final String css = File(cssPath).readAsStringSync();
        expect(css.contains('[data-theme="sumi"]'), isTrue);
        expect(css.contains('[data-theme="washi"]'), isTrue);
        expect(css.contains('--shibui-bg'), isTrue);
        expect(css.contains('--shibui-surface'), isTrue);
        expect(css.contains('--shibui-border'), isTrue);
      },
    );

    test(
      'Happy Path 3: Escala de espaciado Ma (間) está completa (--ma-1 a --ma-8)',
      () {
        final String css = File(cssPath).readAsStringSync();
        for (final String ma in <String>[
          '--ma-1: 4px;',
          '--ma-2: 8px;',
          '--ma-3: 12px;',
          '--ma-4: 16px;',
          '--ma-5: 24px;',
          '--ma-6: 32px;',
          '--ma-8: 48px;',
        ]) {
          expect(css.contains(ma), isTrue, reason: 'Debe contener $ma');
        }
      },
    );

    test('Happy Path 4: Erradicación física de efectos cyber neón', () {
      final String css = File(cssPath).readAsStringSync();
      expect(css.toLowerCase().contains('cyber-neon'), isFalse);
      expect(css.toLowerCase().contains('neon-glow'), isFalse);
    });

    test('Sad Path 1 (§6): CSS vacío lanza ShibuiTokenValidationException', () {
      expect(
        () => ShibuiTokenValidator.validateCssContent(''),
        throwsA(isA<ShibuiTokenValidationException>()),
      );
    });

    test(
      'Sad Path 2 (§6): CSS sin selector Washi lanza ShibuiTokenValidationException',
      () {
        expect(
          () => ShibuiTokenValidator.validateCssContent(
            ':root { --shibui-bg: #000; }',
          ),
          throwsA(isA<ShibuiTokenValidationException>()),
        );
      },
    );
  });
}
