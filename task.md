# SPRINT S52 - Sprint 52: Gestor Dinámico de Banners B2B para Temporadas y Ocasiones
**Objetivo**: Establecer un módulo administrativo completo para que el negocio pueda subir, editar, activar/pausar y ordenar banners rotativos según la temporada, eventos o promociones especiales, alimentando dinámicamente el carrusel de la Home B2B.
**Fecha**: 2026-10-30

- [x] **TASK-52-01** [DOMAIN/BANNER-CMS-SCHEMA] Entidad Banner en TypeORM y tabla física SQLite banners con atributos de temporada, títulos ES/EN, imagen, link, orden y estado activo.
- [x] **TASK-52-02** [DOMAIN/BANNERS-SERVICE-API] Módulo BannersModule en NestJS con CRUD completo, endpoints públicos GET /banners/public y endpoints administrativos con upload en uploads/banners/.
- [x] **TASK-52-03** [UI/ADMIN-BANNERS-MANAGER] Pantalla /admin/banners con previsualización interactiva de banners, switch activo/inactivo en 1 clic y modal de creación/edición con carga de imágenes.
- [x] **TASK-52-04** [UI/ADMIN-NAV-LINK] Acceso directo y tarjeta de gestión Banners de Temporada en el panel y menú de navegación de /admin.
- [x] **TASK-52-05** [UI/HOME-DYNAMIC-BANNERS-LINK] Conexión reactiva del carrusel Hero en frontend/app/page.tsx a GET /banners/public con soporte de fallback gourmet por defecto.
- [x] **TASK-52-06** [TEST/S52-BANNERS-CMS-SUITE] Suite completa de pruebas unitarias para BannersService (happy & sad paths) y validación de compilación limpia de frontend y backend.
