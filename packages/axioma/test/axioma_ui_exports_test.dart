import 'dart:async';
import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

/// Test controller demonstrating real usage of [AxiomaDefensiveStateMixin]
/// with pure Dart domain models (zero mocks, §4).
class TestCounterController with AxiomaDefensiveStateMixin<int> {
  int _counter;

  TestCounterController({int initialValue = 0}) : _counter = initialValue {
    emitUiState(AxiomaUiState<int>.success(_counter));
  }

  int get counter => _counter;

  Future<int?> increment() async {
    return executeDefensiveLocked(
      action: () async {
        _counter++;
        return _counter;
      },
      actionTag: 'increment',
    );
  }

  Future<int?> failingAction() async {
    return executeDefensive(
      action: () async {
        throw const FormatException('Simulated real domain failure');
      },
    );
  }
}

void main() {
  group('Axioma UI Canonical Barrel Exports (§8, §39, TASK-N94-01)', () {
    group('Semantic Color Tokens & WCAG Contrast Calculator Exports', () {
      test(
        'Happy Path: ContrastCalculator calculates accurate WCAG 2.1 AA luminance & contrast',
        () {
          final double blackLum = ContrastCalculator.relativeLuminance(
            '#000000',
          );
          final double whiteLum = ContrastCalculator.relativeLuminance(
            '#ffffff',
          );

          expect(blackLum, equals(0.0));
          expect(whiteLum, equals(1.0));

          final double ratio = ContrastCalculator.contrastRatio(
            '#000000',
            '#ffffff',
          );
          expect(ratio, closeTo(21.0, 0.01));

          expect(ContrastCalculator.passesWcagAA('#000000', '#ffffff'), isTrue);
          expect(
            ContrastCalculator.passesWcagAAA('#000000', '#ffffff'),
            isTrue,
          );

          final String normalized = ContrastCalculator.normalizeHex('fff');
          expect(normalized, equals('#ffffff'));
        },
      );

      test(
        'Happy Path: AxiomaColorTokens canonical palettes provide valid paired contrast',
        () {
          final AxiomaColorTokens darkTokens = AxiomaColorTokens.canonicalDark;
          final AxiomaColorTokens lightTokens =
              AxiomaColorTokens.canonicalLight;

          expect(darkTokens.primary.contrastRatio, greaterThanOrEqualTo(4.5));
          expect(
            darkTokens.surfacePair.contrastRatio,
            greaterThanOrEqualTo(4.5),
          );
          expect(darkTokens.card.contrastRatio, greaterThanOrEqualTo(4.5));
          expect(darkTokens.success.contrastRatio, greaterThanOrEqualTo(4.5));
          expect(darkTokens.warning.contrastRatio, greaterThanOrEqualTo(3.0));
          expect(darkTokens.danger.contrastRatio, greaterThanOrEqualTo(4.5));

          expect(lightTokens.primary.contrastRatio, greaterThanOrEqualTo(4.5));
          expect(
            lightTokens.surfacePair.contrastRatio,
            greaterThanOrEqualTo(4.5),
          );

          // Surface and text token mappings
          expect(darkTokens.surface.surface, equals('#070a13'));
          expect(darkTokens.text.onSurface, equals('#f8fafc'));
          expect(lightTokens.surface.surface, equals('#ffffff'));
          expect(lightTokens.text.onSurface, equals('#0f172a'));
        },
      );

      test(
        'Happy Path: SemanticColorPair resolves valid custom token pair',
        () {
          final SemanticColorPair pair = AxiomaColorTokens.resolvePair(
            '#1e1e2e',
            '#cdd6f4',
            name: 'catppuccin_base',
          );

          expect(pair.name, equals('catppuccin_base'));
          expect(pair.surface, equals('#1e1e2e'));
          expect(pair.onSurface, equals('#cdd6f4'));
          expect(pair.contrastRatio, greaterThanOrEqualTo(4.5));
          expect(pair.isLargeTextOnly, isFalse);
        },
      );

      test(
        'Sad Path: Resolving color pair with contrast deficit throws ContrastDeficitException',
        () {
          // Contrast between white (#ffffff) and very light gray (#eeeeee) is ~1.17:1 (< 4.5:1)
          expect(
            () => AxiomaColorTokens.resolvePair('#ffffff', '#eeeeee'),
            throwsA(
              isA<ContrastDeficitException>()
                  .having(
                    (ContrastDeficitException e) => e.contrastRatio,
                    'contrastRatio',
                    lessThan(4.5),
                  )
                  .having(
                    (ContrastDeficitException e) => e.requiredRatio,
                    'requiredRatio',
                    equals(4.5),
                  )
                  .having(
                    (ContrastDeficitException e) => e.backgroundHex,
                    'backgroundHex',
                    equals('#ffffff'),
                  )
                  .having(
                    (ContrastDeficitException e) => e.foregroundHex,
                    'foregroundHex',
                    equals('#eeeeee'),
                  )
                  .having(
                    (ContrastDeficitException e) => e,
                    'isAxiomaUiException',
                    isA<AxiomaUiException>(),
                  ),
            ),
          );
        },
      );

      test(
        'Sad Path: Direct SemanticColorPair construction with contrast deficit throws ContrastDeficitException',
        () {
          expect(
            () => SemanticColorPair(
              name: 'low_contrast_surface',
              surface: '#222222',
              onSurface: '#333333',
            ),
            throwsA(
              isA<ContrastDeficitException>().having(
                (ContrastDeficitException e) => e.tokenName,
                'tokenName',
                equals('low_contrast_surface'),
              ),
            ),
          );
        },
      );

      test(
        'Sad Path: ContrastCalculator.validateContrast with failing pair throws ContrastDeficitException',
        () {
          expect(
            () => ContrastCalculator.validateContrast(
              '#ffffff',
              '#fafafa',
              tokenName: 'almost_white',
            ),
            throwsA(
              isA<ContrastDeficitException>()
                  .having(
                    (ContrastDeficitException e) => e.tokenName,
                    'tokenName',
                    equals('almost_white'),
                  )
                  .having(
                    (ContrastDeficitException e) => e.message,
                    'message',
                    contains('WCAG 2.1 AA Contrast Deficit'),
                  ),
            ),
          );
        },
      );
    });

    group('UI State Machine & Defensive State Mixin Exports', () {
      test(
        'Happy Path: AxiomaUiState five canonical states instantiate and map correctly',
        () {
          const AxiomaUiState<String> initial = AxiomaUiState<String>.initial(
            message: 'Ready',
          );
          const AxiomaUiState<String> loading = AxiomaUiState<String>.loading(
            message: 'Fetching',
          );
          const AxiomaUiState<String> success = AxiomaUiState<String>.success(
            'data-payload',
          );
          const AxiomaUiState<String> empty = AxiomaUiState<String>.empty(
            message: 'No records',
          );
          final AxiomaUiState<String> error = AxiomaUiState<String>.error(
            Exception('Failed to load'),
            message: 'Error occurred',
          );

          expect(initial, isA<AxiomaUiInitial<String>>());
          expect(initial.isInitial, isTrue);
          expect(initial.isLoading, isFalse);

          expect(loading, isA<AxiomaUiLoading<String>>());
          expect(loading.isLoading, isTrue);

          expect(success, isA<AxiomaUiSuccess<String>>());
          expect(success.isSuccess, isTrue);
          expect(
            (success as AxiomaUiSuccess<String>).data,
            equals('data-payload'),
          );

          expect(empty, isA<AxiomaUiEmpty<String>>());
          expect(empty.isEmpty, isTrue);

          expect(error, isA<AxiomaUiError<String>>());
          expect(error.isError, isTrue);
          expect(
            (error as AxiomaUiError<String>).message,
            equals('Error occurred'),
          );
        },
      );

      test(
        'Happy Path: AxiomaDefensiveStateMixin manages reactive state stream and lock',
        () async {
          final TestCounterController controller = TestCounterController(
            initialValue: 10,
          );
          expect(controller.uiState, isA<AxiomaUiSuccess<int>>());
          expect((controller.uiState as AxiomaUiSuccess<int>).data, equals(10));

          final List<AxiomaUiState<int>> statesEmitted = <AxiomaUiState<int>>[];
          final StreamSubscription<AxiomaUiState<int>> sub = controller
              .uiStateStream
              .listen(statesEmitted.add);

          await controller.increment();

          expect(controller.uiState, isA<AxiomaUiSuccess<int>>());
          expect((controller.uiState as AxiomaUiSuccess<int>).data, equals(11));

          await controller.failingAction();
          expect(controller.uiState, isA<AxiomaUiError<int>>());
          expect(
            (controller.uiState as AxiomaUiError<int>).message,
            contains('Simulated real domain failure'),
          );

          await sub.cancel();
          controller.disposeUiState();
        },
      );
    });

    group('AxiomaActionLock Anti-Double-Submit Exports', () {
      test(
        'Happy Path: AxiomaActionLock executes sequential tasks safely',
        () async {
          final AxiomaActionLock lock = AxiomaActionLock();
          expect(lock.isLocked, isFalse);
          expect(lock.canExecute, isTrue);

          final int result = await lock.run(() async => 42, tag: 'calc');
          expect(result, equals(42));
          expect(lock.isLocked, isFalse);

          final bool ran = await lock.tryRun(() async {}, tag: 'ping');
          expect(ran, isTrue);

          final String? nullSafe = await lock.runOrNull(() async => 'safe');
          expect(nullSafe, equals('safe'));

          lock.dispose();
        },
      );

      test(
        'Sad Path: Concurrent execution on locked AxiomaActionLock throws ActionLockBusyException',
        () async {
          final AxiomaActionLock lock = AxiomaActionLock();
          final Completer<void> completer = Completer<void>();

          // Start long-running task
          final Future<String> firstTask = lock.run(() async {
            await completer.future;
            return 'done';
          }, tag: 'heavy_op');

          expect(lock.isLocked, isTrue);
          expect(lock.canExecute, isFalse);
          expect(lock.currentTag, equals('heavy_op'));

          // Attempt concurrent execution while locked -> must throw ActionLockBusyException
          expect(
            () => lock.run(() async => 'concurrent', tag: 'reentrant_op'),
            throwsA(
              isA<ActionLockBusyException>()
                  .having(
                    (ActionLockBusyException e) => e.actionTag,
                    'actionTag',
                    equals('reentrant_op'),
                  )
                  .having(
                    (ActionLockBusyException e) => e.message,
                    'message',
                    contains('busy'),
                  ),
            ),
          );

          completer.complete();
          await firstTask;
          expect(lock.isLocked, isFalse);

          lock.dispose();
        },
      );
    });

    group('MultiViewportRunner & Visual Integrity Gate Exports', () {
      test(
        'Happy Path: MultiViewportRunner passes non-overflowing component across viewports',
        () {
          const MultiViewportRunner runner = MultiViewportRunner(
            viewports: <ViewportSpec>[
              ViewportSpec(
                id: 'mobile_compact',
                name: 'mobile_compact',
                width: 320,
                height: 568,
              ),
              ViewportSpec(
                id: 'desktop',
                name: 'desktop',
                width: 1280,
                height: 800,
              ),
            ],
            failFast: false,
          );

          final UiComponentNode validNode = UiComponentNode.column(
            id: 'card_container',
            width: 300,
            padding: const UiEdgeInsets.all(12),
            children: const <UiComponentNode>[
              UiComponentNode(id: 'title', width: 200, height: 24),
              UiComponentNode(id: 'subtitle', width: 180, height: 16),
            ],
          );

          final ViewportAuditResult audit = runner.testComponent(validNode);
          expect(audit.passed, isTrue);
          expect(audit.violations, isEmpty);
        },
      );

      test(
        'Sad Path: MultiViewportRunner throws ViewportOverflowException on overflow',
        () {
          const MultiViewportRunner runner = MultiViewportRunner(
            viewports: <ViewportSpec>[
              ViewportSpec(
                id: 'mobile_narrow',
                name: 'mobile_narrow',
                width: 320,
                height: 568,
              ),
            ],
            failFast: true,
          );

          // Component with width 400px exceeds viewport of 320px
          const UiComponentNode overflowingNode = UiComponentNode(
            id: 'oversized_banner',
            width: 400,
            height: 80,
          );

          expect(
            () => runner.testComponent(overflowingNode),
            throwsA(
              isA<ViewportOverflowException>()
                  .having(
                    (ViewportOverflowException e) => e.overflowPixels,
                    'overflowPixels',
                    greaterThan(0),
                  )
                  .having(
                    (ViewportOverflowException e) => e.componentName,
                    'componentName',
                    equals('oversized_banner'),
                  )
                  .having(
                    (ViewportOverflowException e) => e,
                    'isAxiomaUiException',
                    isA<AxiomaUiException>(),
                  ),
            ),
          );
        },
      );
    });
  });
}
