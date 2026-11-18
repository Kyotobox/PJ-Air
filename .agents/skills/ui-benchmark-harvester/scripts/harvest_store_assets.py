import json
import urllib.request
import urllib.parse
from typing import Dict, List, Any, Optional

class StoreAssetHarvester:
    """
    Extractor de activos visuales y capturas oficiales de aplicaciones móviles
    utilizando las APIs públicas y abiertas de tiendas de aplicaciones (iTunes Search API).
    Cero scrapers no autorizados, cero paywalls.
    """

    BASE_URL = "https://itunes.apple.com/search"

    def __init__(self, country: str = "us", timeout: int = 10):
        self.country = country
        self.timeout = timeout

    def build_query_url(self, app_name: str, limit: int = 5) -> str:
        if not app_name or not app_name.strip():
            raise ValueError("El nombre de la aplicación no puede estar vacío.")
        
        params = {
            "term": app_name.strip(),
            "entity": "software",
            "country": self.country,
            "limit": limit
        }
        return f"{self.BASE_URL}?{urllib.parse.urlencode(params)}"

    def parse_store_response(self, raw_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Procesa el payload JSON de la API pública y extrae la metadata y URLs de capturas en alta resolución.
        """
        if not raw_data or "results" not in raw_data:
            return []

        results = []
        for item in raw_data.get("results", []):
            screenshots = item.get("screenshotUrls", [])
            ipad_screenshots = item.get("ipadScreenshotUrls", [])
            all_screens = screenshots + ipad_screenshots

            results.append({
                "app_name": item.get("trackName", "Unknown App"),
                "bundle_id": item.get("bundleId", ""),
                "developer": item.get("artistName", ""),
                "rating": item.get("averageUserRating", 0.0),
                "icon_url": item.get("artworkUrl512", item.get("artworkUrl100", "")),
                "screenshots_count": len(all_screens),
                "screenshots": all_screens,
                "genres": item.get("genres", []),
            })
        return results

    def harvest(self, app_name: str, limit: int = 5) -> List[Dict[str, Any]]:
        url = self.build_query_url(app_name, limit=limit)
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "ConextFleetScout/1.0"}
            )
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return self.parse_store_response(data)
        except Exception as e:
            # Fallback seguro ante indisponibilidad de red
            return []

if __name__ == "__main__":
    import sys
    term = sys.argv[1] if len(sys.argv) > 1 else "Uber"
    harvester = StoreAssetHarvester()
    print(json.dumps(harvester.harvest(term, limit=1), indent=2))
