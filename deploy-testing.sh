#!/usr/bin/env bash
set -e

# ==============================================================================
# Script de Despliegue Idempotente para TESTING.JHOANES.COM
# AISLAMIENTO TOTAL: Este script solo opera en /var/www/pj-air-testing y
# los procesos PM2 pj-air-backend-testing y pj-air-frontend-testing.
# ==============================================================================

TESTING_DIR="/var/www/pj-air-testing"
PROD_DIR="/var/www/pj-air"

echo "=== 1. Verificando aislamiento de entorno ==="
mkdir -p "$TESTING_DIR"
cd "$TESTING_DIR"

if [ "$(pwd)" = "$PROD_DIR" ]; then
    echo "ERROR CRÍTICO: Se ha intentado ejecutar en el directorio de producción. Abortando."
    exit 1
fi

echo "=== 2. Sincronizando código desde GitHub (rama conext) ==="
if [ ! -d ".git" ]; then
    git clone -b conext https://github.com/jhpanes/pj-air.git .
else
    git fetch origin
    git checkout conext
    git pull origin conext
fi

echo "=== 3. Aprovisionando base de datos de testing ==="
if [ ! -f "database-testing.sqlite" ]; then
    if [ -f "/var/www/pj-air/database.sqlite" ]; then
        cp "/var/www/pj-air/database.sqlite" "database-testing.sqlite"
        echo "Copia de base de datos creada en database-testing.sqlite"
    fi
else
    cp "database-testing.sqlite" "database-testing.sqlite.bak_$(date +%Y%m%d_%H%M%S)"
fi

echo "=== 4. Compilando Backend Testing ==="
cd "$TESTING_DIR/backend"
npm install --production=false
npm run build

echo "=== 5. Compilando Frontend Testing ==="
cd "$TESTING_DIR/frontend"
npm install --production=false
NEXT_PUBLIC_API_URL="https://testing.jhoanes.com/api" npm run build

echo "=== 6. Levantando procesos PM2 en puertos 3200 y 3201 ==="
cd "$TESTING_DIR"
pm2 delete pj-air-backend-testing || true
pm2 delete pj-air-frontend-testing || true

BACKEND_PORT=3201 PORT=3201 DATABASE_PATH=../database-testing.sqlite FRONTEND_URL=https://testing.jhoanes.com pm2 start dist/src/main.js --name pj-air-backend-testing --cwd "$TESTING_DIR/backend"
PORT=3200 NEXT_PUBLIC_API_URL=https://testing.jhoanes.com/api pm2 start "$TESTING_DIR/node_modules/next/dist/bin/next" --name pj-air-frontend-testing --cwd "$TESTING_DIR/frontend" -- start -p 3200
pm2 save

echo "=========================================================="
echo "  TESTING.JHOANES.COM DESPLEGADO Y EN LÍNEA EXITOSAMENTE  "
echo "=========================================================="
