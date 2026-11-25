// packages/axioma/lib/src/governance/rules_budget_validator.dart
// (§4, §6, §39, §48, §50, §54.7, §55)
//
// Validador determinista Pure Dart de presupuesto de reglas y detección de duplicación doctrinal.
library;

import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as p;

/// Excepción tipada para fallos de presupuesto, frontmatter o duplicación doctrinal (§6, §50).
class RulesBudgetException implements Exception {
  final String message;
  final String filePath;
  final int? byteSize;
  final int? byteCeiling;
  final String? ruleType;

  const RulesBudgetException(
    this.message, {
    required this.filePath,
    this.byteSize,
    this.byteCeiling,
    this.ruleType,
  });

  @override
  String toString() =>
      'RulesBudgetException: $message (File: $filePath, Size: $byteSize B, Limit: $byteCeiling B, Type: $ruleType)';
}

/// Registro estructurado de violación de presupuesto de reglas.
class RulesBudgetViolation {
  final String message;
  final String filePath;
  final int? byteSize;
  final int? byteCeiling;
  final String? ruleType;

  const RulesBudgetViolation({
    required this.message,
    required this.filePath,
    this.byteSize,
    this.byteCeiling,
    this.ruleType,
  });
}

/// Reporte inmutable de auditoría de presupuesto de reglas (§50).
class RulesBudgetReport {
  final bool isClean;
  final List<RulesBudgetViolation> violations;
  final Map<String, int> evaluatedFiles;

  const RulesBudgetReport({
    required this.isClean,
    required this.violations,
    required this.evaluatedFiles,
  });
}

/// Validador determinista Pure Dart de presupuesto de reglas (§39, §50, §55).
class RulesBudgetValidator {
  static const int kMaxRuleFileBytes = 24000;
  static const int kMaxAlwaysOnBytes = 2048;

  const RulesBudgetValidator();

  /// Valida una regla modular individual en .agents/rules/*.md
  void validateModularRule(File ruleFile, {String? contentOverride}) {
    final String content = contentOverride ?? ruleFile.readAsStringSync();
    final List<int> bytes = utf8.encode(content);
    final String filename = p.basename(ruleFile.path);

    // 1. Validar límite general por archivo (<=24,000 B)
    if (bytes.length > kMaxRuleFileBytes) {
      throw RulesBudgetException(
        'El archivo de regla excede el techo máximo permitido de $kMaxRuleFileBytes bytes (${bytes.length} bytes).',
        filePath: ruleFile.path,
        byteSize: bytes.length,
        byteCeiling: kMaxRuleFileBytes,
        ruleType: 'modular_rule',
      );
    }

    // 2. Validar Frontmatter YAML
    final RegExp yamlRegExp = RegExp(
      r'^---\r?\n([\s\S]*?)\r?\n---',
      multiLine: false,
    );
    final RegExpMatch? match = yamlRegExp.firstMatch(content);
    if (match == null) {
      throw RulesBudgetException(
        'Regla modular $filename carece de frontmatter YAML válido (delimitado por ---).',
        filePath: ruleFile.path,
        ruleType: 'modular_rule',
      );
    }

    final String yamlBlock = match.group(1) ?? '';
    final RegExp triggerRegExp = RegExp(
      r'(?:trigger|mode|type|alwaysApply)\s*:\s*(\w+)',
      caseSensitive: false,
    );
    final RegExpMatch? triggerMatch = triggerRegExp.firstMatch(yamlBlock);
    if (triggerMatch == null) {
      throw RulesBudgetException(
        'Regla modular $filename debe declarar trigger (always_on o model_decision) en frontmatter.',
        filePath: ruleFile.path,
        ruleType: 'modular_rule',
      );
    }

    final String triggerRaw = triggerMatch.group(1)!.toLowerCase();
    final bool isAlwaysOn = triggerRaw == 'always_on' || triggerRaw == 'true';
    final bool isModelDecision =
        triggerRaw == 'model_decision' ||
        triggerRaw == 'false' ||
        triggerRaw == 'contextual';

    if (!isAlwaysOn && !isModelDecision) {
      throw RulesBudgetException(
        'Trigger inválido "$triggerRaw" en $filename. Valores permitidos: always_on, model_decision.',
        filePath: ruleFile.path,
        ruleType: 'modular_rule',
      );
    }

    // 3. Validar techo para always_on (<=2,048 B)
    if (isAlwaysOn && bytes.length > kMaxAlwaysOnBytes) {
      throw RulesBudgetException(
        'Regla always_on $filename excede el presupuesto de $kMaxAlwaysOnBytes bytes (${bytes.length} bytes).',
        filePath: ruleFile.path,
        byteSize: bytes.length,
        byteCeiling: kMaxAlwaysOnBytes,
        ruleType: 'always_on',
      );
    }
  }

