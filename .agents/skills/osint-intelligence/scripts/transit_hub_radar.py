#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MarkOS Generic OSINT: Monitoreo de Estado de Nodos de Transporte y Aeropuertos (FAA API).

Supervisa anomalías operativas, Ground Delays y Ground Stops en aeropuertos
para detectar picos de demanda y volatilidad de precios en movilidad terrestre.
Contrato de salida estándar MarkOS: {"status": "success|error", "data": [...], "meta": {...}}
"""

import os
import sys
import json
import time
import requests
from typing import Dict, Any, List

FAA_STATUS_API = "https://nasstatus.faa.gov/api/airport-status-information"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 MarkOS/1.0",
    "Accept": "application/json, text/plain, */*"
}


def check_faa_airport_status(airport_code: str) -> Dict[str, Any]:
    """Consulta el estado oficial de operaciones de la FAA para cualquier aeropuerto IATA de EE.UU."""
    code = airport_code.upper().strip()
    info = {
        "airport": code,
        "ground_delay": False,
        "ground_stop": False,
        "delay_reason": "Normal operations",
        "avg_delay_minutes": 0,
        "demand_opportunity": "NORMAL"
    }

    try:
        resp = requests.get(FAA_STATUS_API, headers=HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            records = []
            if isinstance(data, list):
                records = data
            elif isinstance(data, dict):
                records = data.get("AirportStatusList", data.get("status", data.get("data", [])))
                if not isinstance(records, list):
                    records = [records] if isinstance(records, dict) else []

            for record in records:
                if isinstance(record, dict) and record.get("ARPT") == code:
                    reason = record.get("Reason", "")
                    delay_type = record.get("Type", "")
                    
                    info["delay_reason"] = reason if reason else "Congestion / Adverse weather"
                    info["demand_opportunity"] = "HIGH"

                    if delay_type == "Ground Stop" or "ground stop" in reason.lower():
                        info["ground_stop"] = True
                    else:
                        info["ground_delay"] = True

                    delay_str = str(record.get("AvgDelay", "0"))
                    digits = [int(s) for s in delay_str.split() if s.isdigit()]
                    if digits:
                        info["avg_delay_minutes"] = digits[0]
                    break

    except requests.exceptions.RequestException:
        info["delay_reason"] = "FAA Service Unreachable - Offline standard mode"
    except Exception as e:
        info["delay_reason"] = f"Parse fallback: {str(e)}"

    return info


def fetch_transit_hub_status(airports: List[str] = ["IAD", "DCA", "JFK", "MIA", "LAX"]) -> Dict[str, Any]:
    """Supervisa una lista de nodos de transporte aéreo y genera diagnósticos comerciales."""
    try:
        report = []
        for iata in airports:
            status = check_faa_airport_status(iata)
            is_disrupted = status["ground_delay"] or status["ground_stop"]

            report.append({
                "iata": iata,
                "status": status,
                "commercial_signal": (
                    f"Retrasos o cancelaciones en {iata} ({status['delay_reason']}). "
                    f"Alta probabilidad de saturación de tarifas dinámicas en apps de movilidad."
                    if is_disrupted else
                    f"Operaciones nominales en {iata}. Flujo de pasajeros estándar."
                )
            })

        return {
            "status": "success",
            "module": "transit_hub_radar",
            "data": report,
            "meta": {
                "airports_monitored": airports,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
        }

    except Exception as e:
        return {
            "status": "error",
            "module": "transit_hub_radar",
            "error_type": type(e).__name__,
            "message": str(e),
            "data": []
        }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="MarkOS Generic Airport & Transit Hub Status Radar")
    parser.add_argument("--airports", nargs="+", default=["IAD", "DCA"], help="Lista de códigos IATA")
    args = parser.parse_args()

    payload = fetch_transit_hub_status(airports=args.airports)
    print(json.dumps(payload, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
