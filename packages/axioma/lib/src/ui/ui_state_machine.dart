import 'dart:async';
import 'action_lock.dart';

export 'action_lock.dart';

/// Máquina de Estados Finita UI (5 Estados Canónicos) implementada mediante tipos sellados.
///
/// Estados canónicos:
/// 1. [AxiomaUiInitial] (o [AxiomaUiIdle]): Estado inicial o en reposo previo a cualquier acción.
/// 2. [AxiomaUiLoading]: Carga o mutación en curso, opcionalmente con progreso y datos previos (refresco).
/// 3. [AxiomaUiSuccess]: Operación exitosa con datos de tipo [T].
/// 4. [AxiomaUiEmpty]: Operación exitosa sin registros o con colección vacía (Calm Error UX / Empty view).
/// 5. [AxiomaUiError]: Operación fallida con excepción capturada, soporte de reintento y diagnóstico.
sealed class AxiomaUiState<T> {
  const AxiomaUiState();

  /// Constructor factoría para el estado inicial.
  const factory AxiomaUiState.initial({String? message}) = AxiomaUiInitial<T>;

  /// Alias de conveniencia para el estado en reposo ([AxiomaUiInitial]).
  const factory AxiomaUiState.idle({String? message}) = AxiomaUiInitial<T>;

  /// Constructor factoría para el estado de carga en progreso.
  const factory AxiomaUiState.loading({
    double? progress,
    String? message,
    T? previousData,
  }) = AxiomaUiLoading<T>;

  /// Constructor factoría para el estado exitoso con datos de tipo [T].
  const factory AxiomaUiState.success(T data, {String? message}) =
      AxiomaUiSuccess<T>;

  /// Constructor factoría para el estado vacío (sin registros o contenido nulo).
  const factory AxiomaUiState.empty({String? message, Object? metadata}) =
      AxiomaUiEmpty<T>;

  /// Constructor factoría para el estado de error controlado.
  const factory AxiomaUiState.error(
    Object error, {
    StackTrace? stackTrace,
    String? message,
    bool canRetry,
    int retryCount,
  }) = AxiomaUiError<T>;

  /// Retorna `true` si el estado es [AxiomaUiInitial].
  bool get isInitial => this is AxiomaUiInitial<T>;

  /// Retorna `true` si el estado es [AxiomaUiInitial] (en reposo).
  bool get isIdle => isInitial;

  /// Retorna `true` si el estado es [AxiomaUiLoading].
  bool get isLoading => this is AxiomaUiLoading<T>;

  /// Retorna `true` si el estado es [AxiomaUiSuccess].
  bool get isSuccess => this is AxiomaUiSuccess<T>;

  /// Retorna `true` si el estado es [AxiomaUiEmpty].
  bool get isEmpty => this is AxiomaUiEmpty<T>;

  /// Retorna `true` si el estado es [AxiomaUiError].
  bool get isError => this is AxiomaUiError<T>;

  /// Retorna los datos asociados al estado si existen ([AxiomaUiSuccess] o [AxiomaUiLoading.previousData]), o `null`.
  T? get dataOrNull => switch (this) {
    AxiomaUiSuccess<T>(data: final T d) => d,
    AxiomaUiLoading<T>(previousData: final T? pd) => pd,
    _ => null,
  };

  /// Retorna el error capturado si el estado es [AxiomaUiError], o `null`.
  Object? get errorOrNull => switch (this) {
    AxiomaUiError<T>(error: final Object e) => e,
    _ => null,
  };

  /// Coincidencia de patrones exhaustiva (Pattern Matching funcional).
  R when<R>({
    required R Function(String? message) initial,
    required R Function(double? progress, String? message, T? previousData)
    loading,
    required R Function(T data, String? message) success,
    required R Function(String? message, Object? metadata) empty,
    required R Function(
      Object error,
      StackTrace? stackTrace,
      String? message,
      bool canRetry,
      int retryCount,
    )
    error,
  }) {
    return switch (this) {
      AxiomaUiInitial<T>(message: final String? m) => initial(m),
      AxiomaUiLoading<T>(
        progress: final double? p,
        message: final String? m,
        previousData: final T? pd,
      ) =>
        loading(p, m, pd),
      AxiomaUiSuccess<T>(data: final T d, message: final String? m) => success(
        d,
        m,
      ),
      AxiomaUiEmpty<T>(message: final String? m, metadata: final Object? md) =>
        empty(m, md),
      AxiomaUiError<T>(
        error: final Object e,
        stackTrace: final StackTrace? st,
        message: final String? m,
        canRetry: final bool cr,
        retryCount: final int rc,
      ) =>
        error(e, st, m, cr, rc),
    };
  }

