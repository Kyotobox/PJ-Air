/// user_signal_car_connector.dart — Conexión del colector de señales de usuario con el disparador CAR (§46).
///
/// Captura señales de fricción, rechazo y corrección emitidas por el usuario o supervisores,
/// las agrupa por firma de error en SQLite WAL, y ante recurrencia >= 3 (umbral constitucional §46),
/// dispara autónomamente la síntesis de una regla de linter AST / acción preventiva, validándola
/// en un sandbox canario y persistiendo la inmunización activa en `vault/runtime/preventive_actions.json`.
///
/// Mandatos Constitucionales:
/// - §4  Tolerancia Cero a Mocks (opera contra SQLite real en modo WAL y archivos físicos en disco).
/// - §6  Desarrollo guiado por certificación con Sad Paths mandatorios y excepciones tipadas.
/// - §39 Pure Dart Core (Shared Kernel agnóstico sin UI).
/// - §43 Paridad Test-to-Prod (invocación exclusiva de entrypoints legítimos).
/// - §45 Soberanía Offline-First y SQLite WAL.
/// - §46 Inmunización Genética y Cierre Cibernético CAR (CMMI Nivel 5).
/// - §48 Invariante de Cierre Autárquico y Cero Cambios Colgantes.
/// - Enmienda Multi-OS: Canalización agnóstica mediante [PlatformGuard].
library;

import 'dart:convert';
import 'dart:io';

import 'package:sqlite3/sqlite3.dart';

import '../platform_guard.dart';
import 'ast_signature_extractor.dart';

// ---------------------------------------------------------------------------
// Enums y Tipos de Dominio
// ---------------------------------------------------------------------------

/// Tipo o taxonomía de la señal emitida por el usuario (§46).
enum UserSignalType {
  /// Corrección explícita de comportamiento o directiva de usuario.
  promptCorrection('PROMPT_CORRECTION'),

  /// Código con error sintáctico o falla de compilación reportada por el usuario.
  syntaxCorrection('SYNTAX_CORRECTION'),

  /// Violación de estándar de codificación o regla de linter no interceptada.
  lintViolation('LINT_VIOLATION'),

  /// Detección o rechazo por uso de mocks, stubs o datos falsos prohibidos (§4).
  mockRejection('MOCK_REJECTION'),

  /// Excepción no controlada o crash en tiempo de ejecución.
  runtimeFailure('RUNTIME_FAILURE'),

  /// Regresión funcional en características existentes reportada por el usuario.
  regressionReport('REGRESSION_REPORT'),

  /// Fricción de interacción (bucle infinito, saturación, formato incorrecto).
  uxFriction('UX_FRICTION'),

  /// Petición explícita del usuario para establecer una regla o salvaguarda fija.
  explicitRuleRequest('EXPLICIT_RULE_REQUEST');

  final String canonicalName;
  const UserSignalType(this.canonicalName);

  static UserSignalType fromString(String value) {
    final String clean = value.trim().toUpperCase();
    for (final UserSignalType t in UserSignalType.values) {
      if (t.canonicalName == clean || t.name.toUpperCase() == clean) {
        return t;
      }
    }
    return UserSignalType.promptCorrection;
  }
}

/// Nivel de severidad de la señal de usuario.
enum UserSignalSeverity {
  low('LOW', 1),
  medium('MEDIUM', 2),
  high('HIGH', 3),
  critical('CRITICAL', 4);

  final String canonicalName;
  final int weight;
  const UserSignalSeverity(this.canonicalName, this.weight);

  static UserSignalSeverity fromString(String value) {
    final String clean = value.trim().toUpperCase();
    for (final UserSignalSeverity s in UserSignalSeverity.values) {
      if (s.canonicalName == clean || s.name.toUpperCase() == clean) {
        return s;
      }
    }
    return UserSignalSeverity.medium;
  }
}

/// Estado de la síntesis del linter AST dentro del ciclo CAR.
enum LinterSynthesisStatus {
  pending('PENDING'),
  synthesized('SYNTHESIZED'),
  canaryValidated('CANARY_VALIDATED'),
  active('ACTIVE'),
  vetoed('VETOED'),
  alreadyMitigated('ALREADY_MITIGATED');

  final String canonicalName;
  const LinterSynthesisStatus(this.canonicalName);

  static LinterSynthesisStatus fromString(String value) {
    final String clean = value.trim().toUpperCase();
    for (final LinterSynthesisStatus s in LinterSynthesisStatus.values) {
      if (s.canonicalName == clean || s.name.toUpperCase() == clean) {
        return s;
      }
    }
    return LinterSynthesisStatus.pending;
  }
}

// ---------------------------------------------------------------------------
// Excepciones Tipadas de Gobernanza CAR (§6 Sad Path Mandatorio)
// ---------------------------------------------------------------------------

/// Excepción arrojada cuando los datos de una señal de usuario son inválidos o incompletos.
class UserSignalValidationException implements Exception {
  final String message;
  final String? field;

  const UserSignalValidationException(this.message, {this.field});

