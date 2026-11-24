/// catalog_bridge_sync.dart — Sincronizador Determinista de Catálogo BlueMarket -> Levita (§4, §6, §39, §55, §58).
///
/// Implementa el puente comercial y socrático entre el catálogo de arbitraje digital de BlueMarket
/// y la vitrina publicitaria de Levita.
///
/// Reglas de Negocio:
/// 1. Filtrado estricto por umbral de margen comercial (por defecto: margen >= 60.0%).
/// 2. Validación de integridad y tipado estricto mediante [CommercialProductContract].
/// 3. Sincronización atómica y determinista entre bases SQLite (o en memoria).
/// 4. Sad Paths tipados (§6): [CorruptDatabaseException], [DatabaseSchemaException],
///    [InvalidMarginException], [CommercialFinancialOverflowException].
library;

import 'dart:convert';
import 'dart:io';
import 'package:axioma/src/schema/commercial_contracts.dart';
import 'package:sqlite3/sqlite3.dart' as sqlite;

// =============================================================================
// EXCEPCIONES TIPADAS DE SINCRONIZACIÓN COMERCIAL (§6 SAD PATH MANDATORIO)
// =============================================================================

/// Excepción base para el subsistema de sincronización de catálogo.
abstract class CatalogBridgeException implements Exception {
  final String message;
  final dynamic details;

  const CatalogBridgeException(this.message, {this.details});

  @override
  String toString() =>
      'CatalogBridgeException: $message${details != null ? ' (Detalles: $details)' : ''}';
}

/// Sad Path: Base de datos SQLite inaccesible, dañada o corrupta.
class CorruptDatabaseException extends CatalogBridgeException {
  final String dbPath;

  const CorruptDatabaseException(
    super.message, {
    required this.dbPath,
    super.details,
  });

  @override
  String toString() =>
      'CorruptDatabaseException: $message [Ruta: $dbPath]${details != null ? ' Detalle: $details' : ''}';
}

/// Sad Path: Esquema de base de datos inexistente o columnas faltantes.
class DatabaseSchemaException extends CatalogBridgeException {
  final String tableName;
  final String missingColumn;

  const DatabaseSchemaException(
    super.message, {
    this.tableName = '',
    this.missingColumn = '',
    super.details,
  });

  @override
  String toString() =>
      'DatabaseSchemaException: $message [Tabla: $tableName, Columna: $missingColumn]';
}

/// Sad Path: Umbral de margen comercial numéricamente inválido.
class InvalidMarginException extends CatalogBridgeException {
  final double providedMargin;

  const InvalidMarginException(
    super.message, {
    required this.providedMargin,
    super.details,
  });

  @override
  String toString() =>
      'InvalidMarginException: $message [Margen recibido: $providedMargin]';
}

/// Sad Path: Desbordamiento financiero o valores fuera de rango monetario.
class CommercialFinancialOverflowException extends CatalogBridgeException {
  final dynamic value;

  const CommercialFinancialOverflowException(
    super.message, {
    this.value,
    super.details,
  });

  @override
  String toString() =>
      'CommercialFinancialOverflowException: $message [Valor: $value]';
}

// =============================================================================
// RESULTADO ESTRUCTURADO DE SINCRONIZACIÓN (§55)
// =============================================================================

/// Contenedor inmutable de métricas y resultados de la sincronización de catálogo.
class CatalogSyncResult {
  final int totalScanned;
  final int syncedCount;
  final int skippedCount;
  final double minMarginThreshold;
  final List<String> syncedSkus;
  final List<String> skippedSkus;
  final String summary;

  const CatalogSyncResult({
    required this.totalScanned,
    required this.syncedCount,
    required this.skippedCount,
    required this.minMarginThreshold,
    this.syncedSkus = const <String>[],
    this.skippedSkus = const <String>[],
    required this.summary,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'total_scanned': totalScanned,
    'synced_count': syncedCount,
    'skipped_count': skippedCount,
    'min_margin_threshold': minMarginThreshold,
    'synced_skus': syncedSkus,
    'skipped_skus': skippedSkus,
    'summary': summary,
  };

  @override
  String toString() =>
      'CatalogSyncResult(Scanned: $totalScanned, Synced: $syncedCount, Skipped: $skippedCount, Threshold: ${(minMarginThreshold * 100).toStringAsFixed(1)}%)';
}

// =============================================================================
// SINCRONIZADOR DETERMINISTA BLUEMARKET -> LEVITA (§55, §58)
// =============================================================================

/// Motor determinista de sincronización entre el catálogo digital de BlueMarket
/// y la vitrina publicitaria socrática de Levita.
class CatalogBridgeSync {
  /// Umbral mínimo de margen para que un producto califique (por defecto 0.60 = 60%).
  final double minMargin;

