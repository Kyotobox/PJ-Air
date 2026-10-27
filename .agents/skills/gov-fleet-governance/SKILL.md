---
name: gov-fleet-governance
description: Guardián integral de gobernanza, arquitectura y calidad de assets.
owner_node: Smart
category: governance
version: 1.0.0
---

# Fleet Governance & Constitutional Quality Guardian (gov-fleet-governance)

## 1. Visión y Propósito
Este skill consolida la disciplina de calidad, veracidad empírica, integridad arquitectónica, propagación segura y evaluación cuantitativa de capacidades para toda la flota CONEXT. Actúa como el **Guardián Constitucional Técnico de la Flota**, auditando el cumplimiento estricto de los principios de diseño antes de cualquier commit, PR, relevo (handover) o matriculación de skills:

1. **Auditoría Antagónica de Principios de Core**:
   - **`MockGuard` (§4, §16)**: Proscripción absoluta de bibliotecas de simulación (`mockito`, `mocktail`, `Mock`) y stubs en código de producción y tests de dominio.
   - **`ConsumptionValidator` (§8)**: Detección y bloqueo de código huérfano (funciones, clases o modelos creados pero no conectados al flujo de ejecución principal).
   - **`PureDartGuard` (§39)**: Blindaje de Pure Dart Core. Proscripción estricta de dependencias de UI (`package:flutter`, `dart:html`) en capas de dominio, kernel o Shared Kernel (`packages/axioma`).
   - **`ThinClientGuard` (§40)**: Blindaje de Arquitectura Thin Client. Proscripción de queries SQL directas o lógica de negocio pesada dentro de widgets de interfaz.
   - **`ResourceGuard` (§33)**: Salvaguarda de recursos del sistema operativo. Verificación de límites de RAM (<85%), estrangulamiento de concurrencia (`IsolateThrottle`) y procesamiento por lotes atómicos (Chunking $\le$ 10,000 SKUs).
   - **`VeracityService` (§1, §20, §21)**: Exigencia de evidencia física en disco antes de autorizar transiciones en el backlog.

2. **Rollout en Cascada y Criptografía**:
   - Compilación cruzada determinista dual: Windows PE (`logix.exe`) y Linux ELF (`logix`).
   - Firma asimétrica estricta con par de claves RSA-2048 (`.sig`).
   - Propagación atómica con verificación de ADN (`kernel.hashes`) y reversión automática transaccional.

3. **Gobernanza Cuantitativa y Quality Gate de Skills (Q1–Q9 — CMMI Nivel 4)**:
   - Evaluación pre-inserción y control de madurez (`DRAFT` $\rightarrow$ `REVIEWED` $\rightarrow$ `CERTIFIED`).
   - **`Q8 (SPC Compliance)`**: Verificación de estabilidad estadística. Ninguna tarea debe provocar que el índice $FPAR$ caiga por debajo de $LCL = \mu - 2\sigma$.
   - **`Q9 (Mutation Proof)`**: Para toda tarea crítica `S0` o `S1`, exigencia mandatoria de reporte físico de mutación acotado a Git Diff con puntaje $\ge 75.0\%$ (`tools/mutation_gate.dart`), vetando aserciones tautológicas.
   - Estándar YAML obligatorio para frontmatter.

4. **Cierre Cibernético y Motor CAR (CMMI Nivel 5)**:
   - **`CarEngine` (Causal Analysis & Resolution)**: Descomposición determinista 5-Why para fallos y defectos.
   - **`PreventiveActionDispatcher`**: Persistencia obligatoria de acciones preventivas en `vault/runtime/preventive_actions.json`.
   - **`AstDoctrineLinter` (§4, §8, §39)**: Auditoría sintáctica para veto físico de mocks en producción, código huérfano y UI en capas de dominio o core agnóstico.
   - **Compuerta de Cierre de Sprint**: Prohibido el cierre de sprint si existen defectos registrados sin una acción preventiva CAR asociada.

---

## 2. Arquitectura de Módulos (Sub-Referencias)

```text
.agents/skills/gov-fleet-governance/
├── SKILL.md                          <-- Orquestador Constitucional (Este archivo)
├── references/
│   ├── skill_quality_gate.md              <-- Checklist Q1-Q9 y Template <EVALUACION_SKILL>
│   ├── skill_auto_improvement_protocol.md <-- Bucle cerrado de auto-mejora continua (4 fases)
│   ├── promotion_protocol.md              <-- Protocolo de promoción de activos Satélite → Hub
│   ├── skill_frontmatter_schema.md        <-- Esquema formal YAML para metadatos de skills
│   ├── harvest_sources.json               <-- Whitelist / Blacklist y reglas de reputación
│   └── safe_harvest_protocol.md           <-- Protocolo de cuarentena y admisión en 4 fases
└── scripts/
    └── security_scanner.py           <-- Motor de escaneo estático (Secrets, AST, Prompt Injection)
```

---

## 3. Protocolos de Verificación

### Protocolo A: Auditoría Antagónica de Código
Consultar las directivas §1 a §46 en `GEMINI-FULL.md`. Ante cualquier violación de `MockGuard`, `PureDartGuard` o `ResourceGuard`, se emite un rechazo inmediato.

### Protocolo B: Evaluación de Nuevos Skills
1. Consultar [references/skill_quality_gate.md](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/gov-fleet-governance/references/skill_quality_gate.md).
2. Auditar el skill propuesto contra los 7 criterios Q1 a Q7.
3. Emitir el bloque obligatorio `<EVALUACION_SKILL>`.
4. Verificar que el frontmatter cumpla con [references/skill_frontmatter_schema.md](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/gov-fleet-governance/references/skill_frontmatter_schema.md).

### Protocolo C: Safe-Harvesting y Cuarentena
1. Consultar [references/safe_harvest_protocol.md](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/gov-fleet-governance/references/safe_harvest_protocol.md).
2. Aislar todo código externo en `vault/quarantine/`.
3. Ejecutar `scripts/security_scanner.py`. El Auditor Antagonista aplica veto si hay fallas críticas.
4. Desarrollar pruebas unitarias físicas (§6) antes de la admisión oficial.

### Protocolo D: Auto-Mejora Continua de Skills
1. Consultar [references/skill_auto_improvement_protocol.md](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/gov-fleet-governance/references/skill_auto_improvement_protocol.md).
2. Bucle de 4 fases: Telemetría de Fricción → Detección de Deuda → Gate Antagónico Q1-Q7 + 3 Anti-Corrupción → Sellado y Promoción.
3. Activación: Solo cuando un skill acumula anomalías de fricción en ≥2 sesiones distintas.
4. Restricción: Ninguna auto-mejora puede relajar reglas doctrinales (§26). Toda mutación se registra en backlog antes de ejecutarse.

### Protocolo E: Ciclo Cerrado CAR (CMMI Nivel 5)
1. Ante fallo de test o excepción en producción, invocar `CarEngine.analyze()`.
2. Despachar acción preventiva mediante `PreventiveActionDispatcher.dispatchFromCausalResult()`.
3. Ejecutar `AstDoctrineLinter.lintDirectory()` antes de sellar PR o cerrar sprint.
4. Veto estricto: Todo defecto abierto sin remediación CAR asociada bloquea el cierre del sprint.
