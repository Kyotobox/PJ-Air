/// Suite de Pruebas Físicas: GeminiKeyPool & Rotation Engine (TASK-G188-02)
///
/// Certifica el funcionamiento del pool multi-llave, rotación Round-Robin,
/// discriminación dual de fallos y manejo estricto de excepciones (Sad Path).
/// Cumple con §4 (Cero Mocks) y §39 (Pure Dart Core).
library;

import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

void main() {
  group('TASK-G188-02: GeminiKeyPool Shared Kernel Suite', () {
    const List<String> testKeys = <String>[
      'AQ.Ab8RN6_KEY_ALPHA_01',
      'AQ.Ab8RN6_KEY_BETA_02',
      'AQ.Ab8RN6_KEY_GAMMA_03',
    ];

    group('Inicialización y Estructura', () {
      test(
        'Happy Path: Instanciación limpia y omisión de claves en blanco',
        () {
          final GeminiKeyPool pool = GeminiKeyPool(
            keys: <String>[
              'AQ.Ab8RN6_KEY_ALPHA_01',
              '',
              '   ',
              'AQ.Ab8RN6_KEY_BETA_02',
            ],
          );

          expect(pool.length, equals(2));
          expect(pool.keys, contains('AQ.Ab8RN6_KEY_ALPHA_01'));
          expect(pool.keys, contains('AQ.Ab8RN6_KEY_BETA_02'));
          expect(pool.currentIndex, equals(0));
        },
      );

      test(
        'Sad Path: Lista vacía o sin claves válidas lanza ArgumentError',
        () {
          expect(() => GeminiKeyPool(keys: <String>[]), throwsArgumentError);
          expect(
            () => GeminiKeyPool(keys: <String>['', '   ']),
            throwsArgumentError,
          );
        },
      );
    });

    group('Rotación Round-Robin y Salto de Cooldown', () {
      test('Happy Path: nextKey avanza en secuencia circular determinista', () {
        final GeminiKeyPool pool = GeminiKeyPool(keys: testKeys);

        expect(pool.nextKey, equals('AQ.Ab8RN6_KEY_ALPHA_01'));
        expect(pool.nextKey, equals('AQ.Ab8RN6_KEY_BETA_02'));
        expect(pool.nextKey, equals('AQ.Ab8RN6_KEY_GAMMA_03'));
        // Vuelta circular
        expect(pool.nextKey, equals('AQ.Ab8RN6_KEY_ALPHA_01'));
      });

      test('Happy Path: Salto transparente de clave en cooldown', () {
        final GeminiKeyPool pool = GeminiKeyPool(keys: testKeys);
        final DateTime now = DateTime.now();

        // Poner la primera clave en cooldown
        pool.markRateLimited(
          'AQ.Ab8RN6_KEY_ALPHA_01',
          cooldownSec: 300,
          now: now,
        );

        expect(
          pool.isKeyAvailable('AQ.Ab8RN6_KEY_ALPHA_01', now: now),
          isFalse,
        );
        expect(pool.isKeyAvailable('AQ.Ab8RN6_KEY_BETA_02', now: now), isTrue);

        // Al pedir nextKey, salta directamente a la segunda
        expect(pool.nextKey, equals('AQ.Ab8RN6_KEY_BETA_02'));
      });

      test('Happy Path: Recuperación automática al expirar el cooldown', () {
        final GeminiKeyPool pool = GeminiKeyPool(keys: testKeys);
        final DateTime t0 = DateTime.now();

        pool.markRateLimited(
          'AQ.Ab8RN6_KEY_ALPHA_01',
          cooldownSec: 60,
          now: t0,
        );

        // En t0 está bloqueada
        expect(pool.isKeyAvailable('AQ.Ab8RN6_KEY_ALPHA_01', now: t0), isFalse);

        // En t0 + 61 segundos está recuperada
        final DateTime t1 = t0.add(const Duration(seconds: 61));
        expect(pool.isKeyAvailable('AQ.Ab8RN6_KEY_ALPHA_01', now: t1), isTrue);
      });

      test(
        'Sad Path: Si todas las claves están en cooldown, lanza GeminiPoolExhaustedException',
        () {
          final GeminiKeyPool pool = GeminiKeyPool(keys: testKeys);
          final DateTime now = DateTime.now();

          for (final String key in testKeys) {
            pool.markQuotaExhausted(key, now: now);
          }

          expect(
            () => pool.acquireNextKey(now: now),
            throwsA(isA<GeminiPoolExhaustedException>()),
          );
        },
      );
    });

    group('Carga desde Variables de Entorno (fromEnvironment)', () {
      test('Happy Path: Carga combinada de clave base y claves indexadas', () {
        final Map<String, String> mockEnv = <String, String>{
          'GEMINI_API_KEY': 'AQ.BASE_KEY',
          'GEMINI_API_KEY_1': 'AQ.INDEXED_1',
          'GEMINI_API_KEY_2': 'AQ.INDEXED_2',
        };

        final GeminiKeyPool pool = GeminiKeyPool.fromEnvironment(
          environment: mockEnv,
        );

        expect(pool.length, equals(3));
        expect(pool.keys, contains('AQ.BASE_KEY'));
        expect(pool.keys, contains('AQ.INDEXED_1'));
        expect(pool.keys, contains('AQ.INDEXED_2'));
      });

      test('Sad Path: Entorno sin claves para el prefijo lanza StateError', () {
        expect(
          () => GeminiKeyPool.fromEnvironment(
            prefix: 'NON_EXISTENT_PREFIX',
            environment: <String, String>{},
          ),
          throwsStateError,
        );
      });
    });

    group('Discriminación Heurística de Excepciones y Retardo', () {
      test('isDailyLimit identifica cuota diaria agotada', () {
        expect(
          GeminiKeyPool.isDailyLimit(
            'Error 429: ResourceExhausted: GenerateRequestsPerDay exceeded',
          ),
          isTrue,
        );
        expect(
          GeminiKeyPool.isDailyLimit(
            'RESOURCE_EXHAUSTED: daily quota limit reached',
          ),
          isTrue,
        );
        expect(
          GeminiKeyPool.isDailyLimit('Rate limit exceeded (15 RPM)'),
          isFalse,
        );
      });

      test('isRateLimit identifica límites temporales por minuto', () {
        expect(
          GeminiKeyPool.isRateLimit('HTTP 429 Too Many Requests: retry in 20s'),
          isTrue,
        );
        expect(
          GeminiKeyPool.isRateLimit(
            'Rate limit of 15 tokens per minute reached',
          ),
          isTrue,
        );
        expect(GeminiKeyPool.isRateLimit('Invalid API key provided'), isFalse);
      });

      test('extractRetryDelaySec extrae segundos sugeridos o usa fallback', () {
        expect(
          GeminiKeyPool.extractRetryDelaySec(
            'Rate limit reached, please retry in 18.5s.',
          ),
          equals(18.5),
        );
        expect(
          GeminiKeyPool.extractRetryDelaySec(
            'Rate limit reached, please retry in 45s.',
          ),
          equals(45.0),
        );
        expect(
          GeminiKeyPool.extractRetryDelaySec(
            'Unknown error format',
            defaultDelay: 10.0,
          ),
          equals(10.0),
        );
      });
    });
  });
}
