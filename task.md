# SPRINT S58 - Sprint 58: Gestor de Banners Hero de Temporada, Galería de Medios Reutilizables y Renderizado Modular 1:1
**Objetivo**: Implementar el gestor integral de Banners Hero con galería de medios reutilizables para imágenes de temporada, renderizado condicional modular (0, 1 o 2 botones, o solo foto limpia con fade lateral CSS), selector interactivo en /admin/banners con dropdown de destinos y estética 1:1 con la referencia del cliente.
**Fecha**: 2026-11-01

- [x] **TASK-58-01** [MEDIA/SEASONAL-ASSETS-PIPELINE] Ingesta, compresión y normalización de las 10 fotos de temporada del cliente en backend/uploads/banners/seasonal/, frontend/public/images/banners/seasonal/ y vault/assets/seasonal_banners/.
- [ ] **TASK-58-02** [CORE/GALLERY-API-AND-SCHEMA] Soporte para segundo botón opcional en la entidad Banner y creación del endpoint GET /banners/gallery en BannersController con tests unitarios en banners.controller.spec.ts.
- [ ] **TASK-58-03** [UI/ADMIN-MEDIA-PICKER-AND-DESTINATIONS] Selector interactivo de Galería de Temporada (Media Picker) en /admin/banners con cuadrícula visual de miniaturas, menú desplegable de destinos estándar (Catálogo, Categorías, Registro, Horarios, Perfil, WhatsApp, Libre) y control de 0, 1 o 2 botones.
- [ ] **TASK-58-04** [UI/STOREFRONT-HERO-MODULAR-FADE] Renderizado modular en tienda principal (app/page.tsx): fade lateral progresivo, badge superior dorado (JHOANES WHOLESALE), botón primario ámbar, botón secundario outline, sellos de confianza al pie y soporte bilingüe.
- [ ] **TASK-58-05** [SEED/PRELOADED-SEASONAL-BANNERS] Precarga de banners iniciales de alta fidelidad con fotos de temporada horizontales (mesa de bollería y catering) activos en base de datos.
- [ ] **TASK-58-06** [TEST/INTEGRATION-BUILD-CERTIFICATION] Certificación integral de pruebas unitarias backend y builds sin errores (nest build y next build).
