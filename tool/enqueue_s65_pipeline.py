#!/usr/bin/env python3
"""
enqueue_s65_pipeline.py
Encola de forma atómica y determinista el Sprint S65 en /opt/automa/data/inference_queue.db.
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
# DEFINICIÓN DE TICKETS S65 (MÁXIMO 5 ARCHIVOS, §12.b)
# ==============================================================================

# Ticket S65A: Frontend Places Autocomplete, Mini-Mapa Lateral y Cargador de Fachada en Registro
S65A_TICKET_ID = f"TCK-PJ-AIR-S65A-{ts}"
S65A_PREDICTED_FILES = [
    "frontend/components/auth/RegisterAddressMapCard.tsx",
    "frontend/components/auth/FacadePhotoUploader.tsx",
    "frontend/components/auth/RegisterForm.tsx",
    "frontend/app/auth/register/page.tsx"
]

S65A_PROMPT = """Eres un agente autónomo de desarrollo en el repositorio "pj-air" (/home/opc/code/pj-air).
Debes implementar de forma atómica, limpia y sin atajos (§1, §4, §5, §6, §12.b, §45, §48) la Fase A del Sprint S65: Integración de Google Places Autocomplete, Mini-Mapa Lateral interactivo con Pin y Cargador de Foto de Fachada del local en el formulario de registro mayorista (/auth/register).

=== ESPECIFICACIONES TÉCNICAS DE S65A ===

# TASK-65-01 [UI/REG]: Google Places Autocomplete en Registro
- En `frontend/components/auth/RegisterForm.tsx`:
  - Reemplazar el input plano de `business_address` por el componente `<Autocomplete>` de `@react-google-maps/api` (usando el loader y GOOGLE_MAPS_KEY ya configurado en el proyecto).
  - Configurar las opciones de Autocomplete con `types: ['geocode', 'establishment']` y `componentRestrictions: { country: 'us' }` para permitir buscar calles o nombres de comercios/bodegas (ej. "C-Town Supermarket Astoria").
  - Al seleccionar un lugar (`onPlaceChanged`), extraer la dirección formateada (`formatted_address`), ciudad, código postal, y coordenadas (`lat`, `lng`).
  - Pasar los datos estructurados al estado del formulario (`formData.business_address`, `formData.address_lat`, `formData.address_lng`, `formData.address_city`, etc.).

# TASK-65-02 [UI/MAP]: Mini-Mapa Lateral Interactivo con Pin
- Crear el componente `frontend/components/auth/RegisterAddressMapCard.tsx`:
  - Mostrar un contenedor visual compacto (altura ~220px) con `<GoogleMap>` y `<Marker>` centrado en las coordenadas de la dirección seleccionada (por defecto en NYC: lat 40.7628, lng -73.9262).
  - Al tener coordenadas válidas, mostrar un badge verde de confirmación: "🟢 Dirección Verificada por Google Maps" junto con la dirección formateada.
  - Si la dirección no se ha seleccionado aún, mostrar un estado previo elegante invitando a buscar la dirección comercial.
  - Integrar este componente en `RegisterForm.tsx` en disposición de dos columnas (grid desktop) o apilado en móvil.

# TASK-65-03 [UI/MEDIA]: Cargador de Foto de Fachada / Local en Registro
- Crear el componente `frontend/components/auth/FacadePhotoUploader.tsx`:
  - Permitir al cliente subir una foto de la fachada o entrada de su negocio (desde archivo o cámara móvil).
  - Subir la imagen al endpoint existente del backend (`POST /addresses/upload-facade`) y obtener la URL retornada.
  - Mostrar la previsualización de la foto cargada con opción de remover o cambiarla.
  - Pasar la URL de la foto al estado del formulario (`formData.facade_image_url`).
- En `frontend/app/auth/register/page.tsx`:
  - Incluir `address_lat`, `address_lng`, `address_city`, `facade_image_url` en el payload enviado al endpoint de signup (`/api/auth/signup`).

