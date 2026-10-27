import 'package:axioma/src/car/ast_signature_extractor.dart';

/// Representa una infracción detectada por el motor CAR.
class CarViolation {
  final String ruleId;
  final String filePath;
  final int line;
  final String matchedSnippet;
  final CarRuleSeverity severity;
  final String message;

  const CarViolation({
    required this.ruleId,
    required this.filePath,
    required this.line,
    required this.matchedSnippet,
    required this.severity,
    required this.message,
  });

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'rule_id': ruleId,
      'file': filePath,
      'line': line,
      'snippet': matchedSnippet,
      'severity': severity.name,
      'message': message,
    };
  }

  @override
  String toString() =>
      '[$ruleId | ${severity.name.toUpperCase()}] $filePath:$line - $message ("$matchedSnippet")';
}

/// Registro de auditoría forense para directivas de supresión autorizadas.
class AuditSuppressionLog {
  final String ruleId;
  final String filePath;
  final int line;
  final String reason;
  final DateTime timestamp;

  const AuditSuppressionLog({
    required this.ruleId,
    required this.filePath,
    required this.line,
    required this.reason,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'rule_id': ruleId,
      'file': filePath,
      'line': line,
      'reason': reason,
      'timestamp': timestamp.toIso8601String(),
    };
  }
}

/// Resultado de un escaneo de código bajo las reglas CAR.
class CarScanResult {
  final List<CarViolation> violations;
  final List<AuditSuppressionLog> suppressions;

  const CarScanResult({required this.violations, required this.suppressions});

  bool get isClean => violations.isEmpty;
}

/// Resultado de la evaluación de promoción de una regla a severidad ERROR.
class CarPromotionEvaluation {
  final String ruleId;
  final int corpusUnitsScanned;
  final int corpusMatchesCount;
  final double falsePositiveRate;
  final bool promotionVetoed;
  final bool promotedToError;
  final String? refinementTicket;

  const CarPromotionEvaluation({
    required this.ruleId,
    required this.corpusUnitsScanned,
    required this.corpusMatchesCount,
    required this.falsePositiveRate,
    required this.promotionVetoed,
    required this.promotedToError,
    this.refinementTicket,
  });

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'rule_id': ruleId,
      'units_scanned': corpusUnitsScanned,
      'matches': corpusMatchesCount,
      'false_positive_rate': double.parse(falsePositiveRate.toStringAsFixed(4)),
      'promotion_vetoed': promotionVetoed,
      'promoted_to_error': promotedToError,
      'refinement_ticket': refinementTicket,
    };
  }
}

/// Motor de Linter CAR y Evaluación de Inmunización CMMI Nivel 5.
class CarEngine {
  const CarEngine();

  /// Expresión regular para capturar la directiva de supresión auditable:
  /// `// axioma-ignore: <ruleId> reason: <justificación>`
  static final RegExp _suppressionRegex = RegExp(
    r'//\s*axioma-ignore\s*:\s*([A-Za-z0-9_-]+)\s+reason\s*:\s*(.+)$',
  );

  /// Escanea un código fuente contra una lista de reglas preventivas.
  CarScanResult scanSource({
    required String sourceCode,
    required String filePath,
    required List<AstPatternRule> rules,
  }) {
    final List<String> lines = sourceCode.split('\n');
    final List<CarViolation> violations = <CarViolation>[];
    final List<AuditSuppressionLog> suppressions = <AuditSuppressionLog>[];

    for (int i = 0; i < lines.length; i++) {
      final String lineContent = lines[i];
      final int lineNumber = i + 1;

      // Buscar si la línea actual o la anterior contienen una supresión auditable
      String? suppressedRule;
      String? suppressionReason;

      final RegExpMatch? currentMatch = _suppressionRegex.firstMatch(
        lineContent,
      );
      if (currentMatch != null) {
        suppressedRule = currentMatch.group(1)?.trim();
        suppressionReason = currentMatch.group(2)?.trim();
      } else if (i > 0) {
        final RegExpMatch? prevMatch = _suppressionRegex.firstMatch(
          lines[i - 1],
        );
        if (prevMatch != null) {
          suppressedRule = prevMatch.group(1)?.trim();
          suppressionReason = prevMatch.group(2)?.trim();
        }
      }

      for (final AstPatternRule rule in rules) {
        final RegExp patternRegex = RegExp(rule.pattern);
        if (patternRegex.hasMatch(lineContent)) {
          // Evaluar si existe supresión auditable legítima con motivo no vacío
          if (suppressedRule == rule.id &&
              suppressionReason != null &&
              suppressionReason.isNotEmpty) {
            suppressions.add(
              AuditSuppressionLog(
                ruleId: rule.id,
                filePath: filePath,
                line: lineNumber,
                reason: suppressionReason,
                timestamp: DateTime.now(),
              ),
            );
          } else {
            // Infracción activa no suprimida
            violations.add(
              CarViolation(
                ruleId: rule.id,
                filePath: filePath,
                line: lineNumber,
                matchedSnippet: lineContent.trim(),
                severity: rule.severity,
                message: rule.description,
              ),
            );
          }
        }
      }
    }

    return CarScanResult(violations: violations, suppressions: suppressions);
  }

  /// Evalúa si una regla preventiva en observación puede ser promovida a severidad ERROR.
  ///
  /// Si la regla se dispara en más del 1.0% (0.01) del corpus histórico de código,
  /// la promoción es vetada para prevenir parálisis y falsos positivos en CI.
  CarPromotionEvaluation evaluatePromotion({
    required AstPatternRule rule,
    required List<String> historicalCorpus,
    double thresholdRate = 0.01,
  }) {
    if (historicalCorpus.isEmpty) {
      return CarPromotionEvaluation(
        ruleId: rule.id,
        corpusUnitsScanned: 0,
        corpusMatchesCount: 0,
        falsePositiveRate: 0.0,
        promotionVetoed: false,
        promotedToError: true,
      );
    }

    final RegExp regex = RegExp(rule.pattern);
    int matches = 0;

    for (final String source in historicalCorpus) {
      if (regex.hasMatch(source)) {
        matches++;
      }
    }

    final double falsePositiveRate = matches / historicalCorpus.length;
    final bool isVetoed = falsePositiveRate > thresholdRate;

    String? refinementTicket;
    if (isVetoed) {
      final String pct = (falsePositiveRate * 100).toStringAsFixed(2);
      refinementTicket =
          'TICKET-CAR-REFINEMENT: Regla ${rule.id} excede umbral de falsos positivos ($pct% > ${(thresholdRate * 100).toStringAsFixed(1)}%). Promoción a ERROR vetada. Requiere revisión de arquitectura.';
    }

    return CarPromotionEvaluation(
      ruleId: rule.id,
      corpusUnitsScanned: historicalCorpus.length,
      corpusMatchesCount: matches,
      falsePositiveRate: falsePositiveRate,
      promotionVetoed: isVetoed,
      promotedToError: !isVetoed,
      refinementTicket: refinementTicket,
    );
  }
}
