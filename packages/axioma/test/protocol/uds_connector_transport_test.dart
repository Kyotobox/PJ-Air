// test/protocol/uds_connector_transport_test.dart — Certificación de UdsConnectorTransport Pure Dart (§4, §6, §39, §60.7, §60.8)
import 'dart:convert';
import 'dart:io' as io;
import 'package:axioma/src/protocol/uds_connector_transport.dart';
import 'package:test/test.dart';

void main() {
  group('UdsConnectorTransport — Happy Paths (§39, §45, §60.8)', () {
    late String testSocketPath;
    late UdsConnectorTransport serverTransport;
    late UdsConnectorTransport clientTransport;
    UdsServerHandle? serverHandle;

    setUp(() {
      final String tempDir = io.Directory.systemTemp.path;
      final int ts = DateTime.now().microsecondsSinceEpoch;
      testSocketPath = '$tempDir/test_uds_$ts.sock';

      serverTransport = UdsConnectorTransport(
        nodeId: 'smart_server',
        socketPath: testSocketPath,
      );

      clientTransport = UdsConnectorTransport(
        nodeId: 'levita_client',
        socketPath: testSocketPath,
      );
    });

    tearDown(() async {
      if (serverHandle != null) {
        await serverHandle!.close();
      }
      final io.File f = io.File(testSocketPath);
      if (f.existsSync()) {
        try {
          f.deleteSync();
        } catch (_) {}
      }
    });

    test(
      'Happy Path 1: Comunicación bidireccional cliente-servidor UDS en scratch',
      () async {
        serverHandle = await serverTransport.startServer(
          onMessage: (String request) async {
            final Map<String, dynamic> req =
                jsonDecode(request) as Map<String, dynamic>;
            final String action = req['action'] as String;
            return jsonEncode(<String, dynamic>{
              'status': 'OK',
              'action_echo': action,
              'served_by': 'smart_server',
            });
          },
        );

        final String response = await clientTransport.sendRequest(
          targetNode: 'smart_server',
          payload: jsonEncode(<String, dynamic>{'action': 'PING_SERVICE'}),
          timeout: const Duration(seconds: 2),
        );

        final Map<String, dynamic> res =
            jsonDecode(response) as Map<String, dynamic>;
        expect(res['status'], equals('OK'));
        expect(res['action_echo'], equals('PING_SERVICE'));
        expect(res['served_by'], equals('smart_server'));
      },
    );

    test(
      'Happy Path 2: Sonda ping retorna true cuando servidor está activo',
      () async {
        serverHandle = await serverTransport.startServer(
          onMessage: (String _) async =>
              jsonEncode(<String, dynamic>{'pong': true}),
        );

        final bool isAlive = await clientTransport.ping('smart_server');
        expect(isAlive, isTrue);
      },
    );

    test(
      'Happy Path 3: Cierre de servidor UdsServerHandle purga el socket físico',
      () async {
        serverHandle = await serverTransport.startServer(
          onMessage: (String _) async => 'ok',
        );

        final io.File socketFile = io.File(testSocketPath);
        expect(socketFile.existsSync(), isTrue);

        await serverHandle!.close();
        serverHandle = null;

        expect(socketFile.existsSync(), isFalse);
      },
    );
  });
}
