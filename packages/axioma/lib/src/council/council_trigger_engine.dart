// 🎯 Council Autonomous Trigger Engine — Motor de auto-convocatoria desatendida del Consejo Federado Tier-2 (§40, §45, §53, §53.b, §53.c)
// Disparadores autónomos: EMPTY_BACKLOG_TRIGGER (con Auditoría de Convergencia Pass-and-Stop), VETO_ARBITRATION_TRIGGER, PPM_ANOMALY_TRIGGER.
// Implementa Soberanía Offline-First (§45), Piso Cognitivo Tier-2 Mandatorio (§53), Ritual Constitucional Cuádruple (§53.b) y Modo Centinela (§53.c).

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as p;
import '../services/fleet_council_client.dart';

/// System prompt canónico que impone el Ritual Constitucional Cuádruple (§53.b, §53.c).
const String kCouncilSystemPrompt = '''
Eres el Consejo Federado de Arquitectura y Gobernanza Tier-2 (§47, §53, §53.b, §53.c).
Tu rol es arbitrar y planificar la estrategia de la flota de software soberano con Verdad Atómica y Cero Complacencia.

RITUAL CONSTITUCIONAL OBLIGATORIO (§53.b, §53.c):
Tu dictamen DEBE estructurarse estrictamente en las siguientes 4 secciones ineludibles:
1. GAPS Y REALIDAD FÍSICA EN DISCO: Identificación ontológica de brechas contra el stack observable (Pure Dart axioma, SQLite WAL, satélites en fleet.json). Prohibido alucinar infraestructuras ajenas o inventar trabajo especulativo si no hay deudas o hallazgos físicos reales.
2. FILTRO LEAN (SOBREINGENIERÍA VS EFICIENCIA): Análisis de Muda (sobre-procesamiento, inventario inútil). Veto a tecnologías foráneas (OpenTelemetry, HashiCorp Vault, Kubernetes, IaC). Máxima simplicidad, máxima pureza Dart y valor directo a producto.
3. SAD PATHS Y ESCENARIOS DE RUPTURA (§4, §6): Escenarios negativos obligatorios (throwsA, partición, disco, corrupción) con gates físicos medibles (\$?).
4. DESGLOSE DE SPRINTS FINITOS (§12.b, §44, §51): 4 a 6 tareas por sprint, límite 5 archivos por tarea (allowed_files), contratos DTOs Pure Dart acotados exclusivamente a los hallazgos reales.
''';

/// Tipos canónicos de disparadores autónomos hacia el Consejo.
enum CouncilTriggerType {
  emptyBacklog('EMPTY_BACKLOG_TRIGGER'),
  vetoArbitration('VETO_ARBITRATION_TRIGGER'),
  ppmAnomaly('PPM_ANOMALY_TRIGGER'),
  convergenceAudit('CONVERGENCE_AUDIT_TRIGGER');

  final String id;
  const CouncilTriggerType(this.id);

  static CouncilTriggerType fromId(String id) {
    for (final CouncilTriggerType type in CouncilTriggerType.values) {
      if (type.id.toUpperCase() == id.toUpperCase() ||
          type.name.toUpperCase() == id.toUpperCase()) {
        return type;
      }
    }
    throw CouncilTriggerException('Tipo de disparador desconocido: $id');
  }
}

/// Excepción formal de gobernanza para disparadores autónomos.
class CouncilTriggerException implements Exception {
  final String message;
  final dynamic details;

  const CouncilTriggerException(this.message, {this.details});

  @override
  String toString() =>
      'CouncilTriggerException: $message${details != null ? ' ($details)' : ''}';
}

/// Excepción lanzada cuando se intenta forzar la generación especulativa de sprints sin deudas ni hallazgos físicos (§53.c).
class SpeculativeGenerationVetoException extends CouncilTriggerException {
  const SpeculativeGenerationVetoException(super.message, {super.details});
}

/// Reporte de validación de cumplimiento del Ritual Constitucional del Consejo (§53.b, §53.c).
class CouncilRitualReport {
  final bool isCompliant;
  final bool hasGapsAnalysis;
  final bool hasLeanFilter;
  final bool hasSadPaths;
  final bool hasFiniteSprints;
  final List<String> detectedBloat;
  final List<String> missingSections;

