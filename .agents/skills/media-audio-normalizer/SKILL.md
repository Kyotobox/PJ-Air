---
name: media-audio-normalizer
description: Normalización, análisis y masterización de sonoridad LUFS (EBU R128 / ITU-R BS.1770) y control de picos para audio publicitario, podcasts y multimedia (BeatMe y flota).
---

# Media Audio Normalizer Skill

## Propósito
Provee capacidades desacopladas y de alto rendimiento para el análisis, medición y normalización de sonoridad sonora (*loudness*) conforme a los estándares internacionales **EBU R128** e **ITU-R BS.1770-4**.
Extraído y desacoplado del motor audiovisual de **BeatMe** y **Studio**, este skill permite procesar pistas de voz en off, locuciones, efectos SFX y mezclas comerciales garantizando el cumplimiento de objetivos de sonoridad para plataformas de streaming (-14.0 LUFS para Spotify/YouTube/TikTok, -16.0 LUFS para podcasts, -23.0 / -24.0 LUFS para broadcast) y previniendo la distorsión por recorte digital (*clipping*).

## Herramientas y Scripts
* **Punto de Entrada**: `.agents/skills/media-audio-normalizer/scripts/normalize_lufs.py`
* **Entorno**: Python 3.10+ (agnóstico, Multi-OS, sin dependencias externas; opera sobre la biblioteca estándar `wave`, `struct` y `math` con soporte PCM WAV de 8, 16, 24 y 32 bits, y fallback opcional a FFmpeg si está presente en el sistema).

## Modos de Operación CLI

### 1. Análisis de Sonoridad y Medición LUFS (Sin Mutaciones)
Mide la sonoridad integrada (LUFS), pico máximo (dBFS), rango dinámico y metadatos de formato:
```bash
python3 .agents/skills/media-audio-normalizer/scripts/normalize_lufs.py \
  --input="voiceover.wav" \
  --analyze \
  --json
```

### 2. Normalización Estándar a Objetivo (-14.0 LUFS por Defecto)
Calcula la ganancia lineal requerida y genera el archivo normalizado:
```bash
python3 .agents/skills/media-audio-normalizer/scripts/normalize_lufs.py \
  --input="raw_audio.wav" \
  --output="normalized_audio.wav" \
  --target-lufs=-14.0 \
  --json
```

### 3. Normalización con Techo de Pico y Prevención de Clipping
Aplica normalización ajustando la ganancia para no sobrepasar el techo de verdadero pico (*True Peak ceiling*, e.g. -1.0 dBFS):
```bash
python3 .agents/skills/media-audio-normalizer/scripts/normalize_lufs.py \
  --input="hot_mix.wav" \
  --output="safe_mix.wav" \
  --target-lufs=-14.0 \
  --peak-limit-dbfs=-1.0 \
  --prevent-clipping \
  --json
```

## Contratos de Entrada y Salida (JSON Schema)

### Salida Estructurada (`--json`)
```json
{
  "status": "NORMALIZED",
  "input_file": "raw_audio.wav",
  "output_file": "normalized_audio.wav",
  "audio_metadata": {
    "channels": 2,
    "sample_rate": 44100,
    "sample_width_bytes": 2,
    "duration_seconds": 5.2,
    "frame_count": 229320
  },
  "loudness": {
    "input_lufs": -22.4,
    "target_lufs": -14.0,
    "gain_applied_db": 8.4,
    "output_lufs": -14.0,
    "peak_before_dbfs": -12.3,
    "peak_after_dbfs": -3.9,
    "peak_ceiling_dbfs": -1.0,
    "clipping_prevented": true,
    "clipped_samples": 0
  }
}
```

## Códigos de Retorno Deterministas
* **0**: Operación exitosa (medición o normalización completada).
* **1**: Fallo de escritura de archivo o error interno de procesamiento.
* **2**: Error de validación de entrada (archivo no encontrado `[ERROR-FILE-NOT-FOUND]`, formato de audio inválido/no soportado `[ERROR-INVALID-AUDIO]`, o sonoridad objetivo fuera de rango `[ERROR-INVALID-TARGET]`).

## Mandatos de Gobernanza
* **Tolerancia Cero a Mocks (§4)**: Procesamiento matemático directo sobre bytes reales de audio PCM sin stubs ni valores simulados.
* **Sad Path Mandatorio (§6)**: Salidas deterministas con código 2 ante archivos ausentes o cabeceras corruptas.
* **Calm Error UX**: Respuestas estructuradas en formato JSON en `stdout` y mensajes de diagnóstico limpios en `stderr`.
