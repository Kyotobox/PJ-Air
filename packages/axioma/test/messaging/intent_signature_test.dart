// 🎯 Tests para IntentSignature — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios (throwsA),
// §12.b Límite 5 archivos, §40 Thin Client, §48 Cierre Autárquico.

import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:test/test.dart';
import 'package:axioma/messaging.dart';

void main() {
  group('IntentSignature — Happy Path & Canonical Hashing (§4)', () {
    test('construye firma canónica válida con valores estándar', () {
      final IntentSignature signature = IntentSignature(
        verb: 'consultar',
        object: 'precio',
        domain: 'catalog',
        confidence: 0.95,
        metadata: <String, dynamic>{'source': 'test'},
      );

      expect(signature.verb, equals('consultar'));
      expect(signature.object, equals('precio'));
      expect(signature.domain, equals('catalog'));
      expect(signature.confidence, equals(0.95));
      expect(signature.canonicalKey, equals('consultar\x00precio\x00catalog'));

      final String expectedHash = sha256
          .convert(utf8.encode('consultar\x00precio\x00catalog'))
          .toString();
      expect(signature.hash, equals(expectedHash));
      expect(signature.metadata['source'], equals('test'));
    });

    test('aplica normalización Unicode NFC y minúsculas', () {
      // 'e\u0301' (descompuesto NFD) vs 'é' (precompuesto NFC)
      final IntentSignature nfdSignature = IntentSignature(
        verb: '  ENVIAR  ',
        object: 'cafe\u0301  ', // NFD
        domain: '  CATALOG  ',
      );

      final IntentSignature nfcSignature = IntentSignature(
        verb: 'enviar',
        object: 'café', // NFC
        domain: 'catalog',
      );

      expect(nfdSignature.verb, equals('enviar'));
      expect(nfdSignature.object, equals('café'));
      expect(nfdSignature.domain, equals('catalog'));
      expect(nfdSignature.canonicalKey, equals(nfcSignature.canonicalKey));
      expect(nfdSignature.hash, equals(nfcSignature.hash));
      expect(nfdSignature, equals(nfcSignature));
      expect(nfdSignature.hashCode, equals(nfcSignature.hashCode));
    });

    test(
      'garantiza inmunidad a colisiones sintéticas mediante delimitador nulo',
      () {
        // Caso clásico de colisión sin delimitador: 'ab' + 'c' == 'a' + 'bc'
        final IntentSignature sig1 = IntentSignature(
          verb: 'ab',
          object: 'c',
          domain: 'shop',
        );

        final IntentSignature sig2 = IntentSignature(
          verb: 'a',
          object: 'bc',
          domain: 'shop',
        );

        expect(sig1.canonicalKey, equals('ab\x00c\x00shop'));
        expect(sig2.canonicalKey, equals('a\x00bc\x00shop'));
        expect(sig1.canonicalKey, isNot(equals(sig2.canonicalKey)));
        expect(sig1.hash, isNot(equals(sig2.hash)));
        expect(sig1, isNot(equals(sig2)));
      },
    );

    test('serialización y deserialización JSON íntegra (round-trip)', () {
      final IntentSignature original = IntentSignature(
        verb: 'comprar',
        object: 'SKU-1234',
        domain: 'ecommerce',
        confidence: 0.88,
        metadata: <String, dynamic>{'qty': 2, 'channel': 'whatsapp'},
      );

      final Map<String, dynamic> json = original.toJson();
      final IntentSignature restored = IntentSignature.fromJson(json);

      expect(restored.verb, equals(original.verb));
      expect(restored.object, equals(original.object));
      expect(restored.domain, equals(original.domain));
      expect(restored.canonicalKey, equals(original.canonicalKey));
      expect(restored.hash, equals(original.hash));
      expect(restored.confidence, equals(original.confidence));
      expect(restored.metadata['qty'], equals(2));
      expect(restored, equals(original));
    });

    test('integración con Turn0IntentRouter emite firmas coherentes', () {
      const Turn0IntentRouter router = Turn0IntentRouter();
      final InboundMessage message = InboundMessage(
        channel: ChannelType.whatsapp,
        senderId: '+584120000000',
        text: 'Quiero comprar 3 unidades de SKU-BRAKE-001',
        providerMessageId: 'msg-01',
        timestamp: DateTime.now(),
      );

      final IntentSignature signature = router.routeSignature(
        message,
        domain: 'automotive',
      );

      expect(signature.verb, equals('buy'));
      expect(signature.object, equals('sku-brake-001'));
      expect(signature.domain, equals('automotive'));
      expect(
        signature.canonicalKey,
        equals('buy\x00sku-brake-001\x00automotive'),
      );
      expect(signature.confidence, equals(1.0));
      expect(signature.metadata['action'], equals('purchase_sku'));
    });
  });

  group('IntentSignature — Sad Paths & Boundary Assertions (§6)', () {
    test('rechaza verbo vacío arrojando ArgumentError', () {
      expect(
        () => IntentSignature(verb: '', object: 'precio'),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('rechaza verbo compuesto solo por espacios en blanco', () {
      expect(
        () => IntentSignature(verb: '   \t  \n ', object: 'precio'),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('rechaza objeto vacío arrojando ArgumentError', () {
      expect(
        () => IntentSignature(verb: 'consultar', object: ''),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('rechaza objeto compuesto solo por espacios en blanco', () {
      expect(
        () => IntentSignature(verb: 'consultar', object: '   '),
        throwsA(isA<ArgumentError>()),
      );
    });

    test(
      'rechaza inyección de caracteres nulos en verbo, objeto o dominio',
      () {
        expect(
          () => IntentSignature(verb: 'hack\x00verbo', object: 'normal'),
          throwsA(isA<ArgumentError>()),
        );
        expect(
          () => IntentSignature(verb: 'normal', object: 'spoof\x00objeto'),
          throwsA(isA<ArgumentError>()),
        );
        expect(
          () => IntentSignature(
            verb: 'normal',
            object: 'normal',
            domain: 'evil\x00domain',
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test('rechaza valores de confianza fuera de los límites [0.0, 1.0]', () {
      expect(
        () => IntentSignature(
          verb: 'consultar',
          object: 'stock',
          confidence: -0.01,
        ),
        throwsA(isA<ArgumentError>()),
      );
      expect(
        () => IntentSignature(
          verb: 'consultar',
          object: 'stock',
          confidence: 1.01,
        ),
        throwsA(isA<ArgumentError>()),
      );
    });
  });
}
