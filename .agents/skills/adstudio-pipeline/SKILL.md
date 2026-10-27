---
name: adstudio-pipeline
description: Motor integral de producción audiovisual publicitaria y social media.
owner_node: praxis
category: orchestration
version: 1.0.0
---

# AdStudio Pipeline — Motor Integral de Producción Audiovisual & Social Media

## 1. Visión y Propósito
`adstudio-pipeline` es el motor orquestador central de la factoría publicitaria digital. Transforma un requerimiento comercial (Brief) en campañas completas de video vertical (9:16) optimizadas para retención (*Thumbstop Rate*) y conversión (*ROAS*), abarcando tanto B2B como B2C.

Este skill unifica cuatro dominios que tradicionalmente operan desconectados:
1. **Inteligencia y Espionaje Competitivo**: Detección de patrones ganadores en anuncios de competidores activos >30 días.
2. **Ingeniería Creativa y Ganchos**: Estructuración combinatoria ($1 \text{ Cuerpo} \times N \text{ Hooks} \times M \text{ CTAs}$) y blindaje contra políticas de baneo.
3. **Factoría Audiovisual**: Síntesis de voz comercial hiperrealista, avatares sintéticos, subtítulos cinéticos y ensamblaje batch.
4. **Despacho y Atribución**: Programación multicanal (IG Reels, TikTok, YouTube Shorts, LinkedIn) y medición por UTMs/CAPI.

---

## 2. Arquitectura de Módulos

El skill desacopla la orquestación lógica de la ejecución técnica mediante subdirectorios especializados:

```text
.agents/skills/adstudio-pipeline/
├── SKILL.md                          <-- Orquestador Principal (Este archivo)
├── references/                       <-- Heurísticas y Reglas de Negocio
│   ├── 01_ad_creative_intel.md       <-- Espionaje de Ad Libraries e ICP Profiling
│   ├── 02_retention_hooks_rules.md   <-- 15 Arquetipos de Ganchos y Guión Modular
│   └── 03_ad_policy_compliance.md    <-- Linter de Políticas Meta/TikTok y AI Disclosure
└── scripts/                          <-- Motores Físicos Ejecutables
    ├── voice_generator.py            <-- Cliente ElevenLabs / TTS con entonación publicitaria
    └── video_compiler.py             <-- Ensamblador FFmpeg 9:16 con salvaguarda ResourceGuard
```

---

## 3. Protocolo de Ejecución Paso a Paso (Workflow DAG)

Cuando el agente recibe la directiva de producir una campaña, debe seguir secuencialmente las 5 fases:

### Fase 1: Inteligencia de Mercado e ICP Profiling
1. Consultar [references/01_ad_creative_intel.md](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/adstudio-pipeline/references/01_ad_creative_intel.md).
2. Definir el Avatar del Cliente (ICP), dolores viscerales y ángulo de oferta.
3. Extraer referencias de anuncios longevos en la Meta Ad Library de competidores directos.

### Fase 2: Redacción Modular y Compliance
1. Consultar [references/02_retention_hooks_rules.md](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/adstudio-pipeline/references/02_retention_hooks_rules.md).
2. Redactar el guión base en formato modular:
   - **4 Ganchos de Entrada (0-3s)**: Seleccionados del catálogo de 15 arquetipos neuro-retentivos.
   - **1 Cuerpo Central (15-30s)**: Problema, agitación, mecanismo único de solución y prueba.
   - **3 Llamadas a la Acción (CTAs)**: Directa, de escasez y de bajo compromiso.
3. Auditar el texto contra [references/03_ad_policy_compliance.md](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/adstudio-pipeline/references/03_ad_policy_compliance.md) para descartar términos que activen baneos o suspensiones algorítmicas.

### Fase 3: Síntesis de Audio y Voces
1. Ejecutar el script [scripts/voice_generator.py](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/adstudio-pipeline/scripts/voice_generator.py) pasando el texto del guión y el ID de voz configurado.
2. El script genera los archivos `.mp3` normalizados a -14 LUFS con pausas respiratorias naturales.

### Fase 4: Compilación Batch de Variaciones (A/B Testing)
1. Ejecutar el script [scripts/video_compiler.py](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/adstudio-pipeline/scripts/video_compiler.py) pasando los tracks de audio, clips visuales o avatares de fondo.
2. El compilador aplica:
   - Recorte y escalado a 1080x1920 (9:16 vertical).
   - Generación de subtítulos dinámicos (*Kinetic Subtitles*) quemados en video.
   - Mezcla de audio con música de fondo libre de derechos a -22 dB.
   - Renderizado en lotes respetando el límite de memoria RAM (<85% via ResourceGuard).
   - Salida: 12 archivos `.mp4` combinatorios listos para pauta publicitaria.

### Fase 5: Entrega y Despacho
1. Generar la ficha técnica de la campaña con enlaces UTM únicos por variación.
2. Verificar que cada pieza incluya la etiqueta mandatoria de transparencia de IA (*AI Generated Content*).

---

## 4. Gobernanza y Restricciones Técnicas (§4, §30, §33, §39)
- **Tolerancia Cero a Mocks (§4)**: Los scripts deben conectarse a endpoints reales de APIs o fallar explícitamente con diagnósticos claros ante la falta de credenciales (`ELEVENLABS_API_KEY`). Prohibido generar audio silencioso simulado.
- **Salvaguarda de Recursos (§30, §33)**: Todo renderizado de video en `video_compiler.py` debe procesarse secuencialmente o en lotes atómicos limitados por la cantidad de núcleos físicos disponibles, evitando saturar la CPU del host.
- **Pureza de Dominio (§39)**: La orquestación y scripts deben ser completamente ejecutables en entornos headless (CLI / servidores) sin dependencias de interfaces gráficas.
