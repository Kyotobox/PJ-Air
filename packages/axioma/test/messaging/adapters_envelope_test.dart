import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('Canonical Omnichannel Envelope Adapters (§4, §6, §12.b, §39, §48)', () {
    // ══════════════════════════════════════════════════════════════════════════
    // WHATSAPP ENVELOPE ADAPTER
    // ══════════════════════════════════════════════════════════════════════════
    group('WhatsAppEnvelopeAdapter', () {
      const WhatsAppEnvelopeAdapter adapter = WhatsAppEnvelopeAdapter();

      group('Happy Path: Inbound Meta Cloud API', () {
        test(
          'parses standard nested Cloud API text webhook into InboundMessage',
          () {
            final Map<String, dynamic> rawWebhook = <String, dynamic>{
              'object': 'whatsapp_business_account',
              'entry': <Map<String, dynamic>>[
                <String, dynamic>{
                  'id': 'WBA-100200',
                  'changes': <Map<String, dynamic>>[
                    <String, dynamic>{
                      'field': 'messages',
                      'value': <String, dynamic>{
                        'messaging_product': 'whatsapp',
                        'metadata': <String, dynamic>{
                          'display_phone_number': '+582125550000',
                          'phone_number_id': 'PNID-999',
                        },
                        'contacts': <Map<String, dynamic>>[
                          <String, dynamic>{
                            'profile': <String, dynamic>{
                              'name': 'Carlos Mendoza',
                            },
                            'wa_id': '584141234567',
                          },
                        ],
                        'messages': <Map<String, dynamic>>[
                          <String, dynamic>{
                            'from': '584141234567',
                            'id': 'wamid.HBgLNTg0MTQxMjM0NTY3',
                            'timestamp': '1700000000',
                            'type': 'text',
                            'text': <String, dynamic>{
                              'body':
                                  'Hola, ¿tienen pastillas de freno para Corolla 2012?',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            };

            expect(adapter.isCloudApi(rawWebhook), isTrue);
            final InboundMessage msg = adapter.toInboundMessage(rawWebhook);

            expect(msg.channel, equals(ChannelType.whatsapp));
            expect(msg.senderId, equals('+584141234567'));
            expect(msg.senderName, equals('Carlos Mendoza'));
            expect(
              msg.text,
              equals('Hola, ¿tienen pastillas de freno para Corolla 2012?'),
            );
            expect(msg.mediaUrl, isNull);
            expect(msg.providerMessageId, equals('wamid.HBgLNTg0MTQxMjM0NTY3'));
            expect(
              msg.timestamp,
              equals(
                DateTime.fromMillisecondsSinceEpoch(
                  1700000000 * 1000,
                  isUtc: true,
                ),
              ),
            );
            expect(msg.rawPayload, equals(rawWebhook));
          },
        );

        test(
          'parses Cloud API media message (image) with caption and link',
          () {
            final Map<String, dynamic> rawWebhook = <String, dynamic>{
              'object': 'whatsapp_business_account',
              'entry': <Map<String, dynamic>>[
                <String, dynamic>{
                  'changes': <Map<String, dynamic>>[
                    <String, dynamic>{
                      'value': <String, dynamic>{
                        'messaging_product': 'whatsapp',
                        'messages': <Map<String, dynamic>>[
                          <String, dynamic>{
                            'from': '+584129998877',
                            'id': 'wamid.IMG-123456',
                            'timestamp': 1700000500,
                            'type': 'image',
                            'image': <String, dynamic>{
                              'caption': 'Foto de la etiqueta del repuesto',
                              'link':
                                  'https://cdn.example.com/whatsapp/img123.jpg',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            };

            final InboundMessage msg = adapter.toInboundMessage(rawWebhook);
            expect(msg.channel, equals(ChannelType.whatsapp));
            expect(msg.senderId, equals('+584129998877'));
            expect(msg.text, equals('Foto de la etiqueta del repuesto'));
            expect(
              msg.mediaUrl,
              equals('https://cdn.example.com/whatsapp/img123.jpg'),
            );
            expect(msg.providerMessageId, equals('wamid.IMG-123456'));
          },
        );

        test('parses Cloud API interactive button_reply and list_reply', () {
          final Map<String, dynamic> rawWebhook = <String, dynamic>{
            'messaging_product': 'whatsapp',
            'messages': <Map<String, dynamic>>[
              <String, dynamic>{
                'from': '584241112233',
                'id': 'wamid.BTN-1',
                'timestamp': '1700001000',
                'type': 'interactive',
                'interactive': <String, dynamic>{
                  'type': 'button_reply',
                  'button_reply': <String, dynamic>{
                    'id': 'btn_catalog',
                    'title': 'Ver Catálogo',
                  },
                },
              },
            ],
          };

          final InboundMessage msg = adapter.toInboundMessage(rawWebhook);
          expect(msg.text, equals('Ver Catálogo'));
          expect(msg.providerMessageId, equals('wamid.BTN-1'));
        });
      });

      group('Happy Path: Inbound Evolution API', () {
        test(
          'parses Evolution API messages.upsert text webhook into InboundMessage',
          () {
            final Map<String, dynamic> rawWebhook = <String, dynamic>{
              'event': 'messages.upsert',
              'instance': 'automa-evolution-1',
              'data': <String, dynamic>{
                'key': <String, dynamic>{
                  'remoteJid': '584149876543@s.whatsapp.net',
                  'fromMe': false,
                  'id': '3EB076F1A882',
                },
                'pushName': 'Ana Gómez',
                'message': <String, dynamic>{
                  'conversation':
                      'Buenas tardes, ¿tienen disponibilidad de amortiguadores?',
                },
                'messageTimestamp': 1700002000,
                'messageType': 'conversation',
              },
            };

            expect(adapter.isEvolutionApi(rawWebhook), isTrue);
            final InboundMessage msg = adapter.toInboundMessage(rawWebhook);

            expect(msg.channel, equals(ChannelType.whatsapp));
            expect(msg.senderId, equals('+584149876543'));
            expect(msg.senderName, equals('Ana Gómez'));
            expect(
              msg.text,
              equals(
                'Buenas tardes, ¿tienen disponibilidad de amortiguadores?',
              ),
            );
            expect(msg.providerMessageId, equals('3EB076F1A882'));
            expect(
              msg.timestamp,
              equals(
                DateTime.fromMillisecondsSinceEpoch(
                  1700002000 * 1000,
                  isUtc: true,
                ),
              ),
            );
          },
        );

        test('parses Evolution API extendedTextMessage and imageMessage', () {
          final Map<String, dynamic> rawWebhook = <String, dynamic>{
            'event': 'messages.upsert',
            'data': <String, dynamic>{
              'key': <String, dynamic>{
                'remoteJid': '584123334455:1@s.whatsapp.net',
                'id': 'EVO-EXT-99',
              },
              'pushName': 'Pedro',
              'message': <String, dynamic>{
                'extendedTextMessage': <String, dynamic>{
                  'text': 'Cotización para bujías NGK',
                },
              },
              'messageTimestamp': 1700003000,
            },
          };

          final InboundMessage msg = adapter.toInboundMessage(rawWebhook);
          expect(msg.senderId, equals('+584123334455'));
          expect(msg.text, equals('Cotización para bujías NGK'));
          expect(msg.providerMessageId, equals('EVO-EXT-99'));

          final Map<String, dynamic> rawImageWebhook = <String, dynamic>{
            'event': 'messages.upsert',
            'data': <String, dynamic>{
              'key': <String, dynamic>{
                'remoteJid': '584123334455@s.whatsapp.net',
                'id': 'EVO-IMG-100',
              },
              'message': <String, dynamic>{
                'imageMessage': <String, dynamic>{
                  'caption': 'Muestra del serial',
                  'url': 'https://storage.evolution.dev/img/serial1.png',
                },
              },
              'messageTimestamp': 1700003050,
            },
          };

          final InboundMessage imgMsg = adapter.toInboundMessage(
            rawImageWebhook,
          );
          expect(imgMsg.text, equals('Muestra del serial'));
          expect(
            imgMsg.mediaUrl,
            equals('https://storage.evolution.dev/img/serial1.png'),
          );
        });

        test(
          'parses Evolution API webhook with data as List of items or top-level key',
          () {
            final Map<String, dynamic> listWebhook = <String, dynamic>{
              'event': 'messages.upsert',
              'data': <Map<String, dynamic>>[
                <String, dynamic>{
                  'key': <String, dynamic>{
                    'remoteJid': '584160001122@s.whatsapp.net',
                    'id': 'EVO-LIST-01',
                  },
                  'pushName': 'Cliente Flota',
                  'message': <String, dynamic>{
                    'conversation': 'Mensaje en lista de data',
                  },
                  'messageTimestamp': 1700004000,
                },
              ],
            };

            final InboundMessage msg = adapter.toInboundMessage(listWebhook);
            expect(msg.senderId, equals('+584160001122'));
            expect(msg.text, equals('Mensaje en lista de data'));

            final Map<String, dynamic> topKeyWebhook = <String, dynamic>{
              'key': <String, dynamic>{
                'remoteJid': '584160001122@s.whatsapp.net',
                'id': 'EVO-TOP-01',
              },
              'message': <String, dynamic>{
                'conversation': 'Mensaje con key directo',
              },
              'messageTimestamp': 1700004100,
            };

            final InboundMessage topMsg = adapter.toInboundMessage(
              topKeyWebhook,
            );
            expect(topMsg.text, equals('Mensaje con key directo'));
            expect(topMsg.providerMessageId, equals('EVO-TOP-01'));
          },
        );
      });

      group('Happy Path: Outbound WhatsApp', () {
        test('converts OutboundMessage to WhatsAppTextMessage and payload', () {
          final OutboundMessage outbound = OutboundMessage(
            channel: ChannelType.whatsapp,
            recipientId: '584141234567',
            text: 'El precio es \$45 con instalación incluida.',
            metadata: <String, dynamic>{'preview_url': true},
          );

          final WhatsAppTextMessage textMsg = adapter.toTextMessage(outbound);
          expect(textMsg.to, equals('+584141234567'));
          expect(
            textMsg.body,
            equals('El precio es \$45 con instalación incluida.'),
          );
          expect(textMsg.previewUrl, isTrue);

          final Map<String, dynamic> payload = adapter.toPayload(outbound);
          expect(payload['messaging_product'], equals('whatsapp'));
          expect(payload['to'], equals('+584141234567'));
          expect(payload['type'], equals('text'));
          expect(
            payload['text']['body'],
            equals('El precio es \$45 con instalación incluida.'),
          );
          expect(payload['text']['preview_url'], isTrue);

          // Bidirectional roundtrip fromTextMessage
          final OutboundMessage roundtrip = adapter.fromTextMessage(textMsg);
          expect(roundtrip.channel, equals(ChannelType.whatsapp));
          expect(roundtrip.recipientId, equals(textMsg.to));
          expect(roundtrip.text, equals(textMsg.body));
          expect(roundtrip.metadata['preview_url'], isTrue);
        });

        test(
          'converts OutboundMessage with media to WhatsAppMediaMessage and payload',
          () {
            final OutboundMessage outboundMedia = OutboundMessage(
              channel: ChannelType.whatsapp,
              recipientId: '+584149998877',
              text: 'Adjuntamos catálogo de productos',
              mediaUrl: 'https://cdn.example.com/docs/catalogo_2026.pdf',
              mediaType: 'document',
              metadata: <String, dynamic>{'filename': 'catalogo_2026.pdf'},
            );

            final WhatsAppMediaMessage mediaMsg = adapter.toMediaMessage(
              outboundMedia,
            );
            expect(mediaMsg.to, equals('+584149998877'));
            expect(mediaMsg.mediaType, equals('document'));
            expect(
              mediaMsg.mediaUrl,
              equals('https://cdn.example.com/docs/catalogo_2026.pdf'),
            );
            expect(
              mediaMsg.caption,
              equals('Adjuntamos catálogo de productos'),
            );
            expect(mediaMsg.filename, equals('catalogo_2026.pdf'));

            final Map<String, dynamic> payload = adapter.toPayload(
              outboundMedia,
            );
            expect(payload['type'], equals('document'));
            expect(
              payload['document']['link'],
              equals('https://cdn.example.com/docs/catalogo_2026.pdf'),
            );
            expect(
              payload['document']['caption'],
              equals('Adjuntamos catálogo de productos'),
            );
            expect(
              payload['document']['filename'],
              equals('catalogo_2026.pdf'),
            );

            // Bidirectional roundtrip fromMediaMessage
            final OutboundMessage roundtrip = adapter.fromMediaMessage(
              mediaMsg,
            );
            expect(roundtrip.channel, equals(ChannelType.whatsapp));
            expect(roundtrip.recipientId, equals(mediaMsg.to));
            expect(roundtrip.text, equals(mediaMsg.caption));
            expect(roundtrip.mediaUrl, equals(mediaMsg.mediaUrl));
            expect(roundtrip.mediaType, equals('document'));
          },
        );
      });

      group('Sad Path (§6): WhatsAppAdapter Failures', () {
        test('throws WhatsAppAdapterException on empty payload', () {
          expect(
            () => adapter.toInboundMessage(<String, dynamic>{}),
            throwsA(isA<WhatsAppAdapterException>()),
          );
        });

        test('throws WhatsAppAdapterException on unrecognized structure', () {
          expect(
            () => adapter.toInboundMessage(<String, dynamic>{
              'unknown_vendor': 'xyz',
              'payload': 123,
            }),
            throwsA(isA<WhatsAppAdapterException>()),
          );
        });

        test(
          'throws WhatsAppAdapterException on Cloud API with empty entry or missing messages',
          () {
            expect(
              () => adapter.toInboundMessage(<String, dynamic>{
                'object': 'whatsapp_business_account',
                'entry': <dynamic>[],
              }),
              throwsA(isA<WhatsAppAdapterException>()),
            );

            expect(
              () => adapter.toInboundMessage(<String, dynamic>{
                'object': 'whatsapp_business_account',
                'entry': <Map<String, dynamic>>[
                  <String, dynamic>{
                    'changes': <Map<String, dynamic>>[
                      <String, dynamic>{
                        'value': <String, dynamic>{
                          'messaging_product': 'whatsapp',
                          'messages': <dynamic>[],
                        },
                      },
                    ],
                  },
                ],
              }),
              throwsA(isA<WhatsAppAdapterException>()),
            );
          },
        );

        test(
          'throws WhatsAppAdapterException on Cloud API message missing from or id',
          () {
            expect(
              () => adapter.fromCloudApi(<String, dynamic>{
                'messaging_product': 'whatsapp',
                'messages': <Map<String, dynamic>>[
                  <String, dynamic>{
                    'id': 'wamid.123',
                    'text': <String, dynamic>{'body': 'hola'},
                  },
                ],
              }),
              throwsA(isA<WhatsAppAdapterException>()),
            );

            expect(
              () => adapter.fromCloudApi(<String, dynamic>{
                'messaging_product': 'whatsapp',
                'messages': <Map<String, dynamic>>[
                  <String, dynamic>{
                    'from': '584141234567',
                    'text': <String, dynamic>{'body': 'hola'},
                  },
                ],
              }),
              throwsA(isA<WhatsAppAdapterException>()),
            );
          },
        );

        test(
          'throws WhatsAppAdapterException on Evolution API missing key or remoteJid',
          () {
            expect(
              () => adapter.toInboundMessage(<String, dynamic>{
                'event': 'messages.upsert',
                'data': <String, dynamic>{
                  'pushName': 'User',
                  'message': <String, dynamic>{'conversation': 'hola'},
                },
              }),
              throwsA(isA<WhatsAppAdapterException>()),
            );

            expect(
              () => adapter.fromEvolutionApi(<String, dynamic>{
                'key': <String, dynamic>{'id': 'EVO-1'},
                'message': <String, dynamic>{'conversation': 'hola'},
              }),
              throwsA(isA<WhatsAppAdapterException>()),
            );
          },
        );

        test(
          'throws WhatsAppAdapterException on outbound wrong channel or missing mediaUrl',
          () {
            final OutboundMessage tgMsg = OutboundMessage(
              channel: ChannelType.telegram,
              recipientId: '123456',
              text: 'Mensaje Telegram',
            );

            expect(
              () => adapter.toTextMessage(tgMsg),
              throwsA(isA<WhatsAppAdapterException>()),
            );
            expect(
              () => adapter.toMediaMessage(tgMsg),
              throwsA(isA<WhatsAppAdapterException>()),
            );

            final OutboundMessage waTextOnly = OutboundMessage(
              channel: ChannelType.whatsapp,
              recipientId: '+584141234567',
              text: 'Solo texto',
            );

            expect(
              () => adapter.toMediaMessage(waTextOnly),
              throwsA(isA<WhatsAppAdapterException>()),
            );
          },
        );
      });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // TELEGRAM ENVELOPE ADAPTER
    // ══════════════════════════════════════════════════════════════════════════
    group('TelegramEnvelopeAdapter', () {
      const TelegramEnvelopeAdapter adapter = TelegramEnvelopeAdapter();

      group('Happy Path: Inbound Telegram Bot API', () {
        test(
          'parses standard Telegram Update with message text into InboundMessage',
          () {
            final Map<String, dynamic> rawWebhook = <String, dynamic>{
              'update_id': 88990011,
              'message': <String, dynamic>{
                'message_id': 54321,
                'from': <String, dynamic>{
                  'id': 123456789,
                  'is_bot': false,
                  'first_name': 'Roberto',
                  'last_name': 'Silva',
                  'username': 'rsilva_parts',
                },
                'chat': <String, dynamic>{
                  'id': 123456789,
                  'first_name': 'Roberto',
                  'last_name': 'Silva',
                  'username': 'rsilva_parts',
                  'type': 'private',
                },
                'date': 1700010000,
                'text': '¿Tienen soporte de motor para Honda Civic 2008?',
              },
            };

            expect(adapter.isTelegramUpdate(rawWebhook), isTrue);
            final InboundMessage msg = adapter.toInboundMessage(rawWebhook);

            expect(msg.channel, equals(ChannelType.telegram));
            expect(msg.senderId, equals('123456789'));
            expect(msg.senderName, equals('Roberto Silva'));
            expect(
              msg.text,
              equals('¿Tienen soporte de motor para Honda Civic 2008?'),
            );
            expect(msg.mediaUrl, isNull);
            expect(msg.providerMessageId, equals('54321'));
            expect(
              msg.timestamp,
              equals(
                DateTime.fromMillisecondsSinceEpoch(
                  1700010000 * 1000,
                  isUtc: true,
                ),
              ),
            );
            expect(msg.rawPayload, equals(rawWebhook));
          },
        );

        test(
          'parses Telegram Update with username only when names are omitted',
          () {
            final Map<String, dynamic> rawWebhook = <String, dynamic>{
              'update_id': 88990012,
              'message': <String, dynamic>{
                'message_id': 54322,
                'from': <String, dynamic>{
                  'id': 987654321,
                  'username': 'mecanicopro',
                },
                'chat': <String, dynamic>{'id': 987654321, 'type': 'private'},
                'date': 1700010050,
                'text': 'Disponibilidad de filtros',
              },
            };

            final InboundMessage msg = adapter.toInboundMessage(rawWebhook);
            expect(msg.senderId, equals('987654321'));
            expect(msg.senderName, equals('@mecanicopro'));
            expect(msg.text, equals('Disponibilidad de filtros'));
          },
        );

        test('parses Telegram Update with photo array and caption', () {
          final Map<String, dynamic> rawWebhook = <String, dynamic>{
            'update_id': 88990013,
            'message': <String, dynamic>{
              'message_id': 54323,
              'chat': <String, dynamic>{
                'id': 456789012,
                'title': 'Taller Mecánico El Veloz',
              },
              'date': 1700010100,
              'caption': 'Foto de la pieza dañada',
              'photo': <Map<String, dynamic>>[
                <String, dynamic>{
                  'file_id': 'thumb_1',
                  'width': 100,
                  'height': 100,
                },
                <String, dynamic>{
                  'file_id': 'full_photo_xyz',
                  'file_url': 'https://api.telegram.org/file/bot/full.jpg',
                  'width': 800,
                  'height': 600,
                },
              ],
            },
          };

          final InboundMessage msg = adapter.toInboundMessage(rawWebhook);
          expect(msg.senderId, equals('456789012'));
          expect(msg.senderName, equals('Taller Mecánico El Veloz'));
          expect(msg.text, equals('Foto de la pieza dañada'));
          expect(
            msg.mediaUrl,
            equals('https://api.telegram.org/file/bot/full.jpg'),
          );
        });

        test(
          'parses edited_message, channel_post and direct message payloads',
          () {
            final Map<String, dynamic> editedWebhook = <String, dynamic>{
              'update_id': 88990014,
              'edited_message': <String, dynamic>{
                'message_id': 7701,
                'chat': <String, dynamic>{'id': 112233},
                'date': 1700010200,
                'text': 'Mensaje editado',
              },
            };

            final InboundMessage editedMsg = adapter.toInboundMessage(
              editedWebhook,
            );
            expect(editedMsg.text, equals('Mensaje editado'));
            expect(editedMsg.providerMessageId, equals('7701'));

            final Map<String, dynamic> directWebhook = <String, dynamic>{
              'message_id': 8802,
              'chat': <String, dynamic>{'id': 445566},
              'date': 1700010300,
              'text': 'Mensaje directo sin update_id',
            };

            final InboundMessage directMsg = adapter.toInboundMessage(
              directWebhook,
            );
            expect(directMsg.text, equals('Mensaje directo sin update_id'));
            expect(directMsg.senderId, equals('445566'));
          },
        );
      });

      group('Happy Path: Outbound Telegram', () {
        test('converts OutboundMessage to TelegramTextMessage and payload', () {
          final OutboundMessage outbound = OutboundMessage(
            channel: ChannelType.telegram,
            recipientId: '123456789',
            text: '*Confirmado*: Su pedido #104 está en camino.',
            replyToId: '54321',
            metadata: <String, dynamic>{
              'parse_mode': 'MarkdownV2',
              'disable_web_page_preview': true,
            },
          );

          final TelegramTextMessage textMsg = adapter.toTextMessage(outbound);
          expect(textMsg.chatId, equals('123456789'));
          expect(
            textMsg.text,
            equals('*Confirmado*: Su pedido #104 está en camino.'),
          );
          expect(textMsg.replyToMessageId, equals(54321));
          expect(textMsg.parseMode, equals('MarkdownV2'));
          expect(textMsg.disableWebPagePreview, isTrue);

          final Map<String, dynamic> payload = adapter.toPayload(outbound);
          expect(payload['chat_id'], equals('123456789'));
          expect(
            payload['text'],
            equals('*Confirmado*: Su pedido #104 está en camino.'),
          );
          expect(payload['reply_to_message_id'], equals(54321));
          expect(payload['parse_mode'], equals('MarkdownV2'));
          expect(payload['disable_web_page_preview'], isTrue);

          // Bidirectional roundtrip fromTextMessage
          final OutboundMessage roundtrip = adapter.fromTextMessage(textMsg);
          expect(roundtrip.channel, equals(ChannelType.telegram));
          expect(roundtrip.recipientId, equals(textMsg.chatId));
          expect(roundtrip.text, equals(textMsg.text));
          expect(roundtrip.replyToId, equals('54321'));
          expect(roundtrip.metadata['parse_mode'], equals('MarkdownV2'));
          expect(roundtrip.metadata['disable_web_page_preview'], isTrue);
        });

        test(
          'converts OutboundMessage with photo to TelegramPhotoMessage and payload',
          () {
            final OutboundMessage outboundPhoto = OutboundMessage(
              channel: ChannelType.telegram,
              recipientId: '987654321',
              text: 'Diagrama esquemático de montaje',
              mediaUrl: 'https://cdn.example.com/schematics/honda_civic.jpg',
              mediaType: 'image',
              metadata: <String, dynamic>{'parse_mode': 'HTML'},
            );

            final TelegramPhotoMessage photoMsg = adapter.toPhotoMessage(
              outboundPhoto,
            );
            expect(photoMsg.chatId, equals('987654321'));
            expect(
              photoMsg.photoUrl,
              equals('https://cdn.example.com/schematics/honda_civic.jpg'),
            );
            expect(photoMsg.caption, equals('Diagrama esquemático de montaje'));
            expect(photoMsg.parseMode, equals('HTML'));

            final Map<String, dynamic> payload = adapter.toPayload(
              outboundPhoto,
            );
            expect(payload['chat_id'], equals('987654321'));
            expect(
              payload['photo'],
              equals('https://cdn.example.com/schematics/honda_civic.jpg'),
            );
            expect(
              payload['caption'],
              equals('Diagrama esquemático de montaje'),
            );
            expect(payload['parse_mode'], equals('HTML'));

            // Bidirectional roundtrip fromPhotoMessage
            final OutboundMessage roundtrip = adapter.fromPhotoMessage(
              photoMsg,
            );
            expect(roundtrip.channel, equals(ChannelType.telegram));
            expect(roundtrip.recipientId, equals(photoMsg.chatId));
            expect(roundtrip.text, equals(photoMsg.caption));
            expect(roundtrip.mediaUrl, equals(photoMsg.photoUrl));
            expect(roundtrip.metadata['parse_mode'], equals('HTML'));
          },
        );
      });

      group('Sad Path (§6): TelegramAdapter Failures', () {
        test('throws TelegramAdapterException on empty payload', () {
          expect(
            () => adapter.toInboundMessage(<String, dynamic>{}),
            throwsA(isA<TelegramAdapterException>()),
          );
        });

        test('throws TelegramAdapterException on unrecognized structure', () {
          expect(
            () => adapter.toInboundMessage(<String, dynamic>{
              'slack_event': <String, dynamic>{'id': 1},
            }),
            throwsA(isA<TelegramAdapterException>()),
          );
        });

        test(
          'throws TelegramAdapterException on missing message_id, chat/from or date',
          () {
            expect(
              () => adapter.toInboundMessage(<String, dynamic>{
                'update_id': 123,
                'message': <String, dynamic>{
                  'chat': <String, dynamic>{'id': 1},
                  'date': 1700010000,
                },
              }),
              throwsA(isA<TelegramAdapterException>()),
            );

            expect(
              () => adapter.toInboundMessage(<String, dynamic>{
                'update_id': 123,
                'message': <String, dynamic>{
                  'message_id': 1,
                  'date': 1700010000,
                },
              }),
              throwsA(isA<TelegramAdapterException>()),
            );

            expect(
              () => adapter.toInboundMessage(<String, dynamic>{
                'update_id': 123,
                'message': <String, dynamic>{
                  'message_id': 1,
                  'chat': <String, dynamic>{'id': 1},
                },
              }),
              throwsA(isA<TelegramAdapterException>()),
            );
          },
        );

        test(
          'throws TelegramAdapterException on outbound wrong channel or missing mediaUrl',
          () {
            final OutboundMessage waMsg = OutboundMessage(
              channel: ChannelType.whatsapp,
              recipientId: '+584141234567',
              text: 'Mensaje WhatsApp',
            );

            expect(
              () => adapter.toTextMessage(waMsg),
              throwsA(isA<TelegramAdapterException>()),
            );
            expect(
              () => adapter.toPhotoMessage(waMsg),
              throwsA(isA<TelegramAdapterException>()),
            );

            final OutboundMessage tgTextOnly = OutboundMessage(
              channel: ChannelType.telegram,
              recipientId: '123456',
              text: 'Solo texto',
            );

            expect(
              () => adapter.toPhotoMessage(tgTextOnly),
              throwsA(isA<TelegramAdapterException>()),
            );
          },
        );
      });
    });
  });
}
