/// PEDA Tier-Grant Token (PTG-Token) Verifier (SPEC-PTG-TOKEN-01 / TASK-G205-01)
///
/// Implementa la verificación criptográfica Ed25519 para tokens RFC 7519 emitidos
/// por el Orchestrator PEDA de Smart para autorizar cuotas de inferencia Tier 2.
/// Adhiere estrictamente a Pure Dart Core (§39).
library;

import 'dart:convert';
import 'dart:io';
import 'package:cryptography/cryptography.dart';

/// Catálogo canónico de modelos autorizados para Tier 2
const Set<String> kTier2AllowedModels = <String>{
  'claude-sonnet-5-5',
  'claude-opus-5',
  'claude-opus-5-5',
};

/// Resultado estructurado de la validación de un PTG-Token
class PtgTokenValidationResult {
  final bool isValid;
  final String? reason;
  final int tierGranted;
  final List<String> modelScope;
  final String? jti;
  final Map<String, dynamic>? payload;

  const PtgTokenValidationResult({
    required this.isValid,
    this.reason,
    this.tierGranted = 1,
    this.modelScope = const <String>[],
    this.jti,
    this.payload,
  });

  factory PtgTokenValidationResult.success({
    required int tierGranted,
    required List<String> modelScope,
    required String jti,
    required Map<String, dynamic> payload,
  }) {
    return PtgTokenValidationResult(
      isValid: true,
      tierGranted: tierGranted,
      modelScope: modelScope,
      jti: jti,
      payload: payload,
    );
  }

  factory PtgTokenValidationResult.failure(String reason) {
    return PtgTokenValidationResult(
      isValid: false,
      reason: reason,
      tierGranted: 1,
    );
  }

  @override
  String toString() => isValid
      ? '[PTG_TOKEN_VALID] Tier: $tierGranted, Models: $modelScope, JTI: $jti'
      : '[PTG_TOKEN_INVALID] Motivo: $reason';
}

/// Verificador de PTG-Tokens (RFC 7519 / Ed25519)
class PtgTokenVerifier {
  final Ed25519 _ed25519 = Ed25519();
  final Set<String> _consumedNonces = <String>{};
  final List<int>? _defaultPublicKeyBytes;

  /// Rutas canónicas relativas donde reside la clave pública del orchestrator en la flota
  static const List<String> kCandidatePemPaths = <String>[
    'vault/specs/orchestrator_public_key.pem',
  ];

  PtgTokenVerifier({
    List<int>? defaultPublicKeyBytes,
    String? publicKeyPemPath,
    Map<String, String>? environment,
  }) : _defaultPublicKeyBytes =
           defaultPublicKeyBytes ??
           (publicKeyPemPath != null
               ? _loadPublicKeyFromPem(publicKeyPemPath)
               : _resolveDefaultPublicKey(environment: environment));

  /// Clave pública predeterminada en bytes (si fue resuelta)
  List<int>? get defaultPublicKeyBytes => _defaultPublicKeyBytes;

  /// Indica si el verificador tiene una clave pública resuelta y disponible
  bool get hasPublicKeyConfigured =>
      _defaultPublicKeyBytes != null && _defaultPublicKeyBytes.isNotEmpty;

  /// Resuelve la clave pública desde el entorno o rutas canónicas del disco
  static List<int>? _resolveDefaultPublicKey({
    Map<String, String>? environment,
  }) {
    final Map<String, String> env = environment ?? Platform.environment;

    // 1. Contenido PEM crudo en variable de entorno
    final String? pemContent = env['PTG_ORCHESTRATOR_PUBLIC_KEY_PEM'];
    if (pemContent != null && pemContent.trim().isNotEmpty) {
      try {
        return parsePublicKeyPem(pemContent);
      } catch (_) {}
    }

    // 2. Ruta explícita en variable de entorno
    final String? envPath =
        env['PTG_ORCHESTRATOR_PUBLIC_KEY_PEM_PATH'] ??
        env['PTG_ORCHESTRATOR_PUBLIC_KEY_PATH'];
    if (envPath != null && envPath.trim().isNotEmpty) {
      final List<int>? bytes = _loadPublicKeyFromPem(envPath.trim());
      if (bytes != null) return bytes;
    }

    // 3. Fallback a rutas canónicas relativas en el disco
    for (final String candidate in kCandidatePemPaths) {
      final List<int>? bytes = _loadPublicKeyFromPem(candidate);
      if (bytes != null) return bytes;
    }

    return null;
  }

