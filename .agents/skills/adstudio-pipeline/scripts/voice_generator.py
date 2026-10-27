#!/usr/bin/env python3
"""
voice_generator.py — Cliente de Generación de Voz Publicitaria para adstudio-pipeline
Integra con la API REST oficial de ElevenLabs para síntesis de audio hiperrealista.
Cumple con la doctrina CONEXT: Cero mocks (§4), streaming atómico por chunks (§30) y manejo tipado de errores.
"""

import os
import sys
import argparse
import json
import urllib.request
import urllib.error

class VoiceGenerationError(Exception):
    """Excepción base para errores de generación de voz."""
    pass

class MissingApiKeyError(VoiceGenerationError):
    """Disparada cuando no se provee la clave de API de ElevenLabs."""
    pass

class ElevenLabsApiError(VoiceGenerationError):
    """Disparada cuando el endpoint de ElevenLabs responde con error HTTP."""
    pass

def generate_voice(
    text: str,
    output_path: str,
    voice_id: str = "21m00Tcm4TlvDq8ikWAM",  # Rachel (default public voice)
    model_id: str = "eleven_multilingual_v2",
    api_key: str = None,
    stability: float = 0.5,
    similarity_boost: float = 0.8
) -> str:
    """
    Sintetiza texto a voz usando la API de ElevenLabs y escribe en chunks atómicos en disco.
    """
    key = api_key or os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        raise MissingApiKeyError(
            "ELEVENLABS_API_KEY no encontrada. Configure la variable de entorno o pase el argumento --api-key."
        )

    if not text or not text.strip():
        raise ValueError("El texto para síntesis no puede estar vacío.")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": key,
        "User-Agent": "CONEXT-AdStudio/1.0.0"
    }

    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": stability,
            "similarity_boost": similarity_boost,
            "style": 0.2,
            "use_speaker_boost": True
        }
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    try:
        with urllib.request.urlopen(req) as response:
            if response.status != 200:
                raise ElevenLabsApiError(f"ElevenLabs respondió con código inesperado: {response.status}")
            
            # Protocolo de Chunking (§30): Streaming a disco en bloques de 8KB para proteger la memoria RAM
            with open(output_path, "wb") as f_out:
                while True:
                    chunk = response.read(8192)
                    if not chunk:
                        break
                    f_out.write(chunk)
                    
        return os.path.abspath(output_path)

    except urllib.error.HTTPError as e:
        error_body = ""
        try:
            error_body = e.read().decode("utf-8")
        except Exception:
            # INTENCIONAL: Si no se puede decodificar el cuerpo del error, se reporta solo el código
            pass
        raise ElevenLabsApiError(f"HTTP {e.code}: {e.reason} - {error_body}")
    except urllib.error.URLError as e:
        raise VoiceGenerationError(f"Falla de conexión hacia ElevenLabs: {e.reason}")

def main():
    parser = argparse.ArgumentParser(description="Generador de Voz Publicitaria (ElevenLabs API)")
    parser.add_argument("--text", required=True, help="Texto o guión a sintetizar")
    parser.add_argument("--output", required=True, help="Ruta del archivo .mp3 de salida")
    parser.add_argument("--voice-id", default="21m00Tcm4TlvDq8ikWAM", help="ID de voz en ElevenLabs")
    parser.add_argument("--model-id", default="eleven_multilingual_v2", help="ID del modelo TTS")
    parser.add_argument("--api-key", default=None, help="Clave de API opcional (o usar env ELEVENLABS_API_KEY)")

    args = parser.parse_args()

    try:
        result_path = generate_voice(
            text=args.text,
            output_path=args.output,
            voice_id=args.voice_id,
            model_id=args.model_id,
            api_key=args.api_key
        )
        print(f"[VOICE-OK] Audio generado exitosamente en: {result_path}")
        sys.exit(0)
    except Exception as e:
        print(f"[VOICE-ERROR] {type(e).__name__}: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
