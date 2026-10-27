import 'dart:io';

import 'package:test/test.dart';
import 'package:axioma/src/dispatch/dispatch_manifest.dart';
import 'package:axioma/src/dispatch/prompt_hydrator.dart';

void main() {
  group('DispatchManifest Tests (Happy + Sad Path)', () {
    test('Happy Path: Deserialización correcta y campos inferidos', () {
      final Map<String, Object> jsonMap = <String, Object>{
        'manifest_version': '1.0.0',
        'task_id': 'TASK-PRO-JULES-01',
        'task_title': 'DTO de Calificación de Leads B2B',
        'task_desc': 'Descripción explícita de la tarea',
        'satellite': 'Kyotobox/ProspectAtlas',
        'branch': 'factory/exec-jules-001/TASK-PRO-JULES-01',
        'target_files': <String>[
          'src/models/lead_scoring_dto.py',
          'tests/test_lead_scoring_dto.py',
        ],
        'verification_command': 'pytest tests/test_lead_scoring_dto.py',
        'acceptance_criteria': <String>[
          'Implementar modelo Pydantic v2.',
          'Sad Path con ValidationError.',
        ],
      };

      final DispatchManifest manifest = DispatchManifest.fromJson(jsonMap);
      expect(manifest.taskId, 'TASK-PRO-JULES-01');
      expect(manifest.executionId, 'exec-jules-001');
      expect(manifest.taskDesc, 'Descripción explícita de la tarea');
      expect(manifest.targetFiles.length, 2);
      expect(manifest.acceptanceCriteria.length, 2);
    });

    test('Sad Path: Rechaza manifiesto sin task_id', () {
      final Map<String, Object> jsonMap = <String, Object>{
        'task_title': 'Título sin ID',
        'satellite': 'Kyotobox/ProspectAtlas',
        'branch': 'factory/exec-001/TASK-01',
        'target_files': <String>['file1.py'],
        'verification_command': 'pytest',
        'acceptance_criteria': <String>['criterio'],
      };

      expect(
        () => DispatchManifest.fromJson(jsonMap),
        throwsA(
          isA<FormatException>().having(
            (FormatException e) => e.message,
            'msg',
            contains('task_id'),
          ),
        ),
      );
    });

    test('Sad Path: Rechaza manifiesto que excede 5 archivos (§12.b)', () {
      final Map<String, Object> jsonMap = <String, Object>{
        'task_id': 'TASK-01',
        'task_title': 'Exceso de archivos',
        'satellite': 'Kyotobox/ProspectAtlas',
        'branch': 'factory/exec-001/TASK-01',
        'target_files': <String>['f1', 'f2', 'f3', 'f4', 'f5', 'f6'],
        'verification_command': 'pytest',
        'acceptance_criteria': <String>['criterio'],
      };

      expect(
        () => DispatchManifest.fromJson(jsonMap),
        throwsA(
          isA<FormatException>().having(
            (FormatException e) => e.message,
            'msg',
            contains('§12.b'),
          ),
        ),
      );
    });

    test('Sad Path: Rechaza manifiesto sin verification_command o target_files vacío', () {
      final Map<String, Object> jsonMap = <String, Object>{
        'task_id': 'TASK-01',
        'task_title': 'Sin comando',
        'satellite': 'Kyotobox/ProspectAtlas',
        'branch': 'factory/exec-001/TASK-01',
        'target_files': <String>[],
        'verification_command': '',
        'acceptance_criteria': <String>['criterio'],
      };

      expect(
        () => DispatchManifest.fromJson(jsonMap),
        throwsA(isA<FormatException>()),
      );
    });
  });

  group('PromptHydrator Tests (Happy + Sad Path)', () {
    const String sampleTemplate = '''
# DESPACHO: {{EXECUTION_ID}}
- Tarea: {{TASK_ID}} - {{TASK_TITLE}}
- Satélite: {{SATELLITE}}
- Desc: {{TASK_DESC}}
- Archivos:
  {{ALLOWED_FILES}}
- Criterios:
  {{ACCEPTANCE_CRITERIA}}
- Verificación: {{VERIFICATION_COMMAND}}
''';

    final DispatchManifest validManifest = const DispatchManifest(
      manifestVersion: '1.0.0',
      taskId: 'TASK-PRO-JULES-01',
      taskTitle: 'DTO Leads',
      taskDesc: 'Implementar DTO',
      satellite: 'Kyotobox/ProspectAtlas',
      branch: 'factory/exec-001/TASK-PRO-JULES-01',
      targetFiles: <String>['src/dto.py', 'tests/test_dto.py'],
      verificationCommand: 'pytest tests/test_dto.py',
      acceptanceCriteria: <String>['Validar campos', 'Sad path exception'],
      executionId: 'exec-001',
    );

    test('Happy Path: Hidratación determinista exhaustiva sin variables residuales', () {
      final String rendered = PromptHydrator.hydrate(
        templateContent: sampleTemplate,
        manifest: validManifest,
      );

      expect(rendered, contains('DESPACHO: exec-001'));
      expect(rendered, contains('TASK-PRO-JULES-01 - DTO Leads'));
      expect(rendered, contains('Kyotobox/ProspectAtlas'));
      expect(rendered, contains('Implementar DTO'));
      expect(rendered, contains('- `src/dto.py`'));
      expect(rendered, contains('- `tests/test_dto.py`'));
      expect(rendered, contains('- Validar campos'));
      expect(rendered, contains('- Sad path exception'));
      expect(rendered, contains('pytest tests/test_dto.py'));

      // Verificación de cero {{...}}
      expect(rendered.contains('{{'), isFalse);
      expect(rendered.contains('}}'), isFalse);
    });

    test('Sad Path: Lanza FormatException si quedan variables residuales no reconocidas', () {
      const String templateWithUnknown = '''
# DESPACHO: {{EXECUTION_ID}}
{{TASK_ID}}
{{UNKNOWN_VARIABLE}}
''';

      expect(
        () => PromptHydrator.hydrate(
          templateContent: templateWithUnknown,
          manifest: validManifest,
        ),
        throwsA(
          isA<FormatException>().having(
            (FormatException e) => e.message,
            'msg',
            contains('UNKNOWN_VARIABLE'),
          ),
        ),
      );
    });

    test('Sad Path: Lanza FormatException si la plantilla está vacía', () {
      expect(
        () => PromptHydrator.hydrate(
          templateContent: '   ',
          manifest: validManifest,
        ),
        throwsA(
          isA<FormatException>().having(
            (FormatException e) => e.message,
            'msg',
            contains('no puede estar vacía'),
          ),
        ),
      );
    });

    test('Sad Path: hydrateAndSave lanza FileSystemException ante archivo inexistente', () {
      expect(
        () => PromptHydrator.hydrateAndSave(
          templateFile: File('vault/non_existent_template.md'),
          manifestFile: File(
            'vault/dispatch/dispatch_manifest_prospect_atlas.json',
          ),
          outputDir: Directory('vault/dispatch/rendered'),
        ),
        throwsA(isA<FileSystemException>()),
      );
    });
  });
}
