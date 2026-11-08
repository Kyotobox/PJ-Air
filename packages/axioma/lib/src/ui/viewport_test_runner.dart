/// Multi-Viewport Test Runner & Layout Overflow Detector (§39 Pure Dart Core)
///
/// Implements deterministic layout certification across screen matrices
/// (Mobile 320px, Mobile 375px, Desktop 1280px) and accessibility zoom
/// (textScaleFactor: 1.5).
///
/// Validates that components and containers do not exceed layout boundaries
/// or trigger RenderFlex overflows.
///
/// Sad Path Mandatorio (§6):
/// When any component or view overflows in 320px or on 150% text scale zoom,
/// [MultiViewportRunner] immediately throws [ViewportOverflowException]
/// containing detailed dimensions, available space, and overflow pixels.
library;

import 'dart:math' as math;
import 'ui_exceptions.dart';

/// Specification for a target device display or viewport.
final class ViewportSpec {
  /// Unique identifier (e.g. 'mobile_320', 'mobile_375', 'desktop_1280').
  final String id;

  /// Human-readable label (e.g. 'Mobile 320px', 'Mobile 375px', 'Desktop 1280px').
  final String name;

  /// Viewport width in logical pixels.
  final double width;

  /// Viewport height in logical pixels.
  final double height;

  /// Whether this viewport represents a mobile handset screen.
  final bool isMobile;

  const ViewportSpec({
    required this.id,
    required this.name,
    required this.width,
    required this.height,
    this.isMobile = false,
  });

  /// Canonical narrow mobile viewport (320x568 - iPhone SE 1st gen).
  static const ViewportSpec mobile320 = ViewportSpec(
    id: 'mobile_320',
    name: 'Mobile 320px',
    width: 320.0,
    height: 568.0,
    isMobile: true,
  );

  /// Standard mainstream mobile viewport (375x667 - iPhone SE 2nd/3rd gen, 8).
  static const ViewportSpec mobile375 = ViewportSpec(
    id: 'mobile_375',
    name: 'Mobile 375px',
    width: 375.0,
    height: 667.0,
    isMobile: true,
  );

  /// Standard desktop viewport (1280x800 - Laptop & Desktop).
  static const ViewportSpec desktop1280 = ViewportSpec(
    id: 'desktop_1280',
    name: 'Desktop 1280px',
    width: 1280.0,
    height: 800.0,
    isMobile: false,
  );

  /// Standard tripartite screen matrix mandated by fleet governance.
  static const List<ViewportSpec> standardMatrix = <ViewportSpec>[
    mobile320,
    mobile375,
    desktop1280,
  ];

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'name': name,
    'width': width,
    'height': height,
    'is_mobile': isMobile,
  };

  @override
  String toString() => '$name (${width.toInt()}x${height.toInt()})';
}

/// Context provided to component builders during multi-viewport evaluation.
final class ViewportContext {
  /// Target viewport specification.
  final ViewportSpec viewport;

  /// Accessibility text scale multiplier (e.g. 1.0 for normal, 1.5 for 150% zoom).
  final double textScaleFactor;

  const ViewportContext({
    required this.viewport,
    required this.textScaleFactor,
  });

  /// Available width in logical pixels.
  double get availableWidth => viewport.width;

  /// Available height in logical pixels.
  double get availableHeight => viewport.height;

  /// Whether accessibility zoom is active (> 1.0).
  bool get isAccessibilityZoom => textScaleFactor > 1.0;

  /// Whether current viewport is narrow mobile (<= 320px).
  bool get isNarrowScreen => viewport.width <= 320.0;
}

/// Orientation or axis of layout.
enum FlexDirection { row, column }

/// Padding or margin box model offsets.
final class UiEdgeInsets {
  final double left;
  final double top;
  final double right;
  final double bottom;

  const UiEdgeInsets.only({
    this.left = 0.0,
    this.top = 0.0,
    this.right = 0.0,
    this.bottom = 0.0,
  });

  const UiEdgeInsets.all(double value)
    : left = value,
      top = value,
      right = value,
      bottom = value;

  const UiEdgeInsets.symmetric({double horizontal = 0.0, double vertical = 0.0})
    : left = horizontal,
      top = vertical,
      right = horizontal,
      bottom = vertical;

