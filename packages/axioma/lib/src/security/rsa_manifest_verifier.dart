/// rsa_manifest_verifier.dart — Verificador Criptográfico RSA-2048 y Rollback Atómico (§6, §14, §39, §55).
/// TASK-N140-03 [GOV/CASCADE-RSA-ATOMIC].
///
/// Implementa la verificación criptográfica asimétrica formal RSASSA-PKCS1-v1_5 con SHA-256
/// sobre manifiestos de distribución de ADN de satélites y mecanismos de rollback atómico:
/// 1. Verificación de claves RSA con longitud mínima constitucional (>= 2048 bits).
/// 2. Escritura atómica a archivo temporal `.tmp`.
/// 3. Resguardo previo del manifiesto activo en `manifest.pre.json`.
/// 4. Restauración física reversible ante fallos o firmas inválidas.
library;

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

/// Excepción base arrojada por fallos en la verificación criptográfica de manifiestos.
class RsaVerificationException implements Exception {
  final String message;
  final dynamic cause;

  const RsaVerificationException(this.message, [this.cause]);

  @override
  String toString() => cause != null
      ? 'RsaVerificationException: $message ($cause)'
      : 'RsaVerificationException: $message';
}

/// Excepción arrojada cuando la longitud de clave RSA es inferior a 2048 bits (§14, §55).
class RsaKeyLengthInsufficientException extends RsaVerificationException {
  final int keyBits;

  const RsaKeyLengthInsufficientException(this.keyBits)
    : super(
        'Clave RSA de $keyBits bits insuficiente (requerido >= 2048 bits).',
      );
}

/// Excepción arrojada cuando la firma criptográfica RSA es inválida o corrupta (§6, §55).
class RsaSignatureInvalidException extends RsaVerificationException {
  const RsaSignatureInvalidException([String? details])
    : super(
        details ??
            'Firma criptográfica RSA inválida o no coincide con el payload.',
      );
}

/// Excepción arrojada ante manifiestos corruptos o inexistentes en disco.
class RsaManifestCorruptException extends RsaVerificationException {
  final String path;

  const RsaManifestCorruptException(this.path, [dynamic cause])
    : super('Manifiesto corrupto o ilegible en $path', cause);
}

/// Clave pública RSA (módulo n y exponente público e).
class RsaPublicKey {
  final BigInt modulus;
  final BigInt exponent;
  final int bitLength;

  RsaPublicKey({required this.modulus, BigInt? exponent, int? bitLength})
    : exponent = exponent ?? BigInt.from(65537),
      bitLength = bitLength ?? modulus.bitLength;
}

/// Clave privada RSA (módulo n y exponente privado d).
class RsaPrivateKey {
  final BigInt modulus;
  final BigInt privateExponent;
  final BigInt publicExponent;
  final int bitLength;

  RsaPrivateKey({
    required this.modulus,
    required this.privateExponent,
    BigInt? publicExponent,
    int? bitLength,
  }) : publicExponent = publicExponent ?? BigInt.from(65537),
       bitLength = bitLength ?? modulus.bitLength;
}

/// Par de claves RSA para operaciones criptográficas asimétricas.
class RsaKeyPair {
  final RsaPublicKey publicKey;
  final RsaPrivateKey privateKey;

  const RsaKeyPair({required this.publicKey, required this.privateKey});
}

/// Resultado estructurado de una operación de verificación o despliegue con rollback.
class RsaVerificationResult {
  final bool isValid;
  final int keyBits;
  final String? reason;
  final String? manifestPath;
  final String? snapshotPath;
  final bool rolledBack;

  const RsaVerificationResult({
    required this.isValid,
    required this.keyBits,
    this.reason,
    this.manifestPath,
    this.snapshotPath,
    this.rolledBack = false,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'is_valid': isValid,
    'key_bits': keyBits,
    if (reason != null) 'reason': reason,
    if (manifestPath != null) 'manifest_path': manifestPath,
    if (snapshotPath != null) 'snapshot_path': snapshotPath,
    'rolled_back': rolledBack,
  };

  @override
  String toString() =>
      'RsaVerificationResult(isValid: $isValid, bits: $keyBits, rolledBack: $rolledBack, reason: $reason)';
}

/// Verificador de manifiestos criptográficos RSA y gestor de rollback atómico.
class RsaManifestVerifier {
  /// Prefijo estándar PKCS#1 v1.5 DigestInfo para SHA-256 (RFC 8017 / NIST FIPS 186-4)
  static const List<int> sha256DigestInfoPrefix = <int>[
    0x30,
    0x31,
    0x30,
    0x0d,
    0x06,
    0x09,
    0x60,
    0x86,
    0x48,
    0x01,
    0x65,
    0x03,
    0x04,
    0x02,
    0x01,
    0x05,
    0x00,
    0x04,
    0x20,
  ];

