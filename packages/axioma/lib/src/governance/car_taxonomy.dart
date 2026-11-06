/// car_taxonomy.dart — Esquema Canónico de Taxonomía Causal e Inmunización CAR (§4, §6, §39, §46).
///
/// Shared Kernel Pure Dart para la clasificación formal, sistémica y determinista
/// de defectos y fallas bajo el modelo de Causal Analysis and Resolution (CAR - CMMI Nivel 5).
///
/// Veto Constitucional Anti-Error Humano (§46):
/// Queda estrictamente prohibido clasificar causas raíz como "error humano" o variantes.
/// Los fallos deben diagnosticarse a nivel de patrones AST, derivas de contrato,
/// arquitectura o deficiencias de linter/harness.
library;

import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;

import '../platform_guard.dart';

// ---------------------------------------------------------------------------
// 1. Tipos Canónicos de Falla (Failure Type)
// ---------------------------------------------------------------------------

/// Categorías canónicas de fallas reconocidas por la taxonomía CAR de la flota.
enum CarFailureType {
  /// Error sintáctico o gramatical detectable estáticamente en el AST (§39, §46).
  astSyntaxError('ast_syntax_error', 'Error Sintáctico AST'),

  /// Incompatibilidad de tipos, firma de método rota o violación de contrato público.
  typeContractViolation(
    'type_contract_violation',
    'Violación de Contrato de Tipos',
  ),

  /// Discrepancia entre esquema DDL en base de datos física y entidades de código (§19, §20).
  schemaDrift('schema_drift', 'Deriva de Esquema DDL / Datos'),

  /// Prueba vacía, sin aserciones negativas reales o bypass de código real (§6, §43).
  tautologicalTest(
    'tautological_test',
    'Prueba Tautológica o Bypass (§6, §43)',
  ),

  /// Presencia o fuga de mocks en producción o pruebas de dominio (§4).
  mockLeak('mock_leak', 'Fuga de Mocks en Dominio (§4)'),

  /// Saturación de memoria, handles de archivos, conexiones de BD o cuotas de CPU.
  resourceExhaustion(
    'resource_exhaustion',
    'Agotamiento de Recursos / Sobrecarga',
  ),

  /// Excepción no capturada, desbordamiento o crash durante la ejecución.
  runtimeCrash('runtime_crash', 'Crash / Excepción no Controlada en Runtime'),

  /// Condición de carrera, bloqueo mutuo (deadlock) o desincronización asíncrona.
  concurrencyDeadlock(
    'concurrency_deadlock',
    'Condición de Carrera / Bloqueo Concurrente',
  ),

  /// Ambigüedad, conflicto o contradicción en especificaciones o doctrinas.
  specAmbiguity('spec_ambiguity', 'Ambigüedad en Especificaciones'),

  /// Fuga entre capas arquitectónicas, violación de Perímetro Sónico (§2, §39, §40).
  boundaryLeak(
    'boundary_leak',
    'Fuga Arquitectónica / Perímetro Sónico Violado',
  ),

  /// Skill sin ejecutables en scripts/ o sin pruebas físicas de certificación (§55).
  inertSkillPlacebo('inert_skill_placebo', 'Skill Inerte o Placebo (§55)'),

  /// Expiración del tiempo máximo de espera en tareas, comandos o inferencia.
  timeoutExceeded('timeout_exceeded', 'Límite de Tiempo Excedido'),

  /// Falla o defecto no categorizado en las divisiones canónicas previas.
  unknown('unknown', 'Fallo no Clasificado');

  final String code;
  final String label;

  const CarFailureType(this.code, this.label);

  /// Parsea un string canónico a [CarFailureType] con degradación serena (Calm UX).
  static CarFailureType fromString(String? value) {
    if (value == null || value.trim().isEmpty) return CarFailureType.unknown;
    final String normalized = value.trim().toLowerCase();
    for (final CarFailureType type in CarFailureType.values) {
      if (type.code == normalized || type.name.toLowerCase() == normalized) {
        return type;
      }
    }
    return CarFailureType.unknown;
  }
}

