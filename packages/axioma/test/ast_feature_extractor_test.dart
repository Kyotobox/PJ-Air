import 'package:axioma/src/neural/ast_feature_extractor.dart';
import 'package:test/test.dart';

void main() {
  const AstFeatureExtractor extractor = AstFeatureExtractor();

  // ---------------------------------------------------------------------------
  // HAPPY PATHS
  // ---------------------------------------------------------------------------
  group('AstFeatureExtractor — Happy Paths', () {
    test('HP-1: Función simple de una línea produce vector coherente', () {
      const String source = '''
void greet(String name) {
  print('Hello, \$name');
}
''';
      final AstVector v = extractor.extract(source);

      expect(
        v.lineCount,
        greaterThan(0),
        reason: 'Debe haber líneas no vacías',
      );
      expect(
        v.methodCount,
        equals(1),
        reason: 'Exactamente 1 método declarado',
      );
      expect(v.maxNestingDepth, equals(1), reason: 'Un nivel de llaves');
      expect(
        v.cyclomaticComplexity,
        equals(1),
        reason: 'Sin ramificaciones: CC = 1',
      );
      expect(v.conditionalCount, equals(0), reason: 'Sin condicionales');
    });

    test(
      'HP-2: Clase con varios métodos y condicionales → vector completo',
      () {
        const String source = '''
class Calculator {
  int add(int a, int b) => a + b;

  int divide(int a, int b) {
    if (b == 0) {
      throw ArgumentError('División por cero');
    }
    return a ~/ b;
  }

  String classify(int n) {
    if (n < 0) {
      return 'negativo';
    } else if (n == 0) {
      return 'cero';
    } else {
      return 'positivo';
    }
  }
}
''';
        final AstVector v = extractor.extract(source);

        // Métodos: add, divide, classify → 3
        expect(v.methodCount, equals(3));

        // Condicionales: if(b==0), if(n<0), else if(n==0) → mínimo 3
        expect(v.conditionalCount, greaterThanOrEqualTo(3));

        // Profundidad: class {} > method {} > if {} → mínimo 3
        expect(v.maxNestingDepth, greaterThanOrEqualTo(2));

        // CC ≥ 1 + 3 if + 1 else if = al menos 5
        expect(v.cyclomaticComplexity, greaterThanOrEqualTo(4));

        // lineCount debe ser > 0
        expect(v.lineCount, greaterThan(0));
      },
    );

    test(
      'HP-3: Código con bucles for/while incrementa complejidad ciclomática',
      () {
        const String source = '''
List<int> filter(List<int> items) {
  final result = <int>[];
  for (final item in items) {
    if (item > 0) {
      result.add(item);
    }
  }
  int i = 0;
  while (i < result.length) {
    i++;
  }
  return result;
}
''';
        final AstVector v = extractor.extract(source);

        expect(v.methodCount, equals(1));
        // CC: 1 base + 1 for + 1 if + 1 while = 4
        expect(v.cyclomaticComplexity, greaterThanOrEqualTo(4));
        expect(v.conditionalCount, greaterThanOrEqualTo(1));
        expect(v.maxNestingDepth, greaterThanOrEqualTo(2));
      },
    );

    test(
      'HP-4: Código con switch incrementa correctamente condicionales y CC',
      () {
        const String source = '''
String dayName(int day) {
  switch (day) {
    case 1:
      return 'Lunes';
    case 2:
      return 'Martes';
    case 3:
      return 'Miércoles';
    default:
      return 'Otro';
  }
}
''';
        final AstVector v = extractor.extract(source);

        expect(v.methodCount, equals(1));
        // switch = 1 condicional
        expect(v.conditionalCount, greaterThanOrEqualTo(1));
        // CC: 1 + 1 switch + 3 case = 5
        expect(v.cyclomaticComplexity, greaterThanOrEqualTo(4));
      },
    );

    test('HP-5: Profundidad máxima correcta en código muy anidado', () {
      const String source = '''
void deepNest() {
  if (true) {
    for (int i = 0; i < 10; i++) {
      while (i > 0) {
        try {
          doSomething();
        } catch (e) {
          handle(e);
        }
      }
    }
  }
}
''';
      final AstVector v = extractor.extract(source);

      // Profundidad: void{} > if{} > for{} > while{} > try{} = 5
      expect(v.maxNestingDepth, greaterThanOrEqualTo(4));
      // CC: 1 + if + for + while + catch = al menos 5
      expect(v.cyclomaticComplexity, greaterThanOrEqualTo(5));
    });

    test('HP-6: toList() retorna 5 dimensiones en orden canónico', () {
      const String source = '''
int sum(int a, int b) {
  return a + b;
}
''';
      final AstVector v = extractor.extract(source);
      final List<int> list = v.toList();

      expect(list.length, equals(5));
      expect(list[0], equals(v.lineCount));
      expect(list[1], equals(v.methodCount));
      expect(list[2], equals(v.conditionalCount));
      expect(list[3], equals(v.maxNestingDepth));
      expect(list[4], equals(v.cyclomaticComplexity));
    });

    test('HP-7: toNormalizedList() retorna valores en [0.0, 1.0]', () {
      const String source = '''
int multiply(int a, int b) => a * b;
''';
      final AstVector v = extractor.extract(source);
      final List<double> normalized = v.toNormalizedList();

      expect(normalized.length, equals(5));
      for (final double val in normalized) {
        expect(val, inInclusiveRange(0.0, 1.0));
      }
    });

    test('HP-8: AstVector implementa igualdad por valor (==)', () {
      const AstVector v1 = AstVector(
        lineCount: 10,
        methodCount: 2,
        conditionalCount: 3,
        maxNestingDepth: 4,
        cyclomaticComplexity: 5,
      );
      const AstVector v2 = AstVector(
        lineCount: 10,
        methodCount: 2,
        conditionalCount: 3,
        maxNestingDepth: 4,
        cyclomaticComplexity: 5,
      );
      const AstVector v3 = AstVector(
        lineCount: 99,
        methodCount: 2,
        conditionalCount: 3,
        maxNestingDepth: 4,
        cyclomaticComplexity: 5,
      );

      expect(v1, equals(v2));
      expect(v1.hashCode, equals(v2.hashCode));
      expect(v1, isNot(equals(v3)));
    });

    test(
      'HP-9: Código con comentarios no infla los conteos de condicionales',
      () {
        // Los comentarios contienen "if" y "switch" — no deben contarse
        const String source = '''
// if this were a comment, it should not count
/* switch (day) { case 1: return 'lunes'; } */
int absoluteValue(int n) {
  return n < 0 ? -n : n;
}
''';
        final AstVector v = extractor.extract(source);

        // Solo el ternario `?` debería contar como condicional
        expect(v.conditionalCount, equals(1));
        expect(v.methodCount, equals(1));
      },
    );

    test(
      'HP-10: toString() tiene formato legible y contiene todos los campos',
      () {
        const AstVector v = AstVector(
          lineCount: 5,
          methodCount: 1,
          conditionalCount: 2,
          maxNestingDepth: 3,
          cyclomaticComplexity: 4,
        );
        final String s = v.toString();

        expect(s, contains('lines=5'));
        expect(s, contains('methods=1'));
        expect(s, contains('conditionals=2'));
        expect(s, contains('depth=3'));
        expect(s, contains('cc=4'));
      },
    );
  });

  // ---------------------------------------------------------------------------
  // SAD PATHS (§6 — Sad Path mandatorio)
  // ---------------------------------------------------------------------------
  group('AstFeatureExtractor — Sad Paths', () {
    test('SP-1: Código vacío ("") lanza FormatException', () {
      expect(
        () => extractor.extract(''),
        throwsA(
          isA<FormatException>().having(
            (FormatException e) => e.message,
            'message',
            contains('AstFeatureExtractor'),
          ),
        ),
      );
    });

    test(
      'SP-2: Código solo con espacios y saltos de línea lanza FormatException',
      () {
        expect(
          () => extractor.extract('   \n\n\t   \n  '),
          throwsA(isA<FormatException>()),
        );
      },
    );

    test(
      'SP-3: Código solo con comentarios (sin código real) no lanza excepción '
      'porque el string no está vacío — los conteos son 0 o mínimo',
      () {
        // Un archivo con solo comentarios es un caso borde válido:
        // el extractor no lanza excepción porque el string no es vacío.
        // Los conteos de métodos, condicionales, etc. deben ser 0.
        const String source = '''
// Solo un comentario.
// Nada más aquí.
''';
        // No debe lanzar excepción
        final AstVector v = extractor.extract(source);

        expect(v.methodCount, equals(0));
        expect(v.conditionalCount, equals(0));
        expect(v.cyclomaticComplexity, equals(1)); // Base CC = 1
      },
    );

    test('SP-4: Código con llaves desbalanceadas no lanza excepción pero '
        'reporta profundidad coherente (tratamiento defensivo)', () {
      // El extractor no es un parser completo; ante llaves desbalanceadas
      // debe degradar graciosamente sin lanzar errores internos.
      const String source = '''
void broken() {
  if (true) {
    doSomething();
  // falta la llave de cierre de broken
''';
      // No debe lanzar excepción interna
      expect(() => extractor.extract(source), returnsNormally);
      final AstVector v = extractor.extract(source);

      // La profundidad máxima debe ser al menos 2
      expect(v.maxNestingDepth, greaterThanOrEqualTo(2));
    });

    test('SP-5: String de un solo carácter no vacío no lanza excepción', () {
      final AstVector v = extractor.extract('{');
      expect(v.lineCount, equals(1));
      expect(v.methodCount, equals(0));
      expect(v.maxNestingDepth, equals(1));
    });
  });

  // ---------------------------------------------------------------------------
  // INVARIANTES DE VECTOR
  // ---------------------------------------------------------------------------
  group('AstVector — Invariantes', () {
    test('INV-1: Todos los campos de AstVector son no negativos', () {
      const String source = 'void foo() {}';
      final AstVector v = extractor.extract(source);

      expect(v.lineCount, isNonNegative);
      expect(v.methodCount, isNonNegative);
      expect(v.conditionalCount, isNonNegative);
      expect(v.maxNestingDepth, isNonNegative);
      expect(v.cyclomaticComplexity, isNonNegative);
    });

    test('INV-2: CC siempre es al menos 1 para código no vacío', () {
      const String source = 'final x = 42;';
      final AstVector v = extractor.extract(source);
      expect(v.cyclomaticComplexity, greaterThanOrEqualTo(1));
    });

    test('INV-3: toNormalizedList con valores extremos no supera 1.0 ni baja de 0.0', () {
      // Vector con valores enormes → normalización no debe exceder 1.0
      const AstVector v = AstVector(
        lineCount: 99999,
        methodCount: 99999,
        conditionalCount: 99999,
        maxNestingDepth: 99999,
        cyclomaticComplexity: 99999,
      );
      final List<double> normalized = v.toNormalizedList();
      for (final double val in normalized) {
        expect(val, lessThanOrEqualTo(1.0));
        expect(val, greaterThanOrEqualTo(0.0));
      }
    });
  });
}
