import 'dart:ffi';
import 'dart:io';
import 'package:sqlite3/sqlite3.dart';

/// [RULE-04 / RULE-37] Fábrica de bases de datos SQLite efímeras y deterministas
/// para pruebas unitarias y de integración sin mocks en toda la flota.
class TestDatabaseFactory {
  const TestDatabaseFactory();

  static bool _initialized = false;

  /// Asegura la resolución de librerías nativas SQLite en Linux/POSIX sin native assets compilados.
  static void ensureInitialized() {
    if (_initialized) return;
    if (Platform.isLinux) {
      try {
        DynamicLibrary.open(
          '/home/opc/code/Smart/.dart_tool/lib/libsqlite3.so',
        );
      } catch (_) {
        try {
          DynamicLibrary.open('libsqlite3.so.0');
        } catch (_) {
          try {
            DynamicLibrary.open('libsqlite3.so');
          } catch (_) {}
        }
      }
    }
    _initialized = true;
  }

  /// Crea una base de datos SQLite real 100% en memoria RAM (`:memory:`).
  ///
  /// Latencia ultra-baja (<10ms), garantizando aislamiento absoluto entre tests
  /// y eliminando la necesidad de datos simulados o mocks.
  Database createInMemory({
    List<String>? initialDdl,
    bool enableForeignKeys = true,
  }) {
    ensureInitialized();
    final Database db = sqlite3.openInMemory();
    _configureDatabase(
      db,
      enableForeignKeys: enableForeignKeys,
      initialDdl: initialDdl,
    );
    return db;
  }

  /// Crea una base de datos SQLite real persistida en un directorio temporal de scratch.
  ///
  /// Ideal para tests de integración que requieren verificar persistencia de archivo físico
  /// o traspaso entre procesos.
  Database createScratch({
    required String scratchDir,
    String name = 'test_scratch.db',
    List<String>? initialDdl,
    bool enableForeignKeys = true,
  }) {
    ensureInitialized();
    final Directory dir = Directory(scratchDir);
    if (!dir.existsSync()) {
      dir.createSync(recursive: true);
    }

    final String sep = Platform.pathSeparator;
    final String dbPath =
        scratchDir.endsWith(sep) ||
            scratchDir.endsWith('/') ||
            scratchDir.endsWith(r'\')
        ? '$scratchDir$name'
        : '$scratchDir$sep$name';

    final Database db = sqlite3.open(dbPath);
    _configureDatabase(
      db,
      enableForeignKeys: enableForeignKeys,
      initialDdl: initialDdl,
    );
    return db;
  }

  /// Cierra de forma segura una base de datos liberando descriptores nativos.
  void close(Database db) {
    try {
      db.close();
    } catch (_) {
      // Intencional: seguro ante conexiones ya cerradas
    }
  }

  /// Purga el directorio de scratch eliminando archivos de pruebas de forma segura.
  void purgeScratch(String scratchDir) {
    try {
      final Directory dir = Directory(scratchDir);
      if (dir.existsSync()) {
        dir.deleteSync(recursive: true);
      }
    } catch (_) {
      // Intencional: seguro contra file locks transitorios en Windows
    }
  }

  void _configureDatabase(
    Database db, {
    required bool enableForeignKeys,
    List<String>? initialDdl,
  }) {
    if (enableForeignKeys) {
      db.execute('PRAGMA foreign_keys = ON;');
    }

    if (initialDdl != null) {
      for (final String ddl in initialDdl) {
        final String trimmed = ddl.trim();
        if (trimmed.isNotEmpty) {
          db.execute(trimmed);
        }
      }
    }
  }
}
