import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('TASK-N32-03: Messaging Domain Axioms & Channels (§39)', () {
    group('E164PhoneValidator', () {
      test('Happy Path: Sanitizes formatted international phone numbers', () {
        expect(
          E164PhoneValidator.sanitize('+58 (414) 123-4567'),
          equals('+584141234567'),
        );
        expect(
          E164PhoneValidator.sanitize('0058 414 123 4567'),
          equals('+584141234567'),
        );
        expect(
          E164PhoneValidator.sanitize('+1 (555) 234-5678'),
          equals('+15552345678'),
        );
        expect(
          E164PhoneValidator.sanitize('+34.91.123.4567'),
          equals('+34911234567'),
        );
        expect(E164PhoneValidator.isValid('+584141234567'), isTrue);
      });

      test(
        'Sad Path (§6): Throws FormatException on alphabetic characters',
        () {
          expect(
            () => E164PhoneValidator.sanitize('+58414HELLO123'),
            throwsA(isA<FormatException>()),
          );
          expect(
            () => E164PhoneValidator.sanitize('+1800FLOWERS'),
            throwsA(isA<FormatException>()),
          );
          expect(E164PhoneValidator.isValid('+58414HELLO123'), isFalse);
        },
      );

      test(
        'Sad Path (§6): Throws FormatException on numbers without international country calling code',
        () {
          // Local numbers without + or 00 prefix
          expect(
            () => E164PhoneValidator.sanitize('04141234567'),
            throwsA(isA<FormatException>()),
          );
          expect(
            () => E164PhoneValidator.sanitize('1234567'),
            throwsA(isA<FormatException>()),
          );
          expect(E164PhoneValidator.isValid('04141234567'), isFalse);
        },
      );

      test(
        'Sad Path (§6): Throws FormatException on country codes starting with 0',
        () {
          expect(
            () => E164PhoneValidator.sanitize('+0123456789'),
            throwsA(isA<FormatException>()),
          );
        },
      );

      test(
        'Sad Path (§6): Throws FormatException on numbers too short (<7) or too long (>15 digits)',
        () {
          expect(
            () => E164PhoneValidator.sanitize('+12345'),
            throwsA(isA<FormatException>()),
          );
          expect(
            () => E164PhoneValidator.sanitize('+12345678901234567'),
            throwsA(isA<FormatException>()),
          );
        },
      );

      test(
        'Sad Path (§6): Throws FormatException on empty strings or illegal symbols',
        () {
          expect(
            () => E164PhoneValidator.sanitize(''),
            throwsA(isA<FormatException>()),
          );
          expect(
            () => E164PhoneValidator.sanitize('   '),
            throwsA(isA<FormatException>()),
          );
          expect(
            () => E164PhoneValidator.sanitize('+58414#123@456'),
            throwsA(isA<FormatException>()),
          );
        },
      );
    });

    group('WhatsApp DTOs', () {
      test(
        'Happy Path: WhatsAppTextMessage creates payload and roundtrips JSON',
        () {
          final msg = WhatsAppTextMessage(
            to: '+584141234567',
            body: 'Estimado cliente, su pedido está listo.',
            previewUrl: true,
          );

          final json = msg.toJson();
          expect(json['messaging_product'], equals('whatsapp'));
          expect(json['to'], equals('+584141234567'));
          expect(
            json['text']['body'],
            equals('Estimado cliente, su pedido está listo.'),
          );
          expect(json['text']['preview_url'], isTrue);

          final parsed = WhatsAppTextMessage.fromJson(json);
          expect(parsed, equals(msg));
        },
      );

      test('Happy Path: WhatsAppTemplateMessage creates valid payload', () {
        final tpl = WhatsAppTemplateMessage(
          to: '+584141234567',
          templateName: 'order_status_update',
          languageCode: 'es',
        );

        final json = tpl.toJson();
        expect(json['template']['name'], equals('order_status_update'));
        expect(json['template']['language']['code'], equals('es'));

        final parsed = WhatsAppTemplateMessage.fromJson(json);
        expect(parsed, equals(tpl));
      });

      test('Happy Path: WhatsAppMediaMessage supports valid media types', () {
        final media = WhatsAppMediaMessage(
          to: '+584141234567',
          mediaType: 'image',
          mediaUrl: 'https://cdn.smart.com/images/part123.jpg',
          caption: 'Detalle de la pieza',
        );

        final json = media.toJson();
        expect(json['type'], equals('image'));
        expect(
          json['image']['link'],
          equals('https://cdn.smart.com/images/part123.jpg'),
        );
        expect(json['image']['caption'], equals('Detalle de la pieza'));

        final parsed = WhatsAppMediaMessage.fromJson(json);
        expect(parsed, equals(media));
      });

      test(
        'Sad Path (§6): Throws ArgumentError on empty or invalid WhatsApp fields',
        () {
          expect(
            () => WhatsAppTextMessage(to: '', body: 'Valid body'),
            throwsA(isA<ArgumentError>()),
          );
          expect(
            () => WhatsAppTextMessage(to: '+584141234567', body: '   '),
            throwsA(isA<ArgumentError>()),
          );
          expect(
            () =>
                WhatsAppTemplateMessage(to: '+584141234567', templateName: ''),
            throwsA(isA<ArgumentError>()),
          );
          expect(
            () => WhatsAppMediaMessage(
              to: '+584141234567',
              mediaType: 'unsupported_type',
              mediaUrl: 'https://foo.bar/baz.png',
            ),
            throwsA(isA<ArgumentError>()),
          );
          expect(
            () => WhatsAppMediaMessage(
              to: '+584141234567',
              mediaType: 'image',
              mediaUrl: '',
            ),
            throwsA(isA<ArgumentError>()),
          );
        },
      );
    });

    group('Telegram DTOs', () {
      test(
        'Happy Path: TelegramTextMessage and TelegramPhotoMessage serialization',
        () {
          final textMsg = TelegramTextMessage(
            chatId: '123456789',
            text: 'Alerta del sistema Antigravity',
            parseMode: 'MarkdownV2',
          );

          final textJson = textMsg.toJson();
          expect(textJson['chat_id'], equals('123456789'));
          expect(textJson['text'], equals('Alerta del sistema Antigravity'));
          expect(textJson['parse_mode'], equals('MarkdownV2'));

          final parsedText = TelegramTextMessage.fromJson(textJson);
          expect(parsedText, equals(textMsg));

          final photoMsg = TelegramPhotoMessage(
            chatId: '@smart_channel',
            photoUrl: 'https://cdn.smart.com/alert.png',
            caption: 'Foto del reporte',
          );
          final photoJson = photoMsg.toJson();
          expect(photoJson['chat_id'], equals('@smart_channel'));
          expect(photoJson['photo'], equals('https://cdn.smart.com/alert.png'));

          final parsedPhoto = TelegramPhotoMessage.fromJson(photoJson);
          expect(parsedPhoto, equals(photoMsg));
        },
      );

      test(
        'Sad Path (§6): Throws ArgumentError on empty Telegram properties',
        () {
          expect(
            () => TelegramTextMessage(chatId: '', text: 'Hello'),
            throwsA(isA<ArgumentError>()),
          );
          expect(
            () => TelegramTextMessage(chatId: '12345', text: '   '),
            throwsA(isA<ArgumentError>()),
          );
          expect(
            () => TelegramPhotoMessage(
              chatId: '',
              photoUrl: 'https://foo.bar/img.png',
            ),
            throwsA(isA<ArgumentError>()),
          );
          expect(
            () => TelegramPhotoMessage(chatId: '12345', photoUrl: ''),
            throwsA(isA<ArgumentError>()),
          );
        },
      );
    });

    group('Discord DTOs', () {
      test('Happy Path: DiscordMessage with Embeds and fields', () {
        final msg = DiscordMessage(
          content: 'Notificación de Auditoría',
          username: 'LogixBot',
          embeds: [
            DiscordEmbed(
              title: 'Auditoría N32',
              description: 'Pruebas puras ejecutadas con éxito',
              color: 0x00FF00,
              fields: [
                DiscordEmbedField(
                  name: 'Estado',
                  value: 'ÓPTIMO',
                  inline: true,
                ),
                DiscordEmbedField(
                  name: 'Odómetro',
                  value: '1.6%',
                  inline: true,
                ),
              ],
              footerText: 'Antigravity Core',
            ),
          ],
        );

        final json = msg.toJson();
        expect(json['content'], equals('Notificación de Auditoría'));
        expect(json['username'], equals('LogixBot'));
        expect(json['embeds'].length, equals(1));
        expect(json['embeds'][0]['title'], equals('Auditoría N32'));

        final parsed = DiscordMessage.fromJson(json);
        expect(parsed.content, equals(msg.content));
        expect(parsed.embeds.length, equals(1));
        expect(parsed.embeds[0].title, equals('Auditoría N32'));
      });

      test(
        'Sad Path (§6): Throws ArgumentError when DiscordMessage has neither content nor embeds',
        () {
          expect(
            () => DiscordMessage(content: null, embeds: const []),
            throwsA(isA<ArgumentError>()),
          );
          expect(
            () => DiscordMessage(content: '   ', embeds: const []),
            throwsA(isA<ArgumentError>()),
          );
          expect(
            () => DiscordEmbedField(name: '', value: 'Value'),
            throwsA(isA<ArgumentError>()),
          );
          expect(
            () => DiscordEmbedField(name: 'Name', value: ''),
            throwsA(isA<ArgumentError>()),
          );
        },
      );
    });
  });

  group('TASK-N32-04: Webhook HMAC Cryptographic Verifier (§39)', () {
    const testSecret = 'whsec_test_secret_key_1234567890';
    const testPayload =
        '{"event":"user.created","id":"usr_998877","timestamp":1793200138}';

    test(
      'Happy Path: Verifies authentic HMAC-SHA256 signature with sha256= prefix',
      () {
        final validSignature = WebhookHmacVerifier.computeSignature(
          testPayload,
          testSecret,
          includePrefix: true,
        );
        expect(validSignature.startsWith('sha256='), isTrue);

        final isValid = WebhookHmacVerifier.verify(
          testPayload,
          validSignature,
          testSecret,
        );
        expect(isValid, isTrue);

        // Verify top-level function as well
        expect(
          verifyHmacSha256(testPayload, validSignature, testSecret),
          isTrue,
        );
      },
    );

    test(
      'Happy Path: Verifies authentic HMAC-SHA256 signature without prefix (raw hex)',
      () {
        final rawSignature = WebhookHmacVerifier.computeSignature(
          testPayload,
          testSecret,
          includePrefix: false,
        );
        expect(rawSignature.startsWith('sha256='), isFalse);
        expect(rawSignature.length, equals(64));

        final isValid = WebhookHmacVerifier.verify(
          testPayload,
          rawSignature,
          testSecret,
        );
        expect(isValid, isTrue);
      },
    );

    test('Happy Path: Case insensitivity of hex digest in signature', () {
      final validSignature = WebhookHmacVerifier.computeSignature(
        testPayload,
        testSecret,
        includePrefix: true,
      );
      final upperSignature = validSignature.toUpperCase();

      expect(
        WebhookHmacVerifier.verify(testPayload, upperSignature, testSecret),
        isTrue,
      );
    });

    test(
      'Sad Path (§6): Returns false when signature is altered or tampered with',
      () {
        final validSignature = WebhookHmacVerifier.computeSignature(
          testPayload,
          testSecret,
        );
        // Alter one character in signature
        final tampered =
            '${validSignature.substring(0, validSignature.length - 1)}0';
        expect(
          WebhookHmacVerifier.verify(testPayload, tampered, testSecret),
          isFalse,
        );
      },
    );

    test('Sad Path (§6): Returns false when payload is altered', () {
      final validSignature = WebhookHmacVerifier.computeSignature(
        testPayload,
        testSecret,
      );
      const tamperedPayload =
          '{"event":"user.created","id":"usr_HACKED","timestamp":1793200138}';
      expect(
        WebhookHmacVerifier.verify(tamperedPayload, validSignature, testSecret),
        isFalse,
      );
    });

    test(
      'Sad Path (§6): Returns false when signature is truncated or incomplete',
      () {
        final validSignature = WebhookHmacVerifier.computeSignature(
          testPayload,
          testSecret,
        );
        final truncated = validSignature.substring(0, 30);
        expect(
          WebhookHmacVerifier.verify(testPayload, truncated, testSecret),
          isFalse,
        );
      },
    );

    test('Sad Path (§6): Returns false on empty signature or empty secret', () {
      expect(WebhookHmacVerifier.verify(testPayload, '', testSecret), isFalse);
      expect(
        WebhookHmacVerifier.verify(testPayload, '   ', testSecret),
        isFalse,
      );
      expect(
        WebhookHmacVerifier.verify(testPayload, 'sha256=1234', ''),
        isFalse,
      );
    });

    test(
      'Sad Path (§6): Returns false on signature containing non-hexadecimal characters',
      () {
        final invalidHex =
            'sha256=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
        expect(
          WebhookHmacVerifier.verify(testPayload, invalidHex, testSecret),
          isFalse,
        );
      },
    );
  });
}
