// 🎯 Synapse Queue Bridge — Integración Pure Dart con inference_queue.db (§4, §39, §45, §60.5, §60.8)
import 'dart:convert';
import 'package:sqlite3/sqlite3.dart';
import '../contracts/context_passport.dart';
import '../dtos/synapse_task_payload.dart';
import '../protocol/cross_node_exceptions.dart';
import 'queue_adapter_port.dart';

export 'queue_adapter_port.dart';

/// Representación inmutable de un ticket extraído de inference_queue.db.
class SynapseQueueTicket {
  final int id;
  final String ticketId;
  final String taskId;
  final String sourceNode;
  final String sprintId;
  final String status;
  final SynapseTaskPayload payload;
  final int retryCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  const SynapseQueueTicket({
    required this.id,
    required this.ticketId,
    required this.taskId,
    required this.sourceNode,
    required this.sprintId,
    required this.status,
    required this.payload,
    required this.retryCount,
    required this.createdAt,
    required this.updatedAt,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'ticket_id': ticketId,
    'task_id': taskId,
    'source_node': sourceNode,
    'sprint_id': sprintId,
    'status': status,
    'payload': payload.toJson(),
    'retry_count': retryCount,
    'created_at': createdAt.toIso8601String(),
    'updated_at': updatedAt.toIso8601String(),
  };
}

/// Implementación concreta de [QueueAdapterPort] sobre SQLite real WAL (§4, §45).
class SqliteQueueAdapter implements QueueAdapterPort {
  final Database db;

  SqliteQueueAdapter(this.db);

  @override
  void initializeSchema() {
    db.execute('''
      CREATE TABLE IF NOT EXISTS inference_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL UNIQUE,
        task_id TEXT NOT NULL,
        source_node TEXT NOT NULL,
        sprint_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING_INFERENCE',
        payload TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    ''');
    db.execute('''
      CREATE INDEX IF NOT EXISTS idx_inference_queue_status_retry
      ON inference_queue (status, retry_count);
    ''');
  }

  @override
  bool isSchemaInitialized() {
    final ResultSet tableCheck = db.select(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='inference_queue';",
    );
    return tableCheck.isNotEmpty;
  }

  @override
  void insertTask({
    required String ticketId,
    required String taskId,
    required String sourceNode,
    required String sprintId,
    required String status,
    required String payloadJson,
    required int retryCount,
    required String createdAtIso,
    required String updatedAtIso,
  }) {
    if (!isSchemaInitialized()) {
      throw StateError(
        'Tabla inference_queue no existe en la base de datos SQLite. Invoque initializeSchema() primero.',
      );
    }
    db.execute(
      '''
      INSERT INTO inference_queue (
        ticket_id,
        task_id,
        source_node,
        sprint_id,
        status,
        payload,
        retry_count,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      ''',
      <dynamic>[
        ticketId,
        taskId,
        sourceNode,
        sprintId,
        status,
        payloadJson,
        retryCount,
        createdAtIso,
        updatedAtIso,
      ],
    );
  }

  @override
  List<QueueRecordData> fetchTasks({
    String? sprintId,
    String status = 'PENDING_INFERENCE',
    int limit = 50,
  }) {
    final String query = sprintId != null
        ? 'SELECT id, ticket_id, task_id, source_node, sprint_id, status, payload, retry_count, created_at, updated_at FROM inference_queue WHERE status = ? AND sprint_id = ? ORDER BY id ASC LIMIT ?;'
        : 'SELECT id, ticket_id, task_id, source_node, sprint_id, status, payload, retry_count, created_at, updated_at FROM inference_queue WHERE status = ? ORDER BY id ASC LIMIT ?;';

    final List<dynamic> params = sprintId != null
        ? <dynamic>[status, sprintId, limit]
        : <dynamic>[status, limit];

    final ResultSet rows = db.select(query, params);
    return rows
        .map(
          (Row r) => QueueRecordData(
            id: r['id'] as int,
            ticketId: r['ticket_id'] as String,
            taskId: r['task_id'] as String,
            sourceNode: r['source_node'] as String,
            sprintId: r['sprint_id'] as String,
            status: r['status'] as String,
            payloadJson: r['payload'] as String,
            retryCount: r['retry_count'] as int,
            createdAtIso: r['created_at'] as String,
            updatedAtIso: r['updated_at'] as String,
          ),
        )
        .toList();
  }