=== MANDATOS CONSTITUCIONALES (§4, §6, §12.b, §48) ===
1. Cero mocks en código de producción (§4).
2. Sin romper builds de Next.js (`npm run build` en frontend debe dar exit 0).
3. Compilación limpia y commit atómico inmediato (§48)."""

S65A_CUSTOM_CMD = f"""/usr/local/bin/agy --model {MODEL} --dangerously-skip-permissions -p {shlex.quote(S65A_PROMPT)} --mode auto && git config user.name "Vibraframe Worker" && git config user.email "worker@conext.local" && if [ -n "$(git status --porcelain)" ]; then git add . && git commit -m "feat(S65A): Register Places Autocomplete, Mini-Map Card, and Facade Uploader (§48) [automated]"; fi"""

# Ticket S65B: Persistencia Atómica Backend, Visor de Fachada en Admin y Certificación Playwright
S65B_TICKET_ID = f"TCK-PJ-AIR-S65B-{ts}"
S65B_PREDICTED_FILES = [
    "backend/src/auth/auth.service.ts",
    "backend/src/auth/auth.controller.ts",
    "frontend/app/admin/clients/page.tsx",
    "tool/run_sprint65_certification.js"
]

S65B_PROMPT = """Eres un agente autónomo de desarrollo en el repositorio "pj-air" (/home/opc/code/pj-air).
Debes implementar de forma atómica, completa y sin atajos (§1, §4, §5, §6, §12.b, §45, §48) la Fase B del Sprint S65: Creación Atómica de Dirección en Backend, Visor de Fachada en Panel de Administración y Suite de Certificación Playwright con Capturas de Pantalla Físicas.

=== ESPECIFICACIONES TÉCNICAS DE S65B ===

# TASK-65-04 [BACKEND/DATA]: Creación Atómica de Dirección Principal en Signup
- En `backend/src/auth/auth.service.ts` y `auth.controller.ts`:
  - En el método de registro (`signup`):
    - Recibir los campos de dirección: `business_address`, `address_lat`, `address_lng`, `address_city`, `facade_image_url`.
    - Tras crear la entidad `User`, si se proporcionó `business_address`:
      - Crear de forma atómica una entidad `Address` en la tabla `addresses` vinculada al nuevo `user.id`.
      - Asignar `alias: 'Principal / Facturación'`, `address: business_address`, `city: address_city || 'New York'`, `lat: address_lat`, `lng: address_lng`.
      - Asignar `is_default: true`, `is_temporary: false`.
      - Si se proporcionó `facade_image_url`, guardarla en `delivery_photos_json: JSON.stringify([facade_image_url])`.
      - Guardar la dirección en el repositorio de direcciones.
    - Esto garantiza que todo cliente nuevo nazca con su dirección principal 100% oficial y geocodificada en la base de datos sin requerir formularios adicionales.

# TASK-65-05 [ADMIN/UI]: Visor de Fachada y Mapa de Clientes en Admin
- En `frontend/app/admin/clients/page.tsx`:
  - En el listado o modal de detalles de cada cliente mayorista:
    - Mostrar la dirección comercial validada con sus coordenadas GPS.
    - Si el cliente posee foto de fachada (`delivery_photos_json` o `facade_image_url`), renderizar la imagen de la fachada del local en una tarjeta visual elegante con enlace a Google Maps (`https://www.google.com/maps/search/?api=1&query=...`).
    - Permitir al administrador verificar visualmente la bodega/comercio antes de su aprobación B2B.

# TASK-65-06 [TEST/CERT]: Suite de Certificación Playwright S65 con Capturas de Pantalla
- En `tool/run_sprint65_certification.js`:
  - Crear script Playwright automatizado conectándose al entorno en vivo `https://testing.jhoanes.com`:
    1. En `/auth/register`: buscar una dirección comercial en Google Places, verificar que el mini-mapa lateral renderice el Pin y capturar `ui_screenshots/sprint65_01_register_places_map.png`.
    2. En `/auth/register`: simular la carga/preview de foto de fachada y capturar `ui_screenshots/sprint65_02_register_facade_photo.png`.
    3. En `/admin/clients`: abrir la ficha de un cliente con dirección validada y fachada y capturar `ui_screenshots/sprint65_03_admin_client_facade_view.png`.
    4. Copiar capturas a `vault/runtime/ui_screenshots/` y certificar su existencia física en disco.

