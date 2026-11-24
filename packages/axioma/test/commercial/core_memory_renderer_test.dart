// core_memory_renderer_test.dart — Certificación de CoreMemoryRenderer Pure Dart (§4, §6, §39, §47, §54.6, §60.2)
import 'package:axioma/commercial.dart';
import 'package:test/test.dart';

void main() {
  group('TASK-N145-02: CoreMemoryRenderer Single Path of Authority (§58, §60.2)', () {
    const CoreMemoryRenderer renderer = CoreMemoryRenderer();

    test(
      '[HAPPY-PATH] Renderiza bloque de memoria conciso dentro del presupuesto (<150 tokens)',
      () {
        final ClientEntity entity = ClientEntity(
          id: 'CLI-001',
          primaryName: 'Carlos Mendoza',
          tenantId: 'TEN-01',
          clientType: ClientType.b2b,
        );

        final List<ClientFact> facts = <ClientFact>[
          ClientFact(
            id: 'F-01',
            clientId: 'CLI-001',
            slotType: ClientSlotType.b2cPaymentMethod,
            value: 'PAGO_MOVIL',
            confidence: 0.99,
            sourceCitation: 'FACTURA-2026-001',
            validFrom: DateTime.utc(2026, 11, 1),
          ),
        ];

        final String block = renderer.render(
          entity: entity,
          activeFacts: facts,
          commitments: <ActiveCommitment>[],
        );

        expect(block, isNotEmpty);
        expect(block.contains('Carlos Mendoza'), isTrue);
        expect(block.contains('PAGO_MOVIL'), isTrue);
        final int tokens = CoreMemoryRenderer.estimateTokens(block);
        expect(tokens, lessThanOrEqualTo(CoreMemoryRenderer.kMaxTokens));
      },
    );

    test(
      '[SAD-PATH §6] Desbordamiento de presupuesto de tokens arroja CoreMemoryBudgetException',
      () {
        final ClientEntity entity = ClientEntity(
          id: 'CLI-999',
          primaryName:
              'Cliente Con Datos Excesivamente Extensos Que Desbordan El Presupuesto Máximo Permitido Por El Sistema',
          tenantId: 'TEN-99',
          clientType: ClientType.b2b,
        );

        // Creamos hechos que deliberadamente exceden el límite de 150 tokens
        final List<ClientFact> heavyFacts = List<ClientFact>.generate(
          15,
          (int i) => ClientFact(
            id: 'F-$i',
            clientId: 'CLI-999',
            slotType: ClientSlotType.notes,
            value:
                'Detalle de requerimiento exhaustivo número $i con texto extenso para forzar el límite de tokens presupuestado en core memory',
            confidence: 0.95,
            sourceCitation: 'LOG-CONV-2026-00$i',
            validFrom: DateTime.utc(2026, 11, 1),
          ),
        );

        expect(
          () => renderer.render(entity: entity, activeFacts: heavyFacts),
          throwsA(isA<CoreMemoryBudgetException>()),
        );
      },
    );

    test(
      '[SAD-PATH §6] Hecho sin sourceCitation en estado CONFIRMADO arroja StateError (§47)',
      () {
        expect(
          () => ClientFact(
            id: 'F-ERR',
            clientId: 'CLI-002',
            slotType: ClientSlotType.b2cPaymentMethod,
            value: 'PAGO_MOVIL',
            epistemicStatus: EpistemicStatus.confirmed,
            sourceCitation: null,
            validFrom: DateTime.utc(2026, 11, 1),
          ),
          throwsA(isA<StateError>()),
        );
      },
    );

    test(
      '[SAD-PATH §6] Hecho con valor de slot inválido arroja ArgumentError (§6)',
      () {
        expect(
          () => ClientFact(
            id: 'F-ERR-VAL',
            clientId: 'CLI-002',
            slotType: ClientSlotType.b2bFleetSize,
            value: -10, // Flota negativa viola guardrail de tipo
            confidence: 0.95,
            sourceCitation: 'MSG-001',
            validFrom: DateTime.utc(2026, 11, 1),
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );
  });
}
