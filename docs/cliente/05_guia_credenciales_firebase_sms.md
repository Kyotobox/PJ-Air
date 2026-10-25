# Guía Paso a Paso: Generación de Credenciales Firebase para SMS OTP
## Jhoanes Bakery & Wholesale — Verificación Telefónica Segura

> **Objetivo**: Configurar el servicio de autenticación por SMS (One-Time Password) con el nivel gratuito de Firebase (hasta 10,000 SMS mensuales en EE.UU. sin costo).

---

## Paso 1: Crear o Acceder al Proyecto en Firebase Console

1. Ingresar a [console.firebase.google.com](https://console.firebase.google.com/) con la cuenta de Google de la empresa.
2. Hacer clic en **"Crear un proyecto"** (o *Add project*):
   * Nombre del proyecto: `jhoanes-bakery` (o similar).
   * Aceptar términos y continuar.
   * Google Analytics: Opcional (se puede desmarcar para simplificar).
   * Clic en **Crear proyecto**.

---

## Paso 2: Activar la Autenticación por Teléfono (Phone Auth)

1. En el menú lateral izquierdo, ir a **Build** (Compilación) ➔ **Authentication**.
2. Hacer clic en **"Comenzar"** (*Get Started*).
3. En la pestaña **Sign-in method** (Método de inicio de sesión):
   * Seleccionar el proveedor **Teléfono** (*Phone*).
   * Activar el interruptor **Habilitar** (*Enable*).
4. *(Recomendado para pruebas sin costo)* En la subsección **"Números de teléfono para pruebas"**:
   * Agregar: `+1 305 555 0100` con código: `123456`.
5. Hacer clic en **Guardar** (*Save*).

---

## Paso 3: Autorizar los Dominios de la Aplicación

1. En la misma pantalla de **Authentication**, ir a la pestaña **Settings** (Configuración) ➔ **Authorized domains** (Dominios autorizados).
2. Hacer clic en **Agregar dominio** (*Add domain*) y registrar los dominios del proyecto:
   * `jhoanes.com`
   * `app.jhoanes.com`
   * `testing.jhoanes.com`
   * `localhost` (ya viene preconfigurado).

---

## Paso 4: Obtener Credenciales para el Frontend (Web App)

1. En la esquina superior izquierda, hacer clic en el engranaje ⚙️ (junto a Resumen del proyecto) ➔ **Configuración del proyecto** (*Project settings*).
2. En la pestaña **General**, bajar hasta la sección **"Tus apps"** y hacer clic en el ícono web `</>`.
3. Registrar app:
   * Nombre: `jhoanes-web`.
   * Desmarcar *Firebase Hosting*.
   * Clic en **Registrar app**.
4. Copiar los valores del objeto `firebaseConfig` para el archivo `.env` del **Frontend**:

```env
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="jhoanes-bakery.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="jhoanes-bakery"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="jhoanes-bakery.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789012"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789012:web:abcdef..."
```

---

## Paso 5: Obtener Credenciales para el Backend (Service Account)

1. En la misma pantalla de **Configuración del proyecto** ⚙️, ir a la pestaña **Cuentas de servicio** (*Service accounts*).
2. Asegurar que esté seleccionado **Node.js**.
3. Hacer clic en el botón azul **"Generar nueva clave privada"** (*Generate new private key*) y confirmar.
4. Se descargará un archivo `.json`. Abrirlo con un editor de texto y extraer los siguientes 3 campos para el archivo `.env` del **Backend**:

```env
FIREBASE_PROJECT_ID="jhoanes-bakery"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@jhoanes-bakery.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...=\n-----END PRIVATE KEY-----\n"
```

---

## Resumen de Cuota y Costos

* **Plan Spark (Gratuito)**: Incluye **10,000 verificaciones SMS gratuitas por mes** para números de EE.UU. (+1).
* **reCAPTCHA Invisible**: Integrado en el código para prevenir spam de bots sin molestar al comprador con rompecabezas.
