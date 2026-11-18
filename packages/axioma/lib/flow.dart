/// flow: Entry Point Granular para Motores de Flujo, FSM y Control de Estados (§39).
///
/// Abstracciones de máquinas de estado finitas (FSM), almacén de sesiones con control optimista,
/// bloqueos de acción y control reactivo Pure Dart.
library;

import 'src/flow/flow_session_store.dart';

export 'src/ui/action_lock.dart';
export 'src/ui/ui_state_machine.dart';

// Pure FSM Engine & Socratic Gentle Exit Policy (TASK-N104-04 / TASK-N104-05, §39)
export 'src/flow/flow_engine.dart';
export 'src/flow/flow_state.dart';
export 'src/flow/flow_violations.dart';

// Flow Session Store & SQLite Persistence (TASK-N106-05 / TASK-N107-01, §39, §45)
export 'src/flow/flow_session_store.dart';
export 'src/flow/sqlite_flow_session_store.dart';

/// Alias canónico para la excepción de concurrencia optimista en almacén de flujo (§6, §39).
typedef FlowOptimisticLockException = OptimisticLockException;

/// Excepción canónica arrojada cuando una sesión FSM solicitada no existe o ha expirado en el almacén (§6, §39).
class FlowSessionNotFoundException implements Exception {
  final String sessionId;
  final String message;

  const FlowSessionNotFoundException({required this.sessionId, String? message})
    : message = message ?? 'Sesión FSM no encontrada o expirada: "$sessionId".';

  @override
  String toString() => 'FlowSessionNotFoundException: $message';
}

/// Extensiones de conveniencia defensiva sobre [FlowSessionStore] (§39, §45).
extension FlowSessionStoreExtensions on FlowSessionStore {
  /// Carga una sesión requerida o arroja [FlowSessionNotFoundException] si no existe o ha expirado (§6, §39).
  FlowSessionRecord requireSession(String sessionId, {DateTime? now}) {
    final FlowSessionRecord? session = loadSession(sessionId, now: now);
    if (session == null) {
      throw FlowSessionNotFoundException(sessionId: sessionId);
    }
    return session;
  }
}
