// car_taxonomy_test.dart — Suite de Certificación de Taxonomía Causal CAR (§4, §6, §39, §46).
//
// Mandatos Constitucionales:
// - §4  Tolerancia Cero a Mocks (ejecución real, sin mocks ni stubs)
// - §6  Sad Path Mandatorio (aserciones negativas estrictas throwsA con ArgumentError)
// - §39 Pure Dart Core (cero dependencias de UI o Flutter)
// - §46 Inmunización Genética y Cierre Cibernético CAR (prohibición de "error humano",
//       inmunización obligatoria ante recurrencia >= 3)
library;

import 'package:axioma/src/governance/car_taxonomy.dart';
import 'package:test/test.dart';

void main() {
  group('CAR Taxonomy Schema & Inmunización (§4, §6, §39, §46)', () {
    // =========================================================================
    // HAPPY PATHS
    // =========================================================================

    test(
      'Happy Path 1: Creación canónica de CarCausalRecord con campos tipados',
      () {
        final DateTime now = DateTime.utc(2026, 11, 3, 14, 0, 0);
        final CarCausalRecord record = CarCausalRecord(
          id: 'rec-001',
          defectId: 'TCK-SMART-8201',
          failureType: CarFailureType.schemaDrift,
          subsystem: CarSubsystem.storageDatabase,
          rootCauseCategory: CarTechnicalRootCauseCategory.ddlContractMismatch,
          technicalDescription:
              'Discrepancia entre columnas de la tabla SQLite y entidad ORM en memoria',
          astSignature: 'TableDefinition[name="catalog_parts"]',
          filePath: 'lib/src/storage/catalog_db.dart',
          lineNumber: 142,
          preventiveAction: 'AST_LINT: ddl_schema_consistency_check',
          recurrenceCount: 1,
          createdAt: now,
          metadata: <String, dynamic>{'severity': 'HIGH', 'phase': 'takeover'},
        );

        expect(record.id, equals('rec-001'));
        expect(record.defectId, equals('TCK-SMART-8201'));
        expect(record.failureType, equals(CarFailureType.schemaDrift));
        expect(record.subsystem, equals(CarSubsystem.storageDatabase));
        expect(
          record.rootCauseCategory,
          equals(CarTechnicalRootCauseCategory.ddlContractMismatch),
        );
        expect(
          record.technicalDescription,
          contains('Discrepancia entre columnas'),
        );
        expect(
          record.astSignature,
          equals('TableDefinition[name="catalog_parts"]'),
        );
        expect(record.filePath, equals('lib/src/storage/catalog_db.dart'));
        expect(record.lineNumber, equals(142));
        expect(
          record.preventiveAction,
          equals('AST_LINT: ddl_schema_consistency_check'),
        );
        expect(record.recurrenceCount, equals(1));
        expect(record.requiresImmunityLinter, isFalse);
        expect(record.createdAt, equals(now));
        expect(record.metadata['severity'], equals('HIGH'));
        expect(record.fingerprint, isNotEmpty);
        expect(record.fingerprint.length, equals(64)); // SHA-256 hex string
      },
    );

    test(
      'Happy Path 2: Serialización y deserialización JSON con paridad canónica',
      () {
        final DateTime fixedDate = DateTime.utc(2026, 11, 3, 12, 30, 0);
        final CarCausalRecord original = CarCausalRecord(
          id: 'rec-002',
          defectId: 'TCK-SMART-8202',
          failureType: CarFailureType.astSyntaxError,
          subsystem: CarSubsystem.sharedKernelAxioma,
          rootCauseCategory: CarTechnicalRootCauseCategory.missingAstValidation,
          technicalDescription:
              'Invocación a método no definido en interfaz tras refactorización',
          astSignature: 'MethodInvocation[name="syncSchema"]',
          filePath: 'packages/axioma/lib/src/governance/upstream_pointer.dart',
          lineNumber: 88,
          preventiveAction: 'AST_LINT: forbid_unresolved_selector',
          recurrenceCount: 2,
          createdAt: fixedDate,
        );

        final Map<String, dynamic> json = original.toJson();
        expect(json['id'], equals('rec-002'));
        expect(json['failure_type'], equals('ast_syntax_error'));
        expect(json['subsystem'], equals('shared_kernel_axioma'));
        expect(json['root_cause_category'], equals('missing_ast_validation'));
        expect(json['fingerprint'], equals(original.fingerprint));

        final CarCausalRecord restored = CarCausalRecord.fromJson(json);
        expect(restored.id, equals(original.id));
        expect(restored.defectId, equals(original.defectId));
        expect(restored.failureType, equals(original.failureType));
        expect(restored.subsystem, equals(original.subsystem));
        expect(restored.rootCauseCategory, equals(original.rootCauseCategory));
        expect(
          restored.technicalDescription,
          equals(original.technicalDescription),
        );
        expect(restored.astSignature, equals(original.astSignature));
        expect(restored.filePath, equals(original.filePath));
        expect(restored.lineNumber, equals(original.lineNumber));
        expect(restored.preventiveAction, equals(original.preventiveAction));
        expect(restored.recurrenceCount, equals(original.recurrenceCount));
        expect(restored.fingerprint, equals(original.fingerprint));
      },
    );

    test(
      'Happy Path 3: CMMI Nivel 5 (§46) activa requiresImmunityLinter ante recurrencia >= 3',
      () {
        final CarCausalRecord r1 = CarCausalRecord(
          id: 'rec-rec-1',
          defectId: 'DEF-100',
          failureType: CarFailureType.runtimeCrash,
          subsystem: CarSubsystem.kernelCore,
          rootCauseCategory: CarTechnicalRootCauseCategory.unhandledEdgeCase,
          technicalDescription: 'Fallo por lista vacía en bifurcación atómica',
          recurrenceCount: 1,
        );
        expect(r1.requiresImmunityLinter, isFalse);

        final CarCausalRecord r2 = r1.copyWith(recurrenceCount: 2);
        expect(r2.requiresImmunityLinter, isFalse);

        final CarCausalRecord r3 = r1.copyWith(recurrenceCount: 3);
        expect(r3.requiresImmunityLinter, isTrue);

        final CarCausalRecord r5 = r1.copyWith(recurrenceCount: 5);
        expect(r5.requiresImmunityLinter, isTrue);
      },
    );

    test('Happy Path 4: Huella digital determinista y reproducible', () {
      final CarCausalRecord a = CarCausalRecord(
        id: 'id-a',
        defectId: 'DEF-A',
        failureType: CarFailureType.tautologicalTest,
        subsystem: CarSubsystem.testHarness,
        rootCauseCategory:
            CarTechnicalRootCauseCategory.missingNegativeAssertion,
        technicalDescription: 'Test sin aserción negativa ni throwsA',
        filePath: 'test/governance/dummy_test.dart',
      );

      final CarCausalRecord b = CarCausalRecord(
        id: 'id-b', // ID diferente
        defectId: 'DEF-B', // defectId diferente
        failureType: CarFailureType.tautologicalTest,
        subsystem: CarSubsystem.testHarness,
        rootCauseCategory:
            CarTechnicalRootCauseCategory.missingNegativeAssertion,
        technicalDescription: 'Test sin aserción negativa ni throwsA',
        filePath: 'test/governance/dummy_test.dart',
      );

      // La huella causal técnica debe ser idéntica para permitir agregación
      expect(a.fingerprint, equals(b.fingerprint));
    });

    test(
      'Happy Path 5: Clasificación heurística de mensajes de error de compilación/runtime',
      () {
        expect(
          CarTaxonomyClassifier.classifyFailureMessage(
            "Target of URI does not exist: 'package:unknown/module.dart'",
          ),
          equals(CarFailureType.astSyntaxError),
        );

        expect(
          CarTaxonomyClassifier.classifyFailureMessage(
            "A value of type 'String' can't be assigned to a variable of type 'int'",
          ),
          equals(CarFailureType.typeContractViolation),
        );

        expect(
          CarTaxonomyClassifier.classifyFailureMessage(
            'SqliteException: no such table: catalog_items',
          ),
          equals(CarFailureType.schemaDrift),
        );

        expect(
          CarTaxonomyClassifier.classifyFailureMessage(
            'Found forbidden mock package: mocktail in domain test',
          ),
          equals(CarFailureType.mockLeak),
        );

        expect(
          CarTaxonomyClassifier.classifyFailureMessage(
            'Test suite contiene prueba tautológica sin sad path',
          ),
          equals(CarFailureType.tautologicalTest),
        );

        expect(
          CarTaxonomyClassifier.classifyFailureMessage(
            'Out of Memory: heap allocation failed',
          ),
          equals(CarFailureType.resourceExhaustion),
        );

        expect(
          CarTaxonomyClassifier.classifyFailureMessage(
            'TimeoutException: Future not completed within 10000ms',
          ),
          equals(CarFailureType.timeoutExceeded),
        );

        expect(
          CarTaxonomyClassifier.classifyFailureMessage(
            'Unhandled exception: Null check operator used on a null value',
          ),
          equals(CarFailureType.runtimeCrash),
        );
      },
    );

    test(
      'Happy Path 6: Inferencia de subsistema a partir de rutas agnósticas de archivo',
      () {
        expect(
          CarTaxonomyClassifier.inferSubsystem(
            'packages/axioma/lib/src/governance/car_taxonomy.dart',
          ),
          equals(CarSubsystem.sharedKernelAxioma),
        );

        expect(
          CarTaxonomyClassifier.inferSubsystem(
            'packages/ingestion_engine/lib/src/parser.dart',
          ),
          equals(CarSubsystem.ingestionEngine),
        );

        expect(
          CarTaxonomyClassifier.inferSubsystem('bin/logix'),
          equals(CarSubsystem.kernelCore),
        );

        expect(
          CarTaxonomyClassifier.inferSubsystem(
            '.agents/skills/fleet-worker-dispatch/SKILL.md',
          ),
          equals(CarSubsystem.skillsExecution),
        );

        expect(
          CarTaxonomyClassifier.inferSubsystem(
            'test/governance/car_taxonomy_test.dart',
          ),
          equals(CarSubsystem.testHarness),
        );

        expect(
          CarTaxonomyClassifier.inferSubsystem(
            'lib/src/database/sqlite_store.dart',
          ),
          equals(CarSubsystem.storageDatabase),
        );

        expect(
          CarTaxonomyClassifier.inferSubsystem(
            'tools/car_retrospective_gate.dart',
          ),
          equals(CarSubsystem.cliTooling),
        );
      },
    );

    test(
      'Happy Path 7: Inferencia de causa raíz técnica desde patrones de falla',
      () {
        expect(
          CarTaxonomyClassifier.inferTechnicalRootCause(
            'Falta regla linter AST para detectar llamadas prohibidas',
          ),
          equals(CarTechnicalRootCauseCategory.missingAstValidation),
        );

        expect(
          CarTaxonomyClassifier.inferTechnicalRootCause(
            'Unexpected null value encountered on boundary value',
          ),
          equals(CarTechnicalRootCauseCategory.unhandledEdgeCase),
        );

        expect(
          CarTaxonomyClassifier.inferTechnicalRootCause(
            'Violación de boundary e importación de módulo ajeno',
          ),
          equals(CarTechnicalRootCauseCategory.architecturalBoundaryViolation),
        );

        expect(
          CarTaxonomyClassifier.inferTechnicalRootCause(
            'DDL schema mismatch in column types',
          ),
          equals(CarTechnicalRootCauseCategory.ddlContractMismatch),
        );

        expect(
          CarTaxonomyClassifier.inferTechnicalRootCause(
            'Falta aserción throwsA en sad path',
          ),
          equals(CarTechnicalRootCauseCategory.missingNegativeAssertion),
        );
      },
    );

    test(
      'Happy Path 8: Fábrica CarTaxonomyClassifier.createRecord construye y resuelve campos',
      () {
        final CarCausalRecord record = CarTaxonomyClassifier.createRecord(
          defectId: 'TCK-DEF-500',
          technicalDescription:
              'Desalineación de clave foránea en base de datos SQLite',
          rawErrorMessage: 'SqliteException: no such table: foreign_keys',
          filePath: 'packages/axioma/lib/src/schema/control_registry.dart',
          preventiveAction: 'AST_LINT: check_ddl_integrity',
        );

        expect(record.id, startsWith('car-rec-'));
        expect(record.defectId, equals('TCK-DEF-500'));
        expect(record.failureType, equals(CarFailureType.schemaDrift));
        expect(record.subsystem, equals(CarSubsystem.sharedKernelAxioma));
        expect(
          record.rootCauseCategory,
          equals(CarTechnicalRootCauseCategory.ddlContractMismatch),
        );
        expect(record.requiresImmunityLinter, isFalse);
      },
    );

    test(
      'Happy Path 9: CarTaxonomySentinel.containsHumanError reporta correctamente',
      () {
        expect(
          CarTaxonomySentinel.containsHumanError(
            'Falta de validación de null-safety en AST',
          ),
          isFalse,
        );
        expect(
          CarTaxonomySentinel.containsHumanError('Condición de carrera'),
          isFalse,
        );
        expect(
          CarTaxonomySentinel.containsHumanError(
            'Fue un error humano evidente',
          ),
          isTrue,
        );
        expect(
          CarTaxonomySentinel.containsHumanError('Causado por human_error'),
          isTrue,
        );
      },
    );

    test(
      'Happy Path 10: Degradación serena en parsers de enum ante valores desconocidos (Calm UX)',
      () {
        expect(CarFailureType.fromString(null), equals(CarFailureType.unknown));
        expect(
          CarFailureType.fromString('inexistente'),
          equals(CarFailureType.unknown),
        );
        expect(CarSubsystem.fromString(null), equals(CarSubsystem.unspecified));
        expect(
          CarSubsystem.fromString('unknown_subsystem'),
          equals(CarSubsystem.unspecified),
        );
        expect(
          CarTechnicalRootCauseCategory.fromString(null),
          equals(CarTechnicalRootCauseCategory.unclassifiedTechnical),
        );
        expect(
          CarTechnicalRootCauseCategory.fromString('algo_raro'),
          equals(CarTechnicalRootCauseCategory.unclassifiedTechnical),
        );
      },
    );

    // =========================================================================
    // SAD PATHS (§6, §46): PROHIBICIÓN DE "ERROR HUMANO" Y VALIDACIONES
    // =========================================================================

    test(
      'Sad Path 1 (§6, §46): Intento de registrar causa con "error humano" lanza ArgumentError',
      () {
        expect(
          () => CarCausalRecord(
            id: 'sp-1',
            defectId: 'DEF-SP1',
            failureType: CarFailureType.runtimeCrash,
            subsystem: CarSubsystem.kernelCore,
            rootCauseCategory: CarTechnicalRootCauseCategory.unhandledEdgeCase,
            technicalDescription:
                'El fallo ocurrió debido a un error humano en el turno de noche',
          ),
          throwsA(
            isA<ArgumentError>().having(
              (ArgumentError e) => e.message.toString(),
              'message',
              contains('🚨 [VETO-CONSTITUCIONAL-CAR §46]'),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path 2 (§6, §46): Intento de registrar causa con "human error" lanza ArgumentError',
      () {
        expect(
          () => CarCausalRecord(
            id: 'sp-2',
            defectId: 'DEF-SP2',
            failureType: CarFailureType.runtimeCrash,
            subsystem: CarSubsystem.kernelCore,
            rootCauseCategory: CarTechnicalRootCauseCategory.unhandledEdgeCase,
            technicalDescription: 'Root cause was identified as human error',
          ),
          throwsA(
            isA<ArgumentError>().having(
              (ArgumentError e) => e.name,
              'name',
              equals('technicalDescription'),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path 3 (§6, §46): Intento de registrar causa con "fallo humano" o "falla humana" lanza ArgumentError',
      () {
        expect(
          () => CarTaxonomySentinel.validateTechnicalRootCause(
            'Esto fue un fallo humano al codificar',
          ),
          throwsA(isA<ArgumentError>()),
        );

        expect(
          () => CarTaxonomySentinel.validateTechnicalRootCause(
            'Se detectó una falla humana en la operación',
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test(
      'Sad Path 4 (§6, §46): Variantes como "developer error", "descuido", "pebkac" lanzan ArgumentError',
      () {
        final List<String> bannedVariations = <String>[
          'developer error in logic',
          'developer_error during commit',
          'descuido del desarrollador',
          'descuido al escribir la función',
          'olvido al declarar el campo',
          'negligencia humana durante el refactoring',
          'user mistake in implementation',
          'user error in configuration',
          'human mistake in code',
          'problema de tipo pebkac',
          'culpa del programador',
          'operator error in script',
        ];

        for (final String variant in bannedVariations) {
          expect(
            () => CarTaxonomySentinel.validateTechnicalRootCause(variant),
            throwsA(isA<ArgumentError>()),
            reason: 'Debería vetar la frase prohibida: "$variant"',
          );
        }
      },
    );

    test(
      'Sad Path 5 (§6, §46): Intento de incluir "error humano" en preventiveAction lanza ArgumentError',
      () {
        expect(
          () => CarCausalRecord(
            id: 'sp-5',
            defectId: 'DEF-SP5',
            failureType: CarFailureType.runtimeCrash,
            subsystem: CarSubsystem.kernelCore,
            rootCauseCategory:
                CarTechnicalRootCauseCategory.missingAstValidation,
            technicalDescription: 'Falta de chequeo condicional en función',
            preventiveAction: 'Capacitar al personal para evitar error humano',
          ),
          throwsA(
            isA<ArgumentError>().having(
              (ArgumentError e) => e.name,
              'name',
              equals('preventiveAction'),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path 6 (§6, §46): Intento de incluir "human error" en metadata lanza ArgumentError',
      () {
        expect(
          () => CarCausalRecord(
            id: 'sp-6',
            defectId: 'DEF-SP6',
            failureType: CarFailureType.runtimeCrash,
            subsystem: CarSubsystem.kernelCore,
            rootCauseCategory:
                CarTechnicalRootCauseCategory.missingAstValidation,
            technicalDescription: 'Falta de validación previa en AST',
            metadata: <String, dynamic>{'notes': 'Suspected human_error'},
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test(
      'Sad Path 7 (§6): CarCausalRecord con id vacío lanza ArgumentError',
      () {
        expect(
          () => CarCausalRecord(
            id: '   ',
            defectId: 'DEF-1',
            failureType: CarFailureType.unknown,
            subsystem: CarSubsystem.unspecified,
            rootCauseCategory:
                CarTechnicalRootCauseCategory.unclassifiedTechnical,
            technicalDescription: 'Descripción válida',
          ),
          throwsA(
            isA<ArgumentError>().having(
              (ArgumentError e) => e.name,
              'name',
              equals('id'),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path 8 (§6): CarCausalRecord con defectId vacío lanza ArgumentError',
      () {
        expect(
          () => CarCausalRecord(
            id: 'id-valid',
            defectId: '',
            failureType: CarFailureType.unknown,
            subsystem: CarSubsystem.unspecified,
            rootCauseCategory:
                CarTechnicalRootCauseCategory.unclassifiedTechnical,
            technicalDescription: 'Descripción válida',
          ),
          throwsA(
            isA<ArgumentError>().having(
              (ArgumentError e) => e.name,
              'name',
              equals('defectId'),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path 9 (§6): CarCausalRecord con technicalDescription vacía lanza ArgumentError',
      () {
        expect(
          () => CarCausalRecord(
            id: 'id-valid',
            defectId: 'DEF-1',
            failureType: CarFailureType.unknown,
            subsystem: CarSubsystem.unspecified,
            rootCauseCategory:
                CarTechnicalRootCauseCategory.unclassifiedTechnical,
            technicalDescription: '   ',
          ),
          throwsA(
            isA<ArgumentError>().having(
              (ArgumentError e) => e.name,
              'name',
              equals('technicalDescription'),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path 10 (§6): CarCausalRecord con recurrenceCount negativo lanza ArgumentError',
      () {
        expect(
          () => CarCausalRecord(
            id: 'id-valid',
            defectId: 'DEF-1',
            failureType: CarFailureType.unknown,
            subsystem: CarSubsystem.unspecified,
            rootCauseCategory:
                CarTechnicalRootCauseCategory.unclassifiedTechnical,
            technicalDescription: 'Descripción técnica válida',
            recurrenceCount: -1,
          ),
          throwsA(
            isA<ArgumentError>().having(
              (ArgumentError e) => e.name,
              'name',
              equals('recurrenceCount'),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path 11 (§6, §46): Deserialización de JSON con "error humano" lanza ArgumentError',
      () {
        final Map<String, dynamic> toxicJson = <String, dynamic>{
          'id': 'tox-01',
          'defect_id': 'DEF-TOX',
          'failure_type': 'runtime_crash',
          'subsystem': 'kernel_core',
          'root_cause_category': 'unhandled_edge_case',
          'technical_description':
              'Se atribuye a un fallo humano del operador en consola',
        };

        expect(
          () => CarCausalRecord.fromJson(toxicJson),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test(
      'Sad Path 12 (§6, §46): Fábrica createRecord con "error humano" lanza ArgumentError',
      () {
        expect(
          () => CarTaxonomyClassifier.createRecord(
            defectId: 'DEF-CREATE',
            technicalDescription:
                'Hubo un error humano al desplegar la versión',
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );
  });
}
