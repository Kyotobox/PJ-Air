#!/usr/bin/env python3
"""
enqueue_s68_pipeline.py
Encola de forma atómica y determinista el Sprint S68 en /opt/automa/data/inference_queue.db.
Cumple estrictamente con §12.b (MÁXIMO 5 ARCHIVOS POR TICKET), §4, §6, §45, §48.
"""

import json
import sqlite3
import datetime
import shlex

DB_PATH = "/opt/automa/data/inference_queue.db"
TARGET_REPO = "/home/opc/code/pj-air"
SOURCE_NODE = "pj-air"
MODEL = "gemini-3.8-flash-high"
ACCOUNT_A = "account_0"
ACCOUNT_B = "account_2"

now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
ts = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)

# ==============================================================================
# DEFINICIÓN DE TICKETS S68 (MÁXIMO 5 ARCHIVOS, §12.b)
# ==============================================================================

# Ticket S68A: Backend Delivery Schedule System, Dynamic Orders Validation & Unit Tests
S68A_TICKET_ID = f"TCK-PJ-AIR-S68A-{ts}"
S68A_PREDICTED_FILES = [
    "backend/src/system-configs/system-configs.service.ts",
    "backend/src/system-configs/system-configs.controller.ts",
    "backend/src/orders/orders.service.ts",
    "backend/src/orders/orders.service.spec.ts",
    "backend/src/orders/orders.module.ts"
]

