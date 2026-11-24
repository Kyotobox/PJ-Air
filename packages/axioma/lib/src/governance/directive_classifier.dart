/// directive_classifier.dart — Clasificador Determinista de Directivas y Contrapeso (§39, §61.2, §63).
///
/// Clasifica operaciones en destructivas, de solo lectura, híbridas o exploratorias,
/// e identifica patrones de servilismo cognitivo (sycophancy) en Pure Dart.
library;

/// Tipo ontológico de una directiva o solicitud operativa.
enum DirectiveType {
  /// Operación destructiva que muta esquemas, purga datos, borra archivos o re-ingesta masiva.
  destructive,

  /// Operación pasiva de diagnóstico, inspección estática o lectura de estado.
  readOnly,

  /// Operación compuesta que combina lecturas con mutaciones menores o incrementales.
  hybrid,

  /// Consulta heurística, red-teaming o exploración conceptual del Product Owner.
  exploratory,
}

/// Resultado de la clasificación determinista de una directiva.
class DirectiveClassification {
  final DirectiveType type;
  final List<String> matchedPatterns;
  final bool isSycophantic;
  final String? sycophancySnippet;
  final String rawText;

  const DirectiveClassification({
    required this.type,
    this.matchedPatterns = const <String>[],
    this.isSycophantic = false,
    this.sycophancySnippet,
    required this.rawText,
  });

  bool get isDestructive => type == DirectiveType.destructive;
  bool get isReadOnly => type == DirectiveType.readOnly;
  bool get isExploratory => type == DirectiveType.exploratory;

  @override
  String toString() =>
      'DirectiveClassification(type: $type, destructive: $isDestructive, sycophantic: $isSycophantic)';
}

/// Clasificador determinista de operaciones y directivas.
class DirectiveClassifier {
  static final List<RegExp> _destructivePatterns = <RegExp>[
    RegExp(
      r'\b(rm\s+-rf|git\s+push\s+--force|git\s+reset\s+--hard)\b',
      caseSensitive: false,
    ),
    RegExp(
      r'\b(DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM\b(?!.*WHERE))\b',
      caseSensitive: false,
    ),
    RegExp(
      r'\b(re-?ingesta\s+masiva|re-?ingesta\s+universal|borrar\s+todo|cuarentena\s+masiva|cuarentena\s+destructiva)\b',
      caseSensitive: false,
    ),
    RegExp(
      r'\b(purgar\s+cat[aá]logo|vaciar\s+base|destruir\s+lake)\b',
      caseSensitive: false,
    ),
  ];

  static final List<RegExp> _readOnlyPatterns = <RegExp>[
    RegExp(
      r'\b(git\s+status|git\s+log|git\s+diff|cat|head|tail|grep|find)\b',
      caseSensitive: false,
    ),
    RegExp(
      r'\b(logix\s+check|logix\s+audit|logix\s+status|logix\s+baseline)\b',
      caseSensitive: false,
    ),
    RegExp(
      r'\b(diagn[oó]stico|inspecci[oó]n|auditor[ií]a|consultar|leer)\b',
      caseSensitive: false,
    ),
  ];

  static final List<RegExp> _exploratoryPatterns = <RegExp>[
    RegExp(
      r'\b(qu[eé]\s+pasa\s+si|eval[uú]a\s+opciones|perspectivas|qu[eé]\s+opinas|pros\s+y\s+contras)\b',
      caseSensitive: false,
    ),
    RegExp(
      r'\b(red-?teaming|antagonista|qu[eé]\s+alternativas\s+hay)\b',
      caseSensitive: false,
    ),
  ];

  static final List<RegExp> _sycophancyPatterns = <RegExp>[
    RegExp(
      r'\b(el\s+po\s+tiene\s+la\s+raz[oó]n\s+absoluta)\b',
      caseSensitive: false,
    ),
    RegExp(
      r'\b(procedo\s+de\s+inmediato\s+sin\s+objeci[oó]n)\b',
      caseSensitive: false,
    ),
    RegExp(
      r'\b(tienes\s+toda\s+la\s+raz[oó]n,\s+vamos\s+a\s+borrar)\b',
      caseSensitive: false,
    ),
    RegExp(
      r'\b(sesi[oó]n\s+del\s+consejo\s+con\s+los\s+tres\s+pares\s+compuestos)\b',
      caseSensitive: false,
    ),
  ];

  const DirectiveClassifier();

  /// Clasifica el texto de una directiva o prompt determinísticamente.
  DirectiveClassification classify(String text) {
    final String clean = text.trim();
    if (clean.isEmpty) {
      return DirectiveClassification(
        type: DirectiveType.readOnly,
        rawText: text,
      );
    }

    final String? sycophancy = detectSycophancy(clean);
    final List<String> matchedDestructive = <String>[];
    for (final RegExp regex in _destructivePatterns) {
      final Match? m = regex.firstMatch(clean);
      if (m != null) {
        matchedDestructive.add(m.group(0)!);
      }
    }

    final List<String> matchedReadOnly = <String>[];
    for (final RegExp regex in _readOnlyPatterns) {
      final Match? m = regex.firstMatch(clean);
      if (m != null) {
        matchedReadOnly.add(m.group(0)!);
      }
    }

    final List<String> matchedExploratory = <String>[];
    for (final RegExp regex in _exploratoryPatterns) {
      final Match? m = regex.firstMatch(clean);
      if (m != null) {
        matchedExploratory.add(m.group(0)!);
      }
    }

    DirectiveType derivedType;
    if (matchedDestructive.isNotEmpty) {
      derivedType = DirectiveType.destructive;
    } else if (matchedExploratory.isNotEmpty && matchedReadOnly.isEmpty) {
      derivedType = DirectiveType.exploratory;
    } else if (matchedReadOnly.isNotEmpty && matchedExploratory.isEmpty) {
      derivedType = DirectiveType.readOnly;
    } else if (matchedReadOnly.isNotEmpty && matchedExploratory.isNotEmpty) {
      derivedType = DirectiveType.hybrid;
    } else {
      derivedType = DirectiveType.hybrid;
    }

    return DirectiveClassification(
      type: derivedType,
      matchedPatterns: matchedDestructive.isNotEmpty
          ? matchedDestructive
          : (matchedReadOnly.isNotEmpty ? matchedReadOnly : matchedExploratory),
      isSycophantic: sycophancy != null,
      sycophancySnippet: sycophancy,
      rawText: text,
    );
  }

  /// Detecta si el texto incurre en servilismo o teatro procedimental simulado (§47, §61.2).
  String? detectSycophancy(String text) {
    for (final RegExp regex in _sycophancyPatterns) {
      final Match? m = regex.firstMatch(text);
      if (m != null) {
        return m.group(0);
      }
    }
    return null;
  }
}