  const CouncilRitualReport({
    required this.isCompliant,
    required this.hasGapsAnalysis,
    required this.hasLeanFilter,
    required this.hasSadPaths,
    required this.hasFiniteSprints,
    this.detectedBloat = const <String>[],
    this.missingSections = const <String>[],
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'is_compliant': isCompliant,
    'has_gaps_analysis': hasGapsAnalysis,
    'has_lean_filter': hasLeanFilter,
    'has_sad_paths': hasSadPaths,
    'has_finite_sprints': hasFiniteSprints,
    'detected_bloat': detectedBloat,
    'missing_sections': missingSections,
  };

  factory CouncilRitualReport.fromJson(Map<String, dynamic> json) {
    return CouncilRitualReport(
      isCompliant: json['is_compliant'] as bool? ?? false,
      hasGapsAnalysis: json['has_gaps_analysis'] as bool? ?? false,
      hasLeanFilter: json['has_lean_filter'] as bool? ?? false,
      hasSadPaths: json['has_sad_paths'] as bool? ?? false,
      hasFiniteSprints: json['has_finite_sprints'] as bool? ?? false,
      detectedBloat:
          (json['detected_bloat'] as List<dynamic>?)?.cast<String>() ??
          <String>[],
      missingSections:
          (json['missing_sections'] as List<dynamic>?)?.cast<String>() ??
          <String>[],
    );
  }
}

/// Validador mecánico del Ritual Constitucional de Convocatoria del Consejo (§53.b, §53.c).
class CouncilRitualValidator {
  static const List<String> forbiddenBloatPatterns = <String>[
    'opentelemetry',
    'hashicorp vault',
    'kubernetes',
    'iac compliance',
    'cloudformation',
    'terraform',
    'kafka cluster',
  ];

  static CouncilRitualReport validate(String text) {
    final String lower = text.toLowerCase();

    final bool hasGaps =
        lower.contains('gap') ||
        lower.contains('brecha') ||
        lower.contains('realidad física');

    final bool hasLean =
        lower.contains('lean') ||
        lower.contains('sobreingeniería') ||
        lower.contains('eficiencia') ||
        lower.contains('muda');

    final bool hasSadPaths =
        lower.contains('sad path') ||
        lower.contains('throwsa') ||
        lower.contains('escenario de ruptura') ||
        lower.contains('falla de red') ||
        lower.contains('partición');

    final bool hasFiniteSprints =
        lower.contains('sprint') ||
        lower.contains('tarea') ||
        lower.contains('allowed_files');

    final List<String> detectedBloat = <String>[];
    for (final String pattern in forbiddenBloatPatterns) {
      if (lower.contains(pattern)) {
        detectedBloat.add(pattern);
      }
    }

    final List<String> missing = <String>[];
    if (!hasGaps) missing.add('GAPS_Y_REALIDAD_FISICA');
    if (!hasLean) missing.add('FILTRO_LEAN_SOBREINGENIERIA_VS_EFICIENCIA');
    if (!hasSadPaths) missing.add('SAD_PATHS_Y_GATES_FISICOS');
    if (!hasFiniteSprints) missing.add('PLAN_DE_SPRINTS_FINITOS');

    final bool isCompliant = missing.isEmpty && detectedBloat.isEmpty;

    return CouncilRitualReport(
      isCompliant: isCompliant,
      hasGapsAnalysis: hasGaps,
      hasLeanFilter: hasLean,
      hasSadPaths: hasSadPaths,
      hasFiniteSprints: hasFiniteSprints,
      detectedBloat: detectedBloat,
      missingSections: missing,
    );
  }
}

/// Evento de disparo detectado por el motor de auto-convocatoria.
class CouncilTriggerEvent {
  final CouncilTriggerType triggerType;
  final String triggerId;
  final String reason;
  final String severity; // CRITICAL, HIGH, MEDIUM, LOW
  final Map<String, dynamic> contextData;
  final String generatedPrompt;
  final String systemPrompt;
  final DateTime timestamp;

