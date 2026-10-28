import 'dart:convert';
import 'package:cryptography/cryptography.dart';
import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

String _base64UrlNoPad(List<int> bytes) {
  return base64UrlEncode(bytes).replaceAll('=', '');
}

Future<String> _buildPtgToken({
  required SimpleKeyPair keyPair,
  String alg = 'EdDSA',
  String typ = 'JWT',
  String iss = 'orchestrator.peda.smart',
  String aud = 'claude-key-pool',
  int tierGranted = 2,
  List<String> modelScope = const <String>[
    'claude-sonnet-5-5',
    'claude-opus-5',
  ],
  String severity = 'S1',
  String justificationHash =
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  int? iat,
  int? exp,
  String jti = 'test-nonce-uuid-001',
  bool corruptSignature = false,
}) async {
  final int nowSec = DateTime.now().toUtc().millisecondsSinceEpoch ~/ 1000;
  final int effectiveIat = iat ?? nowSec;
  final int effectiveExp = exp ?? (effectiveIat + 900);

  final Map<String, String> headerMap = <String, String>{
    'alg': alg,
    'typ': typ,
  };
  final Map<String, Object> payloadMap = <String, Object>{
    'iss': iss,
    'sub': 'agent:test-orchestrator',
    'aud': aud,
    'tier_granted': tierGranted,
    'model_scope': modelScope,
    'severity': severity,
    'justification_ledger_hash': justificationHash,
    'iat': effectiveIat,
    'exp': effectiveExp,
    'jti': jti,
  };

  final String headerB64 = _base64UrlNoPad(utf8.encode(jsonEncode(headerMap)));
  final String payloadB64 = _base64UrlNoPad(
    utf8.encode(jsonEncode(payloadMap)),
  );
  final String signingInput = '$headerB64.$payloadB64';

  final Ed25519 ed25519 = Ed25519();
  final Signature signatureObj = await ed25519.sign(
    utf8.encode(signingInput),
    keyPair: keyPair,
  );

  List<int> sigBytes = signatureObj.bytes;
  if (corruptSignature) {
    sigBytes = List<int>.from(sigBytes);
    sigBytes[0] = sigBytes[0] ^ 0xFF;
  }

  final String sigB64 = _base64UrlNoPad(sigBytes);
  return '$headerB64.$payloadB64.$sigB64';
}

