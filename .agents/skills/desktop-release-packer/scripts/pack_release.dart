/// pack_release.dart — Empaquetador Fiduciario y Guardián WAL SQLite (§45, §55).
///
/// Herramienta de compilación y pre-empaquetado para aplicaciones de escritorio.
/// Garantiza la ejecución de PRAGMA wal_checkpoint(TRUNCATE), valida la erradicación
/// de archivos WAL flotantes (> 0 bytes) y previene la distribución de bases de datos corruptas.
library;

import 'dart:convert';
import 'dart:io';

import 'package:sqlite3/sqlite3.dart';

/// Excepción tipada para fallos durante el checkpoint de integridad o empaquetado WAL (§6, §55).
class WalCheckpointException implements Exception {
  final String message;
  final String? dbPath;
  final int? busyCode;
  final dynamic cause;

  const WalCheckpointException(
    this.message, {
    this.dbPath,
    this.busyCode,
    this.cause,
  });

  @override
  String toString() {
    final StringBuffer buffer = StringBuffer(
      'WalCheckpointException: $message',
    );
    if (dbPath != null) {
      buffer.write(' [dbPath: $dbPath]');
    }
    if (busyCode != null) {
      buffer.write(' [busyCode: $busyCode]');
    }
    if (cause != null) {
      buffer.write(' (causa: $cause)');
    }
    return buffer.toString();
  }
}

/// Resultado de la operación de truncado del WAL SQLite.
class WalCheckpointResult {
  final String dbPath;
  final bool success;
  final int busy;
  final int log;
  final int checkpointed;
  final int walSizeBytes;

  const WalCheckpointResult({
    required this.dbPath,
    required this.success,
    required this.busy,
    required this.log,
    required this.checkpointed,
    required this.walSizeBytes,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'db_path': dbPath,
    'success': success,
    'busy': busy,
    'log': log,
    'checkpointed': checkpointed,
    'wal_size_bytes': walSizeBytes,
  };
}

/// Motor de validación y empaquetado de bases de datos de escritorio.
class DesktopReleasePacker {
  /// Ejecuta PRAGMA wal_checkpoint(TRUNCATE) sobre [dbPath] y certifica WAL a 0 bytes.
  static WalCheckpointResult checkpointTruncate(
    String dbPath, {
    bool forceKillOrphans = false,
  }) {
    final File dbFile = File(dbPath);
    if (!dbFile.existsSync()) {
      throw WalCheckpointException(
        'El archivo de base de datos no existe físicamente en disco.',
        dbPath: dbPath,
      );
    }

    if (forceKillOrphans) {
      _attemptKillOrphanHolders(dbPath);
    }

    final Database db;
    try {
      db = sqlite3.open(dbPath);
    } catch (e) {
      throw WalCheckpointException(
        'No fue posible abrir la base de datos para ejecutar el checkpoint.',
        dbPath: dbPath,
        cause: e,
      );
    }

    try {
      final ResultSet result = db.select('PRAGMA wal_checkpoint(TRUNCATE);');
      int busy = 0;
      int log = 0;
      int checkpointed = 0;

      if (result.isNotEmpty) {
        final Row row = result.first;
        final List<dynamic> values = row.values.toList();
        busy = (values.isNotEmpty ? values[0] as int? : null) ?? 0;
        log = (values.length > 1 ? values[1] as int? : null) ?? 0;
        checkpointed = (values.length > 2 ? values[2] as int? : null) ?? 0;
      }

      if (busy != 0) {
        throw WalCheckpointException(
          'PRAGMA wal_checkpoint(TRUNCATE) reportó estado BUSY=$busy. Procesos activos retienen bloqueos de lectura/escritura.',
          dbPath: dbPath,
          busyCode: busy,
        );
      }

      db.close();

      // Validar físicamente el archivo WAL resultante
      final String walPath = '$dbPath-wal';
      final File walFile = File(walPath);
      final int walSize = walFile.existsSync() ? walFile.lengthSync() : 0;

      if (walSize > 0) {
        throw WalCheckpointException(
          'El archivo WAL retiene $walSize bytes tras la ejecución de TRUNCATE. Abortando empaquetado por riesgo de corrupción.',
          dbPath: dbPath,
        );
      }

      return WalCheckpointResult(
        dbPath: dbPath,
        success: true,
        busy: busy,
        log: log,
        checkpointed: checkpointed,
        walSizeBytes: walSize,
      );
    } catch (e) {
      try {
        db.close();
      } catch (_) {
        // INTENTIONAL: Close defensivo en caso de error previo
      }
      if (e is WalCheckpointException) {
        rethrow;
      }
      throw WalCheckpointException(
        'Error inesperado durante la ejecución de wal_checkpoint(TRUNCATE).',
        dbPath: dbPath,
        cause: e,
      );
    }
  }

