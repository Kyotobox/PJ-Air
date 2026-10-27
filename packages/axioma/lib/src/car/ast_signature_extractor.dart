import 'dart:convert';
import 'dart:io';

/// Severidad escalonada de la regla preventiva CAR.
enum CarRuleSeverity { warn, error }

/// Estado del ciclo de vida de la regla preventiva.
enum CarPromotionStatus { observation, promoted, vetoed }

/// Representa una regla preventiva sintetizada a partir de un clúster de defectos recurrentes.
class AstPatternRule {
  final String id;
  final String nodeType;
  final String pattern;
  final CarRuleSeverity severity;
  final String description;
  final int quarantineDays;
  final CarPromotionStatus promotionStatus;
  final DateTime createdAt;

  const AstPatternRule({
    required this.id,
    required this.nodeType,
    required this.pattern,
    this.severity = CarRuleSeverity.warn,
    required this.description,
    this.quarantineDays = 7,
    this.promotionStatus = CarPromotionStatus.observation,
    required this.createdAt,
  });

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'node_type': nodeType,
      'pattern': pattern,
      'severity': severity.name,
      'description': description,
      'quarantine_days': quarantineDays,
      'promotion_status': promotionStatus.name.toUpperCase(),
      'created_at': createdAt.toIso8601String(),
    };
  }

  factory AstPatternRule.fromJson(Map<String, dynamic> json) {
    return AstPatternRule(
      id: json['id'] as String,
      nodeType: json['node_type'] as String,
      pattern: json['pattern'] as String,
      severity: json['severity'] == 'error'
          ? CarRuleSeverity.error
          : CarRuleSeverity.warn,
      description: json['description'] as String,
      quarantineDays: (json['quarantine_days'] as num?)?.toInt() ?? 7,
      promotionStatus: _parsePromotionStatus(
        json['promotion_status'] as String?,
      ),
      createdAt:
          DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.now(),
    );
  }

  static CarPromotionStatus _parsePromotionStatus(String? val) {
    switch (val?.toUpperCase()) {
      case 'PROMOTED':
        return CarPromotionStatus.promoted;
      case 'VETOED':
        return CarPromotionStatus.vetoed;
      case 'OBSERVATION':
      default:
        return CarPromotionStatus.observation;
    }
  }

  AstPatternRule copyWith({
    CarRuleSeverity? severity,
    CarPromotionStatus? promotionStatus,
    String? description,
  }) {
    return AstPatternRule(
      id: id,
      nodeType: nodeType,
      pattern: pattern,
      severity: severity ?? this.severity,
      description: description ?? this.description,
      quarantineDays: quarantineDays,
      promotionStatus: promotionStatus ?? this.promotionStatus,
      createdAt: createdAt,
    );
  }
}

/// Motor extractor de firmas sintácticas para el cierre cibernético CMMI Nivel 5 (CAR).
///
/// Analiza el diferencial entre código defectuoso recurrente y su resolución,
/// aislando el nodo sintáctico culpable y sintetizando una regla preventiva en modo observación (warn).
class AstSignatureExtractor {
  const AstSignatureExtractor();

