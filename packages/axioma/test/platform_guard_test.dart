import 'package:axioma/src/platform_guard.dart';
import 'package:test/test.dart';

void main() {
  group('PlatformGuard — Paridad Multi-OS (§39, Art. Multi-OS.1, Multi-OS.2)', () {
    test(
      'Happy Path: Detección nominal y normalización de rutas en POSIX/Linux',
      () {
        final PlatformGuard guard = PlatformGuard(
          platform: SupportedPlatform.linux,
        );

        expect(guard.isLinux, isTrue);
        expect(guard.isWindows, isFalse);
        expect(guard.isPosix, isTrue);
        expect(guard.defaultShellExecutable, equals('bash'));

        final List<String> args = guard.buildShellArguments('echo "ok"');
        expect(args, equals(<String>['-c', 'echo "ok"']));

        final String normalized = guard.toForwardSlashes(
          r'vault\specs\schema.yaml',
        );
        expect(normalized, equals('vault/specs/schema.yaml'));
      },
    );

    test('Happy Path: Detección nominal y configuración en Windows', () {
      final PlatformGuard guard = PlatformGuard(
        platform: SupportedPlatform.windows,
      );

      expect(guard.isWindows, isTrue);
      expect(guard.isLinux, isFalse);
      expect(guard.isPosix, isFalse);
      expect(guard.defaultShellExecutable, equals('cmd.exe'));

      final List<String> args = guard.buildShellArguments('dir');
      expect(args, equals(<String>['/c', 'dir']));
    });

    test('Happy Path: Parsing determinista de /proc/meminfo en Linux', () {
      final PlatformGuard guard = PlatformGuard(
        platform: SupportedPlatform.linux,
      );
      const String fakeMeminfo = '''
MemTotal:       16384000 kB
MemFree:         4096000 kB
MemAvailable:    8192000 kB
Buffers:          500000 kB
Cached:          2000000 kB
''';

      final SystemMemorySnapshot snapshot = guard.readMemoryUsage(
        meminfoOverride: fakeMeminfo,
      );
      expect(snapshot.totalMb, closeTo(16000.0, 100.0));
      expect(snapshot.availableMb, closeTo(8000.0, 100.0));
      expect(snapshot.usedPercentage, closeTo(50.0, 1.0));
      expect(snapshot.exceedsSafetyThreshold, isFalse);
    });

    test(
      'Sad Path 1 (§6): buildShellArguments arroja ArgumentError ante comando vacío',
      () {
        final PlatformGuard guard = PlatformGuard();

        expect(
          () => guard.buildShellArguments('   '),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test(
      'Sad Path 2 (§6): Parsing de meminfo corrupto retorna fallback seguro sin crashear',
      () {
        final PlatformGuard guard = PlatformGuard(
          platform: SupportedPlatform.linux,
        );
        const String corruptMeminfo =
            'INVALID_HEADER_NO_TOTAL_LINE\nOtherField: 100 kB';

        final SystemMemorySnapshot snapshot = guard.readMemoryUsage(
          meminfoOverride: corruptMeminfo,
        );
        expect(snapshot.totalMb, equals(8192.0));
        expect(snapshot.availableMb, equals(4096.0));
        expect(snapshot.usedPercentage, equals(50.0));
        expect(snapshot.exceedsSafetyThreshold, isFalse);
      },
    );

    test('Happy Path: Detección de umbral de memoria crítico (>85%)', () {
      final PlatformGuard guard = PlatformGuard(
        platform: SupportedPlatform.linux,
      );
      const String criticalMeminfo = '''
MemTotal:       10000000 kB
MemAvailable:    1000000 kB
''';

      final SystemMemorySnapshot snapshot = guard.readMemoryUsage(
        meminfoOverride: criticalMeminfo,
      );
      expect(snapshot.usedPercentage, closeTo(90.0, 0.5));
      expect(snapshot.exceedsSafetyThreshold, isTrue);
    });
  });
}
