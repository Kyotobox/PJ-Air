// 🎯 Fleet Council Client — Cliente Canónico Pure Dart para el Consejo Federado (§39, §45, §47)
// Implementa candados raíz: Anti-Replay (nonce + timestamp skew), Idempotency-Key y Piso Tier-2 Estricto.

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:crypto/crypto.dart';

/// Excepción base del cliente del Consejo.
abstract class CouncilException implements Exception {
  final String message;
  final dynamic details;

  const CouncilException(this.message, {this.details});

  @override
  String toString() => '$runtimeType: $message';
}

/// Ingress de Automa inalcanzable o partición de red (§45).
class CouncilUnreachableException extends CouncilException {
  const CouncilUnreachableException(super.message, {super.details});
}

/// Principio de Piso Cognitivo: Modelos Tier-2 temporalmente saturados. No se degrada a Tier-1 (§47).
class TierFloorUnmetException extends CouncilException {
  const TierFloorUnmetException(super.message, {super.details});
}

/// Fallo de autenticación, nonce duplicado o skew temporal excesivo (> 120s).
class CouncilSecurityException extends CouncilException {
  const CouncilSecurityException(super.message, {super.details});
}

/// Error de protocolo o payload malformado.
class CouncilProtocolException extends CouncilException {
  const CouncilProtocolException(super.message, {super.details});
}

/// Petición tipada hacia el Consejo.
class CouncilRequest {
  final String sourceNode;
  final String prompt;
  final String system;
  final String idempotencyKey;
  final String? preferredModel;

  CouncilRequest({
    required this.sourceNode,
    required this.prompt,
    this.system = '',
    String? idempotencyKey,
    this.preferredModel,
  }) : idempotencyKey =
           idempotencyKey ?? _generateDefaultIdempotencyKey(sourceNode, prompt);

  static String _generateDefaultIdempotencyKey(
    String sourceNode,
    String prompt,
  ) {
    final int now = DateTime.now().toUtc().millisecondsSinceEpoch;
    final String digest = sha256
        .convert(utf8.encode('$sourceNode:$prompt:$now'))
        .toString()
        .substring(0, 16);
    return 'IDEM-$sourceNode-$digest';
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'source_node': sourceNode,
    'prompt': prompt,
    'system': system,
    'idempotency_key': idempotencyKey,
    if (preferredModel != null) 'preferred_model': preferredModel,
  };
}

/// Dictamen tipado del Consejo con métricas de Verdad Atómica (§47).
class CouncilResponse {
  final String envelopeId;
  final String idempotencyKey;
  final String modelName;
  final String modelTier;
  final String provider;
  final String text;
  final int inputTokens;
  final int outputTokens;
  final double latencyMs;
  final double costUsd;
  final bool isCached;

  const CouncilResponse({
    required this.envelopeId,
    required this.idempotencyKey,
    required this.modelName,
    required this.modelTier,
    required this.provider,
    required this.text,
    required this.inputTokens,
    required this.outputTokens,
    required this.latencyMs,
    required this.costUsd,
    required this.isCached,
  });

  factory CouncilResponse.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> tokens =
        json['tokens'] as Map<String, dynamic>? ?? <String, dynamic>{};
    final Map<String, dynamic> result =
        json['result'] as Map<String, dynamic>? ?? <String, dynamic>{};

    return CouncilResponse(
      envelopeId: json['envelope_id'] as String? ?? 'N/A',
      idempotencyKey: json['idempotency_key'] as String? ?? 'N/A',
      modelName: json['model_name'] as String? ?? 'unknown',
      modelTier: json['model_tier'] as String? ?? 'TIER_2',
      provider: json['provider'] as String? ?? 'UNKNOWN',
      text: result['text'] as String? ?? '',
      inputTokens: (tokens['input'] as num?)?.toInt() ?? 0,
      outputTokens: (tokens['output'] as num?)?.toInt() ?? 0,
      latencyMs: (json['latency_ms'] as num?)?.toDouble() ?? 0.0,
      costUsd: (json['cost_usd'] as num?)?.toDouble() ?? 0.0,
      isCached: json['is_cached'] as bool? ?? false,
    );
  }
}

/// Cliente canónico Pure Dart para el Consejo Federado (§39).
class FleetCouncilClient {
  final Uri endpoint;
  final String? authToken;
  final String? hmacSecret;
  final Duration timeout;
  final HttpClient _httpClient;