  /// Valida que el archivo WAL esté a 0 bytes o no exista.
  static void validateZeroByteWal(String dbPath) {
    final String walPath = '$dbPath-wal';
    final File walFile = File(walPath);
    if (walFile.existsSync() && walFile.lengthSync() > 0) {
      throw WalCheckpointException(
        'Se detectó un archivo .db-wal con ${walFile.lengthSync()} bytes. Debe ejecutarse checkpointTruncate() antes de distribuir.',
        dbPath: dbPath,
      );
    }
  }

  static void _attemptKillOrphanHolders(String dbPath) {
    if (Platform.isLinux) {
      try {
        Process.runSync('fuser', <String>['-k', dbPath]);
      } catch (_) {
        // INTENTIONAL: fuser puede no estar instalado o no tener permisos root; el checkpoint fallará en BUSY si persiste el lock.
      }
    }
  }
}

void main(List<String> args) {
  String? dbPath;
  bool doCheckpoint = false;
  bool doValidate = false;
  bool killOrphans = false;
  bool asJson = false;

  if (args.contains('--help') || args.contains('-h')) {
    stdout.writeln(
      'Uso: dart run pack_release.dart --db=<path_to_db> [--checkpoint-truncate] [--validate-wal] [--kill-orphans] [--json]',
    );
    exit(0);
  }

  for (final String arg in args) {
    if (arg.startsWith('--db=')) {
      dbPath = arg.substring(5);
    } else if (arg == '--checkpoint-truncate') {
      doCheckpoint = true;
    } else if (arg == '--validate-wal') {
      doValidate = true;
    } else if (arg == '--kill-orphans') {
      killOrphans = true;
    } else if (arg == '--json') {
      asJson = true;
    }
  }

  if (dbPath == null || dbPath.isEmpty) {
    stderr.writeln(
      'Uso: dart run pack_release.dart --db=<path_to_db> [--checkpoint-truncate] [--validate-wal] [--kill-orphans] [--json]',
    );
    exit(2);
  }

  try {
    WalCheckpointResult? result;
    if (doCheckpoint || (!doCheckpoint && !doValidate)) {
      result = DesktopReleasePacker.checkpointTruncate(
        dbPath,
        forceKillOrphans: killOrphans,
      );
    }

    if (doValidate) {
      DesktopReleasePacker.validateZeroByteWal(dbPath);
    }

    if (asJson) {
      stdout.writeln(
        jsonEncode(<String, dynamic>{
          'status': 'OK',
          'db_path': dbPath,
          'checkpoint': result?.toJson(),
        }),
      );
    } else {
      stdout.writeln(
        '✅ [DesktopReleasePacker] Base de datos verificada y saneada con éxito: $dbPath',
      );
    }
    exit(0);
  } on WalCheckpointException catch (e) {
    if (asJson) {
      stderr.writeln(
        jsonEncode(<String, dynamic>{
          'status': 'ERROR',
          'error': e.toString(),
          'db_path': e.dbPath,
          'busy_code': e.busyCode,
        }),
      );
    } else {
      stderr.writeln('❌ [DesktopReleasePacker] ERROR: $e');
    }
    exit(1);
  } catch (e) {
    stderr.writeln('❌ [DesktopReleasePacker] ERROR INESPERADO: $e');
    exit(1);
  }
}