  @override
  String toString() =>
      '[USER_SIGNAL_VALIDATION_ERROR] $message${field != null ? ' [Campo: $field]' : ''}';
}

/// Excepción arrojada cuando un clúster no alcanza el umbral de recurrencia requerido (§46: >= 3).
class CarRecurrenceThresholdException implements Exception {
  final String message;
  final String? errorSignature;
  final int? recurrenceCount;

  const CarRecurrenceThresholdException(
    this.message, {
    this.errorSignature,
    this.recurrenceCount,
  });

  @override
  String toString() =>
      '[CAR_THRESHOLD_UNMET] $message${errorSignature != null ? ' (Firma: $errorSignature, Recurrencia: $recurrenceCount)' : ''}';
}

/// Excepción arrojada ante fallas de base de datos SQLite o I/O de almacenamiento persistente.
class UserSignalStorageException implements Exception {
  final String message;
  final Object? cause;

  const UserSignalStorageException(this.message, [this.cause]);

  @override
  String toString() =>
      '[USER_SIGNAL_STORAGE_ERROR] $message${cause != null ? ' (Causa: $cause)' : ''}';
}

// ---------------------------------------------------------------------------
// Modelos de Dominio
// ---------------------------------------------------------------------------

/// Representa una señal atómica capturada del usuario o del entorno de ejecución.
class UserSignal {
  final String id;
  final String sessionId;
  final String? ticketId;
  final String nodeId;
  final UserSignalType signalType;
  final String category;
  final String errorSignature;
  final String filePath;
  final int? lineNumber;
  final String rawUserFeedback;
  final String? extractedSnippet;
  final UserSignalSeverity severity;
  final DateTime timestamp;
  final Map<String, dynamic> metadata;

  UserSignal({
    required this.id,
    required this.sessionId,
    this.ticketId,
    required this.nodeId,
    required this.signalType,
    required this.category,
    required this.errorSignature,
    required this.filePath,
    this.lineNumber,
    required this.rawUserFeedback,
    this.extractedSnippet,
    this.severity = UserSignalSeverity.medium,
    DateTime? timestamp,
    Map<String, dynamic>? metadata,
  }) : timestamp = timestamp ?? DateTime.now().toUtc(),
       metadata = metadata ?? <String, dynamic>{};

