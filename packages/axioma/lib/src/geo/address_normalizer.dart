/// Pure Dart Address Normalizer for canonical address sanitation (§39).
///
/// Removes escape characters, collapses extra whitespace, strips unprintable control
/// characters and converts into canonical uppercase format.
class AddressNormalizer {
  AddressNormalizer._();

  static final RegExp _controlCharsRegex = RegExp(r'[\x00-\x1F\x7F]');
  static final RegExp _literalEscapeRegex = RegExp(r'\\[nrtbfv0\\]');
  static final RegExp _escapeCharsRegex = RegExp(r'[\r\n\t\b\f\v]');
  static final RegExp _multipleWhitespaceRegex = RegExp(r'\s+');

  /// Normalizes an address string into canonical form.
  ///
  /// Throws [ArgumentError] if [address] is empty or whitespace-only (§6).
  static String normalize(String address) {
    if (address.trim().isEmpty) {
      throw ArgumentError.value(
        address,
        'address',
        'Address string cannot be empty or whitespace-only.',
      );
    }

    // 1. Remove literal escape sequences like \n, \t, \r if present as text
    String cleaned = address.replaceAll(_literalEscapeRegex, ' ');

    // 2. Remove actual whitespace escape characters
    cleaned = cleaned.replaceAll(_escapeCharsRegex, ' ');

    // 3. Remove control characters
    cleaned = cleaned.replaceAll(_controlCharsRegex, '');

    // 4. Remove any remaining stray backslashes
    cleaned = cleaned.replaceAll('\\', ' ');

    // 5. Collapse multiple spaces and trim edges
    cleaned = cleaned.replaceAll(_multipleWhitespaceRegex, ' ').trim();

    if (cleaned.isEmpty) {
      throw ArgumentError.value(
        address,
        'address',
        'Address string contains no valid printable characters.',
      );
    }

    // 6. Return uppercase canonical representation
    return cleaned.toUpperCase();
  }
}
