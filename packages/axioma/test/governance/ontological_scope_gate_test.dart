/// ontological_scope_gate_test.dart — Suite de Certificación Física de Alcance Ontológico (ADLC §4, §6, §39, §60.7, §62).
library;

import 'package:axioma/src/governance/ontological_scope_gate.dart';
import 'package:axioma/src/governance/backlog_validator.dart';
import 'package:test/test.dart';

void main() {
  group('OntologicalScopeGate — Certificación Física ADLC (§39, §62)', () {
    test(
      'Happy Path: Satélite operando legítimamente dentro de su dominio de producto',
      () {
        final OntologicalScopeResult result = OntologicalScopeGate.evaluate(
          originNodeId: 'Ruedas',
          originBunkerType: 'satellite',
          targetNodeId: 'Ruedas',
          targetFiles: <String>[
            'lib/src/features/catalog/catalog_service.dart',
            'test/features/catalog/catalog_test.dart',
          ],
          throwOnError: true,
        );

        expect(result.isApproved, isTrue);
        expect(result.exitCode, equals(0));
        expect(result.violations, isEmpty);
        expect(result.originNodeId, equals('Ruedas'));
      },
    );

    test(
      'Happy Path: Hub de gobernanza operando sobre Shared Kernel y herramientas CLI',
      () {
        final OntologicalScopeResult result = OntologicalScopeGate.evaluate(
          originNodeId: 'Smart',
          originBunkerType: 'hub',
          targetNodeId: 'Smart',
          targetFiles: <String>[
            'packages/axioma/lib/src/governance/policy.dart',
            'bin/logix',
          ],
          throwOnError: true,
        );

        expect(result.isApproved, isTrue);
        expect(result.exitCode, equals(0));
        expect(result.violations, isEmpty);
      },
    );

    test(
      'Sad Path 1 (Ruptura): Satélite intentando modificar infraestructura de servidor (services/)',
      () {
        expect(
          () => OntologicalScopeGate.evaluate(
            originNodeId: 'Ruedas',
            originBunkerType: 'satellite',
            targetNodeId: 'Ruedas',
            targetFiles: <String>[
              'lib/src/catalog.dart',
              'services/automa_daemon.py',
            ],
            throwOnError: true,
          ),
          throwsA(
            isA<ScopeViolationException>()
                .having(
                  (ScopeViolationException e) => e.exitCode,
                  'exitCode',
                  equals(42),
                )
                .having(
                  (ScopeViolationException e) => e.violations.any(
                    (String v) =>
                        v.contains('Intromisión de Infraestructura Prohibida'),
                  ),
                  'violationMessage',
                  isTrue,
                ),
          ),
        );

        // Evaluación no arrojadiza
        final OntologicalScopeResult nonThrowing =
            OntologicalScopeGate.evaluate(
              originNodeId: 'Ruedas',
              originBunkerType: 'satellite',
              targetFiles: <String>['tools/infra/reaper.py'],
              throwOnError: false,
            );
        expect(nonThrowing.isApproved, isFalse);
        expect(nonThrowing.exitCode, equals(42));
      },
    );

    test(
      'Sad Path 2 (Ruptura): Satélite intentando cross-node ticket para Automa (§60.8)',
      () {
        expect(
          () => OntologicalScopeGate.evaluate(
            originNodeId: 'Ruedas',
            originBunkerType: 'satellite',
            targetNodeId: 'Automa',
            targetFiles: <String>['lib/feature.dart'],
            throwOnError: true,
          ),
          throwsA(
            isA<ScopeViolationException>()
                .having(
                  (ScopeViolationException e) => e.exitCode,
                  'exitCode',
                  equals(42),
                )
                .having(
                  (ScopeViolationException e) => e.violations.any(
                    (String v) => v.contains('Violación de Perímetro Sónico'),
                  ),
                  'violationMessage',
                  isTrue,
                ),
          ),
        );
      },
    );

    test(
      'Sad Path 3 (Ruptura): Hub intentando inyectar código de UI de satélite (Governance Overreach §40, §62)',
      () {
        expect(
          () => OntologicalScopeGate.evaluate(
            originNodeId: 'Smart',
            originBunkerType: 'hub',
            targetNodeId: 'Ruedas',
            targetFiles: <String>['lib/ui/screens/catalog_screen.dart'],
            throwOnError: true,
          ),
          throwsA(
            isA<GovernanceOverreachException>()
                .having(
                  (GovernanceOverreachException e) => e.exitCode,
                  'exitCode',
                  equals(43),
                )
                .having(
                  (GovernanceOverreachException e) => e.violations.any(
                    (String v) => v.contains('Extralimitación de Gobernanza'),
                  ),
                  'violationMessage',
                  isTrue,
                ),
          ),
        );

        final OntologicalScopeResult nonThrowing =
            OntologicalScopeGate.evaluate(
              originNodeId: 'Smart',
              originBunkerType: 'hub',
              targetNodeId: 'Ruedas',
              targetFiles: <String>['lib/widgets/button.dart'],
              throwOnError: false,
            );
        expect(nonThrowing.isApproved, isFalse);
        expect(nonThrowing.exitCode, equals(43));
      },
    );

    test(
      'Sad Path 4 (Ruptura): Manifiesto corrupto o tipo ontológico inválido (exitCode 55)',
      () {
        expect(
          () => OntologicalScopeGate.evaluate(
            originNodeId: 'InvalidoNode',
            originBunkerType: 'tipo_falso_inventado',
            targetFiles: <String>['lib/foo.dart'],
            throwOnError: true,
          ),
          throwsA(
            isA<ManifestIntegrityException>().having(
              (ManifestIntegrityException e) => e.exitCode,
              'exitCode',
              equals(55),
            ),
          ),
        );

        expect(
          () => OntologicalScopeGate.evaluate(
            originNodeId: '',
            originBunkerType: 'satellite',
            targetFiles: <String>['lib/foo.dart'],
            throwOnError: true,
          ),
          throwsA(isA<ManifestIntegrityException>()),
        );
      },
    );
  });

  group(
    'BacklogOntologicalValidator — Validación Estructural de Tickets (§12.b, §51, §62)',
    () {
      test('Valida Backlog conforme sin violaciones', () {
        final Map<String, dynamic> backlog = <String, dynamic>{
          'sprints': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'S1',
              'tasks': <Map<String, dynamic>>[
                <String, dynamic>{
                  'id': 'T1',
                  'node_id': 'Ruedas',
                  'allowed_files': <String>['lib/feature.dart'],
                },
              ],
            },
          ],
        };

        final BacklogValidationReport report =
            BacklogOntologicalValidator.validateBacklog(
              originNodeId: 'Ruedas',
              originBunkerType: 'satellite',
              backlog: backlog,
            );

        expect(report.isValid, isTrue);
        expect(report.exitCode, equals(0));
        expect(report.approvedTaskIds, contains('T1'));
      });

      test(
        'Detecta violaciones de infraestructura en backlog de satélite y reporta Exit Code 42',
        () {
          final Map<String, dynamic> backlog = <String, dynamic>{
            'sprints': <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'S1',
                'tasks': <Map<String, dynamic>>[
                  <String, dynamic>{
                    'id': 'TASK-BAD-01',
                    'node_id': 'Ruedas',
                    'allowed_files': <String>['services/daemon.py'],
                  },
                ],
              },
            ],
          };

          final BacklogValidationReport report =
              BacklogOntologicalValidator.validateBacklog(
                originNodeId: 'Ruedas',
                originBunkerType: 'satellite',
                backlog: backlog,
              );

          expect(report.isValid, isFalse);
          expect(report.exitCode, equals(42));
          expect(
            report.violations.any((String v) => v.contains('TASK-BAD-01')),
            isTrue,
          );
        },
      );
    },
  );
}
