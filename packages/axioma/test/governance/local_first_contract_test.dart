import 'package:axioma/axioma.dart'
    show LocalFirstContract, LocalFirstNonReplicationException;
// ignore: implementation_imports
import 'package:axioma/src/governance/bunker_profile.dart';
import 'package:test/test.dart';

void main() {
  group('LocalFirstContract in BunkerProfile (§4, §6, §45)', () {
    test(
      'Happy Path: Parsea y serializa local_first_contract válido en BunkerProfile',
      () {
        final BunkerProfile profile = BunkerProfile.fromJson(<String, dynamic>{
          'schema_version': '2.0.0',
          'id': 'bluemarket',
          'project': 'bluemarket',
          'bunker_type': 'satellite',
          'canonical_branch': 'main',
          'local_first_contract': <String, dynamic>{
            'enabled': true,
            'non_replication_seal': 'SEAL-BLUEMARKET-001',
          },
        });

        expect(profile.hasLocalFirstSovereignty, isTrue);
        expect(
          profile.localFirstContract!.nonReplicationSeal,
          equals('SEAL-BLUEMARKET-001'),
        );
        final Map<String, dynamic> serialized = profile.toJson();
        final Map<String, dynamic> lfc =
            serialized['local_first_contract'] as Map<String, dynamic>;
        expect(lfc['non_replication_seal'], equals('SEAL-BLUEMARKET-001'));
      },
    );

    test(
      'Sad Path (§6, §45): Bloquea replicación remota y rechaza sello inválido',
      () {
        const LocalFirstContract contract = LocalFirstContract(
          nonReplicationSeal: 'SEAL-ECHO-01',
        );

        expect(
          () => contract.assertCanReplicate('push_sqlite', bunkerId: 'echo'),
          throwsA(isA<LocalFirstNonReplicationException>()),
        );

        expect(
          () => LocalFirstContract.fromJson(<String, dynamic>{
            'non_replication_seal': 'INVALID-SEAL',
          }),
          throwsA(isA<BunkerProfileParseException>()),
        );

        expect(
          () => LocalFirstContract.fromJson(<String, dynamic>{}),
          throwsA(isA<BunkerProfileParseException>()),
        );
      },
    );
  });
}