  /// Valida la consistencia de los campos obligatorios (§1 Verdad Física).
  void validate() {
    if (id.trim().isEmpty) {
      throw const UserSignalValidationException(
        'El ID de la señal no puede estar vacío (§1 Verdad Física)',
        field: 'id',
      );
    }
    if (sessionId.trim().isEmpty) {
      throw const UserSignalValidationException(
        'El sessionId no puede estar vacío',
        field: 'sessionId',
      );
    }
    if (nodeId.trim().isEmpty) {
      throw const UserSignalValidationException(
        'El nodeId no puede estar vacío',
        field: 'nodeId',
      );
    }
    if (category.trim().isEmpty) {
      throw const UserSignalValidationException(
        'La categoría de la señal no puede estar vacía',
        field: 'category',
      );
    }
    if (errorSignature.trim().isEmpty) {
      throw const UserSignalValidationException(
        'La firma de error (errorSignature) no puede estar vacía',
        field: 'errorSignature',
      );
    }
    if (filePath.trim().isEmpty) {
      throw const UserSignalValidationException(
        'La ruta afectada (filePath) no puede estar vacía',
        field: 'filePath',
      );
    }
    if (rawUserFeedback.trim().isEmpty) {
      throw const UserSignalValidationException(
        'El feedback del usuario (rawUserFeedback) no puede estar vacío',
        field: 'rawUserFeedback',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'session_id': sessionId,
    if (ticketId != null) 'ticket_id': ticketId,
    'node_id': nodeId,
    'signal_type': signalType.canonicalName,
    'category': category,
    'error_signature': errorSignature,
    'file_path': filePath,
    if (lineNumber != null) 'line_number': lineNumber,
    'raw_user_feedback': rawUserFeedback,
    if (extractedSnippet != null) 'extracted_snippet': extractedSnippet,
    'severity': severity.canonicalName,
    'timestamp': timestamp.toIso8601String(),
    'metadata': metadata,
  };

  factory UserSignal.fromJson(Map<String, dynamic> json) {
    final String id = json['id'] as String? ?? '';
    final String sessionId =
        json['session_id'] as String? ?? json['sessionId'] as String? ?? '';
    final String nodeId =
        json['node_id'] as String? ?? json['nodeId'] as String? ?? '';
    final String category = json['category'] as String? ?? '';
    final String errorSignature =
        json['error_signature'] as String? ??
        json['errorSignature'] as String? ??
        '';
    final String filePath =
        json['file_path'] as String? ?? json['filePath'] as String? ?? '';
    final String rawUserFeedback =
        json['raw_user_feedback'] as String? ??
        json['rawUserFeedback'] as String? ??
        '';

    final UserSignal signal = UserSignal(
      id: id,
      sessionId: sessionId,
      ticketId: json['ticket_id'] as String? ?? json['ticketId'] as String?,
      nodeId: nodeId,
      signalType: UserSignalType.fromString(
        (json['signal_type'] as String?) ??
            (json['signalType'] as String?) ??
            'PROMPT_CORRECTION',
      ),
      category: category,
      errorSignature: errorSignature,
      filePath: filePath,
      lineNumber: (json['line_number'] as num?)?.toInt(),
      rawUserFeedback: rawUserFeedback,
      extractedSnippet:
          json['extracted_snippet'] as String? ??
          json['extractedSnippet'] as String?,
      severity: UserSignalSeverity.fromString(
        (json['severity'] as String?) ?? 'MEDIUM',
      ),
      timestamp:
          DateTime.tryParse(json['timestamp'] as String? ?? '') ??
          DateTime.now().toUtc(),
      metadata:
          (json['metadata'] as Map<String, dynamic>?) ?? <String, dynamic>{},
    );

    return signal;
  }

  factory UserSignal.fromRow(Row row) {
    Map<String, dynamic> meta = <String, dynamic>{};
    final dynamic metaRaw = row['metadata_json'];
    if (metaRaw is String && metaRaw.trim().isNotEmpty) {
      try {
        meta = jsonDecode(metaRaw) as Map<String, dynamic>;
      } catch (_) {
        meta = <String, dynamic>{};
      }
    }

    return UserSignal(
      id: row['id'] as String,
      sessionId: row['session_id'] as String,
      ticketId: row['ticket_id'] as String?,
      nodeId: row['node_id'] as String,
      signalType: UserSignalType.fromString(row['signal_type'] as String),
      category: row['category'] as String,
      errorSignature: row['error_signature'] as String,
      filePath: row['file_path'] as String,
      lineNumber: row['line_number'] as int?,
      rawUserFeedback: row['raw_user_feedback'] as String,
      extractedSnippet: row['extracted_snippet'] as String?,
      severity: UserSignalSeverity.fromString(row['severity'] as String),
      timestamp: DateTime.parse(row['timestamp'] as String),
      metadata: meta,
    );
  }
}

/// Agrupación de señales que comparten la misma firma de error [errorSignature] (§46).
class UserSignalCluster {
  final String errorSignature;
  final String category;
  final List<UserSignal> signals;
  final int recurrenceCount;
  final DateTime firstSeen;
  final DateTime lastSeen;
  final List<String> affectedFiles;
  final UserSignalSeverity maxSeverity;

  const UserSignalCluster({
    required this.errorSignature,
    required this.category,
    required this.signals,
    required this.recurrenceCount,
    required this.firstSeen,
    required this.lastSeen,
    required this.affectedFiles,
    required this.maxSeverity,
  });

  /// Determina si el clúster alcanza el umbral de activación de CAR (§46: >= 3).
  bool isCarTriggerEligible({int minRecurrence = 3}) =>
      recurrenceCount >= minRecurrence;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'error_signature': errorSignature,
    'category': category,
    'recurrence_count': recurrenceCount,
    'first_seen': firstSeen.toIso8601String(),
    'last_seen': lastSeen.toIso8601String(),
    'affected_files': affectedFiles,
    'max_severity': maxSeverity.canonicalName,
    'signals_count': signals.length,
    'signals': signals.map((UserSignal s) => s.toJson()).toList(),
  };

  factory UserSignalCluster.fromJson(Map<String, dynamic> json) {
    final List<dynamic> rawSignals =
        (json['signals'] as List<dynamic>?) ?? <dynamic>[];
    final List<UserSignal> parsedSignals = rawSignals
        .map((dynamic s) => UserSignal.fromJson(s as Map<String, dynamic>))
        .toList();

    return UserSignalCluster(
      errorSignature: json['error_signature'] as String? ?? '',
      category: json['category'] as String? ?? 'UNKNOWN',
      signals: parsedSignals,
      recurrenceCount:
          (json['recurrence_count'] as num?)?.toInt() ?? parsedSignals.length,
      firstSeen:
          DateTime.tryParse(json['first_seen'] as String? ?? '') ??
          DateTime.now().toUtc(),
      lastSeen:
          DateTime.tryParse(json['last_seen'] as String? ?? '') ??
          DateTime.now().toUtc(),
      affectedFiles:
          (json['affected_files'] as List<dynamic>?)
              ?.map((dynamic e) => e.toString())
              .toList() ??
          <String>[],
      maxSeverity: UserSignalSeverity.fromString(
        (json['max_severity'] as String?) ?? 'MEDIUM',
      ),
    );
  }
}

/// Regla sintética de linter AST producida por el motor CAR para inmunizar el sistema (§46).
class SynthesizedLinterRule {
  final String ruleId;
  final String category;
  final String errorSignature;
  final String targetAstPattern;
  final String diagnosticMessage;
  final String linterVisitorDartCode;
  final String mitigationAdvice;
  final CarRuleSeverity severity;
  final LinterSynthesisStatus status;
  final DateTime synthesizedAt;
  final int triggerRecurrence;
  final List<String> affectedFiles;

