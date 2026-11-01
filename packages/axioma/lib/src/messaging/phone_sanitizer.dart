/// Pure Dart E.164 International Phone Validator & Sanitizer (§39).
/// Conforms to ITU-T Recommendation E.164 for international telecommunication numbers.
class E164PhoneValidator {
  E164PhoneValidator._();

  static final RegExp _alphaRegex = RegExp(r'[a-zA-Z]');
  static final RegExp _allowedCharsRegex = RegExp(r'^[0-9+\s\-().]+$');
  static final RegExp _nonDigitsRegex = RegExp(r'\D');

  /// Validates and sanitizes a raw phone number into strict E.164 format (e.g., `+584141234567`).
  ///
  /// Throws [FormatException] if the input:
  /// - Is empty or whitespace-only.
  /// - Contains alphabetic or illegal characters.
  /// - Lacks an international country calling code (`+` or `00` prefix).
  /// - Specifies an invalid country code starting with `0`.
  /// - Has fewer than 7 or more than 15 total digits (§6).
  static String sanitize(String rawPhone) {
    final String trimmed = rawPhone.trim();
    if (trimmed.isEmpty) {
      throw const FormatException('Phone number string cannot be empty.');
    }

    // Reject alphabetic characters immediately
    if (_alphaRegex.hasMatch(trimmed)) {
      throw FormatException(
        'Phone number contains forbidden alphabetic characters: "$rawPhone"',
      );
    }

    // Reject unknown symbols outside standard phone formatting characters
    if (!_allowedCharsRegex.hasMatch(trimmed)) {
      throw FormatException(
        'Phone number contains invalid characters: "$rawPhone"',
      );
    }

    // Normalize international prefix '00' to '+'
    String normalized = trimmed;
    if (normalized.startsWith('00')) {
      normalized = '+${normalized.substring(2)}';
    }

    // Must start with '+' to ensure international country code presence
    if (!normalized.startsWith('+')) {
      throw FormatException(
        'Phone number lacks a valid international country calling code (must start with + or 00): "$rawPhone"',
      );
    }

    // Extract digits following the '+'
    final String digits = normalized
        .substring(1)
        .replaceAll(_nonDigitsRegex, '');

    if (digits.isEmpty) {
      throw FormatException(
        'Phone number contains no numeric digits after prefix: "$rawPhone"',
      );
    }

    // ITU-T E.164: Country calling codes cannot start with 0
    if (digits.startsWith('0')) {
      throw FormatException(
        'Invalid country calling code. Country codes cannot start with 0: "$rawPhone"',
      );
    }

    // ITU-T E.164: Maximum 15 digits, minimum 7 digits (e.g., small nations + local number)
    if (digits.length < 7 || digits.length > 15) {
      throw FormatException(
        'E.164 standard requires total length between 7 and 15 digits (received ${digits.length}): "$rawPhone"',
      );
    }

    return '+$digits';
  }

  /// Returns `true` if [rawPhone] represents a valid international number in E.164 notation.
  static bool isValid(String rawPhone) {
    try {
      sanitize(rawPhone);
      return true;
    } catch (_) {
      return false;
    }
  }
}