  /// Coincidencia de patrones con manejador por defecto [orElse].
  R maybeWhen<R>({
    R Function(String? message)? initial,
    R Function(double? progress, String? message, T? previousData)? loading,
    R Function(T data, String? message)? success,
    R Function(String? message, Object? metadata)? empty,
    R Function(
      Object error,
      StackTrace? stackTrace,
      String? message,
      bool canRetry,
      int retryCount,
    )?
    error,
    required R Function() orElse,
  }) {
    return switch (this) {
      AxiomaUiInitial<T>(message: final String? m) =>
        initial != null ? initial(m) : orElse(),
      AxiomaUiLoading<T>(
        progress: final double? p,
        message: final String? m,
        previousData: final T? pd,
      ) =>
        loading != null ? loading(p, m, pd) : orElse(),
      AxiomaUiSuccess<T>(data: final T d, message: final String? m) =>
        success != null ? success(d, m) : orElse(),
      AxiomaUiEmpty<T>(message: final String? m, metadata: final Object? md) =>
        empty != null ? empty(m, md) : orElse(),
      AxiomaUiError<T>(
        error: final Object e,
        stackTrace: final StackTrace? st,
        message: final String? m,
        canRetry: final bool cr,
        retryCount: final int rc,
      ) =>
        error != null ? error(e, st, m, cr, rc) : orElse(),
    };
  }

  /// Mapeo exhaustivo sobre el estado de UI tipado.
  R map<R>({
    required R Function(AxiomaUiInitial<T> state) initial,
    required R Function(AxiomaUiLoading<T> state) loading,
    required R Function(AxiomaUiSuccess<T> state) success,
    required R Function(AxiomaUiEmpty<T> state) empty,
    required R Function(AxiomaUiError<T> state) error,
  }) {
    return switch (this) {
      final AxiomaUiInitial<T> s => initial(s),
      final AxiomaUiLoading<T> s => loading(s),
      final AxiomaUiSuccess<T> s => success(s),
      final AxiomaUiEmpty<T> s => empty(s),
      final AxiomaUiError<T> s => error(s),
    };
  }

  /// Mapeo con manejador por defecto [orElse].
  R maybeMap<R>({
    R Function(AxiomaUiInitial<T> state)? initial,
    R Function(AxiomaUiLoading<T> state)? loading,
    R Function(AxiomaUiSuccess<T> state)? success,
    R Function(AxiomaUiEmpty<T> state)? empty,
    R Function(AxiomaUiError<T> state)? error,
    required R Function() orElse,
  }) {
    return switch (this) {
      final AxiomaUiInitial<T> s => initial != null ? initial(s) : orElse(),
      final AxiomaUiLoading<T> s => loading != null ? loading(s) : orElse(),
      final AxiomaUiSuccess<T> s => success != null ? success(s) : orElse(),
      final AxiomaUiEmpty<T> s => empty != null ? empty(s) : orElse(),
      final AxiomaUiError<T> s => error != null ? error(s) : orElse(),
    };
  }
}

/// 1. Estado Inicial / En reposo.
final class AxiomaUiInitial<T> extends AxiomaUiState<T> {
  final String? message;

  const AxiomaUiInitial({this.message});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AxiomaUiInitial<T> && other.message == message);

  @override
  int get hashCode => Object.hash(runtimeType, message);

  @override
  String toString() => 'AxiomaUiInitial<$T>(message: $message)';
}

/// Alias formal para el estado inicial.
typedef AxiomaUiIdle<T> = AxiomaUiInitial<T>;

/// 2. Estado de Carga en curso.
final class AxiomaUiLoading<T> extends AxiomaUiState<T> {
  /// Progreso opcional normalizado entre 0.0 y 1.0.
  final double? progress;

  /// Mensaje opcional indicativo de la fase de carga.
  final String? message;

  /// Datos previos preservados durante operaciones de refresco o reintento.
  final T? previousData;

  const AxiomaUiLoading({this.progress, this.message, this.previousData});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AxiomaUiLoading<T> &&
          other.progress == progress &&
          other.message == message &&
          other.previousData == previousData);

  @override
  int get hashCode => Object.hash(runtimeType, progress, message, previousData);

  @override
  String toString() =>
      'AxiomaUiLoading<$T>(progress: $progress, message: $message, previousData: $previousData)';
}

