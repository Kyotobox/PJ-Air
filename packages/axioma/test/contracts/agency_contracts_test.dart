// test/contracts/agency_contracts_test.dart — Certificación Canónica de Contratos Pure Dart (§39, §6, §4)

import 'package:axioma/contracts.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:test/test.dart';

void main() {
  group('Contratos Canónicos Pure Dart - Agencia y Pedidos Creativos (§39)', () {
    group('CreativeOrderDTO - Happy Paths', () {
      test('Construcción nominal con valores por defecto', () {
        final CreativeOrderDTO order = CreativeOrderDTO(
          id: 'ord_cr_001',
          tenantId: 'tenant_burgers',
          brief: 'Promoción 2x1 en hamburguesas smash para Instagram Reels.',
        );

        expect(order.id, equals('ord_cr_001'));
        expect(order.tenantId, equals('tenant_burgers'));
        expect(order.brief, contains('smash'));
        expect(order.visualPrompts, isEmpty);
        expect(order.aspectRatio, equals('1:1'));
        expect(order.status, equals('pending'));
        expect(order.createdAt.isUtc, isTrue);
      });

      test('Construcción completa, serialización y deserialización JSON', () {
        final DateTime fixedTime = DateTime.utc(2026, 11, 24, 12, 0, 0);
        final CreativeOrderDTO original = CreativeOrderDTO(
          id: 'ord_cr_002',
          tenantId: 'tenant_pizzeria',
          brief: 'Banner de apertura con logo y descuento 20%.',
          visualPrompts: <String>[
            'close-up pizza dripping cheese',
            'warm neon bakery lighting',
          ],
          aspectRatio: '9:16',
          status: 'processing',
          createdAt: fixedTime,
        );

        final Map<String, dynamic> json = original.toJson();
        expect(json['id'], equals('ord_cr_002'));
        expect(json['tenant_id'], equals('tenant_pizzeria'));
        expect(json['brief'], contains('descuento 20%'));
        expect(json['visual_prompts'], hasLength(2));
        expect(json['aspect_ratio'], equals('9:16'));
        expect(json['status'], equals('processing'));
        expect(json['created_at'], equals(fixedTime.toIso8601String()));

        final CreativeOrderDTO fromMap = CreativeOrderDTO.fromJson(json);
        expect(fromMap, equals(original));
        expect(fromMap.hashCode, equals(original.hashCode));
        expect(fromMap.visualPrompts, equals(original.visualPrompts));

        // Inmutabilidad de la lista
        expect(
          () => (fromMap.visualPrompts as dynamic).add('extra'),
          throwsUnsupportedError,
        );

        // String JSON
        final String jsonStr = original.toJsonString();
        final CreativeOrderDTO fromStr = CreativeOrderDTO.fromJsonString(
          jsonStr,
        );
        expect(fromStr, equals(original));
      });

      test('Compatibilidad camelCase en fromJson', () {
        final Map<String, dynamic> camelJson = <String, dynamic>{
          'id': 'ord_cr_camel',
          'tenantId': 'tenant_retail',
          'brief': 'Flyer de temporada navideña',
          'visualPrompts': <String>['snowflakes', 'gifts'],
          'aspectRatio': '16:9',
          'status': 'completed',
          'createdAt': '2026-11-24T10:00:00.000Z',
        };

        final CreativeOrderDTO order = CreativeOrderDTO.fromJson(camelJson);
        expect(order.id, equals('ord_cr_camel'));
        expect(order.tenantId, equals('tenant_retail'));
        expect(order.aspectRatio, equals('16:9'));
        expect(order.status, equals('completed'));
        expect(order.visualPrompts, hasLength(2));
      });

      test(
        'copyWith crea nuevas instancias inmutables con campos actualizados',
        () {
          final CreativeOrderDTO base = CreativeOrderDTO(
            id: 'ord_cr_base',
            tenantId: 'tenant_base',
            brief: 'Brief original',
          );

          final CreativeOrderDTO updated = base.copyWith(
            status: 'completed',
            aspectRatio: '4:5',
          );

          expect(updated.id, equals(base.id));
          expect(updated.tenantId, equals(base.tenantId));
          expect(updated.status, equals('completed'));
          expect(updated.aspectRatio, equals('4:5'));
          expect(base.status, equals('pending'));
        },
      );
    });

    group('CreativeOrderDTO - Sad Paths (§6 throwsA)', () {
      test('Constructor rechaza id vacío o en blanco', () {
        expect(
          () => CreativeOrderDTO(
            id: '   ',
            tenantId: 'tenant_01',
            brief: 'Brief válido',
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test('Constructor rechaza tenantId vacío o en blanco', () {
        expect(
          () => CreativeOrderDTO(
            id: 'ord_01',
            tenantId: '',
            brief: 'Brief válido',
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test('Constructor rechaza brief vacío o en blanco', () {
        expect(
          () => CreativeOrderDTO(
            id: 'ord_01',
            tenantId: 'tenant_01',
            brief: '  \t  ',
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test('Constructor rechaza aspectRatio o status vacío', () {
        expect(
          () => CreativeOrderDTO(
            id: 'ord_01',
            tenantId: 'tenant_01',
            brief: 'Brief válido',
            aspectRatio: '',
          ),
          throwsA(isA<ArgumentError>()),
        );

        expect(
          () => CreativeOrderDTO(
            id: 'ord_01',
            tenantId: 'tenant_01',
            brief: 'Brief válido',
            status: ' ',
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test('fromJson rechaza campos ausentes o vacíos con FormatException', () {
        // id ausente
        expect(
          () => CreativeOrderDTO.fromJson(<String, dynamic>{
            'tenant_id': 'tenant_01',
            'brief': 'Brief',
          }),
          throwsA(isA<FormatException>()),
        );

        // tenant_id ausente
        expect(
          () => CreativeOrderDTO.fromJson(<String, dynamic>{
            'id': 'ord_01',
            'brief': 'Brief',
          }),
          throwsA(isA<FormatException>()),
        );

        // brief ausente
        expect(
          () => CreativeOrderDTO.fromJson(<String, dynamic>{
            'id': 'ord_01',
            'tenant_id': 'tenant_01',
          }),
          throwsA(isA<FormatException>()),
        );
      });

      test(
        'fromJson rechaza visual_prompts corrupto (no lista o con tipos no string)',
        () {
          expect(
            () => CreativeOrderDTO.fromJson(<String, dynamic>{
              'id': 'ord_01',
              'tenant_id': 'tenant_01',
              'brief': 'Brief',
              'visual_prompts': 'no_es_lista',
            }),
            throwsA(isA<FormatException>()),
          );

          expect(
            () => CreativeOrderDTO.fromJson(<String, dynamic>{
              'id': 'ord_01',
              'tenant_id': 'tenant_01',
              'brief': 'Brief',
              'visual_prompts': <dynamic>['prompt_1', 12345],
            }),
            throwsA(isA<FormatException>()),
          );
        },
      );

      test('fromJson rechaza fecha created_at corrupta', () {
        expect(
          () => CreativeOrderDTO.fromJson(<String, dynamic>{
            'id': 'ord_01',
            'tenant_id': 'tenant_01',
            'brief': 'Brief',
            'created_at': 'fecha-invalida-corrupta',
          }),
          throwsA(isA<FormatException>()),
        );
      });

      test('fromJsonString rechaza JSON malformado', () {
        expect(
          () => CreativeOrderDTO.fromJsonString('{corrupt_json: true'),
          throwsA(isA<FormatException>()),
        );
      });
    });

    group('AgencySubscriptionDTO - Happy Paths', () {
      test('Construcción nominal y validación de cuotas', () {
        final DateTime futureExpiry = DateTime.utc(2027, 1, 1, 0, 0, 0);
        final AgencySubscriptionDTO sub = AgencySubscriptionDTO(
          merchantId: 'merchant_tacos',
          planTier: 'growth',
          monthlyQuota: 30,
          usedDesigns: 10,
          activeUntil: futureExpiry,
        );

        expect(sub.merchantId, equals('merchant_tacos'));
        expect(sub.planTier, equals('growth'));
        expect(sub.monthlyQuota, equals(30));
        expect(sub.usedDesigns, equals(10));
        expect(sub.remainingQuota, equals(20));
        expect(sub.hasQuota, isTrue);
        expect(sub.isActive(), isTrue);
      });

      test('Cuota consumida al 100% o superada', () {
        final DateTime futureExpiry = DateTime.utc(2027, 1, 1, 0, 0, 0);
        final AgencySubscriptionDTO subFull = AgencySubscriptionDTO(
          merchantId: 'merchant_full',
          planTier: 'starter',
          monthlyQuota: 10,
          usedDesigns: 10,
          activeUntil: futureExpiry,
        );
        expect(subFull.remainingQuota, equals(0));
        expect(subFull.hasQuota, isFalse);

        final AgencySubscriptionDTO subOver = AgencySubscriptionDTO(
          merchantId: 'merchant_over',
          planTier: 'starter',
          monthlyQuota: 10,
          usedDesigns: 12,
          activeUntil: futureExpiry,
        );
        expect(subOver.remainingQuota, equals(0));
        expect(subOver.hasQuota, isFalse);
      });

      test('Verificación de expiración temporal con isActive()', () {
        final DateTime pastExpiry = DateTime.utc(2020, 1, 1, 0, 0, 0);
        final AgencySubscriptionDTO expiredSub = AgencySubscriptionDTO(
          merchantId: 'merchant_old',
          planTier: 'starter',
          monthlyQuota: 5,
          activeUntil: pastExpiry,
        );

        expect(expiredSub.isActive(), isFalse);
        expect(expiredSub.isActive(at: DateTime.utc(2019, 6, 1)), isTrue);
      });

      test('Serialización y deserialización completa Map y String', () {
        final DateTime expiry = DateTime.utc(2026, 12, 31, 23, 59, 59);
        final AgencySubscriptionDTO original = AgencySubscriptionDTO(
          merchantId: 'merchant_cafe',
          planTier: 'agency',
          monthlyQuota: 100,
          usedDesigns: 25,
          activeUntil: expiry,
        );

        final Map<String, dynamic> json = original.toJson();
        expect(json['merchant_id'], equals('merchant_cafe'));
        expect(json['plan_tier'], equals('agency'));
        expect(json['monthly_quota'], equals(100));
        expect(json['used_designs'], equals(25));
        expect(json['active_until'], equals(expiry.toIso8601String()));

        final AgencySubscriptionDTO fromMap = AgencySubscriptionDTO.fromJson(
          json,
        );
        expect(fromMap, equals(original));
        expect(fromMap.hashCode, equals(original.hashCode));

        final String jsonStr = original.toJsonString();
        final AgencySubscriptionDTO fromStr =
            AgencySubscriptionDTO.fromJsonString(jsonStr);
        expect(fromStr, equals(original));
      });

      test('Compatibilidad camelCase en fromJson', () {
        final Map<String, dynamic> camelJson = <String, dynamic>{
          'merchantId': 'merchant_shoes',
          'planTier': 'enterprise',
          'monthlyQuota': 500,
          'usedDesigns': 50,
          'activeUntil': '2027-06-30T00:00:00.000Z',
        };

        final AgencySubscriptionDTO sub = AgencySubscriptionDTO.fromJson(
          camelJson,
        );
        expect(sub.merchantId, equals('merchant_shoes'));
        expect(sub.planTier, equals('enterprise'));
        expect(sub.monthlyQuota, equals(500));
        expect(sub.usedDesigns, equals(50));
      });

      test('copyWith preserva inmutabilidad', () {
        final AgencySubscriptionDTO original = AgencySubscriptionDTO(
          merchantId: 'merchant_a',
          planTier: 'starter',
          monthlyQuota: 10,
          activeUntil: DateTime.utc(2026, 12, 1),
        );

        final AgencySubscriptionDTO modified = original.copyWith(
          usedDesigns: 3,
          planTier: 'growth',
        );

        expect(modified.merchantId, equals(original.merchantId));
        expect(modified.planTier, equals('growth'));
        expect(modified.usedDesigns, equals(3));
        expect(original.usedDesigns, equals(0));
      });
    });

    group('AgencySubscriptionDTO - Sad Paths (§6 throwsA)', () {
      test('Constructor rechaza merchantId vacío', () {
        expect(
          () => AgencySubscriptionDTO(
            merchantId: '   ',
            planTier: 'growth',
            monthlyQuota: 20,
            activeUntil: DateTime.utc(2027, 1, 1),
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test('Constructor rechaza planTier vacío', () {
        expect(
          () => AgencySubscriptionDTO(
            merchantId: 'merchant_1',
            planTier: '',
            monthlyQuota: 20,
            activeUntil: DateTime.utc(2027, 1, 1),
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test('Constructor rechaza monthlyQuota negativa', () {
        expect(
          () => AgencySubscriptionDTO(
            merchantId: 'merchant_1',
            planTier: 'growth',
            monthlyQuota: -1,
            activeUntil: DateTime.utc(2027, 1, 1),
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test('Constructor rechaza usedDesigns negativo', () {
        expect(
          () => AgencySubscriptionDTO(
            merchantId: 'merchant_1',
            planTier: 'growth',
            monthlyQuota: 10,
            usedDesigns: -5,
            activeUntil: DateTime.utc(2027, 1, 1),
          ),
          throwsA(isA<ArgumentError>()),
        );
      });

      test('fromJson rechaza merchant_id o plan_tier ausente o vacío', () {
        expect(
          () => AgencySubscriptionDTO.fromJson(<String, dynamic>{
            'plan_tier': 'growth',
            'monthly_quota': 20,
            'active_until': '2027-01-01T00:00:00.000Z',
          }),
          throwsA(isA<FormatException>()),
        );

        expect(
          () => AgencySubscriptionDTO.fromJson(<String, dynamic>{
            'merchant_id': 'merchant_1',
            'monthly_quota': 20,
            'active_until': '2027-01-01T00:00:00.000Z',
          }),
          throwsA(isA<FormatException>()),
        );
      });

      test('fromJson rechaza cuotas corruptas o negativas', () {
        // String en vez de int
        expect(
          () => AgencySubscriptionDTO.fromJson(<String, dynamic>{
            'merchant_id': 'merchant_1',
            'plan_tier': 'growth',
            'monthly_quota': 'ilimitado',
            'active_until': '2027-01-01T00:00:00.000Z',
          }),
          throwsA(isA<FormatException>()),
        );

        // Cuota mensual negativa
        expect(
          () => AgencySubscriptionDTO.fromJson(<String, dynamic>{
            'merchant_id': 'merchant_1',
            'plan_tier': 'growth',
            'monthly_quota': -10,
            'active_until': '2027-01-01T00:00:00.000Z',
          }),
          throwsA(isA<FormatException>()),
        );

        // Diseños usados negativos
        expect(
          () => AgencySubscriptionDTO.fromJson(<String, dynamic>{
            'merchant_id': 'merchant_1',
            'plan_tier': 'growth',
            'monthly_quota': 20,
            'used_designs': -2,
            'active_until': '2027-01-01T00:00:00.000Z',
          }),
          throwsA(isA<FormatException>()),
        );
      });

      test('fromJson rechaza active_until ausente o corrupto', () {
        expect(
          () => AgencySubscriptionDTO.fromJson(<String, dynamic>{
            'merchant_id': 'merchant_1',
            'plan_tier': 'growth',
            'monthly_quota': 20,
          }),
          throwsA(isA<FormatException>()),
        );

        expect(
          () => AgencySubscriptionDTO.fromJson(<String, dynamic>{
            'merchant_id': 'merchant_1',
            'plan_tier': 'growth',
            'monthly_quota': 20,
            'active_until': 'fecha-no-valida',
          }),
          throwsA(isA<FormatException>()),
        );
      });

      test('fromJsonString rechaza JSON malformado', () {
        expect(
          () => AgencySubscriptionDTO.fromJsonString('{corrupted'),
          throwsA(isA<FormatException>()),
        );
      });
    });

    group('Persistencia Física SQLite (§4 Zero Mocks)', () {
      test('Inserción y recuperación de DTOs en base de datos real SQLite', () {
        final Database db = sqlite3.openInMemory();

        db.execute('''
          CREATE TABLE creative_orders (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL
          );
        ''');

        db.execute('''
          CREATE TABLE agency_subscriptions (
            merchant_id TEXT PRIMARY KEY,
            plan_tier TEXT NOT NULL,
            monthly_quota INTEGER NOT NULL,
            used_designs INTEGER NOT NULL,
            active_until TEXT NOT NULL
          );
        ''');

        final CreativeOrderDTO order = CreativeOrderDTO(
          id: 'ord_sql_001',
          tenantId: 'tenant_arepas',
          brief: 'Promoción combo 3 arepas reina pepiada',
          visualPrompts: <String>['arepa stuffed with avocado and chicken'],
          aspectRatio: '1:1',
          status: 'pending',
          createdAt: DateTime.utc(2026, 11, 24, 8, 0, 0),
        );

        final AgencySubscriptionDTO sub = AgencySubscriptionDTO(
          merchantId: 'tenant_arepas',
          planTier: 'growth',
          monthlyQuota: 50,
          usedDesigns: 5,
          activeUntil: DateTime.utc(2027, 5, 1, 0, 0, 0),
        );

        // Insertar en SQLite
        final PreparedStatement stmtOrder = db.prepare('''
          INSERT INTO creative_orders (id, tenant_id, payload_json, created_at)
          VALUES (?, ?, ?, ?);
        ''');
        stmtOrder.execute(<Object?>[
          order.id,
          order.tenantId,
          order.toJsonString(),
          order.createdAt.toIso8601String(),
        ]);
        stmtOrder.close();

        final PreparedStatement stmtSub = db.prepare('''
          INSERT INTO agency_subscriptions (merchant_id, plan_tier, monthly_quota, used_designs, active_until)
          VALUES (?, ?, ?, ?, ?);
        ''');
        stmtSub.execute(<Object?>[
          sub.merchantId,
          sub.planTier,
          sub.monthlyQuota,
          sub.usedDesigns,
          sub.activeUntil.toIso8601String(),
        ]);
        stmtSub.close();

        // Recuperar y reconstruir
        final ResultSet orderRows = db.select(
          'SELECT payload_json FROM creative_orders WHERE id = ?;',
          <Object?>['ord_sql_001'],
        );
        expect(orderRows, hasLength(1));
        final String recoveredOrderJson =
            orderRows.first['payload_json'] as String;
        final CreativeOrderDTO recoveredOrder = CreativeOrderDTO.fromJsonString(
          recoveredOrderJson,
        );
        expect(recoveredOrder, equals(order));

        final ResultSet subRows = db.select(
          'SELECT * FROM agency_subscriptions WHERE merchant_id = ?;',
          <Object?>['tenant_arepas'],
        );
        expect(subRows, hasLength(1));
        final Row subRow = subRows.first;
        final AgencySubscriptionDTO recoveredSub = AgencySubscriptionDTO(
          merchantId: subRow['merchant_id'] as String,
          planTier: subRow['plan_tier'] as String,
          monthlyQuota: subRow['monthly_quota'] as int,
          usedDesigns: subRow['used_designs'] as int,
          activeUntil: DateTime.parse(subRow['active_until'] as String),
        );
        expect(recoveredSub, equals(sub));

        db.close();
      });
    });
  });
}