  FleetCouncilClient({
    Uri? endpoint,
    String? authToken,
    String? hmacSecret,
    this.timeout = const Duration(seconds: 300),
    HttpClient? httpClient,
  }) : endpoint =
           endpoint ??
           Uri.parse('http://127.0.0.1:8082/api/v1/inference/council'),
       authToken =
           authToken ??
           Platform.environment['QUEUE_INGRESS_TOKEN'] ??
           Platform.environment['AUTOMA_INGRESS_TOKEN'] ??
           'token_de_prueba_fijado_1234567890abcdef',
       hmacSecret =
           hmacSecret ??
           Platform.environment['AUTOMA_COUNCIL_SECRET'] ??
           Platform.environment['QUEUE_HMAC_SECRET'],
       _httpClient = httpClient ?? HttpClient();

  static String _generateNonce() {
    final Random random = Random.secure();
    final List<int> values = List<int>.generate(
      16,
      (int i) => random.nextInt(256),
    );
    return values.map((int b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  /// Despacha una consulta al Consejo y retorna el dictamen sellado con métricas físicas reales.
  Future<CouncilResponse> consult(CouncilRequest request) async {
    final String bodyJson = jsonEncode(request.toJson());
    final List<int> bodyBytes = utf8.encode(bodyJson);

    final String nonce = _generateNonce();
    final String timestampIso = DateTime.now().toUtc().toIso8601String();

    try {
      final HttpClientRequest req = await _httpClient
          .postUrl(endpoint)
          .timeout(timeout);

      // Cabeceras obligatorias de gobernanza y anti-replay
      req.headers.set('Content-Type', 'application/json');
      req.contentLength = bodyBytes.length;
      req.headers.set('X-Timestamp', timestampIso);
      req.headers.set('X-Nonce', nonce);
      req.headers.set('X-Node-ID', request.sourceNode);
      req.headers.set('Idempotency-Key', request.idempotencyKey);

      if (authToken != null && authToken!.isNotEmpty) {
        req.headers.set('Authorization', 'Bearer $authToken');
      }

      if (hmacSecret != null && hmacSecret!.isNotEmpty) {
        final Hmac hmac = Hmac(sha256, utf8.encode(hmacSecret!));
        final Digest digest = hmac.convert(bodyBytes);
        req.headers.set('X-Signature-SHA256', digest.toString());
      }

      req.add(bodyBytes);
      final HttpClientResponse resp = await req.close().timeout(timeout);

      final String responseBody = await utf8.decodeStream(resp);
      final Map<String, dynamic> parsedBody = _safeParseJson(responseBody);

      if (resp.statusCode == 200) {
        return CouncilResponse.fromJson(parsedBody);
      } else if (resp.statusCode == 503 &&
          parsedBody['status'] == 'TIER_FLOOR_UNMET') {
        throw TierFloorUnmetException(
          parsedBody['detail'] as String? ??
              'Piso Cognitivo no disponible. Solicitud retenida.',
          details: parsedBody,
        );
      } else if (resp.statusCode == 401) {
        throw CouncilSecurityException(
          parsedBody['detail'] as String? ??
              'Fallo de autenticación o rechazo por anti-replay.',
          details: parsedBody,
        );
      } else {
        throw CouncilProtocolException(
          'HTTP ${resp.statusCode}: ${parsedBody['detail'] ?? parsedBody['error'] ?? responseBody}',
          details: parsedBody,
        );
      }
    } on SocketException catch (e) {
      throw CouncilUnreachableException(
        'No se pudo conectar con el Ingress del Consejo en $endpoint: $e',
        details: e,
      );
    } on TimeoutException catch (e) {
      throw CouncilUnreachableException(
        'Timeout esperando respuesta del Consejo ($timeout): $e',
        details: e,
      );
    } on CouncilException {
      rethrow;
    } catch (e, st) {
      throw CouncilProtocolException(
        'Error inesperado durante la consulta al Consejo: $e',
        details: st,
      );
    }
  }

  Map<String, dynamic> _safeParseJson(String raw) {
    try {
      final dynamic decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      return <String, dynamic>{'raw': raw};
    } catch (_) {
      return <String, dynamic>{'raw': raw};
    }
  }

  void close() {
    _httpClient.close(force: true);
  }
}
