import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;
import 'package:sqlite3/sqlite3.dart';

import '../platform_guard.dart';
import '../testing/test_database_factory.dart';
import 'incremental_render_spec.dart';

/// Excepción base para anomalías en el motor de almacenamiento CAS.
class CasStorageException implements Exception {
  final String message;
  final CasKey? casKey;

  const CasStorageException(this.message, {this.casKey});

  @override
  String toString() =>
      'CasStorageException: $message${casKey != null ? ' [Key: ${casKey!.value}]' : ''}';
}

/// Excepción lanzada cuando un artefacto no existe en el índice CAS o en disco.
class CasNotFoundException extends CasStorageException {
  const CasNotFoundException(super.message, {super.casKey});

  @override
  String toString() =>
      'CasNotFoundException: $message${casKey != null ? ' [Key: ${casKey!.value}]' : ''}';
}

/// Excepción lanzada cuando el contenido físico no coincide con el hash SHA-256 declarado.
class CasCorruptedArtifactException extends CasStorageException {
  final String? expectedHash;
  final String? actualHash;

  const CasCorruptedArtifactException(
    super.message, {
    super.casKey,
    this.expectedHash,
    this.actualHash,
  });

  @override
  String toString() =>
      'CasCorruptedArtifactException: $message [Expected: $expectedHash, Actual: $actualHash]';
}

/// Excepción lanzada cuando el registro existe en la base de datos pero el archivo físico está ausente.
class CasMissingFileException extends CasStorageException {
  final String filePath;

  const CasMissingFileException(
    super.message, {
    super.casKey,
    required this.filePath,
  });

  @override
  String toString() => 'CasMissingFileException: $message [Path: $filePath]';
}

/// Excepción lanzada ante violaciones de las políticas de desalojo (ej. borrar artefactos anclados).
class CasEvictionException extends CasStorageException {
  const CasEvictionException(super.message, {super.casKey});

  @override
  String toString() =>
      'CasEvictionException: $message${casKey != null ? ' [Key: ${casKey!.value}]' : ''}';
}

/// Excepción lanzada en modo estricto cuando la cuota no puede liberarse debido a artefactos anclados.
class CasQuotaExceededException extends CasStorageException {
  final int currentBytes;
  final int maxBytes;

  const CasQuotaExceededException(
    super.message, {
    required this.currentBytes,
    required this.maxBytes,
  });

  @override
  String toString() =>
      'CasQuotaExceededException: $message [Current: $currentBytes B, Limit: $maxBytes B]';
}

/// Opciones de configuración para el motor de almacenamiento CAS.
class CasStorageEngineOptions {
  final String rootDirectory;
  final int maxSizeBytes;
  final int maxItems;
  final CasEvictionStrategy evictionStrategy;
  final double highWatermarkFraction;
  final double lowWatermarkFraction;
  final bool strictQuota;
  final PlatformGuard platformGuard;

