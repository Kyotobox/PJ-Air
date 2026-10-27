# Workflow: /recovery (Protocolo de Auto-Sanación Sónica)

> [!NOTE]
> **COMPATIBILIDAD MULTI-AGENTE (CODEX/GENÉRICA)**
> Si estás operando como un agente de terminal (Codex, Cursor, etc.), DEBES ejecutar `bin/logix recovery` en tu shell para simular el comportamiento que Antigravity IDE haría nativamente.

// Protocolo de Recuperación de Emergencia (/recovery)

Este workflow detalla los pasos críticos para la reanudación soberana tras un crash del sistema o una pérdida de contexto masiva. Su objetivo es garantizar que la IA entrante pueda establecer una línea base de verdad sin heredar deriva del estado fallido.

## 1. Fase de Sincronización (Takeover)
Antes de cualquier análisis, es imperativo sincronizar el búnker con la realidad física del repositorio.
## 1. FASE 0: Sincronización de Red [MANDATORIO]
Antes de iniciar la recuperación, sincronizar el ADN con el repositorio remoto para evitar desincronización cognitiva.
1. Ejecutar `git pull origin HEAD --rebase`.
2. Si falla (offline): Continuar con estado local y alertar al PO sobre posible desincronización de hilos.
3. Si hay conflictos: Resolver a favor de `origin` si es un nodo Fleet, o manual si es el Oracle.

## 2. FASE 1: Diagnóstico de Integridad (Sovereign Audit)
Identificar dónde se detuvo el motor antes de la falla.

- [ ] **Anclaje de Búnker (Anti-Contaminación)**: Tras la falla, imprime el `bunker_profile.json` en pantalla y declara explícitamente el contexto lógico inquebrantable. Ignora cualquier archivo en la telemetría del IDE (Active Document) que no pertenezca a este búnker.
- [ ] **Ejecutar Takeover**: `logix takeover --force`
- [ ] **Validar ADN**: `logix audit`
  - Si `Drift > 0`: Identificar si es deuda delegada (backlog/sprints) o corrupción real.
  - Si es deuda delegada válida: `logix baseline` para sellar el ADN y resetear deriva.
- [ ] **Verificar Bitácora**: `view_file` sobre `backlog.json` y `HISTORY.md`.
- [ ] **Validar Tareas**:
  - Comparar el `current_task` en `backlog.json` con los commits de Git recientes.
  - Si una tarea está marcada como `DONE` pero el código no refleja el cambio: Marcar como `PENDING/IN_PROGRESS` y re-ejecutar.
  - Si la tarea estaba en `IN_PROGRESS`: Verificar la integridad de los archivos modificados parcialmente.

## 3. Asimilación de Continuidad Cognitiva
- Leer el mensaje del Agente Saliente (si existe) inyectado en el `relay`.
- Incorporar la nota estratégica al contexto actual y reportarla al PO antes de iniciar el workflow `/act`.

## 4. Purga de Saturación (Healing)
Neutralizar la fatiga cognitiva residual (SHS) para prevenir alucinaciones de continuidad.

- [ ] 1. **Purga de Artefactos (Diferenciada)**:
   - **En Servidor Oracle (tiene `lib/`)**: Ejecutar limpieza profunda de compilación: `rm -rf .dart_tool build`.
   - **En Nodos Fleet (solo `bin/`)**: Omitir purga de artefactos. Solo ejecutar `gov purge`.
- [ ] 2. **Purga del Búnker**: Ejecutar protocol `/purge-saturation`.
- [ ] **Reset de Odometer**: Verificar que `vault/runtime/turns_since_act.txt` esté en 0 tras el takeover.

## 5. Bifurcación de Escenario
El protocolo de recuperación varía según el objetivo (Target).

### Caso A: Núcleo de Gobernanza (Kernel)
- [ ] **Certificación de Binarios**: Ejecutar `logix audit` y verificar que el `logix.exe` no esté en estado `Dirty/Mismatch`.
- [ ] **Sello de Manifiesto**: Asegurar que `vault/kernel.hashes.sig` coincida con el estado actual.

### Caso B: Nodo de Flota (ej. Gobernanza)
- [ ] **Validación de Registro**: Consultar `vault/runtime/fleet_registry.json`.
- [ ] **Purga Local**: Eliminar `build/`, `.dart_tool/` y archivos `.lock` que puedan haber quedado "zombies".
- [ ] **Veracity Check**: Ejecutar `logix fleet-audit` desde el Kernel para certificar el nodo.

## 5. Re-Encausamiento Nominal
- [ ] **Activar Tarea**: `logix act --task-id <ID_PENDIENTE>`.
- [ ] **Verificar Estado**: Verificar mediante `logix check` que el sistema reporte Integridad NOMINAL y el Sprint correcto.
- [ ] **Notificar al PO**: Resumir el estado de recuperación y los hitos rescatados.

---
> [!IMPORTANT]
> **REGLA DE ORO**: Nunca proceder con lógica de negocio si el ADN reporta `DRIFT`. El sellado mediante `baseline` es la única "medicina" autorizada.

