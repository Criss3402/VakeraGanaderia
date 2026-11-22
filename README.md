# Vakera — Sistema de Gestión y Trazabilidad Ganadera

> 📋 **Especificación Funcional y Roles:** Para consultar el alcance, matriz de roles (RBAC) y fases, ver [PLAN_DE_TRABAJO.md](./PLAN_DE_TRABAJO.md).  
> 🏛️ **Arquitectura Híbrida Coexistente:** Para consultar el diseño técnico de convivencia entre Node.js y Python/Django, ver [ARQUITECTURA_DJANGO_NODE.md](./ARQUITECTURA_DJANGO_NODE.md).  
> 🤖 **Guía para Agentes de IA y Convenciones:** Para continuar el desarrollo respetando las reglas técnicas del proyecto, ver [AGENTS.md](./AGENTS.md).

Vakera es una plataforma web integral para establecimientos ganaderos con arquitectura modular desacoplada y backend políglota:

- **`client/`** — Frontend SPA en React 18 + Vite (Vanilla CSS responsivo, diseño sin dependencias externas).
- **`server/`** — Backend Transaccional y Operativo en Node.js + Express (CommonJS, Prisma ORM, fallback en memoria, autenticación JWT, RBAC).
- **`server_py/`** — Backend Analítico, Documental y de Tiempo Real en Python + Django 6.1 (Django REST Framework, Django Channels/WebSockets, motor bio-nutricional, informes PDF con ReportLab y planillas Excel con openpyxl).
- **`prisma/`** — Definición de esquema de base de datos PostgreSQL (13 entidades), migraciones DDL y semillas demo.

---

## 1. Ramas del Repositorio y Responsabilidades

El desarrollo del proyecto se organizó en tres ramas principales, consolidadas en `main`:

### 1.1 Rama `main` (Integración Principal y Producción)
- **Responsabilidad:** Línea estable de integración que unifica frontend, ambos backends, base de datos, Docker y automatización CI/CD.
- **Funcionalidades clave:**
  - Orquestación monorepo desde `package.json` raíz (`db:*`, `server:*`, `client:*`, `test:*`).
  - Infraestructura en tiempo real mediante **WebSockets** (`server/src/services/realtime.service.js` → Django Channels `server_py/core/consumers.py`) y módulo de chat interno (`ChatView.jsx`).
  - Pipeline de Integración Continua en `.github/workflows/ci.yml` (`node-backend`, `python-backend`, `react-frontend`).
  - Gobernanza mediante Pull Requests y prohibición de commits con secretos (`.env`).

### 1.2 Rama `Frontend/backend-1` (SPA React + API Operativa Node.js)
- **Responsabilidad:** Capa de presentación en React 18 y API REST transaccional operativa en Node.js/Express.
- **Funcionalidades clave:**
  - **Frontend (`client/`):** Landing pública (`1_inicio_presentacion`), flujos de autenticación y verificación por correo (`2_login_registro`), dashboard multi-rol (`3_dashboard` con paneles para Dueño, Capataz, Peón, Oficina y Veterinario + módulos de Ganado, Parcelas, Partes, Sanidad, Insumos, Tambo, Reportes y Chat) y control de acceso en UI (`4_permisos`).
  - **Backend Node.js (`server/`):** Endpoints `/api/servicios`, `/api/contacto`, `/api/auth/*`, `/api/dashboard/*`, `/api/permisos/*` y `/api/chat/*`; middlewares de seguridad (`helmet`, `cors`, `rateLimit`, `auth.middleware.js`, `rbac.middleware.js`) y servicios externos (`email.service.js`, `weather.service.js`, `dolar.service.js`, `realtime.service.js`).

### 1.3 Rama `base-de-datos` (PostgreSQL/Prisma + Motor Analítico Python/Django)
- **Responsabilidad:** Persistencia relacional, resiliencia ante caídas de red (Dual Database Pattern) y microservicio analítico/documental en Python.
- **Funcionalidades clave:**
  - **Persistencia (`prisma/` y `docker-compose.yml`):** Contenedor `vakera-postgres` (PostgreSQL 16 en puerto `5433`), esquema relacional de 13 modelos en `prisma/schema.prisma`, `seed.js` y conmutación transparente a memoria en `server/src/config/db.js`.
  - **Backend Python (`server_py/`):** Reflejo de modelos con `managed = False` (`legacy_models/models.py`), validación de JWT compartido (`UnifiedJWTAuthentication`), motor bio-nutricional (`nutricion/` — CMS, PB, proyección ADG) y exportación PDF/Excel (`reportes/`).

