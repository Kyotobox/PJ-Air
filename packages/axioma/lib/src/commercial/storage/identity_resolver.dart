// identity_resolver.dart — Resolución de Identidad Multicanal Pure Dart (§39, §45, §47)
library;

import 'package:sqlite3/sqlite3.dart';
import '../client_dna_models.dart';
import '../client_slot_types.dart';

/// Resolvedor y registrador determinista de identidades multicanal.
class IdentityResolver {
  final Database db;

  const IdentityResolver(this.db);

  /// Resuelve el [clientId] correspondiente a un [alias] (ej. teléfono, tax_id, email).
  /// Retorna `null` si el alias no está registrado.
  String? resolveClientId({
    required String alias,
    String tenantId = 'default',
  }) {
    final String cleanAlias = alias.trim().toLowerCase();
    if (cleanAlias.isEmpty) return null;

    final PreparedStatement stmt = db.prepare('''
      SELECT client_id FROM client_aliases
      WHERE tenant_id = ? AND LOWER(alias) = ?
      LIMIT 1;
    ''');
    try {
      final ResultSet rows = stmt.select(<Object?>[tenantId, cleanAlias]);
      if (rows.isEmpty) return null;
      return rows.first['client_id'] as String;
    } finally {
      stmt.close();
    }
  }

  /// Registra un nuevo alias vinculado a [clientId].
  /// Si el alias ya pertenecía a otro cliente en el mismo tenant, lanza [StateError].
  void registerAlias({
    required String clientId,
    required String alias,
    String tenantId = 'default',
  }) {
    final String cleanAlias = alias.trim().toLowerCase();
    if (cleanAlias.isEmpty) {
      throw ArgumentError.value(
        alias,
        'alias',
        'El alias no puede estar vacío.',
      );
    }
    if (clientId.trim().isEmpty) {
      throw ArgumentError.value(
        clientId,
        'clientId',
        'El clientId no puede estar vacío.',
      );
    }

    final String? existingClientId = resolveClientId(
      alias: cleanAlias,
      tenantId: tenantId,
    );

    if (existingClientId != null) {
      if (existingClientId != clientId) {
        throw StateError(
          'Conflicto de Identidad Multicanal (§47): El alias "$cleanAlias" ya está asociado al cliente "$existingClientId" y no puede reasignarse a "$clientId".',
        );
      }
      // Ya está registrado para este mismo cliente; idempotente
      return;
    }

    final PreparedStatement insertStmt = db.prepare('''
      INSERT INTO client_aliases (tenant_id, alias, client_id, created_at)
      VALUES (?, ?, ?, ?);
    ''');
    try {
      insertStmt.execute(<Object?>[
        tenantId,
        cleanAlias,
        clientId,
        DateTime.now().toUtc().toIso8601String(),
      ]);
    } finally {
      insertStmt.close();
    }
  }

  /// Retorna todos los alias registrados para un [clientId].
  List<String> getAliases(String clientId, {String tenantId = 'default'}) {
    final PreparedStatement stmt = db.prepare('''
      SELECT alias FROM client_aliases
      WHERE tenant_id = ? AND client_id = ?
      ORDER BY created_at ASC;
    ''');
    try {
      final ResultSet rows = stmt.select(<Object?>[tenantId, clientId]);
      return rows.map((Row r) => r['alias'] as String).toList();
    } finally {
      stmt.close();
    }
  }

  /// Resuelve la entidad completa a partir de un alias dado.
  ClientEntity? resolveEntity({
    required String alias,
    String tenantId = 'default',
  }) {
    final String? clientId = resolveClientId(alias: alias, tenantId: tenantId);
    if (clientId == null) return null;

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
      final List<String> aliases = getAliases(clientId, tenantId: tenantId);
      return ClientEntity(
        id: row['id'] as String,
        tenantId: row['tenant_id'] as String,
        clientType: ClientType.fromString(row['client_type'] as String),
        primaryName: row['primary_name'] as String,
        aliases: aliases,
        createdAt: DateTime.parse(row['created_at'] as String),
        updatedAt: DateTime.parse(row['updated_at'] as String),
      );
    } finally {
      stmt.close();
    }
  }
}
