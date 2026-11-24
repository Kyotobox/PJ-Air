/// ast_validator_test.dart — Suite de Certificación Física de AstGovernanceValidator (§4, §6, §39, §46, §60.7).
library;

import 'dart:io';
import 'package:axioma/src/governance/ast_validator.dart';
import 'package:axioma/src/governance/validation_codes.dart';
import 'package:test/test.dart';

void main() {
  group('AstGovernanceValidator — Pure Dart Governance Suite (§39, §46)', () {
    final AstGovernanceValidator validator = AstGovernanceValidator();

    test(
      'Happy Path: Código Dart limpio sin violaciones valida exitosamente',
      () {
        const String cleanCode = '''
import 'package:axioma/axioma.dart';

class OrderProcessor {
  bool processOrder(String orderId) {
    if (orderId.isEmpty) return false;
    return true;
  }
}
''';

        final AstValidationReport report = validator.validateContent(
          cleanCode,
          filePath: 'lib/src/order_processor.dart',
          isTestFile: false,
        );

        expect(report.isClean, isTrue);
        expect(report.violationsCount, equals(0));
        expect(report.maxExitCode, equals(0));
        expect(report.violations, isEmpty);
      },
    );

    test('Happy Path: Parseo de reporte JSON limpio de ast-grep', () {
      const String cleanJson = '''
{
  "success": true,
  "violations_count": 0,
  "scanned_files": 42,
  "elapsed_ms": 15.3,
  "violations": []
}
''';

      final AstValidationReport report = validator.parseAstGrepJson(cleanJson);
      expect(report.isClean, isTrue);
      expect(report.violationsCount, equals(0));
      expect(report.scannedFilesCount, equals(42));
      expect(report.maxExitCode, equals(0));
    });

    test(
      'Happy Path: Validación de archivo físico existente en disco',
      () async {
        final File dummyFile = File(
          '${Directory.systemTemp.path}/clean_gov_test.dart',
        );
        try {
          await dummyFile.writeAsString("void main() { print('clean'); }\n");
          final AstValidationReport report = await validator.validateFile(
            dummyFile,
          );
          expect(report.isClean, isTrue);
          expect(report.violationsCount, equals(0));
        } finally {
          if (await dummyFile.exists()) {
            await dummyFile.delete();
          }
        }
      },
    );

    test(
      'Sad Path 1 (Ruptura §6, §46): Import interno de src/ detecta internalPackageImport',
      () {
        const String dirtyCode = '''
import 'package:go_router/src/router.dart';

void main() {}
''';

        final AstValidationReport report = validator.validateContent(
          dirtyCode,
          filePath: 'lib/src/features/router.dart',
          isTestFile: false,
        );

        expect(report.isClean, isFalse);
        expect(report.violationsCount, equals(1));
        expect(
          report.violations.first.code,
          equals(AstValidationCode.internalPackageImport),
        );
        expect(report.maxExitCode, equals(461));
        expect(
          report.violations.first.ruleId,
          equals('dart-no-internal-package-src-import'),
        );
      },
    );

    test(
      'Sad Path 2 (Ruptura §6): Aserción tautológica en test detecta tautologicalTest',
      () {
        const String testWithTautology = '''
import 'package:test/test.dart';

void main() {
  test('tautology', () {
    expect(true, isTrue);
  });
}
''';

        final AstValidationReport report = validator.validateContent(
          testWithTautology,
          filePath: 'test/unit/sample_test.dart',
          isTestFile: true,
        );

        expect(report.isClean, isFalse);
        expect(report.violationsCount, equals(1));
        expect(
          report.violations.first.code,
          equals(AstValidationCode.tautologicalTest),
        );
        expect(report.maxExitCode, equals(6));
      },
    );

    test(
      'Sad Path 3 (Ruptura §6): validateFile con archivo inexistente arroja AstValidationException',
      () async {
        final File nonExistent = File(
          '${Directory.systemTemp.path}/non_existent_ast_file_xyz.dart',
        );

        expect(
          () async => await validator.validateFile(nonExistent),
          throwsA(isA<AstValidationException>()),
        );
      },
    );

    test(
      'Sad Path 4 (Ruptura §6): parseAstGrepJson con JSON vacío arroja AstValidationException',
      () {
        expect(
          () => validator.parseAstGrepJson('   '),
          throwsA(isA<AstValidationException>()),
        );
      },
    );

    test(
      'Sad Path 5 (Ruptura §6): validateContent con ruta vacía arroja AstValidationException',
      () {
        expect(
          () => validator.validateContent('void main() {}', filePath: '  '),
          throwsA(isA<AstValidationException>()),
        );
      },
    );
  });
}