// ---------------------------------------------------------------------------
// 2. Subsistemas de la Flota (Subsystem)
// ---------------------------------------------------------------------------

/// Subsistemas arquitectónicos formales de la flota gobernada.
enum CarSubsystem {
  /// Motor central de gobernanza y CLI (logix, conext_core).
  kernelCore('kernel_core', 'Kernel Hub / Motor logix'),

  /// Paquete transversal de ADN, modelos y contratos base (packages/axioma).
  sharedKernelAxioma('shared_kernel_axioma', 'Shared Kernel Axioma'),

  /// Motores de ingesta y procesamiento masivo de datos (packages/ingestion_engine).
  ingestionEngine('ingestion_engine', 'Motor de Ingesta Masiva'),

  /// Capa de almacenamiento y persistencia persistente (SQLite WAL, migraciones DDL).
  storageDatabase('storage_database', 'Capa de Persistencia / SQLite WAL'),

  /// Puente y colas de inferencia LLM (inference_queue.db, Ingress Federado §53).
  inferenceBridge('inference_bridge', 'Puente y Cola de Inferencia LLM'),

  /// Analizadores estáticos, analizadores AST y reglas linter.
  analysisLinter('analysis_linter', 'Linters AST y Análisis Estático'),

  /// Infraestructura de pruebas, runners y smoke harnesses.
  testHarness('test_harness', 'Harness y Suites de Prueba'),

  /// Herramientas de soporte y utilidades operativas (tools/, scripts/).
  cliTooling('cli_tooling', 'Herramientas CLI y Scripts'),

  /// Nodos satélites de producto y periféricos de la flota.
  satelliteNode('satellite_node', 'Nodos Satélite de la Flota'),

  /// Transporte de red, clientes HTTP, RPC y receptores de webhooks.
  networkTransport('network_transport', 'Transporte de Red / Webhooks / APIs'),

  /// Entorno de ejecución y catálogo de skills (.agents/skills/ §55).
  skillsExecution('skills_execution', 'Búnker de Skills (.agents/skills)'),

  /// Subsistema no especificado o general.
  unspecified('unspecified', 'Subsistema no Especificado');

  final String code;
  final String label;

  const CarSubsystem(this.code, this.label);

  /// Parsea un string canónico a [CarSubsystem] con degradación serena (Calm UX).
  static CarSubsystem fromString(String? value) {
    if (value == null || value.trim().isEmpty) return CarSubsystem.unspecified;
    final String normalized = value.trim().toLowerCase();
    for (final CarSubsystem subsystem in CarSubsystem.values) {
      if (subsystem.code == normalized ||
          subsystem.name.toLowerCase() == normalized) {
        return subsystem;
      }
    }
    return CarSubsystem.unspecified;
  }
}

// ---------------------------------------------------------------------------
// 3. Causas Raíz Técnicas en AST / Arquitectura (Technical Root Cause)
// ---------------------------------------------------------------------------

/// Causas raíz técnicas canónicas a nivel de AST, arquitectura o infraestructura.
enum CarTechnicalRootCauseCategory {
  /// Falta de una regla de linter AST que prohíba el patrón a nivel sintáctico (§46).
  missingAstValidation(
    'missing_ast_validation',
    'Ausencia de Linter o Validación AST',
  ),

  /// Caso borde o valor límite no contemplado en la lógica condicional del dominio.
  unhandledEdgeCase('unhandled_edge_case', 'Caso Borde no Manejado en Dominio'),

  /// Violación de perímetro arquitectónico o acoplamiento indebido (§39, §40).
  architecturalBoundaryViolation(
    'architectural_boundary_violation',
    'Violación de Límites Arquitectónicos (§39, §40)',
  ),

  /// Transición de máquina de estados sin compuerta previa de verificación física.
  unvalidatedStateTransition(
    'unvalidated_state_transition',
    'Transición de Estado sin Compuerta de Validación',
  ),

  /// Desalineación entre definiciones ORM y el esquema DDL persistido en disco (§19, §20).
  ddlContractMismatch(
    'ddl_contract_mismatch',
    'Desalineación entre Modelo y Esquema DDL en Disco',
  ),

