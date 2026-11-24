#!/usr/bin/env dart

/// safe_task_barrier.dart — Barrera de Contención y Parser Léxico Formal (§2, §4, §6, §39, §55).
library;

import 'dart:convert';
import 'dart:io';

import 'package:smart/src/security/lexical_command_parser.dart';

void main(List<String> args) {
  String command = '';
  String? overrideSignature;
  String? bunkerPath;
  String? sqlFile;
  bool strict = false;
  bool asJson = false;
  bool auditSql = false;

  for (final String arg in args) {
    if (arg.startsWith('--command=')) {
      command = arg.substring(10);
    } else if (arg.startsWith('--override=')) {
      overrideSignature = arg.substring(11);
    } else if (arg.startsWith('--override-authorization=')) {
      overrideSignature = arg.substring(25);
    } else if (arg.startsWith('--bunker=')) {
      bunkerPath = arg.substring(9);
    } else if (arg.startsWith('--file=')) {
      sqlFile = arg.substring(7);
    } else if (arg == '--strict') {
      strict = true;
    } else if (arg == '--json') {
      asJson = true;
    } else if (arg == '--audit-sql') {
      auditSql = true;
    }
  }

  final LexicalCommandParser parser = LexicalCommandParser(
    defaultBunkerRoot: bunkerPath ?? '/home/opc/code/Smart',
  );

  if (auditSql && sqlFile != null) {
    _handleSqlAudit(sqlFile, overrideSignature, asJson);
    return;
  }

  if (command.isEmpty) {
    if (asJson) {
      stdout.writeln(
        jsonEncode(<String, dynamic>{
          'isAllowed': false,
          'exitCode': 1,
          'riskLevel': 'CATASTROPHIC',
          'findings': <String>[
            'No command provided to evaluate (--command=...)',
          ],
        }),
      );
    } else {
      stderr.writeln(
        '❌ [SAFE-TASK-ERROR] No se proveyó ningún comando (--command=...).',
      );
    }
    exit(1);
  }

  final CommandEvaluationResult result = parser.evaluate(
    command,
    overrideSignature: overrideSignature,
    bunkerRoot: bunkerPath,
    strict: strict,
  );

  if (asJson) {
    stdout.writeln(jsonEncode(result.toJson()));
    exit(result.exitCode);
  }

  if (result.isAllowed) {
    if (result.overrideAuthorized) {
      stdout.writeln(
        '⚠️ [SAFE-TASK-OVERRIDE] Operación autorizada por PO bajo firma válida: ${result.overrideReason}',
      );
    } else {
      stdout.writeln(
        '✅ [SAFE-TASK-PASS] Comando evaluado y seguro conforme a gobernanza (§55).',
      );
    }
    exit(0);
  } else {
    for (final String finding in result.findings) {
      stderr.writeln('❌ [SAFE-TASK-VETO] $finding');
    }
    exit(result.exitCode);
  }
}

void _handleSqlAudit(String filePath, String? overrideSignature, bool asJson) {
  final File file = File(filePath);
  if (!file.existsSync()) {
    if (asJson) {
      stdout.writeln(
        jsonEncode(<String, dynamic>{
          'isAllowed': false,
          'exitCode': 1,
          'findings': <String>['SQL file not found: $filePath'],
        }),
      );
    } else {
      stderr.writeln('❌ [SAFE-TASK-SQL-ERROR] Archivo no existe: $filePath');
    }
    exit(1);
  }

  final String content = file.readAsStringSync().toUpperCase();
  const List<String> forbidden = <String>[
    'DROP TABLE',
    'DROP DATABASE',
    'TRUNCATE',
  ];

  final List<String> detected = <String>[];
  for (final String pattern in forbidden) {
    if (content.contains(pattern)) {
      detected.add(pattern);
    }
  }

  final bool hasValidOverride =
      overrideSignature != null &&
      overrideSignature.startsWith('OVERRIDE_AUTHORIZATION:') &&
      overrideSignature
          .replaceFirst('OVERRIDE_AUTHORIZATION:', '')
          .trim()
          .isNotEmpty;

  if (detected.isNotEmpty && !hasValidOverride) {
    if (asJson) {
      stdout.writeln(
        jsonEncode(<String, dynamic>{
          'isAllowed': false,
          'exitCode': 1,
          'findings': detected
              .map((String p) => 'Destructive DDL detected: $p')
              .toList(),
        }),
      );
    } else {
      for (final String d in detected) {
        stderr.writeln(
          '❌ [SAFE-TASK-SQL-VETO] Sentencia DDL destructiva detectada ($d) sin override.',
        );
      }
    }
    exit(1);
  }

  if (asJson) {
    stdout.writeln(
      jsonEncode(<String, dynamic>{
        'isAllowed': true,
        'exitCode': 0,
        'findings': detected.isNotEmpty
            ? <String>['Override applied']
            : <String>[],
      }),
    );
  } else {
    stdout.writeln('✅ [SAFE-TASK-SQL-PASS] Script SQL auditado y conforme.');
  }
  exit(0);
}