  /// Detecta duplicación masiva de doctrina universal entre GEMINI.md y AGENTS.md
  void checkDoctrineDuplication(String workspaceRoot) {
    final File geminiFile = File(p.join(workspaceRoot, 'GEMINI.md'));
    File agentsFile = File(p.join(workspaceRoot, '.agents', 'AGENTS.md'));
    if (!agentsFile.existsSync()) {
      agentsFile = File(p.join(workspaceRoot, 'AGENTS.md'));
    }

    if (!geminiFile.existsSync() || !agentsFile.existsSync()) return;

    final String geminiContent = geminiFile.readAsStringSync();
    final String agentsContent = agentsFile.readAsStringSync();

    const List<String> universalMarkers = <String>[
      '1. **Protocolo de Veracidad Física',
      '4. **Tolerancia Cero a Mocks',
      '8. **Principio del Circuito Cerrado',
      '26. **Soberanía Offline-First',
      '27. **Mandato Ineludible de Turno 1',
      '30. **Directiva de Resolución Ejecutiva',
    ];

    int markersInGemini = 0;
    int markersInAgents = 0;
    for (final String marker in universalMarkers) {
      if (geminiContent.contains(marker)) markersInGemini++;
      if (agentsContent.contains(marker)) markersInAgents++;
    }

    if (markersInGemini >= 4 && markersInAgents >= 4) {
      throw RulesBudgetException(
        'Duplicación doctrinal detectada: GEMINI.md y AGENTS.md contienen simultáneamente las reglas completas de kDoctrineUniversal. Use un stub ligero en satélites o reglas modulares.',
        filePath: p.join(workspaceRoot, 'GEMINI.md'),
        ruleType: 'doctrinal_duplication',
      );
    }
  }

  /// Valida todo el workspace y genera un reporte estructurado
  RulesBudgetReport validateWorkspace(
    String workspaceRoot, {
    bool checkGeminiBudget = true,
  }) {
    final List<RulesBudgetViolation> violations = <RulesBudgetViolation>[];
    final Map<String, int> evaluated = <String, int>{};

    // 1. Validar .agents/rules/*.md
    final Directory rulesDir = Directory(
      p.join(workspaceRoot, '.agents', 'rules'),
    );
    if (rulesDir.existsSync()) {
      for (final FileSystemEntity entity in rulesDir.listSync()) {
        if (entity is File && entity.path.endsWith('.md')) {
          try {
            validateModularRule(entity);
            evaluated[entity.path] = entity.lengthSync();
          } on RulesBudgetException catch (e) {
            violations.add(
              RulesBudgetViolation(
                message: e.message,
                filePath: e.filePath,
                byteSize: e.byteSize,
                byteCeiling: e.byteCeiling,
                ruleType: e.ruleType,
              ),
            );
          } catch (e) {
            violations.add(
              RulesBudgetViolation(
                message: e.toString(),
                filePath: entity.path,
              ),
            );
          }
        }
      }
    }

    // 2. Validar tamaño de GEMINI.md raíz si checkGeminiBudget está activo
    if (checkGeminiBudget) {
      final File geminiFile = File(p.join(workspaceRoot, 'GEMINI.md'));
      if (geminiFile.existsSync()) {
        final int bytes = geminiFile.lengthSync();
        evaluated[geminiFile.path] = bytes;
        if (bytes > kMaxRuleFileBytes) {
          violations.add(
            RulesBudgetViolation(
              message:
                  'GEMINI.md excede el presupuesto máximo de $kMaxRuleFileBytes bytes ($bytes bytes).',
              filePath: geminiFile.path,
              byteSize: bytes,
              byteCeiling: kMaxRuleFileBytes,
              ruleType: 'gemini_md',
            ),
          );
        }
      }
    }

    // 3. Comprobar duplicación entre GEMINI.md y AGENTS.md
    try {
      checkDoctrineDuplication(workspaceRoot);
    } on RulesBudgetException catch (e) {
      violations.add(
        RulesBudgetViolation(
          message: e.message,
          filePath: e.filePath,
          ruleType: e.ruleType,
        ),
      );
    }

    return RulesBudgetReport(
      isClean: violations.isEmpty,
      violations: violations,
      evaluatedFiles: evaluated,
    );
  }
}
