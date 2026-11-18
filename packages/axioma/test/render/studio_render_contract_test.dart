import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('Canonical Studio Headless Render Contract (§4, §6, §39)', () {
    group('StudioArchetype & StudioRenderOrderRequest', () {
      test(
        'Happy Path: Creates and serializes valid StudioRenderOrderRequest',
        () {
          final StudioRenderOrderRequest req = StudioRenderOrderRequest(
            orderId: 'ORD-LEVITA-104',
            tenantId: 'levita',
            title: 'Vestido Seda Azul Real',
            archetype: StudioArchetype.packshotHero,
            priceTag: '45.00',
            currency: 'USD',
            productImageUrl: 'https://cdn.levita.dev/raw/vestido_104.jpg',
            metadata: <String, dynamic>{'discount_pct': 10},
          );

          final Map<String, dynamic> json = req.toJson();
          expect(json['order_id'], equals('ORD-LEVITA-104'));
          expect(json['tenant_id'], equals('levita'));
          expect(json['archetype'], equals('packshot_hero'));
          expect(json['format'], equals('png'));
          expect(json['price_tag'], equals('45.00'));

          final StudioRenderOrderRequest roundtrip =
              StudioRenderOrderRequest.fromJson(json);
          expect(roundtrip.orderId, equals(req.orderId));
          expect(roundtrip.tenantId, equals(req.tenantId));
          expect(roundtrip.format, equals(StudioRenderFormat.png));
        },
      );

      test(
        'Happy Path: Converts to CreativeOrder JSON compatible with studio_render.dart',
        () {
          final StudioRenderOrderRequest req = StudioRenderOrderRequest(
            orderId: 'ORD-BM-PROMPTS-50',
            tenantId: 'bluemarket',
            title: '50 Prompts Midjourney para E-commerce',
            archetype: StudioArchetype.digitalAssetMockup,
            priceTag: '3.99',
            currency: 'USD',
          );

          final Map<String, dynamic> creativeOrderJson = req
              .toCreativeOrderJson();
          expect(creativeOrderJson['id'], equals('ORD-BM-PROMPTS-50'));
          expect(creativeOrderJson['tenant_id'], equals('bluemarket'));
          expect(creativeOrderJson['deliverables'], isNotEmpty);

          final Map<String, dynamic> deliverable =
              (creativeOrderJson['deliverables'] as List<dynamic>).first
                  as Map<String, dynamic>;
          expect(deliverable['type'], equals('packshot_hero'));
          expect(deliverable['metadata']['price_tag'], equals('3.99'));
        },
      );

      test(
        'Sad Path (§6): Throws ArgumentError on empty orderId, tenantId or title',
        () {
          expect(
            () => StudioRenderOrderRequest(
              orderId: '   ',
              tenantId: 'levita',
              title: 'Vestido',
              archetype: StudioArchetype.packshotHero,
            ),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => StudioRenderOrderRequest(
              orderId: 'ORD-1',
              tenantId: '   ',
              title: 'Vestido',
              archetype: StudioArchetype.packshotHero,
            ),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => StudioRenderOrderRequest(
              orderId: 'ORD-1',
              tenantId: 'levita',
              title: '',
              archetype: StudioArchetype.packshotHero,
            ),
            throwsA(isA<ArgumentError>()),
          );
        },
      );

      test(
        'Sad Path (§6): Throws ArgumentError on unknown archetype or missing json fields',
        () {
          expect(
            () => StudioArchetype.fromString('unknown_arch'),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => StudioRenderOrderRequest.fromJson(<String, dynamic>{
              'order_id': 'ORD-1',
              'title': 'Test',
            }),
            throwsA(isA<ArgumentError>()),
          );
        },
      );
    });

    group('StudioRenderResult', () {
      test('Happy Path: Serializes successful render result', () {
        final StudioRenderResult res = StudioRenderResult(
          orderId: 'ORD-LEVITA-104',
          tenantId: 'levita',
          success: true,
          outputPath: '/var/www/cdn/tickets/ticket_104.png',
          format: 'png',
          durationMs: 245,
        );

        final Map<String, dynamic> json = res.toJson();
        expect(json['success'], isTrue);
        expect(json['output_path'], endsWith('.png'));
        expect(json['duration_ms'], equals(245));

        final StudioRenderResult roundtrip = StudioRenderResult.fromJson(json);
        expect(roundtrip.success, isTrue);
        expect(roundtrip.outputPath, equals(res.outputPath));
      });

      test(
        'Sad Path (§6): Throws ArgumentError when success=true without outputPath',
        () {
          expect(
            () => StudioRenderResult(
              orderId: 'ORD-1',
              tenantId: 'levita',
              success: true,
              outputPath: null,
              format: 'png',
              durationMs: 100,
            ),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => StudioRenderResult(
              orderId: 'ORD-1',
              tenantId: 'levita',
              success: true,
              outputPath: '   ',
              format: 'png',
              durationMs: 100,
            ),
            throwsA(isA<ArgumentError>()),
          );
        },
      );
    });
  });
}
