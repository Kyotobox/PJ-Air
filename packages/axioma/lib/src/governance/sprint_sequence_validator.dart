/// sprint_sequence_validator.dart — Validador Universal de Consecutividad Estricta de Sprints (§39, §54).
///
/// Motor Pure Dart agnóstico de UI para verificar la continuidad matemática (N+1)
/// en las series históricas y activas de sprints dentro del ecosistema de gobernanza.
library;

/// Excepción arrojada cuando se detecta una discontinuidad o gap en la numeración de sprints.
class SprintSequenceDiscontinuityException implements Exception {
  final String prefix;
  final List<int> missingNumbers;
  final int from;
  final int to;
  final String message;

  SprintSequenceDiscontinuityException({
    required this.prefix,
    required this.missingNumbers,
    required this.from,
    required this.to,
    String? customMessage,
  }) : message =
           customMessage ??
           'Discontinuidad detectada en prefijo $prefix: faltan $missingNumbers';

  @override
  String toString() => 'SprintSequenceDiscontinuityException: $message';
}

/// Resultado de la validación estructural de la secuencia de sprints.
class ValidationResult {
  final bool isValid;
  final List<String> errors;
  final Map<String, List<int>> groups;
  final Map<String, List<int>> missingByPrefix;

  const ValidationResult({
    required this.isValid,
    this.errors = const <String>[],
    this.groups = const <String, List<int>>{},
    this.missingByPrefix = const <String, List<int>>{},
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'is_valid': isValid,
    'errors': errors,
    'groups': groups,
    'missing_by_prefix': missingByPrefix,
  };

  @override
  String toString() =>
      'ValidationResult(isValid: $isValid, errors: $errors, missingByPrefix: $missingByPrefix)';
}

/// Validador universal de consecutividad estricta de correlativos de sprints.
class SprintSequenceValidator {
  SprintSequenceValidator._();

  static final RegExp _sprintIdRegex = RegExp(
    r'^(?:SPRINT[-_])?([A-Za-z]+)(\d+)$',
    caseSensitive: false,
  );

  /// Extrae el prefijo y número correlativo de un identificador de sprint (ej: 'C239' -> prefix: 'C', number: 239).
  static ({String prefix, int number})? parseSprintId(String rawId) {
    final String clean = rawId.trim();
    final RegExpMatch? match = _sprintIdRegex.firstMatch(clean);
    if (match == null) return null;

    final String prefix = match.group(1)!.toUpperCase();
    final int? number = int.tryParse(match.group(2)!);
    if (number == null) return null;

    return (prefix: prefix, number: number);
  }

  /// Valida la consecutividad estricta de una lista de sprints agrupados por prefijo.
  ///
  /// Si [throwOnDiscontinuity] es true (valor por defecto), arroja [SprintSequenceDiscontinuityException]
  /// ante el primer salto detectado.
  static ValidationResult validate(
    List<Map<String, dynamic>> sprints, {
    bool throwOnDiscontinuity = true,
  }) {
    final Map<String, Set<int>> groupedSet = <String, Set<int>>{};

    for (final Map<String, dynamic> sprint in sprints) {
      final String? rawId = sprint['id']?.toString();
      if (rawId == null || rawId.trim().isEmpty) continue;

      final ({int number, String prefix})? parsed = parseSprintId(rawId);
      if (parsed == null) continue;

      groupedSet.putIfAbsent(parsed.prefix, () => <int>{}).add(parsed.number);
    }

    final Map<String, List<int>> sortedGroups = <String, List<int>>{};
    final Map<String, List<int>> missingByPrefix = <String, List<int>>{};
    final List<String> errors = <String>[];

    final List<String> sortedPrefixes = groupedSet.keys.toList()..sort();

    for (final String prefix in sortedPrefixes) {
      final List<int> numbers = groupedSet[prefix]!.toList()..sort();
      sortedGroups[prefix] = numbers;

      if (numbers.length <= 1) continue;

      for (int i = 0; i < numbers.length - 1; i++) {
        final int current = numbers[i];
        final int next = numbers[i + 1];

        if (next != current + 1) {
          final List<int> missing = <int>[
            for (int missingNum = current + 1; missingNum < next; missingNum++)
              missingNum,
          ];

          missingByPrefix.putIfAbsent(prefix, () => <int>[]).addAll(missing);
          final String errorMsg =
              'Discontinuidad detectada en prefijo $prefix: faltan $missing';
          errors.add(errorMsg);

          if (throwOnDiscontinuity) {
            throw SprintSequenceDiscontinuityException(
              prefix: prefix,
              missingNumbers: missing,
              from: current,
              to: next,
            );
          }
        }
      }
    }

    final bool isValid = errors.isEmpty;
    return ValidationResult(
      isValid: isValid,
      errors: errors,
      groups: sortedGroups,
      missingByPrefix: missingByPrefix,
    );
  }
}
