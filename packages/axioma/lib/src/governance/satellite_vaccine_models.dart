/// satellite_vaccine_models.dart — Modelos y Escáner de Vacunas Mecánicas de Flota (§4, §6, §39, §46, §58, §60.7, §60.8).
library;

import 'dart:convert';
import 'dart:io';

/// Representa una infracción detectada por una vacuna de dominio o frontera arquitectónica.
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

  Map<String, dynamic> toJson() => <String, dynamic>{
    'vaccine_id': vaccineId,
    'file': file,
    'line': line,
    'snippet': snippet,
    'mitigation': mitigation,
  };

  @override
  String toString() =>
      '[VACCINE_VIOLATION] $file:$line [$vaccineId]\n'
      '  Snippet: "$snippet"\n'
      '  Mitigación: $mitigation';
}

/// Excepción tipada lanzada cuando se violan vacunas de gobernanza (§4, §6, §46, §60.7).
class VaccineViolationException implements Exception {
  final List<VaccineViolation> violations;

  const VaccineViolationException(this.violations);

  @override
  String toString() =>
      'VaccineViolationException: ${violations.length} violación(es) detectada(s):\n'
      '${violations.map((VaccineViolation v) => '  - ${v.vaccineId} en ${v.file}:${v.line} -> ${v.snippet}').join('\n')}';
}

/// Definición determinista de una vacuna de gobernanza.
class SatelliteVaccineRule {
  final String id;
  final String patternRegex;
  final String? targetPathContains;
  final String? excludePathContains;
  final String mitigationRule;
  final String severity;
  final String?
  nodeScope; // null si es universal, o slug del nodo (ej. 'ruedas', 'automa')

  const SatelliteVaccineRule({
    required this.id,
    required this.patternRegex,
    this.targetPathContains,
    this.excludePathContains,
    required this.mitigationRule,
    this.severity = 'ERROR',
    this.nodeScope,
  });

  factory SatelliteVaccineRule.fromJson(Map<String, dynamic> json) {
    return SatelliteVaccineRule(
      id: (json['id'] ?? json['action_id'] ?? '').toString(),
      patternRegex: (json['pattern_regex'] ?? json['defect_pattern'] ?? '')
          .toString(),
      targetPathContains: json['target_path_contains'] as String?,
      excludePathContains: json['exclude_path_contains'] as String?,
      mitigationRule:
          (json['mitigation_rule'] ??
                  json['synthetic_rule'] ??
                  'Remediar violación')
              .toString(),
      severity: (json['severity'] as String? ?? 'ERROR').toUpperCase(),
      nodeScope: json['node_scope'] as String?,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'pattern_regex': patternRegex,
    if (targetPathContains != null) 'target_path_contains': targetPathContains,
    if (excludePathContains != null)
      'exclude_path_contains': excludePathContains,
    'mitigation_rule': mitigationRule,
    'severity': severity,
    if (nodeScope != null) 'node_scope': nodeScope,
  };
}

/// Escáner agnóstico y determinista para vacunas mecánicas en satélites (§39, §58, §60.8).
class SatelliteVaccineScanner {
  final String? targetNode;
  final List<SatelliteVaccineRule> rules;

  final RegExp suppressionRegex = RegExp(
    r'//\s*(?:axioma-ignore\s*:\s*([A-Za-z0-9_-]+)|INTENTIONAL\s*:\s*(.+))$',
  );

  /// Vacunas universales de flota aplicables a todos los nodos (§40, §58, §60.8, §62).
  static const List<SatelliteVaccineRule>
  kUniversalFleetVaccines = <SatelliteVaccineRule>[
    SatelliteVaccineRule(
      id: 'VACCINE-TRIPARTITE-BOUNDARY-01',
      patternRegex:
          r'''import\s+['"]package:(?:automa|ruedas|levita|pj_air|beatme|bluemarket|therank)/''',
      mitigationRule:
          'Prohibida la importación directa de satélites foráneos en código de Smart/Kernel. Canalice mediante packages/axioma o Synapse (§60.8, §62).',
      nodeScope: null,
    ),
    SatelliteVaccineRule(
      id: 'VACCINE-UNIVERSAL-NO-UI-REGEX-02',
      patternRegex: r'RegExp\([^\)]*\)',
      targetPathContains: 'presentation/',
      mitigationRule:
          'Prohibida la instanciación de RegExp en presentation/ o componentes de UI (§40, §58.2). Delegar parsing a Domain/UseCases.',
      nodeScope: null,
    ),
    SatelliteVaccineRule(
      id: 'VACCINE-UNIVERSAL-STAGE-BYPASS-03',
      patternRegex:
          r'if\s*\(\s*_?hybrid(?:Ingestion)?Pipeline\s*!=\s*null\s*\)',
      targetPathContains: 'lib/',
      mitigationRule:
          'HybridIngestionPipeline es mandatorio e ineludible en servicios de ingesta (§31, §58.6). Prohibidas guardas condicionales.',
      nodeScope: null,
    ),
  ];

