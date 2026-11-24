import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('Ecosistema Levita - Contratos Canónicos Pure Dart (§39)', () {
    group('MerchantOnboardingDTO (Onboarding Socrático B2B)', () {
      test('Happy Path: serialización y ciclo de vida válido', () {
        final MerchantOnboardingDTO dto = MerchantOnboardingDTO(
          merchantId: 'burger-palace',
          businessName: 'Burger Palace',
          countryCode: 'VE',
          phoneNumber: '+584121234567',
          category: 'restaurant',
          dailyOrderVolume: 45,
          currentFriction: 'Pérdida de pedidos en WhatsApp y fletes manuales.',
          subdomain: 'burgerpalace',
        );

        expect(dto.merchantId, equals('burger-palace'));
        expect(dto.subdomain, equals('burgerpalace'));
        expect(dto.dailyOrderVolume, equals(45));

        final Map<String, dynamic> json = dto.toJson();
        expect(json['country_code'], equals('VE'));
        expect(json['phone_number'], equals('+584121234567'));

        final MerchantOnboardingDTO deserialized =
            MerchantOnboardingDTO.fromJson(json);
        expect(deserialized, equals(dto));
        expect(deserialized.hashCode, equals(dto.hashCode));
        expect(dto.toString(), contains('burgerpalace.lev.st'));
        expect(dto.toJsonString(), contains('"merchant_id":"burger-palace"'));
      });

      test('Sad Path: rechaza merchantId vacío', () {
        expect(
          () => MerchantOnboardingDTO(
            merchantId: '   ',
            businessName: 'Valido',
            countryCode: 'VE',
            phoneNumber: '+584121234567',
            category: 'retail',
            dailyOrderVolume: 10,
            currentFriction: 'Dolor',
            subdomain: 'valido',
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test('Sad Path: rechaza código de país inválido', () {
        expect(
          () => MerchantOnboardingDTO(
            merchantId: 'id1',
            businessName: 'Valido',
            countryCode: 'VEN',
            phoneNumber: '+584121234567',
            category: 'retail',
            dailyOrderVolume: 10,
            currentFriction: 'Dolor',
            subdomain: 'valido',
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test(
        'Sad Path: rechaza teléfono sin prefijo internacional E.164 (+)',
        () {
          expect(
            () => MerchantOnboardingDTO(
              merchantId: 'id1',
              businessName: 'Valido',
              countryCode: 'VE',
              phoneNumber: '04121234567',
              category: 'retail',
              dailyOrderVolume: 10,
              currentFriction: 'Dolor',
              subdomain: 'valido',
            ),
            throwsA(isA<ArgumentError>()),
          );
        },
      );

      test('Sad Path: rechaza volumen diario de pedidos negativo', () {
        expect(
          () => MerchantOnboardingDTO(
            merchantId: 'id1',
            businessName: 'Valido',
            countryCode: 'VE',
            phoneNumber: '+584121234567',
            category: 'retail',
            dailyOrderVolume: -5,
            currentFriction: 'Dolor',
            subdomain: 'valido',
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test(
        'Sad Path: rechaza subdominio con mayúsculas o caracteres inválidos',
        () {
          expect(
            () => MerchantOnboardingDTO(
              merchantId: 'id1',
              businessName: 'Valido',
              countryCode: 'VE',
              phoneNumber: '+584121234567',
              category: 'retail',
              dailyOrderVolume: 10,
              currentFriction: 'Dolor',
              subdomain: 'Burger_Palace!',
            ),
            throwsA(isA<ArgumentError>()),
          );
        },
      );
    });

    group('CreativeRenderJobDTO (Órdenes para Levita Studio)', () {
      test('Happy Path: instanciación y parseo JSON de job de render', () {
        final CreativeRenderJobDTO job = CreativeRenderJobDTO(
          jobId: 'job-uuid-1234',
          tenantId: 'tenant-55',
          archetype: 'packshot_hero',
          headline: '50% OFF en Hamburguesas Artesanales',
          subheadline: 'Solo por hoy en tu primer pedido',
          productImageUrl: 'https://r2.levita.dev/burger.png',
          brandDna: <String, dynamic>{'primary_color': '#FF5500'},
          outputFormat: 'png',
          status: 'PENDING',
        );

        expect(job.archetype, equals('packshot_hero'));
        expect(job.outputFormat, equals('png'));
        expect(job.status, equals('PENDING'));

        final Map<String, dynamic> json = job.toJson();
        expect(json['headline'], contains('50% OFF'));

        final CreativeRenderJobDTO deserialized = CreativeRenderJobDTO.fromJson(
          json,
        );
        expect(deserialized, equals(job));
        expect(deserialized.hashCode, equals(job.hashCode));
      });

      test('Sad Path: rechaza arquetipo no soportado', () {
        expect(
          () => CreativeRenderJobDTO(
            jobId: 'job-1',
            tenantId: 'tenant-1',
            archetype: 'holograma_3d_invalido',
            headline: 'Titulo',
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test('Sad Path: rechaza formato de salida inválido', () {
        expect(
          () => CreativeRenderJobDTO(
            jobId: 'job-1',
            tenantId: 'tenant-1',
            archetype: 'vector_typography',
            headline: 'Titulo',
            outputFormat: 'exe',
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test('Sad Path: rechaza estado de job no reconocido', () {
        expect(
          () => CreativeRenderJobDTO(
            jobId: 'job-1',
            tenantId: 'tenant-1',
            archetype: 'vector_typography',
            headline: 'Titulo',
            status: 'ALUCINADO',
          ),
          throwsA(isA<ArgumentError>()),
        );
      });
    });

    group('BroadcastCampaignDTO (Despacho hacia OmniFlow)', () {
      test('Happy Path: campaña válida con cadencia y jitter anti-ban', () {
        final BroadcastCampaignDTO campaign = BroadcastCampaignDTO(
          campaignId: 'cmp-9988',
          tenantId: 'tenant-1',
          poolId: 'pool_broadcast_vzla',
          targetJids: <String>['+584121112233', '1203630221199@g.us'],
          messageText: 'Gran inauguración de Burger Palace en *.lev.st',
          delaySeconds: 15,
          jitterSeconds: 5.0,
        );

        expect(campaign.targetJids.length, equals(2));
        expect(campaign.delaySeconds, equals(15));
        expect(campaign.jitterSeconds, equals(5.0));

        final Map<String, dynamic> json = campaign.toJson();
        final BroadcastCampaignDTO deserialized = BroadcastCampaignDTO.fromJson(
          json,
        );

        expect(deserialized, equals(campaign));
        expect(deserialized.hashCode, equals(campaign.hashCode));
      });

      test(
        'Sad Path: rechaza retardo menor a 5 segundos (seguridad anti-ban)',
        () {
          expect(
            () => BroadcastCampaignDTO(
              campaignId: 'cmp-1',
              tenantId: 't-1',
              poolId: 'pool-1',
              targetJids: <String>['+584121112233'],
              messageText: 'Promo',
              delaySeconds: 3,
            ),
            throwsA(isA<ArgumentError>()),
          );
        },
      );

      test('Sad Path: rechaza lista de destinos vacía', () {
        expect(
          () => BroadcastCampaignDTO(
            campaignId: 'cmp-1',
            tenantId: 't-1',
            poolId: 'pool-1',
            targetJids: <String>[],
            messageText: 'Promo',
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test('Sad Path: rechaza jitter negativo', () {
        expect(
          () => BroadcastCampaignDTO(
            campaignId: 'cmp-1',
            tenantId: 't-1',
            poolId: 'pool-1',
            targetJids: <String>['+584121112233'],
            messageText: 'Promo',
            jitterSeconds: -2.0,
          ),
          throwsA(isA<ArgumentError>()),
        );
      });
    });

    group('WhatsAppOfferDTO (Oferta Comercial Multimoneda Agnóstica)', () {
      test('Happy Path: oferta física con cotización dual (USD + VES BCV)', () {
        final WhatsAppOfferDTO offer = WhatsAppOfferDTO(
          offerId: 'prod-001',
          title: 'Combo Doble Queso Burger',
          description: 'Doble carne angus, queso cheddar y papas.',
          currency: 'USD',
          basePrice: 8.50,
          secondaryCurrency: 'VES',
          exchangeRate: 50.0,
          checkoutUrl: 'https://burger.lev.st/order/prod-001',
          imageUrl: 'https://r2.levita.dev/combo.png',
          isDigital: false,
        );

        expect(offer.basePrice, equals(8.50));
        expect(offer.convertedPrice, equals(425.0));
        expect(offer.isDigital, isFalse);

        final Map<String, dynamic> json = offer.toJson();
        expect(json['converted_price'], equals(425.0));

        final WhatsAppOfferDTO deserialized = WhatsAppOfferDTO.fromJson(json);
        expect(deserialized, equals(offer));
        expect(deserialized.hashCode, equals(offer.hashCode));
      });

      test(
        'Happy Path: activo digital BlueMarket (sin cotización secundaria)',
        () {
          final WhatsAppOfferDTO digitalOffer = WhatsAppOfferDTO(
            offerId: 'plr-prompts-pack',
            title: 'Pack 500+ Prompts Claude & GPT-4',
            description: 'Plantillas de copywriting y marketing probadas.',
            currency: 'USD',
            basePrice: 9.99,
            checkoutUrl: 'https://bluemarket.app/drop/plr-prompts-pack',
            isDigital: true,
          );

          expect(digitalOffer.isDigital, isTrue);
          expect(digitalOffer.convertedPrice, isNull);
          expect(digitalOffer.secondaryCurrency, isNull);
        },
      );

      test('Sad Path: rechaza precio base menor o igual a cero', () {
        expect(
          () => WhatsAppOfferDTO(
            offerId: 'freebie',
            title: 'Invalido',
            description: 'Desc',
            currency: 'USD',
            basePrice: 0.0,
            checkoutUrl: 'https://bluemarket.app/freebie',
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test('Sad Path: rechaza checkoutUrl inválida sin esquema http/https', () {
        expect(
          () => WhatsAppOfferDTO(
            offerId: 'prod-1',
            title: 'Invalido',
            description: 'Desc',
            currency: 'USD',
            basePrice: 10.0,
            checkoutUrl: 'ftp://invalido.com',
          ),
          throwsA(isA<ArgumentError>()),
        );
      });
    });
  });
}
