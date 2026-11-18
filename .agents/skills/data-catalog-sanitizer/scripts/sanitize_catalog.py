#!/usr/bin/env python3
"""
sanitize_catalog.py — Sanitizador, deduplicador y normalizador de catálogos tabulares.

Extraído y desacoplado del pipeline de ingesta de Ruedas (MarketRawSanitizer / ingestion_engine).
Procesa catálogos en CSV, TSV, JSON y SQLite en formato Multi-OS sin dependencias externas.
Normaliza esquemas y encabezados, desglosa rangos de años vehiculares, estandariza precios,
purga tokens de ruido industrial y deduplica registros respetando la Regla §54.4 (Chunking Masivo).
"""

import sys
import os
import csv
import json
import sqlite3
import argparse
import re
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional, Set

# Diccionario canónico de mapeo de alias de columnas
HEADER_ALIAS_MAP: Dict[str, str] = {
    # SKU / Identificador de pieza
    "sku": "sku",
    "cod": "sku",
    "codigo": "sku",
    "código": "sku",
    "part_number": "sku",
    "part_no": "sku",
    "num_parte": "sku",
    "numero_parte": "sku",
    "referencia": "sku",
    "ref": "sku",
    "item": "sku",
    "item_code": "sku",
    "clave": "sku",
    "id": "sku",

    # Marca automotriz o comercial
    "make": "make",
    "marca": "make",
    "fabricante": "make",
    "brand": "make",
    "linea": "make",

    # Modelo / Vehículo
    "model": "model",
    "modelo": "model",
    "vehiculo": "model",
    "vehículo": "model",
    "aplicacion": "model",
    "aplicación": "model",

    # Años
    "year_start": "year_start",
    "anio_desde": "year_start",
    "ano_desde": "year_start",
    "año_desde": "year_start",
    "desde": "year_start",
    "y_from": "year_start",
    "year_from": "year_start",

    "year_end": "year_end",
    "anio_hasta": "year_end",
    "ano_hasta": "year_end",
    "año_hasta": "year_end",
    "hasta": "year_end",
    "y_to": "year_end",
    "year_to": "year_end",

    "year_range": "year_range",
    "years": "year_range",
    "anos": "year_range",
    "anios": "year_range",
    "años": "year_range",
    "rango_anos": "year_range",
    "periodo": "year_range",

    # Precio
    "price": "price",
    "precio": "price",
    "costo": "price",
    "pvp": "price",
    "monto": "price",
    "valor": "price",
    "importe": "price",

    # Descripción
    "description": "description",
    "descripcion": "description",
    "descripción": "description",
    "desc": "description",
    "detalle": "description",
    "nombre": "description",
    "titulo": "description",
    "título": "description",

    # Categoría
    "category": "category",
    "categoria": "category",
    "categoría": "category",
    "familia": "category",
    "rubro": "category",
    "grupo": "category",
    "seccion": "category",

    # Existencia / Stock
    "stock": "stock",
    "cantidad": "stock",
    "qty": "stock",
    "existencia": "stock",
    "inventario": "stock",
    "disponible": "stock",
}

# Tokens de ruido industrial a eliminar de textos y descripciones
NOISE_TOKENS: Set[str] = {
    "1MUESC", "2MUESC", "3MUESC", "4MUESC", "1MUESCAS", "2MUESCAS", "3MUESCAS",
    "MUESCA", "MUESCAS", "FIBRA", "GRAFITO", "MLS", "SENC", "LAMINA", "CHAPA",
    "ASBESTO", "METALICO", "STD", "0.10", "0.20", "0.25", "0.30", "0.40", "0.50",
    "0.75", "1.00", "N/A", "NULL", "NAN", "NONE", "S/M", "S/D"
}


def normalize_column_name(col: str) -> str:
    """Normaliza un nombre de columna a minúsculas, sin espacios ni caracteres especiales."""
    cleaned = re.sub(r'[\s\-_]+', '_', col.strip().lower())
    cleaned = re.sub(r'[^a-z0-9_áéíóúñ]', '', cleaned)
    return HEADER_ALIAS_MAP.get(cleaned, cleaned)


