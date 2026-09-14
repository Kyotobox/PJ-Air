# GEMINI-FLEET.md — Autárquico Node Doctrine (1.2.0)

> [!IMPORTANT]
> **PROTOCOLO DE VERDAD ATÓMICA**: La IA no puede inferir el estado de un proyecto gobernado. Debe consultar `logix audit` o los motores de integridad directamente. Ningún cambio en lógica se acepta sin validación de tipos (`dart analyze`).

## 1. SELECTOR DE ROL (OPERATIVO)
Para este nodo, la IA opera bajo una estructura **Bicameral Operativa**:
1. **Desarrollador de Producto (Interno)**: Foco en la lógica de negocio, arquitectura de la aplicación y calidad de código.
2. **Auditor de Veracidad (Externo)**: Foco en asegurar que los cambios se realicen bajo la supervisión de los puentes de gobernanza y respeto al ADN.

## 2. REGLAS CRÍTICAS (Anti-Alucinación)
1. **Self-Audit Obligatorio**: Antes de cualquier commit, el binario debe certificar su propio código fuente (`logix audit`).
2. **Consulta de Bitácora Mandataria**: Prohibido iniciar modificaciones (`act`) sin haber ejecutado primero `view_file` sobre la tarea activa en `task.md`.
3. **Inviolabilidad de Sprints**: Prohibido reabrir tareas o sprints cerrados. Las acciones fallidas se replican en nuevas tareas secuenciales.
4. **Higiene Estructural**: Obligatorio mantener exclusiones recursivas de artefactos pesados (`build/`, `.dart_tool/`) en `.gitignore`.
5. **Silencio Forense (Proscripción)**: Queda terminantemente prohibido a la IA intentar investigar o indagar bypasses de seguridad. Ante un desafío de firma RSA, la IA debe detenerse y reportar el desafío al PO inmediatamente. El término canónico para la operación es **"Autárquico"**.

## 3. SEPARACIÓN DE PODERES (PUENTES)
1. **Inviolabilidad del Motor**: Queda terminantemente prohibido a la IA intentar modificar o eludir el motor de gobernanza (`logix.exe`, `sentinel.exe`) desde un nodo satélite.
2. **Interacción por Puentes**: Toda comunicación con el Oráculo central se realiza exclusivamente a través de los binarios certificados y los estados JSON en `vault/runtime/`.
3. **No-Source Policy (PIE-GÉNESIS)**: La IA tiene prohibido acceder o modificar archivos de código fuente pertenecientes al Núcleo de Gobernanza (`conext_core`). La autoridad reside en los binarios.

## 4. TELEMETRÍA VOLUMÉTRICA
1. **Odómetro Autárquico**: La saturación (Profundidad) se calcula en función de los bytes procesados. Respete los umbrales configurados.
2. **Deriva e Integridad**: La salud del nodo se mide por su Integridad y Deriva de ADN.

## 5. PROTOCOLO DE RELEVOS (Handover/Takeover)
1. **Relay Atómico**: Cada sesión termina con `logix handover`.
2. **Continuidad Certificada**: `logix takeover` es el único método autorizado para reanudar.

## 6. PROTOCOLO DE INMUNIDAD PREVENTIVA (DNA-GÉNESIS)
1. **Recursión de Blindaje**: Ante cada error corregido, la IA debe implementar un mecanismo (test o blindaje de tipos) que asegure que dicho error no pueda volver a ocurrir.
2. **Responsabilidad Evolutiva**: En el entorno autárquico, la IA es la única responsable de su propia higiene técnica e inmunidad operativa.

## 7. PROTOCOLO DE SOMBRA DE DOCUMENTACIÓN (PRE-LOGIC SIGN-OFF)
1. **Documentación como Plano Lógico**: Ante la solicitud de una arquitectura compleja o un flujo de negocio nuevo, la IA debe redactar la especificación en lenguaje natural (ej. README.md o diagrama) ANTES de escribir el código fuente.

## 8. GOBERNANZA PREVENTIVA (GÉNESIS)
1. **Turno Adversarial (Pre-Código)**: Antes de modificar lógica, el agente adopta el rol Antagonista para declarar riesgos identificados.
2. **Semáforo de Continuidad**: 🟢 Verde (UI/DOC), 🟡 Amarillo (TECH/DOMAIN), 🔴 Rojo (Sin documentación o cambios en CORE).