  CasStorageEngineOptions({
    required this.rootDirectory,
    this.maxSizeBytes = 500 * 1024 * 1024, // 500 MB por defecto
    this.maxItems = 10000,
    this.evictionStrategy = CasEvictionStrategy.lru,
    this.highWatermarkFraction = 0.90,
    this.lowWatermarkFraction = 0.75,
    this.strictQuota = false,
    PlatformGuard? platformGuard,
  }) : platformGuard = platformGuard ?? PlatformGuard() {
    if (rootDirectory.trim().isEmpty) {
      throw const CasKeyValidationException(
        'rootDirectory no puede ser una cadena vacía',
      );
    }
    if (maxSizeBytes <= 0) {
      throw CasKeyValidationException(
        'maxSizeBytes debe ser mayor a 0: $maxSizeBytes',
      );
    }
    if (maxItems <= 0) {
      throw CasKeyValidationException('maxItems debe ser mayor a 0: $maxItems');
    }
    if (highWatermarkFraction <= 0.0 || highWatermarkFraction > 1.0) {
      throw CasKeyValidationException(
        'highWatermarkFraction debe estar en el rango (0.0, 1.0]: $highWatermarkFraction',
      );
    }
    if (lowWatermarkFraction <= 0.0 ||
        lowWatermarkFraction > highWatermarkFraction) {
      throw CasKeyValidationException(
        'lowWatermarkFraction debe ser mayor a 0.0 y menor o igual a highWatermarkFraction: '
        '$lowWatermarkFraction > $highWatermarkFraction',
      );
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'root_directory': rootDirectory,
    'max_size_bytes': maxSizeBytes,
    'max_items': maxItems,
    'eviction_strategy': evictionStrategy.value,
    'high_watermark_fraction': highWatermarkFraction,
    'low_watermark_fraction': lowWatermarkFraction,
    'strict_quota': strictQuota,
  };
}

/// Informe de una operación de desalojo de artefactos en CAS.
class CasEvictionReport {
  final CasEvictionStrategy strategy;
  final List<CasKey> evictedKeys;
  final int freedBytes;
  final int freedItems;
  final int remainingBytes;
  final int remainingItems;
  final bool isThresholdSatisfied;
  final int elapsedMs;

  const CasEvictionReport({
    required this.strategy,
    required this.evictedKeys,
    required this.freedBytes,
    required this.freedItems,
    required this.remainingBytes,
    required this.remainingItems,
    required this.isThresholdSatisfied,
    required this.elapsedMs,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'strategy': strategy.value,
    'evicted_keys': evictedKeys.map((CasKey k) => k.value).toList(),
    'freed_bytes': freedBytes,
    'freed_items': freedItems,
    'remaining_bytes': remainingBytes,
    'remaining_items': remainingItems,
    'is_threshold_satisfied': isThresholdSatisfied,
    'elapsed_ms': elapsedMs,
  };

  @override
  String toString() =>
      'CasEvictionReport(strategy: ${strategy.value}, evicted: ${evictedKeys.length}, '
      'freed: $freedBytes B, remaining: $remainingBytes B, satisfied: $isThresholdSatisfied)';
}

/// Resultado de la verificación de integridad criptográfica de un artefacto CAS.
class CasVerificationResult {
  final CasKey casKey;
  final bool isValid;
  final String expectedHash;
  final String? actualHash;
  final String? errorMessage;

  const CasVerificationResult({
    required this.casKey,
    required this.isValid,
    required this.expectedHash,
    this.actualHash,
    this.errorMessage,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'cas_key': casKey.value,
    'is_valid': isValid,
    'expected_hash': expectedHash,
    'actual_hash': actualHash,
    'error_message': errorMessage,
  };
}

/// Informe consolidado de auditoría de integridad en el repositorio CAS.
class CasAuditReport {
  final int totalScanned;
  final int validCount;
  final int corruptedCount;
  final int missingCount;
  final int prunedCount;
  final List<CasKey> corruptedKeys;
  final List<CasKey> missingKeys;
  final int elapsedMs;

  const CasAuditReport({
    required this.totalScanned,
    required this.validCount,
    required this.corruptedCount,
    required this.missingCount,
    required this.prunedCount,
    required this.corruptedKeys,
    required this.missingKeys,
    required this.elapsedMs,
  });

  bool get isClean => corruptedCount == 0 && missingCount == 0;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'total_scanned': totalScanned,
    'valid_count': validCount,
    'corrupted_count': corruptedCount,
    'missing_count': missingCount,
    'pruned_count': prunedCount,
    'corrupted_keys': corruptedKeys.map((CasKey k) => k.value).toList(),
    'missing_keys': missingKeys.map((CasKey k) => k.value).toList(),
    'is_clean': isClean,
    'elapsed_ms': elapsedMs,
  };
}

/// Estadísticas en vivo de utilización y rendimiento del motor CAS.
class CasStorageStats {
  final int totalBytes;
  final int totalItems;
  final int pinnedItems;
  final int pinnedBytes;
  final int hitCount;
  final int missCount;
  final int evictionCount;
  final double hitRatio;
  final int maxSizeBytes;
  final int maxItems;
  final double usageFraction;

