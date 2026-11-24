// bitemporal_sqlite_engine.dart — Motor Relacional Bitemporal SQLite WAL (§39, §40, §45, §60.2)
library;

import 'package:sqlite3/sqlite3.dart';
import 'storage/client_dna_store.dart';

export 'storage/client_dna_schema.dart';
export 'storage/client_dna_store.dart';
export 'storage/identity_resolver.dart';

/// Motor relacional bitemporal para SQLite con soporte WAL forzado y transacciones ACID.
class BitemporalSqliteEngine {
  final Database database;
  final ClientDnaStore store;
  final bool isInMemory;

  BitemporalSqliteEngine._({
    required this.database,
    required this.store,
    required this.isInMemory,
  });

  /// Abre un motor bitemporal en memoria (ideal para tests y scratch).
  factory BitemporalSqliteEngine.inMemory() {
    final ClientDnaStore store = ClientDnaStore.openInMemory();
    return BitemporalSqliteEngine._(
      database: store.db,
      store: store,
      isInMemory: true,
    );
  }

  /// Abre un motor bitemporal persistente en disco activando WAL obligatoriamente (§45).
  factory BitemporalSqliteEngine.open(String path) {
    if (path.trim().isEmpty) {
      throw ArgumentError.value(
        path,
        'path',
        'La ruta de base de datos no puede estar vacía.',
      );
    }
    final ClientDnaStore store = ClientDnaStore.open(path);
    // Verificar y forzar WAL mode
    final ResultSet walResult = store.db.select('PRAGMA journal_mode=WAL;');
    final String mode = walResult.isNotEmpty
        ? walResult.first.values.first.toString().toUpperCase()
        : '';
    if (mode != 'WAL' && !path.contains(':memory:')) {
      store.db.execute('PRAGMA journal_mode=WAL;');
    }
    return BitemporalSqliteEngine._(
      database: store.db,
      store: store,
      isInMemory: false,
    );
  }

  /// Ejecuta un bloque en una transacción relacional bitemporal atómica.
  T transaction<T>(T Function() action) {
    database.execute('BEGIN IMMEDIATE TRANSACTION;');
    try {
      final T result = action();
      database.execute('COMMIT;');
      return result;
    } catch (_) {
      database.execute('ROLLBACK;');
      rethrow;
    }
  }

  /// Cierra el almacén y libera conexiones.
  void close() {
    store.close();
  }
}
