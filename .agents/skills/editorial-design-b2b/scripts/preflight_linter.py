#!/usr/bin/env python3
"""
preflight_linter.py — Pre-Press Editorial SVG Pre-Flight & Contrast Linter CLI
Part of the editorial-design-b2b skill suite.

Capabilities:
1. Pre-press SVG scanning & validation.
2. Spurious raster detection: flags <image>, xlink:href, data:image/, or Base64
   unless explicitly authorized via --allow-photo.
3. WCAG 2.1 relative luminance (sRGB gamma expansion) & contrast matrix.
4. Ineludible Brand Veto: strict prohibition of high-luminance text (L > 0.70)
   on yellow backgrounds (L > 0.60) — PREFLIGHT_FAIL_CONTRAST_VIOLATION: WHITE_ON_YELLOW.
5. Contrast threshold verification: >= 4.5:1 for regular text, >= 3.0:1 for large text (>= 24pt).
6. Full CLI with --input, --json, --allow-photo, and embedded --test suite.
"""

import sys
import os
import re
import math
import time
import json
import argparse
import xml.etree.ElementTree as ET
from typing import List, Tuple, Dict, Any, Optional

# --- CANONICAL COLOR DEFINITIONS ---
COLOR_NAMES: Dict[str, Tuple[int, int, int]] = {
    'white': (255, 255, 255),
    'purewhite': (255, 255, 255),
    'black': (0, 0, 0),
    'pureblack': (0, 0, 0),
    'yellow': (255, 255, 0),
    'gold': (255, 215, 0),
    'goodyear-yellow': (255, 209, 0),    # #FFD100
    'goodyearyellow': (255, 209, 0),
    'navy': (0, 0, 128),
    'goodyear-navy': (0, 28, 77),        # #001C4D
    'goodyearnavy': (0, 28, 77),
    'silver': (192, 192, 192),
    'gray': (128, 128, 128),
    'grey': (128, 128, 128),
    'lightgray': (211, 211, 211),
    'lightgrey': (211, 211, 211),
    'darkgray': (169, 169, 169),
    'darkgrey': (169, 169, 169),
    'red': (255, 0, 0),
    'green': (0, 128, 0),
    'blue': (0, 0, 255),
    'cyan': (0, 255, 255),
    'magenta': (255, 0, 255),
    'orange': (255, 165, 0),
}

# --- COLOR & LUMINANCE MATHEMATICS ---

def parse_color(val: Optional[str]) -> Optional[Tuple[int, int, int]]:
    """Parse color string into (R, G, B) tuple in 0..255. Returns None if unparseable/none."""
    if not val:
        return None
    val = val.strip().lower()
    if val in ('none', 'transparent', 'inherit', 'initial'):
        return None
    
    # Named color lookup
    normalized_name = re.sub(r'[\s\-_]', '', val)
    if normalized_name in COLOR_NAMES:
        return COLOR_NAMES[normalized_name]
    if val in COLOR_NAMES:
        return COLOR_NAMES[val]
    
    # Hex color #RGB, #RGBA, #RRGGBB, #RRGGBBAA
    if val.startswith('#'):
        hex_str = val[1:]
        if len(hex_str) == 3:
            return (
                int(hex_str[0] * 2, 16),
                int(hex_str[1] * 2, 16),
                int(hex_str[2] * 2, 16)
            )
        elif len(hex_str) == 4:
            return (
                int(hex_str[0] * 2, 16),
                int(hex_str[1] * 2, 16),
                int(hex_str[2] * 2, 16)
            )
        elif len(hex_str) in (6, 8):
            return (
                int(hex_str[0:2], 16),
                int(hex_str[2:4], 16),
                int(hex_str[4:6], 16)
            )
    
    # rgb(...) or rgba(...)
    rgb_match = re.match(r'rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)', val)
    if rgb_match:
        return (
            max(0, min(255, int(rgb_match.group(1)))),
            max(0, min(255, int(rgb_match.group(2)))),
            max(0, min(255, int(rgb_match.group(3))))
        )
    
    return None

