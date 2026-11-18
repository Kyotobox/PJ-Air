#!/usr/bin/env python3
"""
normalize_vector_asset.py — Bounding Box Sanitization & Coordinate Normalization CLI
Part of the editorial-design-b2b skill suite.

Features:
- Parse SVG path 'd' attributes from SVGs, text files, or raw strings.
- Compute mathematically exact bounding boxes (xmin, ymin, xmax, ymax, w, h)
  for straight lines, cubic Béziers, quadratic Béziers, and elliptical arcs.
- Translate coordinates so (xmin, ymin) strictly starts at (0, 0).
- Produce isolated SVG outputs with viewBox="0 0 w h" to eliminate layer collisions.
- CLI supporting --input, --output, --path-only, --json-meta, and embedded --test.
"""

import sys
import os
import re
import math
import json
import argparse
import xml.etree.ElementTree as ET
from typing import List, Tuple, Dict, Any, Optional

class SVGPathError(ValueError):
    """Raised when an SVG path is malformed, empty, or contains invalid syntax."""
    pass

COMMAND_PARAM_COUNTS = {
    'M': 2, 'm': 2,
    'L': 2, 'l': 2,
    'H': 1, 'h': 1,
    'V': 1, 'v': 1,
    'C': 6, 'c': 6,
    'S': 4, 's': 4,
    'Q': 4, 'q': 4,
    'T': 2, 't': 2,
    'A': 7, 'a': 7,
    'Z': 0, 'z': 0,
}

def fmt_coord(v: float) -> str:
    """Format floating point numbers cleanly without floating point inaccuracies."""
    rounded = round(v, 4)
    res = f"{rounded:.4f}".rstrip('0').rstrip('.')
    if res in ("-0", "-0.0", ""):
        return "0"
    return res

def tokenize_path(d: str) -> List[Tuple[str, Any]]:
    """Tokenize an SVG path string into commands, numbers, or invalid tokens."""
    if not d or not d.strip():
        raise SVGPathError("SVG path data is empty or whitespace-only.")
    
    token_re = re.compile(
        r'([MmLlHhVvCcSsQqTtAaZz])|'
        r'([-+]?(?:(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?))|'
        r'([^\s,]+)'
    )
    tokens: List[Tuple[str, Any]] = []
    for m in token_re.finditer(d):
        cmd, num, invalid = m.groups()
        if cmd:
            tokens.append(('CMD', cmd))
        elif num:
            tokens.append(('NUM', float(num)))
        elif invalid:
            raise SVGPathError(f"Unexpected or invalid token in SVG path: '{invalid}'")
            
    if not tokens:
        raise SVGPathError("SVG path contains no valid tokens.")
    if tokens[0][0] != 'CMD' or tokens[0][1] not in ('M', 'm'):
        first_token = tokens[0][1] if tokens[0][0] == 'CMD' else str(tokens[0][1])
        raise SVGPathError(f"SVG path must start with 'M' or 'm', but starts with '{first_token}'.")
    return tokens

def parse_path_commands(tokens: List[Tuple[str, Any]]) -> List[Tuple[str, List[float]]]:
    """
    Parse tokens into command sequences.
    Handles implicit command repetitions (e.g. 'M x y x2 y2' -> 'M x y', 'L x2 y2').
    """
    commands: List[Tuple[str, List[float]]] = []
    i = 0
    n = len(tokens)
    
    current_cmd: Optional[str] = None
    
    while i < n:
        t_type, t_val = tokens[i]
        if t_type == 'CMD':
            current_cmd = t_val
            i += 1
        elif current_cmd is None:
            raise SVGPathError(f"Expected command at token index {i}, found number {t_val}")
            
        param_count = COMMAND_PARAM_COUNTS[current_cmd]
        
        if param_count == 0:
            commands.append((current_cmd, []))
            continue
            
        # Collect parameters
        params: List[float] = []
        while len(params) < param_count and i < n and tokens[i][0] == 'NUM':
            params.append(tokens[i][1])
            i += 1
            
        if len(params) < param_count:
            raise SVGPathError(
                f"Command '{current_cmd}' requires {param_count} parameters, but only received {len(params)}: {params}"
            )
            
        commands.append((current_cmd, params))
        
        # In SVG standard: subsequent coordinate groups after M/m become implicit L/l
        if current_cmd == 'M':
            current_cmd = 'L'
        elif current_cmd == 'm':
            current_cmd = 'l'
            
    return commands

