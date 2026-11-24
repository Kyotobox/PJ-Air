// client_dna_schema.dart — Esquema Relacional SQLite WAL Bitemporal y FTS5 (§39, §45, §47)
library;

import 'package:sqlite3/sqlite3.dart';

/// Inicializador de esquemas y directivas WAL para el almacén de ADN de clientes.
class ClientDnaSchema {
  const ClientDnaSchema._();

  /// Configura pragmas WAL y crea tablas, índices y tablas virtuales FTS5.
  static void initialize(Database db) {
    // Configuración WAL para resiliencia offline-first (§45)
    db.execute('PRAGMA journal_mode = WAL;');
    db.execute('PRAGMA synchronous = NORMAL;');
    db.execute('PRAGMA foreign_keys = ON;');

    // 1. Tabla de entidades unificadas de clientes
    db.execute('''
      CREATE TABLE IF NOT EXISTS client_entities (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        client_type TEXT NOT NULL,
        primary_name TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    ''');

    // 2. Tabla de resolución de alias multicanal (N:1)
    db.execute('''
      CREATE TABLE IF NOT EXISTS client_aliases (
        tenant_id TEXT NOT NULL,
        alias TEXT NOT NULL,
        client_id TEXT NOT NULL REFERENCES client_entities(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (tenant_id, alias)
      );
    ''');

    // 3. Tabla bitemporal de hechos del cliente
    db.execute('''
      CREATE TABLE IF NOT EXISTS client_facts (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES client_entities(id) ON DELETE CASCADE,
        slot_type TEXT NOT NULL,
        value_json TEXT NOT NULL,
        epistemic_status TEXT NOT NULL,
        confidence REAL NOT NULL,
        source_citation TEXT,
        valid_from TEXT NOT NULL,
        valid_to TEXT,
        ingested_at TEXT NOT NULL,
        is_invalidated INTEGER NOT NULL DEFAULT 0,
        metadata TEXT
      );
    ''');

    // Índices bitemporales para consultas de alta velocidad (<5ms)
    db.execute('''
      CREATE INDEX IF NOT EXISTS idx_facts_bitemporal 
      ON client_facts(client_id, is_invalidated, valid_from, valid_to);
    ''');

    db.execute('''
      CREATE INDEX IF NOT EXISTS idx_facts_slot 
      ON client_facts(client_id, slot_type);
    ''');

    // 4. Tabla virtual FTS5 para búsqueda léxica sin dependencias vectoriales
    db.execute('''
      CREATE VIRTUAL TABLE IF NOT EXISTS client_facts_fts USING fts5(
        fact_id UNINDEXED,
        client_id UNINDEXED,
        slot_type,
        text_content
      );
    ''');

    // Triggers automáticos para mantener sincronizado el índice FTS5
    db.execute('''
      CREATE TRIGGER IF NOT EXISTS trg_facts_fts_ai AFTER INSERT ON client_facts
      BEGIN
        INSERT INTO client_facts_fts(fact_id, client_id, slot_type, text_content)
        VALUES (new.id, new.client_id, new.slot_type, new.slot_type || ' ' || new.value_json || ' ' || coalesce(new.source_citation, ''));
      END;
    ''');

    db.execute('''
      CREATE TRIGGER IF NOT EXISTS trg_facts_fts_ad AFTER DELETE ON client_facts
      BEGIN
        DELETE FROM client_facts_fts WHERE fact_id = old.id;
      END;
    ''');

    db.execute('''
      CREATE TRIGGER IF NOT EXISTS trg_facts_fts_au AFTER UPDATE ON client_facts
      BEGIN
        DELETE FROM client_facts_fts WHERE fact_id = old.id;
        INSERT INTO client_facts_fts(fact_id, client_id, slot_type, text_content)
        VALUES (new.id, new.client_id, new.slot_type, new.slot_type || ' ' || new.value_json || ' ' || coalesce(new.source_citation, ''));
      END;
    ''');
  }
}
