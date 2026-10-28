import 'package:test/test.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:axioma/src/schema/control_registry.dart';

void main() {
  group(
    'TASK-CORE-05: Control Registry Manager Tests (§1, §4, §6, §39, §46)',
    () {
      late Database db;
      late ControlRegistryManager manager;

      setUp(() {
        db = sqlite3.openInMemory();
        manager = ControlRegistryManager(db);
        manager.initSchema();
      });

      tearDown(() {
        db.dispose();
      });

      test(
        'Happy Path: Inicializa schema, registra control y lo consulta activamente',
        () {
          final GovernanceControl control = const GovernanceControl(
            controlId: 'CORE-01',
            node: 'conext_core',
            binaryCheck: '.git/hooks/pre-push',
            description:
                'Bloqueo git pre-push ante fallos de análisis estático',
          );

          manager.registerControl(control);

          final List<GovernanceControl> active = manager.getActiveControls(
            'conext_core',
          );
          expect(active.length, equals(1));
          expect(active.first.controlId, equals('CORE-01'));
          expect(active.first.binaryCheck, equals('.git/hooks/pre-push'));
          expect(manager.isControlActive('CORE-01'), isTrue);
        },
      );

      test('Happy Path: Actualiza control existente manteniendo unicidad', () {
        final GovernanceControl initial = const GovernanceControl(
          controlId: 'AUTOMA-01',
          node: 'automa',
          binaryCheck: 'db/migrations/003.sql',
          description: 'Version inicial',
        );
        manager.registerControl(initial);

        final GovernanceControl updated = const GovernanceControl(
          controlId: 'AUTOMA-01',
          node: 'automa',
          binaryCheck: 'db/migrations/003_add_sla.sql',
          description: 'Version actualizada con SLA',
        );
        manager.registerControl(updated);

        final List<GovernanceControl> active = manager.getActiveControls(
          'automa',
        );
        expect(active.length, equals(1));
        expect(
          active.first.binaryCheck,
          equals('db/migrations/003_add_sla.sql'),
        );
        expect(active.first.description, equals('Version actualizada con SLA'));
      });

      test('Sad Path: Lanza ArgumentError si controlId está vacío (§6)', () {
        final GovernanceControl invalid = const GovernanceControl(
          controlId: '   ',
          node: 'Smart',
          binaryCheck: 'check.sh',
          description: 'Invalido',
        );

        expect(
          () => manager.registerControl(invalid),
          throwsA(isA<ArgumentError>()),
        );
      });

      test('Sad Path: Lanza ArgumentError si binaryCheck está vacío (§6)', () {
        final GovernanceControl invalid = const GovernanceControl(
          controlId: 'SMART-01',
          node: 'Smart',
          binaryCheck: '',
          description: 'Invalido',
        );

        expect(
          () => manager.registerControl(invalid),
          throwsA(isA<ArgumentError>()),
        );
      });

      test(
        'Sad Path: isControlActive retorna false para control inexistente',
        () {
          expect(manager.isControlActive('NON_EXISTENT'), isFalse);
        },
      );
    },
  );
}
