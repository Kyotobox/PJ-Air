# Skill Quality Gate & Governance Validator (skill_quality_gate)

## 1. Visión y Propósito
El propósito de este módulo es garantizar que todo nuevo skill incorporado, adaptado o promocionado dentro del ecosistema CONEXT (Hubs y Satélites) cumpla con los más altos estándares de calidad técnica, coherencia arquitectónica y estricta conformidad doctrinal.

Este gate previene la polución del catálogo de capacidades (`capability_manifest.json`), el solapamiento funcional, la inyección de dependencias indebidas y la proliferación de deuda técnica cognitiva.

---

## 2. Los 7 Criterios de Calidad (Checklist Q1-Q7)

### Q1: Propósito Unificado y No Solapamiento
- **Descripción**: El skill debe resolver una capacidad atómica o un dominio de suite bien delimitado. No debe duplicar ni solapar funcionalidades ya cubiertas por skills existentes en la flota.
- **Señales de Aprobación**:
  - Propósito definido en una sola oración concisa en el frontmatter.
  - Verificación contra `capability_manifest.json` confirma que no existe un activo análogo.
  - Si complementa un skill existente, delimita con precisión la frontera de responsabilidades.
- **Señales de Rechazo**:
  - Duplicación de lógica ya presente en otro skill sin valor agregado distintivo.
  - Alcance ambiguo o multifuncional que mezcla responsabilidades no correlacionadas.

### Q2: Pureza y Arquitectura Agnóstica (§39 Pure Dart Core)
- **Descripción**: La lógica central, algoritmos, transformadores y casos de uso deben ser agnósticos de frameworks de UI (`package:flutter`, `dart:html`) o APIs propietarias no estándar.
- **Señales de Aprobación**:
  - Código agnóstico y portable (Pure Dart / TS estándar / Python estándar según el stack).
  - Capas de presentación e interfaz desacopladas hacia clientes delgados (§40).
- **Señales de Rechazo**:
  - Importaciones de widgets UI o frameworks gráficos en módulos de dominio o utilitarios.
  - Dependencias duras e innecesarias de entornos de ejecución específicos.

### Q3: Tolerancia Cero a Mocks y Datos Sintéticos (§4, §16)
- **Descripción**: Todo script, ejemplo, test o guía debe interactuar con interfaces reales, repositorios reales o bases de datos SQLite en memoria/scratch (`TestDatabaseFactory`).
- **Señales de Aprobación**:
  - Pruebas sustentadas en persistencia real o conexiones a servicios concretos.
  - Ejemplos basados en datos reales de negocio o esquemas DDL verificados.
- **Señales de Rechazo**:
  - Bibliotecas de simulación (`mockito`, `mocktail`, `jest.fn()`, `unittest.mock`).
  - Funciones de ejemplo que retornan datos estáticos *hardcoded* (`return "test"`, `return []`).

### Q4: Anti-Conflicto Doctrinal y Causa Raíz (§36, §38)
- **Descripción**: El skill debe promover soluciones que corrijan la causa raíz en la infraestructura o el modelo de datos, proscribiendo banderas sintomáticas o bypasses.
- **Señales de Aprobación**:
  - Manejo de excepciones tipadas con diagnósticos claros.
  - Tuberías de datos con validaciones exhaustivas.
- **Señales de Rechazo**:
  - Bloques `catch (_) {}` vacíos o sin justificación explícita `// INTENTIONAL: [razón]`.
  - Flags de bypass para silenciar fallos (`allowDuplicates`, `skipValidation`, `force`).

### Q5: Eficiencia de Recursos y Salvaguarda de SO (§30, §33)
- **Descripción**: En operaciones intensivas de datos, medios o cómputo, el skill debe implementar procesamiento en lotes, estrangulamiento de concurrencia y salvaguarda de RAM/CPU.
- **Señales de Aprobación**:
  - Procesamiento por lotes atómicos (Chunking $\le$ 10,000 registros).
  - Verificación de límites de RAM (<85%) y concurrencia adaptativa (`ResourceGuard`, `IsolateThrottle`).
- **Señales de Rechazo**:
  - Carga indiscriminada de colecciones masivas completas en memoria RAM de un solo golpe.
  - Bucles sin throttling ni puntos de persistencia intermedia (`job_checkpoints`).

### Q6: Adaptación de Skills Externos y Sanidad Contextual
- **Descripción**: Si el skill proviene de fuentes externas (plugins de IDE, repositorios open-source o librerías públicas), debe sanitizarse y alinearse a la convención de la flota.
- **Señales de Aprobación**:
  - Dependencias externas superfluas podadas.
  - Rutas absolutas foráneas reemplazadas por convenciones relativas del búnker.
  - Nomenclatura normalizada al estándar `kebab-case`.
- **Señales de Rechazo**:
  - Inyección ciega de código externo sin auditoría previa.
  - Llamadas a telemetrías o dependencias de red externas no autorizadas.

### Q7: Frontmatter Estándar, Formato y Accionabilidad
- **Descripción**: El archivo `SKILL.md` debe contener un bloque YAML parseable y una redacción estructurada con instrucciones accionables paso a paso.
- **Señales de Aprobación**:
  - Frontmatter con campos obligatorios (`name`, `description`, `version`, `category`, `origin_node`).
  - Instrucciones imperativas, claras y reproducibles para el agente.
- **Señales de Rechazo**:
  - Frontmatter ausente, malformado o con campos obligatorios vacíos.
  - Descripciones puramente teóricas sin pasos ejecutables ni validación.

