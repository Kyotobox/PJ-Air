import 'dart:io';
import 'package:axioma/axioma.dart';
import 'package:path/path.dart' as p;
import 'package:test/test.dart';

void main() {
  group('AxiomaDatabaseResolver - Happy Path (§19, §39, §58)', () {
    late Directory tempDir;

    setUp(() {
      tempDir = Directory.systemTemp.createTempSync('axioma_db_resolver_test_');
    });

    tearDown(() {
      if (tempDir.existsSync()) {
        tempDir.deleteSync(recursive: true);
      }
    });

    test('resuelve ruta canónica por defecto en subcarpeta data', () {
      final AxiomaDatabaseResolver resolver = AxiomaDatabaseResolver(
        workingDirectoryOverride: tempDir.path,
      );

      final String resolved = resolver.resolveCanonicalPath(
        databaseName: 'flota_lake.db',
      );

      final String expected = p.normalize(
        p.join(tempDir.path, 'data', 'flota_lake.db'),
      );
      expect(resolved, equals(expected));
      expect(Directory(p.join(tempDir.path, 'data')).existsSync(), isTrue);
    });

    test('respeta directorio base explícito', () {
      final Directory customDir = Directory(p.join(tempDir.path, 'custom_lake'))
        ..createSync(recursive: true);
      final AxiomaDatabaseResolver resolver = AxiomaDatabaseResolver(
        workingDirectoryOverride: tempDir.path,
      );

      final String resolved = resolver.resolveCanonicalPath(
        databaseName: 'custom.sqlite3',
        baseDirectory: customDir.path,
      );

      expect(
        resolved,
        equals(p.normalize(p.join(customDir.path, 'custom.sqlite3'))),
      );
    });

    test('respeta variable de entorno CONEXT_DB_DIR', () {
      final String customEnvPath = p.join(tempDir.path, 'env_storage');
      final AxiomaDatabaseResolver resolver = AxiomaDatabaseResolver(
        environmentOverride: <String, String>{'CONEXT_DB_DIR': customEnvPath},
        workingDirectoryOverride: tempDir.path,
      );

      final String resolved = resolver.resolveCanonicalPath(
        databaseName: 'node.sqlite',
      );

      expect(
        resolved,
        equals(p.normalize(p.join(customEnvPath, 'node.sqlite'))),
      );
      expect(Directory(customEnvPath).existsSync(), isTrue);
    });

    test('resuelve con mustExist cuando el archivo ya existe físicamente', () {
      final AxiomaDatabaseResolver resolver = AxiomaDatabaseResolver(
        workingDirectoryOverride: tempDir.path,
      );

      final String expectedPath = p.normalize(
        p.join(tempDir.path, 'data', 'existing.db'),
      );
      Directory(p.join(tempDir.path, 'data')).createSync(recursive: true);
      File(expectedPath).writeAsStringSync('SQLITE DUMMY HEADER');

      final String resolved = resolver.resolveCanonicalPath(
        databaseName: 'existing.db',
        mustExist: true,
      );

      expect(resolved, equals(expectedPath));
    });

    test('soporta emulación Multi-OS (Windows style)', () {
      final PlatformGuard windowsGuard = PlatformGuard(
        platform: SupportedPlatform.windows,
        pathContext: p.Context(style: p.Style.windows),
      );
      final AxiomaDatabaseResolver resolver = AxiomaDatabaseResolver(
        platformGuard: windowsGuard,
        workingDirectoryOverride: r'C:\Conext\Workdir',
      );

      final String resolved = resolver.resolveCanonicalPath(
        databaseName: 'ruedas.db',
        ensureDirectoryExists: false,
      );

      expect(resolved, equals(r'C:\Conext\Workdir\data\ruedas.db'));
    });
  });

  group('AxiomaDatabaseResolver - Sad Paths (§4, §6, §58)', () {
    late Directory tempDir;

    setUp(() {
      tempDir = Directory.systemTemp.createTempSync('axioma_db_sad_test_');
    });

    tearDown(() {
      if (tempDir.existsSync()) {
        tempDir.deleteSync(recursive: true);
      }
    });

    test('arroja DatabasePathResolutionException si el nombre está vacío', () {
      final AxiomaDatabaseResolver resolver = AxiomaDatabaseResolver();
      expect(
        () => resolver.resolveCanonicalPath(databaseName: '   '),
        throwsA(isA<DatabasePathResolutionException>()),
      );
    });

    test(
      'arroja DatabasePathResolutionException ante path traversal o caracteres ilegales',
      () {
        final AxiomaDatabaseResolver resolver = AxiomaDatabaseResolver();
        expect(
          () => resolver.resolveCanonicalPath(databaseName: '../secret.db'),
          throwsA(isA<DatabasePathResolutionException>()),
        );
        expect(
          () => resolver.resolveCanonicalPath(databaseName: r'dir\secret.db'),
          throwsA(isA<DatabasePathResolutionException>()),
        );
      },
    );

    test(
      'arroja DatabasePathResolutionException si la extensión no es SQLite canónica',
      () {
        final AxiomaDatabaseResolver resolver = AxiomaDatabaseResolver();
        expect(
          () => resolver.resolveCanonicalPath(databaseName: 'catalog.json'),
          throwsA(isA<DatabasePathResolutionException>()),
        );
        expect(
          () => resolver.resolveCanonicalPath(databaseName: 'catalog.txt'),
          throwsA(isA<DatabasePathResolutionException>()),
        );
      },
    );

    test(
      'arroja DatabasePathResolutionException con mustExist: true si el archivo no existe',
      () {
        final AxiomaDatabaseResolver resolver = AxiomaDatabaseResolver(
          workingDirectoryOverride: tempDir.path,
        );
        expect(
          () => resolver.resolveCanonicalPath(
            databaseName: 'ghost.db',
            mustExist: true,
          ),
          throwsA(isA<DatabasePathResolutionException>()),
        );
      },
    );

    test(
      'arroja DatabasePathResolutionException si el target directory es un archivo plano',
      () {
        final String conflictFilePath = p.join(
          tempDir.path,
          'data_file_conflict',
        );
        File(conflictFilePath).writeAsStringSync('no a directory');

        final AxiomaDatabaseResolver resolver = AxiomaDatabaseResolver(
          workingDirectoryOverride: tempDir.path,
        );

        expect(
          () => resolver.resolveCanonicalPath(
            databaseName: 'lake.db',
            baseDirectory: conflictFilePath,
            ensureDirectoryExists: true,
          ),
          throwsA(isA<DatabasePathResolutionException>()),
        );
      },
    );
  });
}