  /// Carga clave pública desde archivo PEM estándar garantizando el confinamiento del búnker.
  /// Si se detecta un intento de Directory Traversal (`..`), lanza [ArgumentError].
  static List<int>? _loadPublicKeyFromPem(String path) {
    if (path.contains('..')) {
      throw ArgumentError.value(
        path,
        'path',
        '[SECURITY_VIOLATION] Directory traversal detectado en ruta PEM: $path',
      );
    }
    try {
      File file = File(path);
      if (!file.existsSync() && !path.startsWith('/')) {
        final String current = Directory.current.path;
        final int pkgIdx = current.indexOf('/packages/');
        if (pkgIdx != -1) {
          final String repoRoot = current.substring(0, pkgIdx);
          final File rootFile = File('$repoRoot/$path');
          if (rootFile.existsSync()) {
            file = rootFile;
          }
        }
      }
      if (!file.existsSync()) {
        return null;
      }
      final String content = file.readAsStringSync();
      return parsePublicKeyPem(content);
    } catch (e) {
      if (e is ArgumentError) rethrow;
      return null;
    }
  }

  /// Parsea el bloque Base64 de un archivo PEM de clave pública Ed25519
  static List<int> parsePublicKeyPem(String pemContent) {
    final String lines = pemContent
        .split(RegExp(r'\r?\n'))
        .where(
          (String l) =>
              l.trim().isNotEmpty &&
              !l.startsWith('-----BEGIN') &&
              !l.startsWith('-----END'),
        )
        .join();
    return base64Decode(lines);
  }

  /// Registra un nonce como consumido
  void markNonceConsumed(String jti) {
    _consumedNonces.add(jti);
  }

  /// Limpia los nonces consumidos (útil para pruebas)
  void resetConsumedNonces() {
    _consumedNonces.clear();
  }

