# SPRINT S38 - Sprint 38: Pulido de Registro B2B, Simplificación de Direcciones y Blindaje de Cancelación de Pagos Stripe
**Objetivo**: Implementar feedback audiovisual del cliente: eliminación del campo alias en registro de direcciones, obligatoriedad del nombre de compañía B2B en el registro, y corrección integral del flujo de cancelación del modal de pagos Stripe para preservar el carrito y evitar falsas confirmaciones de orden.
**Fecha**: 2026-10-25

- [x] **TASK-38-01** [UI/ADDRESSES] Suprimir campo de entrada alias en la UI de creación de direcciones (/profile/addresses/new y /checkout), asignando internamente Principal o Entrega para preservar la integridad del modelo.
- [x] **TASK-38-02** [DOMAIN/B2B-AUTH] Establecer company_name como obligatorio en el registro de usuarios (RegisterForm y auth.service.signup), eliminando etiqueta Optional y adaptando payloads de pruebas existentes.
- [x] **TASK-38-03** [CHECKOUT/STRIPE-CANCEL] Blindar cancelación de Stripe en checkout (onCancel sin vaciar carrito ni redirigir a orden confirmada) y condicionar vista /orders/[id] para reflejar Pago Pendiente cuando no esté pagado ni tenga crédito.
- [x] **TASK-38-04** [E2E/REGRESSION-BASELINE] Verificación empírica con suite Playwright y tests unitarios de backend, certificación con logix audit y commit atómico.