def srgb_channel_to_linear(c_norm: float) -> float:
    """Apply sRGB gamma expansion according to IEC 61966-2-1."""
    if c_norm <= 0.04045:
        return c_norm / 12.92
    return ((c_norm + 0.055) / 1.055) ** 2.4

def relative_luminance(rgb: Tuple[int, int, int]) -> float:
    """Calculate relative luminance L in [0.0, 1.0] with sRGB gamma correction."""
    r_lin = srgb_channel_to_linear(rgb[0] / 255.0)
    g_lin = srgb_channel_to_linear(rgb[1] / 255.0)
    b_lin = srgb_channel_to_linear(rgb[2] / 255.0)
    return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin

def contrast_ratio(l1: float, l2: float) -> float:
    """Compute WCAG 2.1 contrast ratio between two relative luminances."""
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

def is_yellow_tone(rgb: Tuple[int, int, int], luminance: float) -> bool:
    """
    Check if a color qualifies as a yellow hue in print/visual branding.
    Yellow characteristics:
    - High relative luminance (L > 0.60)
    - High Red (>= 160) and Green (>= 140)
    - Low Blue (<= 120)
    - Hue between 35 and 75 degrees in HSV space
    """
    if luminance <= 0.60:
        return False
    r, g, b = rgb
    if r < 150 or g < 130 or b > 140:
        return False
    
    # Calculate Hue
    rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
    cmax = max(rf, gf, bf)
    cmin = min(rf, gf, bf)
    delta = cmax - cmin
    if delta == 0:
        return False  # Neutral gray / pure white
    
    if cmax == rf:
        hue = 60.0 * (((gf - bf) / delta) % 6)
    elif cmax == gf:
        hue = 60.0 * (((bf - rf) / delta) + 2)
    else:
        hue = 60.0 * (((rf - gf) / delta) + 4)
    
    saturation = delta / cmax if cmax > 0 else 0
    return 30.0 <= hue <= 75.0 and saturation >= 0.35

def rgb_to_hex(rgb: Tuple[int, int, int]) -> str:
    """Convert RGB tuple to uppercase hex code."""
    return f"#{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}"

# --- SVG PREFLIGHT SCANNER ---

