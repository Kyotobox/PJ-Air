import 'dart:convert';
import 'package:cryptography/cryptography.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

String _base64UrlNoPad(List<int> bytes) {
  return base64UrlEncode(bytes).replaceAll('=', '');
}

Future<String> _buildPtgToken({
  required SimpleKeyPair keyPair,
  String model = 'claude-sonnet-5-5',
  String jti = 'cert-jti-001',
  int? ttlSec,
  bool corruptSignature = false,
}) async {
  final int nowSec = DateTime.now().toUtc().millisecondsSinceEpoch ~/ 1000;
  final int ttl = ttlSec ?? 900;

  final Map<String, String> headerMap = <String, String>{
    'alg': 'EdDSA',
    'typ': 'JWT',
  };
  final Map<String, Object> payloadMap = <String, Object>{
    'iss': 'orchestrator.peda.smart',
    'sub': 'agent:qa-runner',
    'aud': 'claude-key-pool',
    'tier_granted': 2,
    'model_scope': <String>[model],
    'severity': 'S1',
    'justification_ledger_hash':
        '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    'iat': nowSec,
    'exp': nowSec + ttl,
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
    sigBytes[0] = sigBytes[0] ^ 0xAA;
  }

  return '$headerB64.$payloadB64.${_base64UrlNoPad(sigBytes)}';
}