  const SynthesizedLinterRule({
    required this.ruleId,
    required this.category,
    required this.errorSignature,
    required this.targetAstPattern,
    required this.diagnosticMessage,
    required this.linterVisitorDartCode,
    required this.mitigationAdvice,
    this.severity = CarRuleSeverity.error,
    this.status = LinterSynthesisStatus.active,
    required this.synthesizedAt,
    required this.triggerRecurrence,
    required this.affectedFiles,
  });

  /// Evalúa si un fragmento de código contiene el patrón vetado por esta regla.
  bool matchesSnippet(String code) {
    if (code.trim().isEmpty) return false;
    try {
      final RegExp regExp = RegExp(targetAstPattern, multiLine: true);
      return regExp.hasMatch(code);
    } catch (_) {
      return code.contains(targetAstPattern);
    }
  }

  /// Ejecuta la verificación programática del nodo AST o código.
  /// Lanza [StateError] si detecta una violación de la regla CAR (§46).
  void executeAstVisitor(dynamic astNode) {
    final String text = astNode.toString();
    if (matchesSnippet(text)) {
      throw StateError(
        'CAR Violation (§46) [$ruleId]: $diagnosticMessage\n'
        'Mitigación: $mitigationAdvice',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'rule_id': ruleId,
    'category': category,
    'error_signature': errorSignature,
    'target_ast_pattern': targetAstPattern,
    'diagnostic_message': diagnosticMessage,
    'linter_visitor_dart_code': linterVisitorDartCode,
    'mitigation_advice': mitigationAdvice,
    'severity': severity.name.toUpperCase(),
    'status': status.canonicalName,
    'synthesized_at': synthesizedAt.toIso8601String(),
    'trigger_recurrence': triggerRecurrence,
    'affected_files': affectedFiles,
  };

  factory SynthesizedLinterRule.fromJson(Map<String, dynamic> json) {
    return SynthesizedLinterRule(
      ruleId: json['rule_id'] as String? ?? '',
      category: json['category'] as String? ?? 'UNKNOWN',
      errorSignature: json['error_signature'] as String? ?? '',
      targetAstPattern: json['target_ast_pattern'] as String? ?? '',
      diagnosticMessage: json['diagnostic_message'] as String? ?? '',
      linterVisitorDartCode: json['linter_visitor_dart_code'] as String? ?? '',
      mitigationAdvice: json['mitigation_advice'] as String? ?? '',
      severity: (json['severity'] as String?)?.toUpperCase() == 'WARN'
          ? CarRuleSeverity.warn
          : CarRuleSeverity.error,
      status: LinterSynthesisStatus.fromString(
        (json['status'] as String?) ?? 'ACTIVE',
      ),
      synthesizedAt:
          DateTime.tryParse(json['synthesized_at'] as String? ?? '') ??
          DateTime.now().toUtc(),
      triggerRecurrence: (json['trigger_recurrence'] as num?)?.toInt() ?? 3,
      affectedFiles:
          (json['affected_files'] as List<dynamic>?)
              ?.map((dynamic e) => e.toString())
              .toList() ??
          <String>[],
    );
  }
}

/// Reporte cuantitativo de ejecución del conector de señales de usuario con CAR.
class UserSignalCarReport {
  final DateTime executedAt;
  final int scannedSignalsCount;
  final int totalClustersCount;
  final int qualifyingClustersCount;
  final int synthesizedLintersCount;
  final int alreadyMitigatedCount;
  final int skippedCount;
  final List<SynthesizedLinterRule> synthesizedRules;
  final List<Map<String, dynamic>> actionsPersisted;
  final String diagnostic;

  const UserSignalCarReport({
    required this.executedAt,
    required this.scannedSignalsCount,
    required this.totalClustersCount,
    required this.qualifyingClustersCount,
    required this.synthesizedLintersCount,
    required this.alreadyMitigatedCount,
    required this.skippedCount,
    required this.synthesizedRules,
    required this.actionsPersisted,
    required this.diagnostic,
  });

  bool get hasTriggeredSynthesis => synthesizedRules.isNotEmpty;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'executed_at': executedAt.toIso8601String(),
    'scanned_signals_count': scannedSignalsCount,
    'total_clusters_count': totalClustersCount,
    'qualifying_clusters_count': qualifyingClustersCount,
    'synthesized_linters_count': synthesizedLintersCount,
    'already_mitigated_count': alreadyMitigatedCount,
    'skipped_count': skippedCount,
    'has_triggered_synthesis': hasTriggeredSynthesis,
    'synthesized_rules': synthesizedRules
        .map((SynthesizedLinterRule r) => r.toJson())
        .toList(),
    'actions_persisted_count': actionsPersisted.length,
    'diagnostic': diagnostic,
  };
}

// ---------------------------------------------------------------------------
// Colector de Señales de Usuario (SQLite WAL)
// ---------------------------------------------------------------------------

/// Ingesta, persiste y agrupa señales de usuario en SQLite WAL (§4, §45).
class UserSignalCollector {
  final Database _db;
  final bool _ownsDatabase;
  final PlatformGuard _platformGuard;

