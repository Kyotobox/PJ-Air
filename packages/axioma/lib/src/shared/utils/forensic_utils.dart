import 'dart:convert';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

/// [G23-01] ForensicUtils: Proveedor de Veracidad Atómica para identidades.
/// Garantiza que los IDs de transacciones sean determinísticos y reproducibles.
class ForensicUtils {
  /// Genera un ID determinístico basado en una semilla de componentes.
  /// El resultado es un hash truncado para legibilidad táctica (16 caracteres).
  static String generateDeterministicId(String prefix, List<dynamic> seed) {
    final StringBuffer buffer = StringBuffer();
    for (var item in seed) {
      buffer.write(item.toString());
      buffer.write('|');
    }

    final Uint8List bytes = utf8.encode(buffer.toString());
    final String hash = sha256.convert(bytes).toString().toUpperCase();

    // Formato: [PREFIX]-[HASH_TRUNCADO]
    final String shortHash = hash.substring(0, 12);
    return '${prefix.toUpperCase()}-$shortHash';
  }

  /// Alias para IDs de transacciones financieras.
  static String generateTransactionId(List<dynamic> seed) =>
      generateDeterministicId('TX', seed);

  /// Alias para IDs de pagos de sueldo.
  static String generateSalaryId(List<dynamic> seed) =>
      generateDeterministicId('SAL', seed);
}