def parse_year_range(raw_val: Any) -> Tuple[Optional[int], Optional[int], Optional[str]]:
    """
    Desglosa cadenas de rango de años en (year_start, year_end, anomaly).
    Soporta formatos: "2010-2015", "10-15", "05/12", "2018+", "2016 adelante", "2008".
    """
    if raw_val is None:
        return None, None, None

    s = str(raw_val).strip()
    if not s or s.upper() in ("N/A", "NULL", "NAN", "-"):
        return None, None, None

    # Caso 1: Rango explícito de 4 dígitos (ej: 2010-2015, 2010/2015, 2010 a 2015)
    m4 = re.search(r'(\b\d{4}\b)\s*[-/aA]\s*(\b\d{4}\b)', s)
    if m4:
        y1 = int(m4.group(1))
        y2 = int(m4.group(2))
        if y1 > y2:
            return y1, y2, f"INVALID_YEAR_RANGE: {y1} > {y2}"
        return y1, y2, None

    # Caso 2: Rango de 2 dígitos (ej: 05-12, 98-04, 15/20)
    m2 = re.search(r'(\b\d{2}\b)\s*[-/]\s*(\b\d{2}\b)', s)
    if m2:
        val1 = int(m2.group(1))
        val2 = int(m2.group(2))
        y1 = (2000 + val1) if val1 <= 40 else (1900 + val1)
        y2 = (2000 + val2) if val2 <= 40 else (1900 + val2)
        if y1 > y2:
            return y1, y2, f"INVALID_YEAR_RANGE: {y1} > {y2}"
        return y1, y2, None

    # Caso 3: Rango abierto (ej: 2018+, 2018 en adelante, >2015)
    m_open = re.search(r'(\b\d{4}\b)\s*(\+|adelante|posterior|onwards)', s, re.IGNORECASE)
    if m_open:
        y1 = int(m_open.group(1))
        return y1, None, None

    # Caso 4: Año individual (ej: 2012)
    m_single = re.search(r'\b(19\d{2}|20\d{2})\b', s)
    if m_single:
        y = int(m_single.group(1))
        return y, y, None

    return None, None, f"UNPARSED_YEAR: {s}"


def parse_price(raw_val: Any) -> Tuple[Optional[float], Optional[str]]:
    """
    Limpia y convierte valores de precio a float.
    Maneja monedas ($/€/Bs), separadores de miles y decimales mixtos.
    """
    if raw_val is None:
        return None, None

    s = str(raw_val).strip()
    if not s or s.upper() in ("N/A", "NULL", "NAN", "-"):
        return None, None

    # Eliminar símbolos de moneda y espacios sin tocar el punto ni la coma
    s_clean = re.sub(r'(?:Bs\.?|USD|EUR|GBP|[\$€£])', '', s, flags=re.IGNORECASE).strip()
    s_clean = re.sub(r'\s+', '', s_clean)

    # Manejar formatos con coma y punto
    if ',' in s_clean and '.' in s_clean:
        if s_clean.rfind(',') > s_clean.rfind('.'):
            # Formato latino o europeo con miles de punto y decimales de coma: 1.250,50
            s_clean = s_clean.replace('.', '').replace(',', '.')
        else:
            # Formato estándar US con miles de coma: 1,250.50
            s_clean = s_clean.replace(',', '')
    elif ',' in s_clean and '.' not in s_clean:
        # Solo coma: si tiene 1 o 2 decimales (45,50), es decimal; si son 3 dígitos (1,000), son miles
        parts = s_clean.split(',')
        if len(parts) == 2 and len(parts[1]) in (1, 2):
            s_clean = s_clean.replace(',', '.')
        else:
            s_clean = s_clean.replace(',', '')

    try:
        val = float(s_clean)
        if val < 0.0:
            return val, f"NEGATIVE_PRICE: {val}"
        return round(val, 2), None
    except ValueError:
        return None, f"INVALID_PRICE_FORMAT: {s}"


def clean_text_attribute(raw_val: Any, uppercase: bool = False, strip_noise: bool = True) -> str:
    """Limpia cadenas textuales, eliminando espacios redundantes y tokens de ruido."""
    if raw_val is None:
        return ""
    text = str(raw_val).strip()
    # Colapsar espacios múltiples
    text = re.sub(r'\s+', ' ', text)
    if strip_noise:
        tokens = text.split(' ')
        filtered = [t for t in tokens if t.upper() not in NOISE_TOKENS]
        text = ' '.join(filtered)
    if uppercase:
        text = text.upper()
    return text.strip()