/// 3. Estado de Éxito con datos.
final class AxiomaUiSuccess<T> extends AxiomaUiState<T> {
  /// Datos válidos obtenidos tras la operación.
  final T data;

  /// Mensaje opcional de confirmación.
  final String? message;

  const AxiomaUiSuccess(this.data, {this.message});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AxiomaUiSuccess<T> &&
          other.data == data &&
          other.message == message);

  @override
  int get hashCode => Object.hash(runtimeType, data, message);

  @override
  String toString() => 'AxiomaUiSuccess<$T>(data: $data, message: $message)';
}

/// 4. Estado Vacío (consulta o filtro sin registros).
final class AxiomaUiEmpty<T> extends AxiomaUiState<T> {
  /// Mensaje explicativo para la vista vacía.
  final String? message;

  /// Metadatos opcionales contextuales.
  final Object? metadata;

  const AxiomaUiEmpty({this.message, this.metadata});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AxiomaUiEmpty<T> &&
          other.message == message &&
          other.metadata == metadata);

  @override
  int get hashCode => Object.hash(runtimeType, message, metadata);

  @override
  String toString() =>
      'AxiomaUiEmpty<$T>(message: $message, metadata: $metadata)';
}

/// 5. Estado de Error controlado con capacidades de reintento.
final class AxiomaUiError<T> extends AxiomaUiState<T> {
  /// Excepción o causa raíz del fallo.
  final Object error;

  /// Traza de la pila para depuración y diagnóstico forense.
  final StackTrace? stackTrace;

  /// Mensaje legible para el usuario o log.
  final String? message;

  /// Indica si la acción permite reintento.
  final bool canRetry;

  /// Número de intentos previos ejecutados antes de emitir este error.
  final int retryCount;

