/// token_telemetry_extractor.dart — Extractor Pure Dart de Telemetría Real de Tokens (§4, §6, §39, §47, §50, §60.2, §60.7).
///
/// Extrae métricas de consumo de tokens físicos (input_tokens, cache_read_tokens, output_tokens)
/// directamente de los eventos PLANNER_RESPONSE en transcripts de Antigravity / Gemini / Claude.
///
/// Erradica la heurística de bytes crudos del odómetro MCCV v2 y habilita el cálculo
/// matemático canónico del MCCV v3.
library;

import 'dart:convert';
import 'dart:io';

import 'odometer_exceptions.dart';
export 'odometer_exceptions.dart' show TokenTelemetryUnavailableException;

/// Instantánea inmutable de métricas físicas de tokens extraídas de una sesión.
class TokenTelemetrySnapshot {
  /// Tokens de prompt no almacenados en caché del último evento PLANNER_RESPONSE.
  final int latestInputTokens;

  /// Tokens de prompt recuperados del contexto en caché del último evento.
  final int latestCacheReadTokens;

  /// Tokens generados en la última respuesta del modelo.
  final int latestOutputTokens;

  /// Tokens activos actuales en la ventana del modelo (input + cache_read).
  int get currentContextTokens => latestInputTokens + latestCacheReadTokens;

  /// Suma acumulada de input_tokens a lo largo de toda la sesión.
  final int cumulativeInputTokens;

  /// Suma acumulada de cache_read_tokens a lo largo de toda la sesión.
  final int cumulativeCacheReadTokens;

  /// Suma acumulada de output_tokens a lo largo de toda la sesión.
  final int cumulativeOutputTokens;

  /// Identificador canónico del modelo del último evento (ej. 'gemini-3.8-flash-high').
  final String? model;

  /// Cantidad de eventos PLANNER_RESPONSE procesados exitosamente.
  final int plannerResponsesCount;

  /// Cantidad de líneas malformadas o corruptas ignoradas defensivamente.
  final int malformedLinesCount;

  /// Indica si la sesión contiene telemetría real válida (> 0 eventos).
  bool get hasTelemetry => plannerResponsesCount > 0;

  const TokenTelemetrySnapshot({
    required this.latestInputTokens,
    required this.latestCacheReadTokens,
    required this.latestOutputTokens,
    required this.cumulativeInputTokens,
    required this.cumulativeCacheReadTokens,
    required this.cumulativeOutputTokens,
    this.model,
    required this.plannerResponsesCount,
    this.malformedLinesCount = 0,
  });

  /// Instancia vacía o en frío (cold start).
  const TokenTelemetrySnapshot.empty()
    : latestInputTokens = 0,
      latestCacheReadTokens = 0,
      latestOutputTokens = 0,
      cumulativeInputTokens = 0,
      cumulativeCacheReadTokens = 0,
      cumulativeOutputTokens = 0,
      model = null,
      plannerResponsesCount = 0,
      malformedLinesCount = 0;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'latest_input_tokens': latestInputTokens,
    'latest_cache_read_tokens': latestCacheReadTokens,
    'latest_output_tokens': latestOutputTokens,
    'current_context_tokens': currentContextTokens,
    'cumulative_input_tokens': cumulativeInputTokens,
    'cumulative_cache_read_tokens': cumulativeCacheReadTokens,
    'cumulative_output_tokens': cumulativeOutputTokens,
    'model': model,
    'planner_responses_count': plannerResponsesCount,
    'malformed_lines_count': malformedLinesCount,
    'has_telemetry': hasTelemetry,
  };

  factory TokenTelemetrySnapshot.fromJson(Map<String, dynamic> json) {
    return TokenTelemetrySnapshot(
      latestInputTokens: json['latest_input_tokens'] as int? ?? 0,
      latestCacheReadTokens: json['latest_cache_read_tokens'] as int? ?? 0,
      latestOutputTokens: json['latest_output_tokens'] as int? ?? 0,
      cumulativeInputTokens: json['cumulative_input_tokens'] as int? ?? 0,
      cumulativeCacheReadTokens:
          json['cumulative_cache_read_tokens'] as int? ?? 0,
      cumulativeOutputTokens: json['cumulative_output_tokens'] as int? ?? 0,
      model: json['model'] as String?,
      plannerResponsesCount: json['planner_responses_count'] as int? ?? 0,
      malformedLinesCount: json['malformed_lines_count'] as int? ?? 0,
    );
  }
}

/// Extractor físico Pure Dart de telemetría de tokens (§4, §39, §50).
class TokenTelemetryExtractor {
  const TokenTelemetryExtractor();