def sanitize_row(raw_row: Dict[str, Any], row_idx: int) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Sanitiza un registro individual contra el esquema canónico de catálogo.
    Retorna (clean_row, row_anomalies).
    """
    clean_row: Dict[str, Any] = {}
    anomalies: List[Dict[str, Any]] = []

    # 1. Normalizar encabezados
    normalized_input: Dict[str, Any] = {}
    for k, v in raw_row.items():
        if k is not None:
            norm_k = normalize_column_name(str(k))
            normalized_input[norm_k] = v

    # 2. Procesar SKU
    raw_sku = normalized_input.get("sku")
    clean_sku = clean_text_attribute(raw_sku, uppercase=True, strip_noise=False)
    if not clean_sku:
        anomalies.append({
            "row_index": row_idx,
            "sku": "UNKNOWN",
            "issue": "MISSING_SKU",
            "details": f"Fila {row_idx} carece de SKU o código válido"
        })
        clean_row["sku"] = f"AUTO_SKU_{row_idx:06d}"
    else:
        # Normalizar caracteres de SKU (alfanumérico y guiones)
        clean_row["sku"] = re.sub(r'[^A-Z0-9\-_./]', '', clean_sku)

    # 3. Procesar Marca y Modelo
    clean_row["make"] = clean_text_attribute(normalized_input.get("make"), uppercase=True)
    clean_row["model"] = clean_text_attribute(normalized_input.get("model"), uppercase=True)

    # 4. Procesar Años
    y_start = normalized_input.get("year_start")
    y_end = normalized_input.get("year_end")
    y_range = normalized_input.get("year_range")

    calc_start, calc_end = None, None

    if y_range:
        calc_start, calc_end, y_err = parse_year_range(y_range)
        if y_err:
            anomalies.append({
                "row_index": row_idx,
                "sku": clean_row["sku"],
                "issue": "INVALID_YEAR_RANGE",
                "details": y_err
            })
    else:
        if y_start is not None:
            try:
                calc_start = int(str(y_start).strip()[:4])
            except (ValueError, IndexError):
                pass
        if y_end is not None:
            try:
                calc_end = int(str(y_end).strip()[:4])
            except (ValueError, IndexError):
                pass

        if calc_start and calc_end and calc_start > calc_end:
            anomalies.append({
                "row_index": row_idx,
                "sku": clean_row["sku"],
                "issue": "INVALID_YEAR_RANGE",
                "details": f"year_start ({calc_start}) > year_end ({calc_end})"
            })

    clean_row["year_start"] = calc_start
    clean_row["year_end"] = calc_end

    # 5. Procesar Precio
    raw_price = normalized_input.get("price")
    clean_price, p_err = parse_price(raw_price)
    if p_err:
        anomalies.append({
            "row_index": row_idx,
            "sku": clean_row["sku"],
            "issue": "PRICE_ANOMALY",
            "details": p_err
        })
    clean_row["price"] = clean_price

    # 6. Procesar Descripción y Categoría
    clean_row["description"] = clean_text_attribute(normalized_input.get("description"), uppercase=False)
    clean_row["category"] = clean_text_attribute(normalized_input.get("category"), uppercase=True)

    # 7. Procesar Stock
    raw_stock = normalized_input.get("stock")
    if raw_stock is not None:
        try:
            clean_row["stock"] = int(float(str(raw_stock).strip()))
        except (ValueError, TypeError):
            clean_row["stock"] = 0
    else:
        clean_row["stock"] = 0

    return clean_row, anomalies


def read_catalog_records(input_path: str, table_name: Optional[str] = None) -> Tuple[List[Dict[str, Any]], str, Dict[str, str]]:
    """
    Carga registros crudos desde CSV, TSV, JSON o SQLite.
    Retorna (records, detected_format, schema_mapping).
    """
    p = Path(input_path)
    if not p.is_file():
        raise FileNotFoundError(f"[ERROR-FILE-NOT-FOUND] Archivo no encontrado: {input_path}")

    ext = p.suffix.lower()
    records: List[Dict[str, Any]] = []
    schema_mapping: Dict[str, str] = {}

    if ext in (".csv", ".tsv", ".txt"):
        detected_format = "csv" if ext != ".tsv" else "tsv"
        with open(p, "r", encoding="utf-8", errors="replace") as f:
            sample = f.read(4096)
            f.seek(0)
            delimiter = ","
            if ext == ".tsv":
                delimiter = "\t"
            else:
                try:
                    dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
                    delimiter = dialect.delimiter
                except Exception:
                    if ";" in sample and sample.count(";") > sample.count(","):
                        delimiter = ";"

            reader = csv.DictReader(f, delimiter=delimiter)
            if reader.fieldnames:
                for col in reader.fieldnames:
                    if col:
                        norm = normalize_column_name(col)
                        schema_mapping[col] = norm
            for row in reader:
                records.append(dict(row))

    elif ext == ".json":
        detected_format = "json"
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, list):
            raw_list = data
        elif isinstance(data, dict):
            # Intentar extraer lista de claves comunes
            for key in ("records", "rows", "items", "data", "products", "catalogs"):
                if key in data and isinstance(data[key], list):
                    raw_list = data[key]
                    break
            else:
                raw_list = [data]
        else:
            raise ValueError(f"[ERROR-INVALID-FORMAT] JSON no contiene estructura de registros válida: {input_path}")

        for item in raw_list:
            if isinstance(item, dict):
                records.append(item)
                for k in item.keys():
                    if k not in schema_mapping:
                        schema_mapping[k] = normalize_column_name(k)

    elif ext in (".db", ".sqlite", ".sqlite3"):
        detected_format = "sqlite"
        if not table_name:
            # Buscar primera tabla que contenga datos
            conn = sqlite3.connect(str(p))
            cur = conn.cursor()
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            tables = [r[0] for r in cur.fetchall()]
            conn.close()
            if not tables:
                raise ValueError(f"[ERROR-TABLE-NOT-FOUND] No se encontraron tablas en SQLite: {input_path}")
            table_name = tables[0]

        conn = sqlite3.connect(str(p))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        try:
            cur.execute(f"SELECT * FROM {table_name}")
            rows = cur.fetchall()
            if rows:
                cols = rows[0].keys()
                for c in cols:
                    schema_mapping[c] = normalize_column_name(c)
                records = [dict(r) for r in rows]
        except sqlite3.OperationalError as oe:
            conn.close()
            raise ValueError(f"[ERROR-TABLE-NOT-FOUND] Error al leer tabla '{table_name}': {oe}")
        finally:
            conn.close()

    else:
        raise ValueError(f"[ERROR-INVALID-FORMAT] Extensión o formato no soportado: '{ext}'")

    return records, detected_format, schema_mapping


def write_catalog_records(
    output_path: str,
    records: List[Dict[str, Any]],
    output_format: str = "csv",
    table_name: str = "clean_catalog",
    batch_size: int = 1000
) -> None:
    """
    Escribe registros sanitizados a CSV, JSON o SQLite por lotes (§54.4).
    """
    p = Path(output_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    ext = p.suffix.lower()

    if not records:
        canonical_fields = ["sku", "make", "model", "year_start", "year_end", "price", "description", "category", "stock"]
    else:
        canonical_fields = list(records[0].keys())

    if ext in (".csv", ".tsv") or output_format in ("csv", "tsv"):
        delimiter = "\t" if ext == ".tsv" or output_format == "tsv" else ","
        with open(p, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=canonical_fields, delimiter=delimiter)
            writer.writeheader()
            # Escritura por bloques
            for i in range(0, len(records), batch_size):
                chunk = records[i:i + batch_size]
                writer.writerows(chunk)

    elif ext == ".json" or output_format == "json":
        with open(p, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, ensure_ascii=False)

    elif ext in (".db", ".sqlite", ".sqlite3") or output_format == "sqlite":
        conn = sqlite3.connect(str(p))
        cur = conn.cursor()
        # Crear tabla si no existe
        col_defs = ", ".join([f'"{col}" TEXT' for col in canonical_fields])
        cur.execute(f'CREATE TABLE IF NOT EXISTS "{table_name}" ({col_defs})')
        conn.commit()

        # Inserción masiva por lotes con transacción explícita (§54.4)
        placeholders = ", ".join(["?"] * len(canonical_fields))
        insert_sql = f'INSERT INTO "{table_name}" ({", ".join(canonical_fields)}) VALUES ({placeholders})'

        for i in range(0, len(records), batch_size):
            chunk = records[i:i + batch_size]
            values = []
            for r in chunk:
                values.append([r.get(c) for c in canonical_fields])
            cur.executemany(insert_sql, values)
            conn.commit()

        conn.close()


def deduplicate_records(
    records: List[Dict[str, Any]],
    key_fields: List[str],
    strategy: str = "keep_first"
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Deduplica una lista de registros basados en los campos clave especificados.
    Estrategias soportadas: 'keep_first', 'keep_last'.
    """
    seen: Dict[Tuple[Any, ...], Dict[str, Any]] = {}
    deduped: List[Dict[str, Any]] = []
    removed_count = 0

    if strategy == "keep_last":
        records = list(reversed(records))

    for r in records:
        key = tuple(str(r.get(k, "")).strip().upper() for k in key_fields)
        if key in seen:
            removed_count += 1
            continue
        seen[key] = r
        deduped.append(r)

    if strategy == "keep_last":
        deduped = list(reversed(deduped))

    return deduped, removed_count


