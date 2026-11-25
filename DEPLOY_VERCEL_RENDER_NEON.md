# Guía de Despliegue: Neon + Render + Vercel

## 1. Base de Datos PostgreSQL en Neon (`https://neon.com`)
1. Creá un proyecto en **Neon** (ej. `vakera-db`).
2. Copiá la **Connection String** (con `?sslmode=require`, ej: `postgresql://usuario:clave@ep-xxx.neon.tech/neondb?sslmode=require`).
3. Desde tu terminal local (en la raíz del proyecto), aplicá las tablas y datos iniciales contra Neon:
   ```powershell
   $env:DATABASE_URL="TU_CONNECTION_STRING_DE_NEON"
   npx prisma db push
   npx prisma db seed
   ```

---

## 2. Backends (Node.js + Django) en Render (`https://render.com`)
El archivo `render.yaml` en la raíz define ambos servicios (`vakera-node-api` y `vakera-python-api`):
1. En el **Render Dashboard**, elegí **New + → Blueprint** y conectá tu repositorio de GitHub (`Criss3402/VakeraGanaderia`).
2. Render detectará `render.yaml` y te pedirá completar las variables compartidas:
   - `DATABASE_URL`: la URL de **Neon**.
   - `JWT_SECRET`: una clave secreta larga compartida entre Node y Django (mínimo 32 caracteres).
   - `INTERNAL_WS_SECRET`: otra clave secreta compartida para el puente `/api/py/ws/emit`.
   - `DJANGO_SECRET_KEY`: clave secreta de Django (mínimo 50 caracteres).
   - `FRONTEND_URL`: URL de tu app en Vercel (ej. `https://vakera.vercel.app`).
   - `CORS_ORIGINS`: URL de tu app en Vercel (ej. `https://vakera.vercel.app`).
   - `PYTHON_WS_EMIT_URL`: URL pública de tu servicio Django en Render + `/api/py/ws/emit` (ej. `https://vakera-python-api.onrender.com/api/py/ws/emit`).
3. Verificá que ambos servicios respondan:
   - `https://<tu-node>.onrender.com/api/health`
   - `https://<tu-django>.onrender.com/api/py/health`

---

## 3. Frontend (React + Vite) en Vercel (`https://vercel.com`)
1. Si tus servicios en Render tienen un nombre distinto a `vakera-node-api` / `vakera-python-api`, actualizá los dominios en `client/vercel.json`.
2. En **Vercel → Add New Project**, importá el repositorio y configurá:
   - **Root Directory:** `client`
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. En **Environment Variables** de Vercel agregá:
   - `VITE_WS_URL` = `wss://<tu-django>.onrender.com` (necesario porque Vercel no proxea WebSockets).
4. Hacé clic en **Deploy**.
