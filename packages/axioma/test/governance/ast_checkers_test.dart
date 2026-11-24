// ast_checkers_test.dart — Suite de Certificación Pure Dart de Checkers AST (§4, §6, §39, §43).
import 'package:axioma/src/governance/ast_anti_mock_checker.dart';
import 'package:axioma/src/governance/ast_sad_path_checker.dart';
import 'package:test/test.dart';

void main() {
  group(
    'AstCheckersPureSuite — Certificación de Reglas AST en Pure Dart (§4, §6, §39)',
    () {
      const AstSadPathChecker sadPathChecker = AstSadPathChecker();
      const AstAntiMockChecker antiMockChecker = AstAntiMockChecker();

      // =======================================================================
      // HAPPY PATHS
      // =======================================================================

      test(
        'Happy Path 1: Suite con I/O y aserción throwsA es aprobada compliant',
        () {
          const String testCode = '''
import 'dart:io';
import 'package:test/test.dart';

void main() {
  test('Happy Path: Lee archivo exitosamente', () async {
    final File f = File('test.txt');
    expect(await f.exists(), isTrue);
  });

  test('Sad Path (§6): Archivo inexistente arroja FileSystemException', () {
    expect(() => File('none.txt').readAsStringSync(), throwsA(isA<FileSystemException>()));
  });
}
''';

          final AstSadPathResult result = sadPathChecker.analyzeSource(
            testCode,
            filePath: 'test/io_suite_test.dart',
          );

          expect(result.isCompliant, isTrue);
          expect(result.category, equals(CodeDomainCategory.ioOrAsync));
          expect(result.hasHappyPath, isTrue);
          expect(result.hasSadPath, isTrue);
          expect(result.violations, isEmpty);
        },
      );

      test(
        'Happy Path 2 (Enmienda Fable 5.2): Función pura sin I/O exenta de throwsA pero con valores de frontera es aprobada',
        () {
          const String pureCode = '''
import 'package:test/test.dart';

int add(int a, int b) => a + b;

void main() {
  test('Happy Path: Suma dos enteros positivos', () {
    expect(add(2, 3), equals(5));
  });

  test('Boundary: Suma con cero retorna el mismo valor', () {
    expect(add(5, 0), equals(5));
    expect(add(0, 0), equals(0));
  });
}
''';

          final AstSadPathResult result = sadPathChecker.analyzeSource(
            pureCode,
            filePath: 'test/pure_calculator_test.dart',
          );

          expect(result.isCompliant, isTrue);
          expect(result.category, equals(CodeDomainCategory.pureComputation));
          expect(result.hasBoundaryTests, isTrue);
          expect(result.violations, isEmpty);
        },
      );

      test(
        'Happy Path 3: Código de producción sin mocks y con fakes en memoria es 100% limpio (§4)',
        () {
          const String prodCode = '''
abstract class OrderRepository {
  Future<void> save(String id);
}

class FakeOrderRepository implements OrderRepository {
  final List<String> saved = <String>[];
  @override
  Future<void> save(String id) async {
    saved.add(id);
  }
}
''';

          final AstMockReport report = antiMockChecker.checkSource(
            prodCode,
            filePath: 'lib/src/order_service.dart',
          );

          expect(report.isClean, isTrue);
          expect(report.violations, isEmpty);
        },
      );

      // =======================================================================
      // SAD PATHS (§6 Mandatorio con throwsA)
      // =======================================================================

      test(
        'Sad Path 1 (§6): Suite I/O sin Sad Path mandatorio arroja SadPathViolationException',
        () {
          const String ioWithoutSad = '''
import 'dart:io';
import 'package:test/test.dart';

void main() {
  test('Happy Path: Lee archivo', () async {
    final File f = File('data.txt');
    expect(f.path, equals('data.txt'));
  });
}
''';

          expect(
            () => sadPathChecker.analyzeSource(
              ioWithoutSad,
              filePath: 'test/io_missing_sad_test.dart',
              throwOnError: true,
            ),
            throwsA(
              isA<SadPathViolationException>().having(
                (SadPathViolationException e) => e.violations,
                'violations',
                isNotEmpty,
              ),
            ),
          );
        },
      );

      test(
        'Sad Path 2 (§6): Función pura sin I/O que carece de pruebas de frontera arroja SadPathViolationException',
        () {
          const String pureWithoutBoundary = '''
import 'package:test/test.dart';

int multiply(int a, int b) => a * b;

void main() {
  test('Happy Path: Multiplicación normal', () {
    expect(multiply(3, 4), equals(12));
  });
}
''';

          expect(
            () => sadPathChecker.analyzeSource(
              pureWithoutBoundary,
              filePath: 'test/pure_missing_boundary_test.dart',
              throwOnError: true,
            ),
            throwsA(
              isA<SadPathViolationException>().having(
                (SadPathViolationException e) => e.message,
                'message',
                contains('Sad Path'),
              ),
            ),
          );
        },
      );

      test(
        'Sad Path 3 (§4): Código en lib/ con import mockito arroja MockDoctrineViolationException',
        () {
          const String mockitoCode = '''
import 'package:mockito/mockito.dart';

class AuthService {}
''';

          expect(
            () => antiMockChecker.checkSource(
              mockitoCode,
              filePath: 'lib/src/auth_service.dart',
              throwOnError: true,
            ),
            throwsA(
              isA<MockDoctrineViolationException>().having(
                (MockDoctrineViolationException e) => e.violations.first.type,
                'violationType',
                equals(MockViolationType.mockImport),
              ),
            ),
          );
        },
      );

      test(
        'Sad Path 4 (§4): Código en lib/ con clase que hereda Mock arroja MockDoctrineViolationException',
        () {
          const String mockClassCode = '''
class UserGatewayMock extends Mock {}
''';

          expect(
            () => antiMockChecker.checkSource(
              mockClassCode,
              filePath: 'lib/src/user_gateway.dart',
              throwOnError: true,
            ),
            throwsA(
              isA<MockDoctrineViolationException>().having(
                (MockDoctrineViolationException e) => e.violations.first.type,
                'violationType',
                equals(MockViolationType.mockInheritance),
              ),
            ),
          );
        },
      );

      test(
        'Sad Path 5 (§6): Código fuente vacío en analyzeSource arroja ArgumentError',
        () {
          expect(
            () => sadPathChecker.analyzeSource('   '),
            throwsA(isA<ArgumentError>()),
          );
          expect(
            () => antiMockChecker.checkSource('   '),
            throwsA(isA<ArgumentError>()),
          );
        },
      );
    },
  );
}