=== MANDATOS CONSTITUCIONALES (§4, §6, §12.b, §48) ===
1. Cero mocks en código de producción (§4).
2. Sad path cubierto en endpoints y tests unitarios de auth (§6).
3. Compilación limpia (`npm run build` en backend y frontend con exit 0) y commit atómico inmediato (§48)."""

S65B_CUSTOM_CMD = f"""/usr/local/bin/agy --model {MODEL} --dangerously-skip-permissions -p {shlex.quote(S65B_PROMPT)} --mode auto && git config user.name "Vibraframe Worker" && git config user.email "worker@conext.local" && if [ -n "$(git status --porcelain)" ]; then git add . && git commit -m "feat(S65B): Backend atomic address creation, admin facade viewer, and Playwright certification (§48) [automated]"; fi"""

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    tickets = [
        {
            "ticket_id": S65A_TICKET_ID,
            "task_id": "TASK-65-PART1",
            "sprint_id": "S65",
            "status": "PENDING_INFERENCE",
            "account_id": ACCOUNT_A,
            "predicted_files": S65A_PREDICTED_FILES,
            "prompt": S65A_PROMPT,
            "custom_cmd": S65A_CUSTOM_CMD,
            "title": "Register Places Autocomplete, Mini-Map Card, and Facade Uploader"
        },
        {
            "ticket_id": S65B_TICKET_ID,
            "task_id": "TASK-65-PART2",
            "sprint_id": "S65",
            "status": "WAITING_DEPENDENCY",
            "account_id": ACCOUNT_B,
            "predicted_files": S65B_PREDICTED_FILES,
            "prompt": S65B_PROMPT,
            "custom_cmd": S65B_CUSTOM_CMD,
            "title": "Backend Atomic Address Creation, Admin Facade Viewer, and Playwright Certification"
        }
    ]

    for t in tickets:
        payload = {
            "ticket_id": t["ticket_id"],
            "task_id": t["task_id"],
            "source_node": SOURCE_NODE,
            "target_repo": TARGET_REPO,
            "sprint_id": t["sprint_id"],
            "status": "APPROVED",
            "account_id": t["account_id"],
            "model": MODEL,
            "prompt": t["prompt"],
            "custom_cmd": t["custom_cmd"],
            "predicted_files": t["predicted_files"],
            "predicted_file_count": len(t["predicted_files"]),
            "metadata": {
                "sprint_id": t["sprint_id"],
                "sprint_title": t["title"],
                "source_node": SOURCE_NODE,
                "target_repo": TARGET_REPO,
                "account_id": t["account_id"],
                "model": MODEL
            }
        }

        cur.execute(
            """
            INSERT INTO inference_queue (
                ticket_id, task_id, source_node, sprint_id, status, payload,
                retry_count, created_at, updated_at, attempts
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 0)
            """,
            (
                t["ticket_id"],
                t["task_id"],
                SOURCE_NODE,
                t["sprint_id"],
                t["status"],
                json.dumps(payload),
                now_iso,
                now_iso
            )
        )
        print(f"✅ Ticket encolado: {t['ticket_id']} [{t['status']}] (Files: {len(t['predicted_files'])}, Account: {t['account_id']})")

    # Cascading Trigger: S65A -> S65B
    trg_name = f"trg_cascade_{S65A_TICKET_ID.replace('-', '_')}_to_{S65B_TICKET_ID.replace('-', '_')}"
    cur.execute(f"DROP TRIGGER IF EXISTS {trg_name}")
    cur.execute(f"""
    CREATE TRIGGER {trg_name}
        AFTER UPDATE OF status ON inference_queue
        FOR EACH ROW
        WHEN NEW.ticket_id = '{S65A_TICKET_ID}' AND NEW.status IN ('COMPLETED', 'DONE', 'MERGED')
        BEGIN
            UPDATE inference_queue
            SET status = 'PENDING_INFERENCE', retry_count = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE ticket_id = '{S65B_TICKET_ID}' AND status = 'WAITING_DEPENDENCY';
        END
    """)
    print(f"🔗 Trigger creado: {trg_name}")

    conn.commit()
    conn.close()
    print("🚀 Pipeline de Sprint S65 encolado exitosamente en /opt/automa/data/inference_queue.db.")

if __name__ == "__main__":
    main()
