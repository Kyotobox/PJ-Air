# Cuantificación Financiera del Riesgo de Deuda Técnica (03_tech_debt_financial_risk)

## 1. Visión y Propósito
Este módulo traduce el estado de la arquitectura del software al lenguaje del comité de inversiones: **dólares y riesgo operativo**. Permite a los líderes técnicos justificar refactorizaciones estructurales demostrando el retorno sobre la inversión (ROI) de erradicar la deuda técnica antes de que cause parálisis o pérdida de capital.

---

## 2. Metodología de Cuantificación Financiera

### 2.1. Las 4 Categorías de Deuda
1. **Deuda Arquitectónica (Acoplamiento)**: Widgets con queries SQL directas o dominio contaminado con UI (§39, §40).
2. **Deuda de Veracidad (Mocks Tautológicos)**: Tests que no prueban la realidad física, generando falsa sensación de seguridad (§4, §16).
3. **Deuda de Obsolescencia / Complejidad**: Código zombie o librerías no mantenidas.
4. **Deuda de Seguridad / Gobernanza**: Bypasses de permisos o firmas asimétricas deshabilitadas.

### 2.2. Fórmula del Costo de la Deuda ($C_{\text{debt}}$)
$$C_{\text{debt}} = \sum_{i=1}^{N} \left( H_i \times R_{\text{hour}} \times (1 + F_{\text{risk}}) \right) + P_{\text{incident}} \times C_{\text{downtime}}$$
- $H_i$: Horas estimadas para remediación limpia de la deuda $i$.
- $R_{\text{hour}}$: Tarifa horaria promedio de ingeniería senior de la flota.
- $F_{\text{risk}}$: Factor de riesgo compuesto (acoplamiento a sistemas críticos).
- $P_{\text{incident}}$: Probabilidad anualizada de falla en producción provocada por la deuda.
- $C_{\text{downtime}}$: Costo estimado por hora de inactividad comercial.

---

## 3. Priorización por Retorno de Remediación (ROD)

$$\text{ROD} = \frac{\text{Ahorro Operativo Anual Proyectado}}{Costo de Remediación}$$
- **$\text{ROD} > 3.0$**: **Prioridad Crítica Inmediata (Sprint Activo)**.
- **$1.5 \le \text{ROD} \le 3.0$**: **Prioridad Alta (Encolar en Backlog)**.
- **$\text{ROD} < 1.5$**: **Monitoreo Pasivo (No justificado a corto plazo)**.
