// client_dna_store.dart — Almacén Relacional SQLite WAL Bitemporal para ADN de Clientes (§39, §45, §47)
library;

import 'dart:convert';
import 'package:sqlite3/sqlite3.dart';
import '../client_dna_models.dart';
import '../client_slot_types.dart';
import 'client_dna_schema.dart';
import 'identity_resolver.dart';

/// Almacén SQLite WAL bitemporal para entidades y hechos de clientes.
class ClientDnaStore {
  final Database db;
  late final IdentityResolver resolver;
  final bool _ownsDatabase;

  ClientDnaStore(this.db, {bool ownsDatabase = false})
    : _ownsDatabase = ownsDatabase {
    ClientDnaSchema.initialize(db);
    resolver = IdentityResolver(db);
  }

  /// Crea un almacén en memoria para pruebas o scratch efímero (§4).
  factory ClientDnaStore.openInMemory() {
    final Database db = sqlite3.openInMemory();
    return ClientDnaStore(db, ownsDatabase: true);
  }

  /// Abre un almacén persistente en la ruta indicada.
  factory ClientDnaStore.open(String filePath) {
    final Database db = sqlite3.open(filePath);
    return ClientDnaStore(db, ownsDatabase: true);
  }

  /// Guarda o actualiza una entidad de cliente y sincroniza sus alias multicanal.
  void saveEntity(ClientEntity entity) {
    db.execute('BEGIN TRANSACTION;');
    try {
      final PreparedStatement stmt = db.prepare('''
        INSERT INTO client_entities (
          id, tenant_id, client_type, primary_name, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          tenant_id = excluded.tenant_id,
          client_type = excluded.client_type,
          primary_name = excluded.primary_name,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at;
      ''');
      try {
        stmt.execute(<Object?>[
          entity.id,
          entity.tenantId,
          entity.clientType.wireName,
          entity.primaryName,
          jsonEncode(entity.metadata),
          entity.createdAt.toIso8601String(),
          entity.updatedAt.toIso8601String(),
        ]);
      } finally {
        stmt.close();
      }

      for (final String alias in entity.aliases) {
        resolver.registerAlias(
          clientId: entity.id,
          alias: alias,
          tenantId: entity.tenantId,
        );
      }
      db.execute('COMMIT;');
    } catch (_) {
      db.execute('ROLLBACK;');
      rethrow;
    }
  }

  /// Obtiene una entidad por su [clientId].
  ClientEntity? getEntity(String clientId, {String tenantId = 'default'}) {
    final PreparedStatement stmt = db.prepare('''
      SELECT id, tenant_id, client_type, primary_name, metadata, created_at, updated_at
      FROM client_entities
      WHERE id = ? AND tenant_id = ?
      LIMIT 1;
    ''');
    try {
      final ResultSet rows = stmt.select(<Object?>[clientId, tenantId]);
      if (rows.isEmpty) return null;
      final Row row = rows.first;
      final List<String> aliases = resolver.getAliases(
        clientId,
        tenantId: tenantId,
      );
      final String? metaStr = row['metadata'] as String?;
      return ClientEntity(
        id: row['id'] as String,
        tenantId: row['tenant_id'] as String,
        clientType: ClientType.fromString(row['client_type'] as String),
        primaryName: row['primary_name'] as String,
        aliases: aliases,
        createdAt: DateTime.parse(row['created_at'] as String),
        updatedAt: DateTime.parse(row['updated_at'] as String),
        metadata: metaStr != null && metaStr.isNotEmpty
            ? Map<String, dynamic>.from(
                jsonDecode(metaStr) as Map<Object?, Object?>,
              )
            : null,
      );
    } finally {
      stmt.close();
    }
  }

  /// Registra un nuevo hecho aplicando invalidación bitemporal si ya existía un hecho activo en el slot.
  void recordFact(ClientFact fact) {
    db.execute('BEGIN TRANSACTION;');
    try {
      // 1. Cerrar ventana de validez previa para el mismo (client_id, slot_type)
      final PreparedStatement invalidateStmt = db.prepare('''
        UPDATE client_facts
        SET valid_to = ?
        WHERE client_id = ? AND slot_type = ? AND is_invalidated = 0
          AND (valid_to IS NULL OR valid_to > ?);
      ''');
      try {
        final String nowIso = fact.validFrom.toIso8601String();
        invalidateStmt.execute(<Object?>[
          nowIso,
          fact.clientId,
          fact.slotType.wireName,
          nowIso,
        ]);
      } finally {
        invalidateStmt.close();
      }

      // 2. Insertar o actualizar el hecho
      final PreparedStatement insertStmt = db.prepare('''
        INSERT INTO client_facts (
          id, client_id, slot_type, value_json, epistemic_status, confidence,
          source_citation, valid_from, valid_to, ingested_at, is_invalidated, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          valid_to = excluded.valid_to,
          is_invalidated = excluded.is_invalidated,
          metadata = excluded.metadata;
      ''');
      try {
        insertStmt.execute(<Object?>[
          fact.id,
          fact.clientId,
          fact.slotType.wireName,
          jsonEncode(fact.value),
          fact.epistemicStatus.wireName,
          fact.confidence,
          fact.sourceCitation,
          fact.validFrom.toIso8601String(),
          fact.validTo?.toIso8601String(),
          fact.ingestedAt.toIso8601String(),
          fact.isInvalidated ? 1 : 0,
          jsonEncode(fact.metadata),
        ]);
      } finally {
        insertStmt.close();
      }
      db.execute('COMMIT;');
    } catch (_) {
      db.execute('ROLLBACK;');
      rethrow;
    }
  }

