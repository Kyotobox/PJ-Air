# SPRINT S31 - Sprint 31: Pulido de Interfaces Comerciales B2B, Badges Financieros y Filtros Administrativos
**Objetivo**: Elevar la experiencia de usuario B2B reemplazando alertas nativas por banners elegantes en checkout, incorporando badges de estado de pago en confirmación e historial de pedidos, e implementando filtros rápidos comerciales (Todos, Solo Crédito, Solo Contado, Con Sobregiro) en el panel administrativo.
**Fecha**: 2026-11-11

- [ ] **TASK-31-01** [CHECKOUT/UI] Reemplazo de popups nativos alert() en checkout por notificaciones estilizadas integradas en el diseño (banners animados/toasts Tailwind).
- [ ] **TASK-31-02** [ORDERS/UI] Integración de badges de estado financiero (Pagado con Stripe vs Compra a Crédito con fecha de vencimiento) en /orders/[id] y en el historial de pedidos /orders.
- [ ] **TASK-31-03** [ADMIN/CLIENTS] Implementación de barra de filtros rápidos comerciales en /admin/clients: Todos, Solo Crédito, Solo Contado y Con Sobregiro con conteos dinámicos.
- [ ] **TASK-31-04** [E2E/GOV] Suite automatizada Playwright con capturas de pantalla de los 4 filtros, verificación de paridad bilingüe (ES/EN), auditoría logix audit y certificación baseline.