  @override
  bool updateStatus({
    required String ticketId,
    required String newStatus,
    int? retryCount,
    required String updatedAtIso,
  }) {
    db.execute(
      '''
      UPDATE inference_queue
      SET status = ?,
          retry_count = COALESCE(?, retry_count),
          updated_at = ?
      WHERE ticket_id = ?;
      ''',
      <dynamic>[newStatus, retryCount, updatedAtIso, ticketId],
    );
    return db.updatedRows > 0;
  }

  @override
  QueueRecordData? getByTicketId(String ticketId) {
    final ResultSet rows = db.select(
      '''
      SELECT id, ticket_id, task_id, source_node, sprint_id, status, payload, retry_count, created_at, updated_at
      FROM inference_queue
      WHERE ticket_id = ?;
      ''',
      <dynamic>[ticketId],
    );
    if (rows.isEmpty) return null;
    final Row r = rows.first;
    return QueueRecordData(
      id: r['id'] as int,
      ticketId: r['ticket_id'] as String,
      taskId: r['task_id'] as String,
      sourceNode: r['source_node'] as String,
      sprintId: r['sprint_id'] as String,
      status: r['status'] as String,
      payloadJson: r['payload'] as String,
      retryCount: r['retry_count'] as int,
      createdAtIso: r['created_at'] as String,
      updatedAtIso: r['updated_at'] as String,
    );
  }

  @override
  void close() {
    // La conexión Database subyacente la gestiona su poseedor
  }
}

/// Puente de integración entre el primitivo canónico SYNAPSE y la persistencia desacoplada (§39, §45).
///
/// Garantiza la Soberanía Offline-First (§45) y valida ineludiblemente el [ContextPassport]
/// antes de admitir cualquier tarea en la cola física (§4, §60.5, §60.8).
class SynapseQueueBridge {
  final QueueAdapterPort adapter;

  /// Constructor flexible: admite [QueueAdapterPort] o [Database] SQLite legacy para retrocompatibilidad.
  SynapseQueueBridge(dynamic dbOrAdapter)
    : adapter = dbOrAdapter is QueueAdapterPort
          ? dbOrAdapter
          : SqliteQueueAdapter(dbOrAdapter as Database);

  /// Constructor explícito con puerto de persistencia desacoplado (§39).
  SynapseQueueBridge.withAdapter(this.adapter);

  /// Constructor en memoria 100% Pure Dart libre de SQLite (§4, §39).
  SynapseQueueBridge.inMemory() : adapter = InMemoryQueueAdapter();

  /// Accesor legacy a la base de datos subyacente si opera sobre [SqliteQueueAdapter].
  Database get db {
    if (adapter is SqliteQueueAdapter) {
      return (adapter as SqliteQueueAdapter).db;
    }
    throw UnsupportedError(
      'Este SynapseQueueBridge está configurado con un QueueAdapterPort Pure Dart no-SQLite.',
    );
  }

  /// Inicializa de forma atómica la tabla de cola y sus índices canónicos.
  void initializeSchema() {
    adapter.initializeSchema();
  }

