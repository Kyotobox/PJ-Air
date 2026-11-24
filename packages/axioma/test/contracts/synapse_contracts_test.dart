// test/contracts/synapse_contracts_test.dart — Certificación de Contratos y DTOs Synapse Pure Dart (§4, §6, §39, §60.7, §60.8)
import 'package:axioma/synapse.dart';
import 'package:test/test.dart';

void main() {
  group('ContextPassport — Happy Paths (§39, §60.8)', () {
    test(
      'Happy Path 1: Construcción y serialización nominal de ContextPassport',
      () {
        final DateTime now = DateTime.now().toUtc();
        final DateTime expires = now.add(const Duration(hours: 2));

        final ContextPassport passport = ContextPassport(
          passportId: 'PASS-SMART-001',
          originNode: 'smart',
          targetNode: 'studio',
          targetSkill: 'adstudio-pipeline',
          callerIdentity: 'SmartPlatformEngineer',
          sonicPerimeterZone: 'GREEN',
          sovereigntyToken: 'SIG-RSA2048-TOKEN-XYZ',
          allowedPathPrefixes: <String>['vault/assets/', 'apps/studio/'],
          issuedAt: now,
          expiresAt: expires,
          metadata: <String, dynamic>{'sprint': 'N153'},
        );

        final Map<String, dynamic> json = passport.toJson();
        expect(json['passport_id'], equals('PASS-SMART-001'));
        expect(json['origin_node'], equals('smart'));
        expect(json['target_node'], equals('studio'));
        expect(json['target_skill'], equals('adstudio-pipeline'));
        expect(json['caller_identity'], equals('SmartPlatformEngineer'));
        expect(json['sonic_perimeter_zone'], equals('GREEN'));
        expect(json['sovereignty_token'], equals('SIG-RSA2048-TOKEN-XYZ'));
        expect(json['allowed_path_prefixes'], contains('vault/assets/'));

        final ContextPassport deserialized = ContextPassport.fromJson(json);
        expect(deserialized.passportId, equals('PASS-SMART-001'));
        expect(deserialized.originNode, equals('smart'));
        expect(deserialized.targetNode, equals('studio'));
        expect(deserialized.targetSkill, equals('adstudio-pipeline'));
        expect(deserialized.callerIdentity, equals('SmartPlatformEngineer'));
        expect(deserialized.sonicPerimeterZone, equals('GREEN'));
        expect(deserialized.isValid(), isTrue);
        expect(deserialized.isExpired(), isFalse);
      },
    );

    test(
      'Happy Path 2: Evaluación de permisos de ruta por Perímetro Sónico',
      () {
        final ContextPassport passport = ContextPassport(
          passportId: 'PASS-SMART-002',
          originNode: 'levita',
          targetNode: 'automa',
          targetSkill: 'data-catalog-sanitizer',
          callerIdentity: 'LevitaWorker',
          sonicPerimeterZone: 'AMBER',
          sovereigntyToken: 'TOKEN-ABC',
          allowedPathPrefixes: <String>['vault/reports/', 'packages/axioma/'],
          expiresAt: DateTime.now().toUtc().add(const Duration(minutes: 30)),
        );

        expect(passport.permitsPath('vault/reports/audit.json'), isTrue);
        expect(
          passport.permitsPath('packages/axioma/lib/synapse.dart'),
          isTrue,
        );
        expect(passport.permitsPath('/etc/passwd'), isFalse);
        expect(passport.permitsPath('apps/forbidden/secret.key'), isFalse);
      },
    );
  });

  group('ContextPassport — Sad Paths (§6, §39, §60.7, §60.8)', () {
    final DateTime validExpiry = DateTime.now().toUtc().add(
      const Duration(hours: 1),
    );

    test('Sad Path 1: passportId vacío lanza FormatException', () {
      expect(
        () => ContextPassport(
          passportId: '   ',
          originNode: 'smart',
          targetNode: 'studio',
          targetSkill: 'adstudio-pipeline',
          callerIdentity: 'SmartPlatformEngineer',
          sonicPerimeterZone: 'GREEN',
          sovereigntyToken: 'TOKEN',
          expiresAt: validExpiry,
        ),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 2: originNode vacío lanza FormatException', () {
      expect(
        () => ContextPassport(
          passportId: 'PASS-1',
          originNode: '',
          targetNode: 'studio',
          targetSkill: 'adstudio-pipeline',
          callerIdentity: 'SmartPlatformEngineer',
          sonicPerimeterZone: 'GREEN',
          sovereigntyToken: 'TOKEN',
          expiresAt: validExpiry,
        ),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 3: targetNode vacío lanza FormatException', () {
      expect(
        () => ContextPassport(
          passportId: 'PASS-1',
          originNode: 'smart',
          targetNode: '  ',
          targetSkill: 'adstudio-pipeline',
          callerIdentity: 'SmartPlatformEngineer',
          sonicPerimeterZone: 'GREEN',
          sovereigntyToken: 'TOKEN',
          expiresAt: validExpiry,
        ),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 4: targetSkill vacío lanza FormatException', () {
      expect(
        () => ContextPassport(
          passportId: 'PASS-1',
          originNode: 'smart',
          targetNode: 'studio',
          targetSkill: '',
          callerIdentity: 'SmartPlatformEngineer',
          sonicPerimeterZone: 'GREEN',
          sovereigntyToken: 'TOKEN',
          expiresAt: validExpiry,
        ),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 5: callerIdentity vacío lanza FormatException', () {
      expect(
        () => ContextPassport(
          passportId: 'PASS-1',
          originNode: 'smart',
          targetNode: 'studio',
          targetSkill: 'skill',
          callerIdentity: ' ',
          sonicPerimeterZone: 'GREEN',
          sovereigntyToken: 'TOKEN',
          expiresAt: validExpiry,
        ),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 6: sovereigntyToken vacío lanza FormatException', () {
      expect(
        () => ContextPassport(
          passportId: 'PASS-1',
          originNode: 'smart',
          targetNode: 'studio',
          targetSkill: 'skill',
          callerIdentity: 'agent',
          sonicPerimeterZone: 'GREEN',
          sovereigntyToken: '  ',
          expiresAt: validExpiry,
        ),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 7: sonicPerimeterZone inválida lanza FormatException', () {
      expect(
        () => ContextPassport(
          passportId: 'PASS-1',
          originNode: 'smart',
          targetNode: 'studio',
          targetSkill: 'skill',
          callerIdentity: 'agent',
          sonicPerimeterZone: 'ULTRA_VIOLET',
          sovereigntyToken: 'TOKEN',
          expiresAt: validExpiry,
        ),
        throwsA(isA<FormatException>()),
      );
    });

    test(
      'Sad Path 8: expiresAt anterior o igual a issuedAt lanza FormatException',
      () {
        final DateTime now = DateTime.now().toUtc();
        expect(
          () => ContextPassport(
            passportId: 'PASS-1',
            originNode: 'smart',
            targetNode: 'studio',
            targetSkill: 'skill',
            callerIdentity: 'agent',
            sonicPerimeterZone: 'GREEN',
            sovereigntyToken: 'TOKEN',
            issuedAt: now,
            expiresAt: now.subtract(const Duration(minutes: 5)),
          ),
          throwsA(isA<FormatException>()),
        );
      },
    );

    test('Sad Path 9: fromJson con campos corruptos lanza FormatException', () {
      expect(
        () => ContextPassport.fromJson(<String, dynamic>{'passport_id': ''}),
        throwsA(isA<FormatException>()),
      );
      expect(
        () => ContextPassport.fromJson(<String, dynamic>{
          'passport_id': 'P-1',
          'origin_node': 'smart',
          'target_node': 'automa',
          'target_skill': 'skill',
          'caller_identity': 'agent',
          'sonic_perimeter_zone': 'GREEN',
          'sovereignty_token': 'TOK',
          'expires_at': 'FECHA-CORRUPTA',
        }),
        throwsA(isA<FormatException>()),
      );
    });
  });

  group('SynapseTaskPayload — Happy & Sad Paths (§6, §39, §60.7, §60.8)', () {
    late ContextPassport validPassport;

    setUp(() {
      validPassport = ContextPassport(
        passportId: 'PASS-001',
        originNode: 'smart',
        targetNode: 'studio',
        targetSkill: 'adstudio-pipeline',
        callerIdentity: 'SmartAgent',
        sonicPerimeterZone: 'GREEN',
        sovereigntyToken: 'SIG-ABC',
        expiresAt: DateTime.now().toUtc().add(const Duration(hours: 1)),
      );
    });

    test('Happy Path 1: Construcción y serialización nominal', () {
      final SynapseTaskPayload payload = SynapseTaskPayload(
        taskId: 'SYN-TASK-001',
        passport: validPassport,
        action: 'RENDER_B2B_FLYER',
        parameters: <String, dynamic>{'width': 1920, 'height': 1080},
        schemaVersion: 1,
      );

      final Map<String, dynamic> json = payload.toJson();
      expect(json['task_id'], equals('SYN-TASK-001'));
      expect(json['action'], equals('RENDER_B2B_FLYER'));
      expect(json['schema_version'], equals(1));

      final SynapseTaskPayload deserialized = SynapseTaskPayload.fromJson(json);
      expect(deserialized.taskId, equals('SYN-TASK-001'));
      expect(deserialized.passport.passportId, equals('PASS-001'));
      expect(deserialized.action, equals('RENDER_B2B_FLYER'));
    });

    test('Sad Path 1: taskId vacío lanza FormatException', () {
      expect(
        () => SynapseTaskPayload(
          taskId: '   ',
          passport: validPassport,
          action: 'RENDER',
          parameters: <String, dynamic>{},
        ),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 2: action vacío lanza FormatException', () {
      expect(
        () => SynapseTaskPayload(
          taskId: 'SYN-01',
          passport: validPassport,
          action: '',
          parameters: <String, dynamic>{},
        ),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 3: schemaVersion <= 0 lanza FormatException', () {
      expect(
        () => SynapseTaskPayload(
          taskId: 'SYN-01',
          passport: validPassport,
          action: 'RENDER',
          parameters: <String, dynamic>{},
          schemaVersion: 0,
        ),
        throwsA(isA<FormatException>()),
      );
    });

    test('Sad Path 4: fromJson corrupto lanza FormatException', () {
      expect(
        () => SynapseTaskPayload.fromJson(<String, dynamic>{'task_id': ''}),
        throwsA(isA<FormatException>()),
      );
      expect(
        () => SynapseTaskPayload.fromJson(<String, dynamic>{
          'task_id': 'SYN-1',
          'passport': 'not-a-map',
        }),
        throwsA(isA<FormatException>()),
      );
    });
  });

  group(
    'SynapseExecutionResult & SynapseHealthStatus — Happy & Sad Paths (§6, §39, §60.7)',
    () {
      test(
        'Happy Path 1: Construcción y roundtrip de SynapseExecutionResult',
        () {
          final SynapseExecutionResult res = SynapseExecutionResult(
            taskId: 'SYN-TASK-001',
            success: true,
            statusCode: 200,
            output: <String, dynamic>{
              'artifact_path': 'vault/renders/video.mp4',
            },
            executionDurationMs: 450,
          );

          final Map<String, dynamic> json = res.toJson();
          expect(json['task_id'], equals('SYN-TASK-001'));
          expect(json['success'], isTrue);
          expect(json['execution_duration_ms'], equals(450));

          final SynapseExecutionResult deserialized =
              SynapseExecutionResult.fromJson(json);
          expect(deserialized.taskId, equals('SYN-TASK-001'));
          expect(
            deserialized.output['artifact_path'],
            equals('vault/renders/video.mp4'),
          );
        },
      );

      test(
        'Sad Path 1: SynapseExecutionResult con taskId vacío lanza FormatException',
        () {
          expect(
            () => SynapseExecutionResult(
              taskId: '',
              success: false,
              statusCode: 500,
              output: <String, dynamic>{},
              executionDurationMs: 10,
            ),
            throwsA(isA<FormatException>()),
          );
        },
      );

      test(
        'Sad Path 2: SynapseExecutionResult con executionDurationMs negativo lanza FormatException',
        () {
          expect(
            () => SynapseExecutionResult(
              taskId: 'SYN-1',
              success: false,
              statusCode: 500,
              output: <String, dynamic>{},
              executionDurationMs: -1,
            ),
            throwsA(isA<FormatException>()),
          );
        },
      );

      test('Happy Path 2: Construcción y roundtrip de SynapseHealthStatus', () {
        final SynapseHealthStatus status = SynapseHealthStatus(
          nodeId: 'studio',
          isReachable: true,
          latencyMs: 12,
          activeSkills: <String>['adstudio-pipeline', 'media-audio-normalizer'],
        );

        final Map<String, dynamic> json = status.toJson();
        expect(json['node_id'], equals('studio'));
        expect(json['latency_ms'], equals(12));
        expect(json['active_skills'], contains('adstudio-pipeline'));

        final SynapseHealthStatus deserialized = SynapseHealthStatus.fromJson(
          json,
        );
        expect(deserialized.nodeId, equals('studio'));
        expect(deserialized.isReachable, isTrue);
      });

      test(
        'Sad Path 3: SynapseHealthStatus con nodeId vacío lanza FormatException',
        () {
          expect(
            () => SynapseHealthStatus(
              nodeId: '  ',
              isReachable: false,
              latencyMs: 0,
            ),
            throwsA(isA<FormatException>()),
          );
        },
      );

      test(
        'Sad Path 4: SynapseHealthStatus con latencyMs negativo lanza FormatException',
        () {
          expect(
            () => SynapseHealthStatus(
              nodeId: 'studio',
              isReachable: false,
              latencyMs: -5,
            ),
            throwsA(isA<FormatException>()),
          );
        },
      );
    },
  );
}
