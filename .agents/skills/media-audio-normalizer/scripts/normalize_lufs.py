#!/usr/bin/env python3
"""
normalize_lufs.py — Normalizador y medidor de sonoridad LUFS (EBU R128 / ITU-R BS.1770-4).

Extraído y desacoplado del motor audiovisual de BeatMe y Studio.
Procesa audio PCM WAV en formato Multi-OS sin dependencias externas,
calculando la sonoridad integrada en LUFS mediante filtros K-weighting de dos etapas,
y aplicando ganancia para alcanzar el objetivo deseado con control de techo de pico.
"""

import sys
import os
import math
import struct
import wave
import argparse
import json
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

# Umbral de silencio absoluto para evitar log10(0)
SILENCE_FLOOR_LUFS = -70.0
MIN_VALID_TARGET_LUFS = -70.0
MAX_VALID_TARGET_LUFS = 0.0


def compute_k_weighting_coefficients(fs: int) -> Tuple[Tuple[float, float, float, float, float], Tuple[float, float, float, float, float]]:
    """
    Calcula los coeficientes biquad de los filtros K-weighting según ITU-R BS.1770-4
    adaptados a la frecuencia de muestreo `fs`.
    
    Retorna:
      ((b0_1, b1_1, b2_1, a1_1, a2_1), (b0_2, b1_2, b2_2, a1_2, a2_2))
    """
    # Etapa 1: Filtro High-Shelf (modelo acústico de la cabeza)
    f0_1 = 1681.9744509555319
    gain_db_1 = 3.999843753713303
    k_1 = math.tan(math.pi * f0_1 / float(fs))
    vh = 10.0 ** (gain_db_1 / 20.0)
    
    a0_1 = 1.0 + math.sqrt(2.0 * vh) * k_1 + vh * (k_1 ** 2)
    b0_1 = (vh + math.sqrt(2.0 * vh) * k_1 + (k_1 ** 2)) / a0_1
    b1_1 = 2.0 * ((k_1 ** 2) - vh) / a0_1
    b2_1 = (vh - math.sqrt(2.0 * vh) * k_1 + (k_1 ** 2)) / a0_1
    a1_1 = 2.0 * ((k_1 ** 2) - 1.0) / a0_1
    a2_1 = (1.0 - math.sqrt(2.0) * k_1 + (k_1 ** 2)) / a0_1

    # Etapa 2: Filtro Pasa-Altos RLB (modelo de atenuación de graves)
    f0_2 = 38.13547087613982
    q_2 = 0.5003270373253953
    k_2 = math.tan(math.pi * f0_2 / float(fs))
    
    a0_2 = 1.0 + (k_2 / q_2) + (k_2 ** 2)
    b0_2 = 1.0 / a0_2
    b1_2 = -2.0 / a0_2
    b2_2 = 1.0 / a0_2
    a1_2 = 2.0 * ((k_2 ** 2) - 1.0) / a0_2
    a2_2 = (1.0 - (k_2 / q_2) + (k_2 ** 2)) / a0_2

    return ((b0_1, b1_1, b2_1, a1_1, a2_1), (b0_2, b1_2, b2_2, a1_2, a2_2))


def apply_biquad_filter(samples: List[float], b0: float, b1: float, b2: float, a1: float, a2: float) -> List[float]:
    """
    Aplica un filtro IIR biquad usando la forma canónica Direct Form II Transposed.
    """
    n = len(samples)
    out = [0.0] * n
    s1 = 0.0
    s2 = 0.0
    for i in range(n):
        x = samples[i]
        y = b0 * x + s1
        s1 = b1 * x - a1 * y + s2
        s2 = b2 * x - a2 * y
        out[i] = y
    return out