void main() {
  group(
    'TASK-G205-05: Suite Física Integral de Certificación Criptográfica y Resiliencia (§6)',
    () {
      late Ed25519 ed25519;
      late SimpleKeyPair orchestratorKeyPair;
      late List<int> orchestratorPubKeyBytes;
      late PtgTokenVerifier verifier;
      late List<String> telemetryLogs;
      late ClaudeKeyPool claudePool;
      late Database memoryDb;
      late GlobalCircuitBreaker breaker;

      setUp(() async {
        ed25519 = Ed25519();
        orchestratorKeyPair = await ed25519.newKeyPair();
        final SimplePublicKey pubKey = await orchestratorKeyPair
            .extractPublicKey();
        orchestratorPubKeyBytes = pubKey.bytes;

        verifier = PtgTokenVerifier(
          defaultPublicKeyBytes: orchestratorPubKeyBytes,
        );
        telemetryLogs = <String>[];

        claudePool = ClaudeKeyPool(
          keys: <String>['sk-ant-primary-live', 'sk-ant-secondary-live'],
          verifier: verifier,
          auditLogger: (String log) => telemetryLogs.add(log),
        );

        memoryDb = sqlite3.openInMemory();
        breaker = GlobalCircuitBreaker(
          circuitId: 'global_529_cert',
          customDb: memoryDb,
          failureThreshold: 3,
          windowDuration: const Duration(seconds: 10),
        );
        breaker.init();
      });

      tearDown(() {
        breaker.dispose();
      });

      // ═════════════════════════════════════════════════════════════════════════
      // HAPPY PATHS
      // ═════════════════════════════════════════════════════════════════════════
      test(
        'Happy Path 1: Concesión criptográfica legítima de Tier 2 en ClaudeKeyPool',
        () async {
          final String token = await _buildPtgToken(
            keyPair: orchestratorKeyPair,
            model: 'claude-sonnet-5-5',
            jti: 'happy-cert-slot-01',
          );

          final ClaudeSlotGrant grant = await claudePool.acquireSlot(
            requestedModel: 'claude-sonnet-5-5',
            ptgToken: token,
          );

          expect(grant.tier, equals(ClaudeTier.tier2));
          expect(grant.model, equals('claude-sonnet-5-5'));
          expect(grant.isDowngraded, isFalse);
          expect(grant.ptgJti, equals('happy-cert-slot-01'));
          expect(telemetryLogs.length, equals(1));
          expect(telemetryLogs.first, contains('[SECURITY_AUDIT: PTG_GRANT]'));
        },
      );

      test(
        'Happy Path 2: Resiliencia HTTP 529 completa: CLOSED -> OPEN -> HALF_OPEN -> CLOSED',
        () {
          final DateTime t0 = DateTime.utc(2026, 10, 12, 12, 0, 0);

          // 1. Estado inicial nominal
          expect(breaker.getState(now: t0), equals(CircuitState.closed));
          expect(breaker.canExecute(now: t0), isTrue);

          // 2. Acumulación de 3 fallos 529 en 4s
          breaker.recordFailure(529, now: t0);
          breaker.recordFailure(529, now: t0.add(const Duration(seconds: 2)));
          breaker.recordFailure(529, now: t0.add(const Duration(seconds: 4)));

          final DateTime openTime = t0.add(const Duration(seconds: 4));
          final CircuitStateSnapshot openSnapshot = breaker.getSnapshot(
            now: openTime,
          );

          expect(openSnapshot.state, equals(CircuitState.open));
          expect(openSnapshot.failureCount, equals(3));
          expect(breaker.canExecute(now: openTime), isFalse);

          // 3. Transición a HALF_OPEN tras transcurrir retryAfterMs
          final DateTime halfOpenTime = openTime.add(
            Duration(milliseconds: openSnapshot.retryAfterMs + 100),
          );
          expect(
            breaker.getState(now: halfOpenTime),
            equals(CircuitState.halfOpen),
          );
          expect(breaker.canExecute(now: halfOpenTime), isTrue);

          // 4. Sonda exitosa cierra el circuito
          breaker.recordSuccess(now: halfOpenTime);
          expect(
            breaker.getState(now: halfOpenTime),
            equals(CircuitState.closed),
          );
          expect(
            breaker.getSnapshot(now: halfOpenTime).failureCount,
            equals(0),
          );
        },
      );

      // ═════════════════════════════════════════════════════════════════════════
      // SAD PATHS (§6, §16)
      // ═════════════════════════════════════════════════════════════════════════
      test(
        'Sad Path 1: Rechazo estricto ante firma Ed25519 manipulada (tampering)',
        () async {
          final String corruptToken = await _buildPtgToken(
            keyPair: orchestratorKeyPair,
            corruptSignature: true,
            jti: 'tampered-signature-01',
          );

          final PtgTokenValidationResult result = await verifier.validate(
            corruptToken,
          );
          expect(result.isValid, isFalse);
          expect(
            result.reason,
            contains('Firma criptográfica Ed25519 matemáticamente inválida'),
          );
        },
      );

      test(
        'Sad Path 2: Rechazo ante TTL superior al límite constitucional (900s)',
        () async {
          final String illegalTtlToken = await _buildPtgToken(
            keyPair: orchestratorKeyPair,
            ttlSec: 901,
            jti: 'illegal-ttl-01',
          );

          final PtgTokenValidationResult result = await verifier.validate(
            illegalTtlToken,
          );
          expect(result.isValid, isFalse);
          expect(
            result.reason,
            contains('TTL excede el máximo permitido de 15 minutos'),
          );
        },
      );

      test(
        'Sad Path 3: Rechazo ante Replay de nonce jti previamente consumido',
        () async {
          final String token = await _buildPtgToken(
            keyPair: orchestratorKeyPair,
            jti: 'single-use-jti-cert',
          );

          final PtgTokenValidationResult firstUse = await verifier.validate(
            token,
          );
          expect(firstUse.isValid, isTrue);

          final PtgTokenValidationResult secondUse = await verifier.validate(
            token,
          );
          expect(secondUse.isValid, isFalse);
          expect(secondUse.reason, contains('Ataque de Replay detectado'));
        },
      );

      test(
        'Sad Path 4: Fail-Safe Downgrade en ClaudeKeyPool emite telemetría estructurada sin crash',
        () async {
          final ClaudeSlotGrant grant = await claudePool.acquireSlot(
            requestedModel: 'claude-sonnet-5-5',
            ptgToken: 'totally.invalid.token',
          );

          expect(grant.tier, equals(ClaudeTier.tier1));
          expect(grant.model, equals('claude-3-5-haiku'));
          expect(grant.isDowngraded, isTrue);
          expect(grant.downgradeReason, isNotNull);
          expect(telemetryLogs.length, equals(1));
          expect(
            telemetryLogs.first,
            contains('[SECURITY_AUDIT: PTG_DOWNGRADE]'),
          );
        },
      );

      test(
        'Sad Path 5: Bloqueo determinista de requests en estado OPEN con CircuitBreakerOpenException',
        () {
          final DateTime t0 = DateTime.utc(2026, 10, 12, 12, 0, 0);

          breaker.recordFailure(529, now: t0);
          breaker.recordFailure(529, now: t0);
          breaker.recordFailure(529, now: t0);

          expect(
            () => breaker.checkExecutionPermission(now: t0),
            throwsA(isA<CircuitBreakerOpenException>()),
          );
        },
      );

      test(
        'Sad Path 6: Fallo en HALF_OPEN reabre de inmediato el circuito',
        () {
          final DateTime t0 = DateTime.utc(2026, 10, 12, 12, 0, 0);

          breaker.recordFailure(529, now: t0);
          breaker.recordFailure(529, now: t0);
          breaker.recordFailure(529, now: t0);

          final CircuitStateSnapshot snap = breaker.getSnapshot(now: t0);
          final DateTime tHalf = t0.add(
            Duration(milliseconds: snap.retryAfterMs + 100),
          );
          expect(breaker.getState(now: tHalf), equals(CircuitState.halfOpen));

          // Falla la sonda
          breaker.recordFailure(529, now: tHalf);
          expect(breaker.getState(now: tHalf), equals(CircuitState.open));
          expect(breaker.canExecute(now: tHalf), isFalse);
        },
      );
    },
  );
}
