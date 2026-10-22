# INFORME DE AUDITORÍA DE INFRAESTRUCTURA, DOCKER Y SCRIPTS VPS — SPRINT S23
**Proyecto**: pj-air (Pedidos Jhoanes)  
**Fecha de Ejecución**: 2026-10-22  
**Gobernanza**: Kernel 4.0.0 — Protocolo de Gobernanza Líquida  
**Alcance**: Dockerfiles (frontend/backend), Nginx, PM2, Scripts de Despliegue Remoto (`backend/scripts/`), Idempotencia y Recuperación ante Desastres  

---

## 1. Resumen Ejecutivo
Se realizó una auditoría profunda de los artefactos de infraestructura, contenerización y scripts operativos de despliegue en VPS para `pj-air`.

### Hallazgos Críticos Principales:
1. **Ausencia Total de `.dockerignore` (VULN-23-01)**:
   - Ni en la raíz ni en `backend/` ni en `frontend/` existe un archivo `.dockerignore`.
   - `COPY . .` en los Dockerfiles copia indiscriminadamente `node_modules`, directorios `.git`, bases de datos locales y copias de seguridad de producción (`database.remote.prod.bak` de casi 2MB), inflando los contenedores y exponiendo datos sensibles en las capas de imagen de Docker.
2. **Variables Huérfanas de Supabase en `frontend/Dockerfile` (INFRA-23-01)**:
   - `frontend/Dockerfile` aún declara `ARG NEXT_PUBLIC_SUPABASE_URL` y `ARG NEXT_PUBLIC_SUPABASE_ANON_KEY`, contradiciendo el descarte formal y desinstalación de Supabase efectuada en S18.
3. **Fragilidad de Copia en Caliente en SQLite (DATA-23-01)**:
   - `remote-backup-deploy.js` realiza el respaldo remoto mediante `cp database.sqlite database.sqlite.bak_...`. Un comando `cp` estándar sobre SQLite en caliente bajo concurrencia puede capturar páginas a medio escribir en el archivo WAL o lock transitorio, generando un backup corrupto. Debe utilizarse la API `.backup` o `sqlite3 database.sqlite ".backup 'backup_path'"`.
4. **Pipeline de Despliegue no Atómico sin Rollback (DEVOPS-23-01)**:
   - En `remote-backup-deploy.js` y `remote-deploy-only.js`, la compilación (`npm run build`) se ejecuta en vivo en el servidor de producción. Si la compilación falla (por ejemplo por agotamiento de memoria en el VPS o error de tipos), la aplicación queda caída y no existe un mecanismo de marcha atrás (rollback automático).
   - Uso de `pm2 restart` en lugar de `pm2 reload` (cero downtime).

---

## 2. Hoja de Ruta Dinámica para Sprint S24 (Consolidación DevOps y Cierre Final)
Conforme a la regla de que la evaluación define dinámicamente la remediación, el **Sprint S24** se poblará con las siguientes tareas exactas:

1. **TASK-24-01 [INFRA/TECH]**: Crear `.dockerignore` exhaustivos en raíz, frontend y backend; limpiar variables de Supabase en `frontend/Dockerfile`.
2. **TASK-24-02 [INFRA/TECH]**: Refactorizar scripts de backup remoto (`remote-backup-deploy.js`, `remote-deploy-only.js`) para usar respaldo atómico `sqlite3 .backup` y `pm2 reload` con verificación de salida.
3. **TASK-24-03 [INFRA/DOC]**: Elaborar la Guía Operativa de Recuperación y Manual de Despliegue Certificado en `vault/intel/OPERATIONS_DISASTER_RECOVERY.md`.
4. **TASK-24-04 [GOV/BASELINE]**: Ejecutar auditoría integral final (`logix audit`), sincronizar backlog y re-sellar el ADN del satélite con `logix baseline -f`.
