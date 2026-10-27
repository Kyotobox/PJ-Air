---
name: heavy-media-pipeline
description: Pipeline de procesamiento e inferencia pesada de medios.
owner_node: Automa
category: execution
version: 1.0.0
---

# Heavy Media & Inactive Compute Pipeline

## 1. Visión y Propósito
Este skill técnico provee la infraestructura para ejecutar tareas pesadas de computación (transcripción de audio masiva, análisis biomecánico de video, modelos de difusión o visión computacional) sin comprometer la estabilidad del sistema anfitrión ni saturar la memoria RAM.

Conforme a la **Regla §33 (Salvaguarda de Recursos Físicos del SO)**, impone compuertas de seguridad para mantener el consumo de memoria por debajo del 85% y limitar el uso de núcleos lógicos mediante trabajadores asíncronos desacoplados.

---

## 2. Pilares de Protección de Recursos

1. **Evaluación de Presión de Memoria (`ResourceGuard`)**:
   - Monitoreo continuo de memoria disponible antes de cargar tensores o archivos multimedia en RAM.
   - Si la memoria física libre es $< 15\%$, pausa el pipeline y fuerza recolección de basura (`gc`).
2. **Control de Concurrencia de CPU (`IsolateThrottle`)**:
   - Número máximo de workers en paralelo: $\max(1, \text{CPU\_Cores} - 2)$, dejando siempre núcleos libres para el sistema operativo y la UI.
3. **Procesamiento por Lotes y Persistencia Intermedia (`Atomic Chunking`)**:
   - Fragmentación de archivos de audio/video en bloques de 30-60 segundos.
   - Persistencia inmediata de checkpoints en disco (`job_checkpoints.db`) para reanudación ante reinicios abruptos.

---

## 3. Salida Estándar para Jobs Pesados

```markdown
### [EJECUCIÓN DE PIPELINE PESADO: JOB <ID>]
- **Tipo de Carga**: [AUDIO_TRANSCRIPTION | VIDEO_BIOMECH | VISION_INFERENCE]
- **Workers Activos**: X / Y núcleos asignados
- **Presión de RAM**: ZZ% (Estado: [SEGURO | ALERTA THROTTLING])
- **Progreso por Chunks**: N / M bloques procesados (Puntos de guardado en disco: OK)
- **Tasa de Rendimiento**: AA.A items/s (Intervalo de reporte adaptado conforme a Regla §32)
```
