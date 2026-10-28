import 'dart:io';
import 'package:test/test.dart';
import 'package:axioma/src/analysis/product_leak_linter.dart';

void main() {
  group('ProductLeakLinter', () {
    const ProductLeakLinter linter = ProductLeakLinter();

    test('Clean Dart code produces zero matches', () {
      const String cleanCode = '''
class GovernanceEngine {
  final String nodeId;
  const GovernanceEngine(this.nodeId);
  void evaluateRules() {}
}
''';
      final List<ProductLeakMatch> matches = linter.lintSource(cleanCode);
      expect(matches, isEmpty);
    });

    test(
      'Warn-only mode detects prohibited satellite terms without throwing',
      () {
        const String leakingCode = '''
class SatelliteAdapter {
  final String fitmentId;
  final String catalogPartCode;
  final String partTaxonomyLevel;
  final String oemCleanerStatus;

  const SatelliteAdapter({
    required this.fitmentId,
    required this.catalogPartCode,
    required this.partTaxonomyLevel,
    required this.oemCleanerStatus,
  });
}
''';
        final List<ProductLeakMatch> matches = linter.lintSource(
          leakingCode,
          enforce: false,
        );

        expect(matches.length, greaterThanOrEqualTo(4));
        expect(
          matches.any(
            (ProductLeakMatch m) => m.term.toLowerCase() == 'fitment',
          ),
          isTrue,
        );
        expect(
          matches.any(
            (ProductLeakMatch m) => m.term.toLowerCase() == 'catalogpart',
          ),
          isTrue,
        );
        expect(
          matches.any(
            (ProductLeakMatch m) => m.term.toLowerCase() == 'parttaxonomy',
          ),
          isTrue,
        );
        expect(
          matches.any(
            (ProductLeakMatch m) => m.term.toLowerCase() == 'oemcleaner',
          ),
          isTrue,
        );
      },
    );

    test(
      'Enforce mode throws ProductLeakException when leak terms present',
      () {
        const String leakingCode = '''
void registerPart() {
  final String fitment = 'universal';
}
''';
        expect(
          () => linter.lintSource(leakingCode, enforce: true),
          throwsA(
            isA<ProductLeakException>().having(
              (ProductLeakException e) => e.matches.length,
              'matches count',
              greaterThanOrEqualTo(1),
            ),
          ),
        );
      },
    );

    test(
      'lintDirectory correctly identifies leaks across files in directory',
      () async {
        final Directory tempDir = await Directory.systemTemp.createTemp(
          'product_leak_test_',
        );

        try {
          final File cleanFile = File('${tempDir.path}/clean.dart');
          await cleanFile.writeAsString(
            'class CoreModel { final int id = 1; }',
          );

          final File dirtyFile = File('${tempDir.path}/dirty.dart');
          await dirtyFile.writeAsString(
            'class VehiclePart { final String fitment = "auto"; }',
          );

          final List<ProductLeakMatch> matches = await linter.lintDirectory(
            tempDir,
            enforce: false,
          );
          expect(matches, isNotEmpty);
          expect(matches.first.term.toLowerCase(), contains('fitment'));

          await expectLater(
            () => linter.lintDirectory(tempDir, enforce: true),
            throwsA(isA<ProductLeakException>()),
          );
        } finally {
          if (await tempDir.exists()) {
            await tempDir.delete(recursive: true);
          }
        }
      },
    );
  });
}
