# SPRINT S79 - Sprint Activo
**Objetivo**: Optimización Formulario ST-120 Digital (NYS DTF Resale Certificate) y Captura de Acceso de Seguridad Nocturno (3 AM - 6 AM)
**Fecha**: 2026-11-12

- [x] **TASK-79-01** [BACKEND/TAX] Backend: Generador PDF Form ST-120 NYS DTF oficial (pdf-lib), endpoints POST /tax/generate-digital-st120 y confirmación digital con auditoría forense y almacenamiento en /uploads/st120/
- [x] **TASK-79-02** [BACKEND/SECURITY] Backend: Persistencia y endpoints de seguridad nocturna (access_code, has_key, key_location, fridge_access_required, delivery_notes) en registro de clientes y módulo de direcciones
- [x] **TASK-79-03** [FRONTEND/REGISTER] Frontend: Formulario de Registro B2B (/auth/register) con bloque de acceso nocturno de madrugada y selector dual ST-120 (1-Click Digital prellenado vs Subida directa de Foto/PDF)
- [x] **TASK-79-04** [FRONTEND/ADMIN] Frontend: Panel Admin (/admin/clients) con insignias de acceso de seguridad nocturno en tarjetas de direcciones, edición en modal y visualización/descarga de certificado ST-120
- [x] **TASK-79-05** [FRONTEND/MODAL] Frontend: Modal 1-Click de confirmación ST-120 para los 20 clientes existentes en Checkout y Perfil, permitiendo validar sus datos prellenados y firmar en 1 clic
- [x] **TASK-79-06** [DEPLOY/CERT] Certificación y Despliegue: Suites automatizadas Jest/Vitest con happy y sad paths (§6), builds en limpio, migración en VPS Testing y Producción, y recarga PM2
