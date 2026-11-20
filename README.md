# Vakera — Sistema de Gestión y Trazabilidad Ganadera

> 📋 **Especificación Funcional y Roles:** Para consultar el alcance, matriz de roles (RBAC) y fases, ver [PLAN_DE_TRABAJO.md](./PLAN_DE_TRABAJO.md).  
> 🏛️ **Arquitectura Híbrida Coexistente:** Para consultar el diseño técnico de convivencia entre Node.js y Python/Django, ver [ARQUITECTURA_DJANGO_NODE.md](./ARQUITECTURA_DJANGO_NODE.md).

Vakera es una plataforma web para establecimientos ganaderos con arquitectura modular desacoplada y backend políglota:

- **`client/`** — Frontend SPA en React 18 + Vite (Vanilla CSS responsivo, diseño sin dependencias externas).
- **`server/`** — Backend Transaccional y Operativo en Node.js + Express (CommonJS, Prisma ORM, fallback en memoria, autenticación JWT, RBAC).
- **`server_py/`** — Backend Analítico y Documental en Python + Django 6.1 (Django REST Framework, modelos bio-nutricionales, generación de informes en PDF con ReportLab y planillas Excel con openpyxl).
- **`prisma/`** — Definición de esquema de base de datos PostgreSQL, migraciones DDL y semillas demo.

---

## Estructura del Repositorio

```
VakeraGanaderia/
├── client/              # SPA Frontend React (puerto 5173)
├── server/              # Backend Operativo Node.js / Express (puerto 4000)
├── server_py/           # Backend Analítico Python / Django (puerto 8000)
├── prisma/              # Esquema DDL de datos PostgreSQL y scripts de seed
├── docker-compose.yml   # Contenedores para PostgreSQL 16 y Django
├── package.json         # Orquestador raíz de scripts
├── ARQUITECTURA_DJANGO_NODE.md  # Detalle de coexistencia Node + Django
├── PLAN_DE_TRABAJO.md   # Especificación funcional y de roles
└── README.md            # Guía rápida de inicio
```

---

## Cómo Ejecutar el Proyecto

### 1. Iniciar Base de Datos PostgreSQL (Docker)

```bash
# Iniciar contenedor de PostgreSQL en segundo plano (puerto 5433)
npm run db:up

# Aplicar migraciones y poblar datos iniciales demo
npm run db:migrate
npm run db:seed
```

> **Nota:** Si Docker no está instalado o activo, el backend de Node.js activa automáticamente un mecanismo de contingencia en memoria (`server/src/config/db.js`), permitiendo probar la interfaz y flujos operativos inmediatamente.

---

### 2. Iniciar Backend Operativo (Node.js + Express)

```bash
# Desde la raíz:
npm run server:node

# O directamente desde la carpeta server:
cd server
npm run dev
```

Escucha en `http://localhost:4000`. Atiende:
- `/api/health` — Estado de salud del servicio.
- `/api/auth/*` — Registro, login con emisión de JWT, verificación de email, recuperación de contraseña y acceso/registro con Google OAuth 2.0.
- `/api/contacto` — Recepción de mensajes del formulario de contacto (persistencia en PostgreSQL + envío por Gmail/SMTP a `soporte.vakera@gmail.com`).
- `/api/dashboard/*` — Ganado, potreros, sanidad, stock de insumos y partes diarios.
- `/api/permisos/*` — Gestión y auditoría de roles.

---

### Variables de Entorno (`.env` en raíz y `server/.env`)

El repositorio utiliza dos archivos `.env` según el proceso que se ejecute:

1. **`.env` (en la raíz del proyecto):** usado por **Prisma CLI** (`db:migrate`, `db:seed`, `db:studio`), **Docker Compose** (`db:up`) y el **backend Python/Django** (`server_py/`). Incluye `DATABASE_URL`, `JWT_SECRET`, `DJANGO_SECRET_KEY` y `DJANGO_DEBUG`.
2. **`server/.env` (dentro de `server/`):** usado por el **backend Node.js / Express** al iniciar con `npm run server:node`. Incluye:
   - Servidor y BD: `PORT`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`.
   - Correo Gmail/SMTP (verificación, recuperación y contacto a `soporte.vakera@gmail.com`): `SMTP_SERVICE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `CONTACTO_DESTINO_EMAIL` (opcional).
   - Google OAuth 2.0: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (`http://localhost:4000/api/auth/google/callback`) y `FRONTEND_URL` (`http://localhost:5173`).

---

### 3. Iniciar Backend Analítico y de Reportes (Python + Django)

```bash
# Desde la raíz:
npm run server:py

# O manualmente:
python server_py/manage.py runserver 8000
```

Escucha en `http://localhost:8000` bajo el prefijo unificado `/api/py/`. Atiende:
- `GET /api/py/health` — Verificación de operatividad del motor Python.
- `GET /api/py/reportes/resumen-ejecutivo` — Métricas analíticas consolidadas de hacienda.
- `GET /api/py/reportes/exportar-pdf` — Generación y descarga de informe oficial en PDF (ReportLab).
- `GET /api/py/reportes/exportar-excel` — Exportación de inventario general en planilla Excel (.xlsx).
- `POST /api/py/nutricion/calcular-racion` — Algoritmo de balance nutricional bovino (MS, PB, forraje vs suplemento).
- `GET /api/py/nutricion/proyeccion-peso` — Proyecciones de ganancia diaria de peso (ADG) a 30, 60, 90 y 120 días.

---

### 4. Iniciar Frontend (React + Vite)

```bash
# Desde la raíz:
npm run client:dev

# O manualmente:
cd client
npm run dev
```

Se abre en `http://localhost:5173`.  
El archivo `client/vite.config.js` enruta transparentemente las solicitudes sin problemas de CORS:
- `/api/py/*` ──► `http://localhost:8000` (Django)
- `/api/*`    ──► `http://localhost:4000` (Node.js)

---

## Tests y Verificación de Calidad

```bash
# Ejecutar tests unitarios del backend Node.js
npm run test:node

# Ejecutar tests del frontend React (Vitest)
npm run test:client

# Ejecutar suite de pruebas de Python (JWT interoperable, RBAC, nutrición y reportes)
npm run py:test

# Verificar configuración del proyecto Django
npm run py:check

# Compilar bundle de producción de React
npm --prefix client run build
```

---

## Roles y Cuentas Demo

Contraseña universal para todas las cuentas demo: `password123`

| Rol | Correo Demo | Alcance Principal |
| :--- | :--- | :--- |
| **Dueño** | `dueno@vakera.com` | Dashboard ejecutivo, reportes PDF/Excel, métricas y auditoría |
| **Capataz** | `capataz@vakera.com` | Revisión y aprobación de partes diarios, asignación de tareas |
| **Peón** | `peon@vakera.com` | Carga móvil de novedades diarias en el campo |
| **Oficina** | `oficina@vakera.com` | Control de stock de insumos, planillas contables y compras |
| **Veterinario** | `veterinario@vakera.com` | Calendario sanitario oficial, vacunas y tratamientos |