  static const UiEdgeInsets zero = UiEdgeInsets.only();

  double get horizontal => left + right;
  double get vertical => top + bottom;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'left': left,
    'top': top,
    'right': right,
    'bottom': bottom,
  };
}

/// Declarative representation of a UI component or container for Pure Dart layout evaluation.
final class UiComponentNode {
  /// Unique identifier or semantic name.
  final String id;

  /// Component type or widget name (e.g. 'Row', 'Column', 'Card', 'Text', 'Button').
  final String type;

  /// Explicit fixed width in logical pixels, if specified.
  final double? width;

  /// Explicit fixed height in logical pixels, if specified.
  final double? height;

  /// Minimum width constraint.
  final double? minWidth;

  /// Maximum width constraint.
  final double? maxWidth;

  /// Minimum height constraint.
  final double? minHeight;

  /// Maximum height constraint.
  final double? maxHeight;

  /// Inner padding.
  final UiEdgeInsets padding;

  /// Outer margin.
  final UiEdgeInsets margin;

  /// Flex direction if this node acts as a flex container (Row or Column).
  final FlexDirection? direction;

  /// If true, flex items wrap into multiple lines when exceeding container width.
  /// If false, a Row will overflow horizontally when children total width exceeds bounds (RenderFlex overflow).
  final bool wrap;

  /// If true, container allows scrolling along its main axis, suppressing overflow along that axis.
  final bool scrollable;

  /// Flex grow factor when placed inside a flex parent.
  final int? flex;

  /// Nested child components.
  final List<UiComponentNode> children;

  /// Text content if this node represents a text element.
  final String? text;

  /// Base font size in logical points (default: 14.0).
  final double? fontSize;

  /// Maximum number of lines for text before truncation. If 1, soft wrapping is disabled.
  final int? maxLines;

  /// Whether soft wrapping is enabled for text (default: true).
  final bool softWrap;

  /// Ratio of character width relative to font size (default: 0.55).
  final double estimatedCharWidthRatio;

  /// Ratio of line height relative to font size (default: 1.25).
  final double estimatedLineHeightRatio;

  const UiComponentNode({
    required this.id,
    this.type = 'Container',
    this.width,
    this.height,
    this.minWidth,
    this.maxWidth,
    this.minHeight,
    this.maxHeight,
    this.padding = UiEdgeInsets.zero,
    this.margin = UiEdgeInsets.zero,
    this.direction,
    this.wrap = false,
    this.scrollable = false,
    this.flex,
    this.children = const <UiComponentNode>[],
    this.text,
    this.fontSize,
    this.maxLines,
    this.softWrap = true,
    this.estimatedCharWidthRatio = 0.55,
    this.estimatedLineHeightRatio = 1.25,
  });

  /// Creates a Row layout container.
  factory UiComponentNode.row({
    required String id,
    List<UiComponentNode> children = const <UiComponentNode>[],
    double? width,
    double? height,
    UiEdgeInsets padding = UiEdgeInsets.zero,
    UiEdgeInsets margin = UiEdgeInsets.zero,
    bool wrap = false,
    bool scrollable = false,
  }) {
    return UiComponentNode(
      id: id,
      type: 'Row',
      direction: FlexDirection.row,
      width: width,
      height: height,
      padding: padding,
      margin: margin,
      wrap: wrap,
      scrollable: scrollable,
      children: children,
    );
  }

  /// Creates a Column layout container.
  factory UiComponentNode.column({
    required String id,
    List<UiComponentNode> children = const <UiComponentNode>[],
    double? width,
    double? height,
    UiEdgeInsets padding = UiEdgeInsets.zero,
    UiEdgeInsets margin = UiEdgeInsets.zero,
    bool scrollable = false,
  }) {
    return UiComponentNode(
      id: id,
      type: 'Column',
      direction: FlexDirection.column,
      width: width,
      height: height,
      padding: padding,
      margin: margin,
      scrollable: scrollable,
      children: children,
    );
  }

  /// Creates a Text element.
  factory UiComponentNode.text({
    required String id,
    required String text,
    double fontSize = 14.0,
    int? maxLines,
    bool softWrap = true,
    UiEdgeInsets margin = UiEdgeInsets.zero,
  }) {
    return UiComponentNode(
      id: id,
      type: 'Text',
      text: text,
      fontSize: fontSize,
      maxLines: maxLines,
      softWrap: softWrap,
      margin: margin,
    );
  }