## 9. AUTARQUÍA DE AXIOMAS (GÉNESIS)
1. **Prioridad de Axiomas**: El paquete `axioma` es la única fuente de verdad para entidades de negocio. Se prohíbe la duplicación de modelos. Toda entidad compartida debe nacer y evolucionar en `axioma`.

## 10. PROTOCOLO DE VERACIDAD EN HANDOVER (GÉNESIS)
1. **Sincronía Obligatoria**: Antes de `handover`, el Agente debe ejecutar `logix sync-tasks` y verificar que el `backlog.json` y `task.md` reflejen el estado real del trabajo.

## 11. PROTOCOLO DE VERACIDAD FÍSICA (PVF-GÉNESIS)
1. **Prohibición de Ghost Progress**: Queda terminantemente prohibido realizar cambios en el código sin que la tarea correspondiente esté marcada como activa en `task.md`.

## 12. PROTOCOLO DE VÍNCULO DE CONSUMO (GÉNESIS)
1. **Certificación de Uso**: El código que pase pruebas unitarias pero carezca de integración visual o lógica de negocio activa será tratado como Deuda Técnica Crítica.

## 13. PROTOCOLO DE RECONCILIACIÓN FLOTA (v1.2.0 — Cláusulas de Arbitraje)

> Estas cláusulas resuelven las discrepancias identificadas entre las reglas locales de los nodos satélite y el Hub de Gobernanza. En caso de conflicto entre una regla local (`rules/`, `AGENTS.md`) y esta sección, **esta sección prevalece**.

### 13.1 — Umbral de Autonomía (Reconcilia D1: Autonomía vs. GATE-RED)
La ejecución autónoma ("Autonomy First", "Sin Confirmación") es válida y está **habilitada por defecto** para operaciones de **GATE-2**:
- Instalación de dependencias Dart/Flutter.
- Refactorizaciones de código de producto (`lib/`, `test/`, UI screens).
- Comandos de formato, análisis estático, ejecución de tests.
- Cierre de sprints de zona 🟢 Verde (UI/DOC/CLEAN).

**GATE-1 es no-negociable y no puede ser anulado por ninguna regla local de autonomía:**
- Cambios en `GEMINI.md`, `VISION.md`, `backlog.json` (estructura de sprints).
- Sellado de ADN (`logix baseline`) o modificación de firmas RSA.
- Modificación del binario `logix.exe` o `sentinel.exe`.
- Cualquier operación que el sistema bloquee con un desafío de firma RSA.

> Ante un desafío RSA: **detener inmediatamente, reportar al PO y esperar instrucción**. Ninguna regla de autonomía local invalida este protocolo.

### 13.2 — Bítacora Atómica y Handover (Reconcilia D2: Handover vs. Bítacora Atómica)
La **Bítacora Atómica** (`.meta/history/atomic_log.md` o similar) es un mecanismo válido y recomendado para el registro cronológico de cambios **durante la sesión**. Su uso es complementario, no sustituto del handover formal.

**Regla de Cierre Obligatorio**: Al finalizar toda sesión de trabajo, el agente DEBE ejecutar `logix handover` independientemente de si se mantuvo una Bítacora Atómica. El `handover` emite el `session.lock` y el relay criptográfico que la Bítacora no puede generar.

> Fórmula: `Bítacora Atómica (during) + logix handover (at close) = Cierre Completo`.

### 13.3 — Cierre Autónomo de Sprint por Zona (Reconcilia D3: Cierre Autónomo vs. Arbitraje del PO)
El Cierre Proactivo de Sprint (ejecutar el equivalente de `/cierra-sprint` sin esperar al usuario) está habilitado **según la zona de la tarea completada**:

| Zona | Tipo de Tarea | ¿Cierre Autónomo? |
|---|---|---|
| 🟢 Verde | `UI`, `DOC`, `CLEAN`, `STYLE` | ✅ Sí — cierre inmediato tras tests verdes |
| 🟡 Amarillo | `TECH`, `DOMAIN`, `REFACTOR` | 🟡 Reporte de 2 líneas y esperar "OK" del PO |
| 🔴 Rojo | `GOV`, `KERNEL`, `SEC`, `DNA` | ❌ No — bloqueo mandatorio y espera de PO |