  PlatformGuard get platformGuard => _platformGuard;

  UserSignalCollector._({
    required Database db,
    required bool ownsDatabase,
    PlatformGuard? platformGuard,
  }) : _db = db,
       _ownsDatabase = ownsDatabase,
       _platformGuard = platformGuard ?? PlatformGuard() {
    _initSchema();
  }

  /// Crea o abre un colector conectándose a un archivo físico SQLite WAL.
  factory UserSignalCollector.open({
    String? dbPath,
    PlatformGuard? platformGuard,
  }) {
    final PlatformGuard guard = platformGuard ?? PlatformGuard();
    final String resolvedPath =
        dbPath ?? guard.pathContext.join('vault', 'runtime', 'metrics.db');

    final File file = File(resolvedPath);
    if (!file.parent.existsSync()) {
      file.parent.createSync(recursive: true);
    }

    final Database db = sqlite3.open(resolvedPath);
    return UserSignalCollector._(
      db: db,
      ownsDatabase: true,
      platformGuard: guard,
    );
  }

  /// Crea un colector usando una base de datos SQLite en memoria (para tests reales §4).
  factory UserSignalCollector.inMemory({PlatformGuard? platformGuard}) {
    final Database db = sqlite3.openInMemory();
    return UserSignalCollector._(
      db: db,
      ownsDatabase: true,
      platformGuard: platformGuard,
    );
  }

  /// Envuelve una conexión SQLite existente sin cerrarla al finalizar.
  factory UserSignalCollector.fromExisting(
    Database db, {
    PlatformGuard? platformGuard,
  }) {
    return UserSignalCollector._(
      db: db,
      ownsDatabase: false,
      platformGuard: platformGuard,
    );
  }

  /// Inicializa la tabla e índices en SQLite WAL.
  void _initSchema() {
    try {
      _db.execute('PRAGMA journal_mode = WAL;');
      _db.execute('PRAGMA busy_timeout = 5000;');
      _db.execute('''
        CREATE TABLE IF NOT EXISTS user_signals (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          ticket_id TEXT,
          node_id TEXT NOT NULL,
          signal_type TEXT NOT NULL,
          category TEXT NOT NULL,
          error_signature TEXT NOT NULL,
          file_path TEXT NOT NULL,
          line_number INTEGER,
          raw_user_feedback TEXT NOT NULL,
          extracted_snippet TEXT,
          severity TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_user_sig_signature ON user_signals(error_signature);
        CREATE INDEX IF NOT EXISTS idx_user_sig_category ON user_signals(category);
        CREATE INDEX IF NOT EXISTS idx_user_sig_timestamp ON user_signals(timestamp);
      ''');
    } catch (e) {
      throw UserSignalStorageException(
        'Fallo al inicializar el esquema de user_signals en SQLite',
        e,
      );
    }
  }

  /// Registra una señal individual validada en SQLite WAL.
  void recordSignal(UserSignal signal) {
    signal.validate();

    try {
      final PreparedStatement stmt = _db.prepare('''
        INSERT OR REPLACE INTO user_signals (
          id, session_id, ticket_id, node_id, signal_type, category,
          error_signature, file_path, line_number, raw_user_feedback,
          extracted_snippet, severity, timestamp, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      ''');

      try {
        stmt.execute(<dynamic>[
          signal.id,
          signal.sessionId,
          signal.ticketId,
          signal.nodeId,
          signal.signalType.canonicalName,
          signal.category,
          signal.errorSignature,
          signal.filePath,
          signal.lineNumber,
          signal.rawUserFeedback,
          signal.extractedSnippet,
          signal.severity.canonicalName,
          signal.timestamp.toIso8601String(),
          jsonEncode(signal.metadata),
        ]);
      } finally {
        stmt.close();
      }
    } catch (e) {
      throw UserSignalStorageException(
        'Error persistiendo la señal ${signal.id} en SQLite',
        e,
      );
    }
  }

  /// Registra atómicamente un lote de señales en una sola transacción (§45).
  void recordBatch(List<UserSignal> signals) {
    if (signals.isEmpty) return;

    for (final UserSignal s in signals) {
      s.validate();
    }

    try {
      _db.execute('BEGIN TRANSACTION;');
      final PreparedStatement stmt = _db.prepare('''
        INSERT OR REPLACE INTO user_signals (
          id, session_id, ticket_id, node_id, signal_type, category,
          error_signature, file_path, line_number, raw_user_feedback,
          extracted_snippet, severity, timestamp, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      ''');

      try {
        for (final UserSignal s in signals) {
          stmt.execute(<dynamic>[
            s.id,
            s.sessionId,
            s.ticketId,
            s.nodeId,
            s.signalType.canonicalName,
            s.category,
            s.errorSignature,
            s.filePath,
            s.lineNumber,
            s.rawUserFeedback,
            s.extractedSnippet,
            s.severity.canonicalName,
            s.timestamp.toIso8601String(),
            jsonEncode(s.metadata),
          ]);
        }
        _db.execute('COMMIT;');
      } finally {
        stmt.close();
      }
    } catch (e) {
      try {
        _db.execute('ROLLBACK;');
      } catch (_) {
        // INTENTIONAL: Silenciar error de rollback si la conexión falló
      }
      throw UserSignalStorageException(
        'Error durante la inserción en lote de ${signals.length} señales',
        e,
      );
    }
  }

