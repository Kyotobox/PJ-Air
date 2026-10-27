#!/usr/bin/env python3
"""
video_compiler.py — Compilador y Ensamblador de Video 9:16 para adstudio-pipeline
Utiliza FFmpeg para ensamblar pistas de video, audio de voz, música de fondo y subtítulos.
Incorpora salvaguarda de recursos (§33 ResourceGuard) para limitar la carga de CPU y memoria.
"""

import os
import sys
import argparse
import subprocess
import json
import shutil

class VideoCompilationError(Exception):
    """Excepción base para errores de compilación de video."""
    pass

class DependencyNotFoundError(VideoCompilationError):
    """Disparada cuando FFmpeg no se encuentra en el PATH del sistema."""
    pass

def check_ffmpeg() -> str:
    """Verifica si ffmpeg está instalado y accesible."""
    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        raise DependencyNotFoundError(
            "FFmpeg no está instalado o no se encuentra en el PATH del sistema. "
            "Es necesario para ensamblar los cortos publicitarios."
        )
    return ffmpeg_path

def compile_short(
    video_path: str,
    audio_path: str,
    output_path: str,
    subtitles_path: str = None,
    bg_music_path: str = None,
    width: int = 1080,
    height: int = 1920,
    bg_music_volume: float = 0.08,
    voice_volume: float = 1.0,
    threads: int = 2
) -> str:
    """
    Ensambla un video vertical 9:16 mezclando video base, voz sintética y música de fondo.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video de entrada no encontrado: {video_path}")
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio de voz no encontrado: {audio_path}")

    ffmpeg_bin = check_ffmpeg()

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    # Construcción dinámica del comando FFmpeg
    # Escala y recorta centralmente para garantizar exactamente 9:16 (1080x1920)
    video_filter = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}"

    if subtitles_path and os.path.exists(subtitles_path):
        # Escapado de rutas para el filtro subtitles de ffmpeg
        clean_sub_path = subtitles_path.replace("\\", "/").replace(":", "\\:")
        video_filter += f",subtitles='{clean_sub_path}'"

    cmd = [
        ffmpeg_bin,
        "-y",                     # Sobrescribir salida
        "-threads", str(threads), # Estrangulamiento de concurrencia (§33)
        "-i", video_path,
        "-i", audio_path
    ]

    if bg_music_path and os.path.exists(bg_music_path):
        cmd.extend(["-i", bg_music_path])
        # Mezcla de audio: Voz al 100%, música de fondo al 8% atenuada
        filter_complex = (
            f"[0:v]{video_filter}[v];"
            f"[1:a]volume={voice_volume}[voice];"
            f"[2:a]volume={bg_music_volume}[music];"
            f"[voice][music]amix=inputs=2:duration=first:dropout_transition=2[a]"
        )
        cmd.extend([
            "-filter_complex", filter_complex,
            "-map", "[v]",
            "-map", "[a]"
        ])
    else:
        cmd.extend([
            "-vf", video_filter,
            "-c:a", "aac",
            "-b:a", "192k"
        ])

    cmd.extend([
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-shortest",
        output_path
    ])

    process = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    if process.returncode != 0:
        raise VideoCompilationError(f"FFmpeg falló con código {process.returncode}:\n{process.stderr[-500:]}")

    return os.path.abspath(output_path)

def main():
    parser = argparse.ArgumentParser(description="Compilador de Video Publicitario 9:16 (FFmpeg)")
    parser.add_argument("--video", required=True, help="Video o fondo base")
    parser.add_argument("--audio", required=True, help="Audio de voz sintetizada (.mp3/.wav)")
    parser.add_argument("--output", required=True, help="Ruta del video final de salida (.mp4)")
    parser.add_argument("--subtitles", default=None, help="Archivo opcional de subtítulos (.srt/.ass)")
    parser.add_argument("--bg-music", default=None, help="Pista opcional de música de fondo")
    parser.add_argument("--threads", type=int, default=2, help="Límite de hilos de CPU para transcode (§33)")

    args = parser.parse_args()

    try:
        out_file = compile_short(
            video_path=args.video,
            audio_path=args.audio,
            output_path=args.output,
            subtitles_path=args.subtitles,
            bg_music_path=args.bg_music,
            threads=args.threads
        )
        print(f"[VIDEO-OK] Video publicitario compilado exitosamente: {out_file}")
        sys.exit(0)
    except Exception as e:
        print(f"[VIDEO-ERROR] {type(e).__name__}: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