  const AxiomaUiError(
    this.error, {
    this.stackTrace,
    this.message,
    this.canRetry = true,
    this.retryCount = 0,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AxiomaUiError<T> &&
          other.error == error &&
          other.message == message &&
          other.canRetry == canRetry &&
          other.retryCount == retryCount);

  @override
  int get hashCode =>
      Object.hash(runtimeType, error, message, canRetry, retryCount);

  @override
  String toString() =>
      'AxiomaUiError<$T>(error: $error, message: $message, canRetry: $canRetry, retryCount: $retryCount)';
}

/// Mixin defensivo de ciclo de vida UI con soporte de reintento automático y candado de acción.
///
/// Proporciona a controladores, cubits, notifiers o servicios de vista una compuerta
/// estricta para garantizar la emisión de los 5 estados canónicos, captura serena de errores
/// (Calm Error UX), reintentos automáticos configurables y protección anti doble-submit.
mixin AxiomaDefensiveStateMixin<T> {
  AxiomaUiState<T> _uiState = AxiomaUiInitial<T>();
  StreamController<AxiomaUiState<T>>? _stateController;
  final AxiomaActionLock _actionLock = AxiomaActionLock();
  bool _isDisposed = false;

  Future<T> Function()? _lastAction;
  int _lastMaxRetries = 0;
  Duration _lastRetryDelay = const Duration(milliseconds: 200);
  bool Function(T data)? _lastIsEmpty;
  bool Function(Object error)? _lastShouldRetry;

  /// Estado actual del componente.
  AxiomaUiState<T> get uiState => _uiState;

  /// Flujo reactivo de cambios de estado del componente.
  Stream<AxiomaUiState<T>> get uiStateStream =>
      (_stateController ??= StreamController<AxiomaUiState<T>>.broadcast())
          .stream;

  /// Primitiva de candado de acción asociada para evitar doble submit en botones o llamadas concurrentes.
  AxiomaActionLock get actionLock => _actionLock;

  /// Indica si el mixin ha sido desechado.
  bool get isUiDisposed => _isDisposed;

  /// Emite un nuevo estado [newState], notificando a los listeners si hubo un cambio real.
  void emitUiState(AxiomaUiState<T> newState) {
    if (_isDisposed) return;
    if (_uiState == newState) return;
    _uiState = newState;
    if (_stateController != null && !_stateController!.isClosed) {
      _stateController!.add(newState);
    }
    onUiStateChanged(newState);
  }

  /// Hook interceptor para reacciones directas ante transiciones de estado.
  void onUiStateChanged(AxiomaUiState<T> state) {}

  /// Ejecuta una acción asíncrona de forma defensiva con soporte de reintento automático.
  ///
  /// - Emite [AxiomaUiLoading] con los datos previos si [retainPreviousDataOnLoading] es `true`.
  /// - En caso de fallo transitorio, reintenta hasta [maxRetries] veces respetando [retryDelay].
  /// - Si el resultado es vacío según [isEmpty] o la inspección por defecto, emite [AxiomaUiEmpty].
  /// - Si la operación concluye con éxito, emite [AxiomaUiSuccess] y retorna el valor.
  /// - Si se agotan los reintentos, emite [AxiomaUiError] con Calm Error UX y retorna `null` sin crashear.
  Future<T?> executeDefensive({
    required Future<T> Function() action,
    int maxRetries = 0,
    Duration retryDelay = const Duration(milliseconds: 200),
    bool Function(T data)? isEmpty,
    bool Function(Object error)? shouldRetry,
    bool retainPreviousDataOnLoading = true,
    String? loadingMessage,
  }) async {
    _lastAction = action;
    _lastMaxRetries = maxRetries;
    _lastRetryDelay = retryDelay;
    _lastIsEmpty = isEmpty;
    _lastShouldRetry = shouldRetry;

    final T? previous = retainPreviousDataOnLoading
        ? _uiState.dataOrNull
        : null;
    emitUiState(
      AxiomaUiState<T>.loading(previousData: previous, message: loadingMessage),
    );

    int attempts = 0;
    while (true) {
      try {
        final T result = await action();
        final bool empty = isEmpty != null
            ? isEmpty(result)
            : _checkDefaultEmpty(result);

        if (empty) {
          emitUiState(AxiomaUiState<T>.empty());
        } else {
          emitUiState(AxiomaUiState<T>.success(result));
        }
        return result;
      } catch (error, stackTrace) {
        attempts++;
        final bool canAttemptRetry =
            attempts <= maxRetries &&
            (shouldRetry == null || shouldRetry(error));

        if (canAttemptRetry) {
          if (retryDelay > Duration.zero) {
            await Future<void>.delayed(retryDelay);
          }
          continue;
        }

        // Calm Error UX: No propaga excepciones no controladas hacia el renderizador.
        emitUiState(
          AxiomaUiState<T>.error(
            error,
            stackTrace: stackTrace,
            message: error.toString(),
            canRetry: true,
            retryCount: attempts,
          ),
        );
        return null;
      }
    }
  }

  /// Ejecuta una acción de forma defensiva protegida por el candado [actionLock].
  ///
  /// Sad Path: Si el candado está ocupado ([AxiomaActionLock.isLocked]), lanza
  /// [ActionLockBusyException] de forma inmediata cancelando la invocación duplicada.
  Future<T?> executeDefensiveLocked({
    required Future<T> Function() action,
    String? actionTag,
    int maxRetries = 0,
    Duration retryDelay = const Duration(milliseconds: 200),
    bool Function(T data)? isEmpty,
    bool Function(Object error)? shouldRetry,
    bool retainPreviousDataOnLoading = true,
    String? loadingMessage,
  }) {
    return _actionLock.run(
      () => executeDefensive(
        action: action,
        maxRetries: maxRetries,
        retryDelay: retryDelay,
        isEmpty: isEmpty,
        shouldRetry: shouldRetry,
        retainPreviousDataOnLoading: retainPreviousDataOnLoading,
        loadingMessage: loadingMessage,
      ),
      tag: actionTag,
    );
  }

  /// Reintenta manualmente la última acción defensiva registrada.
  Future<T?> retry() async {
    final Future<T> Function()? action = _lastAction;
    if (action == null) return null;
    return executeDefensive(
      action: action,
      maxRetries: _lastMaxRetries,
      retryDelay: _lastRetryDelay,
      isEmpty: _lastIsEmpty,
      shouldRetry: _lastShouldRetry,
    );
  }

  bool _checkDefaultEmpty(Object? result) {
    if (result == null) return true;
    if (result is Iterable && result.isEmpty) return true;
    if (result is Map && result.isEmpty) return true;
    if (result is String && result.trim().isEmpty) return true;
    return false;
  }

  /// Libera los recursos del mixin, cerrando el flujo reactivo y el candado.
  void disposeUiState() {
    _isDisposed = true;
    _stateController?.close();
    _stateController = null;
    _actionLock.dispose();
  }
}
