#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MarkOS Generic OSINT: Matriz y Calculadora de Rutas Interestatales de Alto Valor.

Calcula tiempos estimados, distancias y propuestas de valor para rutas interurbanas
de tarifa plana (ej. traslados de larga distancia frente a trenes o vuelos de conexión).
Contrato de salida estándar MarkOS: {"status": "success|error", "data": [...], "meta": {...}}
"""

import os
import sys
import json
import time
from typing import Dict, Any, List

# Rutas de alto ticket estándar
INTERSTATE_CORRIDORS = [
    {
        "id": "CORRIDOR-NYC-DC",
        "route_name": "Mid-Atlantic Corridor: Washington DC / NoVA to New York City",
        "distance_miles": 240,
        "estimated_hours": "4.0 - 4.5",
        "primary_highway": "I-95 North / NJ Turnpike",
        "target_segments": ["Ejecutivos C-Suite", "Diplomáticos", "Familias con equipaje grande", "Turistas VIP"],
        "competitive_edge": "Puerta a puerta sin escalas intermedias, sin revisiones de equipaje ni retrasos de estación.",
        "indicative_flat_rate": "$750 - $950"
    },
    {
        "id": "CORRIDOR-STATE-CAPITOLS",
        "route_name": "Regional Business Route: DC Metro to State Capitol (Richmond)",
        "distance_miles": 105,
        "estimated_hours": "1.8 - 2.2",
        "primary_highway": "I-95 South",
        "target_segments": ["Cabilderos", "Contratistas", "Delegaciones gubernamentales"],
        "competitive_edge": "Tarifa fija cerrada con chofer a disposición para retorno el mismo día.",
        "indicative_flat_rate": "$320 - $420"
    },
    {
        "id": "CORRIDOR-CAMPUS-EXPRESS",
        "route_name": "Academic & Medical Corridor: Airport to University Campus (Charlottesville)",
        "distance_miles": 110,
        "estimated_hours": "2.0 - 2.3",
        "primary_highway": "US-29 South",
        "target_segments": ["Facultad universitaria", "Investigadores", "Familias", "Pacientes médicos"],
        "competitive_edge": "Conexión directa desde terminal aérea internacional al destino final sin transbordos.",
        "indicative_flat_rate": "$340 - $440"
    }
]


def fetch_interstate_routes(corridor_query: str = None) -> Dict[str, Any]:
    """Retorna la matriz de rutas y cálculos comerciales para servicios de larga distancia."""
    try:
        results = []
        q_norm = corridor_query.strip().lower() if corridor_query else None

        for route in INTERSTATE_CORRIDORS:
            entry = dict(route)

            if q_norm:
                searchable = f"{entry['id']} {entry['route_name']} {entry['primary_highway']}".lower()
                if q_norm not in searchable:
                    continue

            results.append(entry)

        return {
            "status": "success",
            "module": "interstate_routes",
            "data": results,
            "meta": {
                "total_routes": len(results),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
        }

    except Exception as e:
        return {
            "status": "error",
            "module": "interstate_routes",
            "error_type": type(e).__name__,
            "message": str(e),
            "data": []
        }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="MarkOS Generic Interstate Routes Matrix")
    parser.add_argument("--query", help="Filtro opcional por nombre o corredor (ej: nyc, richmond, campus)")
    args = parser.parse_args()

    payload = fetch_interstate_routes(corridor_query=args.query)
    print(json.dumps(payload, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
