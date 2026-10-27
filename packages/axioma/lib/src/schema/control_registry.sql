-- Schema Maestro de Registro de Controles Binarios (§46 CAR CMMI Nivel 5)
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

-- Controles Canónicos Fundacionales
INSERT OR IGNORE INTO control_registry (control_id, node, binary_check, description, is_active, severity) VALUES
('CORE-01', 'conext_core', '.git/hooks/pre-push', 'Bloqueo git pre-push ante fallos de análisis estático o AST', 1, 'BLOCKING'),
('CORE-02', 'conext_core', 'bin/logix ast-lint', 'Detección determinista de mocks en lib/ y catch vacíos', 1, 'BLOCKING'),
('CORE-03', 'conext_core', 'bin/logix diagram-verify', 'Verificación byte-a-byte de diagramas Mermaid contra AST', 1, 'BLOCKING'),
('AUTOMA-01', 'automa', 'db/migrations/003_add_sla_and_escalation.sql', 'Dimensión temporal y SLA para tickets en cola', 1, 'BLOCKING'),
('AUTOMA-02', 'automa', 'systemctl is-active automa-dispatcher', 'Daemon desatendido systemd en segundo plano', 1, 'BLOCKING'),
('SMART-01', 'Smart', 'tools/pr_watcher_daemon.dart --gate=sad_path', 'AutoMergeGate con exigencia obligatoria de throwsA', 1, 'BLOCKING'),
('SMART-02', 'Smart', 'dart test --coverage', 'Cobertura mínima real sobre diff de líneas añadidas', 1, 'BLOCKING'),
('VM-01', 'Freestyle VM', 'scripts/freestyle_preflight.sh', 'Hardening pre-flight de permisos y toolchain en VM', 1, 'BLOCKING');