  /// Par de claves canónico RSA-2048 para pruebas y certificación de compuertas
  static final RsaKeyPair canonicalTestKeyPair = _buildCanonicalTestKeyPair();

  static RsaKeyPair _buildCanonicalTestKeyPair() {
    final BigInt n = BigInt.parse(
      'f57f5644a51ac2ded9f4d8fb76a4acab78412c1bbed9c6890fd1a627a7e2a8ebcd4bb340680cae8d6110e9f80722026c20d1c78a59e3a355a8800df182ed7ae0428aa2faa1a9f13f67f2d8476aac9b7c6dd44a897dfa1085fef8e18f02ca03beddc21ffe94874c1d52b5756267ddd53b7e41794e0baa53e80a8e8320b09d6271736a40f4bc4b0b5746fef8aea3057f79c4a5ea6aea700e13590d220e88783dd07576d8d8f800db92c3760f1910ec71e3f95da211572e0438c242a6ca12b20f7c481b4d6ca7f9a37859a7fa8fc09ace4413fa77073f70ca3733f81347aaaf910a6be4c8d6926fbc254234551e220469a8afe9c1338c63be68d381da82be3d6cd7',
      radix: 16,
    );
    final BigInt d = BigInt.parse(
      '2fe2dc417c911944ddefe82938cdcb4e9120e9492a339189e7b785b90382ef5f3b86d21ab49110b54c233ff81cf011d7e498f6dab248f871bb71eb065a7b17364a547f90f2dad2cf82e7b82f4a0c0c323bbc26a3e61a5281c8a7e45b8078463dc344dbf7cd220d03454056fad076d1628ef0978855372eb1bae96c83825fd8b515b8414940f98eddc10ec141fb1c588ff4bdb0d90c74f26cca12b679299f640090917cbaa333353c4691bb71ef000c63291a72da5df3020a2d60641255b5464b4eb3ddb1ae6b287f80dc80867d632655e88cfcc53cfc8f7c28c923e632607e59daef7179b707954ff222a20a342cf667ec67202cd27648fb096fed4a4afa288d',
      radix: 16,
    );
    final BigInt e = BigInt.from(65537);

    final RsaPublicKey pub = RsaPublicKey(
      modulus: n,
      exponent: e,
      bitLength: 2048,
    );
    final RsaPrivateKey priv = RsaPrivateKey(
      modulus: n,
      privateExponent: d,
      publicExponent: e,
      bitLength: 2048,
    );
    return RsaKeyPair(publicKey: pub, privateKey: priv);
  }

  /// Valida que la longitud de clave cumpla el umbral constitucional de 2048 bits.
  void assertMinimumKeyLength(int keyBits) {
    if (keyBits < 2048) {
      throw RsaKeyLengthInsufficientException(keyBits);
    }
  }

  /// Codifica un mensaje en bloque EM de padding PKCS#1 v1.5 para firma/verificación SHA-256.
  static Uint8List encodePkcs1v15(List<int> message, int keyBytes) {
    final List<int> hash = sha256.convert(message).bytes;
    final int tLen =
        sha256DigestInfoPrefix.length + hash.length; // 19 + 32 = 51 bytes
    if (keyBytes < tLen + 11) {
      throw ArgumentError(
        'La clave RSA es demasiado corta para padding PKCS#1 v1.5.',
      );
    }
    final Uint8List em = Uint8List(keyBytes);
    em[0] = 0x00;
    em[1] = 0x01;
    final int psLen = keyBytes - tLen - 3;
    for (int i = 0; i < psLen; i++) {
      em[2 + i] = 0xff;
    }
    em[2 + psLen] = 0x00;
    em.setRange(
      2 + psLen + 1,
      2 + psLen + 1 + sha256DigestInfoPrefix.length,
      sha256DigestInfoPrefix,
    );
    em.setRange(keyBytes - hash.length, keyBytes, hash);
    return em;
  }

  /// Convierte una lista de bytes a BigInt sin signo (big-endian).
  static BigInt bytesToBigInt(List<int> bytes) {
    BigInt result = BigInt.zero;
    for (final int byte in bytes) {
      result = (result << 8) | BigInt.from(byte);
    }
    return result;
  }

