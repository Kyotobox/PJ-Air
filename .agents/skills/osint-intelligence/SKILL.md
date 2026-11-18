---
name: osint-intelligence
description: Herramientas modulares de inteligencia de mercado OSINT (Reddit API sin auth, FAA Ground Stop API, cálculo de rutas interurbanas y registro de Function Calling para LLMs).
version: 1.0.0
category: market-intelligence
origin_node: MarkOS
maturity: REVIEWED
qa_score: "Q1-Q7: 7/7 REVIEWED"
last_reviewed: 2026-11-01
cluster: analysis-intelligence-suite
target_nodes: [satellite_all, hub_all]
---

# Motor de Inteligencia de Mercado OSINT & Tool Registry

`osint-intelligence` proporciona un conjunto de módulos analíticos en Python desacoplados para prospección comercial, escucha social abierta y monitoreo de demanda en tiempo real.

---

## 1. Módulos Analíticos en `scripts/`

El skill contiene cinco herramientas probadas con contrato de salida estándar:
`{"status": "success|error", "data": [...], "meta": {...}}`

1. **`social_listening.py`**:
   - Escucha de quejas, fricciones y necesidades no resueltas en foros públicos (utiliza la API JSON nativa de Reddit sin necesidad de tokens de API ni credenciales).
   - Ingesta de subreddits de nicho o geolocalizados para análisis de sentimiento.
2. **`transit_hub_radar.py`**:
   - Monitoreo en tiempo real de anomalías operativas de aeropuertos, Ground Delays y Ground Stops a través de la API oficial de la FAA (`nasstatus.faa.gov`).
   - Detección de picos de demanda y volatilidad logística.
3. **`interstate_routes.py`**:
   - Matriz de cálculo de rutas de larga distancia, tiempos estimados de viaje y comparación de arbitraje de tarifas (frente a trenes, aerolíneas y peajes).
4. **`niche_directory.py`**:
   - Extracción estructurada de directorios locales de alto ticket (bodegas, hoteles boutique, venues corporativos).
5. **`tool_registry.py`**:
   - Registro unificado de herramientas con esquemas JSON compatibles con llamadas de función (*LLM Tool Calling*).
   - Función despachadora segura: `dispatch_osint_tool(tool_name, arguments)`.

---

## 2. Invocación Segura mediante el Despachador

```python
import sys
from pathlib import Path

# Incorporación al path de ejecución
scripts_dir = Path(__file__).parent / "scripts"
sys.path.append(str(scripts_dir))

from tool_registry import dispatch_osint_tool

# Ejemplo: Consultar rutas interurbanas
resultado = dispatch_osint_tool("calculate_interstate_route", {
    "origin": "Washington DC",
    "destination": "New York City",
    "passengers": 4
})

if resultado.get("status") == "success":
    print("Datos de ruta:", resultado.get("data"))
```

---

## 3. Salvaguardas de Red y Resiliencia (§33, §45)

- Todo request HTTP impone un `timeout` defensivo máximo de 10 segundos.
- Rotación de `User-Agent` de navegador legítimo para evitar falsos positivos de rate-limit.
- Manejo determinista de excepciones de red sin provocar caídas en los agentes.