  /// Ausencia de aserciones negativas (throwsA) o suite incompleta (§6).
  missingNegativeAssertion(
    'missing_negative_assertion',
    'Ausencia de Sad Path Mandatorio (§6)',
  ),

  /// Asignación no acotada de memoria, sin transacciones en lotes (§54.4).
  unboundedResourceAllocation(
    'unbounded_resource_allocation',
    'Asignación no Acotada de Memoria/Handles (§54.4)',
  ),

  /// Ausencia de await o falta de sincronización en futuros o streams.
  asynchronousRaceCondition(
    'asynchronous_race_condition',
    'Condición de Carrera en Código Asíncrono',
  ),

  /// Captura de excepciones con bloque vacío o sin comentario justificativo (§10, §21).
  silentExceptionSuppression(
    'silent_exception_suppression',
    'Supresión Silenciosa de Excepciones (§10, §21)',
  ),

  /// Desfase o incompatibilidad en versiones de paquetes upstream o pubspec.lock.
  dependencyDrift(
    'dependency_drift',
    'Deriva de Dependencias Upstream / Lockfile',
  ),

  /// Contradicción o vacío de doctrina en especificaciones de arquitectura.
  specificationContradiction(
    'specification_contradiction',
    'Contradicción en Especificaciones o Doctrina',
  ),

  /// Contaminación de variables de entorno, telemetría o rutas de sandbox (§2).
  environmentIsolationFailure(
    'environment_isolation_failure',
    'Fallo de Aislamiento en Entorno o Sandbox',
  ),

  /// Causa técnica específica no tipada en las categorías estándar.
  unclassifiedTechnical(
    'unclassified_technical',
    'Causa Técnica sin Catalogar',
  );

  final String code;
  final String label;

  const CarTechnicalRootCauseCategory(this.code, this.label);

  /// Parsea un string canónico a [CarTechnicalRootCauseCategory] con degradación serena (Calm UX).
  static CarTechnicalRootCauseCategory fromString(String? value) {
    if (value == null || value.trim().isEmpty) {
      return CarTechnicalRootCauseCategory.unclassifiedTechnical;
    }
    final String normalized = value.trim().toLowerCase();
    for (final CarTechnicalRootCauseCategory category
        in CarTechnicalRootCauseCategory.values) {
      if (category.code == normalized ||
          category.name.toLowerCase() == normalized) {
        return category;
      }
    }
    return CarTechnicalRootCauseCategory.unclassifiedTechnical;
  }
}

// ---------------------------------------------------------------------------
// 4. Centinela Anti-Error Humano (Constitutional Anti-Human-Error Sentinel)
// ---------------------------------------------------------------------------

/// Guardián constitucional que proscribe la atribución de defectos a "error humano" (§46).
///
/// En CMMI Nivel 5 (CAR), clasificar una falla como error humano es un anti-patrón que
/// enmascara debilidades del sistema, falta de linters AST o lagunas en el arnés de pruebas.
class CarTaxonomySentinel {
  CarTaxonomySentinel._();

  /// Términos y frases estrictamente prohibidos en cualquier descripción o campo de causa raíz.
  static const List<String> prohibitedHumanErrorTerms = <String>[
    'error humano',
    'error_humano',
    'error-humano',
    'human error',
    'human_error',
    'human-error',
    'fallo humano',
    'fallo_humano',
    'falla humana',
    'falla_humana',
    'developer error',
    'developer_error',
    'dev error',
    'programmer error',
    'programmer_error',
    'descuido humano',
    'descuido del desarrollador',
    'descuido del programador',
    'descuido',
    'olvido',
    'negligencia humana',
    'negligencia del desarrollador',
    'negligencia del programador',
    'user mistake',
    'user error',
    'human mistake',
    'pebkac',
    'operator error',
    'operator_error',
    'operator mistake',
    'culpa del desarrollador',
    'culpa del programador',
    'mal programador',
    'human fault',
    'human_fault',
  ];

