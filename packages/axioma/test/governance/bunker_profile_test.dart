/// bunker_profile_test.dart — Suite de Certificación del Contrato SemVer 2.0 de BunkerProfile en Pure Dart (§4, §6, §39, §43, §46, §50).
library;

import 'dart:convert';
import 'dart:io';

import 'package:axioma/src/governance/bunker_profile.dart';
import 'package:path/path.dart' as p;
import 'package:test/test.dart';

void main() {
  group(
    'TASK-N148-01 / TASK-N148-05: Contrato Canónico SemVer 2.0 de BunkerProfile (§39, §50)',
    () {
      late Directory tempDir;

      setUp(() {
        tempDir = Directory.systemTemp.createTempSync(
          'bunker_profile_axioma_test_',
        );
      });

      tearDown(() {
        try {
          if (tempDir.existsSync()) {
            tempDir.deleteSync(recursive: true);
          }
        } catch (_) {}
      });

      test(
        '[HAPPY-PATH] Carga de perfil SemVer 2.0 completo con canonical_branch explícito',
        () {
          final File profileFile = File(
            p.join(tempDir.path, 'bunker_profile.json'),
          );
          profileFile.writeAsStringSync(
            jsonEncode(<String, dynamic>{
              'schema_version': '2.0.0',
              'id': 'Smart',
              'project': 'Smart',
              'bunker_type': 'hub',
              'role': 'STRATEGY_ORCHESTRATOR',
              'axis': 'Strategy',
              'description': 'Orquestador de estrategia de flota',
              'canonical_branch': 'master',
              'red_zone_paths': <String>['.agents/', 'vault/'],
              'active_gates': <String>['ast_linter', 'sad_path_evidence'],
            }),
          );

          final BunkerProfile profile = BunkerProfile.fromFile(profileFile);

          expect(profile.schemaVersion, equals('2.0.0'));
          expect(profile.id, equals('Smart'));
          expect(profile.isHub, isTrue);
          expect(profile.isSatellite, isFalse);
          expect(profile.canonicalBranch, equals('master'));
          expect(profile.activeGates, contains('ast_linter'));
        },
      );

      test(
        '[HAPPY-PATH] Migración idempotente v0/v1 a SemVer 2.0 con active_gates automáticas',
        () {
          final Map<String, dynamic> legacy = <String, dynamic>{
            'id': 'ruedas',
            'bunker_type': 'satellite',
          };

          final BunkerProfile profile = BunkerProfile.fromJson(legacy);

          expect(profile.schemaVersion, equals('2.0.0'));
          expect(profile.id, equals('ruedas'));
          expect(profile.isSatellite, isTrue);
          expect(profile.isLeanGated, isTrue);
          expect(profile.activeGates, contains('satellite_lean'));
          expect(profile.canonicalBranch, equals('master'));
        },
      );

      test('[HAPPY-PATH] Detección de roles y tipologías de búnker', () {
        const BunkerProfile hub = BunkerProfile(id: 'Smart', bunkerType: 'hub');
        const BunkerProfile sat = BunkerProfile(
          id: 'ruedas',
          bunkerType: 'satellite',
        );
        const BunkerProfile orch = BunkerProfile(
          id: 'automa',
          bunkerType: 'orchestrator',
        );

        expect(hub.isHub, isTrue);
        expect(hub.isSatellite, isFalse);

        expect(sat.isSatellite, isTrue);
        expect(sat.isHub, isFalse);
        expect(sat.isLeanGated, isTrue);

        expect(orch.isOrchestrator, isTrue);
      });

      test(
        '[HAPPY-PATH] verifyCanonicalBranch con coincidencia retorna isMatch=true',
        () {
          const BunkerProfile profile = BunkerProfile(
            id: 'Smart',
            bunkerType: 'hub',
            canonicalBranch: 'master',
          );

          final CanonicalBranchCheckResult check = profile
              .verifyCanonicalBranch(currentBranch: 'master');

          expect(check.isMatch, isTrue);
          expect(check.currentBranch, equals('master'));
          expect(check.error, isNull);
        },
      );

      test(
        '[HAPPY-PATH] toJson serializa la estructura canónica SemVer 2.0',
        () {
          const BunkerProfile profile = BunkerProfile(
            id: 'pj-air',
            bunkerType: 'satellite',
            canonicalBranch: 'production',
            activeGates: <String>['satellite_lean'],
          );

          final Map<String, dynamic> json = profile.toJson();

          expect(json['schema_version'], equals('2.0.0'));
          expect(json['id'], equals('pj-air'));
          expect(json['bunker_type'], equals('satellite'));
          expect(json['canonical_branch'], equals('production'));
          expect(json['active_gates'], contains('satellite_lean'));
        },
      );

      test(
        '[SAD-PATH §6] Archivo bunker_profile.json inexistente arroja BunkerProfileNotFoundException',
        () {
          final File nonExistent = File(
            p.join(tempDir.path, 'missing_profile.json'),
          );

          expect(
            () => BunkerProfile.fromFile(nonExistent),
            throwsA(isA<BunkerProfileNotFoundException>()),
          );
        },
      );

      test(
        '[SAD-PATH §6] Archivo vacío arroja BunkerProfileParseException',
        () {
          final File emptyFile = File(p.join(tempDir.path, 'empty.json'))
            ..writeAsStringSync('');

          expect(
            () => BunkerProfile.fromFile(emptyFile),
            throwsA(isA<BunkerProfileParseException>()),
          );
        },
      );

      test(
        '[SAD-PATH §6] JSON malformado arroja BunkerProfileParseException',
        () {
          final File corrupt = File(p.join(tempDir.path, 'corrupt.json'))
            ..writeAsStringSync('{corrupt...');

          expect(
            () => BunkerProfile.fromFile(corrupt),
            throwsA(isA<BunkerProfileParseException>()),
          );
        },
      );

      test(
        '[SAD-PATH §6] JSON sin campo id arroja BunkerProfileParseException',
        () {
          expect(
            () => BunkerProfile.fromJson(<String, dynamic>{
              'bunker_type': 'satellite',
            }),
            throwsA(isA<BunkerProfileParseException>()),
          );
        },
      );

      test(
        '[SAD-PATH §6] JSON sin campo bunker_type arroja BunkerProfileParseException',
        () {
          expect(
            () => BunkerProfile.fromJson(<String, dynamic>{'id': 'test_node'}),
            throwsA(isA<BunkerProfileParseException>()),
          );
        },
      );

      test(
        '[SAD-PATH §6] validateLifecycleBranch con rama divergente arroja CanonicalBranchMismatchException',
        () {
          const BunkerProfile profile = BunkerProfile(
            id: 'Smart',
            bunkerType: 'hub',
            canonicalBranch: 'master',
          );

          expect(
            () => profile.validateLifecycleBranch(
              currentBranch: 'feature/unauthorized',
              throwOnError: true,
            ),
            throwsA(isA<CanonicalBranchMismatchException>()),
          );
        },
      );
    },
  );
}
