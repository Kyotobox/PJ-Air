/// satellite_vaccine_linter.dart — Linter AST de Vacunas y Fronteras de la Tríada (§39, §46, §60.8, §62).
///
/// Evalúa el código staged en Git o los archivos locales contra:
/// 1. Reglas constitucionales de frontera arquitectónica tripartita (§39, §60.8, §62).
/// 2. Vacunas preventivas registradas en `vault/runtime/preventive_actions.json`.
library;

import 'dart:convert';
import 'dart:io';

class VaccineViolation {
  final String vaccineId;
  final String file;
  final int line;
  final String snippet;
  final String mitigation;

  const VaccineViolation({
    required this.vaccineId,
    required this.file,
    required this.line,
    required this.snippet,
    required this.mitigation,
  });

  @override
  String toString() =>
      '[VACCINE_VIOLATION] $file:$line [$vaccineId]\n'
      '  Snippet: "$snippet"\n'
      '  Mitigación: $mitigation';
}

/// Escáner modular y determinista para vacunas y fronteras arquitectónicas (§39, §60.8).
class SatelliteVaccineScanner {
  final List<Map<String, dynamic>> vaccines;
  final RegExp suppressionRegex = RegExp(
    r'//\s*(?:axioma-ignore\s*:\s*([A-Za-z0-9_-]+)|INTENTIONAL\s*:\s*(.+))$',
  );

  /// Reglas estáticas inmutables de frontera arquitectónica tripartita (§39, §60.8, §62).
  static const List<Map<String, dynamic>>
  kBuiltinBoundaryVaccines = <Map<String, dynamic>>[
    <String, dynamic>{
      'id': 'VACCINE-TRIPARTITE-BOUNDARY-01',
      'pattern_regex':
          r'''import\s+['"]package:(?:automa|ruedas|levita|pj_air|beatme|bluemarket|therank)/''',
      'mitigation_rule':
          'Prohibida la importación directa de satélites foráneos en código de Smart. Canalice mediante packages/axioma o Synapse (§60.8, §62).',
    },
  ];

  SatelliteVaccineScanner({List<Map<String, dynamic>>? customVaccines})
    : vaccines = <Map<String, dynamic>>[
        ...kBuiltinBoundaryVaccines,
        ...?customVaccines,
      ];

  /// Escanea un bloque de código y reporta violaciones activas no suprimidas.
  List<VaccineViolation> scanContent(String content, {String filePath = ''}) {
    final List<VaccineViolation> violations = <VaccineViolation>[];
    final List<String> lines = content.split('\n');

    for (final Map<String, dynamic> vac in vaccines) {
      final String id = (vac['id'] ?? vac['action_id'] ?? '').toString();
      final String patternStr =
          (vac['pattern_regex'] ?? vac['defect_pattern'] ?? '').toString();
      final String mitigation =
          (vac['mitigation_rule'] ??
                  vac['synthetic_rule'] ??
                  'Remediar violación')
              .toString();

      if (patternStr.isEmpty) continue;

      // La frontera arquitectónica tripartita protege el código de producción (lib/ y tools/) (§39, §60.8)
      if (id == 'VACCINE-TRIPARTITE-BOUNDARY-01' &&
          (filePath.contains('test/') || filePath.endsWith('_test.dart'))) {
        continue;
      }

      RegExp regex;
      try {
        regex = RegExp(patternStr, multiLine: true);
      } catch (_) {
        // INTENTIONAL: Regex fallback seguro si el patrón contiene caracteres no escapados (§10).
        regex = RegExp(RegExp.escape(patternStr), multiLine: true);
      }

      for (int i = 0; i < lines.length; i++) {
        final String line = lines[i];
        if (!regex.hasMatch(line)) continue;

        bool suppressed = suppressionRegex.hasMatch(line);
        if (!suppressed && i > 0) {
          suppressed = suppressionRegex.hasMatch(lines[i - 1]);
        }

        if (!suppressed) {
          violations.add(
            VaccineViolation(
              vaccineId: id,
              file: filePath,
              line: i + 1,
              snippet: line.trim(),
              mitigation: mitigation,
            ),
          );
        }
      }
    }
    return violations;
  }

