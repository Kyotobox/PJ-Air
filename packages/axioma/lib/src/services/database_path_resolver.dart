/// database_path_resolver.dart — Resolver Canónico de Persistencia Determinista (§19, §39, §58).
///
/// Shared Kernel Pure Dart agnóstico de UI. Centraliza y estandariza la resolución
/// de rutas para bases de datos SQLite en toda la flota CONEXT, erradicando fallbacks
/// heurísticos divergentes y previniendo copias duplicadas de bases de datos.
library;

import 'dart:io' as io;
import 'package:path/path.dart' as p;
import '../platform_guard.dart';

/// Excepción tipada para fallos en la resolución de rutas de base de datos (§6, §58).
class DatabasePathResolutionException implements Exception {
  final String message;
  final String? path;
  final dynamic cause;

  const DatabasePathResolutionException(this.message, {this.path, this.cause});

  @override
  String toString() {
    final StringBuffer buffer = StringBuffer(
      'DatabasePathResolutionException: $message',
    );
    if (path != null) {
      buffer.write(' [path: $path]');
    }
    if (cause != null) {
      buffer.write(' (causa: $cause)');
    }
    return buffer.toString();
  }
}

/// Resolver canónico de rutas de bases de datos para nodos de la flota CONEXT.
///
/// Implementa Single Path of Authority (SPA - §58) y paridad Multi-OS (§19)
/// a través de [PlatformGuard].
class AxiomaDatabaseResolver {
  final PlatformGuard platformGuard;
  final Map<String, String>? _environmentOverride;
  final String? _workingDirectoryOverride;

  /// Extensiones SQLite canónicas admitidas en la flota.
  static const Set<String> allowedExtensions = <String>{
    '.db',
    '.sqlite',
    '.sqlite3',
  };

  AxiomaDatabaseResolver({
    PlatformGuard? platformGuard,
    Map<String, String>? environmentOverride,
    String? workingDirectoryOverride,
  }) : platformGuard = platformGuard ?? PlatformGuard(),
       _environmentOverride = environmentOverride,
       _workingDirectoryOverride = workingDirectoryOverride;

  /// Retorna el entorno operativo activo (con soporte para overrides en pruebas sin mocks).
  Map<String, String> get _environment =>
      _environmentOverride ?? io.Platform.environment;

  /// Retorna el directorio de trabajo base activo.
  String get _currentWorkingDir =>
      _workingDirectoryOverride ?? io.Directory.current.path;

  /// Valida sintácticamente el nombre del archivo de base de datos.
  void validateDatabaseName(String databaseName) {
    final String trimmed = databaseName.trim();
    if (trimmed.isEmpty) {
      throw const DatabasePathResolutionException(
        'El nombre de la base de datos no puede estar vacío.',
      );
    }

    if (trimmed.contains('/') ||
        trimmed.contains(r'\') ||
        trimmed.contains('..') ||
        trimmed.contains('\x00')) {
      throw DatabasePathResolutionException(
        'El nombre del archivo contiene caracteres ilegales o secuencias de path traversal: $databaseName',
      );
    }

    final String ext = p.extension(trimmed).toLowerCase();
    if (!allowedExtensions.contains(ext)) {
      throw DatabasePathResolutionException(
        'Extensión de base de datos no autorizada: "$ext". Extensiones válidas: ${allowedExtensions.join(", ")}',
      );
    }
  }

  /// Retorna el directorio de datos canónico determinista.
  String resolveDataDirectory({String? baseDirectory}) {
    if (baseDirectory != null && baseDirectory.trim().isNotEmpty) {
      return platformGuard.normalizePath(baseDirectory.trim());
    }

    // 1. Variable de entorno explícita de la flota
    final String? envDir =
        _environment['CONEXT_DB_DIR'] ?? _environment['FLOT_DB_DIR'];
    if (envDir != null && envDir.trim().isNotEmpty) {
      return platformGuard.normalizePath(envDir.trim());
    }

    // 2. Directorio canónico local './data' bajo el working directory
    final String dataDir = platformGuard.pathContext.join(
      _currentWorkingDir,
      'data',
    );
    return platformGuard.normalizePath(dataDir);
  }

  /// Resuelve la ruta canónica absoluta del archivo SQLite.
  ///
  /// - [databaseName]: Nombre del archivo (ej. `ruedas_lake.db`).
  /// - [baseDirectory]: Directorio opcional para sobreescribir la raíz de datos.
  /// - [mustExist]: Si es true, valida que el archivo exista físicamente; si no, lanza [DatabasePathResolutionException].
  /// - [ensureDirectoryExists]: Si es true, asegura la existencia del directorio padre.
  String resolveCanonicalPath({
    required String databaseName,
    String? baseDirectory,
    bool mustExist = false,
    bool ensureDirectoryExists = true,
  }) {
    validateDatabaseName(databaseName);

    final String resolvedDir = resolveDataDirectory(
      baseDirectory: baseDirectory,
    );
    final io.Directory targetDirectory = io.Directory(resolvedDir);

    if (ensureDirectoryExists) {
      try {
        final io.File fileCheck = io.File(resolvedDir);
        if (fileCheck.existsSync() &&
            io.FileSystemEntity.isFileSync(resolvedDir)) {
          throw DatabasePathResolutionException(
            'El directorio de datos objetivo ya existe como un archivo regular y no un directorio.',
            path: resolvedDir,
          );
        }

        if (!targetDirectory.existsSync()) {
          targetDirectory.createSync(recursive: true);
        }
      } on DatabasePathResolutionException {
        rethrow;
      } catch (e) {
        throw DatabasePathResolutionException(
          'No fue posible asegurar el directorio canónico de base de datos: $resolvedDir',
          path: resolvedDir,
          cause: e,
        );
      }
    }

    final String fullPath = platformGuard.pathContext.join(
      resolvedDir,
      databaseName.trim(),
    );
    final String normalizedPath = platformGuard.normalizePath(fullPath);

    if (mustExist) {
      final io.File dbFile = io.File(normalizedPath);
      if (!dbFile.existsSync()) {
        throw DatabasePathResolutionException(
          'La base de datos canónica no existe en la ruta esperada.',
          path: normalizedPath,
        );
      }
    }

    return normalizedPath;
  }
}
