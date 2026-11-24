// core_memory_renderer.dart — Renderizador Determinista de Core Memory Block (<150 tokens) (§47, §54.6, §60.2)
library;

import '../active_commitment.dart';
import '../client_dna_models.dart';
import '../client_slot_types.dart';
import '../validators/commercial_guardrails.dart';
import '../validators/fact_citation_validator.dart';

/// Excepción arrojada cuando el bloque de memoria no puede cumplir el presupuesto.
class CoreMemoryBudgetException implements Exception {
  final String message;
  final int estimatedTokens;
  final int maxTokens;

  const CoreMemoryBudgetException(
    this.message, {
    required this.estimatedTokens,
    required this.maxTokens,
  });

  @override
  String toString() =>
      'CoreMemoryBudgetException: $message ($estimatedTokens tokens > $maxTokens max)';
}

/// Renderizador determinista de Core Memory (< 150 tokens) para inyección en prompts de agentes.
class CoreMemoryRenderer {
  /// Presupuesto estricto máximo de tokens para Core Memory.
  static const int kMaxTokens = 150;

  /// Factor conservador de caracteres por token (4 caracteres = 1 token).
  static const double kCharsPerToken = 4.0;

  final FactCitationValidator citationValidator;

  const CoreMemoryRenderer({
    this.citationValidator = const FactCitationValidator(),
  });

  /// Estima la cantidad de tokens de un texto plano de forma determinista.
  static int estimateTokens(String text) {
    return (text.length / kCharsPerToken).ceil();
  }

  /// Proyecta el bloque de memoria estructurado del cliente bajo presupuesto estricto (<150 tokens).
  String render({
    required ClientEntity entity,
    required List<ClientFact> activeFacts,
    List<ActiveCommitment>? commitments,
    List<ClientSlotType>? expectedSlots,
    DateTime? now,
  }) {
    final DateTime currentInstant = now ?? DateTime.now().toUtc();

    // 1. Validar integridad de cada hecho según §47
    for (final ClientFact f in activeFacts) {
      citationValidator.assertValid(f);
      CommercialGuardrails.validateFact(f.slotType, f.value);
    }

    // 2. Clasificar hechos por estado epistémico
    final List<ClientFact> confirmed = <ClientFact>[];
    final List<ClientFact> inferred = <ClientFact>[];
    final Set<ClientSlotType> coveredSlots = <ClientSlotType>{};

    for (final ClientFact f in activeFacts) {
      if (f.epistemicStatus == EpistemicStatus.confirmed) {
        confirmed.add(f);
      } else if (f.epistemicStatus == EpistemicStatus.inferred) {
        inferred.add(f);
      }
      coveredSlots.add(f.slotType);
    }

    // Ordenar inferencias por confianza descendente
    inferred.sort(
      (ClientFact a, ClientFact b) => b.confidence.compareTo(a.confidence),
    );

    // Determinar slots sin dato si se suministró lista de esperados
    final List<ClientSlotType> missingSlots = <ClientSlotType>[];
    if (expectedSlots != null) {
      for (final ClientSlotType s in expectedSlots) {
        if (!coveredSlots.contains(s)) {
          missingSlots.add(s);
        }
      }
    }

    // Filtrar compromisos activos no vencidos
    final List<ActiveCommitment> pendingCommitments =
        (commitments ?? <ActiveCommitment>[])
            .where(
              (ActiveCommitment c) =>
                  c.status == CommitmentStatus.pending &&
                  !c.isExpired(currentInstant),
            )
            .toList();

    // 3. Ensamblar con poda determinista para garantizar < 150 tokens
    String block = _assembleBlock(
      entity: entity,
      confirmed: confirmed,
      inferred: inferred,
      missingSlots: missingSlots,
      commitments: pendingCommitments,
    );

    // Si excede el presupuesto, podar progresivamente:
    // Nivel 1: Eliminar sección SIN_DATO
    if (estimateTokens(block) > kMaxTokens && missingSlots.isNotEmpty) {
      block = _assembleBlock(
        entity: entity,
        confirmed: confirmed,
        inferred: inferred,
        missingSlots: <ClientSlotType>[],
        commitments: pendingCommitments,
      );
    }

    // Nivel 2: Podar inferencias de menor confianza
    final List<ClientFact> trimmedInferred = List<ClientFact>.from(inferred);
    while (estimateTokens(block) > kMaxTokens && trimmedInferred.isNotEmpty) {
      trimmedInferred.removeLast();
      block = _assembleBlock(
        entity: entity,
        confirmed: confirmed,
        inferred: trimmedInferred,
        missingSlots: <ClientSlotType>[],
        commitments: pendingCommitments,
      );
    }

    // Nivel 3: Si aún excede, truncar nombres largos o compromisos
    final int finalTokens = estimateTokens(block);
    if (finalTokens > kMaxTokens) {
      throw CoreMemoryBudgetException(
        'El volumen de hechos confirmados excede el presupuesto estricto.',
        estimatedTokens: finalTokens,
        maxTokens: kMaxTokens,
      );
    }

    CommercialGuardrails.validateRenderedBlock(block);
    return block;
  }

  String _assembleBlock({
    required ClientEntity entity,
    required List<ClientFact> confirmed,
    required List<ClientFact> inferred,
    required List<ClientSlotType> missingSlots,
    required List<ActiveCommitment> commitments,
  }) {
    final StringBuffer sb = StringBuffer();
    sb.writeln(
      '<CORE_MEMORY client_id="${entity.id}" type="${entity.clientType.wireName}">',
    );
    sb.writeln('PRIMARY: ${entity.primaryName}');

    if (confirmed.isNotEmpty) {
      sb.writeln('CONFIRMADO:');
      for (final ClientFact f in confirmed) {
        sb.writeln(
          '- ${f.slotType.wireName}: ${f.value} (ref: ${f.sourceCitation})',
        );
      }
    }

    if (inferred.isNotEmpty) {
      sb.writeln('INFERIDO:');
      for (final ClientFact f in inferred) {
        sb.writeln(
          '- ${f.slotType.wireName}: ${f.value} (conf: ${f.confidence.toStringAsFixed(2)})',
        );
      }
    }

    if (missingSlots.isNotEmpty) {
      sb.writeln('SIN_DATO:');
      for (final ClientSlotType s in missingSlots) {
        sb.writeln('- ${s.wireName}');
      }
    }

    if (commitments.isNotEmpty) {
      sb.writeln('COMPROMISOS_ACTIVOS:');
      for (final ActiveCommitment c in commitments) {
        sb.writeln('- ${c.commitmentType}: ${c.description}');
      }
    }

    sb.writeln(CommercialGuardrails.kCatalogDirective);
    sb.write('</CORE_MEMORY>');
    return sb.toString();
  }
}