  const CasStorageStats({
    required this.totalBytes,
    required this.totalItems,
    required this.pinnedItems,
    required this.pinnedBytes,
    required this.hitCount,
    required this.missCount,
    required this.evictionCount,
    required this.hitRatio,
    required this.maxSizeBytes,
    required this.maxItems,
    required this.usageFraction,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'total_bytes': totalBytes,
    'total_items': totalItems,
    'pinned_items': pinnedItems,
    'pinned_bytes': pinnedBytes,
    'hit_count': hitCount,
    'miss_count': missCount,
    'eviction_count': evictionCount,
    'hit_ratio': hitRatio,
    'max_size_bytes': maxSizeBytes,
    'max_items': maxItems,
    'usage_fraction': usageFraction,
  };
}

/// Motor de Almacenamiento Direccionable por Contenido (CAS Storage Engine)
/// con Hashing SHA-256, Partición Jerárquica y Desalojo LRU/LFU/FIFO (§4, §6, §39, §43, §54).
class CasStorageEngine {
  final CasStorageEngineOptions options;
  final Database _db;
  final bool _ownsDb;

  int _hitCount = 0;
  int _missCount = 0;
  int _evictionCount = 0;

  CasStorageEngine({required this.options, Database? customDb})
    : _db = customDb ?? _initDiskDatabase(options),
      _ownsDb = customDb == null {
    _initSchema();
  }

  static Database _initDiskDatabase(CasStorageEngineOptions options) {
    TestDatabaseFactory.ensureInitialized();
    final String normalizedRoot = options.platformGuard.normalizePath(
      options.rootDirectory,
    );
    final Directory rootDir = Directory(normalizedRoot);
    if (!rootDir.existsSync()) {
      rootDir.createSync(recursive: true);
    }

    final String dbPath = options.platformGuard.normalizePath(
      p.join(normalizedRoot, 'cas_index.db'),
    );
    final Database db = sqlite3.open(dbPath);
    try {
      db.execute('PRAGMA journal_mode = WAL;');
      db.execute('PRAGMA synchronous = NORMAL;');
      db.execute('PRAGMA foreign_keys = ON;');
    } catch (_) {
      // INTENTIONAL: Modos WAL son idempotentes y pueden degradar en entornos restrictivos.
    }
    return db;
  }

  void _initSchema() {
    _db.execute('''
      CREATE TABLE IF NOT EXISTS cas_artifacts (
        cas_key TEXT PRIMARY KEY,
        segment_type TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        width INTEGER,
        height INTEGER,
        fps REAL,
        codec TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL,
        access_count INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        file_path TEXT NOT NULL,
        extension TEXT NOT NULL DEFAULT 'mp4'
      );

      CREATE INDEX IF NOT EXISTS idx_cas_last_accessed 
        ON cas_artifacts(is_pinned, last_accessed_at ASC);
      CREATE INDEX IF NOT EXISTS idx_cas_access_count 
        ON cas_artifacts(is_pinned, access_count ASC, last_accessed_at ASC);
      CREATE INDEX IF NOT EXISTS idx_cas_created 
        ON cas_artifacts(is_pinned, created_at ASC);
    ''');
  }

