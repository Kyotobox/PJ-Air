// test/protocol/cross_node_sad_paths_test.dart — Certificación de Sad Paths Tipados Cross-Node (§4, §6, §39, §60.7, §60.8)
import 'dart:async';
import 'dart:io' as io;
import 'package:axioma/src/protocol/cross_node_exceptions.dart';
import 'package:axioma/src/protocol/uds_connector_transport.dart';
import 'package:test/test.dart';

void main() {
  group('CrossNodeException — Sad Paths Tipados (§6, §39, §60.7)', () {
    test(
      'Sad Path 1: Conexión a socket inexistente lanza NodeUnreachableException (exit 75)',
      () async {
        final String nonExistentSocket =
            '/tmp/non_existent_uds_socket_${DateTime.now().microsecondsSinceEpoch}.sock';

        final UdsConnectorTransport transport = UdsConnectorTransport(
          nodeId: 'client',
          socketPath: nonExistentSocket,
        );

        await expectLater(
          transport.sendRequest(
            targetNode: 'ghost_node',
            payload: '{"action":"TEST"}',
            timeout: const Duration(milliseconds: 500),
          ),
          throwsA(
            isA<NodeUnreachableException>().having(
              (e) => e.exitCode,
              'exitCode',
              equals(75),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path 2: Operación que excede timeout lanza NodeTimeoutException',
      () async {
        final String tempDir = io.Directory.systemTemp.path;
        final String socketPath =
            '$tempDir/test_timeout_${DateTime.now().microsecondsSinceEpoch}.sock';

        final UdsConnectorTransport server = UdsConnectorTransport(
          nodeId: 'slow_server',
          socketPath: socketPath,
        );
        final UdsConnectorTransport client = UdsConnectorTransport(
          nodeId: 'impatient_client',
          socketPath: socketPath,
        );

        final UdsServerHandle handle = await server.startServer(
          onMessage: (String _) async {
            // Demora intencional de 1500ms para provocar timeout
            await Future<void>.delayed(const Duration(milliseconds: 1500));
            return '{"delayed":true}';
          },
        );

        try {
          await expectLater(
            client.sendRequest(
              targetNode: 'slow_server',
              payload: '{"action":"SLOW"}',
              timeout: const Duration(milliseconds: 200),
            ),
            throwsA(
              isA<NodeTimeoutException>().having(
                (e) => e.nodeId,
                'nodeId',
                equals('slow_server'),
              ),
            ),
          );
        } finally {
          await handle.close();
        }
      },
    );

    test(
      'Sad Path 3: UdsConnectorTransport constructor valida campos no vacíos',
      () {
        expect(
          () =>
              UdsConnectorTransport(nodeId: '  ', socketPath: '/tmp/test.sock'),
          throwsA(isA<FormatException>()),
        );
        expect(
          () => UdsConnectorTransport(nodeId: 'node', socketPath: ''),
          throwsA(isA<FormatException>()),
        );
      },
    );

    test(
      'Sad Path 4: sendRequest con targetNode o payload vacío lanza FormatException',
      () async {
        final UdsConnectorTransport transport = UdsConnectorTransport(
          nodeId: 'node',
          socketPath: '/tmp/test.sock',
        );

        expect(
          () => transport.sendRequest(targetNode: '', payload: 'data'),
          throwsA(isA<FormatException>()),
        );
        expect(
          () => transport.sendRequest(targetNode: 'target', payload: '  '),
          throwsA(isA<FormatException>()),
        );
      },
    );

    test(
      'Sad Path 5: NodeSovereigntyException valida código 42 de perímetro',
      () {
        final NodeSovereigntyException ex = NodeSovereigntyException(
          'Acceso denegado a recurso restringido',
          nodeId: 'foreign_sat',
          reason: 'PERIMETER_VIOLATION',
        );

        expect(ex.exitCode, equals(42));
        expect(ex.nodeId, equals('foreign_sat'));
        expect(ex.reason, equals('PERIMETER_VIOLATION'));
      },
    );

    test(
      'Sad Path 6: ProtocolMismatchException valida campos de discrepancia SemVer',
      () {
        final ProtocolMismatchException ex = ProtocolMismatchException(
          'Desalineación de protocolo detectada',
          nodeId: 'sat_v4',
          expectedVersion: '5.6.0',
          actualVersion: '4.0.0',
        );

        expect(ex.exitCode, equals(55));
        expect(ex.expectedVersion, equals('5.6.0'));
        expect(ex.actualVersion, equals('4.0.0'));
        expect(ex.toString(), contains('expected: 5.6.0'));
      },
    );
  });
}