  /// Escanea una lista física de archivos en disco.
  List<VaccineViolation> scanFiles(List<File> files) {
    final List<VaccineViolation> allViolations = <VaccineViolation>[];
    for (final File f in files) {
      // Las vacunas AST y análisis estático aplican exclusivamente al código Dart (§39, §46)
      if (!f.path.endsWith('.dart')) continue;
      try {
        final String content = f.readAsStringSync();
        allViolations.addAll(scanContent(content, filePath: f.path));
      } catch (_) {
        // INTENTIONAL: Ignora archivos no legibles como binarios o eliminados
        continue;
      }
    }
    return allViolations;
  }
}

void main(List<String> args) {
  final List<Map<String, dynamic>> loadedVaccines = <Map<String, dynamic>>[];
  final File registryFile = File('vault/runtime/preventive_actions.json');
  if (registryFile.existsSync()) {
    try {
      final String raw = registryFile.readAsStringSync().trim();
      if (raw.isNotEmpty) {
        final dynamic decoded = jsonDecode(raw);
        final List<dynamic> rawList = decoded is List<dynamic>
            ? decoded
            : (decoded is Map<String, dynamic> &&
                  decoded['actions'] is List<dynamic>)
            ? decoded['actions'] as List<dynamic>
            : <dynamic>[];

        loadedVaccines.addAll(
          rawList.whereType<Map<String, dynamic>>().where((
            Map<String, dynamic> v,
          ) {
            final String st = (v['status'] as String? ?? 'ACTIVE')
                .toUpperCase();
            return st == 'ACTIVE' || st.startsWith('IMMUNIZED');
          }),
        );
      }
    } catch (_) {
      // INTENTIONAL: Continuar con vacunas built-in si el archivo no se puede parsear
    }
  }

  final SatelliteVaccineScanner scanner = SatelliteVaccineScanner(
    customVaccines: loadedVaccines,
  );
  final List<File> filesToScan = <File>[];

  if (args.contains('--pre-commit')) {
    try {
      final ProcessResult res = Process.runSync('git', <String>[
        'diff',
        '--cached',
        '--name-only',
      ]);
      if (res.exitCode == 0) {
        final List<String> paths = (res.stdout as String).split('\n');
        for (final String p in paths) {
          final String trimmed = p.trim();
          if (trimmed.isNotEmpty && File(trimmed).existsSync()) {
            filesToScan.add(File(trimmed));
          }
        }
      }
    } catch (_) {
      // INTENTIONAL: Fallback si git no está disponible
    }
  }

  // Fallback: si no hay archivos staged específicos, escanear lib/, test/, tools/
  if (filesToScan.isEmpty) {
    for (final String dirName in <String>['lib', 'test', 'tools']) {
      final Directory d = Directory(dirName);
      if (d.existsSync()) {
        for (final FileSystemEntity entity in d.listSync(recursive: true)) {
          if (entity is File && entity.path.endsWith('.dart')) {
            filesToScan.add(entity);
          }
        }
      }
    }
  }

  final List<VaccineViolation> violations = scanner.scanFiles(filesToScan);

  if (violations.isNotEmpty) {
    stderr.writeln(
      '=== COMISIÓN DE GOBERNANZA: INFRACCIÓN DE VACUNAS AST (§46, §60.8) ===',
    );
    for (final VaccineViolation v in violations) {
      stderr.writeln(v.toString());
    }
    exit(1);
  }

  stdout.writeln(
    '[VACCINE-LINTER-OK] Código conforme con las vacunas AST y fronteras tripartitas activas.',
  );
  exit(0);
}
