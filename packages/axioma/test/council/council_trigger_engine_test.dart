// packages/axioma/test/council/council_trigger_engine_test.dart — Certificación física en Shared Kernel (§4, §6, §39, §45, §53, §53.b, §53.c)
import 'dart:convert';
import 'dart:io';
import 'package:axioma/council.dart';
import 'package:path/path.dart' as p;
import 'package:test/test.dart';

void main() {
  late Directory tempDir;
  late File mockBacklog;
  late File mockVeto;
  late File mockConvocationLog;
  late File mockFleetJson;

  setUp(() {
    tempDir = Directory.systemTemp.createTempSync('axioma_council_test_');

    mockBacklog = File(p.join(tempDir.path, 'backlog.json'));
    mockVeto = File(
      p.join(tempDir.path, 'vault', 'runtime', 'veto_records.json'),
    )..parent.createSync(recursive: true);
    mockConvocationLog = File(
      p.join(tempDir.path, 'vault', 'council', 'convocation_events.jsonl'),
    )..parent.createSync(recursive: true);
    mockFleetJson = File(p.join(tempDir.path, 'vault', 'fleet.json'))
      ..parent.createSync(recursive: true);

    mockFleetJson.writeAsStringSync(
      jsonEncode(<String, dynamic>{
        'cmmi5_appraisal_perimeter': <String, dynamic>{
          'active_nodes_roster': <String>[
            'conext_core',
            'Smart',
            'automa',
            'ruedas',
            'pj-air',
          ],
        },
      }),
    );
  });

  tearDown(() {
    if (tempDir.existsSync()) {
      tempDir.deleteSync(recursive: true);
    }
  });

  group(
    'Axioma CouncilAutonomousTriggerEngine — Happy Paths (§39, §53.b, §53.c)',
    () {
      test(
        'Happy Path 1: Backlog sin deudas técnicas abiertas pasa la Auditoría de Convergencia y retorna null (Pass-and-Stop)',
        () async {
          mockBacklog.writeAsStringSync(
            jsonEncode(<String, dynamic>{
              'active_sprint': null,
              'sprints': <Map<String, dynamic>>[
                <String, dynamic>{'id': 'N164', 'status': 'COMPLETED'},
              ],
              'technical_debt': <Map<String, dynamic>>[
                <String, dynamic>{
                  'id': 'TASK-DEBT-01',
                  'status': 'RESOLVED',
                  'title': 'Deuda saneada',
                },
              ],
            }),
          );

          final CouncilAutonomousTriggerEngine engine =
              CouncilAutonomousTriggerEngine(
                backlogPath: mockBacklog.path,
                reportsDir: p.join(tempDir.path, 'vault', 'reports'),
                vetoPath: mockVeto.path,
                convocationLogPath: mockConvocationLog.path,
                fleetJsonPath: mockFleetJson.path,
                sourceNode: 'ruedas',
              );

          final CouncilTriggerEvent? event = await engine
              .evaluateEmptyBacklog();
          expect(event, isNull);
        },
      );

      test(
        'Happy Path 2: Backlog con deuda técnica real abierta dispara evento acotado a la deuda',
        () async {
          mockBacklog.writeAsStringSync(
            jsonEncode(<String, dynamic>{
              'active_sprint': null,
              'sprints': <Map<String, dynamic>>[
                <String, dynamic>{'id': 'N164', 'status': 'COMPLETED'},
              ],
              'technical_debt': <Map<String, dynamic>>[
                <String, dynamic>{
                  'id': 'TASK-DEBT-RUEDAS-01',
                  'status': 'OPEN',
                  'title': 'Falla en catalog parsing',
                  'severity': 'HIGH',
                },
              ],
            }),
          );

          final CouncilAutonomousTriggerEngine engine =
              CouncilAutonomousTriggerEngine(
                backlogPath: mockBacklog.path,
                reportsDir: p.join(tempDir.path, 'vault', 'reports'),
                vetoPath: mockVeto.path,
                convocationLogPath: mockConvocationLog.path,
                fleetJsonPath: mockFleetJson.path,
                sourceNode: 'ruedas',
              );

          final CouncilTriggerEvent? event = await engine
              .evaluateEmptyBacklog();
          expect(event, isNotNull);
          expect(event!.triggerType, equals(CouncilTriggerType.emptyBacklog));
          expect(event.severity, equals('HIGH'));
          expect(event.generatedPrompt, contains('TASK-DEBT-RUEDAS-01'));
          expect(event.contextData['unresolved_debts_count'], equals(1));
        },
      );

      test(
        'Happy Path 3: runConvergenceAudit() retorna STEADY_STATE_PASS cuando 0 deudas y 0 vetos',
        () async {
          mockBacklog.writeAsStringSync(
            jsonEncode(<String, dynamic>{
              'active_sprint': null,
              'sprints': <Map<String, dynamic>>[
                <String, dynamic>{'id': 'N164', 'status': 'COMPLETED'},
              ],
              'technical_debt': <Map<String, dynamic>>[],
            }),
          );

          final CouncilAutonomousTriggerEngine engine =
              CouncilAutonomousTriggerEngine(
                backlogPath: mockBacklog.path,
                reportsDir: p.join(tempDir.path, 'vault', 'reports'),
                vetoPath: mockVeto.path,
                convocationLogPath: mockConvocationLog.path,
                fleetJsonPath: mockFleetJson.path,
                sourceNode: 'pj-air',
              );

          final Map<String, dynamic> audit = await engine.runConvergenceAudit();
          expect(audit['is_converged'], isTrue);
          expect(audit['status'], equals('STEADY_STATE_PASS'));
          expect(audit['operating_mode'], equals('MODO_CENTINELA'));
        },
      );

      test(
        'Happy Path 4: CouncilRitualValidator evalúa texto conforme al Ritual',
        () {
          const String text = '''
1. GAPS Y REALIDAD FÍSICA EN DISCO: Identificación de gaps en satélites.
2. FILTRO LEAN: Erradicación de sobreingeniería para eficiencia óptima.
3. SAD PATHS: Aserciones tipadas con throwsA y fallas de red.
4. SPRINTS FINITOS: Desglose de tareas con allowed_files.
''';
          final CouncilRitualReport report = CouncilRitualValidator.validate(
            text,
          );
          expect(report.isCompliant, isTrue);
        },
      );
    },
  );

  group('Axioma CouncilAutonomousTriggerEngine — Sad Paths (§6, §39, §53.c)', () {
    test(
      'Sad Path 1: evaluateEmptyBacklog con allowSpeculative: true lanza SpeculativeGenerationVetoException si no hay deudas',
      () async {
        mockBacklog.writeAsStringSync(
          jsonEncode(<String, dynamic>{
            'active_sprint': null,
            'sprints': <Map<String, dynamic>>[],
            'technical_debt': <Map<String, dynamic>>[],
          }),
        );

        final CouncilAutonomousTriggerEngine engine =
            CouncilAutonomousTriggerEngine(
              backlogPath: mockBacklog.path,
              reportsDir: p.join(tempDir.path, 'vault', 'reports'),
              vetoPath: mockVeto.path,
              convocationLogPath: mockConvocationLog.path,
              fleetJsonPath: mockFleetJson.path,
            );

        expect(
          () async => await engine.evaluateEmptyBacklog(allowSpeculative: true),
          throwsA(isA<SpeculativeGenerationVetoException>()),
        );
      },
    );

    test(
      'Sad Path 2: Archivo de backlog inexistente lanza CouncilTriggerException',
      () async {
        final CouncilAutonomousTriggerEngine engine =
            CouncilAutonomousTriggerEngine(
              backlogPath: p.join(tempDir.path, 'no_backlog.json'),
              reportsDir: p.join(tempDir.path, 'vault', 'reports'),
              vetoPath: mockVeto.path,
              convocationLogPath: mockConvocationLog.path,
              fleetJsonPath: mockFleetJson.path,
            );

        expect(
          () async => await engine.evaluateEmptyBacklog(),
          throwsA(isA<CouncilTriggerException>()),
        );
      },
    );

    test(
      'Sad Path 3: Archivo de backlog corrupto lanza CouncilTriggerException',
      () async {
        mockBacklog.writeAsStringSync('{ CORRUPT JSON');

        final CouncilAutonomousTriggerEngine engine =
            CouncilAutonomousTriggerEngine(
              backlogPath: mockBacklog.path,
              reportsDir: p.join(tempDir.path, 'vault', 'reports'),
              vetoPath: mockVeto.path,
              convocationLogPath: mockConvocationLog.path,
              fleetJsonPath: mockFleetJson.path,
            );

        expect(
          () async => await engine.evaluateEmptyBacklog(),
          throwsA(isA<CouncilTriggerException>()),
        );
      },
    );

    test(
      'Sad Path 4: CouncilRitualValidator veta sobreingeniería corporativa',
      () {
        const String bloat = '''
Gaps identificados. Solución lean y eficiente con sprints.
Implementar OpenTelemetry distributed tracing y rotación en HashiCorp Vault.
Sad paths cubiertos con throwsA.
''';
        final CouncilRitualReport report = CouncilRitualValidator.validate(
          bloat,
        );
        expect(report.isCompliant, isFalse);
        expect(report.detectedBloat, contains('opentelemetry'));
        expect(report.detectedBloat, contains('hashicorp vault'));
      },
    );
  });
}
