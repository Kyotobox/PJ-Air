// 🎯 Catalog Sanitizer Bridge — Conector Soberano hacia data-catalog-sanitizer (§4, §6, §39, §45, §54, §60.5, §60.8)
import '../contracts/context_passport.dart';
import '../contracts/synapse_bridge.dart';
import '../dtos/synapse_task_payload.dart';
import '../protocol/cross_node_exceptions.dart';
import 'task_dispatcher.dart';

/// Estrategias canónicas de deduplicación tabular (§54).
enum DedupeStrategy {
  keepFirst('keep_first'),
  keepLast('keep_last');

  final String value;
  const DedupeStrategy(this.value);

  static DedupeStrategy fromString(String raw) {
    final String clean = raw.trim().toLowerCase();
    for (final DedupeStrategy s in DedupeStrategy.values) {
      if (s.value == clean || s.name.toLowerCase() == clean) return s;
    }
    throw FormatException(
      'Estrategia de deduplicación no soportada: "$raw". Válidas: keep_first, keep_last',
    );
  }
}

/// Acciones canónicas de sanitización de catálogo.
enum CatalogSanitizerAction {
  sanitizeAndDeduplicate('SANITIZE_AND_DEDUPLICATE'),
  sanitizeOnly('SANITIZE_CATALOG'),
  auditOnly('AUDIT_CATALOG');

  final String actionName;
  const CatalogSanitizerAction(this.actionName);
}

/// Puente de delegación especializado para que nodos comerciales y de producto
/// (Ruedas, BlueMarket, Smart) deleguen la limpieza, deduplicación y auditoría de
/// catálogos al Skill CMMI-5 `data-catalog-sanitizer` mediante SYNAPSE.
///
/// Protege el Perímetro Sónico generando pasaportes soberanos en zona GREEN y
/// aplicando procesamiento chunking (§54.4) sin duplicar código de ingesta (§39, §60.8).
class CatalogSanitizerBridge {
  final SynapseTaskDispatcher dispatcher;
  final String originNode;
  final String sovereigntyToken;
  final String targetNode;
  final String targetSkill;

  static const String kDefaultTargetNode = 'smart';
  static const String kDefaultTargetSkill = 'data-catalog-sanitizer';

  CatalogSanitizerBridge({
    required this.dispatcher,
    required this.originNode,
    required this.sovereigntyToken,
    this.targetNode = kDefaultTargetNode,
    this.targetSkill = kDefaultTargetSkill,
  }) {
    if (originNode.trim().isEmpty) {
      throw const FormatException('originNode no puede estar vacío');
    }
    if (sovereigntyToken.trim().isEmpty) {
      throw const FormatException('sovereigntyToken no puede estar vacío');
    }
    if (targetNode.trim().isEmpty) {
      throw const FormatException('targetNode no puede estar vacío');
    }
    if (targetSkill.trim().isEmpty) {
      throw const FormatException('targetSkill no puede estar vacío');
    }
  }

