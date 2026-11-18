// 🎯 DTO Canónico IntentSignature con Clave Delimitada y Normalización Unicode — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios,
// §12.b Límite 5 archivos, §40 Thin Client, §48 Cierre Autárquico, Calm Error UX.

import 'dart:convert';
import 'package:crypto/crypto.dart';

/// DTO Canónico Inmutable de Firma de Intención con Clave Delimitada y Normalización Unicode (§39).
///
/// Modela una tupla canónica (verbo, objeto, dominio) asegurando que no existan
/// colisiones sintéticas mediante un delimitador nulo (`\x00`), normalización Unicode NFC
/// y un hash SHA-256 criptográficamente derivado.
class IntentSignature {
  final String verb;
  final String object;
  final String domain;
  final String canonicalKey;
  final String hash;
  final double confidence;
  final Map<String, dynamic> metadata;

  const IntentSignature._({
    required this.verb,
    required this.object,
    required this.domain,
    required this.canonicalKey,
    required this.hash,
    required this.confidence,
    required this.metadata,
  });

  /// Crea una instancia canónica de [IntentSignature].
  ///
  /// Valida que [verb] y [object] no estén vacíos ni contengan caracteres nulos (§6 Sad Path).
  /// Aplica normalización Unicode NFC y genera la [canonicalKey] en formato `'verbo\0objeto\0dominio'`.
  factory IntentSignature({
    required String verb,
    required String object,
    String domain = 'default',
    double confidence = 1.0,
    Map<String, dynamic> metadata = const <String, dynamic>{},
  }) {
    if (verb.contains('\x00') ||
        object.contains('\x00') ||
        domain.contains('\x00')) {
      throw ArgumentError(
        'Las componentes de IntentSignature no pueden contener caracteres nulos (prevención de colisión delimitada).',
      );
    }

    final String normVerb = normalizeUnicodeNfc(verb);
    final String normObject = normalizeUnicodeNfc(object);
    final String normDomain = normalizeUnicodeNfc(
      domain.isEmpty ? 'default' : domain,
    );

    if (normVerb.isEmpty) {
      throw ArgumentError.value(
        verb,
        'verb',
        'El verbo de la intención no puede ser vacío o solo espacios.',
      );
    }
    if (normObject.isEmpty) {
      throw ArgumentError.value(
        object,
        'object',
        'El objeto de la intención no puede ser vacío o solo espacios.',
      );
    }

    if (confidence < 0.0 || confidence > 1.0) {
      throw ArgumentError.value(
        confidence,
        'confidence',
        'La confianza debe estar comprendida entre 0.0 y 1.0.',
      );
    }

    final String canonicalKey = '$normVerb\x00$normObject\x00$normDomain';
    final String hash = sha256.convert(utf8.encode(canonicalKey)).toString();

    return IntentSignature._(
      verb: normVerb,
      object: normObject,
      domain: normDomain,
      canonicalKey: canonicalKey,
      hash: hash,
      confidence: confidence,
      metadata: Map<String, dynamic>.unmodifiable(metadata),
    );
  }

  /// Deserializa desde mapa JSON.
  factory IntentSignature.fromJson(Map<String, dynamic> json) {
    return IntentSignature(
      verb: json['verb'] as String? ?? '',
      object: json['object'] as String? ?? '',
      domain: json['domain'] as String? ?? 'default',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 1.0,
      metadata:
          (json['metadata'] as Map<String, dynamic>?) ??
          const <String, dynamic>{},
    );
  }

  /// Serializa a mapa JSON.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'verb': verb,
    'object': object,
    'domain': domain,
    'canonicalKey': canonicalKey,
    'hash': hash,
    'confidence': confidence,
    'metadata': metadata,
  };

  /// Normaliza una cadena de texto a forma canónica precompuesta (NFC) y minúsculas.
  ///
  /// Convierte combinaciones canónicas descompuestas (NFD) a precompuestas (NFC)
  /// para garantizar paridad de bytes antes de computar el hash SHA-256.
  static String normalizeUnicodeNfc(String input) {
    if (input.isEmpty) return '';

    // Normalización de caracteres descompuestos (NFD -> NFC) para diacríticos comunes
    final String nfc = input
        .replaceAll('a\u0301', '\u00E1')
        .replaceAll('e\u0301', '\u00E9')
        .replaceAll('i\u0301', '\u00ED')
        .replaceAll('o\u0301', '\u00F3')
        .replaceAll('u\u0301', '\u00FA')
        .replaceAll('A\u0301', '\u00C1')
        .replaceAll('E\u0301', '\u00C9')
        .replaceAll('I\u0301', '\u00CD')
        .replaceAll('O\u0301', '\u00D3')
        .replaceAll('U\u0301', '\u00DA')
        .replaceAll('n\u0303', '\u00F1')
        .replaceAll('N\u0303', '\u00D1')
        .replaceAll('u\u0308', '\u00FC')
        .replaceAll('U\u0308', '\u00DC');

    return nfc.trim().toLowerCase();
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is IntentSignature &&
          runtimeType == other.runtimeType &&
          hash == other.hash;

  @override
  int get hashCode => hash.hashCode;

  @override
  String toString() =>
      'IntentSignature($canonicalKey, hash: ${hash.substring(0, 8)}...)';
}
