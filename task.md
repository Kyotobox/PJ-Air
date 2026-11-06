# SPRINT S63 - Sprint Activo
**Objetivo**: Implementar inhabilitación de clientes en admin y login, motor backend determinista para SMS OTP sin reCAPTCHA, bolsa de saldo a favor (store_credit), detección de pedidos complementarios con flete $0, despacho de facturas oficiales por email y jerarquía estricta de delivery fee.
**Fecha**: 2026-11-06

- [x] **TASK-63-01** [TECH/AUTH-USER-STATUS] Inhabilitación de clientes por administración en DB, login y panel /admin/clients
- [x] **TASK-63-02** [TECH/AUTH-BACKEND-SMS-OTP] Endpoints y motor backend para SMS OTP determinista sin reCAPTCHA
- [x] **TASK-63-03** [DOMAIN/STORE-CREDIT-WALLET] Bolsa de saldo a favor (store_credit) con descuento automático en checkout y estado de cuenta
- [x] **TASK-63-04** [DOMAIN/COMPLEMENTARY-ORDERS] Regla de pedidos complementarios con tarifa de flete a $0.00
- [x] **TASK-63-05** [TECH/EMAIL-INVOICE-DISPATCH] Despacho de facturas oficiales en inglés por correo electrónico (PDF adjunto)
- [x] **TASK-63-06** [DOMAIN/DELIVERY-FEE-HIERARCHY] Precedencia de tarifa personalizada del cliente sobre matriz de millaje
- [x] **TASK-63-07** [TEST/S63-CERTIFICATION] Suite de certificación integral de Sprint S63 y verificación de build Next.js/NestJS
