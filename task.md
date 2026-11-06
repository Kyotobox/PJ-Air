# SPRINT S62 - Sprint Activo
**Objetivo**: Implementar los ajustes directos solicitados por la operación: unificar campo Tax ID en registro mayorista, login exclusivo por email/clave, facturas de clientes estrictamente en inglés, corrección de textos i18n en checkout/Zelle y fix de paginación/dirección en hoja de cocina.
**Fecha**: 2026-11-06

- [x] **TASK-62-01** [UI/AUTH-SINGLE-TAX-ID] Eliminar el campo duplicado de Tax ID/EIN en el formulario de registro mayorista dejando una sola entrada unificada
- [x] **TASK-62-02** [UI/AUTH-CLEAN-EMAIL-LOGIN] Simplificar el login para acceso exclusivo mediante Correo Electrónico y Contraseña sin username
- [x] **TASK-62-03** [UI/INVOICE-PRINT-STRICT-ENGLISH] Actualizar la plantilla de impresión de factura/recibo del cliente para que esté estrictamente en idioma inglés
- [ ] **TASK-62-04** [UI/CHECKOUT-I18N-PICKUP-ZELLE] Corregir textos en español residuales en checkout cuando está en inglés (Pick up, botón de comprobante Zelle)
- [ ] **TASK-62-05** [UI/KITCHEN-PAGE-BREAK-AND-ADDRESS-FIX] Ajustar hoja de cocina: suprimir paginación fantasma MORE INFORMATION si no desborda y asegurar dirección visible
- [ ] **TASK-62-06** [TEST/S62-CERTIFICATION] Suite de pruebas de certificación y verificación de build de producción Next.js limpio
