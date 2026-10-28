import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

void main() {
  group('RepoMapGenerator — Pure Dart Structural RepoMap (§4, §6, §39)', () {
    late RepoMapGenerator generator;

    setUp(() {
      generator = const RepoMapGenerator(maxTokens: 512, dampingFactor: 0.85);
    });

    group('Happy Paths', () {
      test(
        'HP-1: Calcula PageRank y otorga mayor jerarquía al archivo más referenciado',
        () {
          // Archivo A es un modelo base (Core)
          // Archivo B y Archivo C hacen referencia a la clase UserModel de A
          final Map<String, String> files = <String, String>{
            'lib/models/user_model.dart': '''
            class UserModel {
              final String id;
              final String name;
              UserModel({required this.id, required this.name});
              String getDisplayName() => name;
            }
          ''',
            'lib/services/auth_service.dart': '''
            import 'package:app/models/user_model.dart';
            class AuthService {
              UserModel? currentUser;
              Future<UserModel> login(String email) async {
                return UserModel(id: "1", name: email);
              }
            }
          ''',
            'lib/controllers/user_controller.dart': '''
            import 'package:app/models/user_model.dart';
            class UserController {
              UserModel profile() => UserModel(id: "2", name: "Guest");
            }
          ''',
          };

          final RepoMap repoMap = generator.generateFromSourceMap(files);

          expect(repoMap.includedFiles, contains('lib/models/user_model.dart'));
          expect(repoMap.fileScores, contains('lib/models/user_model.dart'));

          // user_model es referenciado por auth_service y user_controller, debe tener el score más alto
          final double modelScore =
              repoMap.fileScores['lib/models/user_model.dart']!;
          final double authScore =
              repoMap.fileScores['lib/services/auth_service.dart']!;
          final double controllerScore =
              repoMap.fileScores['lib/controllers/user_controller.dart']!;

          expect(modelScore, greaterThan(authScore));
          expect(modelScore, greaterThan(controllerScore));
        },
      );

      test(
        'HP-2: Renderizado estructural contiene símbolos y firmas sin cuerpos verbosos',
        () {
          final Map<String, String> files = <String, String>{
            'lib/engine.dart': '''
            class ExecutionEngine {
              void start() {
                // implementación compleja
                int x = 10;
                print(x);
              }
              Future<bool> stop() async {
                return true;
              }
            }
            enum EngineState {
              idle,
              running,
              halted
            }
          ''',
          };

          final RepoMap repoMap = generator.generateFromSourceMap(files);
          final String outline = repoMap.formattedOutline;

          expect(outline, contains('class ExecutionEngine'));
          expect(outline, contains('void start()'));
          expect(outline, contains('Future<bool> stop()'));
          expect(outline, contains('enum EngineState'));
          // No debe filtrar la implementación interna verbosa
          expect(outline, isNot(contains('int x = 10;')));
        },
      );

      test(
        'HP-3: Presupuesto restrictivo trunca archivos de menor jerarquía',
        () {
          // Generador con presupuesto restrictivo (ej. 70 tokens)
          final RepoMapGenerator tightGenerator = const RepoMapGenerator(
            maxTokens: 70,
          );

          final Map<String, String> files = <String, String>{
            'lib/important.dart': '''
            class CoreRoot {
              void primaryAction() {}
            }
          ''',
            'lib/secondary.dart': '''
            class SecondaryModule {
              void secondaryAction() {}
            }
          ''',
            'lib/tertiary.dart': '''
            class TertiaryModule {
              void tertiaryAction() {}
            }
          ''',
          };

          final RepoMap repoMap = tightGenerator.generateFromSourceMap(files);

          expect(repoMap.includedFiles.length, lessThan(3));
          expect(repoMap.omittedFiles.isNotEmpty, isTrue);
          expect(repoMap.totalTokensEstimate, lessThanOrEqualTo(75));
          expect(repoMap.formattedOutline, contains('Truncated'));
        },
      );

      test(
        'HP-4: Conservación estocástica de PageRank (suma normalizada ~1.0)',
        () {
          final Map<String, String> files = <String, String>{
            'lib/a.dart': 'class Alpha { Beta? b; }',
            'lib/b.dart': 'class Beta { Gamma? g; }',
            'lib/c.dart': 'class Gamma { Alpha? a; }',
            'lib/d.dart': 'class Delta {}',
          };

          final RepoMap repoMap = generator.generateFromSourceMap(files);
          final double sum = repoMap.fileScores.values.reduce(
            (double a, double b) => a + b,
          );

          expect(sum, closeTo(1.0, 0.05));
        },
      );
    });

    group('Sad Paths', () {
      test(
        'SP-1: generateFromSourceMap lanza RepoMapException ante mapa vacío',
        () {
          expect(
            () => generator.generateFromSourceMap(<String, String>{}),
            throwsA(isA<RepoMapException>()),
          );
        },
      );

      test(
        'SP-2: RepoMapGenerator con dampingFactor fuera de (0, 1) lanza AssertionError',
        () {
          expect(
            () => RepoMapGenerator(dampingFactor: 1.5),
            throwsA(isA<AssertionError>()),
          );
          expect(
            () => RepoMapGenerator(dampingFactor: -0.1),
            throwsA(isA<AssertionError>()),
          );
        },
      );

      test('SP-3: maxTokens <= 0 lanza AssertionError', () {
        expect(
          () => RepoMapGenerator(maxTokens: 0),
          throwsA(isA<AssertionError>()),
        );
      });

      test(
        'SP-4: Archivo con llaves desbalanceadas no cuelga el parser (resiliencia)',
        () {
          final Map<String, String> brokenFiles = <String, String>{
            'lib/broken.dart': '''
            class BrokenClass {
              void unclosedMethod( {
                int broken = 1;
          ''',
          };

          expect(
            () => generator.generateFromSourceMap(brokenFiles),
            returnsNormally,
          );
          final RepoMap repoMap = generator.generateFromSourceMap(brokenFiles);
          expect(repoMap.includedFiles, contains('lib/broken.dart'));
        },
      );
    });
  });
}
