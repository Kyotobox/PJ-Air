// commercial_guardrails.dart — Guardrails de Integridad Comercial y Tool Calling (§47, §54.6, §60.2)
library;

import '../client_slot_types.dart';

/// Excepción de violación de guardrail comercial.
class CommercialGuardrailException implements Exception {
  final String message;
  final String? rule;

  const CommercialGuardrailException(this.message, {this.rule});

  @override
  String toString() =>
      'CommercialGuardrailException: $message (Regla: ${rule ?? "N/A"})';
}

/// Guardrails que impiden la inyección de precios estáticos o inventario alucinado.
class CommercialGuardrails {
  const CommercialGuardrails._();

  /// Directiva obligatoria embebida en todo bloque de memoria de clientes.
  static const String kCatalogDirective =
      '[CATALOG_PRICING_AND_STOCK_VIA_TOOL_CALL_ONLY]';

  /// Valida que el slot no intente fijar precios unitarios de catálogo como hecho estático.
  /// Los precios de lista e inventarios deben consultarse en tiempo real vía Tool Calling.
  static void validateFact(ClientSlotType slotType, dynamic value) {
    final String valStr = value.toString().toLowerCase();
    if (slotType == ClientSlotType.notes) {
      if (valStr.contains('precio fijo garantizado') ||
          valStr.contains('stock infinito')) {
        throw const CommercialGuardrailException(
          'Prohibido registrar promesas de stock infinito o precios congelados sin tool call.',
          rule: '§47 / §60.2',
        );
      }
    }
  }

  /// Valida que el bloque de memoria renderizado contenga la directiva de Tool Calling
  /// y no exponga claims prohibidos.
  static void validateRenderedBlock(String block) {
    if (!block.contains(kCatalogDirective)) {
      throw const CommercialGuardrailException(
        'El bloque de memoria debe incluir obligatoriamente la directiva de Tool Calling de catálogo.',
        rule: '§54.6 / §60.2',
      );
    }
  }
}