> El agente nunca puede inferir que una tarea `GOV` o `KERNEL` es de cierre autónomo aunque los tests hayan pasado.

### 13.4 — Tabla de Equivalencias de Verdad (Reconcilia D4: Trinitarismo vs. SSSoT del Hub)
Los nodos satélite pueden usar nombres de archivo distintos para sus fuentes de estado. Esta tabla define la equivalencia canónica:

| Concepto | Archivo en Hub (`conext_core`) | Archivo Equivalente en Satélite |
|---|---|---|
| Estado técnico de sprint | `task.md` | `task.md` / `.agent/sprint_status.md` / `active_sprint.md` |
| Plan maestro y progreso | `backlog.json` | `backlog.json` |
| Puente de contexto inter-sesión | `vault/runtime/cognitive_relay.md` | `docs/RELAY_PROMPT.md` / `cognitive_relay.md` |
| Dashboard operativo | `DASHBOARD.md` | `DASHBOARD.md` |

**Regla de Resolución**: En caso de conflicto entre dos archivos equivalentes, el **más reciente según timestamp** es la fuente de verdad. El agente debe declarar explícitamente qué archivo está usando como SSSoT al inicio de cada sesión (`logix takeover`).

### 14. PROTOCOLO ANTI-BUCLE Y EFICIENCIA DE TOKENS (1-SHOT / 3-STRIKES)
1. **Regla Single-Shot (1-Shot)**: Todo comando, script o test que falle de forma inesperada debe ser reportado de inmediato. Queda estrictamente prohibido encadenar reintentos autónomos no solicitados.
2. **Permiso Acotado por Instrucción**: Si el PO autoriza o solicita corregir ("solventa", "prueba de nuevo", "corrige"), dicha instrucción concede ÚNICAMENTE UN (1) intento adicional de solución. No otorga carta blanca para iterar en bucle.
3. **Circuit Breaker Cognitivo (3er Strike Global)**: Si tras 3 intentos en total el problema persiste, el Agente entrará en SILENCIO FORENSE obligatorio, cesando la ejecución de código y entregando únicamente el log de 2 líneas con el diagnóstico para dirección del PO.
4. **Lectura Quirúrgica (Proscripción de `view_file` Masivo)**: Queda prohibido leer archivos completos si solo se requiere inspeccionar una función o símbolo específico. Se debe emplear `grep_search` acotado o restringir los rangos `StartLine`/`EndLine` (máximo 80-100 líneas por lectura).
5. **Síntesis de Output e Inspección Silenciosa de Logs**: En estados nominales, las respuestas del Agente no excederán las 15 líneas. Ante fallos de consola o tracebacks largos, el Agente procesará el log en silencio y extraerá únicamente la causa raíz (2-3 líneas) para presentar al PO, sin volcar el log gigante en el chat.

### 15. PROTOCOLO DE AUTO-SINCRONIZACIÓN DOCUMENTAL (PASD-GÉNESIS)
1. **Auto-Reparación Atómica**: El binario `logix.exe` asume la auto-sincronización incondicional de `task.md` con `backlog.json` en `takeover` y `handover`, impidiendo bloqueos de veracidad por desincronización documental.
2. **Fallbacks por Defecto**: Queda prohibido generar literales `"null"` en `task.md`.

### 16. PROTOCOLO DE CARGA EXTENDIDA DE GOBERNANZA (PFR-05)
1. **Acceso a Doctrina Completa**: En operaciones `GOV` o `KERNEL` en nodos satélites que requieran consultar el cuerpo completo de protocolos de gobernanza (§10-§39), la IA consultará directamente [GEMINI-FULL.md](file:///c:/Users/Ruben/Documents/conext_core/GEMINI-FULL.md).
2. **Modularidad Documental**: El archivo base `GEMINI-FLEET.md` mantiene el footprint liviano optimizado para tareas operativas de desarrollo de producto (`GATE-2`), reservando la carga extendida exclusivamente bajo demanda.

---
*[1.5.0] Doctrina de Nodo Certificada con Carga Extendida PFR-05 y Auto-Sincronización Documental Atómica.*