  /// Parses a node from a JSON map descriptor.
  factory UiComponentNode.fromJson(Map<String, dynamic> json) {
    FlexDirection? dir;
    final String? dirStr = json['direction']?.toString().toLowerCase();
    if (dirStr == 'row') {
      dir = FlexDirection.row;
    } else if (dirStr == 'column') {
      dir = FlexDirection.column;
    }

    UiEdgeInsets parseInsets(dynamic val) {
      if (val is Map<String, dynamic>) {
        return UiEdgeInsets.only(
          left: (val['left'] as num?)?.toDouble() ?? 0.0,
          top: (val['top'] as num?)?.toDouble() ?? 0.0,
          right: (val['right'] as num?)?.toDouble() ?? 0.0,
          bottom: (val['bottom'] as num?)?.toDouble() ?? 0.0,
        );
      } else if (val is num) {
        return UiEdgeInsets.all(val.toDouble());
      }
      return UiEdgeInsets.zero;
    }

    final List<dynamic>? rawChildren = json['children'] as List<dynamic>?;
    final List<UiComponentNode> parsedChildren = rawChildren != null
        ? rawChildren
              .whereType<Map<String, dynamic>>()
              .map(UiComponentNode.fromJson)
              .toList()
        : const <UiComponentNode>[];

    return UiComponentNode(
      id: json['id']?.toString() ?? 'node_${json.hashCode}',
      type: json['type']?.toString() ?? 'Container',
      width: (json['width'] as num?)?.toDouble(),
      height: (json['height'] as num?)?.toDouble(),
      minWidth: (json['min_width'] as num?)?.toDouble(),
      maxWidth: (json['max_width'] as num?)?.toDouble(),
      minHeight: (json['min_height'] as num?)?.toDouble(),
      maxHeight: (json['max_height'] as num?)?.toDouble(),
      padding: parseInsets(json['padding']),
      margin: parseInsets(json['margin']),
      direction: dir,
      wrap: json['wrap'] == true,
      scrollable: json['scrollable'] == true,
      flex: (json['flex'] as num?)?.toInt(),
      children: parsedChildren,
      text: json['text']?.toString(),
      fontSize: (json['font_size'] as num?)?.toDouble(),
      maxLines: (json['max_lines'] as num?)?.toInt(),
      softWrap: json['soft_wrap'] != false,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'type': type,
    if (width != null) 'width': width,
    if (height != null) 'height': height,
    if (minWidth != null) 'min_width': minWidth,
    if (maxWidth != null) 'max_width': maxWidth,
    if (minHeight != null) 'min_height': minHeight,
    if (maxHeight != null) 'max_height': maxHeight,
    'padding': padding.toJson(),
    'margin': margin.toJson(),
    if (direction != null) 'direction': direction!.name,
    'wrap': wrap,
    'scrollable': scrollable,
    if (flex != null) 'flex': flex,
    if (children.isNotEmpty)
      'children': children.map((UiComponentNode c) => c.toJson()).toList(),
    if (text != null) 'text': text,
    if (fontSize != null) 'font_size': fontSize,
    if (maxLines != null) 'max_lines': maxLines,
    'soft_wrap': softWrap,
  };
}

/// Thrown when a component exceeds layout boundaries or causes a RenderFlex overflow.
class ViewportOverflowException extends AxiomaUiException {
  /// Target viewport where overflow occurred.
  final ViewportSpec viewport;

  /// Accessibility text scale factor active when overflow occurred.
  final double textScaleFactor;

  /// Magnitude of overflow in logical pixels.
  final double overflowPixels;

  /// Axis of overflow ('horizontal' or 'vertical').
  final String axis;

  /// Name or ID of offending component.
  final String componentName;

  /// Available dimension in container/viewport.
  final double availableDimension;

  /// Required dimension calculated by layout engine.
  final double actualDimension;

