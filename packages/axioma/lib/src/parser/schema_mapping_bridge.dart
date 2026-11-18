/// schema_mapping_bridge.dart — Puente de Mapeo Declarativo para Ingesta Tabular y FastXlsxReader (§22, §39, §54, §58).
///
/// Conecta [DataDictionary] y [DataContract] con matrices de celdas provenientes de
/// [FastXlsxReader] o fuentes tabulares, normalizando encabezados externos y aplicando
/// coerción tipada y validación de escalas financieras con [CurrencyScaleGuard].
library;

import '../schema/data_contract.dart';
import '../schema/data_dictionary.dart';
import 'fast_xlsx_reader.dart';

// =============================================================================
// EXCEPCIONES TIPADAS DE MAPEO DE ESQUEMAS (§6 SAD PATH MANDATORIO)
// =============================================================================

/// Excepción base para errores durante el mapeo y parseo de matrices tabulares.
abstract class SchemaMappingException extends DataContractException {
  const SchemaMappingException(super.message, [super.details]);
}

/// Sad Path: Encabezados obligatorios ausentes en la matriz de celdas.
class MissingColumnMappingException extends SchemaMappingException {
  final String contractId;
  final List<String> missingFields;

  MissingColumnMappingException({
    required this.contractId,
    required this.missingFields,
  }) : super(
         'Columnas obligatorias ausentes en la matriz tabular para el contrato "$contractId": '
         '${missingFields.join(", ")}.',
       );
}

/// Sad Path: Error de coerción o violación de validación en una fila específica.
class RowCoercionException extends SchemaMappingException {
  final int rowIndex;
  final dynamic cause;

  RowCoercionException({required this.rowIndex, required this.cause})
    : super('Error de coerción en fila $rowIndex: $cause', cause);
}

// =============================================================================
// RESULTADOS DE MAPEO Y PROCESAMIENTO
// =============================================================================

/// Resultado del análisis y mapeo de encabezados tabulares.
class HeaderMappingResult {
  final Map<int, String> columnIndexToCanonicalField;
  final Map<String, int> canonicalFieldToColumnIndex;
  final List<String> unmappedHeaders;
  final List<String> missingRequiredFields;

  const HeaderMappingResult({
    required this.columnIndexToCanonicalField,
    required this.canonicalFieldToColumnIndex,
    required this.unmappedHeaders,
    required this.missingRequiredFields,
  });

  bool get hasAllRequired => missingRequiredFields.isEmpty;
  bool get hasUnmapped => unmappedHeaders.isNotEmpty;
}

/// Detalle del procesamiento de una fila individual.
class RowProcessingResult {
  final int rowIndex;
  final Map<String, dynamic>? record;
  final bool isSuccess;
  final String? errorMessage;
  final dynamic error;

  const RowProcessingResult({
    required this.rowIndex,
    this.record,
    required this.isSuccess,
    this.errorMessage,
    this.error,
  });

  factory RowProcessingResult.success(
    int rowIndex,
    Map<String, dynamic> record,
  ) {
    return RowProcessingResult(
      rowIndex: rowIndex,
      record: record,
      isSuccess: true,
    );
  }

  factory RowProcessingResult.failure(int rowIndex, dynamic error) {
    return RowProcessingResult(
      rowIndex: rowIndex,
      isSuccess: false,
      errorMessage: error.toString(),
      error: error,
    );
  }
}

/// Resultado integral de procesamiento tabular.
class SchemaMappingResult {
  final HeaderMappingResult headerMapping;
  final List<Map<String, dynamic>> records;
  final List<RowProcessingResult> rejectedRows;
  final int totalRows;

  const SchemaMappingResult({
    required this.headerMapping,
    required this.records,
    required this.rejectedRows,
    required this.totalRows,
  });

  int get successCount => records.length;
  int get rejectedCount => rejectedRows.length;
  double get successRate => totalRows == 0 ? 0.0 : successCount / totalRows;
}

// =============================================================================
// PUENTE DE MAPEO DECLARATIVO (SCHEMA MAPPING BRIDGE)
// =============================================================================

/// Conector declarativo entre tablas externas, diccionarios y contratos canónicos.
class SchemaMappingBridge {
  final DataContract contract;
  final DataDictionary dictionary;
  final bool strictMode;
  final bool enforceCurrencyScale;

  SchemaMappingBridge({
    required this.contract,
    DataDictionary? dictionary,
    this.strictMode = false,
    this.enforceCurrencyScale = true,
  }) : dictionary = dictionary ?? DataDictionary();

