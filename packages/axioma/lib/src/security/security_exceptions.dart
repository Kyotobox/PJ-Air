/// Axioma Security Exceptions & Defensive Contracts (§39 Pure Dart Core)
///
/// Hierarchy of typed exceptions for cryptographic and security verification,
/// including webhook signatures, bearer tokens, secret tokens, and replay attack
/// prevention skew validations (§4, §6).
library;

/// Base exception for all security domain contract violations in Axioma.
abstract class SecurityException implements Exception {
  final String message;
  final String? details;

  const SecurityException(this.message, {this.details});

  @override
  String toString() {
    if (details != null && details!.isNotEmpty) {
      return '$runtimeType: $message ($details)';
    }
    return '$runtimeType: $message';
  }
}

/// Thrown when a cryptographic signature is invalid, corrupted, mismatching,
/// empty, or truncated (§6 Sad Path).
class InvalidSignatureException extends SecurityException {
  /// The received signature or raw header value that failed verification.
  final String? receivedSignature;

  const InvalidSignatureException(
    super.message, {
    this.receivedSignature,
    super.details,
  });
}

/// Thrown when an unsupported hashing or signature algorithm is specified or encountered (§6 Sad Path).
class UnsupportedAlgorithmException extends SecurityException {
  /// The algorithm prefix or identifier detected (e.g. "sha1", "md5").
  final String algorithm;

  const UnsupportedAlgorithmException(
    this.algorithm, {
    String? message,
    super.details,
  }) : super(
         message ??
             'Unsupported signature algorithm: "$algorithm". Expected "sha256".',
       );
}

/// Thrown when a webhook timestamp skew exceeds the allowed tolerance window,
/// indicating an expired payload, potential replay attack, or excessive clock drift (§6 Sad Path).
class TimestampExpiredException extends SecurityException {
  /// The timestamp provided in the request or header.
  final DateTime requestTimestamp;

  /// The reference timestamp (usually UTC now) when validation occurred.
  final DateTime currentTimestamp;

  /// The observed absolute skew in seconds.
  final int skewSeconds;

  /// The maximum allowed skew in seconds.
  final int maxSkewSeconds;

  TimestampExpiredException({
    required this.requestTimestamp,
    required this.currentTimestamp,
    required this.skewSeconds,
    required this.maxSkewSeconds,
    String? message,
    super.details,
  }) : super(
         message ??
             'Timestamp skew ($skewSeconds s) exceeded maximum allowed window ($maxSkewSeconds s). '
                 'Request: ${requestTimestamp.toIso8601String()}, '
                 'Current: ${currentTimestamp.toIso8601String()}.',
       );
}

/// Thrown when an authentication token (Bearer or Secret Token) is missing, malformed, or invalid (§6 Sad Path).
class InvalidTokenException extends SecurityException {
  /// The type of token that failed verification (e.g. "Bearer", "TelegramSecretToken").
  final String tokenType;

  const InvalidTokenException(
    super.message, {
    required this.tokenType,
    super.details,
  });
}

/// Thrown when an expected security header is absent or empty (§6 Sad Path).
class MissingHeaderException extends SecurityException {
  /// The canonical name of the missing header.
  final String headerName;

  MissingHeaderException(this.headerName, {String? message, super.details})
    : super(
        message ??
            'Required security header "$headerName" is missing or empty.',
      );
}
