// 🎯 Canonical Discord Envelope Adapter & Schema Versioning Test Suite — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios,
// §12.b Límite 5 archivos, §39 Pure Dart Core, §43 Paridad Test-to-Prod, §48 Cierre Autárquico.
library;

import 'dart:convert';
import 'package:cryptography/cryptography.dart';
import 'package:test/test.dart';

import 'package:axioma/axioma.dart';

void main() {
  group('DiscordEnvelopeAdapter & Envelope Versioning (§4, §6, §12.b, §39, §48)', () {
    late DiscordEnvelopeAdapter adapter;

    setUp(() {
      adapter = DiscordEnvelopeAdapter();
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 1. HAPPY PATH: INBOUND DISCORD WEBHOOKS & INTERACTIONS
    // ══════════════════════════════════════════════════════════════════════════
    group('Happy Path: Inbound Discord Webhooks & Messages', () {
      test(
        'parses standard Discord text webhook message into InboundMessage',
        () {
          final Map<String, dynamic> rawWebhook = <String, dynamic>{
            'id': '104992837465928374',
            'channel_id': '987654321098765432',
            'content':
                'Hola, ¿tienen amortiguadores delanteros para Civic 2010?',
            'author': <String, dynamic>{
              'id': '223344556677889900',
              'username': 'mecanico_alfa',
              'global_name': 'Carlos Mecánico',
              'discriminator': '0',
            },
            'timestamp': '2026-11-10T05:00:00.000Z',
          };

          expect(adapter.isDiscordPayload(rawWebhook), isTrue);
          final InboundMessage msg = adapter.toInboundMessage(rawWebhook);

          expect(msg.channel, equals(ChannelType.discord));
          expect(msg.schemaVersion, equals('1.0.0'));
          expect(msg.senderId, equals('223344556677889900'));
          expect(msg.senderName, equals('Carlos Mecánico'));
          expect(
            msg.text,
            equals('Hola, ¿tienen amortiguadores delanteros para Civic 2010?'),
          );
          expect(msg.mediaUrl, isNull);
          expect(msg.providerMessageId, equals('104992837465928374'));
          expect(msg.timestamp.isUtc, isTrue);
          expect(msg.rawPayload, equals(rawWebhook));
        },
      );

      test('parses Discord message with attachments extracting mediaUrl', () {
        final Map<String, dynamic> rawWebhook = <String, dynamic>{
          'id': '104992837465928375',
          'content': 'Foto de la pieza dañada',
          'author': <String, dynamic>{
            'id': '334455667788990011',
            'username': 'taller_norte',
          },
          'attachments': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'att_101',
              'url': 'https://cdn.discordapp.com/attachments/987/101/pieza.png',
              'filename': 'pieza.png',
            },
          ],
          'timestamp': 1700015000,
        };

        final InboundMessage msg = adapter.toInboundMessage(rawWebhook);
        expect(msg.providerMessageId, equals('104992837465928375'));
        expect(msg.text, equals('Foto de la pieza dañada'));
        expect(
          msg.mediaUrl,
          equals('https://cdn.discordapp.com/attachments/987/101/pieza.png'),
        );
        expect(msg.senderName, equals('taller_norte'));
      });

      test(
        'parses Discord message with embeds extracting title and image url',
        () {
          final Map<String, dynamic> rawWebhook = <String, dynamic>{
            'id': '104992837465928376',
            'author': <String, dynamic>{
              'id': '445566778899001122',
              'username': 'store_bot',
            },
            'embeds': <Map<String, dynamic>>[
              <String, dynamic>{
                'title': 'Catálogo de Repuestos',
                'description': 'Consulte disponibilidad de inventario',
                'image': <String, dynamic>{
                  'url': 'https://cdn.discordapp.com/embeds/catalog.jpg',
                },
              },
            ],
            'created_at': '2026-11-10T05:10:00Z',
          };

          final InboundMessage msg = adapter.toInboundMessage(rawWebhook);
          expect(msg.providerMessageId, equals('104992837465928376'));
          expect(msg.text, equals('Consulte disponibilidad de inventario'));
          expect(
            msg.mediaUrl,
            equals('https://cdn.discordapp.com/embeds/catalog.jpg'),
          );
        },
      );

      test('parses Discord slash command interaction (type 2)', () {
        final Map<String, dynamic> rawWebhook = <String, dynamic>{
          'type': 2,
          'id': 'int_9988776655',
          'data': <String, dynamic>{'name': 'consultar_catalogo'},
          'member': <String, dynamic>{
            'user': <String, dynamic>{
              'id': '556677889900112233',
              'username': 'cliente_vip',
            },
            'nick': 'Cliente VIP (Caracas)',
          },
          'timestamp': '2026-11-10T05:15:00Z',
        };

        final InboundMessage msg = adapter.toInboundMessage(rawWebhook);
        expect(msg.providerMessageId, equals('int_9988776655'));
        expect(msg.text, equals('/consultar_catalogo'));
        expect(msg.senderId, equals('556677889900112233'));
        expect(msg.senderName, equals('Cliente VIP (Caracas)'));
      });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 2. HAPPY PATH: OUTBOUND DISCORD & BIDIRECTIONAL MAPPINGS
    // ══════════════════════════════════════════════════════════════════════════
    group('Happy Path: Outbound Discord Messages', () {
      test('converts OutboundMessage to DiscordMessage and payload', () {
        final OutboundMessage outbound = OutboundMessage(
          channel: ChannelType.discord,
          recipientId: '987654321098765432',
          text: 'Disponemos de 4 unidades de pastillas de freno en inventario.',
          metadata: <String, dynamic>{
            'username': 'Smart Bot',
            'avatar_url': 'https://cdn.smart.dev/bot.png',
          },
        );

        final DiscordMessage discordMsg = adapter.toDiscordMessage(outbound);
        expect(
          discordMsg.content,
          equals(
            'Disponemos de 4 unidades de pastillas de freno en inventario.',
          ),
        );
        expect(discordMsg.username, equals('Smart Bot'));
        expect(discordMsg.avatarUrl, equals('https://cdn.smart.dev/bot.png'));
        expect(discordMsg.embeds, isEmpty);

        final Map<String, dynamic> payload = adapter.toPayload(outbound);
        expect(
          payload['content'],
          equals(
            'Disponemos de 4 unidades de pastillas de freno en inventario.',
          ),
        );
        expect(payload['username'], equals('Smart Bot'));
        expect(payload['avatar_url'], equals('https://cdn.smart.dev/bot.png'));

        // Bidirectional roundtrip fromDiscordMessage
        final OutboundMessage roundtrip = adapter.fromDiscordMessage(
          discordMsg,
          recipientId: '987654321098765432',
        );
        expect(roundtrip.channel, equals(ChannelType.discord));
        expect(roundtrip.recipientId, equals('987654321098765432'));
        expect(roundtrip.text, equals(outbound.text));
        expect(roundtrip.metadata['username'], equals('Smart Bot'));
      });

      test(
        'converts OutboundMessage with media to DiscordMessage with embed',
        () {
          final OutboundMessage outbound = OutboundMessage(
            channel: ChannelType.discord,
            recipientId: '987654321098765432',
            text: 'Ficha técnica del producto',
            mediaUrl: 'https://cdn.smart.dev/specs/frenos_corolla.pdf',
          );

          final DiscordMessage discordMsg = adapter.toDiscordMessage(outbound);
          expect(discordMsg.content, equals('Ficha técnica del producto'));
          expect(discordMsg.embeds.length, equals(1));
          expect(
            discordMsg.embeds.first.url,
            equals('https://cdn.smart.dev/specs/frenos_corolla.pdf'),
          );
          expect(
            discordMsg.embeds.first.title,
            equals('Ficha técnica del producto'),
          );
        },
      );
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 3. SCHEMA VERSIONING & DEDUPLICATED ACK DTO (§4, §39)
    // ══════════════════════════════════════════════════════════════════════════
    group('Schema Versioning & DeduplicatedAck (§4, §39)', () {
      test(
        'InboundMessage and OutboundMessage enforce and serialize schemaVersion',
        () {
          final InboundMessage inbound = InboundMessage(
            schemaVersion: '1.2.0',
            channel: ChannelType.discord,
            senderId: 'user_1',
            text: 'Test',
            providerMessageId: 'msg_1',
            timestamp: DateTime.now().toUtc(),
          );

          expect(inbound.schemaVersion, equals('1.2.0'));
          final Map<String, dynamic> jsonIn = inbound.toJson();
          expect(jsonIn['schema_version'], equals('1.2.0'));

          final InboundMessage roundtripIn = InboundMessage.fromJson(jsonIn);
          expect(roundtripIn.schemaVersion, equals('1.2.0'));

          final OutboundMessage outbound = OutboundMessage(
            schemaVersion: '1.1.0',
            channel: ChannelType.discord,
            recipientId: 'user_1',
            text: 'Respuesta',
          );
          expect(outbound.schemaVersion, equals('1.1.0'));
          final Map<String, dynamic> jsonOut = outbound.toJson();
          expect(jsonOut['schema_version'], equals('1.1.0'));

          final OutboundMessage roundtripOut = OutboundMessage.fromJson(
            jsonOut,
          );
          expect(roundtripOut.schemaVersion, equals('1.1.0'));
        },
      );

      test('DeduplicatedAck creates, serializes and deserializes properly', () {
        final DateTime now = DateTime.now().toUtc();
        final DeduplicatedAck ack = DeduplicatedAck(
          schemaVersion: '1.0.0',
          channel: ChannelType.discord,
          providerMessageId: 'disc_msg_8877',
          timestamp: now,
          status: 'deduplicated',
          metadata: <String, dynamic>{
            'attempt': 2,
            'origin': 'webhook_gateway',
          },
        );

        expect(ack.schemaVersion, equals('1.0.0'));
        expect(ack.channel, equals(ChannelType.discord));
        expect(ack.providerMessageId, equals('disc_msg_8877'));
        expect(ack.status, equals('deduplicated'));
        expect(ack.metadata['attempt'], equals(2));

        final Map<String, dynamic> json = ack.toJson();
        expect(json['schema_version'], equals('1.0.0'));
        expect(json['channel'], equals('discord'));
        expect(json['provider_message_id'], equals('disc_msg_8877'));
        expect(json['status'], equals('deduplicated'));

        final DeduplicatedAck roundtrip = DeduplicatedAck.fromJson(json);
        expect(roundtrip, equals(ack));
        expect(roundtrip.hashCode, equals(ack.hashCode));
      });

      test(
        'InboundMessage generates DeduplicatedAck via toDeduplicatedAck()',
        () {
          final InboundMessage msg = InboundMessage(
            channel: ChannelType.discord,
            senderId: 'disc_user_99',
            senderName: 'Mecánico 99',
            text: 'Consulta de repuesto',
            providerMessageId: 'prov_id_100',
            timestamp: DateTime.now().toUtc(),
          );

          final DeduplicatedAck ack = msg.toDeduplicatedAck();
          expect(ack.channel, equals(ChannelType.discord));
          expect(ack.providerMessageId, equals('prov_id_100'));
          expect(ack.status, equals('deduplicated'));
          expect(ack.metadata['sender_id'], equals('disc_user_99'));
          expect(ack.metadata['sender_name'], equals('Mecánico 99'));
        },
      );

      test(
        'processWebhookIdempotent returns InboundMessage on first call and DeduplicatedAck on duplicate',
        () {
          final Map<String, dynamic> rawWebhook = <String, dynamic>{
            'id': 'idem_msg_001',
            'content': 'Solicitud de batería 12V',
            'author': <String, dynamic>{
              'id': 'user_idem',
              'username': 'idem_client',
            },
            'timestamp': '2026-11-10T05:20:00Z',
          };

          // Primera llamada: mensaje nuevo
          final Object firstResult = adapter.processWebhookIdempotent(
            rawWebhook,
          );
          expect(firstResult, isA<InboundMessage>());
          final InboundMessage inMsg = firstResult as InboundMessage;
          expect(inMsg.providerMessageId, equals('idem_msg_001'));

          // Segunda llamada con mismo message_id: deduplicación idempotente
          final Object secondResult = adapter.processWebhookIdempotent(
            rawWebhook,
          );
          expect(secondResult, isA<DeduplicatedAck>());
          final DeduplicatedAck ack = secondResult as DeduplicatedAck;
          expect(ack.providerMessageId, equals('idem_msg_001'));
          expect(ack.channel, equals(ChannelType.discord));
          expect(ack.status, equals('duplicate'));
        },
      );
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 4. HAPPY PATH: REAL CRYPTOGRAPHIC SIGNATURE VERIFICATION (§4 Pure Dart)
    // ══════════════════════════════════════════════════════════════════════════
    group('Happy Path: Cryptographic Signature Verification (§4 Pure Dart)', () {
      test(
        'verifies real Ed25519 signature mathematically using cryptography package',
        () async {
          final Ed25519 algorithm = Ed25519();
          final SimpleKeyPair keyPair = await algorithm.newKeyPair();
          final SimplePublicKey pubKey = await keyPair.extractPublicKey();

          final String publicKeyHex = pubKey.bytes
              .map((int b) => b.toRadixString(16).padLeft(2, '0'))
              .join();

          const String timestamp = '1700020000';
          final Map<String, dynamic> rawWebhook = <String, dynamic>{
            'id': 'disc_crypto_001',
            'content': 'Mensaje autenticado con Ed25519',
            'author': <String, dynamic>{
              'id': 'user_crypto_1',
              'username': 'crypto_user',
            },
          };
          final String rawBody = jsonEncode(rawWebhook);
          final String messageToSign = '$timestamp$rawBody';

          final Signature signature = await algorithm.sign(
            utf8.encode(messageToSign),
            keyPair: keyPair,
          );

          final String signatureHex = signature.bytes
              .map((int b) => b.toRadixString(16).padLeft(2, '0'))
              .join();

          final Map<String, String> headers = <String, String>{
            'X-Signature-Ed25519': signatureHex,
            'X-Signature-Timestamp': timestamp,
          };

          // Verificación asincrónica de la firma
          await DiscordEnvelopeAdapter.validateEd25519Signature(
            rawBody: rawBody,
            headers: headers,
            publicKeyHex: publicKeyHex,
          );

          // Verificación integrada en toInboundMessageVerified
          final InboundMessage msg = await adapter.toInboundMessageVerified(
            rawWebhook,
            headers: headers,
            publicKeyHex: publicKeyHex,
            rawBody: rawBody,
          );

          expect(msg.providerMessageId, equals('disc_crypto_001'));
          expect(msg.text, equals('Mensaje autenticado con Ed25519'));
        },
      );

      test('verifies valid HMAC-SHA256 and Bot token authentication', () {
        const String secret = 'discord_hmac_secret_key_prod_2026';
        const String botToken = 'my_discord_bot_secret_token_123';

        final Map<String, dynamic> rawWebhook = <String, dynamic>{
          'id': 'disc_hmac_001',
          'content': 'Mensaje verificado con HMAC y Bot Token',
          'author': <String, dynamic>{
            'id': 'user_bot_1',
            'username': 'bot_admin',
          },
        };
        final String rawBody = jsonEncode(rawWebhook);
        final String hmacDigest = WebhookSignatureValidator.computeHubSignature(
          rawBody,
          secret,
          includePrefix: true,
        );

        final Map<String, String> headers = <String, String>{
          'X-Signature-256': hmacDigest,
          'Authorization': 'Bot $botToken',
          'X-Discord-Secret-Token': 'secret_pass_xyz',
        };

        final InboundMessage msg = adapter.toInboundMessage(
          rawWebhook,
          headers: headers,
          rawBody: rawBody,
          hmacSecret: secret,
          botToken: botToken,
          secretToken: 'secret_pass_xyz',
        );

        expect(msg.providerMessageId, equals('disc_hmac_001'));
      });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 5. SAD PATH: MUTILATED PAYLOADS (§6)
    // ══════════════════════════════════════════════════════════════════════════
    group('Sad Path (§6): Mutilated & Corrupt Payloads', () {
      test('throws DiscordAdapterException on empty payload', () {
        expect(
          () => adapter.toInboundMessage(<String, dynamic>{}),
          throwsA(isA<DiscordAdapterException>()),
        );
      });

      test('throws DiscordAdapterException on unrecognized structure', () {
        expect(
          () => adapter.toInboundMessage(<String, dynamic>{
            'unknown_system': true,
            'data': 42,
          }),
          throwsA(isA<DiscordAdapterException>()),
        );
      });

      test('throws DiscordAdapterException on missing id / message_id', () {
        expect(
          () => adapter.toInboundMessage(<String, dynamic>{
            'content': 'Sin identificador',
            'author': <String, dynamic>{'id': 'user_1'},
          }),
          throwsA(isA<DiscordAdapterException>()),
        );

        expect(
          () => adapter.toInboundMessage(<String, dynamic>{
            'id': '   ',
            'content': 'Id con solo espacios',
            'author': <String, dynamic>{'id': 'user_1'},
          }),
          throwsA(isA<DiscordAdapterException>()),
        );
      });

      test(
        'throws DiscordAdapterException on missing or empty author/user',
        () {
          expect(
            () => adapter.toInboundMessage(<String, dynamic>{
              'id': 'msg_no_author',
              'content': 'Mensaje sin autor',
            }),
            throwsA(isA<DiscordAdapterException>()),
          );

          expect(
            () => adapter.toInboundMessage(<String, dynamic>{
              'id': 'msg_empty_author',
              'content': 'Mensaje con autor vacío',
              'author': <String, dynamic>{'id': ''},
            }),
            throwsA(isA<DiscordAdapterException>()),
          );
        },
      );

      test(
        'throws DiscordAdapterException on mutilated payload without text, embeds or attachments',
        () {
          expect(
            () => adapter.toInboundMessage(<String, dynamic>{
              'id': 'msg_mutilated',
              'content': '   ',
              'author': <String, dynamic>{'id': 'user_1', 'username': 'test'},
              'embeds': <dynamic>[],
              'attachments': <dynamic>[],
            }),
            throwsA(isA<DiscordAdapterException>()),
          );
        },
      );

      test('throws DiscordAdapterException on corrupted date format', () {
        expect(
          () => adapter.toInboundMessage(<String, dynamic>{
            'id': 'msg_bad_date',
            'content': 'Fecha corrupta',
            'author': <String, dynamic>{'id': 'user_1'},
            'timestamp': 'not-a-valid-date-format-999',
          }),
          throwsA(isA<DiscordAdapterException>()),
        );
      });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 6. SAD PATH: INVALID SIGNATURES & TOKENS (§6)
    // ══════════════════════════════════════════════════════════════════════════
    group('Sad Path (§6): Invalid Signatures & Authentication', () {
      test(
        'throws DiscordSignatureException on missing Ed25519 signature headers',
        () {
          const String dummyPubKey =
              '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

          expect(
            () => adapter.toInboundMessage(
              <String, dynamic>{
                'id': 'msg_sig_test',
                'content': 'Test',
                'author': <String, dynamic>{'id': 'u1'},
              },
              headers: <String, String>{},
              publicKeyHex: dummyPubKey,
            ),
            throwsA(isA<DiscordSignatureException>()),
          );
        },
      );

      test(
        'throws DiscordSignatureException on truncated or malformed Ed25519 hex signature',
        () {
          const String dummyPubKey =
              '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

          expect(
            () => adapter.toInboundMessage(
              <String, dynamic>{
                'id': 'msg_sig_test',
                'content': 'Test',
                'author': <String, dynamic>{'id': 'u1'},
              },
              headers: <String, String>{
                'X-Signature-Ed25519': 'short_sig',
                'X-Signature-Timestamp': '1700000000',
              },
              publicKeyHex: dummyPubKey,
            ),
            throwsA(isA<DiscordSignatureException>()),
          );
        },
      );

      test('throws DiscordSignatureException on malformed public key hex', () {
        expect(
          () => adapter.toInboundMessage(
            <String, dynamic>{
              'id': 'msg_sig_test',
              'content': 'Test',
              'author': <String, dynamic>{'id': 'u1'},
            },
            headers: <String, String>{
              'X-Signature-Ed25519':
                  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
                  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
              'X-Signature-Timestamp': '1700000000',
            },
            publicKeyHex: 'short_key',
          ),
          throwsA(isA<DiscordSignatureException>()),
        );
      });

      test(
        'throws DiscordSignatureException on mathematically invalid Ed25519 signature',
        () async {
          final Ed25519 algorithm = Ed25519();
          final SimpleKeyPair keyPair = await algorithm.newKeyPair();
          final SimplePublicKey pubKey = await keyPair.extractPublicKey();

          final String publicKeyHex = pubKey.bytes
              .map((int b) => b.toRadixString(16).padLeft(2, '0'))
              .join();

          // Firma forjada / inválida (128 caracteres hexadecimales 'f')
          final String forgedSignatureHex = 'f' * 128;

          final Map<String, String> headers = <String, String>{
            'X-Signature-Ed25519': forgedSignatureHex,
            'X-Signature-Timestamp': '1700000000',
          };

          expect(
            () => DiscordEnvelopeAdapter.validateEd25519Signature(
              rawBody: '{"test":true}',
              headers: headers,
              publicKeyHex: publicKeyHex,
            ),
            throwsA(isA<DiscordSignatureException>()),
          );
        },
      );

      test(
        'throws DiscordSignatureException on invalid HMAC-SHA256 signature',
        () {
          final Map<String, dynamic> rawWebhook = <String, dynamic>{
            'id': 'msg_hmac_bad',
            'content': 'Mensaje con HMAC alterado',
            'author': <String, dynamic>{'id': 'u1'},
          };

          expect(
            () => adapter.toInboundMessage(
              rawWebhook,
              headers: <String, String>{
                'X-Signature-256':
                    'sha256=0000000000000000000000000000000000000000000000000000000000000000',
              },
              rawBody: jsonEncode(rawWebhook),
              hmacSecret: 'secret_original',
            ),
            throwsA(isA<DiscordSignatureException>()),
          );
        },
      );

      test(
        'throws DiscordSignatureException on invalid secret token or Bot token',
        () {
          final Map<String, dynamic> rawWebhook = <String, dynamic>{
            'id': 'msg_token_bad',
            'content': 'Test',
            'author': <String, dynamic>{'id': 'u1'},
          };

          expect(
            () => adapter.toInboundMessage(
              rawWebhook,
              headers: <String, String>{
                'X-Discord-Secret-Token': 'wrong_token',
              },
              secretToken: 'correct_token',
            ),
            throwsA(isA<DiscordSignatureException>()),
          );

          expect(
            () => adapter.toInboundMessage(
              rawWebhook,
              headers: <String, String>{'Authorization': 'Bot wrong_bot_token'},
              botToken: 'correct_bot_token',
            ),
            throwsA(isA<DiscordSignatureException>()),
          );
        },
      );
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 7. SAD PATH: REPEATED MESSAGE_ID / DEDUPLICATION REJECTION (§6)
    // ══════════════════════════════════════════════════════════════════════════
    group('Sad Path (§6): Repeated message_id (Idempotent Deduplication)', () {
      test(
        'throws DiscordDuplicateMessageException on repeated message_id with DeduplicatedAck attached',
        () {
          final Map<String, dynamic> rawWebhook = <String, dynamic>{
            'id': 'dup_msg_9999',
            'content': 'Mensaje original a ser duplicado',
            'author': <String, dynamic>{
              'id': 'user_dup',
              'username': 'dup_user',
            },
            'timestamp': '2026-11-10T05:30:00Z',
          };

          // Primer procesamiento: Exitoso
          final InboundMessage first = adapter.toInboundMessage(rawWebhook);
          expect(first.providerMessageId, equals('dup_msg_9999'));
          expect(adapter.isMessageProcessed('dup_msg_9999'), isTrue);

          // Segundo procesamiento con el mismo id: Rechazo con excepción tipada (§6)
          try {
            adapter.toInboundMessage(rawWebhook);
            fail('Debería haber lanzado DiscordDuplicateMessageException');
          } on DiscordDuplicateMessageException catch (e) {
            expect(e.providerMessageId, equals('dup_msg_9999'));
            expect(e.ack, isNotNull);
            expect(e.ack!.providerMessageId, equals('dup_msg_9999'));
            expect(e.ack!.channel, equals(ChannelType.discord));
            expect(e.ack!.status, equals('duplicate'));
            expect(e.message, contains('dup_msg_9999'));
          }

          // También hereda de DiscordAdapterException
          expect(
            () => adapter.toInboundMessage(rawWebhook),
            throwsA(isA<DiscordAdapterException>()),
          );
        },
      );
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 8. SAD PATH: OUTBOUND & SCHEMA VERSIONING ARGUMENT ERRORS (§6)
    // ══════════════════════════════════════════════════════════════════════════
    group('Sad Path (§6): Outbound & Schema Versioning Validation', () {
      test(
        'throws DiscordAdapterException when outbound message channel is not Discord',
        () {
          final OutboundMessage waMsg = OutboundMessage(
            channel: ChannelType.whatsapp,
            recipientId: '123456789',
            text: 'Mensaje WhatsApp',
          );

          expect(
            () => adapter.toDiscordMessage(waMsg),
            throwsA(isA<DiscordAdapterException>()),
          );
        },
      );

      test(
        'throws ArgumentError on empty schemaVersion in InboundMessage and OutboundMessage',
        () {
          expect(
            () => InboundMessage(
              schemaVersion: '   ',
              channel: ChannelType.discord,
              senderId: 'user_1',
              text: 'Test',
              providerMessageId: 'id_1',
              timestamp: DateTime.now(),
            ),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => OutboundMessage(
              schemaVersion: '',
              channel: ChannelType.discord,
              recipientId: 'user_1',
              text: 'Test',
            ),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => InboundMessage.fromJson(<String, dynamic>{
              'schema_version': '',
              'channel': 'discord',
              'sender_id': 'u1',
              'provider_message_id': 'm1',
              'timestamp': DateTime.now().toIso8601String(),
            }),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => OutboundMessage.fromJson(<String, dynamic>{
              'schema_version': '   ',
              'channel': 'discord',
              'recipient_id': 'u1',
              'text': 'hola',
            }),
            throwsA(isA<ArgumentError>()),
          );
        },
      );

      test(
        'throws ArgumentError on empty or invalid DeduplicatedAck fields',
        () {
          final DateTime now = DateTime.now();

          expect(
            () => DeduplicatedAck(
              schemaVersion: '',
              channel: ChannelType.discord,
              providerMessageId: 'm1',
              timestamp: now,
            ),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => DeduplicatedAck(
              channel: ChannelType.discord,
              providerMessageId: '   ',
              timestamp: now,
            ),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => DeduplicatedAck(
              channel: ChannelType.discord,
              providerMessageId: 'm1',
              timestamp: now,
              status: '',
            ),
            throwsA(isA<ArgumentError>()),
          );

          expect(
            () => DeduplicatedAck.fromJson(<String, dynamic>{
              'channel': 'discord',
              'timestamp': now.toIso8601String(),
              'status': 'deduplicated',
            }),
            throwsA(isA<ArgumentError>()),
          );
        },
      );
    });
  });
}
