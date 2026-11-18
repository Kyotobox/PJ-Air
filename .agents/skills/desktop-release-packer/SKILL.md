---
name: desktop-release-packer
description: Empaquetador fiduciario de releases de escritorio y guardián de integridad WAL SQLite (PRAGMA wal_checkpoint TRUNCATE a 0 bytes y erradicación de locks huérfanos).
---

# Desktop Release Packer Skill (§45, §55)

## Propósito
Provee un empaquetador fiduciario y guardián de integridad de base de datos para despliegues de aplicaciones desktop en la flota (Windows `.exe` y Linux ELF).
Resuelve el riesgo crítico de distribución de bases de datos con transacciones flotantes en el Write-Ahead Log (`.db-wal` residual > 0 bytes) o bases de datos bloqueadas por procesos huérfanos. Garantiza de manera determinista la ejecución de `PRAGMA wal_checkpoint(TRUNCATE)` y certifica físicamente que los archivos WAL queden a exactamente 0 bytes o purgados antes de crear artefactos o instaladores distribuibles.

## Herramientas y Scripts
* **Punto de Entrada**: `.agents/skills/desktop-release-packer/scripts/pack_release.dart`
* **Entorno**: Dart SDK / Pure Dart (Agnóstico, Multi-OS vía `PlatformGuard`, dependiente de `sqlite3` y utilidades del sistema).

## Modos de Operación CLI

### 1. Checkpoint de Integridad SQLite con TRUNCATE
Ejecuta el truncado del WAL en una base de datos específica o escanea recursivamente el directorio de datos:
```bash
dart run .agents/skills/desktop-release-packer/scripts/pack_release.dart \
  --db="data/ruedas_lake.db" \
  --checkpoint-truncate
```

### 2. Validación de Cero Bytes en WAL (Zero-Byte WAL Audit)
Inspecciona si el archivo `.db-wal` o `.db-shm` contiene datos pendientes o bloqueos:
```bash
dart run .agents/skills/desktop-release-packer/scripts/pack_release.dart \
  --db="data/ruedas_lake.db" \
  --validate-wal \
  --json
```

### 3. Cierre Preventivo de Procesos Huérfanos
Identifica y finaliza procesos que mantengan locks de lectura/escritura sobre el archivo de base de datos antes de empaquetar el release:
```bash
dart run .agents/skills/desktop-release-packer/scripts/pack_release.dart \
  --db="data/ruedas_lake.db" \
  --kill-orphans \
  --checkpoint-truncate
```

## Manejo de Excepciones y Sad Paths (§6, §55)
* Si el checkpoint devuelve código `BUSY=1` o el archivo WAL no puede ser vaciado a 0 bytes, el script aborta inmediatamente con `WalCheckpointException` (exit code 1) previniendo la generación de binarios o instaladores con corrupción de datos.
* Si el archivo de base de datos no existe o no tiene una extensión SQLite canónica autorizada, aborta con `WalCheckpointException`.