S68A_PROMPT = """Eres un agente autónomo de desarrollo en el repositorio "pj-air" (/home/opc/code/pj-air).
Debes implementar de forma atómica, limpia y sin atajos (§1, §4, §5, §6, §12.b, §45, §48) la Fase A del Sprint S68: Servicio de Cronograma de Despacho (Días Semanales, Feriados y Días Extraordinarios) y Motor Dinámico de Validación en OrdersService.

=== ESPECIFICACIONES TÉCNICAS DE S68A ===

# TASK-68-01 [BACKEND/DATA]: Servicio y Endpoints de Delivery Schedule
- En `backend/src/system-configs/system-configs.service.ts`:
  - En el método `onModuleInit`, agregar seeds iniciales en `system_configs` si no existen:
    - `delivery_working_days`: `"[0,1,3,4,5,6]"` (Miércoles a Lunes activos; Martes 2 inactivo).
    - `delivery_holidays`: `'[{"date":"2026-11-26","name":"Thanksgiving Day"},{"date":"2026-12-25","name":"Christmas Day"},{"date":"2027-01-01","name":"New Year\'s Day"}]'`.
    - `delivery_exceptional_days`: `'[]'`.
  - Crear método `getDeliverySchedule(): Promise<{ workingDays: number[]; holidays: Array<{date: string; name: string}>; exceptionalDays: Array<{date: string; name: string}>; cutoffHour: number }>`:
    - Recupera las tres claves y `cutoff_hour` (default 12), retornando el objeto estructurado con tipos numéricos y arrays parseados de forma segura con fallback.
  - Crear método `updateDeliverySchedule(data: { workingDays?: number[]; holidays?: Array<{date: string; name: string}>; exceptionalDays?: Array<{date: string; name: string}> }): Promise<any>`:
    - Valida que `workingDays` sea un array de números (0..6).
    - Valida que `holidays` y `exceptionalDays` sean arrays con `{ date: 'YYYY-MM-DD', name: string }`.
    - Persiste en `system_configs` mediante `save` / `update`.
- En `backend/src/system-configs/system-configs.controller.ts`:
  - Agregar `@Get('delivery-schedule')` ANTES de `@Get(':key')` para retornar `getDeliverySchedule()`.
  - Agregar `@Patch('delivery-schedule')` con `@UseGuards(AuthGuard)` verificando rol `admin` para invocar `updateDeliverySchedule(body)`.

# TASK-68-02 [BACKEND/LOGIC]: Motor Dinámico de Entrega en OrdersService
- En `backend/src/orders/orders.module.ts`:
  - Importar `SystemConfigsModule` para permitir la inyección de `SystemConfigsService`.
- En `backend/src/orders/orders.service.ts`:
  - Inyectar `@Optional() private systemConfigsService?: SystemConfigsService` en el constructor.
  - Actualizar `calculateMinDeliveryDate(referenceDate?: Date, cutoffHour = 12, scheduleConfig?: any): string`:
    - En lugar de la regla estática `if (minDateNY.getUTCDay() === 2) minDateNY.setUTCDate(minDateNY.getUTCDate() + 1);`:
    - Implementar un bucle de avance diario:
      - Si `scheduleConfig` está disponible (o se carga de `systemConfigsService`), evaluar si la fecha candidata está disponible:
        1. Si la fecha `YYYY-MM-DD` está en `exceptionalDays` -> DISPONIBLE (override).
        2. Si la fecha `YYYY-MM-DD` está en `holidays` -> NO DISPONIBLE (feriado).
        3. Si el día de la semana (`getUTCDay()`) no está en `workingDays` -> NO DISPONIBLE (inactivo).
        4. De lo contrario -> DISPONIBLE.
      - Avanzar día a día hasta encontrar la primera fecha disponible.
      - Si no hay config inyectada, mantener el fallback histórico seguro (martes inactivo).
  - Actualizar `validateCutoffTime(deliveryDateStr?: string, referenceDate?: Date, cutoffHour = 12, scheduleConfig?: any): void`:
    - Validar dinámicamente si `targetDate` es un día no operativo o feriado:
      - Si es feriado: `throw new BadRequestException('Panadería Jhoanes no realiza entregas el [fecha]: [Nombre del Feriado].');`
      - Si es día de la semana cerrado (y no excepcional): `throw new BadRequestException('Panadería Jhoanes no realiza entregas los días [Día]. Por favor selecciona un día operativo.');`
      - Validar lead time contra `calculateMinDeliveryDate`.
- En `backend/src/orders/orders.service.spec.ts`:
  - Actualizar o agregar pruebas unitarias que certifiquen:
    - Happy path: Entrega en día hábil normal.
    - Happy path: Entrega en fecha extraordinaria aprobada (que caería en martes pero se permite por override).
    - Sad path (§6): Intento de pedido en día feriado (ej. 2026-11-26 Thanksgiving) lanza BadRequestException.
    - Sad path (§6): Intento de pedido en día de la semana deshabilitado lanza BadRequestException.

=== MANDATOS CONSTITUCIONALES (§4, §6, §12.b, §48) ===
1. Cero mocks en código de producción (§4).
2. Sad path mandatorio con rejects/throwsA en tests (§6).
3. Compilación limpia (`npm run build` en backend debe dar exit 0).
4. Commit atómico inmediato (§48)."""

S68A_CUSTOM_CMD = f"""/usr/local/bin/agy --model {MODEL} --dangerously-skip-permissions -p {shlex.quote(S68A_PROMPT)} --mode auto && git config user.name "Vibraframe Worker" && git config user.email "worker@conext.local" && if [ -n "$(git status --porcelain)" ]; then git add . && git commit -m "feat(S68A): Backend delivery schedule service, dynamic orders cutoff validation, and tests (§48) [automated]"; fi"""

# Ticket S68B: Frontend Dedicated Dispatch Schedule Page, Sidebar Nav, Checkout Engine & Tests
S68B_TICKET_ID = f"TCK-PJ-AIR-S68B-{ts}"
S68B_PREDICTED_FILES = [
    "frontend/components/layout/AdminSidebar.tsx",
    "frontend/app/admin/dispatch/page.tsx",
    "frontend/app/checkout/page.tsx",
    "frontend/lib/s68-delivery-schedule.test.ts"
]