---

## 2. Estructura Detallada del Proyecto

```text
VakeraGanaderia/
├── .github/workflows/ci.yml     # Pipeline CI/CD (Node, Python y React)
├── client/                      # SPA Frontend React 18 + Vite (puerto 5173)
│   └── src/
│       ├── api/                 # Cliente HTTP centralizado (client.js, *.api.js, realtime.js)
│       ├── components/          # UI reutilizable, Navbar, Footer y layout privado (Sidebar, PrivateHeader)
│       ├── context/             # AuthContext.jsx (sesión JWT y usuario activo)
│       ├── views/
│       │   ├── 1_inicio_presentacion/  # Landing pública (Hero, Servicios, Contacto, FAQ)
│       │   ├── 2_login_registro/       # Login, Registro, VerificarEmail, RecuperarPassword
│       │   ├── 3_dashboard/            # Paneles por actor (actores/) y módulos operativos (modulos/)
│       │   └── 4_permisos/             # ProtectedRoute, RoleGate, permisos.config.js, GestionUsuariosView
│       └── index.css            # Sistema de diseño en Vanilla CSS puro
├── server/                      # Backend Operativo Node.js / Express CommonJS (puerto 4000)
│   ├── src/
│   │   ├── config/              # env.js, prisma.js, db.js (fallback en memoria)
│   │   ├── controllers/         # presentacion, auth, dashboard, permisos, chat
│   │   ├── middlewares/         # auth.middleware.js (JWT HS256), rbac.middleware.js
│   │   ├── models/              # Acceso a datos Dual Database (Prisma + memoria)
│   │   ├── routes/              # Enrutadores modulares (*.routes.js)
│   │   ├── services/            # email, weather, dolar, cotizacion, leche, realtime (WebSocket bridge)
│   │   ├── utils/               # apiResponse.js, roles.constants.js
│   │   └── index.js             # Entrada Express, helmet, cors, compression, rateLimit
│   └── tests/                   # Tests unitarios y de integración API (node --test)
├── server_py/                   # Backend Analítico y WebSockets Python / Django (puerto 8000)
│   ├── core/                    # authentication.py (JWT), permissions.py, responses.py, consumers.py (WS)
│   ├── legacy_models/           # models.py (reflejo unmanaged = False de tablas Prisma)
│   ├── nutricion/               # Cálculo CMS, PB y proyección ADG
│   ├── reportes/                # Resumen ejecutivo, PDF (ReportLab) y Excel (openpyxl)
│   └── vakera_backend/          # settings.py, urls.py (/api/py/), asgi.py (Channels), wsgi.py
├── prisma/                      # schema.prisma (13 modelos), migraciones y seed.js
├── docker-compose.yml           # Servicios postgres (5433) y backend-python (8000)
├── package.json                 # Orquestador raíz de scripts
├── AGENTS.md                    # Reglas técnicas y de continuidad para IA
├── ARQUITECTURA_DJANGO_NODE.md  # Diseño de coexistencia Node + Django
└── PLAN_DE_TRABAJO.md           # Especificación funcional y de roles
```

---

## 3. Requisitos Previos, Instalación y Ejecución desde Cero

### 3.1 Requisitos Previos
- **Node.js:** v20.6 o superior (recomendado v22 LTS) + `npm`.
- **Python:** v3.12+ + `pip`.
- **Docker y Docker Compose:** Para levantar PostgreSQL 16 (y opcionalmente el contenedor Django).

