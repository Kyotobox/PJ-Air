/// OemCleaner — Normalización Comercial y Determinista de Códigos OEM.
/// Promovido al paquete compartido Axioma (Shared Kernel).
class OemCleaner {
  /// Clean an OEM reference deterministically by normalizing case and
  /// removing non-alphanumeric punctuation (hyphens, dots, spaces, slashes, underscores),
  /// preserving leading zeros and alphanumeric characters.
  static String clean(String? oemRef) {
    if (oemRef == null || oemRef.trim().isEmpty) return '';
    final String cleaned = oemRef.toUpperCase().replaceAll(
      RegExp(r'[^A-Z0-9]'),
      '',
    );
    return cleaned;
  }

  /// Clean OEM reference and validate minimum length (at least 3 characters).
  /// Returns empty string if invalid or too short.
  static String cleanWithValidation(String? oemRef, {int minLength = 3}) {
    final String cleaned = clean(oemRef);
    if (cleaned.length < minLength) return '';
    return cleaned;
  }

  /// Check if two OEM references match deterministically.
  static bool isMatch(String? oemA, String? oemB) {
    final String cleanA = clean(oemA);
    final String cleanB = clean(oemB);
    if (cleanA.isEmpty || cleanB.isEmpty) return false;
    return cleanA == cleanB;
  }
}
