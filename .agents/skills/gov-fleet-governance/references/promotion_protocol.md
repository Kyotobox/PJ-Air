# Protocolo de Promoción de Activos de Flota (Satélite → Hub)

## 1. Visión General
El **Protocolo de Promoción de Activos** gobierna el flujo soberano mediante el cual capacidades técnicas desarrolladas inicialmente en nodos satélites (skills, axiomas, contratos o servicios de dominio) son cosechadas, auditadas, catalogadas y finalmente propagadas al Shared Kernel (`packages/axioma`), a `packages/ingestion_engine` o al catálogo federado de capacidades de la flota CONEXT.

Este mecanismo implementa activamente la regla **§37 (Protocolo de Evaluación de Activo de Flota)** y la regla **§8 (Principio del Circuito Cerrado)**.

---

## 2. Diferenciación de Flujo: Satélite vs. Hub

```text
┌─────────────────────────────────┐        ┌──────────────────────────────────┐
│      NODO SATÉLITE (PROPONE)    │        │       NODO HUB (PROMOCIONA)      │
├─────────────────────────────────┤        ├──────────────────────────────────┤
│ 1. Desarrolla capacidad local.  │        │ 1. Escanea / detecta candidato.  │
│ 2. Marca @HarvestCandidate.     │ ──────>│ 2. Aplica Gate Q1-Q7 (Smart).    │
│ 3. Registra propuesta en task.  │        │ 3. Abstrae y desacopla (Core).   │
│ 4. No puede mutar Shared Kernel.│        │ 4. Firma y propaga a la flota.   │
└─────────────────────────────────┘        └──────────────────────────────────┘
```

- **Satélite (Rol Proponente)**:
  - Desarrolla la lógica para satisfacer una necesidad de producto local (ej. parsing de catálogo vehicular, OCR de pólizas).
  - Identifica el potencial de reusabilidad durante la Fase 1 de `/task` (*Gate de Reusabilidad*).
  - Anota el activo con `@HarvestCandidate` o propone su promoción en `task.md`.
  - **Prohibición**: El satélite tiene prohibido escribir directamente en los repositorios de los Hubs o modificar `packages/axioma` de forma autónoma.

- **Hubs (Rol Evaluador y Promotor)**:
  - **Smart (Evaluador Estratégico)**: Ejecuta la auditoría de calidad mediante el skill [`gov-skill-quality-gate`](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/gov-skill-quality-gate/SKILL.md), validando el checklist Q1-Q7 y emitiendo el bloque `<EVALUACION_SKILL>`.
  - **Core (Ejecutor y Sello Criptográfico)**: Incorpora el código al Shared Kernel, ejecuta la suite de tests agnósticos Pure Dart (§39), compila determinísticamente, firma asimétricamente (RSA-2048) y orquesta el rollout en cascada.

---

## 3. Las 4 Fases del Ciclo de Vida de Promoción

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1.DETECCIÓN │ ──> │ 2.PROMOCIÓN  │ ──> │  3.REGISTRO  │ ──> │4.PROPAGACIÓN │
│ (Harvesting) │     │ (Quality-Q7) │     │  (Manifest)  │     │  (Rollout)   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Fase 1: Detección (Harvesting)
La identificación de activos candidatos a promoción se realiza a través de tres mecanismos complementarios:
1. **Anotación `@HarvestCandidate`**:
   - El desarrollador o agente marca clases, funciones o skills con la anotación o comentario `@HarvestCandidate(domain: "fleet", rationale: "...")`.
2. **Escaneo de Cosecha (`harvest scan`)**:
   - Rutina automatizada del CLI `logix` que inspecciona nodos satélites registrados en `vault/fleet.json` buscando candidatos anotados o patrones redundantes entre búnkers.
3. **Gate de Reusabilidad (§12 de /task)**:
   - Durante el Pre-Flight de toda tarea, el agente evalúa si la lógica a escribir resuelve un problema recurrente para la flota. Si es así, se anota como candidato formal de promoción.