  /// Almacena un artefacto a partir de bytes en memoria, validando integridad criptográfica SHA-256.
  CasMetadata store({
    required List<int> bytes,
    required CasMetadata metadata,
    String? extension,
  }) {
    final String computedHash = sha256.convert(bytes).toString();
    if (computedHash != metadata.casKey.value) {
      throw CasCorruptedArtifactException(
        'Integridad CAS violada: el hash SHA-256 del payload ($computedHash) '
        'no coincide con la clave CAS declarada (${metadata.casKey.value}).',
        casKey: metadata.casKey,
        expectedHash: metadata.casKey.value,
        actualHash: computedHash,
      );
    }
    if (bytes.length != metadata.sizeBytes) {
      throw CasKeyValidationException(
        'Discrepancia en tamaño físico: metadata declara ${metadata.sizeBytes} bytes, '
        'pero el payload contiene ${bytes.length} bytes.',
      );
    }

    final String cleanExt = _cleanExtension(extension, metadata.mimeType);
    final String relPath = metadata.casKey.partitionPath(extension: cleanExt);
    final String fullPath = options.platformGuard.normalizePath(
      p.join(options.rootDirectory, relPath),
    );

    final File targetFile = File(fullPath);
    if (!targetFile.parent.existsSync()) {
      targetFile.parent.createSync(recursive: true);
    }

    // Escritura atómica mediante archivo temporal y reemplazo
    final String tempPath =
        '$fullPath.tmp_${DateTime.now().microsecondsSinceEpoch}';
    final File tempFile = File(tempPath);
    tempFile.writeAsBytesSync(bytes, flush: true);

    if (targetFile.existsSync()) {
      targetFile.deleteSync();
    }
    tempFile.renameSync(fullPath);

    // Persistencia del índice en SQLite
    final PreparedStatement stmt = _db.prepare('''
      INSERT INTO cas_artifacts (
        cas_key, segment_type, mime_type, size_bytes, duration_ms,
        width, height, fps, codec, created_at, last_accessed_at,
        access_count, is_pinned, file_path, extension
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cas_key) DO UPDATE SET
        last_accessed_at = excluded.last_accessed_at,
        access_count = access_count + 1,
        is_pinned = excluded.is_pinned,
        file_path = excluded.file_path,
        extension = excluded.extension;
    ''');

    try {
      stmt.execute(<Object?>[
        metadata.casKey.value,
        metadata.segmentType.value,
        metadata.mimeType,
        metadata.sizeBytes,
        metadata.durationMs,
        metadata.width,
        metadata.height,
        metadata.fps,
        metadata.codec,
        metadata.createdAt,
        metadata.lastAccessedAt,
        metadata.accessCount,
        metadata.isPinned ? 1 : 0,
        fullPath,
        cleanExt,
      ]);
    } finally {
      stmt.close();
    }

    _maybeTriggerEviction();

    return metadata;
  }

  /// Almacena contenido calculando automáticamente la clave `CasKey` y construyendo `CasMetadata`.
  CasMetadata storeContent({
    required List<int> bytes,
    required RenderSegmentType segmentType,
    required String mimeType,
    required String codec,
    int durationMs = 0,
    int? width,
    int? height,
    double? fps,
    bool isPinned = false,
    String? extension,
  }) {
    final String digestHex = sha256.convert(bytes).toString();
    final CasKey casKey = CasKey(digestHex);
    final String now = DateTime.now().toUtc().toIso8601String();

    final CasMetadata metadata = CasMetadata(
      casKey: casKey,
      segmentType: segmentType,
      mimeType: mimeType,
      sizeBytes: bytes.length,
      durationMs: durationMs,
      width: width,
      height: height,
      fps: fps,
      codec: codec,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 1,
      isPinned: isPinned,
    );

    return store(bytes: bytes, metadata: metadata, extension: extension);
  }

  /// Almacena un archivo físico existente en el almacenamiento CAS.
  CasMetadata storeFile({
    required File sourceFile,
    required CasMetadata metadata,
    String? extension,
  }) {
    if (!sourceFile.existsSync()) {
      throw CasNotFoundException(
        'El archivo fuente a almacenar en CAS no existe: ${sourceFile.path}',
        casKey: metadata.casKey,
      );
    }
    final Uint8List bytes = sourceFile.readAsBytesSync();
    return store(bytes: bytes, metadata: metadata, extension: extension);
  }

  /// Obtiene los bytes de un artefacto alojado en CAS y actualiza su telemetría LRU.
  Uint8List get(CasKey key) {
    final Uint8List? bytes = getOrNull(key);
    if (bytes == null) {
      throw CasNotFoundException(
        'Artefacto no encontrado en CAS: ${key.value}',
        casKey: key,
      );
    }
    return bytes;
  }