def cubic_bezier_extrema(p0: float, p1: float, p2: float, p3: float) -> Tuple[float, float]:
    """Compute min and max value of a 1D cubic Bézier curve evaluating roots of derivative."""
    pts = [p0, p3]
    # B'(t) / 3 = A*t^2 + B*t + C
    A = -p0 + 3.0 * p1 - 3.0 * p2 + p3
    B = 2.0 * (p0 - 2.0 * p1 + p2)
    C = p1 - p0
    
    def eval_c(t: float) -> float:
        return (1.0 - t)**3 * p0 + 3.0 * (1.0 - t)**2 * t * p1 + 3.0 * (1.0 - t) * t**2 * p2 + t**3 * p3
        
    if abs(A) < 1e-12:
        if abs(B) > 1e-12:
            t = -C / B
            if 0.0 < t < 1.0:
                pts.append(eval_c(t))
    else:
        disc = B * B - 4.0 * A * C
        if disc >= 0.0:
            sq = math.sqrt(disc)
            for t in [(-B + sq) / (2.0 * A), (-B - sq) / (2.0 * A)]:
                if 0.0 < t < 1.0:
                    pts.append(eval_c(t))
    return min(pts), max(pts)

def quad_bezier_extrema(p0: float, p1: float, p2: float) -> Tuple[float, float]:
    """Compute min and max value of a 1D quadratic Bézier curve evaluating root of derivative."""
    pts = [p0, p2]
    # Q'(t) / 2 = A*t + B
    A = p0 - 2.0 * p1 + p2
    B = p1 - p0
    if abs(A) > 1e-12:
        t = -B / A
        if 0.0 < t < 1.0:
            val = (1.0 - t)**2 * p0 + 2.0 * (1.0 - t) * t * p1 + t**2 * p2
            pts.append(val)
    return min(pts), max(pts)

def arc_bounds(x0: float, y0: float, rx: float, ry: float, phi_deg: float,
               large_arc: float, sweep: float, x: float, y: float) -> Tuple[List[float], List[float]]:
    """Sample elliptical arc points to compute exact bounds."""
    if (x0, y0) == (x, y):
        return [x0], [y0]
    rx, ry = abs(rx), abs(ry)
    if rx == 0.0 or ry == 0.0:
        return [x0, x], [y0, y]
        
    phi = math.radians(phi_deg % 360.0)
    cos_phi = math.cos(phi)
    sin_phi = math.sin(phi)
    
    dx2 = (x0 - x) / 2.0
    dy2 = (y0 - y) / 2.0
    x1p = cos_phi * dx2 + sin_phi * dy2
    y1p = -sin_phi * dx2 + cos_phi * dy2
    
    prx = rx * rx
    pry = ry * ry
    px1p = x1p * x1p
    py1p = y1p * y1p
    radii_check = px1p / prx + py1p / pry
    if radii_check > 1.0:
        scale = math.sqrt(radii_check)
        rx *= scale
        ry *= scale
        prx = rx * rx
        pry = ry * ry
        
    sign = 1.0 if bool(large_arc) != bool(sweep) else -1.0
    num = max(0.0, prx * pry - prx * py1p - pry * px1p)
    den = prx * py1p + pry * px1p
    coef = sign * math.sqrt(num / den) if den > 0.0 else 0.0
    cxp = coef * ((rx * y1p) / ry)
    cyp = coef * (-(ry * x1p) / rx)
    
    cx = cos_phi * cxp - sin_phi * cyp + (x0 + x) / 2.0
    cy = sin_phi * cxp + cos_phi * cyp + (y0 + y) / 2.0
    
    def vec_angle(ux: float, uy: float, vx: float, vy: float) -> float:
        dot = ux * vx + uy * vy
        len_u = math.sqrt(ux * ux + uy * uy)
        len_v = math.sqrt(vx * vx + vy * vy)
        val = max(-1.0, min(1.0, dot / (len_u * len_v))) if (len_u * len_v) > 0.0 else 0.0
        ang = math.acos(val)
        if ux * vy - uy * vx < 0.0:
            ang = -ang
        return ang
        
    ux = (x1p - cxp) / rx
    uy = (y1p - cyp) / ry
    vx = (-x1p - cxp) / rx
    vy = (-y1p - cyp) / ry
    theta1 = vec_angle(1.0, 0.0, ux, uy)
    dtheta = vec_angle(ux, uy, vx, vy)
    if not sweep and dtheta > 0.0:
        dtheta -= 2.0 * math.pi
    elif sweep and dtheta < 0.0:
        dtheta += 2.0 * math.pi
        
    xs = [x0, x]
    ys = [y0, y]
    N = 32
    for step in range(N + 1):
        th = theta1 + dtheta * (step / N)
        cos_th = math.cos(th)
        sin_th = math.sin(th)
        px = cx + rx * cos_th * cos_phi - ry * sin_th * sin_phi
        py = cy + rx * cos_th * sin_phi + ry * sin_th * cos_phi
        xs.append(px)
        ys.append(py)
    return xs, ys

