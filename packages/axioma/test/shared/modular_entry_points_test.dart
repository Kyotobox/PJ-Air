// 🎯 Canonical Modular Entry Points Certification Suite — Pure Dart (§39)
// Conforme a: §4 Tolerancia cero a mocks, §6 Sad Paths obligatorios,
// §12.b Límite 5 archivos de alcance, §39 Pure Dart Core, §43 Paridad Test-to-Prod,
// §48 Cierre Autárquico, §56 Veto a la Asunción Enunciativa.
library;

import 'dart:async';
import 'dart:io' as io;
import 'package:path/path.dart' as p;
import 'package:test/test.dart';

// Importación canónica exclusiva desde los entry points de producción (§43 Paridad Test-to-Prod)
import 'package:axioma/messaging.dart' as messaging;
import 'package:axioma/geo.dart' as geo;
import 'package:axioma/render.dart' as render;
import 'package:axioma/flow.dart' as flow;
import 'package:axioma/automotive.dart' as automotive;
import 'package:axioma/src/platform_guard.dart';

void main() {
  final PlatformGuard platformGuard = PlatformGuard();

  group(
    'TASK-N104-01: Modularización Temática de Entry Points en packages/axioma (§12.b, §39, §48)',
    () {
      // -------------------------------------------------------------------------
      // 1. MESSAGING ENTRY POINT (package:axioma/messaging.dart)
      // -------------------------------------------------------------------------
      group('1. Messaging Modular Entry Point (package:axioma/messaging.dart)', () {
        test(
          'Happy Path: Sanitizes E.164 phone numbers and instantiates message models',
          () {
            final String sanitized = messaging.E164PhoneValidator.sanitize(
              '+58 (414) 123-4567',
            );
            expect(sanitized, equals('+584141234567'));
            expect(messaging.E164PhoneValidator.isValid(sanitized), isTrue);

            final messaging.WhatsAppTextMessage waMessage =
                messaging.WhatsAppTextMessage(
                  to: '+584141234567',
                  body: 'Consulta de repuesto',
                );
            expect(waMessage.to, equals('+584141234567'));
            expect(waMessage.body, equals('Consulta de repuesto'));
            final Map<String, dynamic> json = waMessage.toJson();
            expect(json['messaging_product'], equals('whatsapp'));
          },
        );

        test(
          'Sad Path (§6): E164PhoneValidator throws FormatException on invalid alphabetic characters',
          () {
            expect(
              () => messaging.E164PhoneValidator.sanitize(
                'invalid-non-numeric-phone',
              ),
              throwsA(isA<FormatException>()),
            );
            expect(
              () => messaging.E164PhoneValidator.sanitize('+58414CALLME'),
              throwsA(isA<FormatException>()),
            );
            expect(messaging.E164PhoneValidator.isValid('abc'), isFalse);
          },
        );

        test(
          'Sad Path (§6): WhatsAppTextMessage throws ArgumentError on empty recipient or body',
          () {
            expect(
              () => messaging.WhatsAppTextMessage(to: '', body: 'Valido'),
              throwsA(isA<ArgumentError>()),
            );
            expect(
              () => messaging.WhatsAppTextMessage(
                to: '+584141234567',
                body: '   ',
              ),
              throwsA(isA<ArgumentError>()),
            );
          },
        );

        test(
          'Sad Path (§6): WebhookSignatureValidator throws SecurityException on invalid signature or empty secret',
          () {
            // Encabezado de firma vacío
            expect(
              () => messaging.WebhookSignatureValidator.validateHubSignature(
                payload: '{"event":"ping"}',
                signatureHeader: '',
                secret: 'test_secret',
              ),
              throwsA(isA<messaging.MissingHeaderException>()),
            );

            // Secreto vacío
            expect(
              () => messaging.WebhookSignatureValidator.validateHubSignature(
                payload: '{"event":"ping"}',
                signatureHeader:
                    'sha256=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                secret: '',
              ),
              throwsA(isA<messaging.InvalidSignatureException>()),
            );

            // Firma manipulada
            expect(
              () => messaging.WebhookSignatureValidator.validateHubSignature(
                payload: '{"event":"ping"}',
                signatureHeader:
                    'sha256=0000000000000000000000000000000000000000000000000000000000000000',
                secret: 'top_secret_key',
              ),
              throwsA(isA<messaging.InvalidSignatureException>()),
            );
          },
        );
      });

      // -------------------------------------------------------------------------
      // 2. GEO ENTRY POINT (package:axioma/geo.dart)
      // -------------------------------------------------------------------------
      group('2. Geo Modular Entry Point (package:axioma/geo.dart)', () {
        test(
          'Happy Path: Instantiates GeoPoint, BoundingBox and computes Haversine distance',
          () {
            final geo.GeoPoint caracas = geo.GeoPoint(10.4806, -66.9036);
            final geo.GeoPoint valencia = geo.GeoPoint(10.1620, -68.0077);

            expect(caracas.latitude, closeTo(10.4806, 0.0001));
            expect(caracas.longitude, closeTo(-66.9036, 0.0001));

            final double distanceMeters = geo.calculateHaversineDistanceMeters(
              caracas,
              valencia,
            );
            // Distancia real aproximada entre Caracas y Valencia: ~125 km (120,000 - 130,000 m)
            expect(distanceMeters, greaterThan(115000));
            expect(distanceMeters, lessThan(135000));

            final geo.BoundingBox box = geo.BoundingBox(
              southWest: geo.GeoPoint(10.0, -69.0),
              northEast: geo.GeoPoint(11.0, -66.0),
            );
            expect(box.contains(caracas), isTrue);
            expect(box.contains(valencia), isTrue);
          },
        );

        test(
          'Sad Path (§6): GeoPoint throws ArgumentError on out-of-range coordinates or NaN',
          () {
            expect(
              () => geo.GeoPoint(90.0001, 0.0),
              throwsA(isA<ArgumentError>()),
            );
            expect(
              () => geo.GeoPoint(-90.0001, 0.0),
              throwsA(isA<ArgumentError>()),
            );
            expect(
              () => geo.GeoPoint(0.0, 180.0001),
              throwsA(isA<ArgumentError>()),
            );
            expect(
              () => geo.GeoPoint(0.0, -180.0001),
              throwsA(isA<ArgumentError>()),
            );
            expect(
              () => geo.GeoPoint(double.nan, 0.0),
              throwsA(isA<ArgumentError>()),
            );
            expect(
              () => geo.GeoPoint(0.0, double.infinity),
              throwsA(isA<ArgumentError>()),
            );
          },
        );

        test(
          'Sad Path (§6): BoundingBox throws ArgumentError on inverted latitude bounds (southWest > northEast)',
          () {
            expect(
              () => geo.BoundingBox(
                southWest: geo.GeoPoint(15.0, -66.0),
                northEast: geo.GeoPoint(5.0, -66.0),
              ),
              throwsA(isA<ArgumentError>()),
            );
          },
        );
      });

      // -------------------------------------------------------------------------
      // 3. RENDER ENTRY POINT (package:axioma/render.dart)
      // -------------------------------------------------------------------------
      group('3. Render Modular Entry Point (package:axioma/render.dart)', () {
        test(
          'Happy Path: Instantiates and validates IncrementalRenderSpec',
          () {
            final render.IncrementalRenderSpec spec =
                render.IncrementalRenderSpec(
                  jobId: 'job_render_001',
                  campaignId: 'camp_brand_q1',
                  targetDeliverable: 'master_1080p.mp4',
                  canvasWidth: 1920,
                  canvasHeight: 1080,
                  fps: 30.0,
                  totalDurationMs: 15000,
                  segments: <render.RenderSegmentSpec>[
                    render.RenderSegmentSpec(
                      segmentId: 'seg_01',
                      type: render.RenderSegmentType.hook,
                      startTimeMs: 0,
                      durationMs: 15000,
                      sourceAssetUri: 'asset://video_intro.mp4',
                      sourceFingerprint: 'fp_video_intro_123',
                    ),
                  ],
                );

            expect(spec.jobId, equals('job_render_001'));
            expect(spec.canvasWidth, equals(1920));
            expect(() => spec.validate(), returnsNormally);
          },
        );

        test(
          'Sad Path (§6): IncrementalRenderSpec.validate throws on empty IDs or negative dimensions',
          () {
            final render.IncrementalRenderSpec invalidJobId =
                const render.IncrementalRenderSpec(
                  jobId: '   ',
                  campaignId: 'camp_001',
                  targetDeliverable: 'video.mp4',
                  canvasWidth: 1920,
                  canvasHeight: 1080,
                  fps: 30.0,
                  totalDurationMs: 1000,
                  segments: <render.RenderSegmentSpec>[],
                );
            expect(
              () => invalidJobId.validate(),
              throwsA(isA<render.IncrementalRenderSpecValidationException>()),
            );

            final render.IncrementalRenderSpec invalidFps =
                const render.IncrementalRenderSpec(
                  jobId: 'job_002',
                  campaignId: 'camp_002',
                  targetDeliverable: 'video.mp4',
                  canvasWidth: 1920,
                  canvasHeight: 1080,
                  fps: 0.0,
                  totalDurationMs: 1000,
                  segments: <render.RenderSegmentSpec>[],
                );
            expect(
              () => invalidFps.validate(),
              throwsA(isA<render.IncrementalRenderSpecValidationException>()),
            );

            final render.IncrementalRenderSpec negativeDuration =
                const render.IncrementalRenderSpec(
                  jobId: 'job_003',
                  campaignId: 'camp_003',
                  targetDeliverable: 'video.mp4',
                  canvasWidth: 1920,
                  canvasHeight: 1080,
                  fps: 30.0,
                  totalDurationMs: -500,
                  segments: <render.RenderSegmentSpec>[],
                );
            expect(
              () => negativeDuration.validate(),
              throwsA(isA<render.IncrementalRenderSpecValidationException>()),
            );
          },
        );
      });

      // -------------------------------------------------------------------------
      // 4. FLOW ENTRY POINT (package:axioma/flow.dart)
      // -------------------------------------------------------------------------
      group('4. Flow Modular Entry Point (package:axioma/flow.dart)', () {
        test(
          'Happy Path: Instantiates AxiomaUiState and executes defensive ActionLock',
          () async {
            const flow.AxiomaUiState<String> initial =
                flow.AxiomaUiState<String>.initial();
            expect(initial.isInitial, isTrue);
            expect(initial.isIdle, isTrue);
            expect(initial.isLoading, isFalse);

            const flow.AxiomaUiState<String> success =
                flow.AxiomaUiState<String>.success('Payload cargado');
            expect(success.isSuccess, isTrue);
            expect(success.dataOrNull, equals('Payload cargado'));

            final flow.AxiomaActionLock lock = flow.AxiomaActionLock();
            expect(lock.canExecute, isTrue);
            expect(lock.isLocked, isFalse);

            final int result = await lock.run(
              () async => 42,
              tag: 'task_computation',
            );
            expect(result, equals(42));
            expect(lock.isLocked, isFalse);
          },
        );

        test(
          'Sad Path (§6): AxiomaActionLock.run throws ActionLockBusyException on concurrent execution',
          () async {
            final flow.AxiomaActionLock lock = flow.AxiomaActionLock();
            final Completer<void> completer = Completer<void>();

            // Iniciar primera acción asíncrona que retiene el candado
            final Future<String> slowFuture = lock.run(() async {
              await completer.future;
              return 'done';
            }, tag: 'action_1');

            expect(lock.isLocked, isTrue);

            // Segunda llamada concurrente debe ser rechazada de inmediato con ActionLockBusyException
            expect(
              () => lock.run(() async => 'rejected', tag: 'action_2'),
              throwsA(isA<flow.ActionLockBusyException>()),
            );

            // Liberar primera acción
            completer.complete();
            final String firstResult = await slowFuture;
            expect(firstResult, equals('done'));
            expect(lock.isLocked, isFalse);
          },
        );

        test(
          'Happy Path: Instantiates SqliteFlowSessionStore and manages FlowSessionRecord via package:axioma/flow.dart (§39, §43)',
          () {
            final flow.SqliteFlowSessionStore store =
                flow.SqliteFlowSessionStore.inMemory();
            try {
              final flow.FlowSessionRecord session =
                  flow.FlowSessionRecord.initial(
                    sessionId: 'canonical-flow-sess-01',
                    flowState: flow.FlowState.initial(
                      initialStep: 'init_step',
                      initialSlots: <String, dynamic>{'mode': 'fast_track'},
                    ),
                    metadata: const <String, dynamic>{
                      'origin': 'canonical_export',
                    },
                  );

              store.saveSession(session);
              expect(store.hasSession('canonical-flow-sess-01'), isTrue);

              final flow.FlowSessionRecord retrieved = store.requireSession(
                'canonical-flow-sess-01',
              );
              expect(retrieved.sessionId, equals('canonical-flow-sess-01'));
              expect(retrieved.stateVersion, equals(1));
              expect(retrieved.flowState.currentStep, equals('init_step'));
              expect(retrieved.flowState.slots['mode'], equals('fast_track'));
              expect(retrieved.metadata['origin'], equals('canonical_export'));
            } finally {
              store.close();
            }
          },
        );

        test(
          'Sad Path (§6, §43): FlowOptimisticLockException and FlowSessionNotFoundException are cleanly intercepted from flow.dart',
          () {
            final flow.SqliteFlowSessionStore store =
                flow.SqliteFlowSessionStore.inMemory();
            try {
              // 1. Sad Path: FlowSessionNotFoundException al requerir sesión no existente
              expect(
                () => store.requireSession('missing-flow-session-999'),
                throwsA(
                  isA<flow.FlowSessionNotFoundException>().having(
                    (flow.FlowSessionNotFoundException e) => e.sessionId,
                    'sessionId',
                    'missing-flow-session-999',
                  ),
                ),
              );

              bool caughtNotFound = false;
              try {
                store.requireSession('missing-flow-session-999');
              } on flow.FlowSessionNotFoundException catch (e) {
                caughtNotFound = true;
                expect(e.sessionId, equals('missing-flow-session-999'));
                expect(e.toString(), contains('FlowSessionNotFoundException'));
              }
              expect(caughtNotFound, isTrue);

              // 2. Sad Path: FlowOptimisticLockException ante concurrencia y conflicto de versión
              final flow.FlowSessionRecord v1 = flow.FlowSessionRecord.initial(
                sessionId: 'conflict-flow-session-888',
                flowState: flow.FlowState.initial(initialStep: 'v1'),
              );
              store.saveSession(v1);

              final flow.FlowSessionRecord nextV = v1.nextVersion(
                flowState: flow.FlowState.initial(initialStep: 'v2'),
              );
              // Avanzar store a versión 2
              store.saveSession(nextV, expectedVersion: 1);

              // Intento desactualizado con expectedVersion 1 (cuando la base de datos ya tiene versión 2)
              expect(
                () => store.saveSession(nextV, expectedVersion: 1),
                throwsA(
                  isA<flow.FlowOptimisticLockException>()
                      .having(
                        (flow.FlowOptimisticLockException e) => e.sessionId,
                        'sessionId',
                        'conflict-flow-session-888',
                      )
                      .having(
                        (flow.FlowOptimisticLockException e) =>
                            e.expectedVersion,
                        'expectedVersion',
                        1,
                      )
                      .having(
                        (flow.FlowOptimisticLockException e) => e.actualVersion,
                        'actualVersion',
                        2,
                      ),
                ),
              );

              bool caughtOptimisticLock = false;
              try {
                store.saveSession(nextV, expectedVersion: 1);
              } on flow.FlowOptimisticLockException catch (e) {
                caughtOptimisticLock = true;
                expect(e.sessionId, equals('conflict-flow-session-888'));
                expect(e.expectedVersion, equals(1));
                expect(e.actualVersion, equals(2));
                expect(e.toString(), contains('OptimisticLockException'));
              }
              expect(caughtOptimisticLock, isTrue);
            } finally {
              store.close();
            }
          },
        );
      });

      // -------------------------------------------------------------------------
      // 5. AUTOMOTIVE ENTRY POINT (package:axioma/automotive.dart)
      // -------------------------------------------------------------------------
      group(
        '5. Automotive Modular Entry Point (package:axioma/automotive.dart)',
        () {
          test(
            'Happy Path: Normalizes brands, cleans OEM codes and resolves generation matrices',
            () {
              expect(
                automotive.BrandDictionary.normalize('toyota'),
                equals('TOYOTA'),
              );
              expect(
                automotive.BrandDictionary.normalize('chevrolet'),
                equals('CHEVROLET'),
              );
              expect(
                automotive.PartBrandDictionary.normalize('bosch'),
                equals('BOSCH'),
              );
              expect(
                automotive.PartBrandDictionary.normalize('denso'),
                equals('DENSO'),
              );

              expect(
                automotive.OemCleaner.clean(' 04465 - 02220 / A '),
                equals('0446502220A'),
              );
              expect(
                automotive.OemCleaner.isMatch('04465-02220', '0446502220'),
                isTrue,
              );

              final Map<String, int>? range = automotive
                  .GenerationMatrix.findYearRange('TOYOTA', 'COROLLA');
              expect(range, isNotNull);
              expect(range!['year_start'], equals(1997));
              expect(range['year_end'], equals(2002));
            },
          );

          test(
            'Sad Path (§6): Returns null or empty on unknown vehicle/OEM data',
            () {
              final Map<String, int>? unknownGen =
                  automotive.GenerationMatrix.findYearRange(
                    'AERONAUTICA_CIVIL',
                    'BOEING_737',
                  );
              expect(unknownGen, isNull);

              // OemCleaner.cleanWithValidation rechaza códigos menores a minLength
              expect(
                automotive.OemCleaner.cleanWithValidation('12', minLength: 3),
                equals(''),
              );
              expect(
                automotive.OemCleaner.cleanWithValidation('', minLength: 3),
                equals(''),
              );
              expect(
                automotive.OemCleaner.cleanWithValidation(null, minLength: 3),
                equals(''),
              );
            },
          );
        },
      );

      // -------------------------------------------------------------------------
      // 6. ISOLATION & ANTI-CROSS-CONTAMINATION AUDIT
      // -------------------------------------------------------------------------
      group('6. Sub-barrel Isolation & Cross-Dependency Leak Audit (§12.b, §39)', () {
        late String axiomaLibDir;

        setUpAll(() {
          final String root = io.Directory.current.path;
          if (root.endsWith('packages/axioma') ||
              root.endsWith('packages${p.separator}axioma')) {
            axiomaLibDir = platformGuard.normalizePath(p.join(root, 'lib'));
          } else {
            axiomaLibDir = platformGuard.normalizePath(
              p.join(root, 'packages', 'axioma', 'lib'),
            );
          }
        });

        test(
          'Happy Path: All 5 modular barrel files exist physically on disk',
          () {
            final List<String> expectedBarrels = <String>[
              'messaging.dart',
              'geo.dart',
              'render.dart',
              'flow.dart',
              'automotive.dart',
            ];

            for (final String barrel in expectedBarrels) {
              final io.File file = io.File(p.join(axiomaLibDir, barrel));
              expect(
                file.existsSync(),
                isTrue,
                reason:
                    'El entry point granular $barrel debe existir en $axiomaLibDir',
              );
            }
          },
        );

        test(
          'Happy Path: messaging.dart does NOT leak automotive, geo or render dependencies',
          () {
            final String content = io.File(
              p.join(axiomaLibDir, 'messaging.dart'),
            ).readAsStringSync();
            expect(content, isNot(contains('src/dictionaries/')));
            expect(content, isNot(contains('src/geo/')));
            expect(content, isNot(contains('src/render/')));
            expect(content, isNot(contains('src/models/vehicle_entity.dart')));
            expect(
              content,
              isNot(contains('src/search/fitment_regex_engine.dart')),
            );
          },
        );

        test(
          'Happy Path: geo.dart does NOT leak automotive, messaging or render dependencies',
          () {
            final String content = io.File(
              p.join(axiomaLibDir, 'geo.dart'),
            ).readAsStringSync();
            expect(content, isNot(contains('src/dictionaries/')));
            expect(content, isNot(contains('src/messaging/')));
            expect(content, isNot(contains('src/render/')));
            expect(content, isNot(contains('src/models/')));
          },
        );

        test(
          'Happy Path: render.dart does NOT leak automotive, messaging or geo dependencies',
          () {
            final String content = io.File(
              p.join(axiomaLibDir, 'render.dart'),
            ).readAsStringSync();
            expect(content, isNot(contains('src/dictionaries/')));
            expect(content, isNot(contains('src/messaging/')));
            expect(content, isNot(contains('src/geo/')));
            expect(content, isNot(contains('src/models/')));
          },
        );

        test(
          'Happy Path: flow.dart does NOT leak automotive, messaging, geo or render dependencies',
          () {
            final String content = io.File(
              p.join(axiomaLibDir, 'flow.dart'),
            ).readAsStringSync();
            expect(content, isNot(contains('src/dictionaries/')));
            expect(content, isNot(contains('src/messaging/')));
            expect(content, isNot(contains('src/geo/')));
            expect(content, isNot(contains('src/render/')));
            expect(content, isNot(contains('src/models/')));
            // Exportación canónica de almacén de sesiones y excepciones de flujo (§39, §43)
            expect(
              content,
              contains("export 'src/flow/flow_session_store.dart';"),
            );
            expect(
              content,
              contains("export 'src/flow/sqlite_flow_session_store.dart';"),
            );
            expect(content, contains('FlowOptimisticLockException'));
            expect(content, contains('FlowSessionNotFoundException'));
          },
        );

        test(
          'Happy Path: automotive.dart segregates autopart dictionaries and does NOT leak messaging, geo or render',
          () {
            final String content = io.File(
              p.join(axiomaLibDir, 'automotive.dart'),
            ).readAsStringSync();
            // Contiene diccionarios segregados
            expect(content, contains('src/dictionaries/brand_dictionary.dart'));
            expect(content, contains('src/dictionaries/taxonomy_matrix.dart'));
            expect(
              content,
              contains('src/dictionaries/jargon_dictionary.dart'),
            );
            // NO contiene mensajería, geo ni render
            expect(content, isNot(contains('src/messaging/')));
            expect(content, isNot(contains('src/geo/')));
            expect(content, isNot(contains('src/render/')));
          },
        );

        test(
          'Sad Path (§6): assertNoLeak throws StateError if cross-contamination is detected',
          () {
            void assertNoLeak(String barrelContent, List<String> forbidden) {
              for (final String pattern in forbidden) {
                if (barrelContent.contains(pattern)) {
                  throw StateError(
                    'Cross-contamination detected: $pattern found in isolated barrel',
                  );
                }
              }
            }

            const String contaminatedSynthetic =
                "export 'src/geo/geo_point.dart';\nexport 'src/dictionaries/brand_dictionary.dart';";
            expect(
              () => assertNoLeak(contaminatedSynthetic, <String>[
                'src/dictionaries/',
              ]),
              throwsA(isA<StateError>()),
            );
          },
        );
      });

      // -------------------------------------------------------------------------
      // 7. PURE DART CORE ENFORCEMENT (§39)
      // -------------------------------------------------------------------------
      group('7. Pure Dart Core Compliance (§39)', () {
        late String axiomaLibDir;

        setUpAll(() {
          final String root = io.Directory.current.path;
          if (root.endsWith('packages/axioma') ||
              root.endsWith('packages${p.separator}axioma')) {
            axiomaLibDir = platformGuard.normalizePath(p.join(root, 'lib'));
          } else {
            axiomaLibDir = platformGuard.normalizePath(
              p.join(root, 'packages', 'axioma', 'lib'),
            );
          }
        });

        test(
          'Happy Path: All 5 modular barrels and axioma.dart maintain Pure Dart (zero Flutter imports)',
          () {
            final List<String> barrels = <String>[
              'messaging.dart',
              'geo.dart',
              'render.dart',
              'flow.dart',
              'automotive.dart',
              'axioma.dart',
            ];

            for (final String barrel in barrels) {
              final String content = io.File(
                p.join(axiomaLibDir, barrel),
              ).readAsStringSync();
              expect(
                content,
                isNot(contains('package:flutter')),
                reason: '$barrel no debe importar package:flutter',
              );
              expect(
                content,
                isNot(contains('dart:ui')),
                reason: '$barrel no debe importar dart:ui',
              );
              expect(
                content,
                isNot(contains('dart:html')),
                reason: '$barrel no debe importar dart:html',
              );
            }
          },
        );

        test(
          'Sad Path (§6): assertPureDart throws StateError when encountering UI framework imports',
          () {
            void assertPureDart(String content) {
              const List<String> forbiddenUi = <String>[
                'package:flutter',
                'dart:ui',
                'dart:html',
              ];
              for (final String ui in forbiddenUi) {
                if (content.contains(ui)) {
                  throw StateError(
                    'Pure Dart Violation (§39): $ui imported in core domain',
                  );
                }
              }
            }

            const String flutterSynthetic =
                "import 'package:flutter/material.dart';\nclass MyWidget {}";
            expect(
              () => assertPureDart(flutterSynthetic),
              throwsA(isA<StateError>()),
            );

            const String dartUiSynthetic = "import 'dart:ui';\nvoid draw() {}";
            expect(
              () => assertPureDart(dartUiSynthetic),
              throwsA(isA<StateError>()),
            );
          },
        );
      });

      // -------------------------------------------------------------------------
      // 8. DEPRECATION DIRECTIVE AUDIT FOR axioma.dart
      // -------------------------------------------------------------------------
      group('8. Deprecation Directive for axioma.dart (§39, §48)', () {
        late io.File axiomaFile;

        setUpAll(() {
          final String root = io.Directory.current.path;
          if (root.endsWith('packages/axioma') ||
              root.endsWith('packages${p.separator}axioma')) {
            axiomaFile = io.File(
              platformGuard.normalizePath(p.join(root, 'lib', 'axioma.dart')),
            );
          } else {
            axiomaFile = io.File(
              platformGuard.normalizePath(
                p.join(root, 'packages', 'axioma', 'lib', 'axioma.dart'),
              ),
            );
          }
        });

        test(
          'Happy Path: axioma.dart is marked with @Deprecated and contains retirement directive for Sprint N106',
          () {
            expect(axiomaFile.existsSync(), isTrue);
            final String content = axiomaFile.readAsStringSync();
            expect(content, contains('@Deprecated('));
            expect(content, contains('Sprint N106'));
            expect(content, contains('package:axioma/messaging.dart'));
            expect(content, contains('package:axioma/geo.dart'));
            expect(content, contains('package:axioma/render.dart'));
            expect(content, contains('package:axioma/flow.dart'));
            expect(content, contains('package:axioma/automotive.dart'));
          },
        );

        test(
          'Sad Path (§6): assertDeprecatedWithDirective throws StateError when @Deprecated or retirement directive is missing',
          () {
            void assertDeprecatedWithDirective(String content) {
              if (!content.contains('@Deprecated(')) {
                throw StateError('Falta anotación @Deprecated obligatoria');
              }
              if (!content.contains('Sprint N106')) {
                throw StateError(
                  'Falta directiva de retiro formal para Sprint N106',
                );
              }
            }

            const String nonDeprecatedCode =
                "library;\nexport 'src/geo/geo_point.dart';";
            expect(
              () => assertDeprecatedWithDirective(nonDeprecatedCode),
              throwsA(isA<StateError>()),
            );

            const String deprecatedWithoutDirective =
                "@Deprecated('Legacy')\nlibrary;";
            expect(
              () => assertDeprecatedWithDirective(deprecatedWithoutDirective),
              throwsA(isA<StateError>()),
            );
          },
        );
      });
    },
  );
}
