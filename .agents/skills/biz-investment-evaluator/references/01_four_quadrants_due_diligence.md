# Metodología de Scoring Cuantitativo y Due Diligence en 4 Cuadrantes (01_four_quadrants_due_diligence)

## 1. Fase 1: Compuertas de Tesis de Inversión (Go / No-Go Implacable)

Antes de cualquier análisis numérico, el proyecto debe superar 3 compuertas booleanas. El incumplimiento de cualquiera resulta en **RECHAZO INMEDIATO (KILL)**:

1. **Compuerta de Dolor Urgente ("Painkiller Test")**:
   - ¿Resuelve un dolor crítico con presupuesto existente asignado y vía de monetización a $\le 12$ meses?
   - Si es una "Vitamina" (mejora deseable pero no esencial), se descarta de inmediato.
2. **Compuerta Anti-Hype y Simplicidad Arquitectónica**:
   - ¿La arquitectura está justificada empíricamente sin tecnologías de moda (Web3, blockchain, microservicios prematuros)?
   - Si introduce complejidad accidental no justificada por volumen real, se descarta.
3. **Compuerta de Cumplimiento Normativo y Existencial**:
   - ¿Opera bajo cumplimiento legal estricto sin violar Términos de Servicio (TOS) ni leyes de privacidad/telecomunicaciones (GDPR/TCPA)?
   - Si su modelo depende de zonas grises o lagunas legales, se descarta.

---

## 2. Fase 2: Matriz de Scoring Cuantitativo (4 Cuadrantes)

Cada cuadrante se califica de **1 a 10**:

| Cuadrante | Peso ($w_i$) | Señal Alta (8-10) | Señal Baja (1-4) |
| :--- | :---: | :--- | :--- |
| **Mercado ($S_m$)** | 0.35 | B2B/SaaS recurrente, dolor agudo, barreras de entrada reales. | E-commerce genérico, mercado saturado, sin ventaja injusta. |
| **Tecnología ($S_t$)** | 0.25 | Stack probado, monolito modular, reutilización de axiomas de flota. | Dependencias experimentales, acoplamiento severo a terceros. |
| **Riesgo ($S_r$)** | 0.25 | Compliance blindado, auditorías limpias, resiliencia operacional. | Riesgo regulatorio alto, scraping frágil sin proxies, dependencia única. |
| **Esfuerzo ($S_e$)** | 0.15 | MVP veloz ($\le 30$ días), sin deuda heredada. | Proyectos masivos con I+D incierto sin validación comercial. |

### 2.1. Fórmula del Índice Compuesto ($I_c$)
Dado que un mayor esfuerzo representa costo de oportunidad negativo, su escala se invierte:
$$I_c = 0.35 \cdot S_m + 0.25 \cdot S_t + 0.25 \cdot S_r + 0.15 \cdot (11 - S_e)$$

### 2.2. Tabla de Veredictos Ejecutivos
- **$I_c \ge 8.0$** $\rightarrow$ **TIER-1 (INVERSIÓN PRIORITARIA / ASIGNACIÓN INMEDIATA)**.
- **$6.5 \le I_c < 8.0$** $\rightarrow$ **TIER-2 (INCUBACIÓN CONDICIONAL / MITIGACIÓN DE RIESGOS)**.
- **$I_c < 6.5$** $\rightarrow$ **RECHAZO FORMAL (ARCHIVAR EN EVALUATIONS)**.

---

## 3. Protocolo Preventivo de Kill Criteria (Parada Temprana)

Para evitar la trampa psicológica del costo hundido (*Sunk Cost Fallacy*), cada iniciativa debe registrar al menos **2 criterios de desconexión irrefutables** antes de iniciar su construcción física:

1. **Métrica de Límite Temporal**: Fecha máxima para alcanzar el hito crítico (ej. "Primeros 3 clientes pagos en 45 días").
2. **Umbral de Quema de Recursos**: Gasto máximo autorizado en tokens/horas de ingeniería antes de pausar y auditar.
3. **Señal de Inviabilidad Técnica/Regulatoria**: Si una API crítica bloquea el acceso o un cambio normativo encarece la operación en más de un 50%, la parada es mandatoria.