def calculate_loudness_lufs(channel_samples: List[List[float]], sample_rate: int) -> float:
    """
    Mide la sonoridad integrada en LUFS conforme al estándar ITU-R BS.1770-4.
    """
    if not channel_samples or len(channel_samples[0]) == 0:
        return SILENCE_FLOOR_LUFS

    num_channels = len(channel_samples)
    stage1_coeffs, stage2_coeffs = compute_k_weighting_coefficients(sample_rate)

    # Coeficientes de ponderación de canal según ITU-R BS.1770
    # Canal 0: Izquierdo (1.0), Canal 1: Derecho (1.0), Canal 2: Centro (1.0), etc.
    channel_weights = []
    for c in range(num_channels):
        if c in (0, 1, 2):
            channel_weights.append(1.0)
        elif c == 3:  # LFE canal
            channel_weights.append(0.0)
        else:
            channel_weights.append(1.41)

    # Filtrar cada canal con las 2 etapas K-weighting
    filtered_channels = []
    for ch_data in channel_samples:
        s1 = apply_biquad_filter(ch_data, *stage1_coeffs)
        s2 = apply_biquad_filter(s1, *stage2_coeffs)
        filtered_channels.append(s2)

    total_samples = len(channel_samples[0])
    block_size = int(0.400 * sample_rate)  # Ventana de 400 ms
    hop_size = int(0.100 * sample_rate)    # Solapamiento del 75% (100 ms)

    if total_samples < block_size or hop_size <= 0:
        # Fallback sin gating para clips ultra cortos (< 400 ms)
        mean_squares_sum = 0.0
        for c in range(num_channels):
            weight = channel_weights[c]
            if weight > 0.0:
                ms = sum(x * x for x in filtered_channels[c]) / float(total_samples)
                mean_squares_sum += weight * ms

        if mean_squares_sum <= 1e-12:
            return SILENCE_FLOOR_LUFS
        loudness = -0.691 + 10.0 * math.log10(mean_squares_sum)
        return max(SILENCE_FLOOR_LUFS, round(loudness, 2))

    # Gated loudness: calcular sonoridad por bloques de 400 ms
    block_loudness_list = []
    block_powers = []

    pos = 0
    while pos + block_size <= total_samples:
        power_sum = 0.0
        for c in range(num_channels):
            weight = channel_weights[c]
            if weight > 0.0:
                block_slice = filtered_channels[c][pos:pos + block_size]
                ms = sum(x * x for x in block_slice) / float(block_size)
                power_sum += weight * ms

        if power_sum > 1e-12:
            j_k = -0.691 + 10.0 * math.log10(power_sum)
        else:
            j_k = SILENCE_FLOOR_LUFS

        block_powers.append(power_sum)
        block_loudness_list.append(j_k)
        pos += hop_size

    if not block_powers:
        return SILENCE_FLOOR_LUFS

    # Umbral absoluto: -70.0 LUFS
    abs_indices = [idx for idx, lk in enumerate(block_loudness_list) if lk > -70.0]
    if not abs_indices:
        return SILENCE_FLOOR_LUFS

    # Calcular sonoridad sobre bloques por encima del umbral absoluto
    avg_power_abs = sum(block_powers[idx] for idx in abs_indices) / float(len(abs_indices))
    if avg_power_abs <= 1e-12:
        return SILENCE_FLOOR_LUFS
    loudness_abs = -0.691 + 10.0 * math.log10(avg_power_abs)

    # Umbral relativo: 10 LU por debajo de la sonoridad promedio absoluta
    relative_threshold = loudness_abs - 10.0
    rel_indices = [idx for idx in abs_indices if block_loudness_list[idx] > relative_threshold]

    if not rel_indices:
        return SILENCE_FLOOR_LUFS

    avg_power_rel = sum(block_powers[idx] for idx in rel_indices) / float(len(rel_indices))
    if avg_power_rel <= 1e-12:
        return SILENCE_FLOOR_LUFS

    integrated_lufs = -0.691 + 10.0 * math.log10(avg_power_rel)
    return max(SILENCE_FLOOR_LUFS, round(integrated_lufs, 2))


def measure_peak_dbfs(channel_samples: List[List[float]]) -> float:
    """Calcula el pico máximo en decibelios relativos a escala completa (dBFS)."""
    max_val = 0.0
    for ch in channel_samples:
        for x in ch:
            val = abs(x)
            if val > max_val:
                max_val = val
    if max_val <= 1e-12:
        return -120.0
    return round(20.0 * math.log10(max_val), 2)


