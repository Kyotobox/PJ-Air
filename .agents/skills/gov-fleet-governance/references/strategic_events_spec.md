# Especificación del Protocolo de Eventos Estratégicos (Smart → Automa)
**Versión**: 1.0.0 (3.17.4)  
**Dominio**: Gobernanza Estratégica, Trinidad Funcional y Desacople de Alertas

---

## 1. Propósito y Filosofía Arquitectónica
Bajo el principio de la **Trinidad Funcional**:
- **Smart (Hemisferio Derecho)** genera inteligencia de producto, auditorías antagónicas y certificados de liberación, pero **tiene prohibido ejecutar daemons residentes 24/7**.
- **Automa (Sistema Nervioso)** corre procesos desatendidos 24/7 y orquesta la mensajería táctica (Discord), pero **tiene prohibido evaluar negocios o dictar leyes**.

Para comunicar ambos hemisferios de forma asíncrona, desacoplada y atómica, Smart deposita eventos estructurados en el archivo compartido:
```
vault/runtime/strategic_events.json
```
Automa inspecciona este buffer de forma pasiva (usando comprobación de `mtime`) y transforma los eventos en alertas y tarjetas visuales en Discord.

---

## 2. Esquema JSON Canónico

El archivo `strategic_events.json` almacena un objeto raíz con metadatos y un array cronológico de eventos:

```json
{
  "version": "1.0.0",
  "hub": "Smart",
  "updated_at": "2026-09-25T23:30:00Z",
  "events_count": 1,
  "events": [
    {
      "event_id": "evt-smart-8f3a9e12-4c21-4f10-9b34-8c8f00112233",
      "timestamp": "2026-09-25T23:30:00Z",
      "type": "RELEASE_CERT",
      "project_id": "prj_008_ruedas",
      "severity": "INFO",
      "summary": "Certificación formal de liberación emitida para Sprint C186.",
      "verdict": "APPROVED",
      "metrics": {
        "score": 8.7,
        "test_coverage_pct": 100.0,
        "antagonist_audit": "PASSED"
      },
      "dossier_path": "evaluations/prj_008_ruedas/EXECUTIVE_SUMMARY.md"
    }
  ]
}
```

### 2.1 Definición de Campos

| Campo | Tipo | Obligatorio | Valores Permitidos / Descripción |
| :--- | :---: | :---: | :--- |
| `event_id` | `string` | **Sí** | Identificador único (`evt-smart-<uuid>`). |
| `timestamp` | `string` | **Sí** | Marca temporal ISO-8601 UTC. |
| `type` | `string` | **Sí** | `RELEASE_CERT`, `KILL_CRITERIA_ALERT`, `STRATEGIC_EVAL_READY`, `VETO_ALERT`. |
| `project_id` | `string` | **Sí** | ID canónico del proyecto o satélite (ej. `prj_008_ruedas`, `automa`, `beatme`). |
| `severity` | `string` | **Sí** | `INFO`, `WARNING`, `CRITICAL`. |
| `summary` | `string` | **Sí** | Resumen conciso (< 280 caracteres) para el cuerpo del mensaje en Discord. |
| `verdict` | `string` | **Sí** | `APPROVED`, `REJECTED`, `WARNING`, `HALT`. |
| `metrics` | `object` | No | Diccionario libre de métricas cuantitativas clave (`score`, `cac_ltv_ratio`, `risk_level`). |
| `dossier_path` | `string` | No | Ruta relativa al artefacto que sustenta el dictamen. |

---

## 3. Tipología Semántica de Eventos

1. **`RELEASE_CERT`**:
   - Emite el aval formal de Smart para liberar una versión mayor o sprint crítico hacia producción.
   - Severidad: `INFO` (si aprobado) o `WARNING` (si aprobado con condiciones).
   - Veredicto: `APPROVED`.

2. **`KILL_CRITERIA_ALERT`**:
   - Disparado cuando los datos de telemetría de un satélite rebasan umbrales de corte (ej. retención < 10%, costo de API > ingresos brutos).
   - Severidad: `CRITICAL`.
   - Veredicto: `HALT`.

3. **`STRATEGIC_EVAL_READY`**:
   - Notificación de que el Panel Evaluador ha emitido un nuevo dictamen o dossier en `evaluations/`.
   - Severidad: `INFO` o `WARNING`.
   - Veredicto: `APPROVED` o `REJECTED`.

4. **`VETO_ALERT`**:
   - Activación de Veto Antagonista por Red Team, Auditor Antagonista o Cyber Security Scanner.
   - Severidad: `CRITICAL`.
   - Veredicto: `HALT` o `REJECTED`.

---

## 4. Políticas de Transaccionalidad y Rotación (§31 Zero-Waste Fleet)

1. **Escritura Atómica**:
   - La escritura nunca se realiza directamente sobre `strategic_events.json`. Se escribe en `strategic_events.json.tmp` y se realiza un renombrado atómico (`os.replace` en Python).
2. **Capacidad Máxima de Buffer**:
   - El buffer retiene un máximo de **100 eventos** históricos.
   - Al superar el límite, se purgan los registros más antiguos (política FIFO), preservando siempre la integridad sintáctica del JSON.
3. **Consumo Desacoplado por Automa**:
   - Automa almacena su marca de último evento procesado (`last_processed_event_id`) en su propio estado local (`vault/runtime/automa_state.json`), sin modificar el archivo de Smart.