def normalize_path_to_absolute(commands: List[Tuple[str, List[float]]]) -> Tuple[List[Tuple[str, List[float]]], Dict[str, float]]:
    """
    Converts all relative and absolute SVG path commands into standard absolute commands,
    evaluating exact bounding boxes across all segments.
    """
    abs_commands: List[Tuple[str, List[float]]] = []
    
    all_x: List[float] = []
    all_y: List[float] = []
    
    cur_x, cur_y = 0.0, 0.0
    subpath_x, subpath_y = 0.0, 0.0
    last_cubic_ctrl: Optional[Tuple[float, float]] = None
    last_quad_ctrl: Optional[Tuple[float, float]] = None
    
    for cmd, params in commands:
        if cmd == 'M':
            cur_x, cur_y = params[0], params[1]
            subpath_x, subpath_y = cur_x, cur_y
            abs_commands.append(('M', [cur_x, cur_y]))
            all_x.append(cur_x)
            all_y.append(cur_y)
            last_cubic_ctrl = None
            last_quad_ctrl = None
            
        elif cmd == 'm':
            if not abs_commands:
                # Initial 'm' is treated as absolute in SVG standard
                cur_x, cur_y = params[0], params[1]
            else:
                cur_x += params[0]
                cur_y += params[1]
            subpath_x, subpath_y = cur_x, cur_y
            abs_commands.append(('M', [cur_x, cur_y]))
            all_x.append(cur_x)
            all_y.append(cur_y)
            last_cubic_ctrl = None
            last_quad_ctrl = None
            
        elif cmd == 'L':
            cur_x, cur_y = params[0], params[1]
            abs_commands.append(('L', [cur_x, cur_y]))
            all_x.append(cur_x)
            all_y.append(cur_y)
            last_cubic_ctrl = None
            last_quad_ctrl = None
            
        elif cmd == 'l':
            cur_x += params[0]
            cur_y += params[1]
            abs_commands.append(('L', [cur_x, cur_y]))
            all_x.append(cur_x)
            all_y.append(cur_y)
            last_cubic_ctrl = None
            last_quad_ctrl = None
            
        elif cmd == 'H':
            cur_x = params[0]
            abs_commands.append(('H', [cur_x]))
            all_x.append(cur_x)
            all_y.append(cur_y)
            last_cubic_ctrl = None
            last_quad_ctrl = None
            
        elif cmd == 'h':
            cur_x += params[0]
            abs_commands.append(('H', [cur_x]))
            all_x.append(cur_x)
            all_y.append(cur_y)
            last_cubic_ctrl = None
            last_quad_ctrl = None
            
        elif cmd == 'V':
            cur_y = params[0]
            abs_commands.append(('V', [cur_y]))
            all_x.append(cur_x)
            all_y.append(cur_y)
            last_cubic_ctrl = None
            last_quad_ctrl = None
            
        elif cmd == 'v':
            cur_y += params[0]
            abs_commands.append(('V', [cur_y]))
            all_x.append(cur_x)
            all_y.append(cur_y)
            last_cubic_ctrl = None
            last_quad_ctrl = None
            
        elif cmd == 'C':
            x1, y1, x2, y2, x, y = params
            min_x, max_x = cubic_bezier_extrema(cur_x, x1, x2, x)
            min_y, max_y = cubic_bezier_extrema(cur_y, y1, y2, y)
            all_x.extend([min_x, max_x])
            all_y.extend([min_y, max_y])
            last_cubic_ctrl = (x2, y2)
            last_quad_ctrl = None
            cur_x, cur_y = x, y
            abs_commands.append(('C', [x1, y1, x2, y2, x, y]))
            
        elif cmd == 'c':
            dx1, dy1, dx2, dy2, dx, dy = params
            x1 = cur_x + dx1
            y1 = cur_y + dy1
            x2 = cur_x + dx2
            y2 = cur_y + dy2
            x = cur_x + dx
            y = cur_y + dy
            min_x, max_x = cubic_bezier_extrema(cur_x, x1, x2, x)
            min_y, max_y = cubic_bezier_extrema(cur_y, y1, y2, y)
            all_x.extend([min_x, max_x])
            all_y.extend([min_y, max_y])
            last_cubic_ctrl = (x2, y2)
            last_quad_ctrl = None
            cur_x, cur_y = x, y
            abs_commands.append(('C', [x1, y1, x2, y2, x, y]))
            
        elif cmd == 'S':
            x2, y2, x, y = params
            if last_cubic_ctrl:
                x1 = 2.0 * cur_x - last_cubic_ctrl[0]
                y1 = 2.0 * cur_y - last_cubic_ctrl[1]
            else:
                x1 = cur_x
                y1 = cur_y
            min_x, max_x = cubic_bezier_extrema(cur_x, x1, x2, x)
            min_y, max_y = cubic_bezier_extrema(cur_y, y1, y2, y)
            all_x.extend([min_x, max_x])
            all_y.extend([min_y, max_y])
            last_cubic_ctrl = (x2, y2)
            last_quad_ctrl = None
            cur_x, cur_y = x, y
            abs_commands.append(('S', [x2, y2, x, y]))
            
        elif cmd == 's':
            dx2, dy2, dx, dy = params
            x2 = cur_x + dx2
            y2 = cur_y + dy2
            x = cur_x + dx
            y = cur_y + dy
            if last_cubic_ctrl:
                x1 = 2.0 * cur_x - last_cubic_ctrl[0]
                y1 = 2.0 * cur_y - last_cubic_ctrl[1]
            else:
                x1 = cur_x
                y1 = cur_y
            min_x, max_x = cubic_bezier_extrema(cur_x, x1, x2, x)
            min_y, max_y = cubic_bezier_extrema(cur_y, y1, y2, y)
            all_x.extend([min_x, max_x])
            all_y.extend([min_y, max_y])
            last_cubic_ctrl = (x2, y2)
            last_quad_ctrl = None
            cur_x, cur_y = x, y
            abs_commands.append(('S', [x2, y2, x, y]))
            
        elif cmd == 'Q':
            x1, y1, x, y = params
            min_x, max_x = quad_bezier_extrema(cur_x, x1, x)
            min_y, max_y = quad_bezier_extrema(cur_y, y1, y)
            all_x.extend([min_x, max_x])
            all_y.extend([min_y, max_y])
            last_quad_ctrl = (x1, y1)
            last_cubic_ctrl = None
            cur_x, cur_y = x, y
            abs_commands.append(('Q', [x1, y1, x, y]))
            
        elif cmd == 'q':
            dx1, dy1, dx, dy = params
            x1 = cur_x + dx1
            y1 = cur_y + dy1
            x = cur_x + dx
            y = cur_y + dy
            min_x, max_x = quad_bezier_extrema(cur_x, x1, x)
            min_y, max_y = quad_bezier_extrema(cur_y, y1, y)
            all_x.extend([min_x, max_x])
            all_y.extend([min_y, max_y])
            last_quad_ctrl = (x1, y1)
            last_cubic_ctrl = None
            cur_x, cur_y = x, y
            abs_commands.append(('Q', [x1, y1, x, y]))
            
        elif cmd == 'T':
            x, y = params
            if last_quad_ctrl:
                x1 = 2.0 * cur_x - last_quad_ctrl[0]
                y1 = 2.0 * cur_y - last_quad_ctrl[1]
            else:
                x1 = cur_x
                y1 = cur_y
            min_x, max_x = quad_bezier_extrema(cur_x, x1, x)
            min_y, max_y = quad_bezier_extrema(cur_y, y1, y)
            all_x.extend([min_x, max_x])
            all_y.extend([min_y, max_y])
            last_quad_ctrl = (x1, y1)
            last_cubic_ctrl = None
            cur_x, cur_y = x, y
            abs_commands.append(('T', [x, y]))
            
        elif cmd == 't':
            dx, dy = params
            x = cur_x + dx
            y = cur_y + dy
            if last_quad_ctrl:
                x1 = 2.0 * cur_x - last_quad_ctrl[0]
                y1 = 2.0 * cur_y - last_quad_ctrl[1]
            else:
                x1 = cur_x
                y1 = cur_y
            min_x, max_x = quad_bezier_extrema(cur_x, x1, x)
            min_y, max_y = quad_bezier_extrema(cur_y, y1, y)
            all_x.extend([min_x, max_x])
            all_y.extend([min_y, max_y])
            last_quad_ctrl = (x1, y1)
            last_cubic_ctrl = None
            cur_x, cur_y = x, y
            abs_commands.append(('T', [x, y]))
            
        elif cmd == 'A':
            rx, ry, phi, large, sweep, x, y = params
            xs, ys = arc_bounds(cur_x, cur_y, rx, ry, phi, large, sweep, x, y)
            all_x.extend(xs)
            all_y.extend(ys)
            cur_x, cur_y = x, y
            last_cubic_ctrl = None
            last_quad_ctrl = None
            abs_commands.append(('A', [rx, ry, phi, large, sweep, x, y]))
            
        elif cmd == 'a':
            rx, ry, phi, large, sweep, dx, dy = params
            x = cur_x + dx
            y = cur_y + dy
            xs, ys = arc_bounds(cur_x, cur_y, rx, ry, phi, large, sweep, x, y)
            all_x.extend(xs)
            all_y.extend(ys)
            cur_x, cur_y = x, y
            last_cubic_ctrl = None
            last_quad_ctrl = None
            abs_commands.append(('A', [rx, ry, phi, large, sweep, x, y]))
            
        elif cmd in ('Z', 'z'):
            cur_x, cur_y = subpath_x, subpath_y
            last_cubic_ctrl = None
            last_quad_ctrl = None
            abs_commands.append(('Z', []))
            
    if not all_x or not all_y:
        raise SVGPathError("SVG path yielded no coordinates or dimensions.")
        
    xmin, xmax = min(all_x), max(all_x)
    ymin, ymax = min(all_y), max(all_y)
    width = max(0.0, xmax - xmin)
    height = max(0.0, ymax - ymin)
    
    bbox = {
        'xmin': xmin,
        'ymin': ymin,
        'xmax': xmax,
        'ymax': ymax,
        'width': width,
        'height': height
    }
    return abs_commands, bbox