S68B_PROMPT = """Eres un agente autónomo de desarrollo en el repositorio "pj-air" (/home/opc/code/pj-air).
Debes implementar de forma atómica, completa y sin atajos (§1, §4, §5, §6, §12.b, §45, §48) la Fase B del Sprint S68: Apartado Dedicado de Días de Despacho en Admin (/admin/dispatch), Enlace en Sidebar, Integración Dinámica en Checkout y Suite de Pruebas.

=== ESPECIFICACIONES TÉCNICAS DE S68B ===

# TASK-68-03 [ADMIN/UI]: Apartado Dedicado /admin/dispatch y Sidebar
- En `frontend/components/layout/AdminSidebar.tsx`:
  - Importar ícono `Calendar` de `lucide-react`.
  - Agregar en `MENU_ITEMS`:
    `{ name: locale === 'en' ? 'Dispatch Schedule' : 'Días de Despacho', icon: Calendar, href: '/admin/dispatch' }`.
- Crear `frontend/app/admin/dispatch/page.tsx`:
  - Página administrativa moderna con `AdminSidebar` y diseño premium acorde al diseño de Jhoanes Wholesale.
  - Consumir `GET /api/configs/delivery-schedule` al montar y `PATCH /api/configs/delivery-schedule` al guardar.
  - **Sección 1: Días Fijos Semanales**:
    - Matriz interactiva de los 7 días (Domingo a Sábado).
    - Cada día con botón/toggle switch estilizado: Verde = Operativo / Gris = No operativo.
    - Contador visual: "X de 7 días operativos seleccionados".
  - **Sección 2: Calendario y Gestor de Días Festivos (Blackout Dates)**:
    - Botón de 1 clic: "🇺🇸 Cargar Feriados Oficiales NY/US" (Thanksgiving, Christmas, New Year, Memorial Day, Independence Day, Labor Day, etc.) que agrega o completa las fechas típicas sin duplicados, con total flexibilidad para editarlas o removerlas a discreción.
    - Selector individual de fecha (`<input type="date">`) + Campo de texto de nombre del feriado + Botón "Agregar Festivo".
    - Lista/Tabla de feriados registrados ordenada por fecha con botón rojo para eliminar cualquier fecha individualmente.
  - **Sección 3: Días Extraordinarios de Despacho (One-Time Overrides)**:
    - Selector de fecha (para días normalmente inactivos) + Campo de motivo/evento + Botón "Habilitar Fecha Especial".
    - Lista visual con badge azul/dorado de días extraordinarios activos y botón de remover.
  - Botón principal de guardado con feedback visual (toast / banner verde de éxito).

# TASK-68-04 [FRONTEND/CHECKOUT]: Motor Dinámico de Entrega en Checkout
- En `frontend/app/checkout/page.tsx`:
  - Consultar `api.get('/configs/delivery-schedule')` al inicializar (con fallback seguro en memoria si no estuviera disponible, offline-first §45).
  - En el cálculo de `minSelectableDate`:
    - Evaluar la disponibilidad de fecha usando la lógica dinámica:
      - Si la fecha está en `exceptionalDays` -> disponible.
      - Si la fecha está en `holidays` -> saltar (+1 día).
      - Si el día de la semana no está en `workingDays` -> saltar (+1 día).
    - Preseleccionar automáticamente la primera fecha disponible real.
  - En `handleDeliveryDateChange(newDateStr)`:
    - Verificar si `newDateStr` es feriado: notificar con advertencia indicando el nombre de la festividad ("Día festivo no laborable: [Nombre]").
    - Verificar si `newDateStr` cae en día cerrado semanal (y no es excepcional): notificar amigablemente ("No realizamos entregas los días [Día de la semana]").
  - Debajo del selector de fecha:
    - Mostrar resumen dinámico de días operativos y mención del próximo feriado si hubiere alguno cercano.

# TASK-68-05 [TEST/CERT]: Suite de Pruebas Vitest
- En `frontend/lib/s68-delivery-schedule.test.ts`:
  - Tests unitarios completos que certifiquen:
    1. Función pura `isDateAvailableForDelivery(dateStr, config)`:
       - Happy path: día de la semana habilitado retorna true.
       - Sad path (§6): día deshabilitado retorna false con razón descriptiva.
       - Sad path (§6): feriado bloquea la fecha incluso si el día de la semana es hábil.
       - Happy path: fecha extraordinaria aprueba la entrega aunque el día de la semana esté cerrado.
    2. Función `calculateDynamicMinDeliveryDate(now, config)`:
       - Salto correcto de feriados consecutivos.
       - Salto correcto de días semanales inactivos.
       - Consideración estricta de hora de corte (12:00 PM ET).

=== MANDATOS CONSTITUCIONALES (§4, §6, §12.b, §48) ===
1. Cero mocks en código de producción (§4).
2. Sad path mandatorio con throws/rejects en tests (§6).
3. Compilación limpia (`npm run build` en frontend debe dar exit 0).
4. Commit atómico inmediato (§48)."""

