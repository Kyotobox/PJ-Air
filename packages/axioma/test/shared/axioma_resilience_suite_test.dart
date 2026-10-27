import 'dart:convert';
import 'dart:io';

import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

void main() {
  group(
    'Axioma Resilience & Shared Kernel Certification Suite (TASK-G50-04)',
    () {
      File locateFile(String relativePath) {
        final File direct = File(relativePath);
        if (direct.existsSync()) return direct;
        final File rootRel = File('../../$relativePath');
        if (rootRel.existsSync()) return rootRel;
        return direct;
      }

      group('Integración Cruzada ResourceGuard e IsolateThrottle (§33)', () {
        test('Happy Path: Pipeline coordinado de workers ejecuta bajo monitoreo de RAM', () async {
          const ResourceGuard guard = ResourceGuard(
            totalMemoryBytes:
                1024 * 1024 * 1024, // 1 GB (RSS actual ~140MB < 85%)
            maxPressureRatio: 0.85,
          );
          const IsolateThrottle throttle = IsolateThrottle(processorCount: 4);

          final List<int> inputs = <int>[10, 20, 30, 40];
          final List<int> outputs = await throttle.runThrottled<int, int>(
            items: inputs,
            worker: (int x) async => x * 2,
            resourceGuard: guard,
          );

          expect(outputs, equals(<int>[20, 40, 60, 80]));
        });

        test('Sad Path: Pipeline aborta con ResourceGuardException si la RAM supera el 85%', () async {
          const ResourceGuard saturatedGuard = ResourceGuard(
            totalMemoryBytes: 1000,
            maxPressureRatio: 0.85,
            rssBytesProvider: _mockSaturatedRss,
          );
          const IsolateThrottle throttle = IsolateThrottle(processorCount: 4);

          expect(
            () => throttle.runThrottled<int, int>(
              items: <int>[1, 2, 3],
              worker: (int x) async => x,
              resourceGuard: saturatedGuard,
            ),
            throwsA(isA<ResourceGuardException>()),
          );
        });
      });

      group('Polimorfismo Multi-Provider KeyPool (Gemini + Claude)', () {
        test(
          'Happy Path: Ambas implementaciones satisfacen el contrato KeyPool',
          () {
            final KeyPool geminiPool = GeminiKeyPool(
              keys: <String>['AIzaSy-GEMINI-TEST-01', 'AIzaSy-GEMINI-TEST-02'],
            );
            final KeyPool claudePool = ClaudeKeyPool(
              keys: <String>['sk-ant-CLAUDE-TEST-01', 'sk-ant-CLAUDE-TEST-02'],
            );

            final List<KeyPool> pools = <KeyPool>[geminiPool, claudePool];

            for (final KeyPool pool in pools) {
              expect(pool.length, equals(2));
              final String key1 = pool.nextKey;
              final String key2 = pool.nextKey;
              expect(key1, isNotEmpty);
              expect(key2, isNotEmpty);
              expect(key1, isNot(equals(key2)));
            }
          },
        );

        test('Sad Path: KeyPool de Claude arroja ClaudePoolExhaustedException tipada', () {
          final KeyPool claudePool = ClaudeKeyPool(
            keys: <String>['sk-ant-TEST-01'],
          );
          claudePool.markQuotaExhausted('sk-ant-TEST-01');

          expect(
            () => claudePool.nextKey,
            throwsA(isA<ClaudePoolExhaustedException>()),
          );
        });
      });

      group(
        'Certificación de Registro en CAPABILITIES.json y Python Export',
        () {
          test('Happy Path: Capacidades CAP-RESOURCE-GUARD, CAP-ISOLATE-THROTTLE y CAP-CLAUDE-KEY-POOL están registradas', () {
            final File capsFile = locateFile('vault/intel/CAPABILITIES.json');
            expect(capsFile.existsSync(), isTrue);

            final Map<String, dynamic> json =
                jsonDecode(capsFile.readAsStringSync()) as Map<String, dynamic>;
            final List<dynamic> capabilities =
                json['capabilities'] as List<dynamic>;

            final Set<String> registeredIds = capabilities
                .map((dynamic c) => (c as Map<String, dynamic>)['id'] as String)
                .toSet();

            expect(registeredIds, contains('CAP-RESOURCE-GUARD'));
            expect(registeredIds, contains('CAP-ISOLATE-THROTTLE'));
            expect(registeredIds, contains('CAP-CLAUDE-KEY-POOL'));

            // Certificación del export Python
            final File pythonExport = locateFile(
              'vault/exports/automa/resource_guard.py',
            );
            expect(pythonExport.existsSync(), isTrue);
            expect(pythonExport.lengthSync(), greaterThan(100));
          });

          test('Sad Path: Validación falla ante capacidad no registrada', () {
            final File capsFile = locateFile('vault/intel/CAPABILITIES.json');
            final Map<String, dynamic> json =
                jsonDecode(capsFile.readAsStringSync()) as Map<String, dynamic>;
            final List<dynamic> capabilities =
                json['capabilities'] as List<dynamic>;

            final dynamic notFound = capabilities.firstWhere(
              (dynamic c) =>
                  (c as Map<String, dynamic>)['id'] ==
                  'CAP-NON-EXISTENT-CAPABILITY-TEST',
              orElse: () => null,
            );

            expect(notFound, isNull);
          });
        },
      );
    },
  );
}

int _mockSaturatedRss() => 950;