  /// Obtiene los bytes de un artefacto o `null` si no existe.
  Uint8List? getOrNull(CasKey key) {
    final ResultSet rs = _db.select(
      'SELECT file_path, size_bytes FROM cas_artifacts WHERE cas_key = ?;',
      <Object>[key.value],
    );
    if (rs.isEmpty) {
      _missCount++;
      return null;
    }

    final String filePath = rs.first['file_path'] as String;
    final File file = File(filePath);
    if (!file.existsSync()) {
      _missCount++;
      throw CasMissingFileException(
        'El registro CAS existe pero el archivo físico fue eliminado: $filePath',
        casKey: key,
        filePath: filePath,
      );
    }

    final Uint8List bytes = file.readAsBytesSync();
    _hitCount++;

    final String now = DateTime.now().toUtc().toIso8601String();
    _db.execute(
      'UPDATE cas_artifacts SET last_accessed_at = ?, access_count = access_count + 1 WHERE cas_key = ?;',
      <Object>[now, key.value],
    );

    return bytes;
  }

  /// Retorna la referencia física al archivo en disco y actualiza su marca de acceso.
  File getFile(CasKey key) {
    final ResultSet rs = _db.select(
      'SELECT file_path FROM cas_artifacts WHERE cas_key = ?;',
      <Object>[key.value],
    );
    if (rs.isEmpty) {
      _missCount++;
      throw CasNotFoundException(
        'Artefacto no encontrado en CAS: ${key.value}',
        casKey: key,
      );
    }

    final String filePath = rs.first['file_path'] as String;
    final File file = File(filePath);
    if (!file.existsSync()) {
      _missCount++;
      throw CasMissingFileException(
        'Archivo físico CAS ausente en disco: $filePath',
        casKey: key,
        filePath: filePath,
      );
    }

    _hitCount++;
    final String now = DateTime.now().toUtc().toIso8601String();
    _db.execute(
      'UPDATE cas_artifacts SET last_accessed_at = ?, access_count = access_count + 1 WHERE cas_key = ?;',
      <Object>[now, key.value],
    );

    return file;
  }

  /// Retorna los metadatos de un artefacto o `null` si no existe.
  CasMetadata? getMetadata(CasKey key) {
    final ResultSet rs = _db.select(
      'SELECT * FROM cas_artifacts WHERE cas_key = ?;',
      <Object>[key.value],
    );
    if (rs.isEmpty) return null;
    return _rowToMetadata(rs.first);
  }

  /// Comprueba si un artefacto existe en el índice y físicamente en disco.
  bool has(CasKey key) {
    final ResultSet rs = _db.select(
      'SELECT file_path FROM cas_artifacts WHERE cas_key = ?;',
      <Object>[key.value],
    );
    if (rs.isEmpty) return false;
    final String filePath = rs.first['file_path'] as String;
    return File(filePath).existsSync();
  }

  /// Elimina un artefacto físicamente de disco y del índice SQLite.
  bool delete(CasKey key, {bool force = false}) {
    final ResultSet rs = _db.select(
      'SELECT is_pinned, file_path FROM cas_artifacts WHERE cas_key = ?;',
      <Object>[key.value],
    );
    if (rs.isEmpty) return false;

    final int isPinned = rs.first['is_pinned'] as int;
    final String filePath = rs.first['file_path'] as String;

    if (isPinned == 1 && !force) {
      throw CasEvictionException(
        'No se puede eliminar el artefacto CAS anclado (${key.value}) sin la bandera force: true.',
        casKey: key,
      );
    }

    final File file = File(filePath);
    if (file.existsSync()) {
      try {
        file.deleteSync();
      } catch (_) {
        // INTENTIONAL: Silenciar fallas de sistema de archivos si el archivo ya fue removido.
      }
    }

    _db.execute('DELETE FROM cas_artifacts WHERE cas_key = ?;', <Object>[
      key.value,
    ]);
    return true;
  }

