---
name: biz-investment-evaluator
description: Suite integral de Due Diligence, Inversión y Modelado Financiero.
owner_node: praxis
category: analysis
version: 1.0.0
---

# Business Due Diligence & Investment Suite (biz-investment-evaluator)

## 1. Visión y Propósito
`biz-investment-evaluator` es la suite maestra de calificación estratégica, análisis financiero y evaluación de riesgo de la flota CONEXT. Dictamina sobre nuevas iniciativas de software, inversiones de capital, viabilidad de startups satélites y rentabilidad de refactorizaciones antes de comprometer recursos físicos.

Consolida en un único marco modular:
1. **Auditoría de Inversión (Due Diligence en 4 Cuadrantes)**: Filtro booleano Go/No-Go y Scoring Multidimensional ponderado.
2. **Modelado Financiero y Unit Economics**: Cálculo de LTV/CAC, Payback, métricas B2B SaaS, modelos de franquicia y Token Economy (SHS v5).
3. **Cuantificación Financiera de Deuda Técnica**: Conversión de pasivos arquitectónicos y código huérfano en dólares y riesgo operacional.

---

## 2. Arquitectura de Módulos (Sub-Referencias)

Para evitar sobrecargar el contexto cognitivo, los motores específicos residen en documentos de referencia estructurados:

```text
.agents/skills/biz-investment-evaluator/
├── SKILL.md                          <-- Orquestador de Due Diligence (Este archivo)
└── references/
    ├── 01_four_quadrants_due_diligence.md  <-- Compuertas Go/No-Go, Scoring Ic y Kill Criteria
    ├── 02_financial_unit_economics.md      <-- Ecuaciones LTV/CAC, SaaS y Token Economy SHS
    └── 03_tech_debt_financial_risk.md      <-- Modelo de Costo de Deuda (Cdebt) y ROI de Remediación
```

---

## 3. Protocolo de Evaluación Integrada (Workflow)

Al emitir un dictamen de inversión o viabilidad sobre un proyecto:

1. **Paso 1: Filtrado Booleano Go / No-Go**:
   - Consultar [references/01_four_quadrants_due_diligence.md](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/biz-investment-evaluator/references/01_four_quadrants_due_diligence.md).
   - Validar las 3 compuertas (Painkiller, Anti-Hype, Compliance Legal). Si alguna falla, declarar **RECHAZO (KILL)**.
2. **Paso 2: Modelado Numérico y Unit Economics**:
   - Consultar [references/02_financial_unit_economics.md](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/biz-investment-evaluator/references/02_financial_unit_economics.md).
   - Calcular LTV/CAC (meta $\ge 3.0$), Payback ($\le 12$ meses) y coste de inferencia de IA.
3. **Paso 3: Evaluación de Pasivo Técnico**:
   - Consultar [references/03_tech_debt_financial_risk.md](file:///c:/Users/Ruben/Documents/Smart/.agents/skills/biz-investment-evaluator/references/03_tech_debt_financial_risk.md).
   - Calcular el índice TDI y el costo de remediación de deuda heredada.
4. **Paso 4: Veredicto Ejecutivo Ponderado ($I_c$)**:
   - Calcular el índice compuesto y emitir dictamen final: **TIER-1 (Prioritario)**, **TIER-2 (Condicional)** o **RECHAZO**.
