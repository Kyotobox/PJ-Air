---
name: data-catalog-sanitizer
description: Sanitización, deduplicación, normalización de esquemas y auditoría de calidad de catálogos tabulares automotrices y de productos (Ruedas y flota).
---

# Data Catalog Sanitizer Skill

## Propósito
Provee un motor de alto rendimiento, desacoplado y agnóstico para la limpieza, higiene textual, mapeo de esquemas canónicos y deduplicación de catálogos tabulares y listas de inventario automotriz y comercial.
Extraído y desacoplado del pipeline de ingesta de **Ruedas** (`MarketRawSanitizer` e `ingestion_engine`), este skill unifica el procesamiento de datos crudos heterogéneos provenientes de hojas de cálculo, volcados CSV/TSV, payloads JSON y tablas SQLite, normalizando claves foráneas, rangos de años vehiculares, precios y eliminando tokens de ruido industrial.

## Herramientas y Scripts
* **Punto de Entrada**: `.agents/skills/data-catalog-sanitizer/scripts/sanitize_catalog.py`
* **Entorno**: Python 3.10+ (agnóstico, Multi-OS, sin dependencias externas; opera sobre la biblioteca estándar `csv`, `json`, `sqlite3`, `pathlib` y `re`).

## Modos de Operación CLI

### 1. Auditoría de Calidad y Diagnóstico de Anomalías (Solo Lectura)
Evalúa el catálogo contra el esquema canónico, calculando un índice de calidad (0 a 100) y detectando duplicados o incongruencias de rango sin alterar el archivo:
```bash
python3 .agents/skills/data-catalog-sanitizer/scripts/sanitize_catalog.py \
  --input="catalog_raw.csv" \
  --validate \
  --json
```

### 2. Sanitización y Normalización Canónica Completa
Normaliza encabezados, estandariza precios a punto flotante, descompone años en `year_start` y `year_end`, y elimina tokens de ruido:
```bash
python3 .agents/skills/data-catalog-sanitizer/scripts/sanitize_catalog.py \
  --input="raw_parts.csv" \
  --output="clean_parts.csv" \
  --sanitize \
  --json
```

### 3. Deduplicación por Clave de Negocio con Estrategia Configurable
Elimina duplicados basados en claves compuestas (`sku` o `make,model,sku`) aplicando `keep_first` o `keep_last`:
```bash
python3 .agents/skills/data-catalog-sanitizer/scripts/sanitize_catalog.py \
  --input="multivendor_feed.json" \
  --output="deduped_feed.json" \
  --sanitize \
  --dedupe \
  --dedupe-keys="make,model,sku" \
  --strategy="keep_first" \
  --json
```

### 4. Procesamiento Masivo por Lotes (§54.4) en SQLite
Procesa tablas masivas de bases de datos locales (`.db`, `.sqlite`) en lotes de 1,000 registros mediante transacciones atómicas:
```bash
python3 .agents/skills/data-catalog-sanitizer/scripts/sanitize_catalog.py \
  --input="data/lake.db" \
  --table="raw_items" \
  --output="data/lake.db" \
  --output-table="clean_items" \
  --batch-size=1000 \
  --sanitize \
  --json
```

## Contratos de Entrada y Salida (JSON Schema)

### Salida Estructurada (`--json`)
```json
{
  "status": "SANITIZED",
  "input_source": "raw_parts.csv",
  "output_source": "clean_parts.csv",
  "format": "csv",
  "summary": {
    "total_records": 1500,
    "clean_records": 1485,
    "rejected_records": 15,
    "duplicates_removed": 12,
    "quality_score": 99.0
  },
  "schema_mapping": {
    "cod_articulo": "sku",
    "marca_auto": "make",
    "modelo_auto": "model",
    "anos_compatibles": "year_range",
    "precio_venta": "price"
  },
  "anomalies": [
    {
      "row_index": 42,
      "sku": "PAR-901",
      "issue": "INVALID_YEAR_RANGE",
      "details": "year_start (2020) mayor que year_end (2015)"
    }
  ]
}
```

## Códigos de Retorno Deterministas
* **0**: Operación exitosa (auditoría o sanitización completada con calidad conforme).
* **1**: Fallo de validación en modo estricto (`--strict`), calidad por debajo del umbral (`--min-quality`) o error de escritura.
* **2**: Error de parámetros de entrada (archivo no encontrado `[ERROR-FILE-NOT-FOUND]`, formato no soportado `[ERROR-INVALID-FORMAT]`, o tabla SQLite inexistente `[ERROR-TABLE-NOT-FOUND]`).

## Mandatos de Gobernanza
* **Tolerancia Cero a Mocks (§4)**: Ejecución y verificación física contra archivos CSV/TSV, JSON o SQLite WAL reales en disco.
* **Sad Path Mandatorio (§6)**: Salidas deterministas con código 2 ante fuentes de datos corruptas y código 1 ante anomalías críticas con `--strict`.
* **Chunking Masivo Obligatorio (§54.4)**: Manejo de procesamiento por lotes transaccionales de 500 a 5,000 registros para prevenir desbordamientos de memoria.