  ViewportOverflowException({
    required this.viewport,
    required this.textScaleFactor,
    required this.overflowPixels,
    required this.axis,
    required this.componentName,
    required this.availableDimension,
    required this.actualDimension,
    String? customMessage,
  }) : super(
         customMessage ??
             'A RenderFlex overflowed by ${overflowPixels.toStringAsFixed(1)} pixels on the $axis '
                 'in component "$componentName" under viewport "${viewport.name}" '
                 '(${viewport.width.toInt()}x${viewport.height.toInt()}px, textScaleFactor: ${textScaleFactor.toStringAsFixed(1)}x). '
                 'Available $axis: ${availableDimension.toStringAsFixed(1)}px, Required: ${actualDimension.toStringAsFixed(1)}px.',
       );

  Map<String, dynamic> toJson() => <String, dynamic>{
    'error': 'ViewportOverflowException',
    'component': componentName,
    'viewport': viewport.toJson(),
    'text_scale_factor': textScaleFactor,
    'overflow_pixels': overflowPixels,
    'axis': axis,
    'available_dimension': availableDimension,
    'actual_dimension': actualDimension,
    'message': message,
  };
}

/// Specific violation record captured during multi-viewport matrix evaluation.
final class ViewportOverflowViolation {
  final ViewportSpec viewport;
  final double textScaleFactor;
  final double overflowPixels;
  final String axis;
  final String componentName;
  final double availableDimension;
  final double actualDimension;
  final String message;

  const ViewportOverflowViolation({
    required this.viewport,
    required this.textScaleFactor,
    required this.overflowPixels,
    required this.axis,
    required this.componentName,
    required this.availableDimension,
    required this.actualDimension,
    required this.message,
  });

  ViewportOverflowException toException() => ViewportOverflowException(
    viewport: viewport,
    textScaleFactor: textScaleFactor,
    overflowPixels: overflowPixels,
    axis: axis,
    componentName: componentName,
    availableDimension: availableDimension,
    actualDimension: actualDimension,
    customMessage: message,
  );

  Map<String, dynamic> toJson() => <String, dynamic>{
    'component': componentName,
    'viewport': viewport.toJson(),
    'text_scale_factor': textScaleFactor,
    'overflow_pixels': overflowPixels,
    'axis': axis,
    'available_dimension': availableDimension,
    'actual_dimension': actualDimension,
    'message': message,
  };
}

/// Result of evaluating a component in a single viewport and text-scale configuration.
final class ViewportMatrixResult {
  final ViewportSpec viewport;
  final double textScaleFactor;
  final bool passed;
  final double computedWidth;
  final double computedHeight;
  final List<ViewportOverflowViolation> violations;

  const ViewportMatrixResult({
    required this.viewport,
    required this.textScaleFactor,
    required this.passed,
    required this.computedWidth,
    required this.computedHeight,
    required this.violations,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'viewport': viewport.toJson(),
    'text_scale_factor': textScaleFactor,
    'passed': passed,
    'computed_width': computedWidth,
    'computed_height': computedHeight,
    'violations': violations
        .map((ViewportOverflowViolation v) => v.toJson())
        .toList(),
  };
}

/// Overall certification audit result across the entire matrix.
final class ViewportAuditResult {
  final String componentName;
  final bool passed;
  final int totalConfigurations;
  final List<ViewportMatrixResult> matrixResults;
  final List<ViewportOverflowViolation> violations;

  const ViewportAuditResult({
    required this.componentName,
    required this.passed,
    required this.totalConfigurations,
    required this.matrixResults,
    required this.violations,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'component_name': componentName,
    'passed': passed,
    'total_configurations': totalConfigurations,
    'matrix_results': matrixResults
        .map((ViewportMatrixResult r) => r.toJson())
        .toList(),
    'violations': violations
        .map((ViewportOverflowViolation v) => v.toJson())
        .toList(),
  };
}

/// Deterministic Test Harness for Multi-Viewport and Overflow Sentinel (§39 Pure Dart Core).
final class MultiViewportRunner {
  /// Target viewports to certify against.
  final List<ViewportSpec> viewports;

  /// Accessibility text zoom factors to certify against (default: 1.0 and 1.5).
  final List<double> textScaleFactors;

  /// If true, immediately throws [ViewportOverflowException] on the first detected overflow.
  final bool failFast;

  /// If true, validates vertical limits against viewport height when root container is unscrollable.
  final bool enforceVerticalLimits;

  const MultiViewportRunner({
    this.viewports = ViewportSpec.standardMatrix,
    this.textScaleFactors = const <double>[1.0, 1.5],
    this.failFast = true,
    this.enforceVerticalLimits = true,
  });

