/// odometer_exceptions.dart — Jerarquía de Excepciones Tipadas de Odómetro y Telemetría (§4, §6, §39, §47, §50, §60.2, §60.7).
///
/// Pure Dart Core: Provee excepciones con exitCode determinista y guards de gobernanza
/// para auditorías mecánicas, compuertas de pre-commit/pre-push y cálculo de MCCV v3.
library;

import 'dart:convert';

/// Excepción base inmutable para todas las anomalías y violaciones del odómetro de gobernanza.
abstract class OdometerException implements Exception {
  /// Mensaje descriptivo de la falla o violación.
  final String message;

  /// Código de salida de proceso Unix determinista asignado a la excepción.
  final int exitCode;

  /// Detalles adicionales de diagnóstico forense.
  final List<String> details;

  const OdometerException(
    this.message, {
    required this.exitCode,
    this.details = const <String>[],
  });

  @override
  String toString() {
    final String detailsStr = details.isNotEmpty
        ? ' [Detalles: ${details.join(', ')}]'
        : '';
    return '$runtimeType(exitCode: $exitCode): $message$detailsStr';
  }
}

/// Arrojada ante un esquema de transcript, odómetro o payload JSON que no cumple
/// con la estructura requerida o contiene campos de tipo discordante (exitCode: 70 / EX_SOFTWARE).
class OdometerSchemaMismatchException extends OdometerException {
  final String? schemaField;
  final dynamic actualValue;

  const OdometerSchemaMismatchException(
    super.message, {
    this.schemaField,
    this.actualValue,
    super.exitCode = 70,
    super.details = const <String>[],
  });
}

/// Arrojada cuando no es físicamente posible extraer telemetría de tokens reales
/// ni de transcripciones ni de metadatos de respuesta del proveedor (exitCode: 75 / EX_TEMPFAIL).
class TokenTelemetryUnavailableException extends OdometerException {
  final String? provider;

  const TokenTelemetryUnavailableException(
    super.message, {
    this.provider,
    super.exitCode = 75,
    super.details = const <String>[],
  });
}

/// Arrojada cuando la saturación telemétrica del odómetro supera el 60%
/// (Zona Roja), activando el mandato ineludible de handover y parálisis operacional (§50, §50.b, exitCode: 2).
class OdometerRedZoneException extends OdometerException {
  final double mccvDepth;
  final String modelName;
  final int currentTokens;
  final int contextWindow;

  const OdometerRedZoneException(
    super.message, {
    required this.mccvDepth,
    required this.modelName,
    required this.currentTokens,
    required this.contextWindow,
    super.exitCode = 2,
    super.details = const <String>[],
  });
}

/// Arrojada ante una violación de monotonicidad en el odómetro
/// (intento de retroceder el odómetro o eludir la acumulación entrópica sin amnistía) (§50.1, exitCode: 1).
class OdometerMonotonicViolationException extends OdometerException {
  final double currentDepth;
  final double proposedDepth;

  const OdometerMonotonicViolationException(
    super.message, {
    required this.currentDepth,
    required this.proposedDepth,
    super.exitCode = 1,
    super.details = const <String>[],
  });
}

/// Arrojada cuando un archivo o buffer de telemetría en disco está corrupto,
/// incompleto o no puede parsearse como JSON válido (exitCode: 74 / EX_IOERR).
class OdometerCorruptBufferException extends OdometerException {
  final String filePath;

  const OdometerCorruptBufferException(
    super.message, {
    required this.filePath,
    super.exitCode = 74,
    super.details = const <String>[],
  });
}

/// Guardias deterministas que hacen cumplir los invariantes constitucionales de telemetría.
class OdometerGuards {
  const OdometerGuards._();

  /// Valida que la saturación de odómetro no exceda la Zona Roja (>60%).
  ///
  /// Arroja [OdometerRedZoneException] si [mccvDepth] >= [redZoneThreshold] (§50).
  static void assertWithinBudget({
    required double mccvDepth,
    required String modelName,
    required int currentTokens,
    required int contextWindow,
    double redZoneThreshold = 0.60,
  }) {
    if (mccvDepth >= redZoneThreshold) {
      final String pct = (mccvDepth * 100).toStringAsFixed(1);
      throw OdometerRedZoneException(
        'Saturación de odómetro en Zona Roja ($pct% >= ${(redZoneThreshold * 100).toStringAsFixed(1)}%). '
        'Mandato ineludible de handover activo (§50, §50.b).',
        mccvDepth: mccvDepth,
        modelName: modelName,
        currentTokens: currentTokens,
        contextWindow: contextWindow,
        details: <String>[
          'Modelo: $modelName',
          'Tokens actuales: $currentTokens',
          'Ventana de contexto: $contextWindow',
          'Profundidad MCCV: $pct%',
        ],
      );
    }
  }

  /// Valida el invariante monótono del odómetro (§50.1).
  ///
  /// Arroja [OdometerMonotonicViolationException] si [proposedDepth] < [currentDepth]
  /// a menos que [allowAmnesty] sea true.
  static void assertMonotonic({
    required double currentDepth,
    required double proposedDepth,
    bool allowAmnesty = false,
  }) {
    if (!allowAmnesty && proposedDepth < currentDepth) {
      throw OdometerMonotonicViolationException(
        'Violación del Invariante Monótono del Odómetro: '
        'profundidad propuesta (${(proposedDepth * 100).toStringAsFixed(1)}%) es menor '
        'que la profundidad actual (${(currentDepth * 100).toStringAsFixed(1)}%) (§50.1).',
        currentDepth: currentDepth,
        proposedDepth: proposedDepth,
        details: <String>[
          'currentDepth: $currentDepth',
          'proposedDepth: $proposedDepth',
          'allowAmnesty: false',
        ],
      );
    }
  }

  /// Valida que un mapa de esquema contenga todos los campos obligatorios.
  ///
  /// Arroja [OdometerSchemaMismatchException] ante cualquier campo faltante o nulo.
  static void assertSchemaValid(
    Map<String, dynamic> data,
    List<String> requiredFields, {
    String contextName = 'schema',
  }) {
    for (final String field in requiredFields) {
      if (!data.containsKey(field) || data[field] == null) {
        throw OdometerSchemaMismatchException(
          'Discrepancia en esquema $contextName: campo obligatorio "$field" ausente o nulo.',
          schemaField: field,
          actualValue: data[field],
          details: <String>[
            'context: $contextName',
            'campos_esperados: ${requiredFields.join(", ")}',
          ],
        );
      }
    }
  }

  /// Intenta decodificar un buffer JSON, arrojando [OdometerCorruptBufferException] si está corrupto.
  static dynamic assertBufferParsable(
    String rawContent, {
    required String filePath,
  }) {
    if (rawContent.trim().isEmpty) {
      throw OdometerCorruptBufferException(
        'Buffer de telemetría vacío en disco.',
        filePath: filePath,
        details: <String>['filePath: $filePath', 'bytes: 0'],
      );
    }
    try {
      return jsonDecode(rawContent);
    } on FormatException catch (e) {
      throw OdometerCorruptBufferException(
        'Buffer de telemetría corrupto o JSON inválido: ${e.message}',
        filePath: filePath,
        details: <String>['filePath: $filePath', 'offset: ${e.offset}'],
      );
    }
  }
}