### Q8: Control Estadístico de Procesos (SPC Compliance — CMMI Nivel 4)
- **Descripción**: La tarea o skill no debe inducir inestabilidad en la factoría. El First-Pass Acceptance Rate ($FPAR$) no debe perforar el límite de control inferior ($LCL = \mu - 2\sigma$), y la varianza relativa no debe exceder el 20%.
- **Señales de Aprobación**:
  - Tasa FPAR en límites nominales calculada por `tools/spc_engine.dart`.
  - Delivery Health Index ($DHI$) $\ge 70.0$.
- **Señales de Rechazo**:
  - Degradación de proceso que active estado `restrictedRegime` o varianza $>20\%$.

### Q9: Prueba de Mutación Acotada (Mutation Proof $\ge 75\%$)
- **Descripción**: Para toda lógica crítica clasificada como S0 o S1, se exige certificación física con `tools/mutation_gate.dart` con score $\ge 75\%$.
- **Señales de Aprobación**:
  - Reporte de mutación con veredicto `passed` (mínimo 75% de mutantes eliminados en diff).
  - Cero aserciones tautológicas.
- **Señales de Rechazo**:
  - Score de mutación $<75.0\%$ en diff de lógica crítica o 0 mutantes eliminados (veto anti-tautología).

---

## 3. Template de Evaluación `<EVALUACION_SKILL>`

El agente auditor debe emitir obligatoriamente este bloque al dictaminar sobre un skill candidato:

```markdown
<EVALUACION_SKILL>
Skill Evaluado: [nombre-del-skill]
Origen: [satélite / externo / nuevo]
Versión: [x.y.z]
Nodo Evaluador: Smart

| Criterio | Estado | Hallazgo / Evidencia |
| :--- | :--- | :--- |
| Q1: Propósito Unificado | APROBADO / RECHAZADO | [Detalle conciso] |
| Q2: Pureza / Desacople (§39) | APROBADO / RECHAZADO | [Detalle conciso] |
| Q3: Cero Mocks (§4, §16) | APROBADO / RECHAZADO | [Detalle conciso] |
| Q4: Anti-Conflicto / Causa Raíz (§36) | APROBADO / RECHAZADO | [Detalle conciso] |
| Q5: Eficiencia de Recursos (§30, §33)| APROBADO / RECHAZADO / N/A | [Detalle conciso] |
| Q6: Adaptación Externa | APROBADO / N/A | [Detalle conciso] |
| Q7: Frontmatter y Estructura | APROBADO / RECHAZADO | [Detalle conciso] |
| Q8: SPC Compliance (CMMI-4) | APROBADO / RECHAZADO / N/A | [Detalle conciso] |
| Q9: Mutation Proof (>= 75%) | APROBADO / RECHAZADO / N/A | [Detalle conciso] |

Dictamen Final: [APROBADO (CERTIFIED) | CONDICIONAL (DRAFT) | RECHAZADO]
Acciones de Remediación Requeridas: [Ninguna / Lista numerada de correcciones]
</EVALUACION_SKILL>
```

---

## 4. Modelo de Madurez de Skills

```text
[DRAFT] ───────(Auditoría Q1-Q9)───────> [REVIEWED] ───────(Validación en Flujo Real)───────> [CERTIFIED]
  │                                           │                                                     │
  ├─ En desarrollo o recién adaptado.         ├─ Superó evaluación Q1-Q7 con observaciones leves.   ├─ Evaluación 100% limpia.
  ├─ Pruebas locales en curso.                ├─ Dictamen condicional emitido.                      ├─ Probado en ≥1 sprint sin drift.
  └─ No elegible para propagación en flota.   └─ Apto para pruebas controladas en satélite/hub.     └─ Elegible para propagación global.
```

---

## 5. Verificaciones Adicionales para Auto-Mejora (Protocolo D)

Cuando un skill con estado `CERTIFIED` es modificado bajo el Protocolo D, además de Q1-Q7 se deben superar las siguientes 3 verificaciones anti-corrupción:

| Verificación | Descripción | Acción ante fallo |
|---|---|---|
| **AC-1: Paridad Doctrinal (§26)** | ¿La modificación eliminó o relajó alguna instrucción de seguridad/compliance de AGENTS.md o GEMINI.md? | `DOCTRINAL_DRIFT` → Bloqueo inmediato, rollback |
| **AC-2: Regresión Funcional** | ¿Los tests existentes del skill siguen pasando tras la modificación? | Fallo de tests → Bloqueo, rollback |
| **AC-3: Delta de Cobertura** | ¿La refactorización redujo la cobertura de sad paths? | Reducción → Tests compensatorios obligatorios antes de aprobar |

**Criterio de aprobación en auto-mejora**: Q1-Q7 (7/7) + AC-1, AC-2, AC-3 (3/3).
**Si el skill es nuevo** (no era CERTIFIED): solo Q1-Q7. Las verificaciones AC no aplican.

---

## 6. Política de Smoke Tests Condicionales en Handover (§Audit-Sec2)

Para prevenir sobrecostos de latencia y fricción innecesaria en el cierre de turno (`logix handover`):
1. **Filtro Estricto de Ejecutabilidad**: El runner automático de pruebas de humo solo se ejecuta sobre skills modificados que posean un directorio `scripts/` con archivos ejecutables (`*.dart`, `*.py`, `*.sh`, `*.ps1`).
2. **Exención de Documentales**: Todo skill puramente documental (compuesto únicamente por `SKILL.md`, `references/` o `resources/` estáticos) queda **explícitamente exento** de smoke test en el handover.
3. **Sanción de Paridad**: Si un skill declara scripts ejecutables y su prueba de humo falla en handover, el cierre de sesión queda bloqueado hasta su corrección física.