### 3.2 Instalación de Dependencias
```bash
# 1. Dependencias raíz (Prisma CLI y utilidades)
npm install

# 2. Dependencias del backend Node.js
npm --prefix server install

# 3. Dependencias del frontend React
npm --prefix client install

# 4. Dependencias del backend Python (recomendado usar entorno virtual .venv)
python -m venv server_py/.venv
# Windows PowerShell: .\server_py\.venv\Scripts\Activate.ps1
# Linux/Mac: source server_py/.venv/bin/activate
pip install -r server_py/requirements.txt
```

### 3.3 Variables de Entorno (`.env` en raíz y `server/.env`)
El repositorio **no versiona credenciales reales**. Copiar `.env.example` hacia `.env` (raíz) y configurar según necesidad:

1. **`.env` (en la raíz del proyecto):** usado por **Prisma CLI**, **Docker Compose** y **Python/Django**. Incluye `DATABASE_URL`, `JWT_SECRET` (idéntico al de Node.js para validación `HS256` compartida), `DJANGO_SECRET_KEY` y `DJANGO_DEBUG`.
2. **`server/.env` (dentro de `server/`):** usado por **Node.js / Express**. Incluye:
   - Servidor y BD: `PORT=4000`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`.
   - Correo Gmail/SMTP (verificación, recuperación y contacto a `soporte.vakera@gmail.com`): `SMTP_SERVICE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `CONTACTO_DESTINO_EMAIL` (opcional).
   - Google OAuth 2.0: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (`http://localhost:4000/api/auth/google/callback`) y `FRONTEND_URL` (`http://localhost:5173`).

### 3.4 Orden Exacto de Ejecución

1. **Iniciar Base de Datos PostgreSQL (Docker — puerto `5433`):**
   ```bash
   npm run db:up
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```
   > **Nota de Resiliencia:** Si Docker/PostgreSQL no está activo, el backend Node.js conmuta automáticamente al respaldo en memoria (`server/src/config/db.js`).

2. **Iniciar Backend Operativo Node.js (puerto `4000`):**
   ```bash
   npm run server:node
   ```
   Atiende `/api/health`, `/api/servicios`, `/api/contacto`, `/api/auth/*`, `/api/dashboard/*`, `/api/permisos/*` y `/api/chat/*`.

3. **Iniciar Backend Analítico y WebSockets Python/Django (puerto `8000`):**
   ```bash
   npm run server:py
   ```
   Atiende `/api/py/health`, `/api/py/reportes/*`, `/api/py/nutricion/*`, `/api/py/ws/emit` y conexiones WebSocket `/ws/*`.

4. **Iniciar Frontend React + Vite (puerto `5173`):**
   ```bash
   npm run client:dev
   ```
   El proxy de `client/vite.config.js` redirige `/api/py/*` y `/ws/*` al puerto `8000` (Django) y `/api/*` al puerto `4000` (Node.js), evitando problemas de CORS.

---

## 4. Tests, CI/CD y Verificación de Calidad

```bash
# Tests unitarios y de integración API del backend Node.js
npm run test:node

# Tests del frontend React (Vitest + Testing Library + MSW)
npm run test:client

# Suite de pruebas de Python (JWT interoperable, RBAC, nutrición, reportes y WebSockets)
npm run py:test
npm run py:check

# Compilar bundle de producción de React
npm --prefix client run build
```

El pipeline automatizado `.github/workflows/ci.yml` ejecuta estas tres suites junto con `npm audit --omit=dev --audit-level=high` en cada `push` y `pull_request` hacia `main` y `develop`.

---

## 5. Roles y Cuentas Demo

Contraseña universal para todas las cuentas demo: `password123`

| Rol | Correo Demo | Alcance Principal |
| :--- | :--- | :--- |
| **Dueño** | `dueno@vakera.com` | Dashboard ejecutivo, reportes PDF/Excel, nutrición, permisos y auditoría |
| **Capataz** | `capataz@vakera.com` | Revisión y aprobación de partes diarios, traslados, sanidad y tareas |
| **Peón** | `peon@vakera.com` | Carga móvil de partes diarios en el campo y traslados autorizados |
| **Oficina** | `oficina@vakera.com` | Control de stock de insumos, reportes ejecutivos y planillas contables |
| **Veterinario** | `veterinario@vakera.com` | Calendario sanitario oficial, vacunas, tratamientos y motor nutricional |
