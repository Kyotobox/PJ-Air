/// viewport_test_runner_test.dart — Suite de Pruebas Multi-Viewport y Detector de Overflows (§39, §4, §6).
///
/// Mandatos Constitucionales:
/// 1. Pure Dart Core (§39): Cero dependencias de package:flutter o dart:html.
/// 2. Tolerancia Cero a Mocks (§4): Pruebas deterministas sobre modelos reales.
/// 3. Sad Path Mandatorio (§6): Aserciones negativas reales con `throwsA(isA<ViewportOverflowException>())`.
library;

import 'package:axioma/src/ui/ui_exceptions.dart';
import 'package:axioma/src/ui/viewport_test_runner.dart';
import 'package:test/test.dart';

void main() {
  group('MultiViewportRunner - Specifications & Presets (§39)', () {
    test(
      'Standard matrix contains mobile 320px, mobile 375px and desktop 1280px',
      () {
        final List<ViewportSpec> matrix = ViewportSpec.standardMatrix;
        expect(matrix.length, equals(3));

        expect(matrix[0].id, equals('mobile_320'));
        expect(matrix[0].width, equals(320.0));
        expect(matrix[0].height, equals(568.0));
        expect(matrix[0].isMobile, isTrue);

        expect(matrix[1].id, equals('mobile_375'));
        expect(matrix[1].width, equals(375.0));
        expect(matrix[1].height, equals(667.0));
        expect(matrix[1].isMobile, isTrue);

        expect(matrix[2].id, equals('desktop_1280'));
        expect(matrix[2].width, equals(1280.0));
        expect(matrix[2].height, equals(800.0));
        expect(matrix[2].isMobile, isFalse);
      },
    );

    test('ViewportSpec serializes to JSON accurately', () {
      const ViewportSpec spec = ViewportSpec.mobile320;
      final Map<String, dynamic> json = spec.toJson();

      expect(json['id'], equals('mobile_320'));
      expect(json['width'], equals(320.0));
      expect(json['is_mobile'], isTrue);
    });
  });

  group('MultiViewportRunner - Happy Paths', () {
    const MultiViewportRunner runner = MultiViewportRunner();

    test(
      'certifies a flexible responsive component that fits within all viewports',
      () {
        final UiComponentNode component = UiComponentNode.column(
          id: 'user_profile_card',
          padding: const UiEdgeInsets.all(16.0),
          children: <UiComponentNode>[
            UiComponentNode.text(
              id: 'username_title',
              text: 'Profile',
              fontSize: 16.0,
            ),
            UiComponentNode.row(
              id: 'actions_row',
              wrap: true, // wraps to adapt to narrow screens
              children: const <UiComponentNode>[
                UiComponentNode(
                  id: 'btn_edit',
                  type: 'Button',
                  width: 120.0,
                  height: 40.0,
                ),
                UiComponentNode(
                  id: 'btn_logout',
                  type: 'Button',
                  width: 120.0,
                  height: 40.0,
                ),
              ],
            ),
          ],
        );

        final ViewportAuditResult result = runner.testComponent(component);

        expect(result.passed, isTrue);
        expect(result.violations, isEmpty);
        expect(
          result.totalConfigurations,
          equals(6),
        ); // 3 viewports * 2 text scale factors
      },
    );

    test(
      'certifies a scrollable row that exceeds viewport width without triggering overflow',
      () {
        final UiComponentNode scrollableRow = UiComponentNode.row(
          id: 'horizontal_stories_feed',
          scrollable: true, // scrollable explicitly allows horizontal overflow
          children: const <UiComponentNode>[
            UiComponentNode(id: 'item_1', width: 100.0),
            UiComponentNode(id: 'item_2', width: 100.0),
            UiComponentNode(id: 'item_3', width: 100.0),
            UiComponentNode(id: 'item_4', width: 100.0), // Total 400px > 320px
          ],
        );

        final ViewportAuditResult result = runner.testComponent(scrollableRow);

        expect(result.passed, isTrue);
        expect(result.violations, isEmpty);
      },
    );

    test(
      'certifies dynamic component builder adjusting layout per viewport context',
      () {
        final ViewportAuditResult result = runner.testComponentBuilder((
          ViewportContext ctx,
        ) {
          if (ctx.viewport.isMobile) {
            // Adaptive stack on mobile screens (320px, 375px)
            return UiComponentNode.column(
              id: 'adaptive_navbar',
              children: const <UiComponentNode>[
                UiComponentNode(id: 'logo', width: 100.0, height: 30.0),
                UiComponentNode(id: 'menu_burger', width: 40.0, height: 30.0),
              ],
            );
          } else {
            // Desktop horizontal navbar
            return UiComponentNode.row(
              id: 'adaptive_navbar',
              children: const <UiComponentNode>[
                UiComponentNode(id: 'logo', width: 150.0, height: 40.0),
                UiComponentNode(id: 'menu_items', width: 300.0, height: 40.0),
              ],
            );
          }
        });

        expect(result.passed, isTrue);
        expect(result.violations, isEmpty);
      },
    );

    test('non-failFast mode reports violations without throwing', () {
      const MultiViewportRunner permissiveRunner = MultiViewportRunner(
        failFast: false,
      );

      const UiComponentNode overflowingComponent = UiComponentNode(
        id: 'rigid_banner',
        width: 350.0, // Overflows 320px by 30px
      );

      final ViewportAuditResult result = permissiveRunner.testComponent(
        overflowingComponent,
      );

      expect(result.passed, isFalse);
      expect(result.violations, isNotEmpty);
      expect(
        result.violations.any(
          (ViewportOverflowViolation v) => v.viewport.id == 'mobile_320',
        ),
        isTrue,
      );
      expect(
        result.violations.any(
          (ViewportOverflowViolation v) => v.viewport.id == 'desktop_1280',
        ),
        isFalse,
      );
    });

    test('UiComponentNode deserializes from and serializes to JSON', () {
      final Map<String, dynamic> json = <String, dynamic>{
        'id': 'test_box',
        'type': 'Container',
        'width': 200.0,
        'height': 100.0,
        'direction': 'row',
        'wrap': true,
        'padding': const <String, dynamic>{
          'left': 8.0,
          'top': 8.0,
          'right': 8.0,
          'bottom': 8.0,
        },
        'children': const <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'child_text',
            'type': 'Text',
            'text': 'Hello',
            'font_size': 14.0,
          },
        ],
      };

      final UiComponentNode node = UiComponentNode.fromJson(json);
      expect(node.id, equals('test_box'));
      expect(node.width, equals(200.0));
      expect(node.direction, equals(FlexDirection.row));
      expect(node.wrap, isTrue);
      expect(node.padding.horizontal, equals(16.0));
      expect(node.children.length, equals(1));
      expect(node.children.first.text, equals('Hello'));

      final Map<String, dynamic> serialized = node.toJson();
      expect(serialized['id'], equals('test_box'));
      expect(serialized['direction'], equals('row'));
    });
  });

  group('MultiViewportRunner - Sad Paths Mandatorios (§6)', () {
    const MultiViewportRunner runner = MultiViewportRunner(failFast: true);

    test(
      'Sad Path 1: fixed width > 320px throws ViewportOverflowException with overflow pixels',
      () {
        const UiComponentNode rigidCard = UiComponentNode(
          id: 'rigid_checkout_card',
          width: 345.0, // 345px in 320px screen -> 25px overflow
        );

        expect(
          () => runner.testComponent(rigidCard),
          throwsA(
            isA<ViewportOverflowException>()
                .having(
                  (ViewportOverflowException e) => e.overflowPixels,
                  'overflowPixels',
                  closeTo(25.0, 0.01),
                )
                .having(
                  (ViewportOverflowException e) => e.axis,
                  'axis',
                  equals('horizontal'),
                )
                .having(
                  (ViewportOverflowException e) => e.viewport.id,
                  'viewport.id',
                  equals('mobile_320'),
                )
                .having(
                  (ViewportOverflowException e) => e.availableDimension,
                  'availableDimension',
                  equals(320.0),
                )
                .having(
                  (ViewportOverflowException e) => e.actualDimension,
                  'actualDimension',
                  equals(345.0),
                )
                .having(
                  (ViewportOverflowException e) => e.componentName,
                  'componentName',
                  equals('rigid_checkout_card'),
                )
                .having(
                  (ViewportOverflowException e) => e.message,
                  'message',
                  contains('overflowed by 25.0 pixels on the right'),
                ),
          ),
        );
      },
    );

    test(
      'Sad Path 2: unwrapped Row exceeding 320px throws ViewportOverflowException',
      () {
        final UiComponentNode unconstrainedRow = UiComponentNode.row(
          id: 'action_bar',
          wrap: false, // Flutter RenderFlex Row overflow
          children: const <UiComponentNode>[
            UiComponentNode(id: 'btn_primary', width: 170.0),
            UiComponentNode(
              id: 'btn_secondary',
              width: 170.0,
            ), // Total 340px > 320px
          ],
        );

        expect(
          () => runner.testComponent(unconstrainedRow),
          throwsA(
            isA<ViewportOverflowException>()
                .having(
                  (ViewportOverflowException e) => e.overflowPixels,
                  'overflowPixels',
                  closeTo(20.0, 0.01),
                )
                .having(
                  (ViewportOverflowException e) => e.axis,
                  'axis',
                  equals('horizontal'),
                )
                .having(
                  (ViewportOverflowException e) => e.viewport.id,
                  'viewport.id',
                  equals('mobile_320'),
                ),
          ),
        );
      },
    );

    test(
      'Sad Path 3: text fits at 1.0x textScaleFactor but overflows at 150% zoom',
      () {
        // At font size 14.0, charWidthRatio = 0.55:
        // At 1.0x: 35 chars * (14.0 * 0.55) = 35 * 7.7 = 269.5px (< 320px: FITS)
        // At 1.5x: 35 chars * (21.0 * 0.55) = 35 * 11.55 = 404.25px (> 320px: OVERFLOW by 84.25px!)
        final UiComponentNode singleLineLabel = UiComponentNode.text(
          id: 'promo_headline_banner',
          text: 'Special Flash Discount This Weekend', // 35 characters
          fontSize: 14.0,
          maxLines: 1, // Single line, cannot wrap
        );

        expect(
          () => runner.testComponent(singleLineLabel),
          throwsA(
            isA<ViewportOverflowException>()
                .having(
                  (ViewportOverflowException e) => e.textScaleFactor,
                  'textScaleFactor',
                  equals(1.5),
                )
                .having(
                  (ViewportOverflowException e) => e.overflowPixels,
                  'overflowPixels',
                  closeTo(84.25, 0.1),
                )
                .having(
                  (ViewportOverflowException e) => e.axis,
                  'axis',
                  equals('horizontal'),
                )
                .having(
                  (ViewportOverflowException e) => e.viewport.id,
                  'viewport.id',
                  equals('mobile_320'),
                ),
          ),
        );
      },
    );

    test(
      'Sad Path 4: dynamic builder throwing at 150% textScaleFactor triggers ViewportOverflowException',
      () {
        expect(
          () => runner.testComponentBuilder((ViewportContext ctx) {
            if (ctx.textScaleFactor >= 1.5) {
              throw StateError(
                'Layout crash: text scale factor 1.5 exceeded component buffer limits',
              );
            }
            return const UiComponentNode(id: 'resilient_box', width: 250.0);
          }),
          throwsA(
            isA<ViewportOverflowException>()
                .having(
                  (ViewportOverflowException e) => e.axis,
                  'axis',
                  equals('render_pipeline'),
                )
                .having(
                  (ViewportOverflowException e) => e.textScaleFactor,
                  'textScaleFactor',
                  equals(1.5),
                )
                .having(
                  (ViewportOverflowException e) => e.message,
                  'message',
                  contains('Layout crash'),
                ),
          ),
        );
      },
    );

    test(
      'Sad Path 5: ViewportOverflowException formats informative error and serializes to JSON',
      () {
        final ViewportOverflowException exception = ViewportOverflowException(
          viewport: ViewportSpec.mobile320,
          textScaleFactor: 1.5,
          overflowPixels: 42.5,
          axis: 'horizontal',
          componentName: 'test_card',
          availableDimension: 320.0,
          actualDimension: 362.5,
        );

        expect(exception, isA<AxiomaUiException>());
        expect(
          exception.toString(),
          contains('RenderFlex overflowed by 42.5 pixels'),
        );

        final Map<String, dynamic> json = exception.toJson();
        expect(json['error'], equals('ViewportOverflowException'));
        expect(json['component'], equals('test_card'));
        expect(json['overflow_pixels'], equals(42.5));
        expect(json['text_scale_factor'], equals(1.5));
        expect(json['viewport']['name'], equals('Mobile 320px'));
      },
    );
  });
}
