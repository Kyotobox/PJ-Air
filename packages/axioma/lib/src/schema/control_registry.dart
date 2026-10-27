/// Control Registry Manager & Schema (§46 CAR CMMI Nivel 5)
///
/// Gestiona el registro maestro de controles binarios de gobernanza física,
/// desacoplando la verificación de la narrativa de los modelos LLM.
/// Adhiere estrictamente a Pure Dart Core (§39).
library;

import 'package:sqlite3/sqlite3.dart';

/// Definición inmutable de un control binario registrado
class GovernanceControl {
  final String controlId;
  final String node;
  final String binaryCheck;
  final String description;
  final bool isActive;
  final String severity;

  const GovernanceControl({
    required this.controlId,
    required this.node,
    required this.binaryCheck,
    required this.description,
    this.isActive = true,
    this.severity = 'BLOCKING',
  });

  Map<String, dynamic> toMap() => <String, dynamic>{
    'control_id': controlId,
    'node': node,
    'binary_check': binaryCheck,
    'description': description,
    'is_active': isActive ? 1 : 0,
    'severity': severity,
  };

  factory GovernanceControl.fromRow(Row row) {
    return GovernanceControl(
      controlId: row['control_id'] as String,
      node: row['node'] as String,
      binaryCheck: row['binary_check'] as String,
      description: row['description'] as String,
      isActive: (row['is_active'] as int) == 1,
      severity: row['severity'] as String? ?? 'BLOCKING',
    );
  }
}

/// Gestor del catálogo maestro de controles binarios
class ControlRegistryManager {
  final Database db;

  const ControlRegistryManager(this.db);

  /// Inicializa el esquema DDL y siembra los controles canónicos
  void initSchema() {
    db.execute('''
      CREATE TABLE IF NOT EXISTS control_registry (
          control_id TEXT PRIMARY KEY,
          node TEXT NOT NULL,
          binary_check TEXT NOT NULL,
          description TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          severity TEXT NOT NULL DEFAULT 'BLOCKING',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_control_node_active 
          ON control_registry(node, is_active);
    ''');
  }

  /// Registra o actualiza un control
  void registerControl(GovernanceControl control) {
    if (control.controlId.trim().isEmpty) {
      throw ArgumentError('controlId no puede estar vacío');
    }
    if (control.binaryCheck.trim().isEmpty) {
      throw ArgumentError('binaryCheck no puede estar vacío');
    }

    db.execute(
      '''
      INSERT INTO control_registry (control_id, node, binary_check, description, is_active, severity)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(control_id) DO UPDATE SET
        node = excluded.node,
        binary_check = excluded.binary_check,
        description = excluded.description,
        is_active = excluded.is_active,
        severity = excluded.severity;
    ''',
      <Object>[
        control.controlId,
        control.node,
        control.binaryCheck,
        control.description,
        control.isActive ? 1 : 0,
        control.severity,
      ],
    );
  }

  /// Obtiene todos los controles activos para un nodo
  List<GovernanceControl> getActiveControls(String node) {
    final ResultSet results = db.select(
      '''
      SELECT control_id, node, binary_check, description, is_active, severity
      FROM control_registry
      WHERE node = ? AND is_active = 1
      ORDER BY control_id ASC;
    ''',
      <Object>[node],
    );

    return results.map(GovernanceControl.fromRow).toList();
  }

  /// Verifica si un control específico existe y está activo
  bool isControlActive(String controlId) {
    final ResultSet results = db.select(
      '''
      SELECT is_active FROM control_registry WHERE control_id = ?;
    ''',
      <Object>[controlId],
    );

    if (results.isEmpty) return false;
    return (results.first['is_active'] as int) == 1;
  }
}
