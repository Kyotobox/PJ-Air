#!/usr/bin/env python3
"""
audit_contrast.py — WCAG 2.1 AA Visual Contrast and Legibility Auditor (§55).

Analyzes design tokens, theme color schemas, and color pairs to verify compliance
with WCAG 2.1 AA (and AAA) contrast ratios.

Usage:
  python3 audit_contrast.py --input tokens.json
  python3 audit_contrast.py --fg "#FFFFFF" --bg "#003366"
  python3 audit_contrast.py --input tokens.json --preflight
  python3 audit_contrast.py --input tokens.json --level AAA
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from typing import Any, Dict, List, Optional, Tuple

# Pre-defined WCAG minimum contrast thresholds
WCAG_LEVELS: Dict[str, float] = {
    "AA": 4.5,        # WCAG 2.1 AA normal text (minimum 4.5:1)
    "AA-LARGE": 3.0,  # WCAG 2.1 AA large text (minimum 3.0:1)
    "UI": 3.0,        # WCAG 2.1 AA UI components & graphic elements (3.0:1)
    "AAA": 7.0,       # WCAG 2.1 AAA enhanced normal text (7.0:1)
    "AAA-LARGE": 4.5, # WCAG 2.1 AAA enhanced large text (4.5:1)
}

NAMED_COLORS: Dict[str, Tuple[int, int, int]] = {
    "black": (0, 0, 0),
    "white": (255, 255, 255),
    "red": (255, 0, 0),
    "green": (0, 128, 0),
    "blue": (0, 0, 255),
    "yellow": (255, 255, 0),
    "cyan": (0, 255, 255),
    "magenta": (255, 0, 255),
    "gray": (128, 128, 128),
    "grey": (128, 128, 128),
    "lightgray": (211, 211, 211),
    "lightgrey": (211, 211, 211),
    "darkgray": (169, 169, 169),
    "darkgrey": (169, 169, 169),
}


class ColorParseError(ValueError):
    """Raised when a color string cannot be parsed into an sRGB tuple."""
    pass


def parse_color(color_str: str) -> Tuple[int, int, int]:
    """
    Parses a color string into an (R, G, B) tuple of ints in [0, 255].
    Supports hex codes (#RGB, #RRGGBB, #RRGGBBAA), rgb(r, g, b) and named colors.
    """
    if not isinstance(color_str, str):
        raise ColorParseError(f"Valor de color no es un string: {repr(color_str)}")

    raw = color_str.strip()
    if not raw:
        raise ColorParseError("String de color vacío.")

    lower = raw.lower()
    if lower in NAMED_COLORS:
        return NAMED_COLORS[lower]

    # Hex formats: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
    if raw.startswith("#"):
        hex_digits = raw[1:]
        if not re.fullmatch(r"[0-9a-fA-F]+", hex_digits):
            raise ColorParseError(f"Formato hexadecimal no válido: {raw}")

        length = len(hex_digits)
        if length == 3:  # #RGB
            r = int(hex_digits[0] * 2, 16)
            g = int(hex_digits[1] * 2, 16)
            b = int(hex_digits[2] * 2, 16)
            return (r, g, b)
        elif length == 4:  # #RGBA
            r = int(hex_digits[0] * 2, 16)
            g = int(hex_digits[1] * 2, 16)
            b = int(hex_digits[2] * 2, 16)
            return (r, g, b)
        elif length == 6:  # #RRGGBB
            r = int(hex_digits[0:2], 16)
            g = int(hex_digits[2:4], 16)
            b = int(hex_digits[4:6], 16)
            return (r, g, b)
        elif length == 8:  # #RRGGBBAA
            r = int(hex_digits[0:2], 16)
            g = int(hex_digits[2:4], 16)
            b = int(hex_digits[4:6], 16)
            return (r, g, b)
        else:
            raise ColorParseError(f"Longitud de código hexadecimal inválida ({length}): {raw}")

    # rgb(r, g, b) or rgba(r, g, b, a)
    rgb_match = re.match(
        r"^rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)$",
        raw,
        re.IGNORECASE,
    )
    if rgb_match:
        r = int(rgb_match.group(1))
        g = int(rgb_match.group(2))
        b = int(rgb_match.group(3))
        if 0 <= r <= 255 and 0 <= g <= 255 and 0 <= b <= 255:
            return (r, g, b)
        raise ColorParseError(f"Canales RGB fuera de rango [0, 255]: {raw}")

    raise ColorParseError(f"Formato de color no reconocido: {raw}")


def srgb_channel_to_linear(channel: int) -> float:
    """
    Converts an sRGB 8-bit integer channel in [0, 255] to linear luminance component.
    Implements WCAG 2.1 specification for sRGB linearization.
    """
    c = channel / 255.0
    if c <= 0.04045:
        return c / 12.92
    return math.pow((c + 0.055) / 1.055, 2.4)


def relative_luminance(rgb: Tuple[int, int, int]) -> float:
    """
    Calculates WCAG 2.1 relative luminance for an sRGB color tuple.
    L = 0.2126 * R + 0.7152 * G + 0.0722 * B
    """
    r_lin = srgb_channel_to_linear(rgb[0])
    g_lin = srgb_channel_to_linear(rgb[1])
    b_lin = srgb_channel_to_linear(rgb[2])
    return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin


def calculate_contrast_ratio(
    fg_rgb: Tuple[int, int, int], bg_rgb: Tuple[int, int, int]
) -> Tuple[float, float, float]:
    """
    Calculates the WCAG contrast ratio between foreground and background.
    Formula: (L1 + 0.05) / (L2 + 0.05) where L1 is lighter and L2 is darker.
    Returns (contrast_ratio, fg_luminance, bg_luminance).
    """
    fg_lum = relative_luminance(fg_rgb)
    bg_lum = relative_luminance(bg_rgb)
    l_max = max(fg_lum, bg_lum)
    l_min = min(fg_lum, bg_lum)
    ratio = (l_max + 0.05) / (l_min + 0.05)
    return round(ratio, 2), fg_lum, bg_lum


class ColorPairRecord:
    """Represents an evaluated pair of foreground and background colors."""

    def __init__(
        self,
        name: str,
        foreground_raw: str,
        background_raw: str,
        category: str = "text",
    ):
        self.name = name
        self.foreground_raw = foreground_raw
        self.background_raw = background_raw
        self.category = category
        self.fg_rgb: Optional[Tuple[int, int, int]] = None
        self.bg_rgb: Optional[Tuple[int, int, int]] = None
        self.contrast_ratio: float = 0.0
        self.fg_luminance: float = 0.0
        self.bg_luminance: float = 0.0
        self.status: str = "PENDING"
        self.error_message: Optional[str] = None

    def evaluate(self, threshold: float, wcag_level: str) -> bool:
        """Evaluates contrast ratio against threshold. Returns True if compliant."""
        try:
            self.fg_rgb = parse_color(self.foreground_raw)
            self.bg_rgb = parse_color(self.background_raw)
            self.contrast_ratio, self.fg_luminance, self.bg_luminance = (
                calculate_contrast_ratio(self.fg_rgb, self.bg_rgb)
            )

            if self.contrast_ratio >= threshold:
                self.status = "PASS"
                return True
            else:
                self.status = "CONTRAST_DEFICIT"
                return False
        except ColorParseError as err:
            self.status = "PARSE_ERROR"
            self.error_message = str(err)
            return False

    def to_dict(self, threshold: float, wcag_level: str) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "name": self.name,
            "status": self.status,
            "foreground": self.foreground_raw,
            "background": self.background_raw,
            "contrast_ratio": self.contrast_ratio,
            "required_threshold": threshold,
            "wcag_level": wcag_level,
            "category": self.category,
            "fg_luminance": round(self.fg_luminance, 4),
            "bg_luminance": round(self.bg_luminance, 4),
        }
        if self.status == "CONTRAST_DEFICIT":
            data["message"] = (
                f"Contrast ratio {self.contrast_ratio:.2f}:1 is below "
                f"the required WCAG 2.1 {wcag_level} threshold of {threshold:.1f}:1"
            )
        elif self.status == "PARSE_ERROR":
            data["message"] = self.error_message or "Error parsing color"
        return data


def extract_pairs_from_data(data: Any) -> List[ColorPairRecord]:
    """
    Extracts ColorPairRecord objects from various token / schema data structures:
    - Array of pair objects: [{"fg": ..., "bg": ..., "name": ...}]
    - Map of pair objects: {"pair_name": {"foreground": ..., "background": ...}}
    - Theme trees with 'pairs' key
    - Color dictionaries with conventional pairing (e.g. text & background)
    """
    records: List[ColorPairRecord] = []

    # Case 1: Direct list
    if isinstance(data, list):
        for idx, item in enumerate(data):
            if isinstance(item, dict):
                fg = item.get("foreground") or item.get("fg") or item.get("text") or item.get("color")
                bg = item.get("background") or item.get("bg") or item.get("surface") or item.get("bg_color")
                name = item.get("name") or item.get("id") or item.get("label") or f"pair_{idx + 1}"
                cat = item.get("category") or "text"
                if fg and bg:
                    records.append(ColorPairRecord(str(name), str(fg), str(bg), str(cat)))

    # Case 2: Dictionary
    elif isinstance(data, dict):
        # Subcase 2a: Contains explicit 'pairs' list
        if "pairs" in data and isinstance(data["pairs"], list):
            return extract_pairs_from_data(data["pairs"])

        # Subcase 2b: Nested theme with 'pairs'
        if "theme" in data and isinstance(data["theme"], dict):
            if "pairs" in data["theme"]:
                return extract_pairs_from_data(data["theme"]["pairs"])

        # Subcase 2c: Map where each value is an object with explicit fg and bg
        has_pair_children = False
        for key, val in data.items():
            if isinstance(val, dict) and key.lower() not in ("colors", "palette", "theme"):
                fg = val.get("foreground") or val.get("fg")
                bg = val.get("background") or val.get("bg")
                if fg and bg:
                    has_pair_children = True
                    cat = val.get("category") or "text"
                    records.append(ColorPairRecord(str(key), str(fg), str(bg), str(cat)))

        # Subcase 2d: Flattened palette or tokens with conventional pairing
        if not has_pair_children:
            colors: Dict[str, str] = {}
            # Flatten or extract colors from data or nested colors/theme
            dict_sources = []
            if isinstance(data.get("colors"), dict):
                dict_sources.append(data["colors"])
            if isinstance(data.get("theme"), dict):
                if isinstance(data["theme"].get("colors"), dict):
                    dict_sources.append(data["theme"]["colors"])
                else:
                    dict_sources.append(data["theme"])
            if not dict_sources:
                dict_sources.append(data)

            for src in dict_sources:
                for k, v in src.items():
                    if isinstance(v, str):
                        colors[k.lower()] = v
                    elif isinstance(v, dict) and "$value" in v and isinstance(v["$value"], str):
                        colors[k.lower()] = v["$value"]

            # Conventional pairings
            pairings = [
                ("text", "background"),
                ("on_background", "background"),
                ("on_surface", "surface"),
                ("on_primary", "primary"),
                ("on_secondary", "secondary"),
                ("primary_text", "primary_bg"),
                ("body_text", "body_bg"),
                ("label", "input_bg"),
            ]
            for fg_key, bg_key in pairings:
                if fg_key in colors and bg_key in colors:
                    records.append(
                        ColorPairRecord(
                            f"{fg_key}_on_{bg_key}",
                            colors[fg_key],
                            colors[bg_key],
                            "token_convention",
                        )
                    )

    return records


def run_preflight_linter(
    pairs: List[ColorPairRecord], raw_data: Any
) -> Tuple[bool, List[str], Dict[str, Any]]:
    """
    Performs pre-flight structural and syntactic verification.
    Validates token definitions, hex color codes, and schemas.
    """
    issues: List[str] = []

    if not pairs:
        issues.append(
            "Estructura inválida o sin pares de color detectables en los datos de entrada."
        )

    for p in pairs:
        # Check foreground
        try:
            parse_color(p.foreground_raw)
        except ColorParseError as err:
            issues.append(f"Par [{p.name}]: Color de primer plano inválido: {err}")

        # Check background
        try:
            parse_color(p.background_raw)
        except ColorParseError as err:
            issues.append(f"Par [{p.name}]: Color de fondo inválido: {err}")

    passed = len(issues) == 0
    report = {
        "status": "PASS" if passed else "PREFLIGHT_DEFICIT",
        "preflight": "OK" if passed else "FAILED",
        "valid": passed,
        "total_pairs_detected": len(pairs),
        "issues_count": len(issues),
        "issues": issues,
    }
    return passed, issues, report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="WCAG 2.1 Visual Contrast & Legibility Auditor (§55)"
    )
    parser.add_argument(
        "--input",
        "-i",
        type=str,
        help="Ruta al archivo JSON de tokens o paleta de colores (o '-' para stdin).",
    )
    parser.add_argument(
        "--fg",
        type=str,
        help="Color de primer plano (evaluación rápida de un solo par).",
    )
    parser.add_argument(
        "--bg",
        type=str,
        help="Color de fondo (evaluación rápida de un solo par).",
    )
    parser.add_argument(
        "--name",
        type=str,
        default="cli_pair",
        help="Nombre identificador para el par de colores inline.",
    )
    parser.add_argument(
        "--threshold",
        "-t",
        type=float,
        default=None,
        help="Ratio numérico mínimo de contraste requerido (por defecto 4.5 para AA normal).",
    )
    parser.add_argument(
        "--level",
        "-l",
        type=str,
        default="AA",
        choices=["AA", "AA-LARGE", "UI", "AAA", "AAA-LARGE"],
        help="Nivel WCAG requerido (AA=4.5, AA-LARGE=3.0, UI=3.0, AAA=7.0).",
    )
    parser.add_argument(
        "--preflight",
        "--lint",
        action="store_true",
        help="Ejecutar únicamente pre-flight linter sintáctico de tokens.",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        help="Ruta de archivo donde persistir el resultado JSON.",
    )
    parser.add_argument(
        "--format",
        "-f",
        type=str,
        default="json",
        choices=["json", "text"],
        help="Formato de salida (json o text).",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Imprimir diagnósticos adicionales a stderr.",
    )

    args = parser.parse_args()

    # Determine threshold
    level_normalized = args.level.upper()
    default_threshold = WCAG_LEVELS.get(level_normalized, 4.5)
    threshold = (
        float(args.threshold) if args.threshold is not None else default_threshold
    )

    if threshold <= 0.0:
        error_json = {
            "status": "ARGUMENT_ERROR",
            "message": f"El umbral de contraste debe ser estrictamente positivo: {threshold}",
        }
        sys.stderr.write(f"Error: {error_json['message']}\n")
        print(json.dumps(error_json, indent=2))
        return 2

    pairs: List[ColorPairRecord] = []
    raw_data: Any = None

    # Inline pair evaluation
    if args.fg and args.bg:
        pairs.append(
            ColorPairRecord(args.name, args.fg, args.bg, category="inline_cli")
        )

    # Input file or stdin evaluation
    elif args.input:
        if args.input == "-":
            try:
                raw_data = json.load(sys.stdin)
            except Exception as err:
                error_payload = {
                    "status": "INPUT_ERROR",
                    "message": f"Error decodificando JSON desde stdin: {err}",
                }
                print(json.dumps(error_payload, indent=2))
                return 2
        else:
            if not os.path.isfile(args.input):
                error_payload = {
                    "status": "INPUT_ERROR",
                    "message": f"Archivo de entrada no encontrado: {args.input}",
                }
                sys.stderr.write(f"Error: {error_payload['message']}\n")
                print(json.dumps(error_payload, indent=2))
                return 2

            try:
                with open(args.input, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
            except Exception as err:
                error_payload = {
                    "status": "INPUT_ERROR",
                    "message": f"Error decodificando archivo JSON {args.input}: {err}",
                }
                sys.stderr.write(f"Error: {error_payload['message']}\n")
                print(json.dumps(error_payload, indent=2))
                return 2

        pairs = extract_pairs_from_data(raw_data)
    else:
        error_payload = {
            "status": "ARGUMENT_ERROR",
            "message": "Se requiere especificar --input <archivo> o el par --fg y --bg.",
        }
        sys.stderr.write(f"Error: {error_payload['message']}\n")
        print(json.dumps(error_payload, indent=2))
        return 2

    # Pre-flight linter mode
    if args.preflight:
        linter_passed, issues, linter_report = run_preflight_linter(pairs, raw_data)
        out_str = json.dumps(linter_report, indent=2)
        if args.output:
            with open(args.output, "w", encoding="utf-8") as out_f:
                out_f.write(out_str + "\n")
        print(out_str)
        return 0 if linter_passed else 2

    # Check for empty pair set
    if not pairs:
        error_payload = {
            "status": "INPUT_ERROR",
            "message": "No se encontraron pares de colores analizables en la entrada proporcionada.",
        }
        print(json.dumps(error_payload, indent=2))
        return 2

    # Evaluate each pair
    evaluated_records: List[Dict[str, Any]] = []
    violations: List[Dict[str, Any]] = []
    passed_count = 0

    for pair in pairs:
        is_ok = pair.evaluate(threshold=threshold, wcag_level=level_normalized)
        pair_dict = pair.to_dict(threshold=threshold, wcag_level=level_normalized)
        evaluated_records.append(pair_dict)

        if is_ok:
            passed_count += 1
        else:
            violations.append(pair_dict)

    has_violations = len(violations) > 0
    top_status = "CONTRAST_DEFICIT" if has_violations else "PASS"
    verdict = "FAIL" if has_violations else "PASS"

    result_payload: Dict[str, Any] = {
        "status": top_status,
        "verdict": verdict,
        "wcag_level": level_normalized,
        "required_threshold": threshold,
        "total_pairs_evaluated": len(pairs),
        "violations_count": len(violations),
        "passed_count": passed_count,
        "violations": violations,
        "pairs": evaluated_records,
    }

    if args.format == "json":
        output_str = json.dumps(result_payload, indent=2)
    else:
        lines = [
            f"=== UI CONTRAST AUDIT REPORT ({level_normalized} >= {threshold:.1f}:1) ===",
            f"Verdict: {verdict} ({top_status})",
            f"Total evaluated: {len(pairs)} | Passed: {passed_count} | Violations: {len(violations)}",
            "",
        ]
        for p in evaluated_records:
            status_symbol = "✓" if p["status"] == "PASS" else "✗"
            lines.append(
                f"  [{status_symbol}] {p['name']}: {p['foreground']} on {p['background']} "
                f"-> Ratio {p['contrast_ratio']:.2f}:1 ({p['status']})"
            )
        output_str = "\n".join(lines)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as out_f:
            out_f.write(output_str + "\n")

    print(output_str)

    if args.verbose:
        sys.stderr.write(
            f"[UI-CONTRAST-SENTINEL] Evaluated {len(pairs)} pairs. Status: {top_status} "
            f"(Violations: {len(violations)})\n"
        )

    # Return exit code 1 if contrast deficit, 0 if pass
    return 1 if has_violations else 0


if __name__ == "__main__":
    sys.exit(main())