  CouncilTriggerEvent({
    required this.triggerType,
    required this.triggerId,
    required this.reason,
    required this.severity,
    required this.contextData,
    required this.generatedPrompt,
    required this.systemPrompt,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now().toUtc();

  Map<String, dynamic> toJson() => <String, dynamic>{
    'trigger_type': triggerType.id,
    'trigger_id': triggerId,
    'reason': reason,
    'severity': severity,
    'context_data': contextData,
    'generated_prompt': generatedPrompt,
    'system_prompt': systemPrompt,
    'timestamp': timestamp.toIso8601String(),
  };

  factory CouncilTriggerEvent.fromJson(Map<String, dynamic> json) {
    return CouncilTriggerEvent(
      triggerType: CouncilTriggerType.fromId(json['trigger_type'] as String),
      triggerId: json['trigger_id'] as String? ?? 'UNKNOWN_TRIGGER',
      reason: json['reason'] as String? ?? '',
      severity: json['severity'] as String? ?? 'MEDIUM',
      contextData:
          (json['context_data'] as Map<String, dynamic>?) ??
          <String, dynamic>{},
      generatedPrompt: json['generated_prompt'] as String? ?? '',
      systemPrompt: json['system_prompt'] as String? ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'] as String)
          : DateTime.now().toUtc(),
    );
  }
}

/// Resultado de una sesión de convocatoria desatendida.
class CouncilConvocationResult {
  final CouncilTriggerEvent event;
  final bool executed;
  final bool dryRun;
  final bool success;
  final String
  status; // SUCCESS, SUCCESS_RITUAL_NON_COMPLIANT, DRY_RUN, TIER_FLOOR_UNMET, OFFLINE_UNREACHABLE, FAILED
  final CouncilResponse? response;
  final String? errorMessage;
  final CouncilRitualReport? ritualReport;
  final DateTime timestamp;

  CouncilConvocationResult({
    required this.event,
    required this.executed,
    required this.dryRun,
    required this.success,
    required this.status,
    this.response,
    this.errorMessage,
    this.ritualReport,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now().toUtc();

  Map<String, dynamic> toJson() => <String, dynamic>{
    'event': event.toJson(),
    'executed': executed,
    'dry_run': dryRun,
    'success': success,
    'status': status,
    'error_message': errorMessage,
    'ritual_report': ritualReport?.toJson(),
    'response': response != null
        ? <String, dynamic>{
            'envelope_id': response!.envelopeId,
            'idempotency_key': response!.idempotencyKey,
            'model_name': response!.modelName,
            'model_tier': response!.modelTier,
            'provider': response!.provider,
            'text': response!.text,
            'input_tokens': response!.inputTokens,
            'output_tokens': response!.outputTokens,
            'latency_ms': response!.latencyMs,
            'cost_usd': response!.costUsd,
            'is_cached': response!.isCached,
          }
        : null,
    'timestamp': timestamp.toIso8601String(),
  };
}

/// Motor agnóstico de auto-convocatoria desatendida y auditoría de convergencia (§53, §53.b, §53.c).
/// Puede ejecutarse tanto en el Hub Central (`Smart`/`conext_core`) como en cualquier nodo satélite de la flota.
class CouncilAutonomousTriggerEngine {
  final String backlogPath;
  final String reportsDir;
  final String vetoPath;
  final String convocationLogPath;
  final String fleetJsonPath;
  final String sourceNode;

  CouncilAutonomousTriggerEngine({
    String? backlogPath,
    String? reportsDir,
    String? vetoPath,
    String? convocationLogPath,
    String? fleetJsonPath,
    this.sourceNode = 'smart',
  }) : backlogPath = backlogPath ?? 'backlog.json',
       reportsDir = reportsDir ?? 'vault/reports',
       vetoPath = vetoPath ?? 'vault/runtime/veto_records.json',
       convocationLogPath =
           convocationLogPath ?? 'vault/council/convocation_events.jsonl',
       fleetJsonPath = fleetJsonPath ?? 'vault/fleet.json';

  /// Carga el contexto físico de nodos y stack soberano desde vault/fleet.json (§53.b, §54).
  String _loadFleetContext() {
    final File fleetFile = File(fleetJsonPath);
    if (!fleetFile.existsSync()) {
      return '- Contexto de flota: fleet.json no disponible. Stack base: Pure Dart (axioma), SQLite WAL, CLI logix.';
    }
    try {
      final Map<String, dynamic> data =
          jsonDecode(fleetFile.readAsStringSync()) as Map<String, dynamic>;
      final Map<String, dynamic>? perimeter =
          data['cmmi5_appraisal_perimeter'] as Map<String, dynamic>?;
      final List<dynamic>? roster =
          perimeter?['active_nodes_roster'] as List<dynamic>?;
      final String nodesList = roster != null
          ? roster.join(', ')
          : 'conext_core, Smart, automa, ruedas, levita, bluemarket, pj-air, beatme';

      return '''
CONTEXTO DE FLOTA SOBERANA (SSSoT vault/fleet.json §53.b):
- Nodos Activos Ratificados ($nodesList).
- Tríada Central: conext_core (Platform/CLI logix), Smart (Strategy/Orquestador PWA), automa (Operations/Workers Docker).
- Satélites de Producto: ruedas (Autopartes), levita (Retail), bluemarket (Arbitraje digital), pj-air (Pastelería), beatme (Arbitraje deportivo).
- Stack Tecnológico Exclusivo: Pure Dart (packages/axioma), SQLite WAL local, CLI logix, colas offline-first (inference_queue.db).
- Veto Terminante: Prohibido sugerir Kubernetes, OpenTelemetry distributed tracing, HashiCorp Vault, Kafka o infraestructuras cloud corporativas ajenas.
''';
    } catch (_) {
      // INTENTIONAL: Fallback seguro ante error de lectura.
      return '- Contexto de flota: Error parseando fleet.json. Stack base: Pure Dart (axioma), SQLite WAL, CLI logix.';
    }
  }

  /// Evalúa todas las condiciones y genera la lista de eventos de disparo aplicables.
  Future<List<CouncilTriggerEvent>> evaluateAll() async {
    final List<CouncilTriggerEvent> events = <CouncilTriggerEvent>[];

    final CouncilTriggerEvent? emptyBacklog = await evaluateEmptyBacklog();
    if (emptyBacklog != null) events.add(emptyBacklog);

    final CouncilTriggerEvent? veto = await evaluateVetoArbitration();
    if (veto != null) events.add(veto);

    final CouncilTriggerEvent? ppmAnomaly = await evaluatePpmAnomaly();
    if (ppmAnomaly != null) events.add(ppmAnomaly);

    return events;
  }

  /// Evalúa la condición del backlog bajo la doctrina de Auditoría de Convergencia (Pass-and-Stop §53.c).
  /// Si todas las tareas y deudas están resueltas, la auditoría PASA y el sistema se detiene en reposo (HASTA ALLÍ LLEGA).
  /// Solo se dispara si existen deudas técnicas reales o defectos no resueltos.
  Future<CouncilTriggerEvent?> evaluateEmptyBacklog({
    bool allowSpeculative = false,
  }) async {
    final File file = File(backlogPath);
    if (!file.existsSync()) {
      throw CouncilTriggerException(
        'Archivo de backlog no encontrado: $backlogPath',
      );
    }

    final Map<String, dynamic> data;
    try {
      final String content = file.readAsStringSync();
      data = jsonDecode(content) as Map<String, dynamic>;
    } catch (e) {
      throw CouncilTriggerException(
        'Error parseando backlog.json: $e',
        details: e,
      );
    }

    final List<dynamic> sprints =
        (data['sprints'] as List<dynamic>?) ?? <dynamic>[];
    final String? activeSprint = data['active_sprint'] as String?;

    final List<Map<String, dynamic>> plannedSprints = sprints
        .whereType<Map<String, dynamic>>()
        .where((Map<String, dynamic> s) => s['status'] == 'PLANNED')
        .toList();

    // Si ya existen sprints planificados pendientes, no procede abrir nuevos.
    if (plannedSprints.isNotEmpty) {
      return null;
    }

    // AUDITORÍA DE CONVERGENCIA FÍSICA (Pass-and-Stop §53.c):
    // Inspección física de deudas técnicas reales no resueltas.
    final List<dynamic> technicalDebt =
        (data['technical_debt'] as List<dynamic>?) ?? <dynamic>[];
    final List<Map<String, dynamic>> unresolvedDebts = technicalDebt
        .whereType<Map<String, dynamic>>()
        .where((Map<String, dynamic> d) {
          final String status = (d['status'] as String? ?? '').toUpperCase();
          return status != 'RESOLVED' && status != 'CANCELLED';
        })
        .toList();

    // Inspección física de tareas de backlog no resueltas.
    final List<dynamic> tasks =
        (data['tasks'] as List<dynamic>?) ?? <dynamic>[];
    final List<Map<String, dynamic>> unresolvedTasks = tasks
        .whereType<Map<String, dynamic>>()
        .where((Map<String, dynamic> t) {
          final String status = (t['status'] as String? ?? '').toUpperCase();
          return status != 'RESOLVED' &&
              status != 'COMPLETED' &&
              status != 'CANCELLED';
        })
        .toList();

    // REGLA FUNDAMENTAL DE CAUSA RAÍZ (Pass-and-Stop):
    // Si no hay deudas técnicas abiertas ni tareas pendientes: LA AUDITORÍA PASA.
    // "Hasta allí llega": El sistema entra en Estado Estacionario / Modo Centinela y NO inventa sprints.
    if (unresolvedDebts.isEmpty && unresolvedTasks.isEmpty) {
      if (allowSpeculative) {
        throw const SpeculativeGenerationVetoException(
          'Veto a la Generación Especulativa (§53.c): Auditoría de convergencia superada con 0 deudas abiertas. Prohibido inventar sprints no requeridos.',
        );
      }
      // Auditoría superada con éxito: Cero disparadores. Hasta allí llega.
      return null;
    }

    // Si llegamos aquí, la auditoría DETECTÓ brechas o deudas reales no resueltas.
    final int completedCount = sprints
        .whereType<Map<String, dynamic>>()
        .where((Map<String, dynamic> s) => s['status'] == 'COMPLETED')
        .length;

    final String fleetSummary = _loadFleetContext();

    final List<String> debtSummaries = unresolvedDebts
        .map(
          (Map<String, dynamic> d) =>
              '- [${d['id']}] (${d['severity'] ?? 'NORMAL'}) ${d['title']}',
        )
        .toList();
    final List<String> taskSummaries = unresolvedTasks
        .map((Map<String, dynamic> t) => '- [${t['id']}] ${t['title']}')
        .toList();

    final String gapsFound = <String>[
      if (debtSummaries.isNotEmpty) ...<String>[
        'DEUDAS TÉCNICAS REALES PENDIENTES (${unresolvedDebts.length}):',
        ...debtSummaries,
      ],
      if (taskSummaries.isNotEmpty) ...<String>[
        'TAREAS PENDIENTES NO RESUELTAS (${unresolvedTasks.length}):',
        ...taskSummaries,
      ],
    ].join('\n');

    final String prompt =
        '''
CONVOCATORIA AUDITADA POR DEUDA TÉCNICA O DEFECTO REAL PENDIENTE (§51, §53, §53.b, §53.c):
La auditoría de convergencia detectó brechas físicas reales en el backlog:
$gapsFound

Métricas de Flota:
- Total sprints históricos registrados: ${sprints.length}
- Sprints completados: $completedCount
- Sprint actualmente activo: ${activeSprint ?? 'NINGUNO'}
- Nodo emisor: $sourceNode

$fleetSummary

RITUAL CONSTITUCIONAL OBLIGATORIO DEL CONSEJO (§53.b, §53.c):
El dictamen DEBE estructurarse respondiendo punto a punto a los 4 cuadrantes constitucionales:
1. [GAPS Y REALIDAD FÍSICA EN DISCO]: Diagnóstico exclusivo de las deudas reales detectadas ($gapsFound). Prohibido inventar trabajo ajeno a estos hallazgos.
2. [FILTRO LEAN (SOBREINGENIERÍA VS EFICIENCIA)]: Erradicación estricta de sobre-procesamiento e inventario inútil (Muda). Veto a tecnologías foráneas. Máxima simplicidad Pure Dart y SQLite WAL.
3. [SAD PATHS Y GATES FÍSICOS (§4, §6)]: Cada tarea DEBE definir aserciones negativas tipadas (throwsA) y compuertas medibles (\$?).
4. [PLAN DE SPRINTS FINITOS (§12.b, §44, §51)]: Desglose acotado a resolver únicamente los hallazgos identificados (4 a 6 tareas por sprint, límite 5 archivos por tarea).
''';

    return CouncilTriggerEvent(
      triggerType: CouncilTriggerType.emptyBacklog,
      triggerId: CouncilTriggerType.emptyBacklog.id,
      reason:
          'Auditoría de backlog detectó ${unresolvedDebts.length} deuda(s) y ${unresolvedTasks.length} tarea(s) pendiente(s).',
      severity: 'HIGH',
      contextData: <String, dynamic>{
        'active_sprint': activeSprint,
        'total_sprints': sprints.length,
        'planned_count': 0,
        'completed_count': completedCount,
        'unresolved_debts_count': unresolvedDebts.length,
        'unresolved_tasks_count': unresolvedTasks.length,
        'unresolved_debts': unresolvedDebts,
        'unresolved_tasks': unresolvedTasks,
      },
      generatedPrompt: prompt,
      systemPrompt: kCouncilSystemPrompt,
    );
  }

  /// Ejecuta una Auditoría de Convergencia completa de la flota (§53.c).
  /// Si no hay deudas abiertas, vetos ni anomalías SPC, la auditoría PASA
  /// y el sistema se detiene en reposo (HASTA ALLÍ LLEGA).
  Future<Map<String, dynamic>> runConvergenceAudit() async {
    final CouncilTriggerEvent? backlogGaps = await evaluateEmptyBacklog();
    final CouncilTriggerEvent? vetos = await evaluateVetoArbitration();
    final CouncilTriggerEvent? anomalies = await evaluatePpmAnomaly();

    final bool isConverged =
        backlogGaps == null && vetos == null && anomalies == null;

    return <String, dynamic>{
      'status': isConverged ? 'STEADY_STATE_PASS' : 'FINDINGS_DETECTED',
      'is_converged': isConverged,
      'operating_mode': isConverged ? 'MODO_CENTINELA' : 'REMEDIATION_REQUIRED',
      'backlog_findings': backlogGaps != null,
      'veto_findings': vetos != null,
      'spc_findings': anomalies != null,
      'summary': isConverged
          ? 'Auditoría de convergencia superada: 0 deudas abiertas, 0 vetos, 0 anomalías. Hasta allí llega (§53.c).'
          : 'Se detectaron hallazgos físicos que requieren intervención.',
      'timestamp': DateTime.now().toUtc().toIso8601String(),
    };
  }

  /// Evalúa si existen bloqueos o vetos activos que requieran arbitraje (VETO_ARBITRATION_TRIGGER).
  Future<CouncilTriggerEvent?> evaluateVetoArbitration() async {
    final File file = File(vetoPath);
    if (!file.existsSync()) {
      return null;
    }

    final dynamic data;
    try {
      final String content = file.readAsStringSync();
      if (content.trim().isEmpty) return null;
      data = jsonDecode(content);
    } catch (e) {
      throw CouncilTriggerException(
        'Error parseando archivo de vetos ($vetoPath): $e',
        details: e,
      );
    }

    final List<Map<String, dynamic>> activeVetos = <Map<String, dynamic>>[];
    if (data is List) {
      for (final dynamic item in data) {
        if (item is Map<String, dynamic> &&
            (item['active'] == true ||
                item['is_active'] == true ||
                item['status'] == 'ACTIVE')) {
          activeVetos.add(item);
        }
      }
    } else if (data is Map<String, dynamic>) {
      if (data['active'] == true ||
          data['is_active'] == true ||
          data['status'] == 'ACTIVE') {
        activeVetos.add(data);
      }
      final List<dynamic>? list =
          data['vetos'] as List<dynamic>? ??
          data['records'] as List<dynamic>? ??
          data['active_vetos'] as List<dynamic>?;
      if (list != null) {
        for (final dynamic item in list) {
          if (item is Map<String, dynamic> &&
              (item['active'] == true ||
                  item['is_active'] == true ||
                  item['status'] == 'ACTIVE')) {
            activeVetos.add(item);
          }
        }
      }
    }

    if (activeVetos.isNotEmpty) {
      final String fleetSummary = _loadFleetContext();

      final String prompt =
          '''
CONVOCATORIA AUTÓNOMA POR VETO ACTIVO (VETO_ARBITRATION_TRIGGER §4, §53, §53.b, §54.5):
Se han detectado ${activeVetos.length} veto(s) activo(s) no resuelto(s) en la gobernanza de la flota.
Detalle de vetos:
${jsonEncode(activeVetos)}

$fleetSummary

RITUAL CONSTITUCIONAL OBLIGATORIO DEL CONSEJO (§53.b):
El arbitraje DEBE estructurarse respondiendo punto a punto a los 4 cuadrantes constitucionales:
1. [GAPS Y REALIDAD FÍSICA EN DISCO]: Diagnóstico ontológico de la discrepancia que detonó el veto (§54).
2. [FILTRO LEAN (SOBREINGENIERÍA VS EFICIENCIA)]: Veto a parches sintomáticos o sobreingeniería. Resolución de causa raíz con mínima complejidad.
3. [SAD PATHS Y GATES FÍSICOS (§4, §6)]: Condiciones de falla y compuertas mecánicas verificables con exit code (\$?).
4. [RESOLUCIÓN Y ACCIONES ATÓMICAS (§12.b, §51)]: Dictamen vinculante y tareas de remediación inmediatas (<=5 archivos por tarea).
''';

      return CouncilTriggerEvent(
        triggerType: CouncilTriggerType.vetoArbitration,
        triggerId: CouncilTriggerType.vetoArbitration.id,
        reason:
            'Se detectaron ${activeVetos.length} veto(s) de gobernanza activo(s).',
        severity: 'CRITICAL',
        contextData: <String, dynamic>{
          'active_veto_count': activeVetos.length,
          'vetos': activeVetos,
        },
        generatedPrompt: prompt,
        systemPrompt: kCouncilSystemPrompt,
      );
    }

    return null;
  }

  /// Evalúa anomalías en el proceso estadístico SPC/PPM (PPM_ANOMALY_TRIGGER).
  Future<CouncilTriggerEvent?> evaluatePpmAnomaly() async {
    final File spcFile = File(
      p.join(reportsDir, 'fleet_spc_consolidated_report.json'),
    );
    if (!spcFile.existsSync()) {
      return null;
    }

    final Map<String, dynamic> data;
    try {
      final String content = spcFile.readAsStringSync();
      data = jsonDecode(content) as Map<String, dynamic>;
    } catch (e) {
      throw CouncilTriggerException(
        'Error parseando reporte consolidado SPC (${spcFile.path}): $e',
        details: e,
      );
    }

    final Map<String, dynamic> summary =
        (data['fleet_summary'] as Map<String, dynamic>?) ?? <String, dynamic>{};
    final List<dynamic> anomalies =
        (summary['anomalies'] as List<dynamic>?) ??
        (data['anomalies'] as List<dynamic>?) ??
        <dynamic>[];

    final double? firstPassSuccess =
        (summary['first_pass_success_rate'] as num?)?.toDouble() ??
        (summary['fps_rate'] as num?)?.toDouble();

    final List<String> detectedReasons = <String>[];
    if (anomalies.isNotEmpty) {
      detectedReasons.add('${anomalies.length} anomalía(s) SPC registradas.');
    }
    if (firstPassSuccess != null && firstPassSuccess < 0.70) {
      detectedReasons.add(
        'First-Pass Success (${(firstPassSuccess * 100).toStringAsFixed(1)}%) por debajo del umbral de control (70.0%).',
      );
    }

    if (detectedReasons.isNotEmpty) {
      final String fleetSummary = _loadFleetContext();

      final String prompt =
          '''
CONVOCATORIA AUTÓNOMA POR ANOMALÍA PPM/SPC (PPM_ANOMALY_TRIGGER §45, §46, §53, §53.b):
Se ha detectado desviación estadística fuera de control en la calidad de la flota:
${detectedReasons.join('\n')}

Métricas Consolidadas:
- First-Pass Success: ${firstPassSuccess != null ? '${(firstPassSuccess * 100).toStringAsFixed(1)}%' : 'N/A'}
- Anomalías detectadas: ${anomalies.length}
- Total registros auditados: ${summary['total_records'] ?? summary['records_audited'] ?? 'N/A'}

$fleetSummary

RITUAL CONSTITUCIONAL OBLIGATORIO DEL CONSEJO (§53.b):
El dictamen CAR DEBE estructurarse respondiendo punto a punto a los 4 cuadrantes constitucionales:
1. [GAPS Y REALIDAD FÍSICA EN DISCO]: Diagnóstico causal (Causal Analysis and Resolution §46) sobre la desviación observada.
2. [FILTRO LEAN (SOBREINGENIERÍA VS EFICIENCIA)]: Mitigación simple y directa; veto a reglas complejas o linters sobredimensionados que generen falsos positivos.
3. [SAD PATHS Y GATES FÍSICOS (§4, §6)]: Definición de tests canarios y aserciones de falla tipadas (throwsA).
4. [PLAN DE RESOLUCIÓN CAUSAL ATÓMICO (§12.b, §44)]: Tareas atómicas de calibración o contención inmediata.
''';

      return CouncilTriggerEvent(
        triggerType: CouncilTriggerType.ppmAnomaly,
        triggerId: CouncilTriggerType.ppmAnomaly.id,
        reason: detectedReasons.join('; '),
        severity: 'HIGH',
        contextData: <String, dynamic>{
          'anomalies_count': anomalies.length,
          'fps_rate': firstPassSuccess,
          'reasons': detectedReasons,
        },
        generatedPrompt: prompt,
        systemPrompt: kCouncilSystemPrompt,
      );
    }

    return null;
  }

  /// Ejecuta la auto-convocatoria para un evento de disparo específico.
  Future<CouncilConvocationResult> executeConvocation(
    CouncilTriggerEvent event, {
    FleetCouncilClient? client,
    bool dryRun = false,
  }) async {
    // Veto a la Generación Especulativa (§53.c):
    // Prohibido convocar al Consejo para sintetizar sprints si no existen deudas o tareas reales comprobables en disco.
    if (event.triggerType == CouncilTriggerType.emptyBacklog &&
        (event.contextData['unresolved_debts_count'] == 0 ||
            event.contextData['unresolved_debts_count'] == null) &&
        (event.contextData['unresolved_tasks_count'] == 0 ||
            event.contextData['unresolved_tasks_count'] == null) &&
        event.contextData['force'] != true &&
        event.contextData['test'] != true) {
      throw const SpeculativeGenerationVetoException(
        'VETO_SPECULATIVE_GENERATION (§53.c): Se prohíbe convocar al Consejo para sintetizar sprints sin deudas o hallazgos físicos comprobables en disco.',
      );
    }

    if (dryRun) {
      final CouncilConvocationResult result = CouncilConvocationResult(
        event: event,
        executed: false,
        dryRun: true,
        success: true,
        status: 'DRY_RUN',
      );
      _logConvocationEvent(result);
      return result;
    }

    final FleetCouncilClient activeClient = client ?? FleetCouncilClient();
    final CouncilRequest request = CouncilRequest(
      sourceNode: sourceNode,
      prompt: event.generatedPrompt,
      system: event.systemPrompt,
      idempotencyKey:
          'IDEM-AUTONOMOUS-${event.triggerId}-${DateTime.now().toUtc().millisecondsSinceEpoch}',
    );

    try {
      final CouncilResponse response = await activeClient.consult(request);
      final CouncilRitualReport ritualReport = CouncilRitualValidator.validate(
        response.text,
      );
      final String finalStatus = ritualReport.isCompliant
          ? 'SUCCESS'
          : 'SUCCESS_RITUAL_NON_COMPLIANT';
      final String? warnMsg = ritualReport.isCompliant
          ? null
          : 'Advertencia: El dictamen omite secciones obligatorias (${ritualReport.missingSections.join(', ')})'
                '${ritualReport.detectedBloat.isNotEmpty ? ' o contiene sobreingeniería vetada (${ritualReport.detectedBloat.join(', ')})' : ''}';

      final CouncilConvocationResult result = CouncilConvocationResult(
        event: event,
        executed: true,
        dryRun: false,
        success: true,
        status: finalStatus,
        response: response,
        errorMessage: warnMsg,
        ritualReport: ritualReport,
      );
      _logConvocationEvent(result);
      return result;
    } on TierFloorUnmetException catch (e) {
      // Manejo Offline-First (§45): fail-closed seguro, retenido en cola
      final CouncilConvocationResult result = CouncilConvocationResult(
        event: event,
        executed: true,
        dryRun: false,
        success: false,
        status: 'TIER_FLOOR_UNMET',
        errorMessage:
            'Piso Cognitivo Tier-2 temporalmente saturado: ${e.message}',
      );
      _logConvocationEvent(result);
      return result;
    } on CouncilUnreachableException catch (e) {
      // Manejo Offline-First (§45): Ingress no alcanzable
      final CouncilConvocationResult result = CouncilConvocationResult(
        event: event,
        executed: true,
        dryRun: false,
        success: false,
        status: 'OFFLINE_UNREACHABLE',
        errorMessage:
            'Ingress inalcanzable (Soberanía Local activada): ${e.message}',
      );
      _logConvocationEvent(result);
      return result;
    } catch (e) {
      final CouncilConvocationResult result = CouncilConvocationResult(
        event: event,
        executed: true,
        dryRun: false,
        success: false,
        status: 'FAILED',
        errorMessage: 'Fallo general en convocatoria: $e',
      );
      _logConvocationEvent(result);
      return result;
    } finally {
      if (client == null) {
        activeClient.close();
      }
    }
  }

  /// Ejecuta todos los disparadores pendientes encontrados.
  Future<List<CouncilConvocationResult>> executeAllPendingTriggers({
    FleetCouncilClient? client,
    bool dryRun = false,
  }) async {
    final List<CouncilTriggerEvent> pending = await evaluateAll();
    final List<CouncilConvocationResult> results = <CouncilConvocationResult>[];

    for (final CouncilTriggerEvent event in pending) {
      final CouncilConvocationResult res = await executeConvocation(
        event,
        client: client,
        dryRun: dryRun,
      );
      results.add(res);
    }

    return results;
  }

  /// Persiste el registro atómico de la convocatoria desatendida.
  void _logConvocationEvent(CouncilConvocationResult result) {
    try {
      final File logFile = File(convocationLogPath);
      if (!logFile.parent.existsSync()) {
        logFile.parent.createSync(recursive: true);
      }
      logFile.writeAsStringSync(
        '${jsonEncode(result.toJson())}\n',
        mode: FileMode.append,
        flush: true,
      );
    } catch (_) {
      // INTENTIONAL: Falla en logging no bloquea la ejecución operacional.
    }
  }
}
