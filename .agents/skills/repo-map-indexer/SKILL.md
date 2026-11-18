---
name: repo-map-indexer
description: Generador de Repo-Map determinista y liviano (estilo Aider) para resumir el grafo de clases, métodos y DTOs en <=2KB en RAM para workers de Automa.
owner_node: Smart
category: context
version: 1.0.0
---

# Repo-Map AST Indexer (repo-map-indexer)

## 1. Visión y Propósito
El skill `repo-map-indexer` provee un motor determinista, liviano y altamente comprimido de indexación de repositorios (algoritmo compacto inspirado en Aider) para la factoría de workers desatendidos de Automa (`vibraframe-worker:latest`).

Su propósito es extraer la topología estructural de clases, interfaces, mixins, enums, métodos, constructores, getters/setters, campos DTO y funciones de primer nivel tanto en código Dart (`.dart`) como Python (`.py`), empaquetando el mapa en un presupuesto estricto de **$\le$ 2KB en RAM** (2048 bytes) para ser inyectado eficientemente en el prompt de ejecución del worker sin saturar la ventana de contexto.

## 2. Principios de Arquitectura y Calm Error UX
1. **Presupuesto Fijo en RAM ($\le$ 2KB, §33)**: Por defecto trunca determinísticamente el resultado a 2048 bytes exactos (o el valor de `--max-bytes`), garantizando que la carga en memoria del worker sea predecible y despreciable.
2. **Calm Error UX y Degradación Suave (§6)**: Si el escaneador encuentra archivos con errores de sintaxis, bytes no decodificables o estructuras corruptas, **no aborta ni lanza excepciones no controladas**. Emite advertencias a `stderr` o marcas `# [SYNTAX_WARNING]` en el mapa y continúa indexando con éxito el resto del repositorio (código de retorno 0).
3. **Multi-OS y Rutas Normalizadas (`PlatformGuard`)**: Todas las rutas relativas se normalizan con separadores agnósticos `/`, garantizando paridad estricta entre entornos Linux VPS y Windows.
4. **Tolerancia Cero a Mocks (§4)**: No depende de mocks ni servicios externos; opera analíticamente sobre el sistema de archivos real y los ASTs nativos.

## 3. Contratos de Entrada y Salida (I/O Contracts)

### Parámetros de Línea de Comandos (CLI)
* `--root <PATH>`: Ruta raíz del repositorio o subdirectorio a indexar (por defecto: `.`).
* `--output <PATH>`: Archivo de destino donde se persistirá el mapa. Si se omite, escribe en `stdout`.
* `--max-bytes <INT>`: Presupuesto máximo en bytes del mapa de salida (por defecto: `2048`).
* `--format <text|json>`: Formato del mapa (por defecto: `text` estilo Aider; opción `json` estructurado).
* `--include-ext <EXTS>`: Extensiones separadas por coma a incluir (por defecto: `.dart,.py`).
* `--exclude-dirs <DIRS>`: Carpetas a omitir (por defecto: `.git,.dart_tool,build,node_modules,dist,__pycache__,.system_generated,.idea,.vscode`).
* `--verbose`: Activa diagnósticos de parsing y advertencias de degradación en `stderr`.

### Códigos de Salida
* `0`: Operación exitosa (incluso si hubo archivos individuales con sintaxis degradada que fueron manejados suavemente).
* `2`: Error de argumentos de invocación (ruta raíz inexistente, `--max-bytes` inválido $\le 0$).

## 4. Ejemplos de Salida

### Formato Texto Compacto (Aider-Style)
```text
# REPO-MAP (codebase-ast-indexer)
# Root: Smart | Files: 2 | Budget: 2048 B

lib/models/user_dto.dart:
  class UserDto:
    final String id
    final String name
    UserDto({required this.id, required this.name})
    Map<String, dynamic> toJson()
lib/services/auth_service.dart:
  class AuthService:
    Future<UserDto> login(String user, String pass)
    void logout()
```

### Formato JSON
```json
{
  "generator": "repo-map-indexer",
  "version": "1.0.0",
  "root": "Smart",
  "files_count": 2,
  "budget_bytes": 2048,
  "truncated": false,
  "warnings": [],
  "files": [ ... ]
}
```

## 5. Invocación desde Workers y CLI
```bash
# Invocación estándar (resumen en <= 2KB)
python3 .agents/skills/repo-map-indexer/scripts/generate_repo_map.py --root=. --max-bytes=2048

# Generación en archivo con formato JSON
python3 .agents/skills/repo-map-indexer/scripts/generate_repo_map.py --root=lib/src --format=json --output=vault/runtime/repo_map.json
```

## 6. Certificación Constitucional (§4, §6, §43, §48, §55)
* **Suite de Pruebas**: `test/skills/repo_map_indexer_test.dart` certifica el Happy Path con Dart y Python, el Sad Path con directorios corruptos y argumentos erróneos, y la garantía del presupuesto $\le$ 2KB.
* **Calidad**: Pure Dart Core agnóstico (§39), paridad Test-to-Prod (§43), Zero-Mocks (§4) y Cierre Autárquico (§48).
