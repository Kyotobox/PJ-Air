#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MarkOS Generic OSINT: Extracción de Directorios de Nicho y Turismo de Alto Ticket.

Prospección genérica de negocios locales, bodegas, venues, hoteles boutique o
proveedores de servicios por región/sector comercial.
Contrato de salida estándar MarkOS: {"status": "success|error", "module": "...", "data": [...], "meta": {...}}
"""

import os
import sys
import json
import re
import time
import urllib.request
import urllib.error
from typing import Dict, Any, List

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36 MarkOS/1.0"
    ),
    "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Catálogo canónico de referencia multi-sector (Zero-Crash Fallback)
FALLBACK_DIRECTORIES = {
    "venues_wineries": [
        {
            "name": "Stone Tower Winery & Events",
            "category": "Winery / Wedding Venue",
            "location": "Leesburg, VA",
            "phone": "(703) 777-2797",
            "contact_email": "events@stonetowerwinery.com",
            "website": "https://www.stonetowerwinery.com",
            "opportunity": "Eventos corporativos, bodas masivas y transporte de grupos"
        },
        {
            "name": "Breaux Vineyards",
            "category": "Winery & Estate",
            "location": "Purcellville, VA",
            "phone": "(540) 668-6299",
            "contact_email": "privateevents@breauxvineyards.com",
            "website": "https://www.breauxvineyards.com",
            "opportunity": "Catas privadas y turismo de fin de semana"
        },
        {
            "name": "Chrysalis Vineyards",
            "category": "Vineyard & Ag District",
            "location": "Middleburg, VA",
            "phone": "(540) 687-8222",
            "contact_email": "info@chrysaliswine.com",
            "website": "https://www.chrysaliswine.com",
            "opportunity": "Rutas panorámicas y retiros campestres"
        }
    ],
    "hospitality_b2b": [
        {
            "name": "Tysons Corner Marriott",
            "category": "Corporate Hotel & Convention Center",
            "location": "Tysons, VA",
            "phone": "(703) 734-3200",
            "contact_email": "tysons.sales@marriott.com",
            "website": "https://www.marriott.com",
            "opportunity": "Convenios comerciales corporativos y traslados ejecutivos"
        },
        {
            "name": "Hyatt Regency Dulles",
            "category": "Airport & Conference Hotel",
            "location": "Herndon / Dulles, VA",
            "phone": "(703) 713-1234",
            "contact_email": "dulle-sales@hyatt.com",
            "website": "https://www.hyatt.com",
            "opportunity": "Tripulaciones, congresos internacionales y enlaces aeroportuarios"
        }
    ]
}


def extract_emails(text: str) -> List[str]:
    """Extrae emails descartando extensiones de recursos estáticos."""
    pattern = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"
    matches = re.findall(pattern, text)
    return [m for m in set(matches) if not m.lower().endswith((".png", ".jpg", ".webp", ".js", ".css"))]


def extract_phone(text: str) -> str:
    """Extrae teléfonos estándar estadounidenses o internacionales."""
    pattern = r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}"
    match = re.search(pattern, text)
    return match.group(0).strip() if match else ""


def scrape_site_contacts(url: str) -> Dict[str, Any]:
    """Inspecciona una URL pública extrayendo enlaces mailto y teléfonos con biblioteca estándar."""
    contact_info = {"phone": "", "contact_email": ""}
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                raw_text = resp.read().decode("utf-8", errors="ignore")
                
                # Búsqueda de enlaces mailto vía regex
                mailto_links = re.findall(r'href=["\']mailto:([^"?\'\s]+)', raw_text)
                text_emails = extract_emails(raw_text)
                
                all_emails = list(dict.fromkeys(mailto_links + text_emails))
                contact_info["contact_email"] = all_emails[0] if all_emails else ""
                contact_info["phone"] = extract_phone(raw_text)
    except Exception:
        pass

    return contact_info


def fetch_niche_directory(category: str = "venues_wineries", location_filter: str = None, enrich: bool = False) -> Dict[str, Any]:
    """Obtiene contactos estructurados de un nicho comercial específico."""
    try:
        catalog = FALLBACK_DIRECTORIES.get(category, FALLBACK_DIRECTORIES["venues_wineries"])
        results = []
        loc_norm = location_filter.strip().lower() if location_filter else None

        for item in catalog:
            entry = dict(item)

            if loc_norm and loc_norm not in entry["location"].lower():
                continue

            if enrich and entry.get("website"):
                scraped = scrape_site_contacts(entry["website"])
                if scraped.get("contact_email"):
                    entry["contact_email"] = scraped["contact_email"]
                if scraped.get("phone"):
                    entry["phone"] = scraped["phone"]
                time.sleep(1.0)

            results.append(entry)

        return {
            "status": "success",
            "module": "niche_directory",
            "data": results,
            "meta": {
                "category": category,
                "total_count": len(results),
                "enriched": enrich,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
        }

    except Exception as e:
        return {
            "status": "error",
            "module": "niche_directory",
            "error_type": type(e).__name__,
            "message": str(e),
            "data": []
        }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="MarkOS Generic OSINT Niche Directory Scraper")
    parser.add_argument("--category", default="venues_wineries", choices=["venues_wineries", "hospitality_b2b"], help="Categoría comercial")
    parser.add_argument("--location", help="Filtro opcional por ubicación/ciudad")
    parser.add_argument("--enrich", action="store_true", help="Habilitar scraping en vivo de sitios web")
    args = parser.parse_args()

    payload = fetch_niche_directory(category=args.category, location_filter=args.location, enrich=args.enrich)
    print(json.dumps(payload, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
