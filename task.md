# SPRINT S46 - Cumplimiento Fiscal New York ST-120 & Visión AI
**Objetivo**: Cumplimiento fiscal de reventa de NY con captura ágil de Tax ID, carga de documento ST-120 y validación automática inteligente con Visión AI.
**Estado**: En ejecución por Worker Automa (slot 1)

- [/] **TASK-46-01** [DOMAIN/TAX-EXEMPT-SCHEMA] Columnas tax_id, st120_status, st120_doc_url, tax_exempt en User/Profile.
- [/] **TASK-46-02** [UI/REGISTER-LEAN-TAX-ID] Formulario de registro mayorista con Tax ID / NY Resale Certificate # y checkbox ST-120.
- [/] **TASK-46-03** [UI/PROFILE-ST120-UPLOAD] Carga de certificado ST-120 (PDF/imagen) en /profile.
- [/] **TASK-46-04** [DOMAIN/VISION-AI-ST120-VALIDATOR] Servicio VisionValidationService con Gemini Flash Vision API.
- [/] **TASK-46-05** [UI/ADMIN-ST120-APPROVAL] Panel /admin/clients para auditar y aprobar/rechazar ST-120.
- [/] **TASK-46-06** [DOMAIN/TAX-EXEMPT-0-PERCENT-ENGINE] Lógica de 0% Sales Tax en facturas y leyenda oficial NYS DTF.
- [/] **TASK-46-07** [TEST/ST120-AND-VISION-SUITE] Suite de pruebas unitarias para VisionValidationService y cálculo fiscal.