  SatelliteVaccineScanner({
    this.targetNode,
    List<SatelliteVaccineRule>? customRules,
  }) : rules = <SatelliteVaccineRule>[
         ...kUniversalFleetVaccines,
         ...?customRules,
       ];

  /// Escanea un bloque de código y reporta violaciones activas no suprimidas.
  List<VaccineViolation> scanContent(String content, {String filePath = ''}) {
    final List<VaccineViolation> violations = <VaccineViolation>[];
    final List<String> lines = content.split('\n');

    for (final SatelliteVaccineRule rule in rules) {
      if (rule.patternRegex.isEmpty) continue;

      // Filtro de alcance por nodo si está especificado
      if (rule.nodeScope != null &&
          targetNode != null &&
          rule.nodeScope != targetNode) {
        continue;
      }

      // Filtros de ruta
      if (rule.targetPathContains != null &&
          !filePath.contains(rule.targetPathContains!)) {
        continue;
      }
      if (rule.excludePathContains != null &&
          filePath.contains(rule.excludePathContains!)) {
        continue;
      }

      // La frontera tripartita protege lib/ y tools/; test/ está exento de boundary test
      if (rule.id == 'VACCINE-TRIPARTITE-BOUNDARY-01' &&
          (filePath.contains('test/') || filePath.endsWith('_test.dart'))) {
        continue;
      }

      RegExp regex;
      try {
        regex = RegExp(rule.patternRegex, multiLine: true);
      } catch (_) {
        // INTENTIONAL: Regex fallback seguro si el patrón contiene caracteres no escapados (§10).
        regex = RegExp(RegExp.escape(rule.patternRegex), multiLine: true);
      }

      for (int i = 0; i < lines.length; i++) {
        final String line = lines[i];
        if (!regex.hasMatch(line)) continue;

        bool suppressed = suppressionRegex.hasMatch(line);
        if (!suppressed && i > 0) {
          suppressed = suppressionRegex.hasMatch(lines[i - 1]);
        }
        if (!suppressed && i > 1) {
          suppressed = suppressionRegex.hasMatch(lines[i - 2]);
        }

        if (!suppressed) {
          violations.add(
            VaccineViolation(
              vaccineId: rule.id,
              file: filePath,
              line: i + 1,
              snippet: line.trim(),
              mitigation: rule.mitigationRule,
            ),
          );
        }
      }
    }
    return violations;
  }

  /// Valida que el contenido esté libre de violaciones, lanzando VaccineViolationException si hay fallos (§4, §6, §60.7).
  void enforceClean(String content, {String filePath = ''}) {
    final List<VaccineViolation> violations = scanContent(
      content,
      filePath: filePath,
    );
    if (violations.isNotEmpty) {
      throw VaccineViolationException(violations);
    }
  }

  /// Escanea una lista física de archivos en disco.
  List<VaccineViolation> scanFiles(List<File> files) {
    final List<VaccineViolation> allViolations = <VaccineViolation>[];
    for (final File f in files) {
      if (!f.path.endsWith('.dart')) continue;
      // Los archivos de prueba test/ están exentos para permitir aserciones negativas (§4, §6, §60.7)
      if (f.path.contains('test/') || f.path.endsWith('_test.dart')) continue;
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

  /// Carga dinámicamente un escáner desde un directorio raíz de satélite/workspace.
  static SatelliteVaccineScanner loadForWorkspace(
    String workspaceRoot, {
    String? targetNode,
  }) {
    final List<SatelliteVaccineRule> customRules = <SatelliteVaccineRule>[];
    final File registryFile = File(
      '$workspaceRoot/vault/runtime/preventive_actions.json',
    );
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

          for (final dynamic item in rawList) {
            if (item is Map<String, dynamic>) {
              final String st = (item['status'] as String? ?? 'ACTIVE')
                  .toUpperCase();
              if (st == 'ACTIVE' || st.startsWith('IMMUNIZED')) {
                customRules.add(SatelliteVaccineRule.fromJson(item));
              }
            }
          }
        }
      } catch (_) {
        // INTENTIONAL: Fallback si preventive_actions.json no se puede leer o parsear
      }
    }

    return SatelliteVaccineScanner(
      targetNode: targetNode,
      customRules: customRules,
    );
  }
}