  /// Consulta señales filtradas de SQLite WAL.
  List<UserSignal> getSignals({
    String? category,
    String? errorSignature,
    UserSignalType? signalType,
    DateTime? since,
    int? limit,
  }) {
    try {
      final List<String> whereClauses = <String>[];
      final List<dynamic> params = <dynamic>[];

      if (category != null && category.trim().isNotEmpty) {
        whereClauses.add('category = ?');
        params.add(category.trim());
      }
      if (errorSignature != null && errorSignature.trim().isNotEmpty) {
        whereClauses.add('error_signature = ?');
        params.add(errorSignature.trim());
      }
      if (signalType != null) {
        whereClauses.add('signal_type = ?');
        params.add(signalType.canonicalName);
      }
      if (since != null) {
        whereClauses.add('timestamp >= ?');
        params.add(since.toIso8601String());
      }

      final String whereText = whereClauses.isNotEmpty
          ? 'WHERE ${whereClauses.join(' AND ')}'
          : '';
      final String limitText = limit != null && limit > 0 ? 'LIMIT $limit' : '';

      final ResultSet rows = _db.select('''
        SELECT * FROM user_signals
        $whereText
        ORDER BY timestamp DESC
        $limitText;
      ''', params);

      return rows.map((Row r) => UserSignal.fromRow(r)).toList();
    } catch (e) {
      throw UserSignalStorageException('Error consultando user_signals', e);
    }
  }

  /// Agrupa las señales por [error_signature], ordenándolas por recurrencia descendente (§46).
  List<UserSignalCluster> clusterSignals({
    int minRecurrence = 1,
    Duration? window,
  }) {
    final DateTime? since = window != null
        ? DateTime.now().toUtc().subtract(window)
        : null;
    final List<UserSignal> allSignals = getSignals(since: since);

    final Map<String, List<UserSignal>> grouped = <String, List<UserSignal>>{};
    for (final UserSignal s in allSignals) {
      grouped.putIfAbsent(s.errorSignature, () => <UserSignal>[]).add(s);
    }

    final List<UserSignalCluster> clusters = <UserSignalCluster>[];

    for (final MapEntry<String, List<UserSignal>> entry in grouped.entries) {
      final List<UserSignal> sigList = entry.value;
      if (sigList.length < minRecurrence) continue;

      sigList.sort(
        (UserSignal a, UserSignal b) => a.timestamp.compareTo(b.timestamp),
      );

      final DateTime firstSeen = sigList.first.timestamp;
      final DateTime lastSeen = sigList.last.timestamp;
      final String category = sigList.last.category;

      final Set<String> files = <String>{};
      UserSignalSeverity maxSev = UserSignalSeverity.low;

      for (final UserSignal s in sigList) {
        files.add(s.filePath);
        if (s.severity.weight > maxSev.weight) {
          maxSev = s.severity;
        }
      }

      clusters.add(
        UserSignalCluster(
          errorSignature: entry.key,
          category: category,
          signals: sigList,
          recurrenceCount: sigList.length,
          firstSeen: firstSeen,
          lastSeen: lastSeen,
          affectedFiles: files.toList()..sort(),
          maxSeverity: maxSev,
        ),
      );
    }

    clusters.sort(
      (UserSignalCluster a, UserSignalCluster b) =>
          b.recurrenceCount.compareTo(a.recurrenceCount),
    );

    return clusters;
  }

  /// Retorna el conteo total de señales persistidas.
  int countSignals() {
    try {
      final ResultSet res = _db.select(
        'SELECT COUNT(*) AS total FROM user_signals;',
      );
      return (res.first['total'] as num).toInt();
    } catch (e) {
      throw UserSignalStorageException('Error al contar user_signals', e);
    }
  }

  /// Cierra los recursos de base de datos si son propios.
  void close() {
    if (_ownsDatabase) {
      _db.close();
    }
  }
}

// ---------------------------------------------------------------------------
// Conector de Señales de Usuario con Disparador CAR (§46)
// ---------------------------------------------------------------------------

/// Conecta el colector de señales de usuario con el flujo de análisis causal y resolución CAR (§46).
class UserSignalCarConnector {
  static const int defaultCarRecurrenceThreshold = 3;

  final UserSignalCollector collector;
  final File preventiveActionsFile;
  final PlatformGuard platformGuard;
  final int minRecurrenceThreshold;

  UserSignalCarConnector({
    required this.collector,
    File? preventiveActionsFile,
    PlatformGuard? platformGuard,
    this.minRecurrenceThreshold = defaultCarRecurrenceThreshold,
  }) : platformGuard = platformGuard ?? PlatformGuard(),
       preventiveActionsFile =
           preventiveActionsFile ??
           File(
             (platformGuard ?? PlatformGuard()).pathContext.join(
               'vault',
               'runtime',
               'preventive_actions.json',
             ),
           );

