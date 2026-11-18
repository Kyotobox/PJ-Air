/// data_contract.dart — Hub de Contratos de Datos Canónicos y Single Path of Authority (§4, §6, §39, §58).
///
/// Define la estructura inmutable de contratos de datos para la flota, asegurando
/// que cada entidad tenga una única autoridad declarada (SPA §58) y coerción tipada estricta.
/// Pure Dart agnóstico de frameworks de UI (§39).
library;

// =============================================================================
// EXCEPCIONES TIPADAS DE CONTRATOS DE DATOS (§6 SAD PATH MANDATORIO)
// =============================================================================

/// Excepción base para el subsistema de contratos de datos.
abstract class DataContractException implements Exception {
  final String message;
  final dynamic details;

  const DataContractException(this.message, [this.details]);

  @override
  String toString() =>
      'DataContractException: $message${details != null ? ' (Detalles: $details)' : ''}';
}

/// Sad Path: Error de coerción o incompatibilidad de tipo de dato.
class DataCoercionException extends DataContractException {
  final String fieldName;
  final dynamic rawValue;
  final String targetType;

  const DataCoercionException({
    required this.fieldName,
    required this.rawValue,
    required this.targetType,
    String? message,
    dynamic details,
  }) : super(
         message ??
             'Incompatibilidad de tipo en campo "$fieldName": no se puede coercer valor "$rawValue" a $targetType.',
         details,
       );
}

/// Sad Path (§58 SPA): Violación del Principio de Ruta Única de Autoridad.
class AuthorityViolationException extends DataContractException {
  final String entityName;
  final String authoritativeNode;
  final String requestingNode;

  const AuthorityViolationException({
    required this.entityName,
    required this.authoritativeNode,
    required this.requestingNode,
    String? message,
  }) : super(
         message ??
             'Violación de Autoridad Única (SPA §58) para entidad "$entityName": '
                 'Nodo autoritativo canónico es "$authoritativeNode", pero "$requestingNode" intentó registrar o mutar autoridad.',
       );
}

/// Sad Path: Campo requerido ausente en la carga de datos.
class MissingRequiredFieldException extends DataContractException {
  final String fieldName;
  final String contractId;

  const MissingRequiredFieldException({
    required this.fieldName,
    required this.contractId,
  }) : super(
         'Campo requerido ausente "$fieldName" en el contrato "$contractId".',
       );
}

/// Sad Path: Contrato no encontrado en el registro canónico.
class UnknownContractException extends DataContractException {
  final String contractIdentifier;

  const UnknownContractException(this.contractIdentifier)
    : super('Contrato no encontrado en el registro: "$contractIdentifier".');
}

// =============================================================================
// ENUMS Y TIPOS CANÓNICOS
// =============================================================================

/// Tipos de datos canónicos admitidos por el Shared Kernel Axioma (§39).
enum CanonicalDataType {
  string,
  integer,
  float,
  boolean,
  currency,
  datetime,
  uuid,
  jsonMap,
  jsonList;

  static CanonicalDataType fromString(String raw) {
    final String clean = raw.trim().toLowerCase();
    switch (clean) {
      case 'string':
      case 'str':
      case 'text':
        return CanonicalDataType.string;
      case 'integer':
      case 'int':
        return CanonicalDataType.integer;
      case 'float':
      case 'double':
      case 'num':
      case 'number':
        return CanonicalDataType.float;
      case 'boolean':
      case 'bool':
        return CanonicalDataType.boolean;
      case 'currency':
      case 'money':
      case 'price':
        return CanonicalDataType.currency;
      case 'datetime':
      case 'date':
      case 'timestamp':
        return CanonicalDataType.datetime;
      case 'uuid':
      case 'guid':
        return CanonicalDataType.uuid;
      case 'jsonmap':
      case 'map':
      case 'object':
        return CanonicalDataType.jsonMap;
      case 'jsonlist':
      case 'list':
      case 'array':
        return CanonicalDataType.jsonList;
      default:
        throw ArgumentError.value(
          raw,
          'raw',
          'Tipo canónico desconocido: "$raw"',
        );
    }
  }
}

// =============================================================================
// DEFINICIÓN DE CAMPOS Y COERCIÓN TIPADA
// =============================================================================

/// Definición inmutable de una regla de campo en un contrato.
class FieldDefinition {
  final String name;
  final CanonicalDataType type;
  final bool required;
  final dynamic defaultValue;
  final List<dynamic>? allowedValues;
  final num? minValue;
  final num? maxValue;
  final String? currencyCode;
  final String? description;

  const FieldDefinition({
    required this.name,
    required this.type,
    this.required = false,
    this.defaultValue,
    this.allowedValues,
    this.minValue,
    this.maxValue,
    this.currencyCode,
    this.description,
  });

