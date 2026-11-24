// 🎯 QueueAdapterPort — Puerto Abstracto Pure Dart para Persistencia de Synapse (§39, §45, §60.2)
// Desacopla la lógica de negocio y contratos de Synapse de cualquier motor de base de datos específico (Cero I/O en Dominio §39).

/// Fila estructurada leída desde el almacenamiento de cola.
class QueueRecordData {
  final int id;
  final String ticketId;
  final String taskId;
  final String sourceNode;
  final String sprintId;
  final String status;
  final String payloadJson;
  final int retryCount;
  final String createdAtIso;
  final String updatedAtIso;

  const QueueRecordData({
    required this.id,
    required this.ticketId,
    required this.taskId,
    required this.sourceNode,
    required this.sprintId,
    required this.status,
    required this.payloadJson,
    required this.retryCount,
    required this.createdAtIso,
    required this.updatedAtIso,
  });
}

/// Contrato abstracto para adaptadores de almacenamiento de colas Synapse (§39, §45).
abstract class QueueAdapterPort {
  /// Inicializa el esquema de persistencia subyacente.
  void initializeSchema();

  /// Comprueba si el esquema de almacenamiento se encuentra inicializado.
  bool isSchemaInitialized();

  /// Inserta un registro de tarea en la cola.
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
  });

  /// Recupera tareas pendientes opcionalmente filtradas por sprintId y limitadas por [limit].
  List<QueueRecordData> fetchTasks({
    String? sprintId,
    String status = 'PENDING_INFERENCE',
    int limit = 50,
  });

  /// Actualiza el estado y opcionalmente el conteo de reintentos. Retorna true si mutó una fila.
  bool updateStatus({
    required String ticketId,
    required String newStatus,
    int? retryCount,
    required String updatedAtIso,
  });

  /// Obtiene un registro por su ticketId único.
  QueueRecordData? getByTicketId(String ticketId);

  /// Cierra los recursos subyacentes del adaptador.
  void close();
}

/// Adaptador en memoria 100% Pure Dart para pruebas y entornos libres de dependencias nativas (§4, §39).
class InMemoryQueueAdapter implements QueueAdapterPort {
  bool _schemaInitialized = false;
  final List<QueueRecordData> _records = <QueueRecordData>[];
  int _nextId = 1;

  @override
  void initializeSchema() {
    _schemaInitialized = true;
  }

  @override
  bool isSchemaInitialized() => _schemaInitialized;

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
    if (!_schemaInitialized) {
      throw StateError(
        'Tabla inference_queue no existe. Invoque initializeSchema() primero.',
      );
    }
    _records.add(
      QueueRecordData(
        id: _nextId++,
        ticketId: ticketId,
        taskId: taskId,
        sourceNode: sourceNode,
        sprintId: sprintId,
        status: status,
        payloadJson: payloadJson,
        retryCount: retryCount,
        createdAtIso: createdAtIso,
        updatedAtIso: updatedAtIso,
      ),
    );
  }

  @override
  List<QueueRecordData> fetchTasks({
    String? sprintId,
    String status = 'PENDING_INFERENCE',
    int limit = 50,
  }) {
    final Iterable<QueueRecordData> filtered = _records.where(
      (QueueRecordData r) =>
          r.status == status && (sprintId == null || r.sprintId == sprintId),
    );
    return filtered.take(limit).toList();
  }

  @override
  bool updateStatus({
    required String ticketId,
    required String newStatus,
    int? retryCount,
    required String updatedAtIso,
  }) {
    final int index = _records.indexWhere(
      (QueueRecordData r) => r.ticketId == ticketId,
    );
    if (index == -1) return false;
    final QueueRecordData old = _records[index];
    _records[index] = QueueRecordData(
      id: old.id,
      ticketId: old.ticketId,
      taskId: old.taskId,
      sourceNode: old.sourceNode,
      sprintId: old.sprintId,
      status: newStatus,
      payloadJson: old.payloadJson,
      retryCount: retryCount ?? old.retryCount,
      createdAtIso: old.createdAtIso,
      updatedAtIso: updatedAtIso,
    );
    return true;
  }

  @override
  QueueRecordData? getByTicketId(String ticketId) {
    try {
      return _records.firstWhere((QueueRecordData r) => r.ticketId == ticketId);
    } catch (_) {
      // INTENTIONAL: Retorna null cuando el ticket no existe en la colección en memoria
      return null;
    }
  }

  @override
  void close() {
    _records.clear();
  }
}
