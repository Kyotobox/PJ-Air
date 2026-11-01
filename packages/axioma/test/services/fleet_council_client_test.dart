// 🎯 Pruebas Físicas para FleetCouncilClient — SPRINT N30 (TASK-N30-03)
// Conforme a: §4 Zero Mocks (HttpServer real en loopback), §6 Sad Paths, §39 Pure Dart, §45 Offline, §47 Verdad Atómica.

import 'dart:convert';
import 'dart:io';
import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('FleetCouncilClient — Pruebas Físicas Pure Dart (§4, §6, §39)', () {
    late HttpServer mockServer;
    late int serverPort;
    late FleetCouncilClient client;

    setUp(() async {
      // Iniciar servidor HTTP real en loopback (Zero Mocks §4)
      mockServer = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      serverPort = mockServer.port;
      client = FleetCouncilClient(
        endpoint: Uri.parse(
          'http://127.0.0.1:$serverPort/api/v1/inference/council',
        ),
        authToken: 'secret-token-test',
        hmacSecret: 'hmac-secret-test',
      );
    });

    tearDown(() async {
      client.close();
      await mockServer.close(force: true);
    });

    test(
      'Happy Path: Despacho exitoso con cabeceras anti-replay, HMAC y respuesta tipada',
      () async {
        // Configurar servidor loopback para verificar cabeceras físicas y responder 200
        mockServer.listen((HttpRequest request) async {
          expect(request.method, equals('POST'));
          expect(request.uri.path, equals('/api/v1/inference/council'));

          // Verificar presencia física de cabeceras de gobernanza
          expect(request.headers.value('X-Timestamp'), isNotNull);
          expect(request.headers.value('X-Nonce'), isNotNull);
          expect(request.headers.value('X-Node-ID'), equals('ruedas'));
          expect(
            request.headers.value('Idempotency-Key'),
            equals('IDEM-RUEDAS-001'),
          );
          expect(
            request.headers.value('Authorization'),
            equals('Bearer secret-token-test'),
          );
          expect(request.headers.value('X-Signature-SHA256'), isNotNull);

          final String body = await utf8.decodeStream(request);
          final Map<String, dynamic> jsonBody =
              jsonDecode(body) as Map<String, dynamic>;
          expect(jsonBody['prompt'], equals('Validar consistencia de estados'));

          final Map<String, dynamic> fakeResponse = <String, dynamic>{
            'status': 'SUCCESS',
            'envelope_id': 'ENV-999',
            'idempotency_key': 'IDEM-RUEDAS-001',
            'is_cached': false,
            'model_name': 'claude-sonnet-5-5',
            'model_tier': 'TIER_2',
            'provider': 'ANTHROPIC',
            'tokens': <String, dynamic>{'input': 1500, 'output': 400},
            'latency_ms': 1200.5,
            'cost_usd': 0.007,
            'result': <String, dynamic>{
              'text': 'Dictamen aprobado con aislamiento serializable.',
            },
          };

          request.response
            ..statusCode = 200
            ..headers.contentType = ContentType.json
            ..write(jsonEncode(fakeResponse));
          await request.response.close();
        });

        final CouncilRequest req = CouncilRequest(
          sourceNode: 'ruedas',
          prompt: 'Validar consistencia de estados',
          system: 'Eres el Consejo',
          idempotencyKey: 'IDEM-RUEDAS-001',
        );

        final CouncilResponse resp = await client.consult(req);

        expect(resp.envelopeId, equals('ENV-999'));
        expect(resp.modelName, equals('claude-sonnet-5-5'));
        expect(resp.modelTier, equals('TIER_2'));
        expect(resp.provider, equals('ANTHROPIC'));
        expect(resp.inputTokens, equals(1500));
        expect(resp.outputTokens, equals(400));
        expect(resp.latencyMs, equals(1200.5));
        expect(resp.costUsd, equals(0.007));
        expect(resp.text, contains('Dictamen aprobado'));
      },
    );

    test(
      'Sad Path 1: Principio de Piso Cognitivo — lanza TierFloorUnmetException ante 503 (§47)',
      () async {
        mockServer.listen((HttpRequest request) async {
          final Map<String, dynamic> errorResponse = <String, dynamic>{
            'status': 'TIER_FLOOR_UNMET',
            'envelope_id': 'ENV-ERR',
            'detail':
                'Principio de Piso Cognitivo: Modelos Tier-2 temporalmente saturados. Solicitud retenida.',
          };
          request.response
            ..statusCode = 503
            ..headers.contentType = ContentType.json
            ..write(jsonEncode(errorResponse));
          await request.response.close();
        });

        final CouncilRequest req = CouncilRequest(
          sourceNode: 'studio',
          prompt: 'Planificar refactorización',
        );

        expect(
          () => client.consult(req),
          throwsA(
            isA<TierFloorUnmetException>().having(
              (TierFloorUnmetException e) => e.message,
              'message',
              contains('Piso Cognitivo'),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path 2: Rechazo por Anti-Replay o Autenticación — lanza CouncilSecurityException ante 401',
      () async {
        mockServer.listen((HttpRequest request) async {
          final Map<String, dynamic> secResponse = <String, dynamic>{
            'error': 'Unauthorized',
            'detail':
                'Ataque de repetición detectado: Nonce ya utilizado previamente.',
          };
          request.response
            ..statusCode = 401
            ..headers.contentType = ContentType.json
            ..write(jsonEncode(secResponse));
          await request.response.close();
        });

        final CouncilRequest req = CouncilRequest(
          sourceNode: 'praxis',
          prompt: 'test',
        );

        expect(
          () => client.consult(req),
          throwsA(
            isA<CouncilSecurityException>().having(
              (CouncilSecurityException e) => e.message,
              'message',
              contains('repetición'),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path 3: Servidor inalcanzable (puerto cerrado) — lanza CouncilUnreachableException (§45)',
      () async {
        // Cerrar servidor para simular partición de red
        await mockServer.close(force: true);

        final CouncilRequest req = CouncilRequest(
          sourceNode: 'ruedas',
          prompt: 'test offline',
        );

        expect(
          () => client.consult(req),
          throwsA(isA<CouncilUnreachableException>()),
        );
      },
    );

    test(
      'Sad Path 4: Respuesta con JSON malformado — lanza CouncilProtocolException',
      () async {
        mockServer.listen((HttpRequest request) async {
          request.response
            ..statusCode = 500
            ..headers.contentType = ContentType.text
            ..write('INTERNAL SERVER CRASH - NON JSON');
          await request.response.close();
        });

        final CouncilRequest req = CouncilRequest(
          sourceNode: 'ruedas',
          prompt: 'test protocol',
        );

        expect(
          () => client.consult(req),
          throwsA(isA<CouncilProtocolException>()),
        );
      },
    );
  });
}
