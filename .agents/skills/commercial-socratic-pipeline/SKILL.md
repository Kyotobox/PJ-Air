---
name: commercial-socratic-pipeline
description: Pipeline comercial y socrático de arbitraje digital con sincronizador determinista BlueMarket a Levita (margen >= 60%) y contratos comerciales Pure Dart.
---

# Commercial Socratic Pipeline Skill (§4, §6, §39, §55, §56, §58)

## Propósito
Provee un pipeline comercial, transaccional y socrático de arbitraje digital entre el catálogo mayorista y digital de **BlueMarket** (bienes digitales y arbitraje autónomo) y la vitrina publicitaria y asistida de **Levita** (incubadora experimental y ecosistema publicitario visual).

Garantiza la sincronización determinista de ofertas digitales cumpliendo con el umbral constitucional de rentabilidad financiera (**margen bruto $\ge 60.0\%$**), validando los DTOs inmutables Pure Dart definidos en Axioma (`CommercialProductContract`, `CommercialOrderHandoffContract`, `CommercialDeliveryPayload`) y asegurando la integridad transaccional entre bases SQLite.

## Herramientas y Scripts
* **Punto de Entrada**: `.agents/skills/commercial-socratic-pipeline/scripts/catalog_bridge_sync.dart`
* **Entorno**: Dart SDK / Pure Dart (Agnóstico, Multi-OS, dependiente de `package:sqlite3` y `package:axioma`).

## Contratos de Entrada y Salida

### Entrada (BlueMarket)
* Archivo SQLite con la tabla de inventario mayorista (`bluemarket_catalog`):
  * `sku` (TEXT, PRIMARY KEY)
  * `title` (TEXT, NOT NULL)
  * `cost_cents` (INTEGER, NOT NULL, costo en centavos USD)
  * `retail_price_cents` (INTEGER, NOT NULL, precio retail sugerido en centavos USD)
  * `stock` (INTEGER, NOT NULL, stock disponible)
  * `delivery_type` (TEXT, NOT NULL: `staticAsset`, `dynamicAccount`, `licenseKey`, `serviceSubscription`)
  * `asset_url` (TEXT, opcional)
  * `description` (TEXT, opcional)

### Salida (Levita Showcase)
* Tabla de vitrina publicitaria socrática (`levita_showcase`):
  * Solo productos cuyo margen comercial $\frac{\text{retail} - \text{cost}}{\text{retail}} \ge 0.60$ (60%).
  * Campos enriquecidos para canal socrático (`sales_channel = whatsapp_socratic`), payload de entrega validado y timestamp de indexación.

## Modos de Operación CLI

### 1. Sincronización Determinista Canónica (Margen $\ge 60\%$)
```bash
dart run .agents/skills/commercial-socratic-pipeline/scripts/catalog_bridge_sync.dart \
  --source-db="data/bluemarket.db" \
  --target-db="data/levita.db" \
  --min-margin=0.60 \
  --json
```

### 2. Simulación en Seco (Dry Run)
Evalúa el catálogo y emite métricas de cuántos productos califican sin mutar la base destino:
```bash
dart run .agents/skills/commercial-socratic-pipeline/scripts/catalog_bridge_sync.dart \
  --source-db="data/bluemarket.db" \
  --target-db="data/levita.db" \
  --dry-run \
  --json
```

## Manejo de Excepciones y Sad Paths (§6, §55)
* **`CorruptDatabaseException`**: Se arroja cuando el archivo SQLite está físicamente dañado, corrupto o inaccesible (exit code 1).
* **`DatabaseSchemaException`**: Se arroja cuando la tabla origen no existe o carece de columnas obligatorias (`sku`, `cost_cents`, `retail_price_cents`) (exit code 2).
* **`InvalidMarginException`**: Se arroja cuando el umbral de margen especificado es numéricamente inválido ($< 0.0$ o $> 1.0$) (exit code 3).
* **`CommercialFinancialOverflowException`**: Se arroja ante desbordamientos numéricos, costos negativos o inconsistencias de precio retail (exit code 4).