def translate_commands(abs_commands: List[Tuple[str, List[float]]], dx: float, dy: float) -> str:
    """
    Translate absolute commands by (dx, dy) and serialize to an SVG 'd' string.
    """
    parts: List[str] = []
    
    for cmd, p in abs_commands:
        if cmd == 'M':
            parts.append(f"M {fmt_coord(p[0] + dx)} {fmt_coord(p[1] + dy)}")
        elif cmd == 'L':
            parts.append(f"L {fmt_coord(p[0] + dx)} {fmt_coord(p[1] + dy)}")
        elif cmd == 'H':
            parts.append(f"H {fmt_coord(p[0] + dx)}")
        elif cmd == 'V':
            parts.append(f"V {fmt_coord(p[0] + dy)}")
        elif cmd == 'C':
            parts.append(
                f"C {fmt_coord(p[0] + dx)} {fmt_coord(p[1] + dy)} "
                f"{fmt_coord(p[2] + dx)} {fmt_coord(p[3] + dy)} "
                f"{fmt_coord(p[4] + dx)} {fmt_coord(p[5] + dy)}"
            )
        elif cmd == 'S':
            parts.append(
                f"S {fmt_coord(p[0] + dx)} {fmt_coord(p[1] + dy)} "
                f"{fmt_coord(p[2] + dx)} {fmt_coord(p[3] + dy)}"
            )
        elif cmd == 'Q':
            parts.append(
                f"Q {fmt_coord(p[0] + dx)} {fmt_coord(p[1] + dy)} "
                f"{fmt_coord(p[2] + dx)} {fmt_coord(p[3] + dy)}"
            )
        elif cmd == 'T':
            parts.append(f"T {fmt_coord(p[0] + dx)} {fmt_coord(p[1] + dy)}")
        elif cmd == 'A':
            # rx, ry, phi, large_arc, sweep are invariant under translation
            rx, ry, phi, large, sweep, x, y = p
            parts.append(
                f"A {fmt_coord(rx)} {fmt_coord(ry)} {fmt_coord(phi)} "
                f"{int(large)} {int(sweep)} "
                f"{fmt_coord(x + dx)} {fmt_coord(y + dy)}"
            )
        elif cmd == 'Z':
            parts.append("Z")
            
    return " ".join(parts)