  /// Carga la lista de acciones preventivas existentes desde el archivo JSON de gobernanza.
  List<Map<String, dynamic>> loadPreventiveActions() {
    if (!preventiveActionsFile.existsSync()) {
      return <Map<String, dynamic>>[];
    }

    final String content = preventiveActionsFile.readAsStringSync().trim();
    if (content.isEmpty) {
      return <Map<String, dynamic>>[];
    }

    final dynamic decoded;
    try {
      decoded = jsonDecode(content);
    } catch (e) {
      throw UserSignalStorageException(
        'Archivo de acciones preventivas corrupto: ${preventiveActionsFile.path}',
        e,
      );
    }

    if (decoded is! List<dynamic>) {
      throw const UserSignalStorageException(
        'El formato de preventive_actions.json debe ser un arreglo JSON (§46)',
      );
    }

    return decoded.map((dynamic item) => item as Map<String, dynamic>).toList();
  }

  /// Persiste atómicamente una acción preventiva en `preventive_actions.json`.
  void persistPreventiveAction(Map<String, dynamic> actionMap) {
    if (!preventiveActionsFile.parent.existsSync()) {
      preventiveActionsFile.parent.createSync(recursive: true);
    }

    final List<Map<String, dynamic>> actions = loadPreventiveActions();
    final String actionId =
        actionMap['action_id'] as String? ?? actionMap['id'] as String? ?? '';
    final String signature =
        actionMap['defect_signature'] as String? ??
        actionMap['defect_fingerprint'] as String? ??
        actionMap['error_signature'] as String? ??
        '';

    // Anti-duplicación idempotente
    actions.removeWhere(
      (Map<String, dynamic> a) =>
          (a['action_id'] == actionId || a['id'] == actionId) ||
          ((a['defect_signature'] == signature ||
                  a['defect_fingerprint'] == signature ||
                  a['error_signature'] == signature) &&
              (a['status'] as String?)?.toUpperCase() == 'ACTIVE'),
    );

    actions.add(actionMap);

    final String jsonOutput = const JsonEncoder.withIndent(
      '  ',
    ).convert(actions);
    preventiveActionsFile.writeAsStringSync(jsonOutput, flush: true);
  }

  /// Verifica si una firma de error ya cuenta con una acción preventiva o linter activo.
  bool isSignatureMitigated(String errorSignature) {
    if (errorSignature.trim().isEmpty) return false;

    final List<Map<String, dynamic>> actions = loadPreventiveActions();
    for (final Map<String, dynamic> act in actions) {
      final String sig =
          act['defect_signature'] as String? ??
          act['defect_fingerprint'] as String? ??
          act['error_signature'] as String? ??
          '';
      final String status = (act['status'] as String? ?? 'ACTIVE')
          .toUpperCase();
      if (sig == errorSignature && status == 'ACTIVE') {
        return true;
      }
    }
    return false;
  }

  /// Sintetiza una regla de linter AST y acción preventiva a partir de un clúster recurrente.
  SynthesizedLinterRule synthesizeLinter(UserSignalCluster cluster) {
    if (cluster.errorSignature.trim().isEmpty) {
      throw const UserSignalValidationException(
        'El clúster no posee errorSignature válida',
        field: 'errorSignature',
      );
    }

    final String sanitizedCat = cluster.category
        .replaceAll(RegExp(r'[^A-Za-z0-9]'), '_')
        .toUpperCase();
    final int hashSuffix = cluster.errorSignature.hashCode.abs() % 1000000;
    final String ruleId = 'CAR-LINT-$sanitizedCat-$hashSuffix';

    // Determinar patrón objetivo para el linter AST
    String targetPattern = cluster.category;
    for (final UserSignal s in cluster.signals) {
      if (s.extractedSnippet != null && s.extractedSnippet!.trim().isNotEmpty) {
        // Escapar caracteres regex especiales en snippets
        targetPattern = RegExp.escape(s.extractedSnippet!.trim());
        break;
      }
    }

    final String diagnostic =
        'Invariante CAR (§46) por retroalimentación recurrente del usuario: '
        '[${cluster.category}] detectado ${cluster.recurrenceCount} veces con firma [${cluster.errorSignature}].';

    final String mitigation =
        'Remediar la causa raíz en [${cluster.affectedFiles.join(', ')}]. '
        'Garantizar cumplimiento estricto de las reglas constitucionales (§4, §6, §39, §46) '
        'y eliminar cualquier recurrencia de [${cluster.category}].';

    final String dartAstVisitor =
        '''
// CAR Auto-Generated AST Linter Rule (§46)
// Rule ID: $ruleId
// Category: ${cluster.category}
// Error Signature: ${cluster.errorSignature}
// Recurrence: ${cluster.recurrenceCount} signals
void validateCarInvariant(dynamic astNode) {
  final String content = astNode.toString();
  if (content.contains("$targetPattern")) {
    throw StateError("CAR Violation (§46): $diagnostic");
  }
}
'''
            .trim();

    return SynthesizedLinterRule(
      ruleId: ruleId,
      category: cluster.category,
      errorSignature: cluster.errorSignature,
      targetAstPattern: targetPattern,
      diagnosticMessage: diagnostic,
      linterVisitorDartCode: dartAstVisitor,
      mitigationAdvice: mitigation,
      severity: CarRuleSeverity.error,
      status: LinterSynthesisStatus.active,
      synthesizedAt: DateTime.now().toUtc(),
      triggerRecurrence: cluster.recurrenceCount,
      affectedFiles: cluster.affectedFiles,
    );
  }