  /// Fija o remueve el estado de anclaje (pin) de un artefacto para protegerlo contra desalojo.
  void pin(CasKey key, {bool isPinned = true}) {
    final ResultSet rs = _db.select(
      'SELECT cas_key FROM cas_artifacts WHERE cas_key = ?;',
      <Object>[key.value],
    );
    if (rs.isEmpty) {
      throw CasNotFoundException(
        'No se puede modificar el pin: artefacto no encontrado: ${key.value}',
        casKey: key,
      );
    }

    _db.execute(
      'UPDATE cas_artifacts SET is_pinned = ? WHERE cas_key = ?;',
      <Object>[isPinned ? 1 : 0, key.value],
    );
  }

  /// Ejecuta el ciclo de desalojo para recuperar cuota bajo las marcas de agua establecidas.
  CasEvictionReport runEviction({
    int? targetFreedBytes,
    CasEvictionStrategy? strategyOverride,
  }) {
    final Stopwatch sw = Stopwatch()..start();
    final CasEvictionStrategy effectiveStrategy =
        strategyOverride ?? options.evictionStrategy;

    if (effectiveStrategy == CasEvictionStrategy.pinNeverEvict) {
      final CasStorageStats current = stats();
      sw.stop();
      return CasEvictionReport(
        strategy: effectiveStrategy,
        evictedKeys: const <CasKey>[],
        freedBytes: 0,
        freedItems: 0,
        remainingBytes: current.totalBytes,
        remainingItems: current.totalItems,
        isThresholdSatisfied: current.totalBytes <= options.maxSizeBytes,
        elapsedMs: sw.elapsedMilliseconds,
      );
    }

    final ResultSet initialRs = _db.select(
      'SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as total_bytes FROM cas_artifacts;',
    );
    int currentBytes = initialRs.first['total_bytes'] as int;
    int currentItems = initialRs.first['count'] as int;

    final int targetMaxBytes = targetFreedBytes != null
        ? currentBytes - targetFreedBytes
        : (options.maxSizeBytes * options.lowWatermarkFraction).round();
    final int targetMaxItems = (options.maxItems * options.lowWatermarkFraction)
        .round();

    String orderBy;
    switch (effectiveStrategy) {
      case CasEvictionStrategy.lru:
        orderBy = 'ORDER BY last_accessed_at ASC';
        break;
      case CasEvictionStrategy.lfu:
        orderBy = 'ORDER BY access_count ASC, last_accessed_at ASC';
        break;
      case CasEvictionStrategy.fifo:
        orderBy = 'ORDER BY created_at ASC';
        break;
      case CasEvictionStrategy.pinNeverEvict:
        orderBy = 'ORDER BY created_at ASC';
        break;
    }

    final ResultSet candidates = _db.select(
      'SELECT cas_key, size_bytes, file_path FROM cas_artifacts '
      'WHERE is_pinned = 0 $orderBy;',
    );

    final List<CasKey> evictedKeys = <CasKey>[];
    int freedBytes = 0;
    int freedItems = 0;

    for (final Row row in candidates) {
      if (currentBytes <= targetMaxBytes && currentItems <= targetMaxItems) {
        break;
      }

      final CasKey key = CasKey(row['cas_key'] as String);
      final int sizeBytes = row['size_bytes'] as int;
      final String filePath = row['file_path'] as String;

      final File file = File(filePath);
      if (file.existsSync()) {
        try {
          file.deleteSync();
        } catch (_) {
          // INTENTIONAL: Tolerar inconsistencias transitorias de IO durante desalojo.
        }
      }

      _db.execute('DELETE FROM cas_artifacts WHERE cas_key = ?;', <Object>[
        key.value,
      ]);

      evictedKeys.add(key);
      freedBytes += sizeBytes;
      freedItems += 1;
      currentBytes -= sizeBytes;
      currentItems -= 1;
      _evictionCount++;
    }

    sw.stop();
    final bool isThresholdSatisfied =
        currentBytes <= options.maxSizeBytes &&
        currentItems <= options.maxItems;

    if (!isThresholdSatisfied && options.strictQuota) {
      throw CasQuotaExceededException(
        'La cuota de almacenamiento no pudo liberarse por debajo de ${options.maxSizeBytes} B '
        'debido a artefactos anclados que impiden el desalojo.',
        currentBytes: currentBytes,
        maxBytes: options.maxSizeBytes,
      );
    }

    return CasEvictionReport(
      strategy: effectiveStrategy,
      evictedKeys: evictedKeys,
      freedBytes: freedBytes,
      freedItems: freedItems,
      remainingBytes: currentBytes,
      remainingItems: currentItems,
      isThresholdSatisfied: isThresholdSatisfied,
      elapsedMs: sw.elapsedMilliseconds,
    );
  }