  /// Comprueba si un texto contiene referencias a "error humano".
  static bool containsHumanError(String? text) {
    if (text == null || text.trim().isEmpty) return false;
    final String normalized = _normalizeText(text);

    for (final String term in prohibitedHumanErrorTerms) {
      if (_matchesProhibitedTerm(normalized, term)) {
        return true;
      }
    }
    return false;
  }

  /// Valida que la descripción o causa raíz técnica no atribuya el fallo a "error humano" (§46).
  ///
  /// Arroja [ArgumentError] con diagnóstico constitucional si detecta un término prohibido.
  static void validateTechnicalRootCause(
    String? text, {
    String fieldName = 'rootCause',
  }) {
    if (text == null) return;
    final String normalized = _normalizeText(text);

    for (final String term in prohibitedHumanErrorTerms) {
      if (_matchesProhibitedTerm(normalized, term)) {
        throw ArgumentError.value(
          text,
          fieldName,
          '🚨 [VETO-CONSTITUCIONAL-CAR §46] Prohibido atribuir causas raíz a "error humano" ("$term"). '
          'Bajo CMMI Nivel 5 (CAR), los defectos deben diagnosticarse a nivel de causas técnicas sistémicas, '
          'patrones AST o fallas de arquitectura.',
        );
      }
    }
  }