class PreflightLinter:
    def __init__(self, allow_photo: bool = False):
        self.allow_photo = allow_photo

    def extract_style_dict(self, style_str: Optional[str]) -> Dict[str, str]:
        """Parse CSS style attribute into a key-value dictionary."""
        styles: Dict[str, str] = {}
        if not style_str:
            return styles
        for part in style_str.split(';'):
            if ':' in part:
                k, v = part.split(':', 1)
                styles[k.strip().lower()] = v.strip()
        return styles

    def parse_font_size(self, size_val: Optional[str]) -> float:
        """Parse font-size attribute into approximate point size."""
        if not size_val:
            return 16.0  # default body size
        size_val = size_val.strip().lower()
        m = re.match(r'([\d.]+)\s*(pt|px|em|rem|%)?', size_val)
        if not m:
            return 16.0
        val = float(m.group(1))
        unit = m.group(2)
        if unit == 'pt':
            return val
        elif unit == 'px':
            # 1 pt = 1.333 px (72 pt / 96 px)
            return val * 0.75
        elif unit in ('em', 'rem'):
            return val * 12.0
        return val

    def resolve_element_fill(self, elem: ET.Element, ancestors: List[ET.Element]) -> Optional[Tuple[int, int, int]]:
        """Resolve fill color from element, its style, or inherited ancestors."""
        # Check direct style
        style = self.extract_style_dict(elem.get('style'))
        if 'fill' in style:
            col = parse_color(style['fill'])
            if col:
                return col
        # Check direct attribute
        if elem.get('fill'):
            col = parse_color(elem.get('fill'))
            if col:
                return col
        
        # Check ancestors in reverse (nearest parent first)
        for parent in reversed(ancestors):
            p_style = self.extract_style_dict(parent.get('style'))
            if 'fill' in p_style:
                col = parse_color(p_style['fill'])
                if col:
                    return col
            if parent.get('fill'):
                col = parse_color(parent.get('fill'))
                if col:
                    return col
        return None

    def scan_svg(self, svg_content: str) -> Dict[str, Any]:
        """
        Execute pre-flight scanning on raw SVG content string.
        Returns a structured dictionary with verdict, violations, and metrics.
        """
        start_time = time.time()
        violations: List[Dict[str, Any]] = []
        metrics: Dict[str, Any] = {
            'text_elements_checked': 0,
            'raster_elements_detected': 0,
            'min_contrast_ratio': None,
            'has_yellow_background': False,
        }

        # 1. Spurious Raster Scanning (String-level detection)
        raster_extensions = ('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff', '.gif')
        data_image_pattern = re.compile(r'data:image/[a-zA-Z0-9+\.-]+;base64,', re.IGNORECASE)
        has_base64_data = bool(data_image_pattern.search(svg_content))

        raster_nodes: List[str] = []
        if has_base64_data:
            raster_nodes.append("data:image/base64_string")
        if re.search(r'<image\b', svg_content, re.IGNORECASE):
            raster_nodes.append("<image> tag")

        # Normalize common undeclared namespaces in SVG (e.g. xlink)
        xml_to_parse = svg_content
        if 'xlink:' in xml_to_parse and 'xmlns:xlink' not in xml_to_parse:
            xml_to_parse = re.sub(r'<svg\b', '<svg xmlns:xlink="http://www.w3.org/1999/xlink"', xml_to_parse, count=1)

        # Check XML syntax
        try:
            root = ET.fromstring(xml_to_parse)
        except ET.ParseError as pe:
            # If raster was already detected, also report it
            if raster_nodes and not self.allow_photo:
                violations.append({
                    'code': 'PREFLIGHT_FAIL_RASTER_DETECTED',
                    'severity': 'FATAL',
                    'message': f"Spurious raster detected in SVG content.",
                    'details': {'total_detected': len(raster_nodes)},
                })
            violations.append({
                'code': 'PREFLIGHT_FAIL_XML_PARSE_ERROR',
                'severity': 'FATAL',
                'message': f"Malformed SVG XML: {pe}",
                'details': {'error': str(pe)},
            })
            exec_time_ms = int((time.time() - start_time) * 1000)
            return {
                'approved': False,
                'violations': violations,
                'metrics': metrics,
                'execution_time_ms': exec_time_ms,
            }

        # 2. Raster detection in parsed AST (<image>, href with bitmap extensions)
        for elem in root.iter():
            tag = elem.tag.split('}')[-1].lower()
            if tag == 'image':
                node_str = ET.tostring(elem, encoding='unicode').strip()[:100]
                if node_str not in raster_nodes:
                    raster_nodes.append(node_str)
            for attr_name, attr_val in elem.attrib.items():
                attr_lower = attr_val.lower().strip()
                if 'data:image/' in attr_lower or ';base64,' in attr_lower:
                    val_str = f"{attr_name}='{attr_val[:50]}...'"
                    if val_str not in raster_nodes:
                        raster_nodes.append(val_str)
                elif any(attr_lower.endswith(ext) or ext in attr_lower for ext in raster_extensions):
                    val_str = f"{attr_name}='{attr_val}'"
                    if val_str not in raster_nodes:
                        raster_nodes.append(val_str)

        metrics['raster_elements_detected'] = len(raster_nodes)

        if raster_nodes and not self.allow_photo:
            violations.append({
                'code': 'PREFLIGHT_FAIL_RASTER_DETECTED',
                'severity': 'FATAL',
                'message': (
                    f"Spurious raster or embedded bitmap detected ({len(raster_nodes)} occurrences). "
                    f"Editorial B2B print requires pure Bézier vector assets unless --allow-photo is explicitly granted."
                ),
                'details': {
                    'detected_elements': raster_nodes[:5],
                    'total_detected': len(raster_nodes),
                },
            })

        # 3. Collect Rectangles & Shape Backgrounds
        # Keep track of preceding background rectangles in document order
        background_rects: List[Dict[str, Any]] = []

        def get_clean_tag(e: ET.Element) -> str:
            return e.tag.split('}')[-1].lower()

        for elem in root.iter():
            tag = get_clean_tag(elem)
            if tag == 'rect':
                style = self.extract_style_dict(elem.get('style'))
                fill_str = style.get('fill') or elem.get('fill')
                fill_color = parse_color(fill_str)
                if fill_color:
                    lum = relative_luminance(fill_color)
                    is_yel = is_yellow_tone(fill_color, lum)
                    background_rects.append({
                        'element': elem,
                        'fill_rgb': fill_color,
                        'fill_hex': rgb_to_hex(fill_color),
                        'luminance': lum,
                        'is_yellow': is_yel,
                    })
                    if is_yel:
                        metrics['has_yellow_background'] = True

        # 4. Text Contrast & WCAG 2.1 Verification
        min_cr: Optional[float] = None

        # Helper to traverse with ancestors
        def process_node(node: ET.Element, ancestors: List[ET.Element], preceding_bg: Optional[Dict[str, Any]]):
            nonlocal min_cr
            tag = get_clean_tag(node)

            # Update preceding background if this node is a background rect
            current_bg = preceding_bg
            if tag == 'rect':
                style = self.extract_style_dict(node.get('style'))
                fill_str = style.get('fill') or node.get('fill')
                col = parse_color(fill_str)
                if col:
                    lum = relative_luminance(col)
                    current_bg = {
                        'fill_rgb': col,
                        'fill_hex': rgb_to_hex(col),
                        'luminance': lum,
                        'is_yellow': is_yellow_tone(col, lum),
                    }

            if tag in ('text', 'tspan'):
                # Extract text content
                raw_text = (node.text or '').strip()
                if raw_text:
                    metrics['text_elements_checked'] += 1

                    # Resolve text fill color
                    fg_color = self.resolve_element_fill(node, ancestors)
                    if not fg_color:
                        # SVG default text fill is black
                        fg_color = (0, 0, 0)

                    fg_hex = rgb_to_hex(fg_color)
                    fg_lum = relative_luminance(fg_color)

                    # Determine Background Color for this text
                    # Priority:
                    # 1. data-bg or data-background on text
                    # 2. current preceding rect
                    # 3. first background rect in document
                    # 4. Default print substrate: Pure White (255, 255, 255)
                    bg_info = None
                    direct_bg_attr = node.get('data-bg') or node.get('data-background') or node.get('data-bg-color')
                    if direct_bg_attr:
                        direct_col = parse_color(direct_bg_attr)
                        if direct_col:
                            d_lum = relative_luminance(direct_col)
                            bg_info = {
                                'fill_rgb': direct_col,
                                'fill_hex': rgb_to_hex(direct_col),
                                'luminance': d_lum,
                                'is_yellow': is_yellow_tone(direct_col, d_lum),
                            }

                    if not bg_info and current_bg:
                        bg_info = current_bg
                    elif not bg_info and background_rects:
                        bg_info = background_rects[0]
                    elif not bg_info:
                        # White paper substrate default
                        white_rgb = (255, 255, 255)
                        bg_info = {
                            'fill_rgb': white_rgb,
                            'fill_hex': '#FFFFFF',
                            'luminance': 1.0,
                            'is_yellow': False,
                        }

                    bg_color = bg_info['fill_rgb']
                    bg_hex = bg_info['fill_hex']
                    bg_lum = bg_info['luminance']
                    bg_is_yellow = bg_info['is_yellow']

                    cr = contrast_ratio(fg_lum, bg_lum)
                    if min_cr is None or cr < min_cr:
                        min_cr = cr

                    # Determine Font Size & Required Threshold
                    node_style = self.extract_style_dict(node.get('style'))
                    f_size_str = node_style.get('font-size') or node.get('font-size')
                    font_size = self.parse_font_size(f_size_str)
                    
                    is_bold = (node_style.get('font-weight') in ('bold', '700', '800', '900') or
                               node.get('font-weight') in ('bold', '700', '800', '900'))

                    # WCAG 2.1 threshold:
                    # Large text is >= 24pt (or >= 18pt bold) -> threshold is 3.0:1
                    # Regular text -> threshold is 4.5:1
                    threshold = 3.0 if (font_size >= 24.0 or (is_bold and font_size >= 18.0)) else 4.5

                    # --- INELUDIBLE BRAND VETO: WHITE ON YELLOW ---
                    # High luminance text (L > 0.70) on Yellow background (L > 0.60)
                    if fg_lum > 0.70 and bg_is_yellow:
                        violations.append({
                            'code': 'PREFLIGHT_FAIL_CONTRAST_VIOLATION: WHITE_ON_YELLOW',
                            'severity': 'FATAL',
                            'message': (
                                f"[PREFLIGHT_FAIL_CONTRAST_VIOLATION: WHITE_ON_YELLOW] Ineludible Brand Veto: "
                                f"High-luminance text '{raw_text[:30]}' ({fg_hex}, L={fg_lum:.4f}) on yellow background "
                                f"({bg_hex}, L={bg_lum:.4f}) produces illegibility and misregistration in print."
                            ),
                            'details': {
                                'text_snippet': raw_text[:50],
                                'text_color': fg_hex,
                                'text_luminance': round(fg_lum, 4),
                                'background_color': bg_hex,
                                'background_luminance': round(bg_lum, 4),
                                'contrast_ratio': round(cr, 2),
                                'font_size': font_size,
                            },
                        })
                    elif cr < threshold:
                        violations.append({
                            'code': 'PREFLIGHT_FAIL_CONTRAST_VIOLATION: LOW_CONTRAST',
                            'severity': 'FATAL',
                            'message': (
                                f"[PREFLIGHT_FAIL_CONTRAST_VIOLATION: LOW_CONTRAST] Contrast ratio {cr:.2f}:1 "
                                f"for text '{raw_text[:30]}' is below the required {threshold:.1f}:1 threshold "
                                f"(Foreground: {fg_hex}, Background: {bg_hex})."
                            ),
                            'details': {
                                'text_snippet': raw_text[:50],
                                'text_color': fg_hex,
                                'text_luminance': round(fg_lum, 4),
                                'background_color': bg_hex,
                                'background_luminance': round(bg_lum, 4),
                                'contrast_ratio': round(cr, 2),
                                'required_threshold': threshold,
                                'font_size': font_size,
                            },
                        })

            # Traverse child nodes
            for child in node:
                process_node(child, ancestors + [node], current_bg)

        # Run hierarchical traversal
        process_node(root, [], None)

        if min_cr is not None:
            metrics['min_contrast_ratio'] = round(min_cr, 2)

        approved = len(violations) == 0
        exec_time_ms = int((time.time() - start_time) * 1000)

        return {
            'approved': approved,
            'violations': violations,
            'metrics': metrics,
            'execution_time_ms': exec_time_ms,
        }

