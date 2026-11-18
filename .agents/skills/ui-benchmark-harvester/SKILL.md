---
name: ui-benchmark-harvester
description: Motor autónomo de benchmarking visual y extracción de patrones de interacción (Rol UX-Scout). Investiga soluciones de diseño de apps líderes mediante APIs públicas de App Store/Play Store y navegación web viva (browser_subagent), deconstruyendo estilos y tokens de diseño sin depender de paywalls.
---

# UI Benchmark Harvester (Rol: UX-Scout)

> **Misión**: Dotar al agente de la capacidad de investigar, extraer y deconstruir patrones visuales y flujos de interacción probados en el mercado por empresas líderes, erradicando la necesidad de búsqueda manual por el Product Owner.

---

## 1. Protocolo de Extracción (3 Vías Autorizadas)

1. **Vía A — Inspección Viva en Web (`browser_subagent`)**:
   - Para aplicaciones web públicas de referencia (Linear, Stripe, Airbnb, etc.).
   - Navegar headless a la URL del flujo objetivo y capturar screenshot en alta resolución.
   - Extraer estilos CSS computados del DOM: `font-size`, `padding`, `border-radius`, `box-shadow` y colores primarios.

2. **Vía B — API Pública de Tiendas Oficiales (`scripts/harvest_store_assets.py`)**:
   - Para aplicaciones móviles líderes (Revolut, Uber, Oscaro, Amazon).
   - Consultar la API pública de Apple iTunes Search (`itunes.apple.com/lookup` o `search`) o feeds de Play Store.
   - Extraer los screenshots nativos de marketing y flujos de usuario en resolución retina sin paywalls.

3. **Vía C — Catálogos y Showcases Abiertos**:
   - Consultar portales y repositorios públicos abiertos de UI para patrones de navegación específicos.

---

## 2. Deconstrucción Anatómica y Mapeo a Tokens
- Todo patrón extraído debe pasar por el **Translation Gate**:
  - Los colores observados se traducen a la SSSoT de la flota (`vault/contracts/design_tokens.json`).
  - Las fuentes se adaptan a la escala tipográfica institucional.
  - Los componentes generados deben respetar la arquitectura **Thin Client (§40)** conectándose directamente a `packages/axioma`.

---

## 3. Despacho y Presentación
- Las capturas y deconstrucción de patrones se organizan en `.meta/benchmarks/<feature>/` o se exportan hacia el tablero de **Miro** utilizando el `VisualBoardExporter`.
