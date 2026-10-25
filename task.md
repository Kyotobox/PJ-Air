# SPRINT S40 - Sprint 40: Motor Dinámico de Zonas de Delivery por ZIP Codes y Mínimos de Compra para Free Delivery
**Objetivo**: Implementar la gestión integral de zonas de entrega por bloques de códigos postales con tarifas base y montos mínimos de compra para envío gratis configurables desde el panel administrativo, con resolución automática en checkout y prioridad de tarifas acordadas B2B.
**Fecha**: 2026-10-25

- [x] **TASK-40-01** [DOMAIN/DELIVERY-ZONES-CORE] Entidad DeliveryZone (name, zip_codes, base_fee, min_free_delivery_amount, is_active), repositorio TypeORM, servicio y endpoints CRUD en backend NestJS.
- [x] **TASK-40-02** [ADMIN/ZONES-MANAGEMENT-UI] Panel de administración en /admin/zones para crear, editar y activar/desactivar zonas, gestionar bloques de ZIPs, tarifas base y montos mínimos de envío gratis.
- [x] **TASK-40-03** [CHECKOUT/ZIP-AUTOCALC-ENGINE] Lógica de resolución en checkout: detectar ZIP de la dirección seleccionada, autocalcular tarifa base, evaluar si subtotal >= min_free_delivery_amount (bonificando a $0.00 con badge de éxito) o mostrar aviso de cuánto falta para el envío gratis.
- [x] **TASK-40-04** [LOGISTICS/DELIVERY-OVERRIDE-PRECEDENCE] Matriz de precedencia: Pickup ($0) > Tarifa Especial fijada por Admin a Cliente VIP (user.delivery_fee) > Zona ZIP calculada > Tarifa General de contingencia (fallback si el ZIP no está mapeado).
- [x] **TASK-40-05** [E2E/ZONES-REGRESSION-BASELINE] Pruebas de integración E2E (autocálculo de tarifa por ZIP, activación de free delivery al cruzar umbral de compra, y fallback de ZIP no registrado), certificación logix audit.