  /// Valida un PTG-Token completo
  Future<PtgTokenValidationResult> validate(
    String? token, {
    List<int>? customPublicKeyBytes,
    DateTime? currentTime,
  }) async {
    if (token == null || token.trim().isEmpty) {
      return PtgTokenValidationResult.failure('Token ausente o vacío');
    }

    final List<String> parts = token.trim().split('.');
    if (parts.length != 3) {
      return PtgTokenValidationResult.failure(
        'Estructura JWT inválida: se esperaban 3 segmentos Base64URL, recibidos ${parts.length}',
      );
    }

    final String headerB64 = parts[0];
    final String payloadB64 = parts[1];
    final String signatureB64 = parts[2];

    Map<String, dynamic> header;
    Map<String, dynamic> payload;
    List<int> signatureBytes;

    try {
      final String headerJsonStr = utf8.decode(_base64UrlDecode(headerB64));
      header = jsonDecode(headerJsonStr) as Map<String, dynamic>;
    } catch (e) {
      return PtgTokenValidationResult.failure('Header no es JSON válido: $e');
    }

    try {
      final String payloadJsonStr = utf8.decode(_base64UrlDecode(payloadB64));
      payload = jsonDecode(payloadJsonStr) as Map<String, dynamic>;
    } catch (e) {
      return PtgTokenValidationResult.failure('Payload no es JSON válido: $e');
    }

    try {
      signatureBytes = _base64UrlDecode(signatureB64);
    } catch (e) {
      return PtgTokenValidationResult.failure('Firma Base64URL corrupta: $e');
    }

    // 1. Validar Header
    if (header['alg'] != 'EdDSA') {
      return PtgTokenValidationResult.failure(
        "Algoritmo no soportado: '${header['alg']}' (se requiere 'EdDSA')",
      );
    }
    if (header['typ'] != 'JWT') {
      return PtgTokenValidationResult.failure(
        "Tipo de token no soportado: '${header['typ']}' (se requiere 'JWT')",
      );
    }

    // 2. Validar Claims Estáticos
    if (payload['iss'] != 'orchestrator.peda.smart') {
      return PtgTokenValidationResult.failure(
        "Emisor inválido: '${payload['iss']}' (se requiere 'orchestrator.peda.smart')",
      );
    }
    if (payload['aud'] != 'claude-key-pool') {
      return PtgTokenValidationResult.failure(
        "Audiencia inválida: '${payload['aud']}' (se requiere 'claude-key-pool')",
      );
    }

    final Object? tierGranted = payload['tier_granted'];
    if (tierGranted != 2) {
      return PtgTokenValidationResult.failure(
        'tier_granted debe ser 2 para slots Tier 2, recibido: $tierGranted',
      );
    }

    // 3. Validar Model Scope
    final Object? modelScopeRaw = payload['model_scope'];
    if (modelScopeRaw is! List) {
      return PtgTokenValidationResult.failure(
        'model_scope debe ser una lista de modelos autorizados',
      );
    }
    final List<String> modelScope = modelScopeRaw
        .map((dynamic e) => e.toString())
        .toList();
    for (final String model in modelScope) {
      if (!kTier2AllowedModels.contains(model)) {
        return PtgTokenValidationResult.failure(
          "Modelo '$model' no pertenece al catálogo de Tier 2 permitido ($kTier2AllowedModels)",
        );
      }
    }

    // 4. Validar Tiempos (iat, exp)
    final Object? iat = payload['iat'];
    final Object? exp = payload['exp'];
    if (iat is! int || exp is! int) {
      return PtgTokenValidationResult.failure(
        'iat y exp deben ser enteros (epoch seconds)',
      );
    }

    final int ttl = exp - iat;
    if (ttl > 900) {
      return PtgTokenValidationResult.failure(
        'TTL excede el máximo permitido de 15 minutos (900s): $ttl s',
      );
    }
    if (ttl <= 0) {
      return PtgTokenValidationResult.failure(
        'exp debe ser estrictamente posterior a iat',
      );
    }

    final int nowSec =
        (currentTime ?? DateTime.now().toUtc()).millisecondsSinceEpoch ~/ 1000;

    // Permitir 60s de skew para iat en el futuro
    if (nowSec < (iat - 60)) {
      return PtgTokenValidationResult.failure(
        'Token emitido en el futuro (iat: $iat, now: $nowSec)',
      );
    }

    if (nowSec > exp) {
      return PtgTokenValidationResult.failure(
        'Token expirado (exp: $exp, now: $nowSec)',
      );
    }

    // 5. Validar Replay de JTI
    final String? jti = payload['jti']?.toString();
    if (jti == null || jti.isEmpty) {
      return PtgTokenValidationResult.failure('Claim jti ausente o vacío');
    }

    if (_consumedNonces.contains(jti)) {
      return PtgTokenValidationResult.failure(
        'Ataque de Replay detectado: nonce jti ya fue consumido ($jti)',
      );
    }

    // 6. Verificar Firma Criptográfica Ed25519
    final List<int>? pubBytes = customPublicKeyBytes ?? _defaultPublicKeyBytes;
    if (pubBytes == null || pubBytes.isEmpty) {
      return PtgTokenValidationResult.failure(
        'Clave pública de Orchestrator no configurada ni disponible',
      );
    }

    final String signingInput = '$headerB64.$payloadB64';
    final SimplePublicKey publicKey = SimplePublicKey(
      pubBytes,
      type: KeyPairType.ed25519,
    );
    final Signature signature = Signature(signatureBytes, publicKey: publicKey);

    try {
      final bool isSignatureValid = await _ed25519.verify(
        utf8.encode(signingInput),
        signature: signature,
      );

      if (!isSignatureValid) {
        return PtgTokenValidationResult.failure(
          'Firma criptográfica Ed25519 matemáticamente inválida',
        );
      }
    } catch (e) {
      return PtgTokenValidationResult.failure(
        'Error durante la verificación matemática de firma: $e',
      );
    }

    // Registrar nonce consumido
    _consumedNonces.add(jti);

    return PtgTokenValidationResult.success(
      tierGranted: 2,
      modelScope: modelScope,
      jti: jti,
      payload: payload,
    );
  }

  static List<int> _base64UrlDecode(String str) {
    String normalized = str.replaceAll('-', '+').replaceAll('_', '/');
    while (normalized.length % 4 != 0) {
      normalized += '=';
    }
    return base64Decode(normalized);
  }
}