def calculate_quality_score(records: List[Dict[str, Any]], anomalies: List[Dict[str, Any]]) -> float:
    """
    Calcula el puntaje de calidad del catálogo (0.0 a 100.0).
    Ponderaciones:
      - SKUs válidos: 30%
      - Precios presentes y positivos: 25%
      - Marca y Modelo especificados: 25%
      - Rangos de años consistentes: 20%
    """
    if not records:
        return 0.0

    total = float(len(records))
    valid_skus = sum(1 for r in records if r.get("sku") and not str(r.get("sku")).startswith("AUTO_SKU_"))
    valid_prices = sum(1 for r in records if r.get("price") is not None and r.get("price") >= 0.0)
    valid_make_model = sum(1 for r in records if r.get("make") and r.get("model"))
    valid_years = sum(1 for r in records if r.get("year_start") is not None)

    score = (
        (valid_skus / total) * 30.0 +
        (valid_prices / total) * 25.0 +
        (valid_make_model / total) * 25.0 +
        (valid_years / total) * 20.0
    )

    # Penalización por anomalías críticas
    anomaly_penalty = min(20.0, float(len(anomalies)) * 0.5)
    final_score = max(0.0, min(100.0, score - anomaly_penalty))
    return round(final_score, 2)


def process_catalog(
    input_path: str,
    output_path: Optional[str] = None,
    table_name: Optional[str] = None,
    output_table: str = "clean_catalog",
    validate_only: bool = False,
    dedupe: bool = False,
    dedupe_keys: Optional[List[str]] = None,
    strategy: str = "keep_first",
    batch_size: int = 1000,
    min_quality: float = 90.0,
    strict: bool = False,
) -> Dict[str, Any]:
    """
    Ejecuta el ciclo integral de sanitización, validación y deduplicación tabular.
    """
    records, detected_format, schema_mapping = read_catalog_records(input_path, table_name)
    total_records = len(records)

    clean_records: List[Dict[str, Any]] = []
    all_anomalies: List[Dict[str, Any]] = []

    # Sanitizar fila a fila
    for idx, row in enumerate(records, start=1):
        c_row, r_anomalies = sanitize_row(row, idx)
        clean_records.append(c_row)
        all_anomalies.extend(r_anomalies)

    # Deduplicación si está activa
    duplicates_removed = 0
    if dedupe:
        keys = dedupe_keys or ["sku"]
        clean_records, duplicates_removed = deduplicate_records(clean_records, keys, strategy)

    # Cálculo de métricas
    quality_score = calculate_quality_score(clean_records, all_anomalies)
    rejected_count = sum(1 for a in all_anomalies if a.get("issue") in ("MISSING_SKU", "NEGATIVE_PRICE"))

    result_payload: Dict[str, Any] = {
        "status": "VALIDATED" if validate_only else "SANITIZED",
        "input_source": str(Path(input_path).resolve()),
        "format": detected_format,
        "summary": {
            "total_records": total_records,
            "clean_records": len(clean_records),
            "rejected_records": rejected_count,
            "duplicates_removed": duplicates_removed,
            "quality_score": quality_score,
            "min_quality_threshold": min_quality,
        },
        "schema_mapping": schema_mapping,
        "anomalies_count": len(all_anomalies),
        "anomalies": all_anomalies[:50],  # Mostrar primeras 50 anomalías
    }

    if not validate_only:
        if not output_path:
            raise ValueError("[ERROR-ARGUMENTS] Se requiere --output para la operación de sanitización")
        write_catalog_records(output_path, clean_records, output_format=detected_format, table_name=output_table, batch_size=batch_size)
        result_payload["output_source"] = str(Path(output_path).resolve())

    # Validación estricta
    if strict:
        if quality_score < min_quality or rejected_count > 0:
            result_payload["status"] = "VALIDATION_FAILED"
            raise ValueError(
                f"[ERROR-VALIDATION-FAILED] Calidad ({quality_score}) inferior al umbral ({min_quality}) "
                f"o anomalías críticas detectadas ({rejected_count})"
            )

    return result_payload


