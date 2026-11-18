/// data_dictionary_test.dart — Suite de Certificación Física de Contratos y Diccionario de Datos (§4, §6, §39, §58).
library;

import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

void main() {
  group('TASK-N118-01: DataContract & DataContractRegistry Pure Dart Core', () {
    late DataContractRegistry registry;

    setUp(() {
      registry = DataContractRegistry();
      registry.clear();
    });

    test(
      'Happy Path: Registra y recupera contratos con Single Path of Authority (§58)',
      () {
        final DataContract automotiveContract = const DataContract(
          contractId: 'CTR-AUTOMOTIVE-PART-V1',
          entityName: 'CatalogPart',
          authoritativeNode: 'ruedas',
          version: '1.0.0',
          fields: <String, FieldDefinition>{
            'sku': FieldDefinition(
              name: 'sku',
              type: CanonicalDataType.string,
              required: true,
            ),
            'brand': FieldDefinition(
              name: 'brand',
              type: CanonicalDataType.string,
              required: true,
            ),
            'price_usd': FieldDefinition(
              name: 'price_usd',
              type: CanonicalDataType.currency,
              required: true,
              minValue: 0.1,
              maxValue: 10000.0,
            ),
            'stock': FieldDefinition(
              name: 'stock',
              type: CanonicalDataType.integer,
              defaultValue: 0,
            ),
            'is_active': FieldDefinition(
              name: 'is_active',
              type: CanonicalDataType.boolean,
              defaultValue: true,
            ),
          },
        );

        registry.register(automotiveContract);

        expect(registry.hasContract('CTR-AUTOMOTIVE-PART-V1'), isTrue);
        expect(registry.hasEntity('CatalogPart'), isTrue);

        final DataContract retrieved = registry.getContract(
          'CTR-AUTOMOTIVE-PART-V1',
        );
        expect(retrieved.authoritativeNode, equals('ruedas'));
        expect(retrieved.fields.length, equals(5));

        // Coerción exitosa de payload crudo
        final Map<String, dynamic> coerced = retrieved
            .coerceAndValidate(<String, dynamic>{
              'sku': '  PART-12345  ',
              'brand': 'Bosch',
              'price_usd': '\$ 150,50 ',
              'stock': '42',
              'is_active': 'si',
            });

        expect(coerced['sku'], equals('PART-12345'));
        expect(coerced['brand'], equals('Bosch'));
        expect(coerced['price_usd'], equals(150.5));
        expect(coerced['stock'], equals(42));
        expect(coerced['is_active'], isTrue);
      },
    );

    test(
      'Sad Path (§58 SPA): Colisión de autoridad arroja AuthorityViolationException',
      () {
        final DataContract primaryContract = const DataContract(
          contractId: 'CTR-PART-RUEDAS',
          entityName: 'AutomotivePart',
          authoritativeNode: 'ruedas',
          fields: <String, FieldDefinition>{
            'sku': FieldDefinition(
              name: 'sku',
              type: CanonicalDataType.string,
              required: true,
            ),
          },
        );

        registry.register(primaryContract);

        // Intento de registrar la misma entidad desde un nodo foráneo no autorizado
        final DataContract rogueContract = const DataContract(
          contractId: 'CTR-PART-PRAXIS',
          entityName: 'AutomotivePart',
          authoritativeNode: 'praxis',
          fields: <String, FieldDefinition>{
            'sku': FieldDefinition(
              name: 'sku',
              type: CanonicalDataType.string,
              required: true,
            ),
          },
        );

        expect(
          () => registry.register(rogueContract),
          throwsA(
            isA<AuthorityViolationException>().having(
              (AuthorityViolationException e) => e.requestingNode,
              'requestingNode',
              equals('praxis'),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path (§6): Campo requerido ausente arroja MissingRequiredFieldException',
      () {
        final DataContract contract = const DataContract(
          contractId: 'CTR-STRICT-TEST',
          entityName: 'StrictEntity',
          authoritativeNode: 'Smart',
          fields: <String, FieldDefinition>{
            'required_id': FieldDefinition(
              name: 'required_id',
              type: CanonicalDataType.string,
              required: true,
            ),
          },
        );

        expect(
          () => contract.coerceAndValidate(<String, dynamic>{}),
          throwsA(isA<MissingRequiredFieldException>()),
        );
      },
    );

    test(
      'Sad Path (§6): Incompatibilidad de coerción arroja DataCoercionException',
      () {
        const FieldDefinition intField = FieldDefinition(
          name: 'quantity',
          type: CanonicalDataType.integer,
        );

        expect(
          () => intField.coerce('no_es_un_numero'),
          throwsA(isA<DataCoercionException>()),
        );

        const FieldDefinition boolField = FieldDefinition(
          name: 'flag',
          type: CanonicalDataType.boolean,
        );

        expect(
          () => boolField.coerce('palabra_aleatoria'),
          throwsA(isA<DataCoercionException>()),
        );

        const FieldDefinition uuidField = FieldDefinition(
          name: 'guid',
          type: CanonicalDataType.uuid,
        );

        expect(
          () => uuidField.coerce('12345-invalido'),
          throwsA(isA<DataCoercionException>()),
        );

        const FieldDefinition minMaxField = FieldDefinition(
          name: 'rating',
          type: CanonicalDataType.integer,
          minValue: 1,
          maxValue: 5,
        );

        expect(
          () => minMaxField.coerce(10),
          throwsA(isA<DataCoercionException>()),
        );
      },
    );

    test(
      'Sad Path (§6): Contrato no encontrado arroja UnknownContractException',
      () {
        expect(
          () => registry.getContract('CTR-INEXISTENTE'),
          throwsA(isA<UnknownContractException>()),
        );

        expect(
          () => registry.getContractForEntity('Inexistente'),
          throwsA(isA<UnknownContractException>()),
        );
      },
    );
  });

  group('TASK-N118-01: DataDictionary & CurrencyScaleGuard', () {
    late DataDictionary dict;

    setUp(() {
      dict = DataDictionary();
      dict.reset();
    });

    test('Happy Path: Normaliza encabezados y resuelve alias canónicos', () {
      expect(dict.resolveCanonicalField('CÓDIGO DE PARTE'), equals('sku'));
      expect(dict.resolveCanonicalField('NÚMERO OEM'), equals('oem'));
      expect(dict.resolveCanonicalField('FABRICANTE'), equals('brand'));
      expect(dict.resolveCanonicalField('PRECIO DÓLARES'), equals('price_usd'));
      expect(dict.resolveCanonicalField('EXISTENCIA'), equals('stock'));
      expect(dict.resolveCanonicalField('DIRECCIÓN'), equals('address'));
      expect(
        dict.resolveCanonicalField('TELÉFONO CELULAR'),
        equals('phone_e164'),
      );
    });

    test(
      'Happy Path: CurrencyScaleGuard valida precios dentro de magnitudes tolerables',
      () {
        final ScaleValidationResult usdOk = CurrencyScaleGuard.validateScale(
          price: 150.0,
          declaredCurrency: 'USD',
        );
        expect(usdOk.isValid, isTrue);

        final ScaleValidationResult copOk = CurrencyScaleGuard.validateScale(
          price: 450000.0,
          declaredCurrency: 'COP',
        );
        expect(copOk.isValid, isTrue);

        final double validated = CurrencyScaleGuard.enforceValidPrice(
          price: 25.99,
          declaredCurrency: 'USD',
        );
        expect(validated, equals(25.99));
      },
    );

    test(
      'Sad Path (§6): CurrencyScaleGuard detecta desbordamientos y anomalías de escala',
      () {
        // USD mayor a 500,000
        final ScaleValidationResult usdOverflow =
            CurrencyScaleGuard.validateScale(
              price: 1500000.0,
              declaredCurrency: 'USD',
            );
        expect(usdOverflow.isValid, isFalse);
        expect(usdOverflow.reason, equals('CURRENCY_MAGNITUDE_OVERFLOW'));

        // enforceValidPrice arroja CurrencyScaleException
        expect(
          () => CurrencyScaleGuard.enforceValidPrice(
            price: 99999999.0,
            declaredCurrency: 'USD',
          ),
          throwsA(isA<CurrencyScaleException>()),
        );

        // Precio cero o negativo arroja ArgumentError
        expect(
          () => CurrencyScaleGuard.validateScale(
            price: -50.0,
            declaredCurrency: 'USD',
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test(
      'Sad Path (§6): Dominio no reconocido arroja UnknownDomainException',
      () {
        expect(
          () => CanonicalDomain.fromString('dominio_imaginario_99'),
          throwsA(isA<UnknownDomainException>()),
        );
      },
    );
  });

  group('TASK-N118-02: SchemaMappingBridge & Tabular Ingestion', () {
    late DataContract catalogContract;

    setUp(() {
      catalogContract = const DataContract(
        contractId: 'CTR-INGEST-PARTS',
        entityName: 'CatalogIngestItem',
        authoritativeNode: 'ruedas',
        fields: <String, FieldDefinition>{
          'sku': FieldDefinition(
            name: 'sku',
            type: CanonicalDataType.string,
            required: true,
          ),
          'brand': FieldDefinition(
            name: 'brand',
            type: CanonicalDataType.string,
            required: true,
          ),
          'price_usd': FieldDefinition(
            name: 'price_usd',
            type: CanonicalDataType.currency,
            required: true,
            currencyCode: 'USD',
          ),
          'stock': FieldDefinition(
            name: 'stock',
            type: CanonicalDataType.integer,
            defaultValue: 0,
          ),
        },
      );
    });

    test(
      'Happy Path: Mapea encabezados heterogéneos y procesa filas tabulares',
      () {
        final SchemaMappingBridge bridge = SchemaMappingBridge(
          contract: catalogContract,
        );

        final List<List<dynamic>> rows = <List<dynamic>>[
          <dynamic>[
            'CÓDIGO DE PARTE',
            'FABRICANTE',
            'PRECIO DÓLARES',
            'CANTIDAD',
          ],
          <dynamic>['SKU-001', 'Brembo', '\$ 89.50', '15'],
          <dynamic>['SKU-002', 'Monroe', '120.00', '5'],
        ];

        final SchemaMappingResult result = bridge.processRows(rows);

        expect(result.headerMapping.hasAllRequired, isTrue);
        expect(result.successCount, equals(2));
        expect(result.rejectedCount, equals(0));
        expect(result.records[0]['sku'], equals('SKU-001'));
        expect(result.records[0]['brand'], equals('Brembo'));
        expect(result.records[0]['price_usd'], equals(89.5));
        expect(result.records[0]['stock'], equals(15));
      },
    );

    test('Happy Path: Procesa FastSheet directamente', () {
      final SchemaMappingBridge bridge = SchemaMappingBridge(
        contract: catalogContract,
      );

      final FastSheet sheet = const FastSheet(
        name: 'Inventario',
        rows: <List<dynamic>>[
          <dynamic>['referencia', 'marca', 'precio', 'stock'],
          <dynamic>['REF-99', 'Denso', '45.0', 10],
        ],
      );

      final SchemaMappingResult result = bridge.processSheet(sheet);
      expect(result.successCount, equals(1));
      expect(result.records.first['sku'], equals('REF-99'));
      expect(result.records.first['brand'], equals('Denso'));
    });

    test(
      'Sad Path (§6): Encabezados obligatorios ausentes en strictMode arrojan MissingColumnMappingException',
      () {
        final SchemaMappingBridge bridge = SchemaMappingBridge(
          contract: catalogContract,
          strictMode: true,
        );

        // Carece de la columna obligatoria 'brand' y 'price_usd'
        final List<List<dynamic>> incompleteRows = <List<dynamic>>[
          <dynamic>['sku', 'columna_irrelevante'],
          <dynamic>['SKU-001', 'dato'],
        ];

        expect(
          () => bridge.processRows(incompleteRows),
          throwsA(
            isA<MissingColumnMappingException>().having(
              (MissingColumnMappingException e) => e.missingFields,
              'missingFields',
              contains('brand'),
            ),
          ),
        );
      },
    );

    test(
      'Sad Path (§6): Error de coerción en strictMode arroja RowCoercionException',
      () {
        final SchemaMappingBridge bridge = SchemaMappingBridge(
          contract: catalogContract,
          strictMode: true,
        );

        final List<List<dynamic>> invalidRows = <List<dynamic>>[
          <dynamic>['sku', 'brand', 'price_usd'],
          <dynamic>['SKU-001', 'Brembo', 'precio_invalido_texto'],
        ];

        expect(
          () => bridge.processRows(invalidRows),
          throwsA(isA<RowCoercionException>()),
        );
      },
    );

    test(
      'Sad Path (§6): Anomalía de escala financiera en strictMode arroja RowCoercionException',
      () {
        final SchemaMappingBridge bridge = SchemaMappingBridge(
          contract: catalogContract,
          strictMode: true,
          enforceCurrencyScale: true,
        );

        final List<List<dynamic>> overflowRows = <List<dynamic>>[
          <dynamic>['sku', 'brand', 'price_usd'],
          <dynamic>[
            'SKU-001',
            'Brembo',
            '999999999.0',
          ], // Desborde de escala USD
        ];

        expect(
          () => bridge.processRows(overflowRows),
          throwsA(isA<RowCoercionException>()),
        );
      },
    );

    test(
      'Calm Error UX (§45): Modo no estricto acumula filas rechazadas sin abortar la ejecución',
      () {
        final SchemaMappingBridge bridge = SchemaMappingBridge(
          contract: catalogContract,
          strictMode: false,
        );

        final List<List<dynamic>> mixedRows = <List<dynamic>>[
          <dynamic>['sku', 'brand', 'price_usd', 'stock'],
          <dynamic>['SKU-VALIDO', 'Bosch', '45.0', 10],
          <dynamic>['SKU-INVALIDO', 'Bosch', 'no_es_precio', 10], // Corrupto
        ];

        final SchemaMappingResult result = bridge.processRows(mixedRows);
        expect(result.successCount, equals(1));
        expect(result.rejectedCount, equals(1));
        expect(result.rejectedRows.first.rowIndex, equals(2));
        expect(result.rejectedRows.first.isSuccess, isFalse);
      },
    );
  });
}
