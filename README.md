# Vakera

> 📋 **Plan de Trabajo Completo:** Para consultar el alcance, matriz de roles (RBAC), objetivos y hoja de ruta detallada del sistema, consulta el documento [PLAN_DE_TRABAJO.md](./PLAN_DE_TRABAJO.md).

Recreación de la landing page de "Vakera", separada en dos módulos independientes:

- **`server/`** — API en Node.js + Express (datos de servicios y recepción del formulario de contacto).
- **`client/`** — Interfaz en React + Vite (todo el sitio: navbar, hero, secciones y footer).

## Estructura

```
ganaderia-los-andes/
├── server/              # API Node.js
│   └── src/
│       ├── index.js
│       ├── routes/
│       │   ├── servicios.js
│       │   └── contacto.js
│       └── data/
│           └── servicios.js
└── client/              # App React (Vite)
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css
        ├── api/client.js
        └── components/
            ├── Navbar.jsx
            ├── Hero.jsx
            ├── QuienesSomos.jsx
            ├── Servicios.jsx
            ├── Ganado.jsx
            ├── Blog.jsx
            ├── Contacto.jsx
            ├── Footer.jsx
            └── Icons.jsx
```

## Cómo correrlo

Necesitás dos terminales (el backend y el frontend corren por separado).

### 1. Backend (Node.js)

```bash
cd server
npm install
npm start
```

Queda escuchando en `http://localhost:4000`. Endpoints disponibles:

- `GET /api/health`
- `GET /api/servicios`
- `GET /api/servicios/:id`
- `POST /api/contacto` — body JSON: `{ "nombre", "email", "mensaje" }`
- `GET /api/contacto` — lista los mensajes recibidos

### 2. Frontend (React)

```bash
cd client
npm install
npm run dev
```

Se abre en `http://localhost:5173`. En desarrollo, Vite redirige automáticamente las llamadas a `/api/...` hacia `http://localhost:4000` (configurado en `vite.config.js`), así que el backend tiene que estar corriendo para que la sección "Servicios" y el formulario de contacto funcionen.

Para generar el build de producción del frontend:

```bash
npm run build
```

## Secciones incluidas

La landing page cuenta con las siguientes secciones:

- **Hero** — título, bajada y botón, sobre ilustración de paisaje.
- **Nosotros** — texto institucional + valores (Compromiso, Experiencia, Ética) + gestión por cuentas y roles.
- **Servicios** — las 4 tarjetas (Genética Superior, Nutrición Animal, Tecnología y Gestión, Salud y Bienestar), traídas desde la API de Node.
- **Preguntas Frecuentes (FAQ)** — acordeón interactivo que responde dudas sobre conectividad offline, importación desde Excel, caravanas electrónicas RFID, roles de usuario y reportes oficiales.
- **Contacto** — formulario que envía el mensaje al backend.