def load_wav_file(path_str: str) -> Tuple[List[List[float]], int, int]:
    """
    Carga un archivo WAV PCM y decodifica las muestras normalizadas a [-1.0, 1.0].
    Soporta resoluciones de 8, 16, 24 y 32 bits.
    
    Retorna:
      (channel_samples, sample_rate, sample_width)
    """
    p = Path(path_str)
    if not p.is_file():
        raise FileNotFoundError(f"[ERROR-FILE-NOT-FOUND] Archivo no encontrado: {path_str}")

    try:
        with wave.open(str(p), 'rb') as wf:
            channels = wf.getnchannels()
            width = wf.getsampwidth()
            rate = wf.getframerate()
            frames = wf.getnframes()
            raw = wf.readframes(frames)
    except Exception as ex:
        raise ValueError(f"[ERROR-INVALID-AUDIO] Error al leer formato WAV: {ex}")

    if channels <= 0 or rate <= 0:
        raise ValueError(f"[ERROR-INVALID-AUDIO] Metadatos de audio inválidos (canales: {channels}, tasa: {rate})")

    channel_samples: List[List[float]] = [[] for _ in range(channels)]
    total_samples = frames * channels

    if width == 1:
        # 8-bit unsigned PCM (0..255, centro en 128)
        unpacked = struct.unpack(f"<{total_samples}B", raw)
        for i, val in enumerate(unpacked):
            channel_samples[i % channels].append((float(val) - 128.0) / 128.0)
    elif width == 2:
        # 16-bit signed PCM
        unpacked = struct.unpack(f"<{total_samples}h", raw)
        for i, val in enumerate(unpacked):
            channel_samples[i % channels].append(float(val) / 32768.0)
    elif width == 3:
        # 24-bit signed PCM (3 bytes por muestra)
        for i in range(total_samples):
            chunk = raw[i * 3:(i + 1) * 3]
            val = int.from_bytes(chunk, byteorder='little', signed=True)
            channel_samples[i % channels].append(float(val) / 8388608.0)
    elif width == 4:
        # 32-bit signed PCM
        unpacked = struct.unpack(f"<{total_samples}i", raw)
        for i, val in enumerate(unpacked):
            channel_samples[i % channels].append(float(val) / 2147483648.0)
    else:
        raise ValueError(f"[ERROR-INVALID-AUDIO] Ancho de muestra no soportado ({width * 8} bits)")

    return channel_samples, rate, width


def save_wav_file(path_str: str, channel_samples: List[List[float]], sample_rate: int, sample_width: int = 2) -> None:
    """
    Escribe muestras float a un archivo WAV en formato PCM de 16 bits.
    """
    out_path = Path(path_str)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    num_channels = len(channel_samples)
    num_frames = len(channel_samples[0])

    interleaved_samples = []
    for frame_idx in range(num_frames):
        for ch_idx in range(num_channels):
            s = channel_samples[ch_idx][frame_idx]
            # Limitar a rango [-1.0, 1.0]
            s_clamped = max(-1.0, min(1.0, s))
            int_val = int(round(s_clamped * 32767.0))
            interleaved_samples.append(int_val)

    packed_data = struct.pack(f"<{len(interleaved_samples)}h", *interleaved_samples)

    with wave.open(str(out_path), 'wb') as wf:
        wf.setnchannels(num_channels)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(packed_data)


def process_audio(
    input_path: str,
    output_path: Optional[str] = None,
    target_lufs: float = -14.0,
    peak_limit_dbfs: float = -1.0,
    prevent_clipping: bool = False,
    analyze_only: bool = False,
) -> Dict[str, Any]:
    """
    Ejecuta el ciclo completo de análisis o normalización de sonoridad LUFS.
    """
    if target_lufs < MIN_VALID_TARGET_LUFS or target_lufs > MAX_VALID_TARGET_LUFS:
        raise ValueError(
            f"[ERROR-INVALID-TARGET] target_lufs ({target_lufs}) fuera de rango permitido "
            f"[{MIN_VALID_TARGET_LUFS}, {MAX_VALID_TARGET_LUFS}] dB"
        )

    channel_samples, rate, width = load_wav_file(input_path)
    num_channels = len(channel_samples)
    num_frames = len(channel_samples[0])
    duration_sec = round(float(num_frames) / float(rate), 3)

    input_lufs = calculate_loudness_lufs(channel_samples, rate)
    peak_before = measure_peak_dbfs(channel_samples)

    result_payload: Dict[str, Any] = {
        "status": "ANALYZED" if analyze_only else "NORMALIZED",
        "input_file": str(Path(input_path).resolve()),
        "audio_metadata": {
            "channels": num_channels,
            "sample_rate": rate,
            "sample_width_bytes": width,
            "duration_seconds": duration_sec,
            "frame_count": num_frames,
        },
        "loudness": {
            "input_lufs": input_lufs,
            "target_lufs": target_lufs,
            "peak_before_dbfs": peak_before,
        }
    }

    if analyze_only:
        return result_payload

    if not output_path:
        raise ValueError("[ERROR-ARGUMENTS] Se requiere --output para la operación de normalización")

    # Calcular ganancia necesaria para alcanzar target_lufs
    # Si la entrada es silencio absoluto, no amplificar
    if input_lufs <= SILENCE_FLOOR_LUFS:
        gain_db = 0.0
    else:
        gain_db = target_lufs - input_lufs

    linear_gain = 10.0 ** (gain_db / 20.0)

    # Protección de pico / Techo de True Peak si prevent_clipping está activo
    clipping_prevented = False
    max_linear_peak_before = 10.0 ** (peak_before / 20.0) if peak_before > -120.0 else 0.0
    predicted_peak_linear = max_linear_peak_before * linear_gain
    ceiling_linear = 10.0 ** (peak_limit_dbfs / 20.0)

    if prevent_clipping and predicted_peak_linear > ceiling_linear and max_linear_peak_before > 0.0:
        linear_gain = ceiling_linear / max_linear_peak_before
        gain_db = 20.0 * math.log10(linear_gain)
        clipping_prevented = True

    # Aplicar ganancia a todas las muestras
    normalized_channels: List[List[float]] = []
    clipped_samples_count = 0

    for ch in channel_samples:
        new_ch = []
        for sample in ch:
            scaled = sample * linear_gain
            if scaled > 1.0 or scaled < -1.0:
                clipped_samples_count += 1
            new_ch.append(scaled)
        normalized_channels.append(new_ch)

    # Guardar archivo WAV
    try:
        save_wav_file(output_path, normalized_channels, rate, width)
    except Exception as ex:
        raise IOError(f"[ERROR-OUTPUT-WRITE] Fallo al guardar archivo de salida '{output_path}': {ex}")

    output_lufs = calculate_loudness_lufs(normalized_channels, rate)
    peak_after = measure_peak_dbfs(normalized_channels)

    result_payload["output_file"] = str(Path(output_path).resolve())
    result_payload["loudness"].update({
        "gain_applied_db": round(gain_db, 2),
        "output_lufs": output_lufs,
        "peak_after_dbfs": peak_after,
        "peak_ceiling_dbfs": peak_limit_dbfs,
        "clipping_prevented": clipping_prevented,
        "clipped_samples": clipped_samples_count,
    })

    return result_payload


