# SPRINT S100 - Paridad Transversal de Internacionalización (i18n) e Interfaces Bilingües
**Objetivo**: Garantizar paridad bilingüe (EN/ES) en flujos de cliente mayorista, erradicar textos hardcoded en español en autenticación, pedidos y checkout, y montar LanguageSwitcher en todas las pantallas.
**Fecha**: 2026-11-19

- [x] **TASK-100-01** [TASK] Montaje de LanguageSwitcher en rutas de autenticación (/auth/login, /auth/register, /auth/forgot-password, /auth/reset-password) y sub-footer bar de Footer.tsx
- [x] **TASK-100-02** [TASK] Banners bilingües y mensajes de error de revisión de cuenta en login, register y forgot-password
- [x] **TASK-100-03** [TASK] Corrección de bug de ternario L1060 en orders/page.tsx, paridad bilingüe en batch settlement, folios y botones
- [x] **TASK-100-04** [TASK] Paridad i18n en expediente de orden (orders/[id]/page.tsx): Foto/Photo, Especialidad, ST-120 Exempt, Nota de Crédito
- [x] **TASK-100-05** [TASK] Envoltura bilingüe con lbl() en notificaciones, alertas de fecha mínima de horneado y monto mínimo en checkout/page.tsx
- [x] **TASK-100-06** [TASK] Pruebas automatizadas de paridad i18n, compilación limpia de frontend y backend, y despliegue a testing y producción