def normalize_path_string(d_str: str) -> Tuple[str, Dict[str, float]]:
    """Parse, compute exact bounding box, and normalize a path string to origin (0, 0)."""
    tokens = tokenize_path(d_str)
    commands = parse_path_commands(tokens)
    abs_commands, bbox = normalize_path_to_absolute(commands)
    
    # Translate so (xmin, ymin) starts at (0, 0)
    dx = -bbox['xmin']
    dy = -bbox['ymin']
    normalized_d = translate_commands(abs_commands, dx, dy)
    
    return normalized_d, bbox

def process_svg_content(svg_text: str) -> Tuple[str, Dict[str, float]]:
    """
    Parse an entire SVG document, normalize all Bézier paths to origin (0, 0),
    update root viewBox="0 0 w h", and preserve other elements.
    """
    try:
        ET.register_namespace('', 'http://www.w3.org/2000/svg')
        root = ET.fromstring(svg_text)
    except Exception as e:
        raise SVGPathError(f"Failed to parse SVG XML content: {e}")
        
    path_elems = [elem for elem in root.iter() if elem.tag.endswith('path') and 'd' in elem.attrib]
    if not path_elems:
        raise SVGPathError("SVG contains no <path> elements with a 'd' attribute.")
        
    # First pass: collect bounding boxes across all paths
    parsed_paths = []
    global_xmin = float('inf')
    global_ymin = float('inf')
    global_xmax = float('-inf')
    global_ymax = float('-inf')
    
    for elem in path_elems:
        d = elem.attrib['d']
        tokens = tokenize_path(d)
        cmds = parse_path_commands(tokens)
        abs_cmds, bbox = normalize_path_to_absolute(cmds)
        parsed_paths.append((elem, abs_cmds, bbox))
        global_xmin = min(global_xmin, bbox['xmin'])
        global_ymin = min(global_ymin, bbox['ymin'])
        global_xmax = max(global_xmax, bbox['xmax'])
        global_ymax = max(global_ymax, bbox['ymax'])
        
    global_w = max(0.0, global_xmax - global_xmin)
    global_h = max(0.0, global_ymax - global_ymin)
    
    # Second pass: translate all paths relative to global (xmin, ymin)
    dx = -global_xmin
    dy = -global_ymin
    for elem, abs_cmds, _ in parsed_paths:
        translated_d = translate_commands(abs_cmds, dx, dy)
        elem.attrib['d'] = translated_d
        
    w_str = fmt_coord(max(global_w, 1.0))
    h_str = fmt_coord(max(global_h, 1.0))
    root.attrib['viewBox'] = f"0 0 {w_str} {h_str}"
    root.attrib['width'] = w_str
    root.attrib['height'] = h_str
    
    xml_str = ET.tostring(root, encoding='utf-8').decode('utf-8')
    meta = {
        'xmin': global_xmin,
        'ymin': global_ymin,
        'xmax': global_xmax,
        'ymax': global_ymax,
        'width': global_w,
        'height': global_h,
        'viewBox': f"0 0 {w_str} {h_str}"
    }
    return xml_str, meta

