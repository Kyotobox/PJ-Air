# Esquema Estándar de Frontmatter YAML para Skills (CONEXT Fleet)

## 1. Visión y Propósito
Este documento define la especificación formal del bloque frontmatter YAML obligatorio y opcional para todos los skills instanciados en la flota CONEXT (`.agents/skills/*/SKILL.md`).

El objetivo es permitir la auditoría automatizada, la catalogación estructurada en `capability_manifest.json`, el control de madurez de activos y la resolución determinista de dependencias cognitivas (§43 *Anclaje de Skills en Planificación*).

---

## 2. Esquema Formal

```yaml
---
# ==============================================================================
# CAMPOS OBLIGATORIOS (CORE METADATA)
# ==============================================================================
name: <string>              # Identificador único del skill en formato kebab-case.
description: <string>       # Resumen hiper-técnico, aséptico y denso del propósito del skill (1-3 líneas).
version: <semver>           # Versión semántica formal (MAJOR.MINOR.PATCH).
category: <string>          # Taxonomía funcional (ej. governance, business-strategy, technical-infrastructure).
origin_node: <string>       # Nodo de origen donde fue gestado inicialmente (ej. Smart, conext_core, Automa).

# ==============================================================================
# CAMPOS DE CICLO DE VIDA Y GOBERNANZA (OPCIONALES / EXTENDIDOS)
# ==============================================================================
maturity: <enum>            # Nivel de madurez: DRAFT | REVIEWED | CERTIFIED (Default: DRAFT).
qa_score: <string>          # Calificación del gate Q1-Q7 (ej. "Q1-Q7: 7/7 CERTIFIED").
last_reviewed: <iso8601>    # Fecha de la última auditoría formal (YYYY-MM-DD).
harvested_at: <iso8601>     # Fecha en que fue cosechado desde un satélite (si aplica).
cluster: <string>           # Agrupación o suite temática (ej. gov-fleet-suite, biz-engine-suite).
required_axioms: <list>     # Lista de paquetes o contratos de Shared Kernel requeridos (ej. [axioma_core, ingestion_engine]).
target_nodes: <list>        # Nodos compatibles o receptores autorizados (ej. [Smart, conext_core, satellite_all]).
---
```

---

## 3. Especificación Detallada de Campos

### 3.1 Campos Obligatorios

| Campo | Tipo | Validación | Descripción |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Regex `^[a-z0-9]+(-[a-z0-9]+)*$` | Nombre canónico único. Debe coincidir exactamente con el nombre de la carpeta contenedora. |
| `description` | `string` | Min: 30 chars, Max: 350 chars | Descripción densa sin servilismo. Debe mencionar capacidades concretas, motores y principios gobernados. |
| `version` | `string` | SemVer `^\d+\.\d+\.\d+$` | Control de versiones. `1.0.0` para primera versión estable; `0.x.x` para prototipos. |
| `category` | `string` | Kebab-case | Categoría temática para indexación (`governance`, `commercial-infrastructure`, etc.). |
| `origin_node` | `string` | PascalCase / snake_case | Nombre oficial del búnker de origen registrado en `fleet.json`. |

### 3.2 Campos de Ciclo de Vida (Opcionales / Extendidos)

| Campo | Tipo | Valores Permitidos | Propósito |
| :--- | :--- | :--- | :--- |
| `maturity` | `enum` | `DRAFT`, `REVIEWED`, `CERTIFIED` | Estado en el pipeline de madurez. Permite al CLI filtrar skills estables para despliegue en flota. |
| `qa_score` | `string` | Formato `Q1-Q7: N/7 [STATUS]` | Registro forense del resultado emitido por [`gov-skill-quality-gate`](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/gov-skill-quality-gate/SKILL.md). |
| `last_reviewed`| `string` | ISO Date `YYYY-MM-DD` | Timestamp para auditorías de obsolescencia o deuda técnica doctrinal. |
| `harvested_at` | `string` | ISO Date `YYYY-MM-DD` | Trazabilidad del momento de promoción desde el satélite proponente. |
| `cluster` | `string` | Kebab-case | Agrupador lógico para inyección masiva coordinada en sprints complejos. |
| `required_axioms`| `list` | Lista de strings | Declaración explícita de contratos que el búnker debe proveer para ejecutar el skill. |
| `target_nodes` | `list` | Lista de strings | Delimitación de alcance geográfico/arquitectónico dentro de la flota. |

---

## 4. Retrocompatibilidad y Defaults Seguros

Para garantizar que los skills preexistentes en la flota que aún no han incorporado los campos extendidos sigan funcionando sin alertas bloqueantes:

1. **Ausencia de `maturity`**: Se asume internamente como `DRAFT` si reside en un satélite, o `REVIEWED` si ya se encuentra en el directorio `.agents/skills/` de un Hub (Smart/Core).
2. **Ausencia de `required_axioms`**: Se asume lista vacía `[]` (el skill solo depende de capacidades estándar de su propio stack).
3. **Ausencia de `target_nodes`**: Se asume `[satellite_all, hub_all]` (habilidad universal de flota).
4. **Parser No Destructivo**: La herramienta de sincronización de capacidades (`logix sync-capabilities`) ignora campos desconocidos adicionales sin interrumpir el proceso de arranque ni disparar `DOCTRINAL_DRIFT`.

---

## 5. Ejemplo Canónico Completo

```yaml
---
name: biz-autopart-pricing
description: Motor integral de comercio automotriz y catálogo. Combina el cálculo financiero de precios en cascada (Cascade Pricing Engine, arbitraje multi-proveedor, descuentos por volumen) con el motor de matching de catálogo (cruces OEM/Aftermarket, validación de fitment vehicular y resolución difusa de repuestos).
version: 2.1.0
category: commercial-catalog-pricing
origin_node: Automa
maturity: CERTIFIED
qa_score: "Q1-Q7: 7/7 CERTIFIED"
last_reviewed: 2026-09-25
harvested_at: 2026-09-24
cluster: biz-autopart-suite
required_axioms:
  - axioma_pricing
  - axioma_catalog_cross
target_nodes:
  - Automa
  - Ruedas
  - Smart
---
```