  void _maybeTriggerEviction() {
    final ResultSet rs = _db.select(
      'SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as total_bytes FROM cas_artifacts;',
    );
    final int count = rs.first['count'] as int;
    final int totalBytes = rs.first['total_bytes'] as int;

    final int maxBytesThreshold =
        (options.maxSizeBytes * options.highWatermarkFraction).round();
    final int maxItemsThreshold =
        (options.maxItems * options.highWatermarkFraction).round();

    if (totalBytes >= maxBytesThreshold || count >= maxItemsThreshold) {
      runEviction();
    }
  }

  /// Verifica la integridad física de un artefacto comparando el contenido real con su SHA-256.
  CasVerificationResult verifyIntegrity(CasKey key) {
    final ResultSet rs = _db.select(
      'SELECT file_path FROM cas_artifacts WHERE cas_key = ?;',
      <Object>[key.value],
    );
    if (rs.isEmpty) {
      return CasVerificationResult(
        casKey: key,
        isValid: false,
        expectedHash: key.value,
        actualHash: null,
        errorMessage: 'Artefacto no registrado en el índice CAS.',
      );
    }

    final String filePath = rs.first['file_path'] as String;
    final File file = File(filePath);
    if (!file.existsSync()) {
      return CasVerificationResult(
        casKey: key,
        isValid: false,
        expectedHash: key.value,
        actualHash: null,
        errorMessage: 'Archivo físico ausente en disco: $filePath',
      );
    }

    final Uint8List bytes = file.readAsBytesSync();
    final String computed = sha256.convert(bytes).toString();
    final bool isValid = computed == key.value;

    return CasVerificationResult(
      casKey: key,
      isValid: isValid,
      expectedHash: key.value,
      actualHash: computed,
      errorMessage: isValid
          ? null
          : 'Discrepancia en suma de verificación: esperado ${key.value}, obtenido $computed',
    );
  }

  /// Audita la totalidad del repositorio CAS, detectando corrupción de datos o archivos perdidos.
  CasAuditReport auditIntegrity({bool autoPrune = false}) {
    final Stopwatch sw = Stopwatch()..start();
    final ResultSet rs = _db.select(
      'SELECT cas_key, file_path FROM cas_artifacts;',
    );

    int validCount = 0;
    int corruptedCount = 0;
    int missingCount = 0;
    int prunedCount = 0;
    final List<CasKey> corruptedKeys = <CasKey>[];
    final List<CasKey> missingKeys = <CasKey>[];

    for (final Row row in rs) {
      final CasKey key = CasKey(row['cas_key'] as String);
      final String filePath = row['file_path'] as String;
      final File file = File(filePath);

      if (!file.existsSync()) {
        missingCount++;
        missingKeys.add(key);
        if (autoPrune) {
          _db.execute('DELETE FROM cas_artifacts WHERE cas_key = ?;', <Object>[
            key.value,
          ]);
          prunedCount++;
        }
      } else {
        final Uint8List bytes = file.readAsBytesSync();
        final String computed = sha256.convert(bytes).toString();
        if (computed != key.value) {
          corruptedCount++;
          corruptedKeys.add(key);
          if (autoPrune) {
            try {
              file.deleteSync();
            } catch (_) {
              // INTENTIONAL: Tolerar fallo de borrado en archivo dañado.
            }
            _db.execute(
              'DELETE FROM cas_artifacts WHERE cas_key = ?;',
              <Object>[key.value],
            );
            prunedCount++;
          }
        } else {
          validCount++;
        }
      }
    }

    sw.stop();
    return CasAuditReport(
      totalScanned: rs.length,
      validCount: validCount,
      corruptedCount: corruptedCount,
      missingCount: missingCount,
      prunedCount: prunedCount,
      corruptedKeys: corruptedKeys,
      missingKeys: missingKeys,
      elapsedMs: sw.elapsedMilliseconds,
    );
  }

