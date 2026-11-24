// fact_citation_validator.dart — Validador de Citas y Guardrail de Verdad Atómica (§47, §54.6)
library;

import '../client_dna_models.dart';
import '../client_slot_types.dart';

/// Validador estricto de citas de hechos para impedir alucinaciones o datos complacientes (§47).
class FactCitationValidator {
  const FactCitationValidator();

  /// Valida la conformidad de un [fact] con el Protocolo de Verdad Atómica.
  /// Arroja [StateError] si un hecho CONFIRMADO carece de cita legítima.
  /// Arroja [ArgumentError] si el hecho presenta incoherencias epistémicas.
  void assertValid(ClientFact fact) {
    if (fact.epistemicStatus == EpistemicStatus.confirmed) {
      if (fact.sourceCitation == null || fact.sourceCitation!.trim().isEmpty) {
        throw StateError(
          'Veto Constitucional (§47): El hecho "${fact.slotType.wireName}" está marcado como CONFIRMADO pero no posee cita observable (sourceCitation).',
        );
      }
      final String citation = fact.sourceCitation!.trim();
      if (citation.length < 3) {
        throw ArgumentError.value(
          citation,
          'sourceCitation',
          'La cita observable debe tener al menos 3 caracteres de referencia verificable.',
        );
      }
    }

    if (fact.epistemicStatus == EpistemicStatus.inferred) {
      if (fact.confidence <= 0.0 || fact.confidence > 1.0) {
        throw ArgumentError.value(
          fact.confidence,
          'confidence',
          'Todo hecho INFERIDO debe tener confianza en el rango (0.0, 1.0].',
        );
      }
    }
  }

  /// Verifica si un hecho cumple las reglas de citación sin lanzar excepciones.
  bool isValid(ClientFact fact) {
    try {
      assertValid(fact);
      return true;
    } catch (_) {
      return false;
    }
  }
}