  /// Encola una tarea Synapse validando el [ContextPassport].
  ///
  /// Sad Paths:
  /// - Lanza [NodeSovereigntyException] si el pasaporte expiró o la zona de perímetro es inválida (§60.8).
  /// - Lanza [FormatException] si los campos de la tarea son inválidos.
  /// - Lanza [StateError] si la tabla inference_queue no existe.
  String enqueueTask({
    required SynapseTaskPayload task,
    String sprintId = 'N165',
    String? customTicketId,
  }) {
    // 1. Verificación de pasaporte de soberanía (§60.8)
    if (!task.passport.isValid()) {
      throw NodeSovereigntyException(
        'El ContextPassport "${task.passport.passportId}" está expirado o es inválido temporalmente (§60.8)',
        nodeId: task.passport.targetNode,
        reason: 'EXPIRED_PASSPORT',
        context: <String, dynamic>{
          'passport_id': task.passport.passportId,
          'expires_at': task.passport.expiresAt.toIso8601String(),
          'target_skill': task.passport.targetSkill,
        },
      );
    }

    if (task.taskId.trim().isEmpty) {
      throw const FormatException('taskId no puede estar vacío');
    }

    // 2. Comprobar existencia física del esquema
    if (!adapter.isSchemaInitialized()) {
      throw StateError(
        'Tabla inference_queue no existe en la persistencia. Invoque initializeSchema() primero.',
      );
    }

    // 3. Generar identificadores y estampas temporales
    final String ticketId =
        customTicketId ??
        'TICKET-SYN-${task.taskId}-${DateTime.now().microsecondsSinceEpoch}';
    final String nowIso = DateTime.now().toUtc().toIso8601String();
    final String serializedPayload = jsonEncode(task.toJson());

    // 4. Inserción atómica desacoplada a través del puerto
    adapter.insertTask(
      ticketId: ticketId,
      taskId: task.taskId,
      sourceNode: task.passport.originNode,
      sprintId: sprintId,
      status: 'PENDING_INFERENCE',
      payloadJson: serializedPayload,
      retryCount: 0,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    );

    return ticketId;
  }

  /// Recupera las tareas pendientes de inferencia/ejecución con límite configurable.
  List<SynapseQueueTicket> fetchPendingTasks({
    int limit = 10,
    String? sprintId,
  }) {
    if (limit <= 0) {
      throw const FormatException('limit debe ser un entero positivo');
    }

    final List<QueueRecordData> records = adapter.fetchTasks(
      sprintId: sprintId,
      status: 'PENDING_INFERENCE',
      limit: limit,
    );

    final List<SynapseQueueTicket> results = <SynapseQueueTicket>[];
    for (final QueueRecordData r in records) {
      final Map<String, dynamic> payloadMap =
          jsonDecode(r.payloadJson) as Map<String, dynamic>;
      final SynapseTaskPayload payload = SynapseTaskPayload.fromJson(
        payloadMap,
      );

      results.add(
        SynapseQueueTicket(
          id: r.id,
          ticketId: r.ticketId,
          taskId: r.taskId,
          sourceNode: r.sourceNode,
          sprintId: r.sprintId,
          status: r.status,
          payload: payload,
          retryCount: r.retryCount,
          createdAt: DateTime.parse(r.createdAtIso),
          updatedAt: DateTime.parse(r.updatedAtIso),
        ),
      );
    }

    return results;
  }

  /// Actualiza de forma atómica el estado de un ticket individual.
  void updateTicketStatus(
    String ticketId,
    String newStatus, {
    int? retryCount,
  }) {
    if (ticketId.trim().isEmpty) {
      throw const FormatException('ticketId no puede estar vacío');
    }
    if (newStatus.trim().isEmpty) {
      throw const FormatException('newStatus no puede estar vacío');
    }

    final String nowIso = DateTime.now().toUtc().toIso8601String();
    final bool updated = adapter.updateStatus(
      ticketId: ticketId,
      newStatus: newStatus,
      retryCount: retryCount,
      updatedAtIso: nowIso,
    );

    if (!updated) {
      throw ArgumentError(
        'Ticket con id "$ticketId" no existe en la tabla inference_queue.',
      );
    }
  }

  /// Consulta un ticket individual por su [ticketId].
  SynapseQueueTicket? getTicket(String ticketId) {
    if (ticketId.trim().isEmpty) {
      throw const FormatException('ticketId no puede estar vacío');
    }

    final QueueRecordData? r = adapter.getByTicketId(ticketId);
    if (r == null) return null;

    final Map<String, dynamic> payloadMap =
        jsonDecode(r.payloadJson) as Map<String, dynamic>;
    final SynapseTaskPayload payload = SynapseTaskPayload.fromJson(payloadMap);

    return SynapseQueueTicket(
      id: r.id,
      ticketId: r.ticketId,
      taskId: r.taskId,
      sourceNode: r.sourceNode,
      sprintId: r.sprintId,
      status: r.status,
      payload: payload,
      retryCount: r.retryCount,
      createdAt: DateTime.parse(r.createdAtIso),
      updatedAt: DateTime.parse(r.updatedAtIso),
    );
  }
}