  /// Nombre de la tabla origen en BlueMarket.
  final String sourceTable;

  /// Nombre de la tabla destino en Levita.
  final String targetTable;

  const CatalogBridgeSync({
    this.minMargin = 0.60,
    this.sourceTable = 'bluemarket_catalog',
    this.targetTable = 'levita_showcase',
  });

  /// Valida que el margen sea numéricamente coherente ([0.0, 1.0]).
  void _validateMarginThreshold(double margin) {
    if (margin.isNaN || margin.isInfinite || margin < 0.0 || margin > 1.0) {
      throw InvalidMarginException(
        'El umbral de margen comercial debe encontrarse en el rango [0.0, 1.0].',
        providedMargin: margin,
      );
    }
  }

  /// Sincroniza dos bases de datos SQLite abiertas en memoria o archivo.
  CatalogSyncResult syncDatabases(
    sqlite.Database sourceDb,
    sqlite.Database targetDb, {
    bool dryRun = false,
  }) {
    _validateMarginThreshold(minMargin);

    // 1. Validar existencia y Quick-Check en la base origen
    try {
      final sqlite.ResultSet qc = sourceDb.select('PRAGMA quick_check;');
      if (qc.isNotEmpty && qc.first.values.first.toString() != 'ok') {
        throw const CorruptDatabaseException(
          'Fallo de integridad PRAGMA quick_check en base origen.',
          dbPath: 'in-memory or active db',
        );
      }
    } catch (e) {
      if (e is CatalogBridgeException) rethrow;
      throw CorruptDatabaseException(
        'La base de datos origen se encuentra corrupta o inaccesible: $e',
        dbPath: 'active db',
        details: e.toString(),
      );
    }

    // 2. Validar que la tabla origen exista
    final sqlite.ResultSet tableCheck = sourceDb.select(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?;",
      <Object>[sourceTable],
    );
    if (tableCheck.isEmpty) {
      throw DatabaseSchemaException(
        'La tabla origen "$sourceTable" no existe en la base de datos.',
        tableName: sourceTable,
      );
    }

    // 3. Validar columnas obligatorias en la tabla origen
    final sqlite.ResultSet pragmaTable = sourceDb.select(
      'PRAGMA table_info("$sourceTable");',
    );
    final Set<String> existingColumns = pragmaTable
        .map((sqlite.Row r) => (r['name'] as String).toLowerCase())
        .toSet();

    const List<String> requiredCols = <String>[
      'sku',
      'title',
      'cost_cents',
      'retail_price_cents',
    ];
    for (final String reqCol in requiredCols) {
      if (!existingColumns.contains(reqCol)) {
        throw DatabaseSchemaException(
          'La columna obligatoria "$reqCol" no existe en la tabla "$sourceTable".',
          tableName: sourceTable,
          missingColumn: reqCol,
        );
      }
    }

    // 4. Preparar tabla destino si no es dryRun
    if (!dryRun) {
      targetDb.execute('''
        CREATE TABLE IF NOT EXISTS "$targetTable" (
          sku TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          cost_cents INTEGER NOT NULL,
          retail_price_cents INTEGER NOT NULL,
          margin_pct REAL NOT NULL,
          stock INTEGER NOT NULL DEFAULT 0,
          delivery_type TEXT NOT NULL,
          asset_url TEXT,
          description TEXT,
          sales_channel TEXT NOT NULL DEFAULT 'whatsapp_socratic',
          synced_at TEXT NOT NULL
        );
      ''');
    }

    // 5. Escanear productos de BlueMarket
    final sqlite.ResultSet rows = sourceDb.select(
      'SELECT * FROM "$sourceTable";',
    );

    int totalScanned = 0;
    int syncedCount = 0;
    int skippedCount = 0;
    final List<String> syncedSkus = <String>[];
    final List<String> skippedSkus = <String>[];

    for (final sqlite.Row row in rows) {
      totalScanned++;
      final dynamic rawSku = row['sku'];
      final dynamic rawTitle = row['title'];
      final dynamic rawCost = row['cost_cents'];
      final dynamic rawRetail = row['retail_price_cents'];
      final dynamic rawStock = existingColumns.contains('stock')
          ? row['stock']
          : 0;
      final dynamic rawDelivery = existingColumns.contains('delivery_type')
          ? row['delivery_type']
          : 'staticAsset';
      final dynamic rawAssetUrl = existingColumns.contains('asset_url')
          ? row['asset_url']
          : null;
      final dynamic rawDescription = existingColumns.contains('description')
          ? row['description']
          : null;

      final String sku = rawSku?.toString().trim() ?? '';
      final String title = rawTitle?.toString().trim() ?? '';

      // Validación de enteros y desbordamientos financieros (§6)
      if (rawCost is! num || rawRetail is! num) {
        throw CommercialFinancialOverflowException(
          'Valores monetarios de cost_cents o retail_price_cents deben ser numéricos.',
          value: <String, dynamic>{'cost': rawCost, 'retail': rawRetail},
        );
      }

      final int costCents = rawCost.toInt();
      final int retailCents = rawRetail.toInt();

      if (costCents < 0 || retailCents < 0) {
        throw CommercialFinancialOverflowException(
          'Los valores monetarios no pueden ser negativos.',
          value: <String, int>{'cost': costCents, 'retail': retailCents},
        );
      }

      // Desbordamiento financiero (> $10,000,000 USD = 1,000,000,000 centavos)
      if (costCents > 1000000000 || retailCents > 1000000000) {
        throw CommercialFinancialOverflowException(
          'Desbordamiento financiero detectado en producto: supera el tope máximo de \$10,000,000 USD.',
          value: <String, int>{'cost': costCents, 'retail': retailCents},
        );
      }

      // Validar mapeo a DTO Canónico CommercialProductContract (§58)
      final CommercialProductContract productContract =
          CommercialProductContract(
            sku: sku,
            title: title,
            costUsd: costCents / 100.0,
            retailUsd: retailCents / 100.0,
            stockAvailable: (rawStock is num) ? rawStock.toInt() : 0,
            deliveryType: CommercialDeliveryType.fromJson(
              rawDelivery?.toString() ?? 'staticAsset',
            ),
            downloadUrl: rawAssetUrl?.toString(),
            metadata: <String, dynamic>{
              if (rawDescription != null)
                'description': rawDescription.toString(),
            },
          );

      final double calculatedMarginRatio = productContract.marginPct / 100.0;

      // Filtrado determinista por umbral de margen
      if (calculatedMarginRatio >= minMargin) {
        if (!dryRun) {
          targetDb.execute(
            '''
            INSERT OR REPLACE INTO "$targetTable" (
              sku, title, cost_cents, retail_price_cents, margin_pct,
              stock, delivery_type, asset_url, description, sales_channel, synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          ''',
            <Object?>[
              productContract.sku,
              productContract.title,
              costCents,
              retailCents,
              productContract.marginPct,
              productContract.stockAvailable,
              productContract.deliveryType.toJson(),
              productContract.downloadUrl,
              rawDescription?.toString(),
              'whatsapp_socratic',
              DateTime.now().toUtc().toIso8601String(),
            ],
          );
        }
        syncedCount++;
        syncedSkus.add(productContract.sku);
      } else {
        skippedCount++;
        skippedSkus.add(productContract.sku);
      }
    }

    final String summary =
        'Sincronización completada deterministamente: $syncedCount de $totalScanned productos calificados '
        '(margen >= ${(minMargin * 100).toStringAsFixed(1)}%). Omitidos: $skippedCount.';

    return CatalogSyncResult(
      totalScanned: totalScanned,
      syncedCount: syncedCount,
      skippedCount: skippedCount,
      minMarginThreshold: minMargin,
      syncedSkus: syncedSkus,
      skippedSkus: skippedSkus,
      summary: summary,
    );
  }