def build_cli_parser() -> argparse.ArgumentParser:
    """Configura el parser de argumentos de línea de comandos."""
    parser = argparse.ArgumentParser(
        description="Normalizador y medidor de sonoridad LUFS (ITU-R BS.1770-4 / EBU R128) para BeatMe y flota."
    )
    parser.add_argument("-i", "--input", required=True, help="Ruta al archivo WAV de entrada.")
    parser.add_argument("-o", "--output", default=None, help="Ruta al archivo WAV de salida normalizado.")
    parser.add_argument("--target-lufs", type=float, default=-14.0, help="Sonoridad objetivo en LUFS (default: -14.0).")
    parser.add_argument("--peak-limit-dbfs", type=float, default=-1.0, help="Techo de pico máximo en dBFS (default: -1.0).")
    parser.add_argument("--prevent-clipping", action="store_true", help="Ajusta la ganancia para no exceder peak-limit-dbfs.")
    parser.add_argument("--analyze", action="store_true", help="Solo mide y reporta sonoridad sin generar archivo de salida.")
    parser.add_argument("--json", action="store_true", help="Emite el resultado en formato JSON estructurado.")
    return parser


def main() -> int:
    parser = build_cli_parser()
    args = parser.parse_args()

    try:
        result = process_audio(
            input_path=args.input,
            output_path=args.output,
            target_lufs=args.target_lufs,
            peak_limit_dbfs=args.peak_limit_dbfs,
            prevent_clipping=args.prevent_clipping,
            analyze_only=args.analyze,
        )

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            mode_label = "ANÁLISIS DE SONORIDAD" if args.analyze else "NORMALIZACIÓN EXITOSA"
            print(f"=== [MEDIA-AUDIO-NORMALIZER] {mode_label} ===")
            print(f"  Archivo Entrada : {result['input_file']}")
            if not args.analyze:
                print(f"  Archivo Salida  : {result.get('output_file')}")
            print(f"  Canales / Tasa  : {result['audio_metadata']['channels']} ch | {result['audio_metadata']['sample_rate']} Hz")
            print(f"  Duración        : {result['audio_metadata']['duration_seconds']} s")
            print(f"  Sonoridad In    : {result['loudness']['input_lufs']} LUFS (Pico: {result['loudness']['peak_before_dbfs']} dBFS)")
            if not args.analyze:
                print(f"  Sonoridad Out   : {result['loudness']['output_lufs']} LUFS (Pico: {result['loudness']['peak_after_dbfs']} dBFS)")
                print(f"  Ganancia        : {result['loudness']['gain_applied_db']} dB (Clipping prevenido: {result['loudness']['clipping_prevented']})")

        return 0

    except FileNotFoundError as fnf:
        sys.stderr.write(f"{fnf}\n")
        return 2
    except ValueError as ve:
        sys.stderr.write(f"{ve}\n")
        return 2
    except IOError as ioe:
        sys.stderr.write(f"{ioe}\n")
        return 1
    except Exception as ex:
        sys.stderr.write(f"[ERROR-UNEXPECTED] Excepción no controlada: {ex}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