  /// Obtiene todos los hechos vigentes en un instante [asOf] (por defecto DateTime.now()).
  List<ClientFact> getActiveFacts(String clientId, {DateTime? asOf}) {
    final DateTime target = asOf ?? DateTime.now().toUtc();
    final String targetIso = target.toIso8601String();

    final PreparedStatement stmt = db.prepare('''
      SELECT id, client_id, slot_type, value_json, epistemic_status, confidence,
             source_citation, valid_from, valid_to, ingested_at, is_invalidated, metadata
      FROM client_facts
      WHERE client_id = ? AND is_invalidated = 0
        AND valid_from <= ?
        AND (valid_to IS NULL OR valid_to > ?)
      ORDER BY valid_from ASC;
    ''');
    try {
      final ResultSet rows = stmt.select(<Object?>[
        clientId,
        targetIso,
        targetIso,
      ]);
      return rows.map(_rowToFact).toList();
    } finally {
      stmt.close();
    }
  }

  /// Obtiene el hecho activo para un slot específico en [asOf].
  ClientFact? getFactBySlot(
    String clientId,
    ClientSlotType slotType, {
    DateTime? asOf,
  }) {
    final List<ClientFact> active = getActiveFacts(clientId, asOf: asOf);
    for (final ClientFact f in active) {
      if (f.slotType == slotType) return f;
    }
    return null;
  }

  /// Obtiene el historial completo de hechos para un slot (incluyendo revocados/invalidados).
  List<ClientFact> getFactHistory(String clientId, ClientSlotType slotType) {
    final PreparedStatement stmt = db.prepare('''
      SELECT id, client_id, slot_type, value_json, epistemic_status, confidence,
             source_citation, valid_from, valid_to, ingested_at, is_invalidated, metadata
      FROM client_facts
      WHERE client_id = ? AND slot_type = ?
      ORDER BY valid_from DESC;
    ''');
    try {
      final ResultSet rows = stmt.select(<Object?>[
        clientId,
        slotType.wireName,
      ]);
      return rows.map(_rowToFact).toList();
    } finally {
      stmt.close();
    }
  }

  /// Búsqueda léxica FTS5 sobre los hechos de clientes sin dependencias vectoriales.
  List<ClientFact> searchFactsFts(String query, {String? clientId}) {
    final String clean = query.trim();
    if (clean.isEmpty) return <ClientFact>[];

    // Consulta con MATCH sobre FTS5
    final String sql;
    final List<Object?> params;
    if (clientId != null && clientId.isNotEmpty) {
      sql = '''
        SELECT cf.id, cf.client_id, cf.slot_type, cf.value_json, cf.epistemic_status, cf.confidence,
               cf.source_citation, cf.valid_from, cf.valid_to, cf.ingested_at, cf.is_invalidated, cf.metadata
        FROM client_facts_fts fts
        JOIN client_facts cf ON cf.id = fts.fact_id
        WHERE client_facts_fts MATCH ? AND cf.client_id = ?
        ORDER BY rank;
      ''';
      params = <Object?>[clean, clientId];
    } else {
      sql = '''
        SELECT cf.id, cf.client_id, cf.slot_type, cf.value_json, cf.epistemic_status, cf.confidence,
               cf.source_citation, cf.valid_from, cf.valid_to, cf.ingested_at, cf.is_invalidated, cf.metadata
        FROM client_facts_fts fts
        JOIN client_facts cf ON cf.id = fts.fact_id
        WHERE client_facts_fts MATCH ?
        ORDER BY rank;
      ''';
      params = <Object?>[clean];
    }

    final PreparedStatement stmt = db.prepare(sql);
    try {
      final ResultSet rows = stmt.select(params);
      return rows.map(_rowToFact).toList();
    } finally {
      stmt.close();
    }
  }

  ClientFact _rowToFact(Row row) {
    final String metaStr = row['metadata'] as String? ?? '{}';
    return ClientFact(
      id: row['id'] as String,
      clientId: row['client_id'] as String,
      slotType: ClientSlotType.fromString(row['slot_type'] as String),
      value: jsonDecode(row['value_json'] as String),
      epistemicStatus: EpistemicStatus.fromString(
        row['epistemic_status'] as String,
      ),
      confidence: (row['confidence'] as num).toDouble(),
      sourceCitation: row['source_citation'] as String?,
      validFrom: DateTime.parse(row['valid_from'] as String),
      validTo: row['valid_to'] != null
          ? DateTime.parse(row['valid_to'] as String)
          : null,
      ingestedAt: DateTime.parse(row['ingested_at'] as String),
      isInvalidated: (row['is_invalidated'] as int) == 1,
      metadata: Map<String, dynamic>.from(
        jsonDecode(metaStr) as Map<Object?, Object?>,
      ),
    );
  }

  /// Cierra la base de datos si es propietaria.
  void close() {
    if (_ownsDatabase) {
      db.close();
    }
  }
}
