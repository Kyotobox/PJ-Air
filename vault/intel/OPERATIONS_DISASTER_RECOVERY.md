# MANUAL DE OPERACIONES Y RECUPERACIÓN ANTE DESASTRES — PJ-AIR
**Proyecto**: pj-air (Pedidos Jhoanes)  
**Versión de Gobernanza**: 4.0.0  
**Arquitectura**: Next.js 16 (Frontend) + NestJS / TypeORM (Backend) + SQLite3  

---

## 1. Topología del Servidor de Producción (VPS)
- **Host**: `187.124.67.53`
- **Ruta de la Aplicación**: `/var/www/pj-air`
- **Base de Datos Productiva**: `/var/www/pj-air/database.sqlite`
- **Procesos PM2**:
  - `pj-air-backend`: API NestJS (Puerto 3001)
  - `pj-air-frontend`: Next.js App Router (Puerto 3000)
- **Servidor Web Reverso**: Nginx con terminación SSL y enrutamiento hacia localhost:3000 (UI) y localhost:3001 (API).

---

## 2. Protocolo de Despliegue Seguro (Zero-Downtime)

### Requisitos Previos:
Definir variables en entorno local o runner:
```bash
export REMOTE_SSH_PASSWORD="<contraseña_vps>"
export REMOTE_SSH_HOST="187.124.67.53"
export REMOTE_SSH_USER="root"
```

### Ejecución de Despliegue con Respaldo Atómico:
```bash
node backend/scripts/remote-backup-deploy.js
```
El script ejecuta automáticamente:
1. **Respaldo atómico en caliente** vía SQLite API: `sqlite3 database.sqlite ".backup 'database.sqlite.bak_YYYYMMDD_HHMMSS'"`
2. **Rotación FIFO**: Mantiene las 5 copias más recientes y elimina remanentes antiguos.
3. **Descarga local de seguridad**: Descarga el backup actual a `backend/database.remote.prod.bak`.
4. **Pull y Build**: Descarga código actualizado, ejecuta `npm run build` y aplica los índices secundarios B-Tree (`node scripts/apply-indexes.js`).
5. **Zero-Downtime Reload**: Ejecuta `pm2 reload pj-air-backend pj-air-frontend`.

---

## 3. Protocolo de Recuperación ante Desastres (Rollback Rápido)

### Escenario A: Fallo de Compilación o Despliegue Roto
Si el despliegue falla o un error bloquea la interfaz:
```bash
ssh root@187.124.67.53
cd /var/www/pj-air
git reset --hard HEAD~1
cd backend && npm run build
cd ../frontend && npm run build
pm2 reload all
```

### Escenario B: Corrupción o Pérdida de Datos en SQLite
Para restaurar la base de datos al estado previo al despliegue:
1. Localizar el backup más reciente:
   ```bash
   ls -lt /var/www/pj-air/database.sqlite.bak_*
   ```
2. Detener la aplicación temporalmente para evitar transacciones en vuelo:
   ```bash
   pm2 stop pj-air-backend
   ```
3. Restaurar la copia atómica:
   ```bash
   cp /var/www/pj-air/database.sqlite.bak_YYYYMMDD_HHMMSS /var/www/pj-air/database.sqlite
   ```
4. Aplicar índices secundarios:
   ```bash
   node /var/www/pj-air/backend/scripts/apply-indexes.js
   ```
5. Reiniciar servicio:
   ```bash
   pm2 start pj-air-backend
   ```
6. Verificar integridad:
   ```bash
   sqlite3 /var/www/pj-air/database.sqlite "PRAGMA integrity_check;"
   sqlite3 /var/www/pj-air/database.sqlite "PRAGMA foreign_key_check;"
   ```

---

## 4. Verificación de Salud Post-Despliegue (Smoke Test Checklist)
1. **API Health**: `curl -I http://localhost:3001/products` (debe responder HTTP 200).
2. **Frontend Health**: `curl -I http://localhost:3000` (debe responder HTTP 200).
3. **PM2 Status**: `pm2 status` (ambos procesos con status `online` y memoria estable < 200MB).
4. **Logs en Vivo**: `node backend/scripts/remote-check-logs.js`.