  /// Delega una orden completa de sanitización y normalización de catálogo.
  ///
  /// Sad Paths:
  /// - Lanza [FormatException] si catalogId o inputSource son vacíos.
  /// - Lanza [FormatException] si dedupeStrategy es desconocida o batchSize <= 0.
  /// - Lanza [NodeSovereigntyException] si la zona de perímetro es violada.
  /// - Retorna [SynapseExecutionResult] con código 202 si el worker destino está offline
  ///   y la tarea fue retenida en SQLite WAL inference_queue.db (§45).
  Future<SynapseExecutionResult> delegateSanitization({
    required String catalogId,
    required String inputSource,
    String? outputSource,
    bool deduplicate = true,
    List<String> dedupeKeys = const <String>['sku'],
    String dedupeStrategy = 'keep_first',
    int batchSize = 1000,
    String? sourceTable,
    String? targetTable,
    List<String> allowedPaths = const <String>[
      'vault/catalogs/',
      'data/catalog/',
      'vault/runtime/',
    ],
    Duration passportValidity = const Duration(hours: 2),
    Duration? directTimeout,
    String sprintId = 'N154',
  }) async {
    if (catalogId.trim().isEmpty) {
      throw const FormatException('catalogId no puede estar vacío');
    }
    if (inputSource.trim().isEmpty) {
      throw const FormatException('inputSource no puede estar vacío');
    }
    if (batchSize <= 0) {
      throw const FormatException(
        'batchSize debe ser un entero positivo (> 0) (§54.4)',
      );
    }

    final DedupeStrategy validStrategy = DedupeStrategy.fromString(
      dedupeStrategy,
    );

    final DateTime now = DateTime.now().toUtc();
    final ContextPassport passport = ContextPassport(
      passportId: 'PASS-CAT-$originNode-$catalogId',
      originNode: originNode,
      targetNode: targetNode,
      targetSkill: targetSkill,
      callerIdentity: 'CatalogSanitizerBridge-$originNode',
      sonicPerimeterZone: 'GREEN',
      sovereigntyToken: sovereigntyToken,
      allowedPathPrefixes: allowedPaths,
      issuedAt: now,
      expiresAt: now.add(passportValidity),
      metadata: <String, dynamic>{
        'catalog_id': catalogId,
        'batch_size': batchSize,
        'delegation_protocol': 'SYNAPSE_V1',
      },
    );

    final String action = deduplicate
        ? CatalogSanitizerAction.sanitizeAndDeduplicate.actionName
        : CatalogSanitizerAction.sanitizeOnly.actionName;

    final Map<String, dynamic> parameters = <String, dynamic>{
      'catalog_id': catalogId,
      'input_source': inputSource,
      if (outputSource != null) ...<String, dynamic>{
        'output_source': outputSource,
      },
      'deduplicate': deduplicate,
      'dedupe_keys': dedupeKeys,
      'dedupe_strategy': validStrategy.value,
      'batch_size': batchSize,
      if (sourceTable != null) ...<String, dynamic>{
        'source_table': sourceTable,
      },
      if (targetTable != null) ...<String, dynamic>{
        'target_table': targetTable,
      },
      'created_at': now.toIso8601String(),
    };

    final SynapseTaskPayload task = SynapseTaskPayload(
      taskId: 'TASK-CAT-$catalogId',
      passport: passport,
      action: action,
      parameters: parameters,
    );

    return dispatcher.dispatch(
      task,
      sprintId: sprintId,
      directTimeout: directTimeout ?? const Duration(seconds: 5),
    );
  }

  /// Delega una auditoría de calidad de catálogo en modo Solo Lectura (diagnóstico).
  Future<SynapseExecutionResult> delegateAuditOnly({
    required String catalogId,
    required String inputSource,
    String? sourceTable,
    List<String> allowedPaths = const <String>[
      'vault/catalogs/',
      'data/catalog/',
      'vault/runtime/',
    ],
    Duration? directTimeout,
    String sprintId = 'N154',
  }) {
    if (catalogId.trim().isEmpty) {
      throw const FormatException('catalogId no puede estar vacío');
    }
    if (inputSource.trim().isEmpty) {
      throw const FormatException('inputSource no puede estar vacío');
    }

    final DateTime now = DateTime.now().toUtc();
    final ContextPassport passport = ContextPassport(
      passportId: 'PASS-CAT-AUDIT-$originNode-$catalogId',
      originNode: originNode,
      targetNode: targetNode,
      targetSkill: targetSkill,
      callerIdentity: 'CatalogSanitizerBridge-$originNode',
      sonicPerimeterZone: 'GREEN',
      sovereigntyToken: sovereigntyToken,
      allowedPathPrefixes: allowedPaths,
      issuedAt: now,
      expiresAt: now.add(const Duration(hours: 1)),
      metadata: <String, dynamic>{
        'catalog_id': catalogId,
        'mode': 'AUDIT_ONLY',
      },
    );

    final SynapseTaskPayload task = SynapseTaskPayload(
      taskId: 'TASK-CAT-AUDIT-$catalogId',
      passport: passport,
      action: CatalogSanitizerAction.auditOnly.actionName,
      parameters: <String, dynamic>{
        'catalog_id': catalogId,
        'input_source': inputSource,
        if (sourceTable != null) ...<String, dynamic>{
          'source_table': sourceTable,
        },
        'validate_only': true,
        'created_at': now.toIso8601String(),
      },
    );

    return dispatcher.dispatch(
      task,
      sprintId: sprintId,
      directTimeout: directTimeout ?? const Duration(seconds: 5),
    );
  }
}
