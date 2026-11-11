# SPRINT S71 - Sprint S71: Corrección de Flete y Conciliación de Pagos Stripe, Restricción de Métodos ACH y Configuración de Mínimo
**Objetivo**: Sin objetivo especificado
**Fecha**: 2026-11-11

- [x] **TASK-71-01** [TASK] Reparación física de la Orden #50552F84 en base de datos de producción (remover flete de $40, dejar total en $86.88, vincular Stripe y marcar paid con balance 0)
- [x] **TASK-71-02** [TASK] Prevalencia estricta de regla de zonas con flete bonificado ($0) sobre sobreescritura de mileageFreightService en orders.service.ts con tests unitarios y sad path (§6)
- [x] **TASK-71-03** [TASK] Endpoint autorizado y seguro para confirmación de pago Stripe del cliente propietario de la orden (resolución HTTP 403) con tests unitarios y sad path (§6)
- [x] **TASK-71-04** [TASK] Restricción en Stripe Elements: excluir us_bank_account para clientes estándar, dejando solo tarjeta y wallets digitales
- [x] **TASK-71-05** [TASK] Verificación y soporte de Monto Mínimo de Pedido configurable en panel de administración (/admin) a nivel global y por cliente
- [x] **TASK-71-06** [TASK] Compilación física de Backend y Frontend, sincronización y despliegue a producción (187.124.67.53), recarga de PM2 y certificación en vivo