S68B_CUSTOM_CMD = f"""/usr/local/bin/agy --model {MODEL} --dangerously-skip-permissions -p {shlex.quote(S68B_PROMPT)} --mode auto && git config user.name "Vibraframe Worker" && git config user.email "worker@conext.local" && if [ -n "$(git status --porcelain)" ]; then git add . && git commit -m "feat(S68B): Dedicated admin dispatch page, sidebar link, checkout dynamic schedule, and tests (§48) [automated]"; fi"""

# ==============================================================================
# ENCOLAMIENTO DETERMINISTA EN SQLITE
# ==============================================================================

def enqueue():
    print(f"Abriendo base de datos de inferencia: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Payload S68A
    payload_a = {
        "ticket_id": S68A_TICKET_ID,
        "task_id": "TASK-68-01-02",
        "sprint_id": "S68",
        "target_repo": TARGET_REPO,
        "source_node": SOURCE_NODE,
        "model": MODEL,
        "account": ACCOUNT_A,
        "mode": "auto",
        "predicted_files": S68A_PREDICTED_FILES,
        "prompt": S68A_PROMPT,
        "custom_cmd": S68A_CUSTOM_CMD,
        "created_at": now_iso
    }

    # Payload S68B
    payload_b = {
        "ticket_id": S68B_TICKET_ID,
        "task_id": "TASK-68-03-05",
        "sprint_id": "S68",
        "target_repo": TARGET_REPO,
        "source_node": SOURCE_NODE,
        "model": MODEL,
        "account": ACCOUNT_B,
        "mode": "auto",
        "predicted_files": S68B_PREDICTED_FILES,
        "prompt": S68B_PROMPT,
        "custom_cmd": S68B_CUSTOM_CMD,
        "created_at": now_iso
    }

    cursor.execute("""
        INSERT INTO inference_queue 
        (ticket_id, task_id, source_node, sprint_id, status, payload, retry_count, created_at, updated_at, attempts)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        S68A_TICKET_ID,
        "TASK-68-01-02",
        SOURCE_NODE,
        "S68",
        "PENDING",
        json.dumps(payload_a),
        0,
        now_iso,
        now_iso,
        0
    ))
    print(f"✓ Ticket S68A encolado: {S68A_TICKET_ID}")

    cursor.execute("""
        INSERT INTO inference_queue 
        (ticket_id, task_id, source_node, sprint_id, status, payload, retry_count, created_at, updated_at, attempts)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        S68B_TICKET_ID,
        "TASK-68-03-05",
        SOURCE_NODE,
        "S68",
        "PENDING",
        json.dumps(payload_b),
        0,
        now_iso,
        now_iso,
        0
    ))
    print(f"✓ Ticket S68B encolado: {S68B_TICKET_ID}")

    conn.commit()
    conn.close()
    print("\n[ÉXITO] Pipeline Sprint S68 encolado exitosamente en la cola de inferencia.")

if __name__ == "__main__":
    enqueue()