  /// Retorna las estadísticas agregadas en tiempo real de uso y aciertos del motor.
  CasStorageStats stats() {
    final ResultSet totalRs = _db.select(
      'SELECT COUNT(*) as total_items, COALESCE(SUM(size_bytes), 0) as total_bytes FROM cas_artifacts;',
    );
    final ResultSet pinnedRs = _db.select(
      'SELECT COUNT(*) as pinned_items, COALESCE(SUM(size_bytes), 0) as pinned_bytes FROM cas_artifacts WHERE is_pinned = 1;',
    );

    final int totalItems = totalRs.first['total_items'] as int;
    final int totalBytes = totalRs.first['total_bytes'] as int;
    final int pinnedItems = pinnedRs.first['pinned_items'] as int;
    final int pinnedBytes = pinnedRs.first['pinned_bytes'] as int;

    final int totalRequests = _hitCount + _missCount;
    final double hitRatio = totalRequests > 0 ? _hitCount / totalRequests : 0.0;
    final double usageFraction = options.maxSizeBytes > 0
        ? totalBytes / options.maxSizeBytes
        : 0.0;

    return CasStorageStats(
      totalBytes: totalBytes,
      totalItems: totalItems,
      pinnedItems: pinnedItems,
      pinnedBytes: pinnedBytes,
      hitCount: _hitCount,
      missCount: _missCount,
      evictionCount: _evictionCount,
      hitRatio: hitRatio,
      maxSizeBytes: options.maxSizeBytes,
      maxItems: options.maxItems,
      usageFraction: usageFraction,
    );
  }

  /// Cierra las conexiones activas si el motor es propietario de la base de datos.
  void close() {
    if (_ownsDb) {
      _db.close();
    }
  }

  static CasMetadata _rowToMetadata(Row row) {
    return CasMetadata(
      casKey: CasKey(row['cas_key'] as String),
      segmentType: RenderSegmentType.fromString(row['segment_type'] as String),
      mimeType: row['mime_type'] as String,
      sizeBytes: row['size_bytes'] as int,
      durationMs: row['duration_ms'] as int,
      width: row['width'] as int?,
      height: row['height'] as int?,
      fps: (row['fps'] as num?)?.toDouble(),
      codec: row['codec'] as String,
      createdAt: row['created_at'] as String,
      lastAccessedAt: row['last_accessed_at'] as String,
      accessCount: row['access_count'] as int? ?? 0,
      isPinned: (row['is_pinned'] as int? ?? 0) == 1,
    );
  }

  static String _cleanExtension(String? extension, String mimeType) {
    if (extension != null && extension.trim().isNotEmpty) {
      final String clean = extension.trim().toLowerCase();
      return clean.startsWith('.') ? clean.substring(1) : clean;
    }
    final String norm = mimeType.trim().toLowerCase();
    if (norm.contains('mp4')) return 'mp4';
    if (norm.contains('mp3') || norm.contains('mpeg')) return 'mp3';
    if (norm.contains('wav')) return 'wav';
    if (norm.contains('aac')) return 'aac';
    if (norm.contains('vtt')) return 'vtt';
    if (norm.contains('json')) return 'json';
    if (norm.contains('png')) return 'png';
    if (norm.contains('jpg') || norm.contains('jpeg')) return 'jpg';
    return 'bin';
  }
}
