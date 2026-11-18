import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('WebhookSignatureValidator - Comprehensive Security Suite (§4, §6, §39)', () {
    const String testPayload =
        '{"event":"payment_received","amount":150.0,"currency":"USD"}';
    const String testSecret = 'super-secret-key-32-bytes-long!';
    const String telegramSecret = 'tg-secret-token-abcdef123456';
    const String bearerSecret = 'bearer-auth-token-xyz789';

    group('HMAC-SHA256 Signatures (X-Hub-Signature-256)', () {
      test(
        'Happy Path: valid HMAC-SHA256 signature with sha256= prefix passes',
        () {
          final String validSig = WebhookSignatureValidator.computeHubSignature(
            testPayload,
            testSecret,
            includePrefix: true,
          );

          expect(
            () => WebhookSignatureValidator.validateHubSignature(
              payload: testPayload,
              signatureHeader: validSig,
              secret: testSecret,
            ),
            returnsNormally,
          );

          expect(
            WebhookSignatureValidator.isValidHubSignature(
              payload: testPayload,
              signatureHeader: validSig,
              secret: testSecret,
            ),
            isTrue,
          );
        },
      );

      test('Happy Path: valid HMAC-SHA256 signature without prefix passes', () {
        final String validSig = WebhookSignatureValidator.computeHubSignature(
          testPayload,
          testSecret,
          includePrefix: false,
        );

        expect(
          () => WebhookSignatureValidator.validateHubSignature(
            payload: testPayload,
            signatureHeader: validSig,
            secret: testSecret,
          ),
          returnsNormally,
        );

        expect(
          WebhookSignatureValidator.isValidHubSignature(
            payload: testPayload,
            signatureHeader: validSig,
            secret: testSecret,
          ),
          isTrue,
        );
      });

      test('Happy Path: case-insensitive header lookup from map passes', () {
        final String validSig = WebhookSignatureValidator.computeHubSignature(
          testPayload,
          testSecret,
        );
        final Map<String, String> headers = <String, String>{
          'x-hub-signature-256': validSig,
        };

        expect(
          () => WebhookSignatureValidator.validateHubSignatureFromHeaders(
            payload: testPayload,
            headers: headers,
            secret: testSecret,
          ),
          returnsNormally,
        );
      });

      test(
        'Sad Path: truncated signature throws InvalidSignatureException (§6)',
        () {
          final String validSig = WebhookSignatureValidator.computeHubSignature(
            testPayload,
            testSecret,
          );
          // Truncate from 64 hex chars to 32 hex chars
          final String truncatedSig = validSig.substring(
            0,
            validSig.length - 32,
          );

          expect(
            () => WebhookSignatureValidator.validateHubSignature(
              payload: testPayload,
              signatureHeader: truncatedSig,
              secret: testSecret,
            ),
            throwsA(
              isA<InvalidSignatureException>().having(
                (InvalidSignatureException e) => e.receivedSignature,
                'receivedSignature',
                equals(truncatedSig),
              ),
            ),
          );

          expect(
            WebhookSignatureValidator.isValidHubSignature(
              payload: testPayload,
              signatureHeader: truncatedSig,
              secret: testSecret,
            ),
            isFalse,
          );
        },
      );

      test(
        'Sad Path: unsupported algorithm prefix (sha1, md5) throws UnsupportedAlgorithmException (§6)',
        () {
          const String unsupportedSha1 =
              'sha1=2fd4e1c67a2d28fced849ee1bb76e7391b93eb12';
          const String unsupportedMd5 = 'md5=9e107d9d372bb6826bd81d3542a419d6';

          expect(
            () => WebhookSignatureValidator.validateHubSignature(
              payload: testPayload,
              signatureHeader: unsupportedSha1,
              secret: testSecret,
            ),
            throwsA(
              isA<UnsupportedAlgorithmException>().having(
                (UnsupportedAlgorithmException e) => e.algorithm,
                'algorithm',
                equals('sha1'),
              ),
            ),
          );

          expect(
            () => WebhookSignatureValidator.validateHubSignature(
              payload: testPayload,
              signatureHeader: unsupportedMd5,
              secret: testSecret,
            ),
            throwsA(
              isA<UnsupportedAlgorithmException>().having(
                (UnsupportedAlgorithmException e) => e.algorithm,
                'algorithm',
                equals('md5'),
              ),
            ),
          );

          expect(
            WebhookSignatureValidator.isValidHubSignature(
              payload: testPayload,
              signatureHeader: unsupportedSha1,
              secret: testSecret,
            ),
            isFalse,
          );
        },
      );

      test(
        'Sad Path: mismatching secret or payload tampering throws InvalidSignatureException (§6)',
        () {
          final String validSig = WebhookSignatureValidator.computeHubSignature(
            testPayload,
            testSecret,
          );

          // Tampered payload
          expect(
            () => WebhookSignatureValidator.validateHubSignature(
              payload: '{"event":"payment_received","amount":999999.0}',
              signatureHeader: validSig,
              secret: testSecret,
            ),
            throwsA(isA<InvalidSignatureException>()),
          );

          // Wrong secret
          expect(
            () => WebhookSignatureValidator.validateHubSignature(
              payload: testPayload,
              signatureHeader: validSig,
              secret: 'wrong-secret-key-that-does-not-match',
            ),
            throwsA(isA<InvalidSignatureException>()),
          );
        },
      );

      test(
        'Sad Path: empty signature header throws MissingHeaderException (§6)',
        () {
          expect(
            () => WebhookSignatureValidator.validateHubSignature(
              payload: testPayload,
              signatureHeader: '   ',
              secret: testSecret,
            ),
            throwsA(isA<MissingHeaderException>()),
          );
        },
      );

      test(
        'Sad Path: missing header in map throws MissingHeaderException (§6)',
        () {
          expect(
            () => WebhookSignatureValidator.validateHubSignatureFromHeaders(
              payload: testPayload,
              headers: <String, String>{'content-type': 'application/json'},
              secret: testSecret,
            ),
            throwsA(isA<MissingHeaderException>()),
          );
        },
      );
    });

    group('Secret Tokens (X-Telegram-Bot-Api-Secret-Token)', () {
      test('Happy Path: matching secret token passes', () {
        expect(
          () => WebhookSignatureValidator.validateTelegramSecretToken(
            receivedToken: telegramSecret,
            expectedSecretToken: telegramSecret,
          ),
          returnsNormally,
        );

        expect(
          WebhookSignatureValidator.isValidTelegramSecretToken(
            receivedToken: telegramSecret,
            expectedSecretToken: telegramSecret,
          ),
          isTrue,
        );
      });

      test('Happy Path: case-insensitive header lookup from map passes', () {
        final Map<String, String> headers = <String, String>{
          'x-telegram-bot-api-secret-token': telegramSecret,
        };

        expect(
          () =>
              WebhookSignatureValidator.validateTelegramSecretTokenFromHeaders(
                headers: headers,
                expectedSecretToken: telegramSecret,
              ),
          returnsNormally,
        );
      });

      test(
        'Sad Path: mismatching secret token throws InvalidTokenException (§6)',
        () {
          expect(
            () => WebhookSignatureValidator.validateTelegramSecretToken(
              receivedToken: 'forged-token-123',
              expectedSecretToken: telegramSecret,
            ),
            throwsA(
              isA<InvalidTokenException>().having(
                (InvalidTokenException e) => e.tokenType,
                'tokenType',
                equals('TelegramSecretToken'),
              ),
            ),
          );

          expect(
            WebhookSignatureValidator.isValidTelegramSecretToken(
              receivedToken: 'forged-token-123',
              expectedSecretToken: telegramSecret,
            ),
            isFalse,
          );
        },
      );

      test(
        'Sad Path: missing or empty header throws MissingHeaderException / InvalidTokenException (§6)',
        () {
          expect(
            () => WebhookSignatureValidator.validateTelegramSecretToken(
              receivedToken: '   ',
              expectedSecretToken: telegramSecret,
            ),
            throwsA(isA<InvalidTokenException>()),
          );

          expect(
            () =>
                WebhookSignatureValidator.validateTelegramSecretTokenFromHeaders(
                  headers: <String, String>{},
                  expectedSecretToken: telegramSecret,
                ),
            throwsA(isA<MissingHeaderException>()),
          );
        },
      );
    });

    group('Bearer Tokens (Authorization: Bearer <token>)', () {
      test('Happy Path: valid Bearer token passes', () {
        const String authHeader = 'Bearer bearer-auth-token-xyz789';

        expect(
          () => WebhookSignatureValidator.validateBearerToken(
            authHeader: authHeader,
            expectedToken: bearerSecret,
          ),
          returnsNormally,
        );

        expect(
          WebhookSignatureValidator.isValidBearerToken(
            authHeader: authHeader,
            expectedToken: bearerSecret,
          ),
          isTrue,
        );
      });

      test(
        'Happy Path: case-insensitive header lookup from headers map passes',
        () {
          final Map<String, String> headers = <String, String>{
            'authorization': 'Bearer bearer-auth-token-xyz789',
          };

          expect(
            () => WebhookSignatureValidator.validateBearerTokenFromHeaders(
              headers: headers,
              expectedToken: bearerSecret,
            ),
            returnsNormally,
          );
        },
      );

      test(
        'Sad Path: missing Bearer prefix throws InvalidTokenException (§6)',
        () {
          expect(
            () => WebhookSignatureValidator.validateBearerToken(
              authHeader: 'Basic dXNlcjpwYXNz',
              expectedToken: bearerSecret,
            ),
            throwsA(
              isA<InvalidTokenException>().having(
                (InvalidTokenException e) => e.tokenType,
                'tokenType',
                equals('Bearer'),
              ),
            ),
          );
        },
      );

      test(
        'Sad Path: mismatching token value throws InvalidTokenException (§6)',
        () {
          expect(
            () => WebhookSignatureValidator.validateBearerToken(
              authHeader: 'Bearer unauthorized-token-attempt',
              expectedToken: bearerSecret,
            ),
            throwsA(
              isA<InvalidTokenException>().having(
                (InvalidTokenException e) => e.tokenType,
                'tokenType',
                equals('Bearer'),
              ),
            ),
          );

          expect(
            WebhookSignatureValidator.isValidBearerToken(
              authHeader: 'Bearer unauthorized-token-attempt',
              expectedToken: bearerSecret,
            ),
            isFalse,
          );
        },
      );

      test(
        'Sad Path: missing Authorization header in map throws MissingHeaderException (§6)',
        () {
          expect(
            () => WebhookSignatureValidator.validateBearerTokenFromHeaders(
              headers: <String, String>{'host': 'example.com'},
              expectedToken: bearerSecret,
            ),
            throwsA(isA<MissingHeaderException>()),
          );
        },
      );
    });

    group('Replay Attack Prevention & Timestamp Skew (maxSkewSeconds: 300)', () {
      final DateTime now = DateTime.parse('2026-11-09T20:00:00Z');

      test('Happy Path: timestamp within 300 seconds passes', () {
        // Exactly 150 seconds in the past
        final DateTime validPast = now.subtract(const Duration(seconds: 150));
        // 60 seconds in the future (minor clock drift)
        final DateTime validFuture = now.add(const Duration(seconds: 60));

        expect(
          () => WebhookSignatureValidator.validateTimestamp(
            timestamp: validPast,
            maxSkewSeconds: 300,
            now: now,
          ),
          returnsNormally,
        );

        expect(
          () => WebhookSignatureValidator.validateTimestamp(
            timestamp: validFuture,
            maxSkewSeconds: 300,
            now: now,
          ),
          returnsNormally,
        );

        expect(
          WebhookSignatureValidator.isValidTimestamp(
            timestamp: validPast,
            maxSkewSeconds: 300,
            now: now,
          ),
          isTrue,
        );
      });

      test(
        'Happy Path: supports ISO-8601 string, unix epoch seconds, and unix epoch milliseconds',
        () {
          final int epochSeconds = now.millisecondsSinceEpoch ~/ 1000 - 30;
          final int epochMillis = now.millisecondsSinceEpoch - 45000;
          final String isoString = now
              .subtract(const Duration(seconds: 10))
              .toIso8601String();

          expect(
            () => WebhookSignatureValidator.validateTimestamp(
              timestamp: epochSeconds,
              now: now,
            ),
            returnsNormally,
          );

          expect(
            () => WebhookSignatureValidator.validateTimestamp(
              timestamp: epochMillis,
              now: now,
            ),
            returnsNormally,
          );

          expect(
            () => WebhookSignatureValidator.validateTimestamp(
              timestamp: isoString,
              now: now,
            ),
            returnsNormally,
          );

          expect(
            () => WebhookSignatureValidator.validateTimestamp(
              timestamp: '$epochSeconds',
              now: now,
            ),
            returnsNormally,
          );
        },
      );

      test(
        'Sad Path: timestamp expired beyond 300 seconds throws TimestampExpiredException (§6)',
        () {
          // 301 seconds ago (1 second beyond default tolerance)
          final DateTime expiredTimestamp = now.subtract(
            const Duration(seconds: 301),
          );

          expect(
            () => WebhookSignatureValidator.validateTimestamp(
              timestamp: expiredTimestamp,
              maxSkewSeconds: 300,
              now: now,
            ),
            throwsA(
              isA<TimestampExpiredException>()
                  .having(
                    (TimestampExpiredException e) => e.skewSeconds,
                    'skewSeconds',
                    equals(301),
                  )
                  .having(
                    (TimestampExpiredException e) => e.maxSkewSeconds,
                    'maxSkewSeconds',
                    equals(300),
                  ),
            ),
          );

          expect(
            WebhookSignatureValidator.isValidTimestamp(
              timestamp: expiredTimestamp,
              maxSkewSeconds: 300,
              now: now,
            ),
            isFalse,
          );
        },
      );

      test(
        'Sad Path: future spoofed timestamp beyond maxSkewSeconds throws TimestampExpiredException (§6)',
        () {
          // 600 seconds in the future
          final DateTime futureReplay = now.add(const Duration(seconds: 600));

          expect(
            () => WebhookSignatureValidator.validateTimestamp(
              timestamp: futureReplay,
              maxSkewSeconds: 300,
              now: now,
            ),
            throwsA(
              isA<TimestampExpiredException>().having(
                (TimestampExpiredException e) => e.skewSeconds,
                'skewSeconds',
                equals(600),
              ),
            ),
          );
        },
      );

      test(
        'Sad Path: timestamp from header missing throws MissingHeaderException (§6)',
        () {
          expect(
            () => WebhookSignatureValidator.validateTimestampFromHeaders(
              headers: <String, String>{},
              now: now,
            ),
            throwsA(isA<MissingHeaderException>()),
          );
        },
      );
    });

    group('Unified Webhook Request Validation', () {
      final DateTime now = DateTime.parse('2026-11-09T20:00:00Z');

      test('Happy Path: all security components valid passes smoothly', () {
        final String validSig = WebhookSignatureValidator.computeHubSignature(
          testPayload,
          testSecret,
        );
        final Map<String, String> headers = <String, String>{
          'X-Hub-Signature-256': validSig,
          'X-Telegram-Bot-Api-Secret-Token': telegramSecret,
          'Authorization': 'Bearer $bearerSecret',
          'X-Hub-Timestamp': now.toIso8601String(),
        };

        expect(
          () => WebhookSignatureValidator.validateWebhookRequest(
            payload: testPayload,
            headers: headers,
            hmacSecret: testSecret,
            telegramSecretToken: telegramSecret,
            bearerToken: bearerSecret,
            requireTimestamp: true,
            now: now,
          ),
          returnsNormally,
        );
      });

      test(
        'Sad Path: failure in one component throws designated typed exception (§6)',
        () {
          final String validSig = WebhookSignatureValidator.computeHubSignature(
            testPayload,
            testSecret,
          );
          final Map<String, String> headers = <String, String>{
            'X-Hub-Signature-256': validSig,
            'X-Telegram-Bot-Api-Secret-Token': 'compromised-token',
            'Authorization': 'Bearer $bearerSecret',
            'X-Hub-Timestamp': now.toIso8601String(),
          };

          expect(
            () => WebhookSignatureValidator.validateWebhookRequest(
              payload: testPayload,
              headers: headers,
              hmacSecret: testSecret,
              telegramSecretToken: telegramSecret,
              bearerToken: bearerSecret,
              requireTimestamp: true,
              now: now,
            ),
            throwsA(isA<InvalidTokenException>()),
          );
        },
      );
    });
  });
}