def build_cli_parser() -> argparse.ArgumentParser:
    """Configura el parser de argumentos de línea de comandos."""
    parser = argparse.ArgumentParser(
        description="Sanitizador, deduplicador y normalizador de catálogos tabulares para Ruedas y flota."
    )
    parser.add_argument("-i", "--input", required=True, help="Ruta al archivo origen (CSV, TSV, JSON, SQLite).")
    parser.add_argument("-o", "--output", default=None, help="Ruta al archivo destino sanitizado.")
    parser.add_argument("--table", default=None, help="Nombre de tabla si el origen es SQLite.")
    parser.add_argument("--output-table", default="clean_catalog", help="Nombre de tabla de salida para SQLite.")
    parser.add_argument("--validate", "--audit", dest="validate", action="store_true", help="Audita el catálogo sin generar salida.")
    parser.add_argument("--sanitize", action="store_true", help="Ejecuta la sanitización y guarda el resultado.")
    parser.add_argument("--dedupe", action="store_true", help="Activa deduplicación de registros.")
    parser.add_argument("--dedupe-keys", default="sku", help="Campos clave para deduplicar, separados por coma (default: sku).")
    parser.add_argument("--strategy", choices=["keep_first", "keep_last"], default="keep_first", help="Estrategia de deduplicación.")
    parser.add_argument("--batch-size", type=int, default=1000, help="Tamaño de lote para chunking masivo (§54.4) (default: 1000).")
    parser.add_argument("--strict", action="store_true", help="Falla con exit code 1 ante anomalías críticas o calidad baja.")
    parser.add_argument("--min-quality", type=float, default=90.0, help="Umbral de calidad mínima para modo estricto (default: 90.0).")
    parser.add_argument("--json", action="store_true", help="Emite el resultado en formato JSON estructurado.")
    return parser


