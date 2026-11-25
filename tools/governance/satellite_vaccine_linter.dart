/// satellite_vaccine_linter.dart — Linter AST de Vacunas de Flota y Fronteras de Dominio (§4, §6, §39, §46, §58, §60.7, §60.8).
///
/// Evalúa el código staged en Git o los archivos locales contra:
/// 1. Reglas universales de frontera arquitectónica y pureza de dominio (SPA §58, Thin Client §40).
/// 2. Vacunas preventivas específicas de satélite registradas en `vault/runtime/preventive_actions.json`.
library;

import 'dart:io';
// ignore: implementation_imports
import 'package:axioma/src/governance/satellite_vaccine_models.dart';

void main(List<String> args) {
  if (args.contains('--help') || args.contains('-h')) {
    stdout.writeln(
      'Uso: dart tools/governance/satellite_vaccine_linter.dart [opciones]',
    );
    stdout.writeln(
      '  --node <nombre>     Nombre o slug del nodo satélite (ej. ruedas, automa, Smart)',
    );
    stdout.writeln(
      '  --root <directorio> Directorio raíz del workspace/satélite a escanear',
    );
    stdout.writeln('  --file <archivo>    Escanea un único archivo específico');
    stdout.writeln(
      '  --pre-commit        Escanea exclusivamente los archivos staged en git diff --cached',
    );
    stdout.writeln(
      '  --strict            Modo estricto: falla ante advertencias de vacunas',
    );
    exit(0);
  }

  String? targetNode;
  String workspaceRoot = Directory.current.path;
  String? singleFile;
  bool preCommit = false;

  for (int i = 0; i < args.length; i++) {
    final String arg = args[i];
    if (arg == '--node' && i + 1 < args.length) {
      targetNode = args[++i];
    } else if (arg.startsWith('--node=')) {
      targetNode = arg.substring(7);
    } else if (arg == '--root' && i + 1 < args.length) {
      workspaceRoot = args[++i];
    } else if (arg.startsWith('--root=')) {
      workspaceRoot = arg.substring(7);
    } else if (arg == '--file' && i + 1 < args.length) {
      singleFile = args[++i];
    } else if (arg.startsWith('--file=')) {
      singleFile = arg.substring(7);
    } else if (arg == '--pre-commit') {
      preCommit = true;
    }
  }

  // Auto-detección del nodo mediante bunker_profile.json si no fue provisto
  if (targetNode == null) {
    final File profileFile = File('$workspaceRoot/bunker_profile.json');
    if (profileFile.existsSync()) {
      try {
        final String content = profileFile.readAsStringSync();
        final RegExp reg = RegExp(r'"node_name"\s*:\s*"([^"]+)"');
        final Match? match = reg.firstMatch(content);
        if (match != null) {
          targetNode = match.group(1);
        }
      } catch (_) {
        // INTENTIONAL: Fallback si bunker_profile.json no puede parsearse
      }
    }
  }

  final SatelliteVaccineScanner scanner =
      SatelliteVaccineScanner.loadForWorkspace(
        workspaceRoot,
        targetNode: targetNode,
      );

  final List<File> filesToScan = <File>[];

  if (singleFile != null) {
    final File f = File(singleFile);
    if (!f.existsSync()) {
      stderr.writeln('❌ Error: Archivo objetivo no existe: $singleFile');
      exit(2);
    }
    filesToScan.add(f);
  } else if (preCommit) {
    try {
      final ProcessResult res = Process.runSync('git', <String>[
        'diff',
        '--cached',
        '--name-only',
      ], workingDirectory: workspaceRoot);
      if (res.exitCode == 0) {
        final List<String> paths = (res.stdout as String).split('\n');
        for (final String p in paths) {
          final String trimmed = p.trim();
          if (trimmed.isEmpty) continue;
          final File f = File('$workspaceRoot/$trimmed');
          if (f.existsSync()) {
            filesToScan.add(f);
          }
        }
      }
    } catch (_) {
      // INTENTIONAL: Fallback si git no está disponible
    }
  }

  // Fallback: si no hay archivos staged específicos ni archivo único, escanear lib/, test/, tools/
  if (filesToScan.isEmpty) {
    for (final String dirName in <String>['lib', 'tools']) {
      final Directory d = Directory('$workspaceRoot/$dirName');
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
      '=== COMISIÓN DE GOBERNANZA: INFRACCIÓN DE VACUNAS AST (§46, §58, §60.8) ===',
    );
    stderr.writeln(
      'Nodo auditado: ${targetNode ?? "UNIVERSAL"} | Archivos escaneados: ${filesToScan.length}',
    );
    for (final VaccineViolation v in violations) {
      stderr.writeln(v.toString());
    }
    exit(1);
  }

  stdout.writeln(
    '[VACCINE-LINTER-OK] Código conforme con las vacunas AST (${scanner.rules.length} activas en nodo ${targetNode ?? "UNIVERSAL"}).',
  );
  exit(0);
}