  /// Extrae la telemetría iterando sobre líneas textuales del transcript.
  ///
  /// Si [strict] es true y no se encuentra ningún evento con telemetría,
  /// arroja [TokenTelemetryUnavailableException].
  TokenTelemetrySnapshot extractFromLines(
    Iterable<String> lines, {
    bool strict = false,
  }) {
    int latestInput = 0;
    int latestCacheRead = 0;
    int latestOutput = 0;
    int cumulativeInput = 0;
    int cumulativeCacheRead = 0;
    int cumulativeOutput = 0;
    String? latestModel;
    int responseCount = 0;
    int malformedCount = 0;

    for (final String rawLine in lines) {
      final String trimmed = rawLine.trim();
      if (trimmed.isEmpty) continue;
      if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
        malformedCount++;
        continue;
      }

      try {
        final dynamic decoded = jsonDecode(trimmed);
        if (decoded is! Map) {
          malformedCount++;
          continue;
        }

        // Buscar campos de tokens directos o dentro de usageMetadata/usage
        int? inputTokens;
        int? cacheReadTokens;
        int? outputTokens;
        String? model;

        if (decoded.containsKey('input_tokens') ||
            decoded.containsKey('output_tokens') ||
            decoded.containsKey('cache_read_tokens')) {
          inputTokens = decoded['input_tokens'] as int?;
          cacheReadTokens = decoded['cache_read_tokens'] as int?;
          outputTokens = decoded['output_tokens'] as int?;
          model = decoded['model'] as String?;
        } else if (decoded.containsKey('usageMetadata') &&
            decoded['usageMetadata'] is Map) {
          final Map<dynamic, dynamic> usage =
              decoded['usageMetadata'] as Map<dynamic, dynamic>;
          inputTokens =
              usage['promptTokenCount'] as int? ??
              usage['input_tokens'] as int?;
          cacheReadTokens =
              usage['cachedContentTokenCount'] as int? ??
              usage['cache_read_tokens'] as int?;
          outputTokens =
              usage['candidatesTokenCount'] as int? ??
              usage['output_tokens'] as int?;
          model = decoded['model'] as String?;
        } else if (decoded.containsKey('usage') && decoded['usage'] is Map) {
          final Map<dynamic, dynamic> usage =
              decoded['usage'] as Map<dynamic, dynamic>;
          inputTokens =
              usage['prompt_tokens'] as int? ?? usage['input_tokens'] as int?;
          cacheReadTokens =
              usage['cache_read_input_tokens'] as int? ??
              usage['cache_read_tokens'] as int?;
          outputTokens =
              usage['completion_tokens'] as int? ??
              usage['output_tokens'] as int?;
          model = decoded['model'] as String?;
        }

        if (inputTokens != null ||
            outputTokens != null ||
            cacheReadTokens != null) {
          final int inTok = inputTokens ?? 0;
          final int cacheTok = cacheReadTokens ?? 0;
          final int outTok = outputTokens ?? 0;

          latestInput = inTok;
          latestCacheRead = cacheTok;
          latestOutput = outTok;
          cumulativeInput += inTok;
          cumulativeCacheRead += cacheTok;
          cumulativeOutput += outTok;
          if (model != null && model.isNotEmpty) {
            latestModel = model;
          }
          responseCount++;
        }
      } catch (_) {
        malformedCount++;
      }
    }

    if (strict && responseCount == 0) {
      throw const TokenTelemetryUnavailableException(
        'El transcript no contiene eventos válidos de telemetría de tokens '
        '(input_tokens / cache_read_tokens / output_tokens).',
      );
    }

    return TokenTelemetrySnapshot(
      latestInputTokens: latestInput,
      latestCacheReadTokens: latestCacheRead,
      latestOutputTokens: latestOutput,
      cumulativeInputTokens: cumulativeInput,
      cumulativeCacheReadTokens: cumulativeCacheRead,
      cumulativeOutputTokens: cumulativeOutput,
      model: latestModel,
      plannerResponsesCount: responseCount,
      malformedLinesCount: malformedCount,
    );
  }

  /// Extrae la telemetría a partir de un String completo.
  TokenTelemetrySnapshot extractFromString(
    String content, {
    bool strict = false,
  }) {
    return extractFromLines(content.split('\n'), strict: strict);
  }

  /// Extrae la telemetría leyendo físicamente un archivo en disco.
  TokenTelemetrySnapshot extractFromFile(File file, {bool strict = false}) {
    if (!file.existsSync()) {
      throw TokenTelemetryUnavailableException(
        'El archivo de transcript no existe en disco: ${file.path}',
      );
    }
    return extractFromLines(file.readAsLinesSync(), strict: strict);
  }
}