  /// Certifies a [UiComponentNode] tree across all viewports and text scale factors.
  ///
  /// Throws [ViewportOverflowException] if [failFast] is true and an overflow occurs.
  ViewportAuditResult testComponent(
    UiComponentNode root, {
    String? componentName,
  }) {
    final String name = componentName ?? root.id;
    final List<ViewportMatrixResult> matrixResults = <ViewportMatrixResult>[];
    final List<ViewportOverflowViolation> allViolations =
        <ViewportOverflowViolation>[];

    for (final ViewportSpec viewport in viewports) {
      for (final double textScale in textScaleFactors) {
        final ViewportContext context = ViewportContext(
          viewport: viewport,
          textScaleFactor: textScale,
        );

        final List<ViewportOverflowViolation> configViolations =
            <ViewportOverflowViolation>[];

        final (_LayoutSize size, _) = _evaluateLayout(
          root,
          availableWidth: viewport.width,
          availableHeight: viewport.height,
          context: context,
          violations: configViolations,
          isRoot: true,
        );

        if (configViolations.isNotEmpty) {
          allViolations.addAll(configViolations);
          if (failFast) {
            throw configViolations.first.toException();
          }
        }

        matrixResults.add(
          ViewportMatrixResult(
            viewport: viewport,
            textScaleFactor: textScale,
            passed: configViolations.isEmpty,
            computedWidth: size.width,
            computedHeight: size.height,
            violations: configViolations,
          ),
        );
      }
    }

    return ViewportAuditResult(
      componentName: name,
      passed: allViolations.isEmpty,
      totalConfigurations: viewports.length * textScaleFactors.length,
      matrixResults: matrixResults,
      violations: allViolations,
    );
  }

  /// Certifies a component produced dynamically by a [builder] function.
  ///
  /// Catches and translates any render failures into [ViewportOverflowException]
  /// if they occur when scaling text to 150% zoom.
  ViewportAuditResult testComponentBuilder(
    UiComponentNode Function(ViewportContext context) builder, {
    String? componentName,
  }) {
    final List<ViewportMatrixResult> matrixResults = <ViewportMatrixResult>[];
    final List<ViewportOverflowViolation> allViolations =
        <ViewportOverflowViolation>[];

    String? resolvedName = componentName;

    for (final ViewportSpec viewport in viewports) {
      for (final double textScale in textScaleFactors) {
        final ViewportContext context = ViewportContext(
          viewport: viewport,
          textScaleFactor: textScale,
        );

        UiComponentNode root;
        try {
          root = builder(context);
        } catch (e) {
          final ViewportOverflowException ex = ViewportOverflowException(
            viewport: viewport,
            textScaleFactor: textScale,
            overflowPixels: 1.0,
            axis: 'render_pipeline',
            componentName: resolvedName ?? 'BuilderComponent',
            availableDimension: viewport.width,
            actualDimension: viewport.width + 1.0,
            customMessage:
                'Render exception triggered under viewport "${viewport.name}" '
                'at textScaleFactor ${textScale.toStringAsFixed(1)}x: $e',
          );
          if (failFast) throw ex;
          final ViewportOverflowViolation v = ViewportOverflowViolation(
            viewport: viewport,
            textScaleFactor: textScale,
            overflowPixels: 1.0,
            axis: 'render_pipeline',
            componentName: resolvedName ?? 'BuilderComponent',
            availableDimension: viewport.width,
            actualDimension: viewport.width + 1.0,
            message: ex.message,
          );
          allViolations.add(v);
          matrixResults.add(
            ViewportMatrixResult(
              viewport: viewport,
              textScaleFactor: textScale,
              passed: false,
              computedWidth: viewport.width,
              computedHeight: viewport.height,
              violations: <ViewportOverflowViolation>[v],
            ),
          );
          continue;
        }

        resolvedName ??= root.id;

        final List<ViewportOverflowViolation> configViolations =
            <ViewportOverflowViolation>[];

        final (_LayoutSize size, _) = _evaluateLayout(
          root,
          availableWidth: viewport.width,
          availableHeight: viewport.height,
          context: context,
          violations: configViolations,
          isRoot: true,
        );

        if (configViolations.isNotEmpty) {
          allViolations.addAll(configViolations);
          if (failFast) {
            throw configViolations.first.toException();
          }
        }

        matrixResults.add(
          ViewportMatrixResult(
            viewport: viewport,
            textScaleFactor: textScale,
            passed: configViolations.isEmpty,
            computedWidth: size.width,
            computedHeight: size.height,
            violations: configViolations,
          ),
        );
      }
    }

    return ViewportAuditResult(
      componentName: resolvedName ?? 'DynamicComponent',
      passed: allViolations.isEmpty,
      totalConfigurations: viewports.length * textScaleFactors.length,
      matrixResults: matrixResults,
      violations: allViolations,
    );
  }

