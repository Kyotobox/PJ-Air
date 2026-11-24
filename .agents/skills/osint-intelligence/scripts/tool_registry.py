#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MarkOS Generic OSINT: Registro y Enrutador Unificado de Inteligencia de Mercado.

Proporciona:
1. OSINT_TOOL_DEFINITIONS: Esquemas JSON estándar para llamadas de función (LLM Tool Calling).
2. dispatch_osint_tool(tool_name, arguments): Cortafuegos de ejecución desacoplado y blindado.
"""

import os
import sys
import json
import time
from typing import Dict, Any, List

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

fetch_niche_directory = None
fetch_transit_hub_status = None
monitor_social_demand = None
fetch_interstate_routes = None

try:
    from niche_directory import fetch_niche_directory
except Exception as err:
    sys.stderr.write(f"Warning: niche_directory: {err}\n")

try:
    from transit_hub_radar import fetch_transit_hub_status
except Exception as err:
    sys.stderr.write(f"Warning: transit_hub_radar: {err}\n")

try:
    from social_listening import monitor_social_demand
except Exception as err:
    sys.stderr.write(f"Warning: social_listening: {err}\n")

try:
    from interstate_routes import fetch_interstate_routes
except Exception as err:
    sys.stderr.write(f"Warning: interstate_routes: {err}\n")


OSINT_TOOL_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "osint_niche_directory",
            "description": (
                "Prospecta y extrae información de contacto y oportunidades comerciales en directorios "
                "de nicho (venues, bodegas, hoteles corporativos, centros de convenciones). "
                "Diseñado para prospección B2B de agencias y captación de clientes."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": ["venues_wineries", "hospitality_b2b"],
                        "description": "Categoría comercial de prospección."
                    },
                    "location": {
                        "type": "string",
                        "description": "Filtro opcional por ciudad o región."
                    },
                    "enrich": {
                        "type": "boolean",
                        "description": "Si es True, realiza scraping en vivo para actualizar correos y teléfonos."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "osint_transit_hub_radar",
            "description": (
                "Monitorea el estado operativo oficial de aeropuertos y nodos de transporte (FAA API) "
                "para detectar retrasos, cancelaciones o picos de demanda que impactan el mercado local."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "airports": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Lista de códigos IATA a supervisar (ej. ['IAD', 'DCA', 'JFK', 'MIA'])."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "osint_social_listening",
            "description": (
                "Supervisa canales y foros de discusión pública (Reddit) para detectar dolores del consumidor, "
                "quejas de precios, fallas en competidores y oportunidades de posicionamiento."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "subreddits": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Comunidades o subreddits a escanear (ej. ['nova', 'washingtondc'])."
                    },
                    "keywords": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Términos o marcas de la competencia a rastrear."
                    },
                    "live": {
                        "type": "boolean",
                        "description": "Si es True, ejecuta consulta HTTP en vivo. Por defecto False (offline seguro)."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "osint_interstate_routes",
            "description": (
                "Calcula métricas comerciales, distancias y propuesta de valor para servicios de transporte "
                "y logística de larga distancia (rutas interurbanas fijas)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Búsqueda por destino o corredor (ej: 'nyc', 'richmond', 'campus')."
                    }
                },
                "required": []
            }
        }
    }
]


def dispatch_osint_tool(tool_name: str, arguments: Dict[str, Any] = None) -> Dict[str, Any]:
    """Cortafuegos y enrutador unificado de herramientas OSINT para MarkOS y Servidor MCP."""
    args = arguments or {}
    start = time.time()
    normalized = tool_name.replace(".", "_")

    try:
        if normalized in ("osint_niche_directory", "niche_directory"):
            cat = args.get("category", "venues_wineries")
            loc = args.get("location", None)
            enrich = args.get("enrich", False)
            data = fetch_niche_directory(category=cat, location_filter=loc, enrich=enrich) if fetch_niche_directory else {"venues": []}
            return {
                "status": "ok",
                "data": data,
                "metrics": {
                    "duration_ms": int((time.time() - start) * 1000),
                    "records_processed": len(data.get("venues", [])) if isinstance(data, dict) else 0
                }
            }

        elif normalized in ("osint_transit_hub_radar", "transit_hub_radar"):
            ap = args.get("airports", ["IAD", "DCA"])
            data = fetch_transit_hub_status(airports=ap) if fetch_transit_hub_status else {"airports": {}}
            return {
                "status": "ok",
                "data": data,
                "metrics": {
                    "duration_ms": int((time.time() - start) * 1000),
                    "records_processed": len(ap)
                }
            }

        elif normalized in ("osint_social_listening", "social_listening"):
            subs = args.get("subreddits", ["nova", "washingtondc"])
            kws = args.get("keywords", None)
            live = args.get("live", False)
            data = monitor_social_demand(subreddits=subs, keywords=kws, live=live) if monitor_social_demand else {"findings": []}
            return {
                "status": "ok",
                "data": data,
                "metrics": {
                    "duration_ms": int((time.time() - start) * 1000),
                    "records_processed": len(subs)
                }
            }

        elif normalized in ("osint_interstate_routes", "interstate_routes"):
            q = args.get("query", None)
            data = fetch_interstate_routes(corridor_query=q) if fetch_interstate_routes else {"routes": []}
            return {
                "status": "ok",
                "data": data,
                "metrics": {
                    "duration_ms": int((time.time() - start) * 1000),
                    "records_processed": len(data.get("routes", [])) if isinstance(data, dict) else 0
                }
            }

        else:
            return {
                "status": "error",
                "module": "osint_registry",
                "error_type": "ToolNotFound",
                "message": f"Herramienta '{tool_name}' no existe en el registro OSINT de MarkOS.",
                "available_tools": [t["function"]["name"] for t in OSINT_TOOL_DEFINITIONS],
                "data": {},
                "metrics": {
                    "duration_ms": int((time.time() - start) * 1000),
                    "records_processed": 0
                }
            }

    except Exception as e:
        return {
            "status": "error",
            "module": tool_name,
            "error_type": type(e).__name__,
            "message": f"Excepción contenida en {tool_name}: {str(e)}",
            "data": {},
            "metrics": {
                "duration_ms": int((time.time() - start) * 1000),
                "records_processed": 0
            }
        }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="MarkOS Generic OSINT Tool Registry & Dispatcher")
    parser.add_argument("--list-tools", action="store_true", help="Listar esquemas JSON de herramientas")
    parser.add_argument("--call", help="Nombre de la herramienta a invocar")
    parser.add_argument("--args", default="{}", help="Argumentos JSON")
    args = parser.parse_args()

    if args.list_tools:
        print(json.dumps(OSINT_TOOL_DEFINITIONS, indent=2, ensure_ascii=False))
        return

    if args.call:
        try:
            parsed_args = json.loads(args.args)
        except json.JSONDecodeError as err:
            print(json.dumps({"status": "error", "message": f"JSON inválido: {err}"}))
            return

        res = dispatch_osint_tool(args.call, parsed_args)
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
