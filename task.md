# SPRINT S39 - Sprint 39: Integración de Zelle B2B, Esquema Packaging & Handling con Bonificación y Blindaje de Corte de Producción
**Objetivo**: Incorporar Zelle como método de pago B2B con captura y auditoría de referencia, implementar el esquema de Packaging & Handling Fee con bonificación por pago directo para proteger márgenes mayoristas, y blindar el corte de producción de las 12:00 PM en el calendario del frontend.
**Fecha**: 2026-10-25

- [ ] **TASK-39-01** [DOMAIN/ZELLE-CORE] Extensión de Order con payment_method ('stripe'|'zelle'|'credit'), zelle_reference, packaging_fee y packaging_discount. Endpoints de registro y conciliación de Zelle.
- [ ] **TASK-39-02** [UI/CHECKOUT-ZELLE-FEES] Selector de Zelle en /checkout con datos bancarios, input de referencia y desglose dinámico: cargo de empaque (3.5%) vs bonificación automática por Zelle (-3.5%).
- [ ] **TASK-39-03** [ADMIN/ZELLE-AUDIT-APPROVAL] Panel en /admin/orders para auditar y conciliar transferencias Zelle: contrastar referencia y botón de aprobación manual para habilitar orden en torre de producción.
- [ ] **TASK-39-04** [UI/CUTOFF-CALENDAR-GUARD] Inhabilitar dinámicamente en el calendario de checkout la fecha de entrega del día siguiente cuando la hora en America/New_York supere las 12:00 PM.
- [ ] **TASK-39-05** [E2E/SAD-PATHS-REGRESSION] Suite de pruebas unitarias y e2e cubriendo sad paths (referencias duplicadas, evasión de corte, cancelaciones) y certificación con logix audit.