  static String _normalizeText(String input) {
    return input
        .toLowerCase()
        .replaceAll(RegExp(r'[\r\n\t]+'), ' ')
        .replaceAll(RegExp(r'[_\-]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  static bool _matchesProhibitedTerm(String normalizedText, String term) {
    final String cleanTerm = term.replaceAll(RegExp(r'[_\-]+'), ' ').trim();
    // Coincidencia por palabra o frase delimitada
    final RegExp regex = RegExp(
      r'(^|\b|\W)' + RegExp.escape(cleanTerm) + r'($|\b|\W)',
      caseSensitive: false,
    );
    return regex.hasMatch(normalizedText);
  }
}

// ---------------------------------------------------------------------------
// 5. Esquema Canónico de Taxonomía Causal (CarCausalRecord)
// ---------------------------------------------------------------------------

/// Registro estructurado canónico de análisis causal de defectos bajo CAR (§46).
class CarCausalRecord {
  /// Identificador único del registro de taxonomía.
  final String id;

  /// Identificador del defecto u orden de trabajo analizada.
  final String defectId;

  /// Tipo formal de falla categorizada.
  final CarFailureType failureType;

  /// Subsistema arquitectónico donde ocurrió o se manifestó el defecto.
  final CarSubsystem subsystem;

  /// Categoría canónica de la causa raíz técnica en AST / arquitectura.
  final CarTechnicalRootCauseCategory rootCauseCategory;

  /// Descripción técnica rigurosa de la causa raíz (inmune a error humano).
  final String technicalDescription;

  /// Firma o nodo AST relevante (ej: `MethodInvocation[name="execute"]`).
  final String? astSignature;

  /// Ruta relativa del archivo fuente afectado dentro del repositorio.
  final String? filePath;

  /// Número de línea del archivo donde se localiza la causa o síntoma.
  final int? lineNumber;

  /// Acción preventiva o inmunizadora recomendada (ej: regla linter, hook).
  final String? preventiveAction;

  /// Cantidad de recurrencias detectadas para este patrón de defecto.
  final int recurrenceCount;

  /// Marca temporal de creación o registro en UTC.
  final DateTime createdAt;

  /// Metadatos adicionales extensibles.
  final Map<String, dynamic> metadata;

  CarCausalRecord({
    required this.id,
    required this.defectId,
    required this.failureType,
    required this.subsystem,
    required this.rootCauseCategory,
    required this.technicalDescription,
    this.astSignature,
    this.filePath,
    this.lineNumber,
    this.preventiveAction,
    this.recurrenceCount = 1,
    DateTime? createdAt,
    this.metadata = const <String, dynamic>{},
  }) : createdAt = (createdAt ?? DateTime.now().toUtc()) {
    if (id.trim().isEmpty) {
      throw ArgumentError.value(
        id,
        'id',
        'El identificador no puede estar vacío',
      );
    }
    if (defectId.trim().isEmpty) {
      throw ArgumentError.value(
        defectId,
        'defectId',
        'El defectId de referencia no puede estar vacío',
      );
    }
    if (technicalDescription.trim().isEmpty) {
      throw ArgumentError.value(
        technicalDescription,
        'technicalDescription',
        'La descripción técnica de la causa raíz no puede estar vacía',
      );
    }
    if (recurrenceCount < 0) {
      throw ArgumentError.value(
        recurrenceCount,
        'recurrenceCount',
        'El conteo de recurrencia no puede ser negativo',
      );
    }

    // Validación constitucional anti-error humano (§46)
    CarTaxonomySentinel.validateTechnicalRootCause(
      technicalDescription,
      fieldName: 'technicalDescription',
    );
    if (preventiveAction != null) {
      CarTaxonomySentinel.validateTechnicalRootCause(
        preventiveAction,
        fieldName: 'preventiveAction',
      );
    }
    for (final MapEntry<String, dynamic> entry in metadata.entries) {
      if (entry.value is String) {
        CarTaxonomySentinel.validateTechnicalRootCause(
          entry.value as String,
          fieldName: 'metadata[${entry.key}]',
        );
      }
    }
  }

  /// CMMI Nivel 5 (§46): Si la recurrencia es >= 3, se exige inmunización
  /// obligatoria mediante síntesis de regla AST o acción preventiva persistente.
  bool get requiresImmunityLinter => recurrenceCount >= 3;

  /// Huella digital determinista calculada vía SHA-256 para agregación causal.
  String get fingerprint {
    final String normPath = filePath != null
        ? p.posix.normalize(filePath!.replaceAll(r'\', '/'))
        : '';
    final String seed =
        '${failureType.code}|${subsystem.code}|${rootCauseCategory.code}|'
        '${astSignature ?? ""}|$normPath|${technicalDescription.trim()}';
    return sha256.convert(utf8.encode(seed)).toString();
  }

  /// Serialización canónica a formato JSON compatible con la flota.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'defect_id': defectId,
    'failure_type': failureType.code,
    'subsystem': subsystem.code,
    'root_cause_category': rootCauseCategory.code,
    'technical_description': technicalDescription,
    if (astSignature != null) 'ast_signature': astSignature,
    if (filePath != null) 'file_path': filePath,
    if (lineNumber != null) 'line_number': lineNumber,
    if (preventiveAction != null) 'preventive_action': preventiveAction,
    'recurrence_count': recurrenceCount,
    'requires_immunity_linter': requiresImmunityLinter,
    'created_at': createdAt.toIso8601String(),
    'fingerprint': fingerprint,
    if (metadata.isNotEmpty) 'metadata': metadata,
  };

  /// Construye un [CarCausalRecord] a partir de un mapa JSON validando el esquema.
  factory CarCausalRecord.fromJson(Map<String, dynamic> json) {
    final String id = json['id'] as String? ?? '';
    final String defectId = json['defect_id'] as String? ?? '';
    final String desc = json['technical_description'] as String? ?? '';

    final CarFailureType failureType = CarFailureType.fromString(
      json['failure_type'] as String?,
    );
    final CarSubsystem subsystem = CarSubsystem.fromString(
      json['subsystem'] as String?,
    );
    final CarTechnicalRootCauseCategory rootCause =
        CarTechnicalRootCauseCategory.fromString(
          json['root_cause_category'] as String?,
        );

    final String? astSignature = json['ast_signature'] as String?;
    final String? filePath = json['file_path'] as String?;
    final int? lineNumber = json['line_number'] as int?;
    final String? preventiveAction = json['preventive_action'] as String?;
    final int recurrence = json['recurrence_count'] as int? ?? 1;

    final DateTime createdAt = json['created_at'] != null
        ? DateTime.tryParse(json['created_at'] as String)?.toUtc() ??
              DateTime.now().toUtc()
        : DateTime.now().toUtc();

    final Map<String, dynamic> metadata =
        json['metadata'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(json['metadata'] as Map<String, dynamic>)
        : const <String, dynamic>{};

    return CarCausalRecord(
      id: id,
      defectId: defectId,
      failureType: failureType,
      subsystem: subsystem,
      rootCauseCategory: rootCause,
      technicalDescription: desc,
      astSignature: astSignature,
      filePath: filePath,
      lineNumber: lineNumber,
      preventiveAction: preventiveAction,
      recurrenceCount: recurrence,
      createdAt: createdAt,
      metadata: metadata,
    );
  }

  /// Retorna una copia con campos modificados preservando la inmutabilidad.
  CarCausalRecord copyWith({
    String? id,
    String? defectId,
    CarFailureType? failureType,
    CarSubsystem? subsystem,
    CarTechnicalRootCauseCategory? rootCauseCategory,
    String? technicalDescription,
    String? astSignature,
    String? filePath,
    int? lineNumber,
    String? preventiveAction,
    int? recurrenceCount,
    DateTime? createdAt,
    Map<String, dynamic>? metadata,
  }) {
    return CarCausalRecord(
      id: id ?? this.id,
      defectId: defectId ?? this.defectId,
      failureType: failureType ?? this.failureType,
      subsystem: subsystem ?? this.subsystem,
      rootCauseCategory: rootCauseCategory ?? this.rootCauseCategory,
      technicalDescription: technicalDescription ?? this.technicalDescription,
      astSignature: astSignature ?? this.astSignature,
      filePath: filePath ?? this.filePath,
      lineNumber: lineNumber ?? this.lineNumber,
      preventiveAction: preventiveAction ?? this.preventiveAction,
      recurrenceCount: recurrenceCount ?? this.recurrenceCount,
      createdAt: createdAt ?? this.createdAt,
      metadata: metadata ?? this.metadata,
    );
  }

  @override
  String toString() =>
      'CarCausalRecord(id: $id, defectId: $defectId, failureType: ${failureType.code}, '
      'subsystem: ${subsystem.code}, rootCause: ${rootCauseCategory.code}, recurrence: $recurrenceCount)';
}

// ---------------------------------------------------------------------------
// 6. Clasificador e Inferencia Taxonómica Automática (CarTaxonomyClassifier)
// ---------------------------------------------------------------------------

/// Motor heurístico para clasificar mensajes de compilador, linters o excepciones
/// dentro de la taxonomía canónica CAR (§46).
class CarTaxonomyClassifier {
  CarTaxonomyClassifier._();

  /// Clasifica un mensaje de error o excepción en un [CarFailureType] canónico.
  static CarFailureType classifyFailureMessage(
    String message, {
    String? stackTrace,
  }) {
    final String combined =
        '${message.toLowerCase()} ${(stackTrace ?? "").toLowerCase()}';

    if (combined.contains('target of uri does not exist') ||
        combined.contains('undefined_identifier') ||
        combined.contains('syntaxerror') ||
        combined.contains('expected token') ||
        combined.contains('missing_required_param')) {
      return CarFailureType.astSyntaxError;
    }

    if (combined.contains('type_mismatch') ||
        combined.contains("can't be assigned to") ||
        combined.contains('type contract') ||
        combined.contains('invalid_return_type')) {
      return CarFailureType.typeContractViolation;
    }

    if (combined.contains('no such table') ||
        combined.contains('no such column') ||
        combined.contains('schema mismatch') ||
        combined.contains('migration failure') ||
        combined.contains('ddl')) {
      return CarFailureType.schemaDrift;
    }

    if (combined.contains('mock') ||
        combined.contains('mocktail') ||
        combined.contains('mockito') ||
        combined.contains('synthetic data') ||
        combined.contains('datos sintéticos')) {
      return CarFailureType.mockLeak;
    }

    if (combined.contains('tautolog') ||
        combined.contains('sin sad path') ||
        combined.contains('bypass de entry point') ||
        combined.contains('anti-entry-point bypass')) {
      return CarFailureType.tautologicalTest;
    }

    if (combined.contains('out of memory') ||
        combined.contains('resource exhaustion') ||
        combined.contains('too many open files') ||
        combined.contains('quota exceeded')) {
      return CarFailureType.resourceExhaustion;
    }

    if (combined.contains('timeout') ||
        combined.contains('timed out') ||
        combined.contains('timeoutexception')) {
      return CarFailureType.timeoutExceeded;
    }

    if (combined.contains('deadlock') ||
        combined.contains('race condition') ||
        combined.contains('isolate error')) {
      return CarFailureType.concurrencyDeadlock;
    }

    if (combined.contains('perímetro sónico') ||
        combined.contains('boundary leak') ||
        combined.contains('product leak') ||
        combined.contains('flutter in pure dart')) {
      return CarFailureType.boundaryLeak;
    }

    if (combined.contains('inert skill') ||
        combined.contains('skill placebo') ||
        combined.contains('skill inerte')) {
      return CarFailureType.inertSkillPlacebo;
    }

    if (combined.contains('spec ambiguity') ||
        combined.contains('contradicción doctrinal') ||
        combined.contains('especificación incompleta')) {
      return CarFailureType.specAmbiguity;
    }

    if (combined.contains('exception') ||
        combined.contains('error:') ||
        combined.contains('crash') ||
        combined.contains('unhandled')) {
      return CarFailureType.runtimeCrash;
    }

    return CarFailureType.unknown;
  }

  /// Infiere el subsistema responsable en función de la ruta relativa del archivo.
  static CarSubsystem inferSubsystem(String? rawPath, {PlatformGuard? guard}) {
    if (rawPath == null || rawPath.trim().isEmpty) {
      return CarSubsystem.unspecified;
    }

    // Normalización de rutas multi-plataforma agnóstica (§Multi-OS)
    final String normalized = rawPath.replaceAll(r'\', '/').toLowerCase();

    if (normalized.contains('packages/axioma')) {
      return CarSubsystem.sharedKernelAxioma;
    }
    if (normalized.contains('packages/ingestion_engine')) {
      return CarSubsystem.ingestionEngine;
    }
    if (normalized.contains('lib/src/kernel') ||
        normalized.contains('bin/logix') ||
        normalized.startsWith('bin/')) {
      return CarSubsystem.kernelCore;
    }
    if (normalized.contains('.agents/skills')) {
      return CarSubsystem.skillsExecution;
    }
    if (normalized.contains('test/') || normalized.contains('test_harness')) {
      return CarSubsystem.testHarness;
    }
    if (normalized.contains('sqlite') ||
        normalized.contains('.db') ||
        normalized.contains('vault/runtime/database')) {
      return CarSubsystem.storageDatabase;
    }
    if (normalized.contains('inference') ||
        normalized.contains('llm') ||
        normalized.contains('key_pool') ||
        normalized.contains('mwapi')) {
      return CarSubsystem.inferenceBridge;
    }
    if (normalized.contains('linter') ||
        normalized.contains('analysis') ||
        normalized.contains('ast_')) {
      return CarSubsystem.analysisLinter;
    }
    if (normalized.contains('tools/') || normalized.contains('scripts/')) {
      return CarSubsystem.cliTooling;
    }
    if (normalized.contains('satellite') || normalized.contains('fleet')) {
      return CarSubsystem.satelliteNode;
    }
    if (normalized.contains('network') ||
        normalized.contains('http') ||
        normalized.contains('webhook')) {
      return CarSubsystem.networkTransport;
    }

    return CarSubsystem.unspecified;
  }

  /// Infiere la causa raíz técnica a partir del tipo de error o mensaje de fallo.
  static CarTechnicalRootCauseCategory inferTechnicalRootCause(
    String errorPattern,
  ) {
    final String lower = errorPattern.toLowerCase();

    if (lower.contains('ast') ||
        lower.contains('linter') ||
        lower.contains('unresolved identifier') ||
        lower.contains('missing import')) {
      return CarTechnicalRootCauseCategory.missingAstValidation;
    }

    if (lower.contains('edge case') ||
        lower.contains('null pointer') ||
        lower.contains('unexpected null') ||
        lower.contains('boundary value')) {
      return CarTechnicalRootCauseCategory.unhandledEdgeCase;
    }

    if (lower.contains('boundary') ||
        lower.contains('import violation') ||
        lower.contains('cross-node leakage')) {
      return CarTechnicalRootCauseCategory.architecturalBoundaryViolation;
    }

    if (lower.contains('state') || lower.contains('transición inválida')) {
      return CarTechnicalRootCauseCategory.unvalidatedStateTransition;
    }

    if (lower.contains('ddl') ||
        lower.contains('column') ||
        lower.contains('table') ||
        lower.contains('schema')) {
      return CarTechnicalRootCauseCategory.ddlContractMismatch;
    }

    if (lower.contains('throwsa') ||
        lower.contains('sad path') ||
        lower.contains('sin test negativo')) {
      return CarTechnicalRootCauseCategory.missingNegativeAssertion;
    }

    if (lower.contains('memory') ||
        lower.contains('exhaust') ||
        lower.contains('chunking')) {
      return CarTechnicalRootCauseCategory.unboundedResourceAllocation;
    }

    if (lower.contains('race') ||
        lower.contains('deadlock') ||
        lower.contains('concurrency') ||
        lower.contains('unawaited')) {
      return CarTechnicalRootCauseCategory.asynchronousRaceCondition;
    }

    if (lower.contains('empty catch') ||
        lower.contains('silence') ||
        lower.contains('catch (_)')) {
      return CarTechnicalRootCauseCategory.silentExceptionSuppression;
    }

    if (lower.contains('dependency') ||
        lower.contains('pubspec') ||
        lower.contains('package version')) {
      return CarTechnicalRootCauseCategory.dependencyDrift;
    }

    if (lower.contains('spec') ||
        lower.contains('doctrina') ||
        lower.contains('contradiction')) {
      return CarTechnicalRootCauseCategory.specificationContradiction;
    }

    if (lower.contains('env') ||
        lower.contains('sandbox') ||
        lower.contains('isolation')) {
      return CarTechnicalRootCauseCategory.environmentIsolationFailure;
    }

    return CarTechnicalRootCauseCategory.unclassifiedTechnical;
  }

  /// Fábrica determinista para crear y registrar un [CarCausalRecord] completo.
  static CarCausalRecord createRecord({
    String? id,
    required String defectId,
    required String technicalDescription,
    CarFailureType? failureType,
    CarSubsystem? subsystem,
    CarTechnicalRootCauseCategory? rootCauseCategory,
    String? rawErrorMessage,
    String? filePath,
    int? lineNumber,
    String? astSignature,
    String? preventiveAction,
    int recurrenceCount = 1,
    DateTime? createdAt,
    Map<String, dynamic> metadata = const <String, dynamic>{},
  }) {
    final CarFailureType resolvedFailure =
        failureType ??
        (rawErrorMessage != null
            ? classifyFailureMessage(rawErrorMessage)
            : CarFailureType.unknown);

    final CarSubsystem resolvedSubsystem =
        subsystem ?? inferSubsystem(filePath);

    final CarTechnicalRootCauseCategory resolvedRootCause =
        rootCauseCategory ??
        (rawErrorMessage != null
            ? inferTechnicalRootCause(rawErrorMessage)
            : inferTechnicalRootCause(technicalDescription));

    final String recordId =
        id ??
        'car-rec-${DateTime.now().toUtc().microsecondsSinceEpoch.toRadixString(16)}';

    return CarCausalRecord(
      id: recordId,
      defectId: defectId,
      failureType: resolvedFailure,
      subsystem: resolvedSubsystem,
      rootCauseCategory: resolvedRootCause,
      technicalDescription: technicalDescription,
      astSignature: astSignature,
      filePath: filePath,
      lineNumber: lineNumber,
      preventiveAction: preventiveAction,
      recurrenceCount: recurrenceCount,
      createdAt: createdAt,
      metadata: metadata,
    );
  }
}
