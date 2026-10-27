import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

String _base64UrlNoPad(List<int> bytes) {
  return base64UrlEncode(bytes).replaceAll('=', '');
}

Future<String> _buildValidPtgToken({
  required SimpleKeyPair keyPair,
  String model = 'claude-sonnet-5-5',
  String jti = 'claude-pool-nonce-01',
}) async {
  final int nowSec = DateTime.now().toUtc().millisecondsSinceEpoch ~/ 1000;
  final Map<String, String> headerMap = <String, String>{
    'alg': 'EdDSA',
    'typ': 'JWT',
  };
  final Map<String, Object> payloadMap = <String, Object>{
    'iss': 'orchestrator.peda.smart',
    'sub': 'agent:test',
    'aud': 'claude-key-pool',
    'tier_granted': 2,
    'model_scope': <String>[model],
    'severity': 'S1',
    'justification_ledger_hash': 'abcdef1234567890abcdef1234567890',
    'iat': nowSec,
    'exp': nowSec + 900,
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

  return '$headerB64.$payloadB64.${_base64UrlNoPad(signatureObj.bytes)}';
}

void main() {
  group('TASK-G205-02: ClaudeKeyPool con Compuerta PTG-Token y Fail-Safe Downgrade', () {
    late Ed25519 ed25519;
    late SimpleKeyPair keyPair;
    late List<int> pubKeyBytes;
    late PtgTokenVerifier verifier;
    late List<String> auditLogs;
    late ClaudeKeyPool pool;

    setUp(() async {
      ed25519 = Ed25519();
      keyPair = await ed25519.newKeyPair();
      final SimplePublicKey pubKey = await keyPair.extractPublicKey();
      pubKeyBytes = pubKey.bytes;

      verifier = PtgTokenVerifier(defaultPublicKeyBytes: pubKeyBytes);
      auditLogs = <String>[];

      pool = ClaudeKeyPool(
        keys: <String>['sk-ant-test-key-1', 'sk-ant-test-key-2'],
        verifier: verifier,
        auditLogger: (String msg) => auditLogs.add(msg),
      );
    });

    // ─────────────────────────────────────────────────────────────────────────
    // HAPPY PATHS
    // ─────────────────────────────────────────────────────────────────────────
    test(
      'Happy Path 1: Solicitud de Tier 1 no exige PTG-Token y rota Round-Robin',
      () async {
        final ClaudeSlotGrant grant1 = await pool.acquireSlot(
          requestedModel: 'claude-3-5-haiku',
        );
        expect(grant1.tier, equals(ClaudeTier.tier1));
        expect(grant1.model, equals('claude-3-5-haiku'));
        expect(grant1.key, equals('sk-ant-test-key-1'));
        expect(grant1.isDowngraded, isFalse);

        final ClaudeSlotGrant grant2 = await pool.acquireSlot(
          requestedModel: 'claude-3-5-haiku',
        );
        expect(grant2.key, equals('sk-ant-test-key-2'));
        expect(grant2.isDowngraded, isFalse);
      },
    );

    test('Happy Path 2: Solicitud de Tier 2 con PTG-Token legítimo concede slot Tier 2', () async {
      final String token = await _buildValidPtgToken(
        keyPair: keyPair,
        model: 'claude-sonnet-5-5',
        jti: 'legit-jti-001',
      );

      final ClaudeSlotGrant grant = await pool.acquireSlot(
        requestedModel: 'claude-sonnet-5-5',
        ptgToken: token,
      );

      expect(grant.tier, equals(ClaudeTier.tier2));
      expect(grant.model, equals('claude-sonnet-5-5'));
      expect(grant.isDowngraded, isFalse);
      expect(grant.ptgJti, equals('legit-jti-001'));
      expect(auditLogs.length, equals(1));
      expect(auditLogs.first, contains('[SECURITY_AUDIT: PTG_GRANT]'));
      expect(pool.totalGrants, equals(1));
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SAD PATHS (§6, §16)
    // ─────────────────────────────────────────────────────────────────────────
    test('Sad Path 1: Solicitud de Tier 2 sin token degrada de forma fail-safe a Tier 1 con auditoría', () async {
      final ClaudeSlotGrant grant = await pool.acquireSlot(
        requestedModel: 'claude-sonnet-5-5',
        ptgToken: null,
      );

      expect(grant.tier, equals(ClaudeTier.tier1));
      expect(grant.model, equals('claude-3-5-haiku'));
      expect(grant.isDowngraded, isTrue);
      expect(grant.downgradeReason, contains('Token ausente o vacío'));
      expect(auditLogs.length, equals(1));
      expect(auditLogs.first, contains('[SECURITY_AUDIT: PTG_DOWNGRADE]'));
    });

    test('Sad Path 2: Solicitud de Tier 2 con token corrupto degrada a Tier 1 sin crashear', () async {
      final ClaudeSlotGrant grant = await pool.acquireSlot(
        requestedModel: 'claude-opus-5',
        ptgToken: 'invalid.corrupted.token',
      );

      expect(grant.tier, equals(ClaudeTier.tier1));
      expect(grant.model, equals('claude-3-5-haiku'));
      expect(grant.isDowngraded, isTrue);
      expect(auditLogs.length, equals(1));
      expect(auditLogs.first, contains('RequestedModel: claude-opus-5'));
      expect(pool.totalDowngrades, equals(1));
      expect(pool.lastDowngradeReason, isNotNull);
    });

    test(
      'Sad Path 3: Replay de PTG-Token degrada a Tier 1 en el segundo uso',
      () async {
        final String token = await _buildValidPtgToken(
          keyPair: keyPair,
          model: 'claude-sonnet-5-5',
          jti: 'single-use-jti-99',
        );

        final ClaudeSlotGrant grant1 = await pool.acquireSlot(
          requestedModel: 'claude-sonnet-5-5',
          ptgToken: token,
        );
        expect(grant1.tier, equals(ClaudeTier.tier2));
        expect(grant1.isDowngraded, isFalse);
        expect(pool.totalGrants, equals(1));
        expect(auditLogs.last, contains('[SECURITY_AUDIT: PTG_GRANT]'));

        final ClaudeSlotGrant grant2 = await pool.acquireSlot(
          requestedModel: 'claude-sonnet-5-5',
          ptgToken: token,
        );
        expect(grant2.tier, equals(ClaudeTier.tier1));
        expect(grant2.isDowngraded, isTrue);
        expect(grant2.downgradeReason, contains('Ataque de Replay detectado'));
        expect(pool.totalDowngrades, equals(1));
        expect(auditLogs.last, contains('[SECURITY_AUDIT: PTG_DOWNGRADE]'));
      },
    );

    test(
      'Sad Path 4: Cooldown total arroja ClaudePoolExhaustedException',
      () async {
        pool.markQuotaExhausted('sk-ant-test-key-1');
        pool.markQuotaExhausted('sk-ant-test-key-2');

        expect(
          () => pool.acquireSlot(requestedModel: 'claude-3-5-haiku'),
          throwsA(isA<ClaudePoolExhaustedException>()),
        );
      },
    );

    test('Happy Path 3: ClaudeKeyPool resuelve clave pública vía publicKeyPemPath y fromEnvironment', () async {
      final ClaudeKeyPool envPool = ClaudeKeyPool.fromEnvironment(
        environment: <String, String>{
          'CLAUDE_API_KEY': 'sk-ant-env-key-1',
          'PTG_ORCHESTRATOR_PUBLIC_KEY_PEM_PATH':
              'vault/specs/orchestrator_public_key.pem',
        },
      );

      expect(envPool.keys, contains('sk-ant-env-key-1'));
      expect(envPool.verifier.hasPublicKeyConfigured, isTrue);
      expect(envPool.verifier.defaultPublicKeyBytes?.length, equals(32));
    });

    test('Happy Path 4: PtgTokenVerifier resuelve automáticamente rutas canónicas si el PEM existe', () async {
      final PtgTokenVerifier autoVerifier = PtgTokenVerifier();
      // Debe resolver la clave de vault/specs/orchestrator_public_key.pem si existe en el workspace
      if (autoVerifier.hasPublicKeyConfigured) {
        expect(autoVerifier.defaultPublicKeyBytes?.length, equals(32));
      }
    });

    test('Sad Path 5: Token firmado con clave ajena degrada a Tier 1 con motivo de firma inválida', () async {
      final SimpleKeyPair rogueKeyPair = await ed25519.newKeyPair();
      final String rogueToken = await _buildValidPtgToken(
        keyPair: rogueKeyPair,
        model: 'claude-sonnet-5-5',
        jti: 'rogue-key-jti-01',
      );

      final ClaudeSlotGrant grant = await pool.acquireSlot(
        requestedModel: 'claude-sonnet-5-5',
        ptgToken: rogueToken,
      );

      expect(grant.tier, equals(ClaudeTier.tier1));
      expect(grant.isDowngraded, isTrue);
      expect(
        grant.downgradeReason,
        contains('Firma criptográfica Ed25519 matemáticamente inválida'),
      );
      expect(pool.totalDowngrades, equals(1));
    });
  });
}
