# SPRINT S102 - Auditoría Global Omnipresente (Read-Only SoD), Paginación de Órdenes y Prevalencia de Admin
**Objetivo**: Convertir el rol auditor en un inspector integral (lectura libre en todo el ERP) manteniendo blindaje SoD contra mutaciones, erradicar el secuestro por cookies y eliminar el límite take:100.
**Fecha**: 2026-11-24

- [x] **TASK-102-01** [TASK] Prevalencia de sesión Admin sobre cookies residuales y saneamiento de session_role en AuthContext y orders/page.tsx
- [ ] **TASK-102-02** [TASK] Auditoría Global: Apertura de lectura en middleware y sidebar (/admin/*, /produccion, /delivery) con interfaz Read-Only SoD
- [x] **TASK-102-03** [TASK] Unificación de autorización Read-Only para auditor en delivery-incidents.service.ts y tax.service.ts
- [ ] **TASK-102-04** [TASK] Eliminación de take:100 en orders.service.ts con soporte de paginación y búsqueda transversal en base de datos
- [ ] **TASK-102-05** [TASK] Búsqueda omnicanal en /admin/orders con badges de coincidencia inter-pestañas y normalización de fechas
- [ ] **TASK-102-06** [TASK] Suite de pruebas unitarias Sad Path (§6) para rol auditor, build limpio y certificación en VPS testing y prod
