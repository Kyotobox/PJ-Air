/// Axioma Webhook Cryptographic Signature Validator (§39 Pure Dart Core)
///
/// Provides strict cryptographic validation for inbound webhooks:
/// - HMAC-SHA256 signatures (`X-Hub-Signature-256`, Meta/WhatsApp, GitHub)
/// - Secret Tokens (`X-Telegram-Bot-Api-Secret-Token`, Telegram Bot API)
/// - Bearer Tokens (`Authorization: Bearer <token>`)
/// - Replay attack prevention via timestamp delta window (`maxSkewSeconds: 300`)
///
/// Zero mocks, pure Dart, constant-time comparisons (§4, §6, §39).
library;

import 'dart:convert';
import 'package:crypto/crypto.dart';

import 'security_exceptions.dart';

/// Cryptographic validator for incoming webhook requests.
class WebhookSignatureValidator {
  const WebhookSignatureValidator();

  /// Canonical HTTP header for HMAC-SHA256 signatures (Meta/WhatsApp, GitHub).
  static const String headerHubSignature = 'X-Hub-Signature-256';

  /// Canonical HTTP header for Telegram Bot API secret token webhooks.
  static const String headerTelegramSecretToken =
      'X-Telegram-Bot-Api-Secret-Token';

  /// Canonical HTTP header for HTTP Authorization (Bearer token).
  static const String headerAuthorization = 'Authorization';

  /// Canonical HTTP header for webhook timestamp delta checks.
  static const String headerTimestamp = 'X-Hub-Timestamp';

  /// Standard maximum allowed clock skew in seconds (5 minutes) for replay attack prevention.
  static const int defaultMaxSkewSeconds = 300;

  static final RegExp _hex64Regex = RegExp(r'^[0-9a-f]{64}$');

  /// Searches [headers] for [targetHeader] using case-insensitive matching.
  static String? findHeader(Map<String, String> headers, String targetHeader) {
    final String targetLower = targetHeader.toLowerCase();
    for (final MapEntry<String, String> entry in headers.entries) {
      if (entry.key.toLowerCase() == targetLower) {
        return entry.value;
      }
    }
    return null;
  }

