import 'dart:convert';
import 'package:crypto/crypto.dart';

/// Pure Dart cryptographic HMAC-SHA256 verifier for Webhooks (§39).
/// Fully compatible with Meta WhatsApp Cloud API (`X-Hub-Signature-256`),
/// GitHub, Stripe, and standard HMAC webhook signatures.
class WebhookHmacVerifier {
  WebhookHmacVerifier._();

  static final RegExp _hex64Regex = RegExp(r'^[0-9a-f]{64}$');

  /// Verifies an HMAC-SHA256 signature for a given [payload] and [secret].
  ///
  /// Supports signatures with or without the `sha256=` prefix.
  /// Uses constant-time comparison to prevent timing side-channel attacks.
  ///
  /// Returns `false` if the signature is empty, truncated, malformed,
  /// corrupted, or does not match (§6).
  static bool verify(String payload, String signature, String secret) {
    if (signature.trim().isEmpty || secret.isEmpty) {
      return false;
    }

    String cleanSignature = signature.trim().toLowerCase();
    if (cleanSignature.startsWith('sha256=')) {
      cleanSignature = cleanSignature.substring(7).trim();
    }

    // SHA-256 hex digest must be exactly 64 hexadecimal characters
    if (cleanSignature.length != 64 || !_hex64Regex.hasMatch(cleanSignature)) {
      return false;
    }

    // Compute expected HMAC-SHA256 digest
    final Hmac hmac = Hmac(sha256, utf8.encode(secret));
    final String expectedDigest = hmac
        .convert(utf8.encode(payload))
        .toString()
        .toLowerCase();

    // Constant-time comparison
    return _constantTimeEquals(cleanSignature, expectedDigest);
  }

  /// Computes a valid HMAC-SHA256 signature string for testing or sending webhooks.
  ///
  /// If [includePrefix] is `true`, prepends `sha256=` to the hex digest.
  static String computeSignature(
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

  static bool _constantTimeEquals(String a, String b) {
    if (a.length != b.length) return false;
    int result = 0;
    for (int i = 0; i < a.length; i++) {
      result |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return result == 0;
  }
}

/// Standalone top-level function for quick verification (§39).
bool verifyHmacSha256(String payload, String signature, String secret) =>
    WebhookHmacVerifier.verify(payload, signature, secret);
