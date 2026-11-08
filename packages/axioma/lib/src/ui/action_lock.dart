import 'dart:async';

/// Excepción lanzada cuando se intenta ejecutar una acción asíncrona concurrente
/// mientras un [AxiomaActionLock] se encuentra ocupado, evitando doble-submit y condiciones de carrera.
class ActionLockBusyException implements Exception {
  /// Mensaje descriptivo de la excepción.
  final String message;

  /// Etiqueta o identificador opcional de la acción en conflicto.
  final String? actionTag;

  /// Marca temporal en que se produjo el intento de concurrencia no autorizado.
  final DateTime timestamp;

  ActionLockBusyException([
    this.message =
        'Action lock is currently busy. Concurrent execution denied to prevent double-submit.',
    this.actionTag,
  ]) : timestamp = DateTime.now();

  @override
  String toString() =>
      'ActionLockBusyException: $message${actionTag != null ? ' (action: $actionTag)' : ''}';
}

/// Primitiva auto-bloqueante anti doble-submit y de sincronización para acciones asíncronas de UI.
///
/// Protege botones, disparadores de formularios o llamadas de mutación contra ejecuciones
/// concurrentes y doble-clic.
class AxiomaActionLock {
  bool _isLocked = false;
  String? _currentTag;
  DateTime? _lockedAt;
  StreamController<bool>? _controller;

  /// Retorna `true` si una acción asíncrona está ejecutándose actualmente bajo este bloqueo.
  bool get isLocked => _isLocked;

  /// Retorna `true` si el bloqueo está libre y disponible para ejecutar una nueva acción.
  bool get canExecute => !_isLocked;

  /// Identificador o etiqueta de la acción actualmente en ejecución, o `null` si está inactivo.
  String? get currentTag => _currentTag;

  /// Marca temporal en la que se adquirió el bloqueo, o `null` si está inactivo.
  DateTime? get lockedAt => _lockedAt;

  /// Flujo reactivo de cambios de estado del bloqueo (`true` cuando se bloquea, `false` cuando se libera).
  Stream<bool> get lockStream =>
      (_controller ??= StreamController<bool>.broadcast()).stream;

  /// Ejecuta [action] protegiéndola con este bloqueo.
  ///
  /// Lanza [ActionLockBusyException] (Sad Path) si [isLocked] ya es `true`,
  /// abortando de forma inmediata la invocación duplicada.
  /// Si se especifica [timeout], la acción es cancelada si excede la duración esperada
  /// y el bloqueo es liberado garantizadamente en la cláusula `finally`.
  Future<R> run<R>(
    Future<R> Function() action, {
    String? tag,
    Duration? timeout,
  }) async {
    if (_isLocked) {
      throw ActionLockBusyException(
        'Action lock is busy with active action: ${_currentTag ?? "anonymous"}',
        tag ?? _currentTag,
      );
    }

    _isLocked = true;
    _currentTag = tag;
    _lockedAt = DateTime.now();
    _notify(true);

    try {
      if (timeout != null) {
        return await action().timeout(timeout);
      } else {
        return await action();
      }
    } finally {
      _isLocked = false;
      _currentTag = null;
      _lockedAt = null;
      _notify(false);
    }
  }

  /// Intenta ejecutar [action] bajo el bloqueo.
  ///
  /// Si el bloqueo ya está ocupado, en lugar de lanzar una excepción,
  /// descarta silenciosamente la invocación y retorna `null`.
  Future<R?> runOrNull<R>(
    Future<R> Function() action, {
    String? tag,
    Duration? timeout,
  }) async {
    if (_isLocked) return null;
    try {
      return await run(action, tag: tag, timeout: timeout);
    } on ActionLockBusyException {
      return null;
    }
  }

  /// Intenta ejecutar [action], retornando `true` si se ejecutó y `false` si el bloqueo estaba ocupado.
  Future<bool> tryRun(
    Future<void> Function() action, {
    String? tag,
    Duration? timeout,
  }) async {
    if (_isLocked) return false;
    try {
      await run(action, tag: tag, timeout: timeout);
      return true;
    } on ActionLockBusyException {
      return false;
    }
  }

  /// Liberación forzada de emergencia del bloqueo (defensivo / recuperación de fallos críticos).
  void forceRelease() {
    if (_isLocked) {
      _isLocked = false;
      _currentTag = null;
      _lockedAt = null;
      _notify(false);
    }
  }

  void _notify(bool locked) {
    if (_controller != null && !_controller!.isClosed) {
      _controller!.add(locked);
    }
  }

  /// Libera los recursos del controlador de streams asociado.
  void dispose() {
    _controller?.close();
    _controller = null;
  }
}