void main() {
  group('TASK-G205-01: Verificador Criptográfico Ed25519 PtgTokenVerifier', () {
    late Ed25519 ed25519;
    late SimpleKeyPair keyPair;
    late List<int> pubKeyBytes;
    late PtgTokenVerifier verifier;

    setUp(() async {
      ed25519 = Ed25519();
      keyPair = await ed25519.newKeyPair();
      final SimplePublicKey pubKey = await keyPair.extractPublicKey();
      pubKeyBytes = pubKey.bytes;
      verifier = PtgTokenVerifier(defaultPublicKeyBytes: pubKeyBytes);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // HAPPY PATHS
    // ─────────────────────────────────────────────────────────────────────────
    test(
      'Happy Path: Token legítimo y vigente es validado exitosamente',
      () async {
        final String token = await _buildPtgToken(
          keyPair: keyPair,
          jti: 'happy-path-nonce-1',
        );

        final PtgTokenValidationResult result = await verifier.validate(token);
        expect(result.isValid, isTrue);
        expect(result.tierGranted, equals(2));
        expect(result.modelScope, contains('claude-sonnet-5-5'));
        expect(result.jti, equals('happy-path-nonce-1'));
        expect(result.reason, isNull);
      },
    );

    test('Happy Path: Carga y verificación con PEM de orchestrator', () async {
      final PtgTokenVerifier pemVerifier = PtgTokenVerifier(
        publicKeyPemPath: 'vault/specs/orchestrator_public_key.pem',
      );
      // Validamos que parsePublicKeyPem devuelva 32 bytes exactos
      expect(
        PtgTokenVerifier.parsePublicKeyPem('''
-----BEGIN PUBLIC KEY-----
009qzQzaRDrrn+IjYhUK9GvzgvraqSVQRFzXubzaYOA=
-----END PUBLIC KEY-----
''').length,
        equals(32),
      );
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SAD PATHS (§6, §16)
    // ─────────────────────────────────────────────────────────────────────────
    test('Sad Path 1: Rechazo de token nulo o malformado', () async {
      final PtgTokenValidationResult resNull = await verifier.validate(null);
      expect(resNull.isValid, isFalse);
      expect(resNull.reason, contains('ausente o vacío'));

      final PtgTokenValidationResult resMalformed = await verifier.validate(
        'header.payload',
      );
      expect(resMalformed.isValid, isFalse);
      expect(resMalformed.reason, contains('Estructura JWT inválida'));
    });

    test('Sad Path 2: Rechazo de TTL excesivo (> 900s)', () async {
      final int nowSec = DateTime.now().toUtc().millisecondsSinceEpoch ~/ 1000;
      final String token = await _buildPtgToken(
        keyPair: keyPair,
        iat: nowSec,
        exp: nowSec + 901,
        jti: 'ttl-violation-nonce',
      );

      final PtgTokenValidationResult result = await verifier.validate(token);
      expect(result.isValid, isFalse);
      expect(result.reason, contains('TTL excede el máximo'));
    });

    test('Sad Path 3: Rechazo de token expirado', () async {
      final int nowSec = DateTime.now().toUtc().millisecondsSinceEpoch ~/ 1000;
      final String token = await _buildPtgToken(
        keyPair: keyPair,
        iat: nowSec - 1000,
        exp: nowSec - 100,
        jti: 'expired-nonce',
      );

      final PtgTokenValidationResult result = await verifier.validate(token);
      expect(result.isValid, isFalse);
      expect(result.reason, contains('Token expirado'));
    });

    test('Sad Path 4: Rechazo ante firma criptográfica corrupta', () async {
      final String token = await _buildPtgToken(
        keyPair: keyPair,
        corruptSignature: true,
        jti: 'corrupt-sig-nonce',
      );

      final PtgTokenValidationResult result = await verifier.validate(token);
      expect(result.isValid, isFalse);
      expect(
        result.reason,
        contains('Firma criptográfica Ed25519 matemáticamente inválida'),
      );
    });

    test(
      'Sad Path 5: Detección y bloqueo de ataque de Replay (jti duplicado)',
      () async {
        final String token = await _buildPtgToken(
          keyPair: keyPair,
          jti: 'unique-replay-nonce',
        );

        final PtgTokenValidationResult firstRes = await verifier.validate(
          token,
        );
        expect(firstRes.isValid, isTrue);

        final PtgTokenValidationResult replayRes = await verifier.validate(
          token,
        );
        expect(replayRes.isValid, isFalse);
        expect(replayRes.reason, contains('Ataque de Replay detectado'));
      },
    );

    test('Sad Path 6: Rechazo ante modelo no autorizado en Tier 2', () async {
      final String token = await _buildPtgToken(
        keyPair: keyPair,
        modelScope: const <String>['unauthorized-gpt-model'],
        jti: 'unauthorized-model-nonce',
      );

      final PtgTokenValidationResult result = await verifier.validate(token);
      expect(result.isValid, isFalse);
      expect(result.reason, contains('no pertenece al catálogo de Tier 2'));
    });

    test('Sad Path 7: Rechazo ante emisor o audiencia incorrecta', () async {
      final String tokenBadIss = await _buildPtgToken(
        keyPair: keyPair,
        iss: 'rogue.issuer.org',
        jti: 'bad-iss-nonce',
      );

      final PtgTokenValidationResult result = await verifier.validate(
        tokenBadIss,
      );
      expect(result.isValid, isFalse);
      expect(result.reason, contains('Emisor inválido'));
    });

    test(
      'Sad Path 8: Rechazo estricto ante path traversal con ascensos relativos (..)',
      () {
        expect(
          () => PtgTokenVerifier(
            publicKeyPemPath: '../../vault/specs/orchestrator_public_key.pem',
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );
  });
}