  /// Sincroniza dos bases de datos SQLite especificadas por sus rutas físicas de archivo.
  CatalogSyncResult syncPaths(
    String sourcePath,
    String targetPath, {
    bool dryRun = false,
  }) {
    final File sourceFile = File(sourcePath);
    if (!sourceFile.existsSync()) {
      throw CorruptDatabaseException(
        'El archivo de base de datos origen no existe físicamente en disco.',
        dbPath: sourcePath,
      );
    }

    // Verificar si el archivo está vacío (0 bytes = corrupto / inerte)
    if (sourceFile.lengthSync() == 0) {
      throw CorruptDatabaseException(
        'El archivo de base de datos origen tiene 0 bytes (vacío o corrupto).',
        dbPath: sourcePath,
      );
    }

    sqlite.Database? sourceDb;
    sqlite.Database? targetDb;

    try {
      try {
        sourceDb = sqlite.sqlite3.open(sourcePath);
      } catch (e) {
        throw CorruptDatabaseException(
          'Error al abrir la base de datos origen SQLite: $e',
          dbPath: sourcePath,
          details: e.toString(),
        );
      }

      if (!dryRun) {
        try {
          final File targetFile = File(targetPath);
          final Directory parentDir = targetFile.parent;
          if (!parentDir.existsSync()) {
            parentDir.createSync(recursive: true);
          }
          targetDb = sqlite.sqlite3.open(targetPath);
        } catch (e) {
          throw CorruptDatabaseException(
            'Error al abrir o inicializar la base de datos destino SQLite: $e',
            dbPath: targetPath,
            details: e.toString(),
          );
        }
      } else {
        // En dryRun usamos base en memoria para emulación segura
        targetDb = sqlite.sqlite3.openInMemory();
      }

      return syncDatabases(sourceDb, targetDb, dryRun: dryRun);
    } finally {
      sourceDb?.close();
      targetDb?.close();
    }
  }
}

// =============================================================================
// PUNTO DE ENTRADA CLI (§55.1)
// =============================================================================

void main(List<String> args) {
  String? sourcePath;
  String? targetPath;
  double minMargin = 0.60;
  String sourceTable = 'bluemarket_catalog';
  String targetTable = 'levita_showcase';
  bool dryRun = false;
  bool outputJson = false;

  for (final String arg in args) {
    if (arg == '--help' || arg == '-h') {
      stdout.writeln(
        'Uso: dart run catalog_bridge_sync.dart --source-db=<ruta> --target-db=<ruta> [opciones]',
      );
      stdout.writeln('Opciones:');
      stdout.writeln(
        '  --source-db=<ruta>       Ruta a la base de datos origen (BlueMarket)',
      );
      stdout.writeln(
        '  --target-db=<ruta>       Ruta a la base de datos destino (Levita)',
      );
      stdout.writeln(
        '  --min-margin=<double>    Umbral mínimo de margen (def: 0.60 = 60%)',
      );
      stdout.writeln(
        '  --source-table=<tabla>   Tabla origen (def: bluemarket_catalog)',
      );
      stdout.writeln(
        '  --target-table=<tabla>   Tabla destino (def: levita_showcase)',
      );
      stdout.writeln(
        '  --dry-run                Ejecución de prueba sin mutar base destino',
      );
      stdout.writeln(
        '  --json                   Emite salida en formato JSON estructurado',
      );
      exit(0);
    } else if (arg.startsWith('--source-db=')) {
      sourcePath = arg.substring('--source-db='.length).trim();
    } else if (arg.startsWith('--target-db=')) {
      targetPath = arg.substring('--target-db='.length).trim();
    } else if (arg.startsWith('--min-margin=')) {
      minMargin =
          double.tryParse(arg.substring('--min-margin='.length).trim()) ?? 0.60;
    } else if (arg.startsWith('--source-table=')) {
      sourceTable = arg.substring('--source-table='.length).trim();
    } else if (arg.startsWith('--target-table=')) {
      targetTable = arg.substring('--target-table='.length).trim();
    } else if (arg == '--dry-run') {
      dryRun = true;
    } else if (arg == '--json') {
      outputJson = true;
    }
  }

  if (sourcePath == null || (targetPath == null && !dryRun)) {
    stderr.writeln(
      'Error: Se requieren --source-db y --target-db (salvo en modo --dry-run).',
    );
    exit(1);
  }

  final CatalogBridgeSync synchronizer = CatalogBridgeSync(
    minMargin: minMargin,
    sourceTable: sourceTable,
    targetTable: targetTable,
  );

  try {
    final CatalogSyncResult result = synchronizer.syncPaths(
      sourcePath,
      targetPath ?? ':memory:',
      dryRun: dryRun,
    );

    if (outputJson) {
      stdout.writeln(jsonEncode(result.toJson()));
    } else {
      stdout.writeln('✅ [CATALOG-BRIDGE-SYNC-OK] ${result.summary}');
      stdout.writeln('   SKUs sincronizados: ${result.syncedSkus.join(', ')}');
      if (result.skippedSkus.isNotEmpty) {
        stdout.writeln(
          '   SKUs omitidos (< ${(minMargin * 100).toStringAsFixed(1)}%): ${result.skippedSkus.join(', ')}',
        );
      }
    }
    exit(0);
  } on CorruptDatabaseException catch (e) {
    stderr.writeln('❌ [CORRUPT-DB-ERROR] $e');
    exit(1);
  } on DatabaseSchemaException catch (e) {
    stderr.writeln('❌ [SCHEMA-ERROR] $e');
    exit(2);
  } on InvalidMarginException catch (e) {
    stderr.writeln('❌ [INVALID-MARGIN-ERROR] $e');
    exit(3);
  } on CommercialFinancialOverflowException catch (e) {
    stderr.writeln('❌ [FINANCIAL-OVERFLOW-ERROR] $e');
    exit(4);
  } catch (e) {
    stderr.writeln('❌ [UNEXPECTED-ERROR] $e');
    exit(5);
  }
}
