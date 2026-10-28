# MAPA BICAMERAL DE GOBERNANZA Y ARQUITECTURA: PJ-AIR
> **Nodo**: pj-air | **Categoría**: Satélite de Producto (Private Jet Aviation & Fleet Chartering) | **Axioma**: 4.0.0

## 1. Resumen Ejecutivo (PO Perspective)
- **Dominio**: Aviación ejecutiva privada, gestión de vuelos chárter, cálculo de combustible y cotizaciones VIP.
- **Modelo de Datos**: SQLite local WAL y cache de persistencia para tiempos de vuelo, aeronaves y disponibilidad de flota.
- **Seguridad**: Autenticación desacoplada y roles estrictos (admin/user) gobernados por `kernel_core`.
- **Integración con Flota**: Consumo agnóstico de axiomas transversales y contratos unificados de `conext_core`.

## 2. Mapa Arquitectónico (Technical Perspective)
- **Capa Dominio**: Entidades de vuelo puro y casos de uso sin dependencias de frameworks de UI (§39 Pure Dart Core).
- **Capa Datos**: Repositorios locales, esquemas de aeronaves, bitácoras de vuelo y conectores de precios.
- **Capa Presentación**: Thin Client Flutter UI (§40) consumiendo Casos de Uso vía Riverpod sin SQL en widgets.
- **Gobernanza**: Tolerancia cero a mocks en producción (§4) y cobertura obligatoria de fallos con aserciones negativas `throwsA` (§6).
