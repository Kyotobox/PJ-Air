import 'dart:convert';
import 'dart:io';
import 'package:axioma/axioma.dart';
import 'package:path/path.dart' as p;
import 'package:test/test.dart';

void main() {
  group('TakeoverReboundGate — Candado Anti-Rebote y Sellado (§4, §6, §39, §50)', () {
    late Directory tempDir;

    setUp(() {
      tempDir = Directory.systemTemp.createTempSync('anti_rebound_test_');
    });

    tearDown(() {
      if (tempDir.existsSync()) {
        tempDir.deleteSync(recursive: true);
      }
    });

    // =========================================================================
    // HAPPY PATHS
    // =========================================================================

    test(
      'Happy Path 1: Nueva conversación con ID diferente al relay es autorizada',
      () {
        final TakeoverGateResult result = TakeoverReboundGate.validate(
          incomingConversationId: '119489e2-879b-41eb-b8b4-eb5be91d894d',
          relayPreviousConversationId: '8a7ed4a7-d830-41b6-8b2a-df77be32a865',
        );

        expect(result.isAllowed, isTrue);
        expect(
          result.conversationId,
          equals('119489e2-879b-41eb-b8b4-eb5be91d894d'),
        );
        expect(result.rejectionReason, isNull);
      },
    );

    test(
      'Happy Path 2: Takeover sin relay previo registrado es autorizado',
      () {
        final TakeoverGateResult result = TakeoverReboundGate.validate(
          incomingConversationId: 'conv-fresh-virgin-id',
          relayPreviousConversationId: null,
        );

        expect(result.isAllowed, isTrue);
        expect(result.conversationId, equals('conv-fresh-virgin-id'));
      },
    );

    test(
      'Happy Path 3: Validación física contra disco con relay previo diferente',
      () {
        final File relayFile = File(
          p.join(tempDir.path, '.meta', 'session.relay'),
        );
        relayFile.parent.createSync(recursive: true);
        relayFile.writeAsStringSync(
          jsonEncode(<String, dynamic>{
            'previous_conversation_id': 'old-finished-session-uuid',
            'status': 'HANDOVER_SUCCESS',
          }),
        );

        final TakeoverReboundGate gate = TakeoverReboundGate(
          rootPath: tempDir.path,
        );
        final TakeoverGateResult result = gate.validateDiskState(
          'new-chat-session-uuid',
        );

        expect(result.isAllowed, isTrue);
        expect(
          result.previousConversationId,
          equals('old-finished-session-uuid'),
        );
      },
    );

    test(
      'Happy Path 4: Sellado físico de conversación y persistencia en sealed_conversations.json',
      () {
        final TakeoverReboundGate gate = TakeoverReboundGate(
          rootPath: tempDir.path,
        );

        gate.sealConversation(
          'conv-compacted-123',
          reason: 'Context compaction detected',
        );
        final Set<String> sealed = gate.loadSealedConversations();

        expect(sealed.contains('conv-compacted-123'), isTrue);

        final File sealedFile = File(
          p.join(tempDir.path, 'vault', 'runtime', 'sealed_conversations.json'),
        );
        expect(sealedFile.existsSync(), isTrue);
        final Map<String, dynamic> data =
            jsonDecode(sealedFile.readAsStringSync()) as Map<String, dynamic>;
        expect(data['last_sealed_id'], equals('conv-compacted-123'));
      },
    );

    // =========================================================================
    // SAD PATHS (§6 Mandatorio)
    // =========================================================================

    test(
      'Sad Path 1 (§6, §50): Mismo conversation ID que el relay arroja TakeoverReboundException',
      () {
        expect(
          () => TakeoverReboundGate.validate(
            incomingConversationId: '8a7ed4a7-d830-41b6-8b2a-df77be32a865',
            relayPreviousConversationId: '8a7ed4a7-d830-41b6-8b2a-df77be32a865',
            throwOnError: true,
          ),
          throwsA(
            isA<TakeoverReboundException>().having(
              (TakeoverReboundException e) => e.conversationId,
              'conversationId',
              equals('8a7ed4a7-d830-41b6-8b2a-df77be32a865'),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path 2 (§6): Mismo conversation ID en modo non-throwing retorna isAllowed=false',
      () {
        final TakeoverGateResult result = TakeoverReboundGate.validate(
          incomingConversationId: 'rebound-uuid-456',
          relayPreviousConversationId: 'rebound-uuid-456',
          throwOnError: false,
        );

        expect(result.isAllowed, isFalse);
        expect(result.rejectionReason, equals('REBOUND_SAME_CONVERSATION'));
      },
    );

    test(
      'Sad Path 3 (§6, §50): Conversación sellada previamente arroja SealedSessionException',
      () {
        expect(
          () => TakeoverReboundGate.validate(
            incomingConversationId: 'sealed-session-999',
            sealedConversations: <String>{'sealed-session-999'},
            throwOnError: true,
          ),
          throwsA(
            isA<SealedSessionException>().having(
              (SealedSessionException e) => e.conversationId,
              'conversationId',
              equals('sealed-session-999'),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path 4 (§6): Conversación vacía o en blanco arroja ArgumentError',
      () {
        expect(
          () => TakeoverReboundGate.validate(
            incomingConversationId: '   ',
            relayPreviousConversationId: 'any-id',
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test(
      'Sad Path 5 (§6): Intento de sellar un ID vacío arroja ArgumentError',
      () {
        final TakeoverReboundGate gate = TakeoverReboundGate(
          rootPath: tempDir.path,
        );
        expect(
          () => gate.sealConversation('', reason: 'test'),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test(
      'Sad Path 6 (§6): Archivo session.relay corrupto en disco no crashea y retorna null',
      () {
        final File relayFile = File(
          p.join(tempDir.path, '.meta', 'session.relay'),
        );
        relayFile.parent.createSync(recursive: true);
        relayFile.writeAsStringSync('{ corrupt_not_json: true ');

        final TakeoverReboundGate gate = TakeoverReboundGate(
          rootPath: tempDir.path,
        );
        expect(gate.extractPreviousConversationIdFromRelay(), isNull);
      },
    );

    test(
      'Happy Path 5 (GAP-2): Poda rotacional acota sealed_conversations a maxEntries',
      () {
        final TakeoverReboundGate gate = TakeoverReboundGate(
          rootPath: tempDir.path,
        );

        // Insertar 5 conversaciones con límite de 3
        for (int i = 1; i <= 5; i++) {
          gate.sealConversation(
            'conv-id-$i',
            reason: 'Test compaction $i',
            maxEntries: 3,
          );
        }

        final Set<String> sealed = gate.loadSealedConversations();
        expect(sealed.length, equals(3));
        expect(sealed.contains('conv-id-1'), isFalse); // Podado (FIFO)
        expect(sealed.contains('conv-id-2'), isFalse); // Podado (FIFO)
        expect(sealed.contains('conv-id-3'), isTrue);
        expect(sealed.contains('conv-id-4'), isTrue);
        expect(sealed.contains('conv-id-5'), isTrue);
      },
    );

    test(
      'Happy Path 6 (GAP-1): isOdometerHandoverComplete detecta hwc_complete true',
      () {
        final File odoFile = File(
          p.join(tempDir.path, 'vault', 'runtime', 'session_odometer.json'),
        );
        odoFile.parent.createSync(recursive: true);
        odoFile.writeAsStringSync(
          jsonEncode(<String, dynamic>{
            'session_uuid': 'test-uuid-123',
            'hwc_complete': true,
            'peak_depth': 12.5,
          }),
        );

        final TakeoverReboundGate gate = TakeoverReboundGate(
          rootPath: tempDir.path,
        );
        expect(gate.isOdometerHandoverComplete(), isTrue);
      },
    );

    test(
      'Happy Path 7: isHandoverHaltLocked detecta presencia física del lock',
      () {
        final TakeoverReboundGate gate = TakeoverReboundGate(
          rootPath: tempDir.path,
        );
        expect(gate.isHandoverHaltLocked(), isFalse);

        final File lockFile = File(
          p.join(tempDir.path, 'vault', 'runtime', 'handover_halt.lock'),
        );
        lockFile.parent.createSync(recursive: true);
        lockFile.writeAsStringSync('HALT_ACTIVE');

        expect(gate.isHandoverHaltLocked(), isTrue);
      },
    );

    test(
      'Sad Path 7 (SAD-B): session_odometer.json corrupto o truncado no crashea y retorna null',
      () {
        final File odoFile = File(
          p.join(tempDir.path, 'vault', 'runtime', 'session_odometer.json'),
        );
        odoFile.parent.createSync(recursive: true);
        odoFile.writeAsStringSync('{ "truncated_json": ');

        final TakeoverReboundGate gate = TakeoverReboundGate(
          rootPath: tempDir.path,
        );
        expect(gate.readSessionOdometer(), isNull);
        expect(gate.isOdometerHandoverComplete(), isFalse);
      },
    );

    test(
      'Sad Path 8: Cold-start inaugural sin archivos de telemetría retorna null sin excepción',
      () {
        final TakeoverReboundGate gate = TakeoverReboundGate(
          rootPath: tempDir.path,
        );
        expect(gate.readSessionOdometer(), isNull);
        expect(gate.isOdometerHandoverComplete(), isFalse);
        expect(gate.loadSealedConversations(), isEmpty);
        expect(gate.extractPreviousConversationIdFromRelay(), isNull);
      },
    );

    test(
      'Sad Path 9 (GAP-1, §50): Trampa de reintento en Turn-1 con sesión activa en relay es bloqueada',
      () {
        final File relayFile = File(
          p.join(tempDir.path, '.meta', 'session.relay'),
        );
        relayFile.parent.createSync(recursive: true);
        relayFile.writeAsStringSync(
          jsonEncode(<String, dynamic>{
            'previous_conversation_id': 'active-conversation-session',
            'status': 'HANDOVER_COMPLETED',
          }),
        );

        final File odoFile = File(
          p.join(tempDir.path, 'vault', 'runtime', 'session_odometer.json'),
        );
        odoFile.parent.createSync(recursive: true);
        odoFile.writeAsStringSync(
          jsonEncode(<String, dynamic>{
            'session_uuid': 'active-conversation-session',
            'conversation_uuid': 'active-conversation-session',
            'hwc_complete': false,
            'peak_depth': 25.0,
          }),
        );

        final TakeoverReboundGate gate = TakeoverReboundGate(
          rootPath: tempDir.path,
        );

        expect(
          () => gate.validateDiskState(
            'active-conversation-session',
            throwOnError: true,
          ),
          throwsA(
            isA<TakeoverReboundException>().having(
              (TakeoverReboundException e) => e.conversationId,
              'conversationId',
              equals('active-conversation-session'),
            ),
          ),
        );
      },
    );
  });
}
