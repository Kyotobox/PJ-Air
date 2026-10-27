# Modelado Financiero y Unit Economics de Flota (02_financial_unit_economics)

## 1. Visión y Propósito
Este módulo consolida las 3 modalidades de cálculo financiero y unit economics para evaluar iniciativas dentro del ecosistema CONEXT:

1. **Modo `AI_TOKENS`**: Consumo de cómputo, token economics, y estamina atómica de agentes IA (SHS v5).
2. **Modo `B2B_SAAS`**: Economía recurrente, adquisición, retención y payback.
3. **Modo `FRANCHISE`**: Expansión física/digital, regalías, inversión inicial y punto de equilibrio.

---

## 2. Modalidad 1: Economía de Inferencia y Agentes IA (SHS v5)

Evalúa el coste real de inferencia por función o entregable funcional:

### 2.1. Dinámica de Context Pressure (CP)
$$SHS_t = SHS_{t-1} + \sum (w_j \times A_j) - \text{Alivio Estratégico}$$
- $w_{\text{read}} = 0.2$, $w_{\text{chat}} = 0.5$, $w_{\text{test}} = 1.5$, $w_{\text{write}} = 2.0$.
- **Semáforo Operativo**:
  - $SHS < 50\%$: Zona Verde (Nominal).
  - $50\% \le SHS < 70\%$: Zona Ámbar (Alerta temprana).
  - $SHS \ge 90\%$: Zona Roja (Handover mandatorio por saturación).

### 2.2. Ratio de Retorno de Tokens de Entrega ($RTE$)
$$RTE = \frac{\text{Líneas de Código Funcional Certificadas con Tests}}{\text{Total de Tokens Consumidos} / 1000}$$
- **Umbral de Calidad**: $RTE \ge 2.5$. Si $RTE < 1.0$, existe deriva alucinatoria o bucle de reintentos ciegos.

---

## 3. Modalidad 2: Unit Economics B2B SaaS

### 3.1. Ecuaciones Fundamentales
- **Customer Lifetime Value (LTV)**:
  $$LTV = \frac{\text{ARPU} \times \text{Gross Margin \%}}{\text{Monthly Churn Rate}}$$
- **CAC Payback Period (Meses)**:
  $$\text{Payback} = \frac{\text{CAC}}{\text{ARPU} \times \text{Gross Margin \%}}$$
- **SaaS Magic Number**:
  $$\text{Magic Number} = \frac{(Q_t - Q_{t-1}) \times 4}{\text{Sales \& Marketing Spend}_{t-1}}$$

### 3.2. Criterios de Viabilidad SaaS
- **Ratio LTV / CAC**: Debe ser $\ge 3.0$ (Ideal $\ge 4.0$).
- **CAC Payback**: Debe ser $\le 12$ meses para SMB, $\le 18$ meses para Enterprise.
- **Magic Number**: $> 1.0$ (Acelerar inversión); $< 0.5$ (Corregir retención antes de gastar en adquisición).

---

## 4. Modalidad 3: Modelado Financiero de Franquicias y Expansión

### 4.1. Parámetros de Unidad
- **Inversión Inicial (CapEx)**: Canon de entrada + adecuación tecnológica + licencias iniciales.
- **Costos Operativos Fijos (OpEx)**: Mantenimiento de infraestructura, software central y soporte.
- **Regalías (Royalties)**: Porcentaje sobre ingresos brutos mensuales (usualmente 5% a 8%).
- **Punto de Equilibrio (Break-even)**: Mes exacto donde el flujo acumulado supera el CapEx inicial.