def main() -> int:
    parser = build_cli_parser()
    args = parser.parse_args()

    dedupe_keys = [k.strip() for k in args.dedupe_keys.split(",") if k.strip()]

    try:
        result = process_catalog(
            input_path=args.input,
            output_path=args.output,
            table_name=args.table,
            output_table=args.output_table,
            validate_only=args.validate and not args.sanitize,
            dedupe=args.dedupe,
            dedupe_keys=dedupe_keys,
            strategy=args.strategy,
            batch_size=args.batch_size,
            min_quality=args.min_quality,
            strict=args.strict,
        )

        if args.json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            mode_label = "AUDITORÍA DE CALIDAD" if args.validate and not args.sanitize else "SANITIZACIÓN EXITOSA"
            print(f"=== [DATA-CATALOG-SANITIZER] {mode_label} ===")
            print(f"  Fuente Origen   : {result['input_source']} ({result['format'].upper()})")
            if "output_source" in result:
                print(f"  Fuente Destino  : {result['output_source']}")
            print(f"  Total Filas     : {result['summary']['total_records']}")
            print(f"  Filas Limpias   : {result['summary']['clean_records']}")
            print(f"  Duplicados      : {result['summary']['duplicates_removed']}")
            print(f"  Índice Calidad  : {result['summary']['quality_score']} / 100.0 (Mínimo: {result['summary']['min_quality_threshold']})")
            print(f"  Anomalías       : {result['anomalies_count']} detectadas")

        return 0

    except FileNotFoundError as fnf:
        sys.stderr.write(f"{fnf}\n")
        return 2
    except ValueError as ve:
        err_msg = str(ve)
        sys.stderr.write(f"{err_msg}\n")
        if "[ERROR-VALIDATION-FAILED]" in err_msg:
            return 1
        return 2
    except IOError as ioe:
        sys.stderr.write(f"{ioe}\n")
        return 1
    except Exception as ex:
        sys.stderr.write(f"[ERROR-UNEXPECTED] Excepción no controlada: {ex}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