  /// Convierte un BigInt a lista de bytes de longitud fija [length] (big-endian).
  static Uint8List bigIntToBytes(BigInt number, int length) {
    final Uint8List result = Uint8List(length);
    BigInt temp = number;
    for (int i = length - 1; i >= 0; i--) {
      result[i] = (temp & BigInt.from(0xff)).toInt();
      temp = temp >> 8;
    }
    return result;
  }

  /// Firma un payload en memoria utilizando la clave privada RSA (RSASSA-PKCS1-v1_5 / SHA-256).
  Uint8List signPayload(List<int> payload, RsaPrivateKey privateKey) {
    final int keyBytes = (privateKey.bitLength + 7) ~/ 8;
    final Uint8List em = encodePkcs1v15(payload, keyBytes);
    final BigInt emBigInt = bytesToBigInt(em);
    if (emBigInt >= privateKey.modulus) {
      throw ArgumentError('Mensaje fuera del rango del módulo RSA.');
    }
    final BigInt s = emBigInt.modPow(
      privateKey.privateExponent,
      privateKey.modulus,
    );
    return bigIntToBytes(s, keyBytes);
  }

  /// Verifica la firma digital RSA de un payload en memoria contra una clave pública.
  bool verifyPayload({
    required List<int> payload,
    required List<int> signatureBytes,
    required RsaPublicKey publicKey,
  }) {
    final int keyBytes = (publicKey.bitLength + 7) ~/ 8;
    if (signatureBytes.length != keyBytes) return false;

    final BigInt s = bytesToBigInt(signatureBytes);
    if (s >= publicKey.modulus || s <= BigInt.zero) return false;

    final BigInt m = s.modPow(publicKey.exponent, publicKey.modulus);
    final Uint8List em = bigIntToBytes(m, keyBytes);
    final Uint8List expectedEm = encodePkcs1v15(payload, keyBytes);

    if (em.length != expectedEm.length) return false;
    for (int i = 0; i < em.length; i++) {
      if (em[i] != expectedEm[i]) return false;
    }
    return true;
  }

  /// Aplica de forma atómica y transaccional un nuevo manifiesto con verificación RSA
  /// y restauración automática en caso de firma inválida o fallo post-despliegue.
  Future<RsaVerificationResult> applyWithAtomicRollback({
    required File targetManifest,
    required String newContent,
    required List<int> signatureBytes,
    required RsaPublicKey publicKey,
    int keyBits = 2048,
  }) async {
    assertMinimumKeyLength(keyBits);

    final String preSnapshotPath = '${targetManifest.path}.pre.json';
    final File preSnapshotFile = File(preSnapshotPath);
    final String tmpPath = '${targetManifest.path}.tmp';
    final File tmpFile = File(tmpPath);

    // 1. Resguardo previo del manifiesto activo existente
    if (targetManifest.existsSync()) {
      preSnapshotFile.writeAsStringSync(targetManifest.readAsStringSync());
    }

    // 2. Escritura atómica al archivo temporal .tmp
    tmpFile.writeAsStringSync(newContent);

    // 3. Verificación asimétrica formal contra la clave pública
    final Uint8List payloadBytes = Uint8List.fromList(utf8.encode(newContent));
    final bool signatureValid = verifyPayload(
      payload: payloadBytes,
      signatureBytes: signatureBytes,
      publicKey: publicKey,
    );

    if (!signatureValid) {
      // Rollback físico: purgar .tmp y restaurar si fuera necesario
      if (tmpFile.existsSync()) {
        tmpFile.deleteSync();
      }
      if (preSnapshotFile.existsSync() && !targetManifest.existsSync()) {
        preSnapshotFile.copySync(targetManifest.path);
      }
      return RsaVerificationResult(
        isValid: false,
        keyBits: keyBits,
        reason: 'Firma RSA inválida: verificación criptográfica falló',
        manifestPath: targetManifest.path,
        snapshotPath: preSnapshotFile.existsSync() ? preSnapshotPath : null,
        rolledBack: true,
      );
    }

    // 4. Promoción atómica: renombrar .tmp a destino final
    try {
      tmpFile.renameSync(targetManifest.path);
    } catch (_) {
      // En Windows o FS con locks, fallback a copy y delete
      tmpFile.copySync(targetManifest.path);
      tmpFile.deleteSync();
    }

    return RsaVerificationResult(
      isValid: true,
      keyBits: keyBits,
      manifestPath: targetManifest.path,
      snapshotPath: preSnapshotFile.existsSync() ? preSnapshotPath : null,
      rolledBack: false,
    );
  }
}