def run_tests() -> None:
    """Embedded unit test suite with Happy Path and Sad Path verifications."""
    print("=== [TEST SUITE] normalize_vector_asset.py ===")
    tests_run = 0
    tests_passed = 0

    def assert_true(cond: bool, msg: str):
        nonlocal tests_run, tests_passed
        tests_run += 1
        if cond:
            tests_passed += 1
            print(f"  [PASS] {msg}")
        else:
            print(f"  [FAIL] {msg}")
            sys.exit(1)

    # --- HAPPY PATH 1: Standard Polygon (Box) ---
    path1 = "M 100 200 L 300 200 L 300 400 L 100 400 Z"
    norm_d1, bbox1 = normalize_path_string(path1)
    assert_true(bbox1['xmin'] == 100.0 and bbox1['ymin'] == 200.0, "Happy Path 1: Initial bounding box detected correctly.")
    assert_true(bbox1['width'] == 200.0 and bbox1['height'] == 200.0, "Happy Path 1: Dimensions width=200, height=200 exact.")
    assert_true(norm_d1.startswith("M 0 0"), f"Happy Path 1: Translated path starts strictly at (0, 0): '{norm_d1[:10]}'")
    assert_true("L 200 0" in norm_d1 and "L 200 200" in norm_d1, "Happy Path 1: Coordinates shifted cleanly.")

    # --- HAPPY PATH 2: Complex Cubic Bézier Curve ---
    # Curve pulling outside endpoints
    path2 = "M 10 50 C 10 10, 90 10, 90 50 C 90 90, 10 90, 10 50 Z"
    norm_d2, bbox2 = normalize_path_string(path2)
    assert_true(bbox2['width'] > 0 and bbox2['height'] > 0, "Happy Path 2: Cubic Bézier width and height computed.")
    assert_true(norm_d2.startswith("M 0"), f"Happy Path 2: Translated Bézier origin at 0: '{norm_d2[:10]}'")

    # --- HAPPY PATH 3: Quadratic Bézier & Arc ---
    path3 = "M 50 50 Q 100 150 150 50 A 25 25 0 0 1 200 50 Z"
    norm_d3, bbox3 = normalize_path_string(path3)
    assert_true(bbox3['xmin'] == 50.0 and bbox3['xmax'] == 200.0, "Happy Path 3: Arc endpoints captured in bounds.")
    assert_true(bbox3['width'] == 150.0, "Happy Path 3: Correct width=150.0")

    # --- HAPPY PATH 4: Full SVG Parsing and viewBox update ---
    raw_svg = """<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500">
      <path d="M 50 100 L 150 100 L 150 250 Z" fill="#001C4D" />
    </svg>"""
    norm_svg, meta4 = process_svg_content(raw_svg)
    assert_true('viewBox="0 0 100 150"' in norm_svg, f"Happy Path 4: SVG viewBox updated to '0 0 100 150'. Output: {norm_svg}")
    assert_true('d="M 0 0 L 100 0 L 100 150 Z"' in norm_svg, "Happy Path 4: SVG path d translated to origin (0, 0).")

    # --- HAPPY PATH 5: Multi-segment Implicit Lineto & Relative commands ---
    path5 = "m 50 60 10 10 20-10 z"
    norm_d5, bbox5 = normalize_path_string(path5)
    assert_true(norm_d5.startswith("M 0"), "Happy Path 5: Relative implicit coordinates converted and translated.")

    # --- SAD PATH 1: Empty path ---
    sad1_caught = False
    try:
        normalize_path_string("")
    except (SVGPathError, ValueError) as e:
        sad1_caught = True
    assert_true(sad1_caught, "Sad Path 1: Empty path string raises controlled SVGPathError.")

    # --- SAD PATH 2: Whitespace only ---
    sad2_caught = False
    try:
        normalize_path_string("   \n\t  ")
    except (SVGPathError, ValueError):
        sad2_caught = True
    assert_true(sad2_caught, "Sad Path 2: Whitespace-only string raises controlled SVGPathError.")

    # --- SAD PATH 3: Corrupted tokens / Invalid Syntax ---
    sad3_caught = False
    try:
        normalize_path_string("M 10 20 INVALID_COMMAND 30 40")
    except (SVGPathError, ValueError):
        sad3_caught = True
    assert_true(sad3_caught, "Sad Path 3: Corrupt token raises controlled SVGPathError.")

    # --- SAD PATH 4: Incomplete parameters ---
    sad4_caught = False
    try:
        normalize_path_string("M 10 20 L 30")  # L requires 2 parameters (x, y)
    except (SVGPathError, ValueError):
        sad4_caught = True
    assert_true(sad4_caught, "Sad Path 4: Incomplete parameters for command raises controlled SVGPathError.")

    # --- SAD PATH 5: Starting with non-moveto command ---
    sad5_caught = False
    try:
        normalize_path_string("L 10 20 Z")
    except (SVGPathError, ValueError):
        sad5_caught = True
    assert_true(sad5_caught, "Sad Path 5: Path not starting with M/m raises controlled SVGPathError.")

    # --- SAD PATH 6: Malformed SVG XML ---
    sad6_caught = False
    try:
        process_svg_content("<svg><path d='M 0 0'>unclosed_tag")
    except (SVGPathError, ValueError):
        sad6_caught = True
    assert_true(sad6_caught, "Sad Path 6: Malformed SVG XML raises controlled SVGPathError.")

    print(f"\n[ALL TESTS PASSED] {tests_passed}/{tests_run} tests verified exit code 0.")
    sys.exit(0)

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sanitize and normalize SVG Bézier assets to origin (0, 0) with viewBox isolation."
    )
    parser.add_argument("--input", "-i", help="Input SVG file path, path text file, or inline path string.")
    parser.add_argument("--output", "-o", help="Output destination file (SVG or text). Default prints to stdout.")
    parser.add_argument("--path-only", action="store_true", help="Output only the translated 'd' attribute string.")
    parser.add_argument("--json-meta", nargs="?", const=True, default=False,
                        help="Output JSON metadata with bounding box dimensions (can specify file path or flag).")
    parser.add_argument("--test", action="store_true", help="Execute embedded unit test suite and exit.")

    args = parser.parse_args()

    if args.test:
        run_tests()
        return

    if not args.input:
        parser.error("Argument --input is required (or run with --test).")

    raw_input = args.input
    input_content = ""
    is_svg_file = False

    # Check if input is an existing file
    if os.path.isfile(raw_input):
        try:
            with open(raw_input, "r", encoding="utf-8") as f:
                input_content = f.read()
            if raw_input.lower().endswith(".svg") or "<svg" in input_content:
                is_svg_file = True
        except Exception as e:
            sys.stderr.write(f"Error reading file '{raw_input}': {e}\n")
            sys.exit(1)
    else:
        # Direct string input
        input_content = raw_input
        if "<svg" in input_content:
            is_svg_file = True

    try:
        if is_svg_file and not args.path_only:
            output_content, meta = process_svg_content(input_content)
        elif is_svg_file and args.path_only:
            # Extract first path d and normalize
            match = re.search(r'd="([^"]+)"', input_content)
            if not match:
                raise SVGPathError("No d attribute found in input SVG.")
            output_content, meta = normalize_path_string(match.group(1))
        else:
            norm_d, meta = normalize_path_string(input_content)
            if args.path_only:
                output_content = norm_d
            else:
                w_str = fmt_coord(max(meta['width'], 1.0))
                h_str = fmt_coord(max(meta['height'], 1.0))
                output_content = (
                    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w_str} {h_str}" '
                    f'width="{w_str}" height="{h_str}">\n'
                    f'  <path d="{norm_d}" fill="currentColor" />\n'
                    f'</svg>'
                )

        # Handle JSON metadata
        if args.json_meta:
            meta_json = json.dumps(meta, indent=2)
            if isinstance(args.json_meta, str) and args.json_meta.endswith(".json"):
                with open(args.json_meta, "w", encoding="utf-8") as jf:
                    jf.write(meta_json + "\n")
            else:
                sys.stderr.write(f"[META] {meta_json}\n")

        # Handle main output
        if args.output:
            out_dir = os.path.dirname(args.output)
            if out_dir:
                os.makedirs(out_dir, exist_ok=True)
            with open(args.output, "w", encoding="utf-8") as of:
                of.write(output_content + "\n")
            print(f"[OK] Normalized asset written to {args.output}")
        else:
            print(output_content)

    except SVGPathError as pe:
        sys.stderr.write(f"SVG Normalization Error: {pe}\n")
        sys.exit(1)
    except Exception as ex:
        sys.stderr.write(f"Unexpected Error: {ex}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
