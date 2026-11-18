/// commercial_contracts_test.dart — Suite de Certificación Física de Contratos Comerciales Pure Dart (§4, §6, §39, §58).
library;

import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

void main() {
  group('TASK-N121-01: CommercialDeliveryType Enum Tests', () {
    test('[HAPPY PATH] Serializa y deserializa tipos de entrega válidos', () {
      expect(
        CommercialDeliveryType.staticAsset.toJson(),
        equals('staticAsset'),
      );
      expect(
        CommercialDeliveryType.fromJson('staticAsset'),
        equals(CommercialDeliveryType.staticAsset),
      );
      expect(
        CommercialDeliveryType.fromJson('DYNAMICACCOUNT'),
        equals(CommercialDeliveryType.dynamicAccount),
      );
      expect(
        CommercialDeliveryType.fromJson('licenseKey'),
        equals(CommercialDeliveryType.licenseKey),
      );
      expect(
        CommercialDeliveryType.fromJson('serviceSubscription'),
        equals(CommercialDeliveryType.serviceSubscription),
      );
    });

    test(
      '[SAD PATH §6] Tipo de entrega no reconocido arroja CommercialCoercionException',
      () {
        expect(
          () => CommercialDeliveryType.fromJson('TIPO_INEXISTENTE'),
          throwsA(isA<CommercialCoercionException>()),
        );
      },
    );

    test(
      '[SAD PATH §6] Valor no String arroja CommercialCoercionException',
      () {
        expect(
          () => CommercialDeliveryType.fromJson(12345),
          throwsA(isA<CommercialCoercionException>()),
        );
        expect(
          () => CommercialDeliveryType.fromJson(null),
          throwsA(isA<CommercialCoercionException>()),
        );
      },
    );
  });

  group('TASK-N121-01: CommercialProductContract Tests', () {
    test(
      '[HAPPY PATH] Crea producto válido y calcula margen comercial correctamente',
      () {
        final CommercialProductContract product = CommercialProductContract(
          sku: 'OFFICE-PRO-2024',
          title: 'Microsoft Office 2024 Pro Plus Key',
          category: 'software_licenses',
          costUsd: 4.50,
          retailUsd: 15.00,
          deliveryType: CommercialDeliveryType.licenseKey,
          stockAvailable: 50,
          downloadUrl: 'https://office.cdn.microsoft.com/setup.exe',
          metadata: <String, dynamic>{'supplier': 'wholesale_bot_1'},
        );

        expect(product.sku, equals('OFFICE-PRO-2024'));
        expect(product.title, equals('Microsoft Office 2024 Pro Plus Key'));
        expect(product.marginUsd, closeTo(10.50, 0.001));
        expect(product.marginPct, closeTo(70.0, 0.001));
        expect(product.isHighMargin, isTrue);

        final Map<String, dynamic> json = product.toJson();
        expect(json['sku'], equals('OFFICE-PRO-2024'));
        expect(json['margin_pct'], equals(70.0));
        expect(json['delivery_type'], equals('licenseKey'));

        final CommercialProductContract restored =
            CommercialProductContract.fromJson(json);
        expect(restored.sku, equals(product.sku));
        expect(restored.costUsd, equals(product.costUsd));
        expect(restored.retailUsd, equals(product.retailUsd));
        expect(
          restored.deliveryType,
          equals(CommercialDeliveryType.licenseKey),
        );
      },
    );

    test(
      '[HAPPY PATH] Deserializa con alias alternativos (name, price_usd, cost)',
      () {
        final Map<String, String> raw = <String, String>{
          'id': 'WIN-11-PRO',
          'name': 'Windows 11 Pro OEM',
          'cost': '3.20',
          'price_usd': '12.80',
          'delivery_type': 'licenseKey',
          'stock': '25',
        };
        final CommercialProductContract p = CommercialProductContract.fromJson(
          raw,
        );
        expect(p.sku, equals('WIN-11-PRO'));
        expect(p.title, equals('Windows 11 Pro OEM'));
        expect(p.costUsd, equals(3.20));
        expect(p.retailUsd, equals(12.80));
        expect(p.stockAvailable, equals(25));
        expect(p.marginPct, closeTo(75.0, 0.001));
      },
    );

    test(
      '[SAD PATH §6] SKU vacío o en blanco arroja CommercialValidationException',
      () {
        expect(
          () => CommercialProductContract(
            sku: '   ',
            title: 'Windows Key',
            costUsd: 1.0,
            retailUsd: 5.0,
            deliveryType: CommercialDeliveryType.licenseKey,
            stockAvailable: 10,
          ),
          throwsA(
            isA<CommercialValidationException>().having(
              (CommercialValidationException e) => e.fieldName,
              'fieldName',
              equals('sku'),
            ),
          ),
        );
      },
    );

    test('[SAD PATH §6] Título vacío arroja CommercialValidationException', () {
      expect(
        () => CommercialProductContract(
          sku: 'SKU-001',
          title: '',
          costUsd: 1.0,
          retailUsd: 5.0,
          deliveryType: CommercialDeliveryType.licenseKey,
          stockAvailable: 10,
        ),
        throwsA(
          isA<CommercialValidationException>().having(
            (CommercialValidationException e) => e.fieldName,
            'fieldName',
            equals('title'),
          ),
        ),
      );
    });

    test(
      '[SAD PATH §6] Costo negativo arroja CommercialValidationException',
      () {
        expect(
          () => CommercialProductContract(
            sku: 'SKU-001',
            title: 'Product Title',
            costUsd: -2.50,
            retailUsd: 5.0,
            deliveryType: CommercialDeliveryType.licenseKey,
            stockAvailable: 10,
          ),
          throwsA(
            isA<CommercialValidationException>().having(
              (CommercialValidationException e) => e.fieldName,
              'fieldName',
              equals('costUsd'),
            ),
          ),
        );
      },
    );

    test(
      '[SAD PATH §6] Precio retail menor al costo (margen negativo) arroja CommercialValidationException',
      () {
        expect(
          () => CommercialProductContract(
            sku: 'SKU-001',
            title: 'Product Title',
            costUsd: 10.0,
            retailUsd: 8.0,
            deliveryType: CommercialDeliveryType.licenseKey,
            stockAvailable: 10,
          ),
          throwsA(
            isA<CommercialValidationException>().having(
              (CommercialValidationException e) => e.fieldName,
              'fieldName',
              equals('retailUsd'),
            ),
          ),
        );
      },
    );

    test(
      '[SAD PATH §6] Stock negativo arroja CommercialValidationException',
      () {
        expect(
          () => CommercialProductContract(
            sku: 'SKU-001',
            title: 'Product Title',
            costUsd: 5.0,
            retailUsd: 10.0,
            deliveryType: CommercialDeliveryType.licenseKey,
            stockAvailable: -1,
          ),
          throwsA(
            isA<CommercialValidationException>().having(
              (CommercialValidationException e) => e.fieldName,
              'fieldName',
              equals('stockAvailable'),
            ),
          ),
        );
      },
    );

    test(
      '[SAD PATH §6] fromJson con valores corruptos arroja CommercialCoercionException',
      () {
        final Map<String, Object> corrupt = <String, Object>{
          'sku': 'SKU-ERR',
          'title': 'Error Product',
          'cost_usd': 'INVALID_NUMBER',
          'retail_usd': 10.0,
        };
        expect(
          () => CommercialProductContract.fromJson(corrupt),
          throwsA(isA<CommercialCoercionException>()),
        );
      },
    );
  });

  group('TASK-N121-01: CommercialOrderHandoffContract Tests', () {
    test(
      '[HAPPY PATH] Registra handoff comercial válido y serializa a JSON',
      () {
        final CommercialOrderHandoffContract handoff =
            CommercialOrderHandoffContract(
              orderId: 'ORD-9843-BM',
              tenantId: 'bluemarket',
              customerPhone: '+584121234567',
              sku: 'OFFICE-PRO-2024',
              quantity: 2,
              amountPaidUsd: 30.00,
              paymentRef: 'PAGOMOVIL-778899',
              metadata: <String, dynamic>{'sales_channel': 'whatsapp_socratic'},
            );

        expect(handoff.orderId, equals('ORD-9843-BM'));
        expect(handoff.tenantId, equals('bluemarket'));
        expect(handoff.amountPaidUsd, equals(30.00));
        expect(handoff.quantity, equals(2));

        final Map<String, dynamic> json = handoff.toJson();
        expect(json['order_id'], equals('ORD-9843-BM'));
        expect(json['payment_ref'], equals('PAGOMOVIL-778899'));

        final CommercialOrderHandoffContract restored =
            CommercialOrderHandoffContract.fromJson(json);
        expect(restored.orderId, equals(handoff.orderId));
        expect(restored.sku, equals(handoff.sku));
        expect(restored.amountPaidUsd, equals(handoff.amountPaidUsd));
      },
    );

    test(
      '[SAD PATH §6] orderId o tenantId vacío arroja CommercialValidationException',
      () {
        expect(
          () => CommercialOrderHandoffContract(
            orderId: '   ',
            tenantId: 'bluemarket',
            customerPhone: '+584121234567',
            sku: 'SKU-1',
            amountPaidUsd: 10.0,
            paymentRef: 'REF1',
          ),
          throwsA(
            isA<CommercialValidationException>().having(
              (CommercialValidationException e) => e.fieldName,
              'fieldName',
              equals('orderId'),
            ),
          ),
        );

        expect(
          () => CommercialOrderHandoffContract(
            orderId: 'ORD-1',
            tenantId: '',
            customerPhone: '+584121234567',
            sku: 'SKU-1',
            amountPaidUsd: 10.0,
            paymentRef: 'REF1',
          ),
          throwsA(
            isA<CommercialValidationException>().having(
              (CommercialValidationException e) => e.fieldName,
              'fieldName',
              equals('tenantId'),
            ),
          ),
        );
      },
    );

    test(
      '[SAD PATH §6] Teléfono inválido o menor a 8 dígitos arroja CommercialValidationException',
      () {
        expect(
          () => CommercialOrderHandoffContract(
            orderId: 'ORD-1',
            tenantId: 'bluemarket',
            customerPhone: '123',
            sku: 'SKU-1',
            amountPaidUsd: 10.0,
            paymentRef: 'REF1',
          ),
          throwsA(
            isA<CommercialValidationException>().having(
              (CommercialValidationException e) => e.fieldName,
              'fieldName',
              equals('customerPhone'),
            ),
          ),
        );
      },
    );

    test(
      '[SAD PATH §6] Cantidad o monto <= 0 arroja CommercialValidationException',
      () {
        expect(
          () => CommercialOrderHandoffContract(
            orderId: 'ORD-1',
            tenantId: 'bluemarket',
            customerPhone: '+584121234567',
            sku: 'SKU-1',
            quantity: 0,
            amountPaidUsd: 10.0,
            paymentRef: 'REF1',
          ),
          throwsA(
            isA<CommercialValidationException>().having(
              (CommercialValidationException e) => e.fieldName,
              'fieldName',
              equals('quantity'),
            ),
          ),
        );

        expect(
          () => CommercialOrderHandoffContract(
            orderId: 'ORD-1',
            tenantId: 'bluemarket',
            customerPhone: '+584121234567',
            sku: 'SKU-1',
            quantity: 1,
            amountPaidUsd: 0.0,
            paymentRef: 'REF1',
          ),
          throwsA(
            isA<CommercialValidationException>().having(
              (CommercialValidationException e) => e.fieldName,
              'fieldName',
              equals('amountPaidUsd'),
            ),
          ),
        );
      },
    );
  });

  group('TASK-N121-01: CommercialDeliveryPayload Tests', () {
    test(
      '[HAPPY PATH] Genera payload de entrega digital con licencia válida',
      () {
        final CommercialDeliveryPayload payload = CommercialDeliveryPayload(
          orderId: 'ORD-9843-BM',
          deliveryType: CommercialDeliveryType.licenseKey,
          licenseKey: 'W269N-WFGWX-YVC9B-4J6C9-T83GX',
          instructions:
              'Ingrese a Configuración > Activación y pegue su clave digital.',
        );

        expect(payload.orderId, equals('ORD-9843-BM'));
        expect(payload.deliveryType, equals(CommercialDeliveryType.licenseKey));
        expect(payload.licenseKey, isNotNull);

        final Map<String, dynamic> json = payload.toJson();
        expect(json['license_key'], equals('W269N-WFGWX-YVC9B-4J6C9-T83GX'));

        final CommercialDeliveryPayload restored =
            CommercialDeliveryPayload.fromJson(json);
        expect(restored.orderId, equals(payload.orderId));
        expect(restored.licenseKey, equals(payload.licenseKey));
      },
    );

    test(
      '[HAPPY PATH] Genera payload con credenciales dinámicas de cuenta',
      () {
        final CommercialDeliveryPayload payload = CommercialDeliveryPayload(
          orderId: 'ORD-5544-BM',
          deliveryType: CommercialDeliveryType.dynamicAccount,
          accountCredentials: <String, String>{
            'email': 'user123@streaming.net',
            'password': 'SafePassword2024!',
            'profile': 'Perfil 1 (PIN: 1234)',
          },
          instructions: 'Inicie sesión con las credenciales adjuntas.',
        );

        expect(
          payload.accountCredentials?['email'],
          equals('user123@streaming.net'),
        );
        final Map<String, dynamic> json = payload.toJson();
        final CommercialDeliveryPayload restored =
            CommercialDeliveryPayload.fromJson(json);
        expect(
          restored.accountCredentials?['email'],
          equals('user123@streaming.net'),
        );
      },
    );

    test(
      '[SAD PATH §6] Payload sin ningún activo digital arroja CommercialValidationException',
      () {
        expect(
          () => CommercialDeliveryPayload(
            orderId: 'ORD-EMPTY',
            deliveryType: CommercialDeliveryType.licenseKey,
            instructions: 'Instrucciones sin licencia adjunta.',
          ),
          throwsA(
            isA<CommercialValidationException>().having(
              (CommercialValidationException e) => e.fieldName,
              'fieldName',
              equals('deliveryAsset'),
            ),
          ),
        );
      },
    );

    test(
      '[SAD PATH §6] orderId o instrucciones vacías arrojan CommercialValidationException',
      () {
        expect(
          () => CommercialDeliveryPayload(
            orderId: '',
            deliveryType: CommercialDeliveryType.licenseKey,
            licenseKey: 'KEY-123',
            instructions: 'Validas',
          ),
          throwsA(
            isA<CommercialValidationException>().having(
              (CommercialValidationException e) => e.fieldName,
              'fieldName',
              equals('orderId'),
            ),
          ),
        );

        expect(
          () => CommercialDeliveryPayload(
            orderId: 'ORD-1',
            deliveryType: CommercialDeliveryType.licenseKey,
            licenseKey: 'KEY-123',
            instructions: '   ',
          ),
          throwsA(
            isA<CommercialValidationException>().having(
              (CommercialValidationException e) => e.fieldName,
              'fieldName',
              equals('instructions'),
            ),
          ),
        );
      },
    );
  });
}