  /// Analiza la mutación de código y sintetiza la regla preventiva determinista.
  AstPatternRule extractFromDiff({
    required String defectiveCode,
    required String fixedCode,
    required String defectClusterId,
  }) {
    // 1. Detección de casteo inseguro `as Type` eliminado en la corrección
    final RegExp unsafeCastRegex = RegExp(r'\bas\s+([A-Z]\w+)');
    if (unsafeCastRegex.hasMatch(defectiveCode) &&
        !unsafeCastRegex.hasMatch(fixedCode)) {
      return AstPatternRule(
        id: 'CAR-${defectClusterId.toUpperCase()}-UNSAFE-CAST',
        nodeType: 'AsExpression',
        pattern: r'\bas\s+[A-Z]\w+',
        severity: CarRuleSeverity.warn,
        description: 'Casteo inseguro detectado sin verificación de tipo previa. Usar pattern matching o `is`.',
        quarantineDays: 7,
        promotionStatus: CarPromotionStatus.observation,
        createdAt: DateTime.now(),
      );
    }

    // 2. Detección de acceso ciego `.first` reemplazado por `.firstOrNull`
    final RegExp blindFirstRegex = RegExp(r'\.first\b(?!\w)');
    if (blindFirstRegex.hasMatch(defectiveCode) &&
        !blindFirstRegex.hasMatch(fixedCode)) {
      return AstPatternRule(
        id: 'CAR-${defectClusterId.toUpperCase()}-BLIND-FIRST',
        nodeType: 'PropertyAccess',
        pattern: r'\.first\b(?!\w)',
        severity: CarRuleSeverity.warn,
        description: 'Acceso ciego a `.first` sobre iterable potencialmente vacío. Usar `.firstOrNull`.',
        quarantineDays: 7,
        promotionStatus: CarPromotionStatus.observation,
        createdAt: DateTime.now(),
      );
    }

    // 3. Detección de unwrap forzado `!`
    final RegExp bangRegex = RegExp(r'!\s*(\.|\)|;|,|\n|$)');
    if (bangRegex.hasMatch(defectiveCode) && !bangRegex.hasMatch(fixedCode)) {
      return AstPatternRule(
        id: 'CAR-${defectClusterId.toUpperCase()}-FORCE-UNWRAP',
        nodeType: 'PostfixExpression',
        pattern: r'!\s*(\.|\)|;|,|\n|$)',
        severity: CarRuleSeverity.warn,
        description: 'Operador de aserción nula forzada `!` riesgoso. Reemplazar por manejo seguro de nulos.',
        quarantineDays: 7,
        promotionStatus: CarPromotionStatus.observation,
        createdAt: DateTime.now(),
      );
    }

    // 4. Detección de bloque catch vacío
    final RegExp emptyCatchRegex = RegExp(r'catch\s*\([^)]*\)\s*\{\s*\}');
    if (emptyCatchRegex.hasMatch(defectiveCode) &&
        !emptyCatchRegex.hasMatch(fixedCode)) {
      return AstPatternRule(
        id: 'CAR-${defectClusterId.toUpperCase()}-EMPTY-CATCH',
        nodeType: 'CatchClause',
        pattern: r'catch\s*\([^)]*\)\s*\{\s*\}',
        severity: CarRuleSeverity.warn,
        description: 'Bloque catch vacío proscrito por Doctrina Anti-Atajos. Incorporar manejo de error.',
        quarantineDays: 7,
        promotionStatus: CarPromotionStatus.observation,
        createdAt: DateTime.now(),
      );
    }

    // Fallback genérico para patrones sintácticos aislados
    return AstPatternRule(
      id: 'CAR-${defectClusterId.toUpperCase()}-GENERIC',
      nodeType: 'SyntacticPattern',
      pattern: RegExp.escape(defectiveCode.trim()),
      severity: CarRuleSeverity.warn,
      description: 'Patrón sintáctico causante del defecto $defectClusterId.',
      quarantineDays: 7,
      promotionStatus: CarPromotionStatus.observation,
      createdAt: DateTime.now(),
    );
  }

  /// Persiste o actualiza la regla en el archivo de reglas preventivas.
  Future<void> persistRule(
    AstPatternRule rule, {
    String filePath = 'vault/runtime/banned_patterns.json',
  }) async {
    final File file = File(filePath);
    final List<AstPatternRule> rules = await loadRules(filePath: filePath);

    // Reemplazar si ya existe por ID o agregar
    final int existingIdx = rules.indexWhere(
      (AstPatternRule r) => r.id == rule.id,
    );
    if (existingIdx >= 0) {
      rules[existingIdx] = rule;
    } else {
      rules.add(rule);
    }

    if (!await file.parent.exists()) {
      await file.parent.create(recursive: true);
    }

    final Map<String, dynamic> doc = <String, dynamic>{
      'version': '1.0.0',
      'last_updated': DateTime.now().toIso8601String(),
      'rules': rules.map((AstPatternRule r) => r.toJson()).toList(),
    };

    await file.writeAsString(jsonEncode(doc));
  }

  /// Carga las reglas preventivas activas.
  static Future<List<AstPatternRule>> loadRules({
    String filePath = 'vault/runtime/banned_patterns.json',
  }) async {
    final File file = File(filePath);
    if (!await file.exists()) {
      return <AstPatternRule>[];
    }

    try {
      final String content = await file.readAsString();
      if (content.trim().isEmpty) return <AstPatternRule>[];

      final Map<String, dynamic> data =
          jsonDecode(content) as Map<String, dynamic>;
      final List<dynamic>? rawRules = data['rules'] as List<dynamic>?;
      if (rawRules == null) return <AstPatternRule>[];

      return rawRules
          .map(
            (dynamic item) =>
                AstPatternRule.fromJson(item as Map<String, dynamic>),
          )
          .toList();
    } catch (_) {
      return <AstPatternRule>[];
    }
  }
}