  /// Compares two strings in constant time to prevent timing side-channel attacks.
  static bool constantTimeEquals(String a, String b) {
    if (a.length != b.length) return false;
    int result = 0;
    for (int i = 0; i < a.length; i++) {
      result |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return result == 0;
  }

  /// Computes a valid HMAC-SHA256 signature for [payload] using [secret].
  ///
  /// If [includePrefix] is `true` (default), returns `sha256=<hex64>`.
  static String computeHubSignature(
    String payload,
    String secret, {
    bool includePrefix = true,
  }) {
    final Hmac hmac = Hmac(sha256, utf8.encode(secret));
    final String digest = hmac
        .convert(utf8.encode(payload))
        .toString()
        .toLowerCase();
    return includePrefix ? 'sha256=$digest' : digest;
  }

  /// Validates an HMAC-SHA256 signature for [payload] against [signatureHeader] and [secret].
  ///
  /// Throws:
  /// - [MissingHeaderException] if [signatureHeader] is empty.
  /// - [UnsupportedAlgorithmException] if the algorithm prefix is not `sha256`.
  /// - [InvalidSignatureException] if the signature is truncated, malformed, or mismatching.
  static void validateHubSignature({
    required String payload,
    required String signatureHeader,
    required String secret,
  }) {
    final String trimmedHeader = signatureHeader.trim();
    if (trimmedHeader.isEmpty) {
      throw MissingHeaderException(
        headerHubSignature,
        message: 'Webhook HMAC signature header cannot be empty.',
      );
    }
    if (secret.isEmpty) {
      throw const InvalidSignatureException('Webhook secret cannot be empty.');
    }

    String cleanSignature;
    if (trimmedHeader.contains('=')) {
      final int eqIndex = trimmedHeader.indexOf('=');
      final String algorithm = trimmedHeader
          .substring(0, eqIndex)
          .trim()
          .toLowerCase();
      if (algorithm != 'sha256') {
        throw UnsupportedAlgorithmException(
          algorithm,
          message:
              'Algorithm "$algorithm" is not supported. Expected "sha256".',
        );
      }
      cleanSignature = trimmedHeader
          .substring(eqIndex + 1)
          .trim()
          .toLowerCase();
    } else {
      cleanSignature = trimmedHeader.toLowerCase();
    }

    if (cleanSignature.length != 64 || !_hex64Regex.hasMatch(cleanSignature)) {
      throw InvalidSignatureException(
        'HMAC-SHA256 signature is truncated or malformed (expected 64 hex characters, received ${cleanSignature.length}).',
        receivedSignature: signatureHeader,
      );
    }

    final Hmac hmac = Hmac(sha256, utf8.encode(secret));
    final String expectedDigest = hmac
        .convert(utf8.encode(payload))
        .toString()
        .toLowerCase();

    if (!constantTimeEquals(cleanSignature, expectedDigest)) {
      throw InvalidSignatureException(
        'Cryptographic HMAC-SHA256 signature verification failed.',
        receivedSignature: signatureHeader,
      );
    }
  }

  /// Validates an HMAC-SHA256 signature extracted from [headers] for [payload].
  ///
  /// Looks up [headerName] case-insensitively. Throws [MissingHeaderException]
  /// if the header is not present.
  static void validateHubSignatureFromHeaders({
    required String payload,
    required Map<String, String> headers,
    required String secret,
    String headerName = headerHubSignature,
  }) {
    final String? headerValue = findHeader(headers, headerName);
    if (headerValue == null || headerValue.trim().isEmpty) {
      throw MissingHeaderException(headerName);
    }
    validateHubSignature(
      payload: payload,
      signatureHeader: headerValue,
      secret: secret,
    );
  }

  /// Validates a Telegram Bot API Secret Token (`X-Telegram-Bot-Api-Secret-Token`).
  ///
  /// Throws [InvalidTokenException] if [receivedToken] is empty or does not match [expectedSecretToken].
  static void validateTelegramSecretToken({
    required String receivedToken,
    required String expectedSecretToken,
  }) {
    final String trimmedReceived = receivedToken.trim();
    final String trimmedExpected = expectedSecretToken.trim();

    if (trimmedReceived.isEmpty) {
      throw const InvalidTokenException(
        'Received Telegram secret token cannot be empty.',
        tokenType: 'TelegramSecretToken',
      );
    }
    if (trimmedExpected.isEmpty) {
      throw const InvalidTokenException(
        'Expected Telegram secret token cannot be empty.',
        tokenType: 'TelegramSecretToken',
      );
    }

    if (!constantTimeEquals(trimmedReceived, trimmedExpected)) {
      throw const InvalidTokenException(
        'Telegram Bot API secret token mismatch.',
        tokenType: 'TelegramSecretToken',
      );
    }
  }

  /// Validates Telegram Bot API Secret Token from [headers].
  ///
  /// Looks up [headerName] case-insensitively. Throws [MissingHeaderException]
  /// if absent.
  static void validateTelegramSecretTokenFromHeaders({
    required Map<String, String> headers,
    required String expectedSecretToken,
    String headerName = headerTelegramSecretToken,
  }) {
    final String? headerValue = findHeader(headers, headerName);
    if (headerValue == null || headerValue.trim().isEmpty) {
      throw MissingHeaderException(headerName);
    }
    validateTelegramSecretToken(
      receivedToken: headerValue,
      expectedSecretToken: expectedSecretToken,
    );
  }

  /// Validates an HTTP Bearer token from the [authHeader] (`Authorization: Bearer <token>`).
  ///
  /// Throws [InvalidTokenException] if malformed or mismatching.
  static void validateBearerToken({
    required String authHeader,
    required String expectedToken,
  }) {
    final String trimmedHeader = authHeader.trim();
    if (trimmedHeader.isEmpty) {
      throw const InvalidTokenException(
        'Authorization header cannot be empty.',
        tokenType: 'Bearer',
      );
    }

    if (!trimmedHeader.toLowerCase().startsWith('bearer ')) {
      throw const InvalidTokenException(
        'Authorization header must start with "Bearer ".',
        tokenType: 'Bearer',
      );
    }

    final String extractedToken = trimmedHeader.substring(7).trim();
    final String trimmedExpected = expectedToken.trim();

    if (extractedToken.isEmpty) {
      throw const InvalidTokenException(
        'Bearer token value cannot be empty.',
        tokenType: 'Bearer',
      );
    }
    if (trimmedExpected.isEmpty) {
      throw const InvalidTokenException(
        'Expected Bearer token cannot be empty.',
        tokenType: 'Bearer',
      );
    }

    if (!constantTimeEquals(extractedToken, trimmedExpected)) {
      throw const InvalidTokenException(
        'Bearer authentication token mismatch.',
        tokenType: 'Bearer',
      );
    }
  }

  /// Validates an HTTP Bearer token from [headers].
  ///
  /// Looks up [headerName] case-insensitively. Throws [MissingHeaderException]
  /// if absent.
  static void validateBearerTokenFromHeaders({
    required Map<String, String> headers,
    required String expectedToken,
    String headerName = headerAuthorization,
  }) {
    final String? headerValue = findHeader(headers, headerName);
    if (headerValue == null || headerValue.trim().isEmpty) {
      throw MissingHeaderException(headerName);
    }
    validateBearerToken(authHeader: headerValue, expectedToken: expectedToken);
  }

  /// Validates a webhook timestamp against [now] to prevent replay attacks.
  ///
  /// [timestamp] may be a [DateTime], an [int] (unix epoch in seconds or milliseconds),
  /// or a [String] (ISO-8601 or epoch integer string).
  ///
  /// If the absolute skew between [now] and [timestamp] exceeds [maxSkewSeconds] (default: 300s),
  /// throws [TimestampExpiredException].
  static void validateTimestamp({
    required dynamic timestamp,
    int maxSkewSeconds = defaultMaxSkewSeconds,
    DateTime? now,
  }) {
    if (timestamp == null) {
      throw ArgumentError.notNull('timestamp');
    }

    final DateTime parsedTime = _parseTimestamp(timestamp);
    final DateTime referenceNow = (now ?? DateTime.now()).toUtc();
    final int skewSeconds = referenceNow.difference(parsedTime).inSeconds.abs();

    if (skewSeconds > maxSkewSeconds) {
      throw TimestampExpiredException(
        requestTimestamp: parsedTime,
        currentTimestamp: referenceNow,
        skewSeconds: skewSeconds,
        maxSkewSeconds: maxSkewSeconds,
      );
    }
  }

  /// Validates a webhook timestamp extracted from [headers].
  ///
  /// Looks up [headerName] case-insensitively. Throws [MissingHeaderException]
  /// if absent.
  static void validateTimestampFromHeaders({
    required Map<String, String> headers,
    String headerName = headerTimestamp,
    int maxSkewSeconds = defaultMaxSkewSeconds,
    DateTime? now,
  }) {
    final String? headerValue = findHeader(headers, headerName);
    if (headerValue == null || headerValue.trim().isEmpty) {
      throw MissingHeaderException(headerName);
    }
    validateTimestamp(
      timestamp: headerValue,
      maxSkewSeconds: maxSkewSeconds,
      now: now,
    );
  }

  /// Validates a complete inbound webhook request according to configured security policies.
  ///
  /// If [hmacSecret] is provided, verifies [headerHubSignature].
  /// If [telegramSecretToken] is provided, verifies [headerTelegramSecretToken].
  /// If [bearerToken] is provided, verifies [headerAuthorization].
  /// If [requireTimestamp] is `true`, verifies [headerTimestamp] within [maxSkewSeconds].
  static void validateWebhookRequest({
    required String payload,
    required Map<String, String> headers,
    String? hmacSecret,
    String? telegramSecretToken,
    String? bearerToken,
    bool requireTimestamp = false,
    String timestampHeaderName = headerTimestamp,
    int maxSkewSeconds = defaultMaxSkewSeconds,
    DateTime? now,
  }) {
    if (requireTimestamp) {
      validateTimestampFromHeaders(
        headers: headers,
        headerName: timestampHeaderName,
        maxSkewSeconds: maxSkewSeconds,
        now: now,
      );
    }

    if (hmacSecret != null && hmacSecret.isNotEmpty) {
      validateHubSignatureFromHeaders(
        payload: payload,
        headers: headers,
        secret: hmacSecret,
      );
    }

    if (telegramSecretToken != null && telegramSecretToken.isNotEmpty) {
      validateTelegramSecretTokenFromHeaders(
        headers: headers,
        expectedSecretToken: telegramSecretToken,
      );
    }

    if (bearerToken != null && bearerToken.isNotEmpty) {
      validateBearerTokenFromHeaders(
        headers: headers,
        expectedToken: bearerToken,
      );
    }
  }

  /// Safe boolean checker for HMAC-SHA256 signature verification.
  ///
  /// Returns `true` if valid, `false` otherwise without throwing.
  static bool isValidHubSignature({
    required String payload,
    required String signatureHeader,
    required String secret,
  }) {
    try {
      validateHubSignature(
        payload: payload,
        signatureHeader: signatureHeader,
        secret: secret,
      );
      return true;
    } catch (_) {
      // INTENTIONAL: Safe boolean check helper suppresses internal security exceptions.
      return false;
    }
  }

  /// Safe boolean checker for Telegram Bot API secret token.
  static bool isValidTelegramSecretToken({
    required String receivedToken,
    required String expectedSecretToken,
  }) {
    try {
      validateTelegramSecretToken(
        receivedToken: receivedToken,
        expectedSecretToken: expectedSecretToken,
      );
      return true;
    } catch (_) {
      // INTENTIONAL: Safe boolean check helper suppresses internal security exceptions.
      return false;
    }
  }

  /// Safe boolean checker for Bearer tokens.
  static bool isValidBearerToken({
    required String authHeader,
    required String expectedToken,
  }) {
    try {
      validateBearerToken(authHeader: authHeader, expectedToken: expectedToken);
      return true;
    } catch (_) {
      // INTENTIONAL: Safe boolean check helper suppresses internal security exceptions.
      return false;
    }
  }

  /// Safe boolean checker for timestamp skew.
  static bool isValidTimestamp({
    required dynamic timestamp,
    int maxSkewSeconds = defaultMaxSkewSeconds,
    DateTime? now,
  }) {
    try {
      validateTimestamp(
        timestamp: timestamp,
        maxSkewSeconds: maxSkewSeconds,
        now: now,
      );
      return true;
    } catch (_) {
      // INTENTIONAL: Safe boolean check helper suppresses internal security exceptions.
      return false;
    }
  }

  static DateTime _parseTimestamp(dynamic raw) {
    if (raw is DateTime) {
      return raw.toUtc();
    }
    if (raw is int) {
      if (raw <= 0) {
        throw TimestampExpiredException(
          requestTimestamp: DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
          currentTimestamp: DateTime.now().toUtc(),
          skewSeconds: 9999999,
          maxSkewSeconds: defaultMaxSkewSeconds,
          message: 'Invalid non-positive epoch timestamp: $raw',
        );
      }
      if (raw > 1000000000000) {
        return DateTime.fromMillisecondsSinceEpoch(raw, isUtc: true);
      }
      return DateTime.fromMillisecondsSinceEpoch(raw * 1000, isUtc: true);
    }
    if (raw is String) {
      final String trimmed = raw.trim();
      if (trimmed.isEmpty) {
        throw const FormatException('Timestamp string cannot be empty.');
      }
      final int? asInt = int.tryParse(trimmed);
      if (asInt != null) {
        return _parseTimestamp(asInt);
      }
      return DateTime.parse(trimmed).toUtc();
    }
    throw ArgumentError(
      'Unsupported timestamp format (${raw.runtimeType}): $raw',
    );
  }
}