  /// Mapea una lista de encabezados crudos hacia campos canónicos del contrato.
  HeaderMappingResult mapHeaders(List<dynamic> rawHeaders) {
    final Map<int, String> colToField = <int, String>{};
    final Map<String, int> fieldToCol = <String, int>{};
    final List<String> unmapped = <String>[];

    for (int col = 0; col < rawHeaders.length; col++) {
      final dynamic raw = rawHeaders[col];
      if (raw == null) continue;
      final String headerStr = raw.toString().trim();
      if (headerStr.isEmpty) continue;

      // 1. Resolver alias mediante el diccionario canónico
      final String resolvedField = dictionary.resolveCanonicalField(headerStr);

      // 2. Verificar si el campo resuelto existe en el contrato
      if (contract.fields.containsKey(resolvedField)) {
        colToField[col] = resolvedField;
        fieldToCol[resolvedField] = col;
      } else {
        // Fallback: búsqueda insensible a mayúsculas/guiones en los campos del contrato
        final String norm = DataDictionary.normalizeHeader(headerStr);
        String? directMatch;
        for (final String fieldName in contract.fields.keys) {
          if (DataDictionary.normalizeHeader(fieldName) == norm) {
            directMatch = fieldName;
            break;
          }
        }

        if (directMatch != null) {
          colToField[col] = directMatch;
          fieldToCol[directMatch] = col;
        } else {
          unmapped.add(headerStr);
        }
      }
    }

    // 3. Validar presencia de campos requeridos
    final List<String> missing = <String>[];
    for (final MapEntry<String, FieldDefinition> entry
        in contract.fields.entries) {
      if (entry.value.required && entry.value.defaultValue == null) {
        if (!fieldToCol.containsKey(entry.key)) {
          missing.add(entry.key);
        }
      }
    }

    if (strictMode && missing.isNotEmpty) {
      throw MissingColumnMappingException(
        contractId: contract.contractId,
        missingFields: missing,
      );
    }

    return HeaderMappingResult(
      columnIndexToCanonicalField: colToField,
      canonicalFieldToColumnIndex: fieldToCol,
      unmappedHeaders: unmapped,
      missingRequiredFields: missing,
    );
  }

  /// Procesa una matriz de filas crudas y retorna el resultado de mapeo y coerción.
  SchemaMappingResult processRows(
    List<List<dynamic>> rows, {
    int headerRowIndex = 0,
  }) {
    if (rows.isEmpty || rows.length <= headerRowIndex) {
      return const SchemaMappingResult(
        headerMapping: HeaderMappingResult(
          columnIndexToCanonicalField: <int, String>{},
          canonicalFieldToColumnIndex: <String, int>{},
          unmappedHeaders: <String>[],
          missingRequiredFields: <String>[],
        ),
        records: <Map<String, dynamic>>[],
        rejectedRows: <RowProcessingResult>[],
        totalRows: 0,
      );
    }

    final HeaderMappingResult headerMapping = mapHeaders(rows[headerRowIndex]);

    final List<Map<String, dynamic>> validRecords = <Map<String, dynamic>>[];
    final List<RowProcessingResult> rejected = <RowProcessingResult>[];

    final int dataRowsCount = rows.length - (headerRowIndex + 1);

    for (int i = headerRowIndex + 1; i < rows.length; i++) {
      final List<dynamic> row = rows[i];
      if (row.isEmpty ||
          row.every(
            (dynamic c) => c == null || (c is String && c.trim().isEmpty),
          )) {
        continue; // Omitir filas vacías
      }

      try {
        final Map<String, dynamic> rawPayload = <String, dynamic>{};

        for (final MapEntry<int, String> mapping
            in headerMapping.columnIndexToCanonicalField.entries) {
          final int colIndex = mapping.key;
          final String fieldName = mapping.value;
          if (colIndex < row.length) {
            rawPayload[fieldName] = row[colIndex];
          }
        }

        // Coerción y validación con el contrato canónico
        final Map<String, dynamic> coerced = contract.coerceAndValidate(
          rawPayload,
        );

        // Validación complementaria de magnitudes de divisa si está activada
        if (enforceCurrencyScale) {
          for (final MapEntry<String, FieldDefinition> fieldEntry
              in contract.fields.entries) {
            if (fieldEntry.value.type == CanonicalDataType.currency) {
              final dynamic val = coerced[fieldEntry.key];
              if (val is double) {
                final String currCode = fieldEntry.value.currencyCode ?? 'USD';
                CurrencyScaleGuard.enforceValidPrice(
                  price: val,
                  declaredCurrency: currCode,
                );
              }
            }
          }
        }

        validRecords.add(coerced);
      } catch (e) {
        if (strictMode) {
          throw RowCoercionException(rowIndex: i, cause: e);
        } else {
          rejected.add(RowProcessingResult.failure(i, e));
        }
      }
    }

    return SchemaMappingResult(
      headerMapping: headerMapping,
      records: validRecords,
      rejectedRows: rejected,
      totalRows: dataRowsCount,
    );
  }

  /// Procesa una hoja de cálculo [FastSheet] de FastXlsxReader.
  SchemaMappingResult processSheet(FastSheet sheet, {int headerRowIndex = 0}) {
    return processRows(sheet.rows, headerRowIndex: headerRowIndex);
  }
}