# --- EMBEDDED UNIT TEST SUITE ---

def run_tests() -> None:
    """Execute the full embedded test suite validating happy and sad paths."""
    print("=== RUNNING PREFLIGHT LINTER UNIT TEST SUITE ===")
    tests_run = 0
    tests_passed = 0

    def assert_true(cond: bool, desc: str) -> None:
        nonlocal tests_run, tests_passed
        tests_run += 1
        if cond:
            tests_passed += 1
            print(f"  [PASS] {desc}")
        else:
            print(f"  [FAIL] {desc}")
            sys.exit(1)

    linter = PreflightLinter()

    # --- HAPPY PATH 1: Goodyear Yellow on Navy (11.29:1) ---
    svg_yellow_on_navy = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="#001C4D" />
      <text x="100" y="100" fill="#FFD100" font-size="28">GOODYEAR PERFORMANCE</text>
    </svg>
    """
    res1 = linter.scan_svg(svg_yellow_on_navy)
    assert_true(res1['approved'] is True, "Happy Path 1: Yellow on Navy passes preflight approval.")
    assert_true(len(res1['violations']) == 0, "Happy Path 1: 0 violations detected.")
    assert_true(res1['metrics']['min_contrast_ratio'] >= 10.0, "Happy Path 1: High contrast ratio >= 10.0:1.")

    # --- HAPPY PATH 2: Pure White on Navy (16.49:1) ---
    svg_white_on_navy = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="#001C4D" />
      <text x="100" y="100" fill="#FFFFFF" font-size="16">Commercial Fleet Technical Specs</text>
    </svg>
    """
    res2 = linter.scan_svg(svg_white_on_navy)
    assert_true(res2['approved'] is True, "Happy Path 2: White on Navy passes preflight approval.")
    assert_true(res2['metrics']['min_contrast_ratio'] >= 15.0, "Happy Path 2: Contrast ratio >= 15.0:1.")

    # --- HAPPY PATH 3: Navy on Goodyear Yellow (11.29:1) ---
    svg_navy_on_yellow = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="#FFD100" />
      <text x="100" y="100" fill="#001C4D" font-size="24">ENGINEERED FOR EXCELLENCE</text>
    </svg>
    """
    res3 = linter.scan_svg(svg_navy_on_yellow)
    assert_true(res3['approved'] is True, "Happy Path 3: Navy on Yellow passes preflight approval.")
    assert_true(len(res3['violations']) == 0, "Happy Path 3: 0 violations detected.")

    # --- HAPPY PATH 4: Photo allowed with --allow-photo ---
    linter_with_photo = PreflightLinter(allow_photo=True)
    svg_with_photo = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="#001C4D" />
      <image href="assets/tire_hero.png" width="400" height="400" />
      <text x="100" y="100" fill="#FFFFFF" font-size="24">Hero Tire</text>
    </svg>
    """
    res4 = linter_with_photo.scan_svg(svg_with_photo)
    assert_true(res4['approved'] is True, "Happy Path 4: Raster allowed with --allow-photo.")

    # --- SAD PATH 1: Spurious Raster Detected (<image> / Base64) ---
    svg_spurious_raster = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="#001C4D" />
      <image xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" width="50" height="50" />
      <text x="100" y="100" fill="#FFD100" font-size="20">Illegal Raster Ingot</text>
    </svg>
    """
    res_sad1 = linter.scan_svg(svg_spurious_raster)
    assert_true(res_sad1['approved'] is False, "Sad Path 1: Spurious raster is rejected.")
    codes_sad1 = [v['code'] for v in res_sad1['violations']]
    assert_true('PREFLIGHT_FAIL_RASTER_DETECTED' in codes_sad1,
                "Sad Path 1: PREFLIGHT_FAIL_RASTER_DETECTED code emitted.")

    # --- SAD PATH 2: White on Yellow Veto (Fatal Brand Violation) ---
    svg_white_on_yellow = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="#FFD100" />
      <text x="100" y="100" fill="#FFFFFF" font-size="26">CRITICAL BRAND FAILURE</text>
    </svg>
    """
    res_sad2 = linter.scan_svg(svg_white_on_yellow)
    assert_true(res_sad2['approved'] is False, "Sad Path 2: White on Yellow is rejected.")
    codes_sad2 = [v['code'] for v in res_sad2['violations']]
    assert_true('PREFLIGHT_FAIL_CONTRAST_VIOLATION: WHITE_ON_YELLOW' in codes_sad2,
                "Sad Path 2: Ineludible Brand Veto PREFLIGHT_FAIL_CONTRAST_VIOLATION: WHITE_ON_YELLOW triggered.")

    # --- SAD PATH 3: Low Contrast (< 3.0:1) ---
    svg_low_contrast = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="#666666" />
      <text x="100" y="100" fill="#777777" font-size="16">Illegible Dark Gray Text</text>
    </svg>
    """
    res_sad3 = linter.scan_svg(svg_low_contrast)
    assert_true(res_sad3['approved'] is False, "Sad Path 3: Low contrast is rejected.")
    codes_sad3 = [v['code'] for v in res_sad3['violations']]
    assert_true('PREFLIGHT_FAIL_CONTRAST_VIOLATION: LOW_CONTRAST' in codes_sad3,
                "Sad Path 3: PREFLIGHT_FAIL_CONTRAST_VIOLATION: LOW_CONTRAST emitted.")

    # --- SAD PATH 4: Malformed XML ---
    res_sad4 = linter.scan_svg("<svg><rect>unclosed</svg>")
    assert_true(res_sad4['approved'] is False, "Sad Path 4: Malformed XML fails approval.")
    assert_true(res_sad4['violations'][0]['code'] == 'PREFLIGHT_FAIL_XML_PARSE_ERROR',
                "Sad Path 4: PREFLIGHT_FAIL_XML_PARSE_ERROR reported.")

    print(f"\n[ALL TESTS PASSED] {tests_passed}/{tests_run} tests verified exit code 0.")
    sys.exit(0)

# --- CLI ENTRYPOINT ---

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Pre-press SVG Pre-Flight & WCAG Contrast Linter for Editorial Design B2B."
    )
    parser.add_argument("--input", "-i", help="Path to input SVG file or inline SVG XML string.")
    parser.add_argument("--json", action="store_true", help="Emit structured JSON verdict.")
    parser.add_argument("--allow-photo", action="store_true", help="Authorize photographic raster bitmaps.")
    parser.add_argument("--test", action="store_true", help="Run embedded unit test suite and exit.")

    args = parser.parse_args()

    if args.test:
        run_tests()
        return

    if not args.input:
        parser.error("Argument --input is required (or run with --test).")

    raw_input = args.input
    svg_content = ""

    if os.path.isfile(raw_input):
        try:
            with open(raw_input, "r", encoding="utf-8") as f:
                svg_content = f.read()
        except Exception as e:
            err_dict = {
                'approved': False,
                'violations': [{
                    'code': 'PREFLIGHT_FAIL_FILE_READ_ERROR',
                    'severity': 'FATAL',
                    'message': f"Cannot read input file '{raw_input}': {e}",
                    'details': {'path': raw_input, 'error': str(e)},
                }],
                'metrics': {},
                'execution_time_ms': 0,
            }
            if args.json:
                print(json.dumps(err_dict, indent=2))
            else:
                sys.stderr.write(f"Error reading file '{raw_input}': {e}\n")
            sys.exit(1)
    else:
        svg_content = raw_input

    linter = PreflightLinter(allow_photo=args.allow_photo)
    result = linter.scan_svg(svg_content)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        if result['approved']:
            min_cr = result['metrics'].get('min_contrast_ratio', 'N/A')
            print(f"[PREFLIGHT_APPROVED] Pre-press SVG audit passed (0 violations). Min contrast: {min_cr}:1.")
        else:
            print(f"[PREFLIGHT_REJECTED] {len(result['violations'])} pre-flight violation(s) detected:")
            for v in result['violations']:
                sys.stderr.write(f"  - [{v['code']}] {v['message']}\n")

    sys.exit(0 if result['approved'] else 1)

if __name__ == "__main__":
    main()
