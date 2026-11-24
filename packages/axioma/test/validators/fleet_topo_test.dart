// test/validators/fleet_topo_test.dart — Certificación de FleetTopoValidator Pure Dart (§4, §6, §39, §60.7, §60.8)
import 'package:axioma/src/validators/fleet_topo.dart';
import 'package:test/test.dart';

void main() {
  group('FleetTopoValidator — Happy Paths (§39, §60.8)', () {
    test('Happy Path 1: Manifiesto federado nominal sin ciclos', () {
      final Map<String, dynamic> manifest = <String, dynamic>{
        'fleet_version': '4.0.0',
        'topology': 'FEDERATED_TWO_TIER',
        'nodes': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'conext_core',
            'bunker_type': 'kernel',
            'path_template': '/home/opc/code/conext_core',
          },
          <String, dynamic>{
            'id': 'automa',
            'bunker_type': 'control_plane',
            'path_template': '/home/opc/code/automa',
            'upstream': <String>['conext_core'],
          },
          <String, dynamic>{
            'id': 'smart',
            'bunker_type': 'hub',
            'path_template': '/home/opc/code/Smart',
            'upstream': <String>['conext_core', 'automa'],
          },
          <String, dynamic>{
            'id': 'ruedas',
            'bunker_type': 'satellite',
            'path_template': '/home/opc/code/ruedas',
            'upstream': <String>['smart'],
          },
        ],
      };

      final FleetTopoValidationResult result =
          FleetTopoValidator.validateManifest(manifest);

      expect(result.isValid, isTrue);
      expect(result.totalNodes, equals(4));
      expect(
        result.nodeIds,
        containsAll(<String>['conext_core', 'automa', 'smart', 'ruedas']),
      );
      expect(result.errors, isEmpty);
    });
  });

  group('FleetTopoValidator — Sad Paths (§6, §39, §60.7, §60.8)', () {
    test('Sad Path 1: Manifiesto vacío lanza FormatException', () {
      expect(
        () => FleetTopoValidator.validateManifest(<String, dynamic>{}),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 2: fleet_version ausente o vacío lanza FormatException', () {
      expect(
        () => FleetTopoValidator.validateManifest(<String, dynamic>{
          'fleet_version': '  ',
          'topology': 'FEDERATED',
          'nodes': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'core',
              'bunker_type': 'kernel',
              'path_template': '/core',
            },
          ],
        }),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 3: topology ausente o vacío lanza FormatException', () {
      expect(
        () => FleetTopoValidator.validateManifest(<String, dynamic>{
          'fleet_version': '4.0.0',
          'topology': '',
          'nodes': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'core',
              'bunker_type': 'kernel',
              'path_template': '/core',
            },
          ],
        }),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 4: Lista de nodos vacía lanza FormatException', () {
      expect(
        () => FleetTopoValidator.validateManifest(<String, dynamic>{
          'fleet_version': '4.0.0',
          'topology': 'FEDERATED',
          'nodes': <dynamic>[],
        }),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 5: Nodo con ID duplicado lanza FormatException', () {
      expect(
        () => FleetTopoValidator.validateManifest(<String, dynamic>{
          'fleet_version': '4.0.0',
          'topology': 'FEDERATED',
          'nodes': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'smart',
              'bunker_type': 'hub',
              'path_template': '/smart',
            },
            <String, dynamic>{
              'id': 'smart',
              'bunker_type': 'satellite',
              'path_template': '/smart_sat',
            },
          ],
        }),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 6: bunker_type desconocido lanza FormatException', () {
      expect(
        () => FleetTopoValidator.validateManifest(<String, dynamic>{
          'fleet_version': '4.0.0',
          'topology': 'FEDERATED',
          'nodes': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'unknown_node',
              'bunker_type': 'alien_base',
              'path_template': '/alien',
            },
          ],
        }),
        throwsA(isA<FormatException>()),
      );
    });

    test(
      'Sad Path 7: Dependencia huérfana hacia nodo inexistente lanza FormatException',
      () {
        expect(
          () => FleetTopoValidator.validateManifest(<String, dynamic>{
            'fleet_version': '4.0.0',
            'topology': 'FEDERATED',
            'nodes': <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'smart',
                'bunker_type': 'hub',
                'path_template': '/smart',
                'upstream': <String>['ghost_node'],
              },
            ],
          }),
          throwsA(isA<FormatException>()),
        );
      },
    );

    test(
      'Sad Path 8: Ciclo topológico directo (A -> B -> A) lanza FormatException',
      () {
        expect(
          () => FleetTopoValidator.validateManifest(<String, dynamic>{
            'fleet_version': '4.0.0',
            'topology': 'FEDERATED',
            'nodes': <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'node_a',
                'bunker_type': 'hub',
                'path_template': '/a',
                'upstream': <String>['node_b'],
              },
              <String, dynamic>{
                'id': 'node_b',
                'bunker_type': 'satellite',
                'path_template': '/b',
                'upstream': <String>['node_a'],
              },
            ],
          }),
          throwsA(isA<FormatException>()),
        );
      },
    );
  });
}