  /// Coerce un valor crudo al tipo canónico de este campo.
  /// Arroja [DataCoercionException] si la coerción no es posible.
  dynamic coerce(dynamic rawValue) {
    if (rawValue == null || (rawValue is String && rawValue.trim().isEmpty)) {
      if (defaultValue != null) return defaultValue;
      if (required) {
        throw DataCoercionException(
          fieldName: name,
          rawValue: rawValue,
          targetType: type.name,
          message:
              'El campo "$name" es obligatorio y no puede ser nulo o vacío.',
        );
      }
      return null;
    }

    dynamic coerced;
    switch (type) {
      case CanonicalDataType.string:
        coerced = rawValue.toString().trim();
        break;

      case CanonicalDataType.integer:
        if (rawValue is int) {
          coerced = rawValue;
        } else if (rawValue is num) {
          coerced = rawValue.round();
        } else if (rawValue is String) {
          final String clean = rawValue
              .replaceAll(' ', '')
              .replaceAll(',', '')
              .trim();
          final int? parsed = int.tryParse(clean);
          if (parsed == null) {
            final double? d = double.tryParse(clean);
            if (d == null) {
              throw DataCoercionException(
                fieldName: name,
                rawValue: rawValue,
                targetType: 'integer',
              );
            }
            coerced = d.round();
          } else {
            coerced = parsed;
          }
        } else {
          throw DataCoercionException(
            fieldName: name,
            rawValue: rawValue,
            targetType: 'integer',
          );
        }
        break;

      case CanonicalDataType.float:
        if (rawValue is num) {
          coerced = rawValue.toDouble();
        } else if (rawValue is String) {
          final String clean = rawValue
              .replaceAll(' ', '')
              .replaceAll('\$', '')
              .replaceAll(',', '.')
              .trim();
          final double? parsed = double.tryParse(clean);
          if (parsed == null) {
            throw DataCoercionException(
              fieldName: name,
              rawValue: rawValue,
              targetType: 'float',
            );
          }
          coerced = parsed;
        } else {
          throw DataCoercionException(
            fieldName: name,
            rawValue: rawValue,
            targetType: 'float',
          );
        }
        break;

      case CanonicalDataType.boolean:
        if (rawValue is bool) {
          coerced = rawValue;
        } else if (rawValue is num) {
          coerced = rawValue != 0;
        } else if (rawValue is String) {
          final String clean = rawValue.trim().toLowerCase();
          if (clean == 'true' ||
              clean == '1' ||
              clean == 'yes' ||
              clean == 'si' ||
              clean == 's' ||
              clean == 'y') {
            coerced = true;
          } else if (clean == 'false' ||
              clean == '0' ||
              clean == 'no' ||
              clean == 'n') {
            coerced = false;
          } else {
            throw DataCoercionException(
              fieldName: name,
              rawValue: rawValue,
              targetType: 'boolean',
            );
          }
        } else {
          throw DataCoercionException(
            fieldName: name,
            rawValue: rawValue,
            targetType: 'boolean',
          );
        }
        break;

      case CanonicalDataType.currency:
        if (rawValue is num) {
          coerced = rawValue.toDouble();
        } else if (rawValue is String) {
          final String clean = rawValue
              .replaceAll(' ', '')
              .replaceAll('\$', '')
              .replaceAll('USD', '')
              .replaceAll('COP', '')
              .replaceAll('VES', '')
              .replaceAll('EUR', '')
              .replaceAll(',', '.')
              .trim();
          final double? parsed = double.tryParse(clean);
          if (parsed == null) {
            throw DataCoercionException(
              fieldName: name,
              rawValue: rawValue,
              targetType: 'currency',
            );
          }
          coerced = parsed;
        } else {
          throw DataCoercionException(
            fieldName: name,
            rawValue: rawValue,
            targetType: 'currency',
          );
        }
        break;

      case CanonicalDataType.datetime:
        if (rawValue is DateTime) {
          coerced = rawValue;
        } else if (rawValue is String) {
          final DateTime? parsed = DateTime.tryParse(rawValue.trim());
          if (parsed == null) {
            throw DataCoercionException(
              fieldName: name,
              rawValue: rawValue,
              targetType: 'datetime',
            );
          }
          coerced = parsed;
        } else {
          throw DataCoercionException(
            fieldName: name,
            rawValue: rawValue,
            targetType: 'datetime',
          );
        }
        break;

      case CanonicalDataType.uuid:
        final String str = rawValue.toString().trim();
        final RegExp uuidRegex = RegExp(
          r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
        );
        if (!uuidRegex.hasMatch(str)) {
          throw DataCoercionException(
            fieldName: name,
            rawValue: rawValue,
            targetType: 'uuid',
            message: 'El valor "$str" no es un UUID válido.',
          );
        }
        coerced = str.toLowerCase();
        break;

      case CanonicalDataType.jsonMap:
        if (rawValue is Map) {
          coerced = Map<String, dynamic>.from(rawValue);
        } else {
          throw DataCoercionException(
            fieldName: name,
            rawValue: rawValue,
            targetType: 'jsonMap',
          );
        }
        break;

      case CanonicalDataType.jsonList:
        if (rawValue is List) {
          coerced = List<dynamic>.from(rawValue);
        } else {
          throw DataCoercionException(
            fieldName: name,
            rawValue: rawValue,
            targetType: 'jsonList',
          );
        }
        break;
    }

    // Validar restricciones de valor
    if (allowedValues != null && allowedValues!.isNotEmpty) {
      if (!allowedValues!.contains(coerced)) {
        throw DataCoercionException(
          fieldName: name,
          rawValue: rawValue,
          targetType: type.name,
          message:
              'El valor "$coerced" no pertenece a los valores permitidos: $allowedValues',
        );
      }
    }

    if (coerced is num) {
      if (minValue != null && coerced < minValue!) {
        throw DataCoercionException(
          fieldName: name,
          rawValue: rawValue,
          targetType: type.name,
          message:
              'El valor $coerced es menor que el mínimo permitido: $minValue',
        );
      }
      if (maxValue != null && coerced > maxValue!) {
        throw DataCoercionException(
          fieldName: name,
          rawValue: rawValue,
          targetType: type.name,
          message:
              'El valor $coerced es mayor que el máximo permitido: $maxValue',
        );
      }
    }

    return coerced;
  }
}