### Fase 2: Promoción y Gate de Calidad (Quality Gate)
Una vez detectado, el activo es sometido a la evaluación rigurosa en el nodo Smart:
1. **Auditoría Q1-Q7**: Se ejecuta el checklist de 7 compuertas de [`gov-skill-quality-gate`](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/gov-skill-quality-gate/SKILL.md):
   - Q1: Propósito Unificado.
   - Q2: Pure Dart / Agnóstico (§39).
   - Q3: Cero Mocks (§4, §16).
   - Q4: Anti-Conflicto Doctrinal (§36).
   - Q5: Eficiencia de Recursos (§30, §33).
   - Q6: Sanidad de Código Externo.
   - Q7: Frontmatter Estándar.
2. **Emisión de Dictamen**: Se sella el bloque `<EVALUACION_SKILL>` en el resumen de sesión o reporte de sprint.
3. **Condición de Aprobación**: Solo activos con dictamen `APROBADO (CERTIFIED)` son autorizados para integración al repositorio central.

### Fase 3: Registro y Catalogación
1. **Asignación de ID Único**: Formato `CAP-[NODO]-[DOMINIO]-[NN]` (ej. `CAP-SMART-SKILL-QUALITY-01`).
2. **Frontmatter Enriquecido**: Incorporación de metadatos de ciclo de vida (`maturity: CERTIFIED`, `harvested_at`, `origin_node`).
3. **Actualización de Manifiesto**: Registro atómico en `capability_manifest.json` incrementando el contador `total_capabilities`.

### Fase 4: Propagación (Rollout)
1. **Compilación y Empaquetado**: Core empaqueta el activo en el Shared Kernel (`packages/axioma`) o suite de skills compartidos.
2. **Sello Criptográfico**: Generación de firma RSA-2048 (`kernel.hashes`, `.sig`).
3. **Rollout en Cascada**: El CLI `logix fleet-push` sincroniza los satélites, actualizando sus sub-módulos o dependencias sin romper compatibilidad.

---

## 4. Identificación: Actualización vs. Creación Nueva

Para evitar colisiones de versiones o bifurcaciones de código:

| Criterio | Creación Nueva | Actualización / Refactor |
| :--- | :--- | :--- |
| **Existencia en Manifiesto** | No existe en `capability_manifest.json`. | El `name` o `id` ya existe en el manifiesto. |
| **Impacto en Contrato** | Define un nuevo contrato o interfaz. | Mantiene o extiende la interfaz preexistente. |
| **Versionado Semántico** | Inicia en `1.0.0`. | Incremento semántico: `PATCH` (fix), `MINOR` (feat), `MAJOR` (breaking). |
| **Tratamiento en Gate** | Evaluación completa Q1-Q7 desde cero. | Auditoría focalizada en delta de cambios y regresiones de tests. |
| **Deprecación** | N/A. | Si es `MAJOR`, se documenta ventana de deprecación para satélites. |

---

## 5. Diagrama Textual del Flujo Completo

```text
[Nodo Satélite]
       │
       ▼ (Desarrollo local)
[Gate de Reusabilidad / @HarvestCandidate]
       │
       ▼ (Propuesta de promoción en backlog / audit)
[CLI logix harvest scan]
       │
       ▼ (Transferencia controlada a Smart)
[Smart: gov-skill-quality-gate]
       │
       ├─ [RECHAZADO] ──> Retorna al satélite con acciones de remediación.
       │
       ├─ [CONDICIONAL / DRAFT] ──> Requiere ajustes menores antes de propagar.
       │
       └─ [CERTIFIED] ──> Pasa a Registro y Promoción.
                                 │
                                 ▼
                     [capability_manifest.json]
                                 │
                                 ▼
                     [Core: Pure Dart Integration]
                                 │
                                 ▼
                     [Firma RSA-2048 & logix fleet-push]
                                 │
                                 ▼
                     [Propagación a todos los Satélites]
```
