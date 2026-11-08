import 'dart:async';
import 'package:test/test.dart';
import 'package:axioma/src/ui/ui_state_machine.dart';

class _TestController with AxiomaDefensiveStateMixin<List<String>> {
  final List<AxiomaUiState<List<String>>> recordedStates =
      <AxiomaUiState<List<String>>>[];

  @override
  void onUiStateChanged(AxiomaUiState<List<String>> state) {
    recordedStates.add(state);
  }
}

void main() {
  group('AxiomaUiState - 5 Estados Canónicos y Pattern Matching', () {
    test('1. AxiomaUiInitial / AxiomaUiIdle', () {
      const AxiomaUiState<int> state = AxiomaUiState<int>.initial(
        message: 'Ready',
      );
      expect(state.isInitial, isTrue);
      expect(state.isIdle, isTrue);
      expect(state.isLoading, isFalse);
      expect(state.isSuccess, isFalse);
      expect(state.isEmpty, isFalse);
      expect(state.isError, isFalse);
      expect(state.dataOrNull, isNull);
      expect(state.errorOrNull, isNull);

      const AxiomaUiState<int> idleState = AxiomaUiState<int>.idle(
        message: 'Ready',
      );
      expect(state, equals(idleState));
      expect(state.hashCode, equals(idleState.hashCode));
      expect(
        state.toString(),
        contains('AxiomaUiInitial<int>(message: Ready)'),
      );
    });

    test('2. AxiomaUiLoading con progreso y preservación de datos previos', () {
      const AxiomaUiState<String> state = AxiomaUiState<String>.loading(
        progress: 0.75,
        message: 'Descargando catálogo...',
        previousData: 'old_cache',
      );
      expect(state.isLoading, isTrue);
      expect(state.isInitial, isFalse);
      expect(state.dataOrNull, equals('old_cache'));
      expect((state as AxiomaUiLoading<String>).progress, equals(0.75));
      expect(state.message, equals('Descargando catálogo...'));
      expect(state.previousData, equals('old_cache'));

      const AxiomaUiLoading<String> duplicate = AxiomaUiLoading<String>(
        progress: 0.75,
        message: 'Descargando catálogo...',
        previousData: 'old_cache',
      );
      expect(state, equals(duplicate));
    });

    test('3. AxiomaUiSuccess con payload tipado', () {
      const AxiomaUiState<int> state = AxiomaUiState<int>.success(
        100,
        message: 'Operación completada',
      );
      expect(state.isSuccess, isTrue);
      expect(state.isLoading, isFalse);
      expect(state.dataOrNull, equals(100));
      expect(state.errorOrNull, isNull);
      expect((state as AxiomaUiSuccess<int>).data, equals(100));
      expect(state.message, equals('Operación completada'));

      const AxiomaUiSuccess<int> duplicate = AxiomaUiSuccess<int>(
        100,
        message: 'Operación completada',
      );
      expect(state, equals(duplicate));
    });

    test('4. AxiomaUiEmpty para respuestas sin registros', () {
      const AxiomaUiState<List<int>> state = AxiomaUiState<List<int>>.empty(
        message: 'No se encontraron repuestos para el vehículo',
        metadata: <String, String>{'query': 'filtro_aceite'},
      );
      expect(state.isEmpty, isTrue);
      expect(state.isSuccess, isFalse);
      expect(state.dataOrNull, isNull);
      expect(
        (state as AxiomaUiEmpty<List<int>>).message,
        contains('No se encontraron'),
      );
      expect(state.metadata, isNotNull);

      const AxiomaUiEmpty<List<int>> duplicate = AxiomaUiEmpty<List<int>>(
        message: 'No se encontraron repuestos para el vehículo',
        metadata: <String, String>{'query': 'filtro_aceite'},
      );
      expect(state, equals(duplicate));
    });

    test('5. AxiomaUiError con diagnóstico y control de reintento', () {
      final Exception errorCause = Exception('Fallo de conexión');
      final StackTrace stack = StackTrace.current;
      final AxiomaUiState<String> state = AxiomaUiState<String>.error(
        errorCause,
        stackTrace: stack,
        message: 'Error de red',
        canRetry: true,
        retryCount: 2,
      );

      expect(state.isError, isTrue);
      expect(state.errorOrNull, equals(errorCause));
      expect((state as AxiomaUiError<String>).error, equals(errorCause));
      expect(state.stackTrace, equals(stack));
      expect(state.message, equals('Error de red'));
      expect(state.canRetry, isTrue);
      expect(state.retryCount, equals(2));
    });

    test(
      'Pattern matching exhaustivo con Dart 3 switch expression sobre los 5 estados',
      () {
        final List<AxiomaUiState<String>> states = <AxiomaUiState<String>>[
          const AxiomaUiState<String>.initial(),
          const AxiomaUiState<String>.loading(),
          const AxiomaUiState<String>.success('data'),
          const AxiomaUiState<String>.empty(),
          AxiomaUiState<String>.error(Exception('error')),
        ];

        final List<String> labels = states
            .map(
              (AxiomaUiState<String> s) => switch (s) {
                AxiomaUiInitial<String>() => 'initial',
                AxiomaUiLoading<String>() => 'loading',
                AxiomaUiSuccess<String>() => 'success',
                AxiomaUiEmpty<String>() => 'empty',
                AxiomaUiError<String>() => 'error',
              },
            )
            .toList();

        expect(
          labels,
          equals(<String>['initial', 'loading', 'success', 'empty', 'error']),
        );
      },
    );

    test('when evalúa correctamente cada estado', () {
      const AxiomaUiState<int> state = AxiomaUiState<int>.success(
        42,
        message: 'ok',
      );
      final String rendered = state.when(
        initial: (String? msg) => 'init',
        loading: (double? p, String? msg, int? prev) => 'load',
        success: (int data, String? msg) => 'success: $data ($msg)',
        empty: (String? msg, Object? meta) => 'empty',
        error:
            (Object err, StackTrace? st, String? msg, bool canRetry, int rc) =>
                'error',
      );
      expect(rendered, equals('success: 42 (ok)'));
    });

    test('maybeWhen utiliza orElse para ramas no provistas', () {
      const AxiomaUiState<int> state = AxiomaUiState<int>.initial();
      final String result = state.maybeWhen(
        success: (int d, String? m) => 'got data',
        orElse: () => 'default_fallback',
      );
      expect(result, equals('default_fallback'));
    });

    test('map y maybeMap despachan estados fuertemente tipados', () {
      const AxiomaUiState<String> state = AxiomaUiState<String>.empty(
        message: 'sin datos',
      );
      final String mapped = state.map(
        initial: (AxiomaUiInitial<String> _) => 'initial',
        loading: (AxiomaUiLoading<String> _) => 'loading',
        success: (AxiomaUiSuccess<String> _) => 'success',
        empty: (AxiomaUiEmpty<String> s) => 'empty: ${s.message}',
        error: (AxiomaUiError<String> _) => 'error',
      );
      expect(mapped, equals('empty: sin datos'));

      final String maybe = state.maybeMap(
        empty: (AxiomaUiEmpty<String> s) => 'matched',
        orElse: () => 'unmatched',
      );
      expect(maybe, equals('matched'));
    });
  });

  group('AxiomaDefensiveStateMixin - Happy Path y Reintento Automático', () {
    test(
      'transición nominal de ciclo de vida: Initial -> Loading -> Success',
      () async {
        final _TestController controller = _TestController();
        expect(controller.uiState.isInitial, isTrue);

        final List<String>? result = await controller.executeDefensive(
          action: () async => <String>['repuesto_1', 'repuesto_2'],
          loadingMessage: 'Cargando inventario...',
        );

        expect(result, equals(<String>['repuesto_1', 'repuesto_2']));
        expect(controller.uiState.isSuccess, isTrue);
        expect(
          controller.uiState.dataOrNull,
          equals(<String>['repuesto_1', 'repuesto_2']),
        );
        expect(controller.recordedStates.length, equals(2));
        expect(controller.recordedStates[0].isLoading, isTrue);
        expect(controller.recordedStates[1].isSuccess, isTrue);

        controller.disposeUiState();
      },
    );

    test('detección automática de estado vacío para listas vacías', () async {
      final _TestController controller = _TestController();

      final List<String>? result = await controller.executeDefensive(
        action: () async => <String>[],
      );

      expect(result, isEmpty);
      expect(controller.uiState.isEmpty, isTrue);
      expect(controller.recordedStates.last.isEmpty, isTrue);

      controller.disposeUiState();
    });

    test('reintento automático exitoso ante fallos transitorios', () async {
      final _TestController controller = _TestController();
      int attempts = 0;

      final List<String>? result = await controller.executeDefensive(
        action: () async {
          attempts++;
          if (attempts < 3) {
            throw TimeoutException(
              'Socket transitorio caído en intento $attempts',
            );
          }
          return <String>['recuperado_ok'];
        },
        maxRetries: 3,
        retryDelay: const Duration(milliseconds: 10),
      );

      expect(
        attempts,
        equals(3),
        reason: 'Debió reintentar 2 veces y triunfar al 3ro',
      );
      expect(result, equals(<String>['recuperado_ok']));
      expect(controller.uiState.isSuccess, isTrue);

      controller.disposeUiState();
    });

    test('uiStateStream emite todas las transiciones reactivas', () async {
      final _TestController controller = _TestController();
      final List<AxiomaUiState<List<String>>> streamStates =
          <AxiomaUiState<List<String>>>[];
      final StreamSubscription<AxiomaUiState<List<String>>> sub = controller
          .uiStateStream
          .listen(streamStates.add);

      await controller.executeDefensive(action: () async => <String>['item']);

      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(streamStates.length, equals(2));
      expect(streamStates[0].isLoading, isTrue);
      expect(streamStates[1].isSuccess, isTrue);

      await sub.cancel();
      controller.disposeUiState();
      expect(controller.isUiDisposed, isTrue);
    });

    test(
      'reintento manual con retry() re-ejecuta la última acción registrada',
      () async {
        final _TestController controller = _TestController();
        int callCount = 0;

        // Primera ejecución
        await controller.executeDefensive(
          action: () async {
            callCount++;
            return <String>['resultado_$callCount'];
          },
        );
        expect(controller.uiState.dataOrNull, equals(<String>['resultado_1']));

        // Invocación manual de retry()
        final List<String>? retryResult = await controller.retry();
        expect(callCount, equals(2));
        expect(retryResult, equals(<String>['resultado_2']));
        expect(controller.uiState.dataOrNull, equals(<String>['resultado_2']));

        controller.disposeUiState();
      },
    );
  });

  group('AxiomaDefensiveStateMixin - Sad Path Mandatorio (§6, §48)', () {
    test(
      'Sad Path: invocación concurrente en executeDefensiveLocked lanza ActionLockBusyException',
      () async {
        final _TestController controller = _TestController();
        final Completer<List<String>> blocker = Completer<List<String>>();

        // Iniciar primera acción bloqueante
        final Future<List<String>?> runningAction = controller
            .executeDefensiveLocked(
              action: () => blocker.future,
              actionTag: 'async_btn_checkout',
            );

        expect(controller.actionLock.isLocked, isTrue);

        // Sad Path: Segundo click o submit concurrente lanza ActionLockBusyException
        expect(
          () => controller.executeDefensiveLocked(
            action: () async => <String>['should_never_execute'],
            actionTag: 'duplicate_click_checkout',
          ),
          throwsA(
            isA<ActionLockBusyException>()
                .having(
                  (ActionLockBusyException e) => e.message,
                  'message',
                  contains('async_btn_checkout'),
                )
                .having(
                  (ActionLockBusyException e) => e.actionTag,
                  'actionTag',
                  equals('duplicate_click_checkout'),
                ),
          ),
        );

        // Desbloquear y verificar terminación limpia
        blocker.complete(<String>['checkout_exitoso']);
        await runningAction;
        expect(controller.actionLock.isLocked, isFalse);
        expect(controller.uiState.isSuccess, isTrue);

        controller.disposeUiState();
      },
    );

    test(
      'Sad Path: Calm Error UX cuando se agotan los reintentos automáticos',
      () async {
        final _TestController controller = _TestController();
        int attempts = 0;

        // Sad Path: El servicio falla persistentemente
        final List<String>? result = await controller.executeDefensive(
          action: () async {
            attempts++;
            throw const FormatException('Servidor respondió con JSON inválido');
          },
          maxRetries: 2,
          retryDelay: const Duration(milliseconds: 5),
        );

        // Calm Error UX: no crashea con excepción no capturada, retorna null
        expect(result, isNull);
        expect(attempts, equals(3), reason: 'Intento inicial + 2 reintentos');
        expect(controller.uiState.isError, isTrue);

        final AxiomaUiError<List<String>> errorState =
            controller.uiState as AxiomaUiError<List<String>>;
        expect(errorState.error, isA<FormatException>());
        expect(errorState.message, contains('Servidor respondió'));
        expect(errorState.canRetry, isTrue);
        expect(errorState.retryCount, equals(3));

        controller.disposeUiState();
      },
    );

    test(
      'Sad Path: shouldRetry detiene inmediatamente el reintento ante errores fatales',
      () async {
        final _TestController controller = _TestController();
        int attempts = 0;

        final List<String>? result = await controller.executeDefensive(
          action: () async {
            attempts++;
            throw ArgumentError('Token de sesión no autorizado (401)');
          },
          maxRetries: 5,
          shouldRetry: (Object error) => error is! ArgumentError,
        );

        expect(result, isNull);
        expect(
          attempts,
          equals(1),
          reason: 'No debió reintentar al ser ArgumentError',
        );
        expect(controller.uiState.isError, isTrue);

        controller.disposeUiState();
      },
    );
  });
}