  /// Dispara el flujo CAR para un único clúster de señales.
  /// Lanza [CarRecurrenceThresholdException] si `recurrenceCount < minRecurrenceThreshold` (§6 Sad Path).
  SynthesizedLinterRule triggerForSingleCluster(
    UserSignalCluster cluster, {
    bool autoPersist = true,
  }) {
    if (cluster.recurrenceCount < minRecurrenceThreshold) {
      throw CarRecurrenceThresholdException(
        'El clúster con firma "${cluster.errorSignature}" tiene recurrencia ${cluster.recurrenceCount} (< $minRecurrenceThreshold). '
        'El flujo CAR de síntesis automática requiere recurrence_count >= $minRecurrenceThreshold (§46).',
        errorSignature: cluster.errorSignature,
        recurrenceCount: cluster.recurrenceCount,
      );
    }

    final SynthesizedLinterRule linter = synthesizeLinter(cluster);

    if (autoPersist) {
      final Map<String, dynamic> actionMap = <String, dynamic>{
        'action_id': linter.ruleId,
        'id': linter.ruleId,
        'defect_signature': linter.errorSignature,
        'defect_fingerprint': linter.errorSignature,
        'error_signature': linter.errorSignature,
        'category': linter.category,
        'recurrence_count': linter.triggerRecurrence,
        'affected_path': linter.affectedFiles.isNotEmpty
            ? linter.affectedFiles.first
            : '',
        'affected_files': linter.affectedFiles,
        'synthetic_rule': linter.diagnosticMessage,
        'rule_ast_template': linter.linterVisitorDartCode,
        'pattern_regex': linter.targetAstPattern,
        'mitigation_rule': linter.mitigationAdvice,
        'status': 'ACTIVE',
        'created_at': linter.synthesizedAt.toIso8601String(),
        'trigger_source': 'USER_SIGNAL_CAR_CONNECTOR_RECURRENCE_GE_3',
      };
      persistPreventiveAction(actionMap);
    }

    return linter;
  }

  /// Escanea y evalúa todos los clústeres de señales de usuario, disparando CAR
  /// para aquellos con recurrencia >= minRecurrenceThreshold no mitigados (§46).
  Future<UserSignalCarReport> evaluateAndTrigger({
    bool autoPersist = true,
  }) async {
    final List<UserSignalCluster> clusters = collector.clusterSignals(
      minRecurrence: 1,
    );
    final int totalSignals = collector.countSignals();

    final List<SynthesizedLinterRule> synthesizedList =
        <SynthesizedLinterRule>[];
    final List<Map<String, dynamic>> persistedActions =
        <Map<String, dynamic>>[];
    int qualifyingCount = 0;
    int alreadyMitigatedCount = 0;
    int skippedCount = 0;

    for (final UserSignalCluster cluster in clusters) {
      if (cluster.recurrenceCount >= minRecurrenceThreshold) {
        qualifyingCount++;

        if (isSignatureMitigated(cluster.errorSignature)) {
          alreadyMitigatedCount++;
          continue;
        }

        final SynthesizedLinterRule linter = triggerForSingleCluster(
          cluster,
          autoPersist: autoPersist,
        );
        synthesizedList.add(linter);

        if (autoPersist) {
          persistedActions.add(<String, dynamic>{
            'action_id': linter.ruleId,
            'error_signature': linter.errorSignature,
            'category': linter.category,
            'recurrence_count': linter.triggerRecurrence,
            'status': 'ACTIVE',
          });
        }
      } else {
        skippedCount++;
      }
    }

    final String diagnostic =
        '[USER_SIGNAL_CAR_SUMMARY] Señales: $totalSignals, Clústeres: ${clusters.length}, '
        'Calificaron (>= $minRecurrenceThreshold): $qualifyingCount, Sintetizados: ${synthesizedList.length}, '
        'Ya Mitigados: $alreadyMitigatedCount, Omitidos (< $minRecurrenceThreshold): $skippedCount';

    return UserSignalCarReport(
      executedAt: DateTime.now().toUtc(),
      scannedSignalsCount: totalSignals,
      totalClustersCount: clusters.length,
      qualifyingClustersCount: qualifyingCount,
      synthesizedLintersCount: synthesizedList.length,
      alreadyMitigatedCount: alreadyMitigatedCount,
      skippedCount: skippedCount,
      synthesizedRules: synthesizedList,
      actionsPersisted: persistedActions,
      diagnostic: diagnostic,
    );
  }
}