  /// Internal layout solver: computes dimensions and detects overflows.
  (_LayoutSize, bool) _evaluateLayout(
    UiComponentNode node, {
    required double availableWidth,
    required double availableHeight,
    required ViewportContext context,
    required List<ViewportOverflowViolation> violations,
    bool isRoot = false,
  }) {
    // 1. Text Element Layout
    if (node.text != null) {
      final double baseFontSize = node.fontSize ?? 14.0;
      final double effectiveFontSize = baseFontSize * context.textScaleFactor;
      final double charWidth = effectiveFontSize * node.estimatedCharWidthRatio;
      final double lineHeight =
          effectiveFontSize * node.estimatedLineHeightRatio;

      final int textLen = node.text!.length;
      final double rawTextWidth = textLen * charWidth;

      double computedWidth;
      double computedHeight;

      final bool isSingleLine = node.maxLines == 1 || !node.softWrap;

      if (isSingleLine) {
        computedWidth = rawTextWidth;
        computedHeight = lineHeight;

        if (computedWidth > availableWidth + 0.01) {
          final double overflow = computedWidth - availableWidth;
          violations.add(
            ViewportOverflowViolation(
              viewport: context.viewport,
              textScaleFactor: context.textScaleFactor,
              overflowPixels: overflow,
              axis: 'horizontal',
              componentName: node.id,
              availableDimension: availableWidth,
              actualDimension: computedWidth,
              message:
                  'A RenderFlex overflowed by ${overflow.toStringAsFixed(1)} pixels on the right '
                  'in single-line text "${node.id}" under viewport "${context.viewport.name}" '
                  '(${context.viewport.width.toInt()}x${context.viewport.height.toInt()}px, textScaleFactor: ${context.textScaleFactor.toStringAsFixed(1)}x). '
                  'Available width: ${availableWidth.toStringAsFixed(1)}px, Required width: ${computedWidth.toStringAsFixed(1)}px.',
            ),
          );
        }
      } else {
        // Multi-line text wrapping
        if (availableWidth <= 0) {
          computedWidth = rawTextWidth;
          computedHeight = lineHeight;
        } else {
          final int linesNeeded = math.max(
            1,
            (rawTextWidth / availableWidth).ceil(),
          );
          if (node.maxLines != null && linesNeeded > node.maxLines!) {
            final double overflow = (linesNeeded - node.maxLines!) * lineHeight;
            violations.add(
              ViewportOverflowViolation(
                viewport: context.viewport,
                textScaleFactor: context.textScaleFactor,
                overflowPixels: overflow,
                axis: 'vertical',
                componentName: node.id,
                availableDimension: node.maxLines! * lineHeight,
                actualDimension: linesNeeded * lineHeight,
                message:
                    'Text "${node.id}" exceeded maxLines (${node.maxLines}) by $overflow px '
                    'under viewport "${context.viewport.name}".',
              ),
            );
          }
          computedWidth = math.min(rawTextWidth, availableWidth);
          computedHeight = linesNeeded * lineHeight;
        }
      }

      // Add margins
      computedWidth += node.margin.horizontal;
      computedHeight += node.margin.vertical;

      return (_LayoutSize(computedWidth, computedHeight), false);
    }

    // 2. Explicit fixed dimension bounds check
    double innerAvailableWidth = availableWidth - node.margin.horizontal;
    double innerAvailableHeight = availableHeight - node.margin.vertical;

    if (node.width != null) {
      if (node.width! > innerAvailableWidth + 0.01 && !node.scrollable) {
        final double overflow = node.width! - innerAvailableWidth;
        violations.add(
          ViewportOverflowViolation(
            viewport: context.viewport,
            textScaleFactor: context.textScaleFactor,
            overflowPixels: overflow,
            axis: 'horizontal',
            componentName: node.id,
            availableDimension: innerAvailableWidth,
            actualDimension: node.width!,
            message:
                'A RenderFlex overflowed by ${overflow.toStringAsFixed(1)} pixels on the right '
                'in fixed-width component "${node.id}" under viewport "${context.viewport.name}" '
                '(${context.viewport.width.toInt()}x${context.viewport.height.toInt()}px, textScaleFactor: ${context.textScaleFactor.toStringAsFixed(1)}x). '
                'Available width: ${innerAvailableWidth.toStringAsFixed(1)}px, Required width: ${node.width!.toStringAsFixed(1)}px.',
          ),
        );
      }
    }

    if (node.height != null && enforceVerticalLimits && isRoot) {
      if (node.height! > innerAvailableHeight + 0.01 && !node.scrollable) {
        final double overflow = node.height! - innerAvailableHeight;
        violations.add(
          ViewportOverflowViolation(
            viewport: context.viewport,
            textScaleFactor: context.textScaleFactor,
            overflowPixels: overflow,
            axis: 'vertical',
            componentName: node.id,
            availableDimension: innerAvailableHeight,
            actualDimension: node.height!,
            message:
                'A RenderFlex overflowed by ${overflow.toStringAsFixed(1)} pixels on the bottom '
                'in component "${node.id}" under viewport "${context.viewport.name}". '
                'Available height: ${innerAvailableHeight.toStringAsFixed(1)}px, Required height: ${node.height!.toStringAsFixed(1)}px.',
          ),
        );
      }
    }

    // 3. Flex Container (Row or Column)
    final double contentAvailableWidth = math.max(
      0.0,
      (node.width ?? innerAvailableWidth) - node.padding.horizontal,
    );
    final double contentAvailableHeight = math.max(
      0.0,
      (node.height ?? innerAvailableHeight) - node.padding.vertical,
    );

    double childrenWidth = 0.0;
    double childrenHeight = 0.0;

    if (node.direction == FlexDirection.row) {
      // Row flex layout
      if (node.wrap) {
        // Wrapped row: wraps into multiple lines
        double currentRowWidth = 0.0;
        double currentRowHeight = 0.0;
        double totalWrappedHeight = 0.0;
        double maxRowWidth = 0.0;

        for (final UiComponentNode child in node.children) {
          final (_LayoutSize childSize, _) = _evaluateLayout(
            child,
            availableWidth: contentAvailableWidth,
            availableHeight: contentAvailableHeight,
            context: context,
            violations: violations,
          );

          if (childSize.width > contentAvailableWidth + 0.01 &&
              !child.scrollable) {
            // Child alone exceeds available width
            final double overflow = childSize.width - contentAvailableWidth;
            violations.add(
              ViewportOverflowViolation(
                viewport: context.viewport,
                textScaleFactor: context.textScaleFactor,
                overflowPixels: overflow,
                axis: 'horizontal',
                componentName: child.id,
                availableDimension: contentAvailableWidth,
                actualDimension: childSize.width,
                message:
                    'Child "${child.id}" in wrapped Row "${node.id}" overflowed by ${overflow.toStringAsFixed(1)}px '
                    'under viewport "${context.viewport.name}".',
              ),
            );
          }

          if (currentRowWidth + childSize.width > contentAvailableWidth &&
              currentRowWidth > 0) {
            // Wrap to next line
            maxRowWidth = math.max(maxRowWidth, currentRowWidth);
            totalWrappedHeight += currentRowHeight;
            currentRowWidth = childSize.width;
            currentRowHeight = childSize.height;
          } else {
            currentRowWidth += childSize.width;
            currentRowHeight = math.max(currentRowHeight, childSize.height);
          }
        }
        maxRowWidth = math.max(maxRowWidth, currentRowWidth);
        totalWrappedHeight += currentRowHeight;

        childrenWidth = maxRowWidth;
        childrenHeight = totalWrappedHeight;
      } else {
        // Non-wrapped Row: sums widths, overflows if total > available
        double rowTotalWidth = 0.0;
        double rowMaxHeight = 0.0;

        for (final UiComponentNode child in node.children) {
          final (_LayoutSize childSize, _) = _evaluateLayout(
            child,
            availableWidth: contentAvailableWidth,
            availableHeight: contentAvailableHeight,
            context: context,
            violations: violations,
          );
          rowTotalWidth += childSize.width;
          rowMaxHeight = math.max(rowMaxHeight, childSize.height);
        }

        childrenWidth = rowTotalWidth;
        childrenHeight = rowMaxHeight;

        if (rowTotalWidth > contentAvailableWidth + 0.01 && !node.scrollable) {
          final double overflow = rowTotalWidth - contentAvailableWidth;
          violations.add(
            ViewportOverflowViolation(
              viewport: context.viewport,
              textScaleFactor: context.textScaleFactor,
              overflowPixels: overflow,
              axis: 'horizontal',
              componentName: node.id,
              availableDimension: contentAvailableWidth,
              actualDimension: rowTotalWidth,
              message:
                  'A RenderFlex overflowed by ${overflow.toStringAsFixed(1)} pixels on the right '
                  'in Row "${node.id}" under viewport "${context.viewport.name}" '
                  '(${context.viewport.width.toInt()}x${context.viewport.height.toInt()}px, textScaleFactor: ${context.textScaleFactor.toStringAsFixed(1)}x). '
                  'Available width: ${contentAvailableWidth.toStringAsFixed(1)}px, Required width: ${rowTotalWidth.toStringAsFixed(1)}px.',
            ),
          );
        }
      }
    } else if (node.direction == FlexDirection.column) {
      // Column flex layout
      double colMaxWidth = 0.0;
      double colTotalHeight = 0.0;

      for (final UiComponentNode child in node.children) {
        final (_LayoutSize childSize, _) = _evaluateLayout(
          child,
          availableWidth: contentAvailableWidth,
          availableHeight: contentAvailableHeight,
          context: context,
          violations: violations,
        );
        colMaxWidth = math.max(colMaxWidth, childSize.width);
        colTotalHeight += childSize.height;
      }

      childrenWidth = colMaxWidth;
      childrenHeight = colTotalHeight;

      if (colTotalHeight > contentAvailableHeight + 0.01 &&
          !node.scrollable &&
          enforceVerticalLimits &&
          isRoot) {
        final double overflow = colTotalHeight - contentAvailableHeight;
        violations.add(
          ViewportOverflowViolation(
            viewport: context.viewport,
            textScaleFactor: context.textScaleFactor,
            overflowPixels: overflow,
            axis: 'vertical',
            componentName: node.id,
            availableDimension: contentAvailableHeight,
            actualDimension: colTotalHeight,
            message:
                'A RenderFlex overflowed by ${overflow.toStringAsFixed(1)} pixels on the bottom '
                'in Column "${node.id}" under viewport "${context.viewport.name}" '
                '(${context.viewport.width.toInt()}x${context.viewport.height.toInt()}px, textScaleFactor: ${context.textScaleFactor.toStringAsFixed(1)}x). '
                'Available height: ${contentAvailableHeight.toStringAsFixed(1)}px, Required height: ${colTotalHeight.toStringAsFixed(1)}px.',
          ),
        );
      }
    } else {
      // Generic container with children
      double maxChildWidth = 0.0;
      double maxChildHeight = 0.0;

      for (final UiComponentNode child in node.children) {
        final (_LayoutSize childSize, _) = _evaluateLayout(
          child,
          availableWidth: contentAvailableWidth,
          availableHeight: contentAvailableHeight,
          context: context,
          violations: violations,
        );
        maxChildWidth = math.max(maxChildWidth, childSize.width);
        maxChildHeight = math.max(maxChildHeight, childSize.height);
      }

      childrenWidth = maxChildWidth;
      childrenHeight = maxChildHeight;
    }

    final double totalWidth =
        (node.width ?? (childrenWidth + node.padding.horizontal)) +
        node.margin.horizontal;
    final double totalHeight =
        (node.height ?? (childrenHeight + node.padding.vertical)) +
        node.margin.vertical;

    return (_LayoutSize(totalWidth, totalHeight), false);
  }
}

/// Helper record for layout dimensions.
final class _LayoutSize {
  final double width;
  final double height;

  const _LayoutSize(this.width, this.height);
}