// =============================================================================
// CONTRATO DE DATOS (DATA CONTRACT)
// =============================================================================

/// Contrato canónico de datos inmutable.
/// Garantiza la regla de autoridad única (SPA §58).
class DataContract {
  final String contractId;
  final String entityName;
  final String authoritativeNode;
  final String version;
  final Map<String, FieldDefinition> fields;
  final Map<String, dynamic> metadata;

  const DataContract({
    required this.contractId,
    required this.entityName,
    required this.authoritativeNode,
    this.version = '1.0.0',
    required this.fields,
    this.metadata = const <String, dynamic>{},
  });

  /// Valida que el nodo solicitante sea la autoridad única de esta entidad (§58).
  void assertAuthority(String requestingNode) {
    if (requestingNode != authoritativeNode) {
      throw AuthorityViolationException(
        entityName: entityName,
        authoritativeNode: authoritativeNode,
        requestingNode: requestingNode,
      );
    }
  }

  /// Coerce y valida un mapa de datos sin procesar contra el contrato.
  Map<String, dynamic> coerceAndValidate(Map<String, dynamic> rawData) {
    final Map<String, dynamic> result = <String, dynamic>{};

    // 1. Validar presencia de campos obligatorios
    for (final MapEntry<String, FieldDefinition> entry in fields.entries) {
      final String fieldName = entry.key;
      final FieldDefinition fieldDef = entry.value;

      final dynamic raw = rawData[fieldName];
      if (raw == null && fieldDef.required && fieldDef.defaultValue == null) {
        throw MissingRequiredFieldException(
          fieldName: fieldName,
          contractId: contractId,
        );
      }

      result[fieldName] = fieldDef.coerce(raw);
    }

    return result;
  }
}

// =============================================================================
// REGISTRO DE CONTRATOS (DATA CONTRACT REGISTRY) — SINGLE PATH OF AUTHORITY (§58)
// =============================================================================

/// Registro global inmutable de contratos de datos.
/// Protege el ecosistema contra desdoblamientos y colisiones de autoridad.
class DataContractRegistry {
  static final DataContractRegistry _instance =
      DataContractRegistry._internal();
  factory DataContractRegistry() => _instance;
  DataContractRegistry._internal();

  final Map<String, DataContract> _contractsById = <String, DataContract>{};
  final Map<String, DataContract> _contractsByEntity = <String, DataContract>{};

  /// Registra un nuevo contrato.
  /// Lanza [AuthorityViolationException] si otra autoridad ya registró la entidad (§58).
  void register(DataContract contract, {bool allowOverride = false}) {
    final DataContract? existing = _contractsByEntity[contract.entityName];
    if (existing != null && !allowOverride) {
      if (existing.authoritativeNode != contract.authoritativeNode) {
        throw AuthorityViolationException(
          entityName: contract.entityName,
          authoritativeNode: existing.authoritativeNode,
          requestingNode: contract.authoritativeNode,
        );
      }
    }

    _contractsById[contract.contractId] = contract;
    _contractsByEntity[contract.entityName] = contract;
  }

  /// Obtiene un contrato por su ID. Lanza [UnknownContractException] si no existe.
  DataContract getContract(String contractId) {
    final DataContract? c = _contractsById[contractId];
    if (c == null) throw UnknownContractException(contractId);
    return c;
  }

  /// Obtiene el contrato canónico para una entidad. Lanza [UnknownContractException] si no existe.
  DataContract getContractForEntity(String entityName) {
    final DataContract? c = _contractsByEntity[entityName];
    if (c == null) throw UnknownContractException('entity:$entityName');
    return c;
  }

  /// Verifica si un contrato existe por ID.
  bool hasContract(String contractId) => _contractsById.containsKey(contractId);

  /// Verifica si una entidad tiene contrato registrado.
  bool hasEntity(String entityName) =>
      _contractsByEntity.containsKey(entityName);

  /// Retorna todos los contratos registrados.
  List<DataContract> get allContracts => _contractsById.values.toList();

  /// Limpia el registro (útil para pruebas y sandboxes aislados §4).
  void clear() {
    _contractsById.clear();
    _contractsByEntity.clear();
  }
}
