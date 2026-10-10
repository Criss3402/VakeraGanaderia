# Guía de Desarrollo y Reglas para Agentes (AGENTS.md)
## Sistema de Gestión y Trazabilidad Ganadera — Vakera

Este documento define la arquitectura, convenciones técnicas, estándares de calidad y directrices operativas que **todo agente de IA o desarrollador debe respetar** al inspeccionar, modificar o ampliar el repositorio.

El objetivo principal es **eliminar redundancias**, **prevenir bugs y regresiones**, y garantizar la **calidad de la lógica de negocio y del código**.

---

## 1. Visión y Arquitectura del Sistema

El proyecto está organizado en una arquitectura desacoplada:

```
VakeraGanaderia/
├── prisma/               # Esquema de base de datos PostgreSQL, migraciones y seed
├── server/               # API REST modular operativa (Node.js + Express, CommonJS)
├── server_py/            # Backend analítico y de reportes (Python + Django 6.1, DRF)
├── client/               # SPA Frontend reactiva (React 18 + Vite, ESM, Vanilla CSS)
├── package.json          # Orquestador raíz (scripts de DB, Prisma, Node, Python y Docker)
├── ARQUITECTURA_DJANGO_NODE.md # Especificación técnica de coexistencia políglota
├── PLAN_DE_TRABAJO.md    # Especificación funcional de requerimientos y roles
└── README.md             # Guía de puesta en marcha rápida
```

### Principios Fundamentales
1. **Separación de Entornos:**
   - `server/` usa **CommonJS** (`require`, `module.exports`).
   - `client/` usa **ES Modules** (`import`, `export`).
   - Nunca mezclar sistemas de módulos entre cliente y servidor.
2. **Dual Database Pattern (Híbrido Resiliente):**
   - El sistema opera con **Prisma ORM** contra PostgreSQL.
   - Posee un mecanismo de respaldo automático en memoria (`server/src/config/db.js`) cuando la base de datos no está disponible.
3. **Control de Acceso Basado en Roles (RBAC):**
   - 5 roles definidos: `dueno`, `capataz`, `peon`, `oficina`, `veterinario`.
   - La seguridad se aplica tanto en el backend (middlewares) como en el frontend (guards de vistas y renderizado condicional).

---

## 2. Convenciones y Estructura por Capas

### 2.1 Backend (`server/`)
```
server/src/
├── config/        # Conexiones (prisma.js, db.js con seeds en memoria)
├── controllers/   # Lógica de orquestación HTTP y validaciones de entrada
├── models/        # Capa de abstracción de datos (Prisma con fallback a memoria)
├── services/      # Integraciones externas (ej. weather.service.js)
├── middlewares/   # auth.middleware.js (JWT) y rbac.middleware.js (Roles)
├── routes/        # Definición modular de endpoints (*.routes.js)
├── utils/         # apiResponse.js, roles.constants.js
└── index.js       # Entrada del servidor Express y manejadores de error
```

#### Reglas del Backend:
- **Rutas y Controladores:** Los archivos de rutas (`*.routes.js`) solo mapean verbos HTTP y middlewares hacia funciones del controlador (`*.controller.js`). Ninguna lógica de negocio o consulta a BD debe escribirse directamente en el archivo de rutas.
- **Modelos como Única Fuente de Datos:** Los controladores no deben interactuar directamente con `prisma` ni con `db`. Toda consulta pasa por los métodos estáticos de los modelos (`GanadoModel`, `UsuarioModel`, etc.).
- **Estandarización de Respuestas:** Es obligatorio usar `server/src/utils/apiResponse.js`:
  ```javascript
  // Éxito
  return apiResponse.exito(res, data, "Registro creado exitosamente", 201);
  // Error controlado
  return apiResponse.error(res, "Caravana ya registrada", 400, { caravana });
  ```
  *Prohibido responder con formatos ad-hoc como `res.json({ status: true })` o `res.status(500).send(...)`.*

---

### 2.2 Frontend (`client/`)
```
client/src/
├── api/           # Capa de consumo HTTP (client.js y *.api.js)
├── components/    # Componentes reutilizables de UI y layout (PrivateLayout, Navbar, etc.)
├── context/       # AuthContext.jsx (sesión y usuario activo)
├── views/
│   ├── 1_inicio_presentacion/  # Landing pública (Hero, Servicios, Contacto, FAQ)
│   ├── 2_login_registro/       # Flujos de acceso y recuperación
│   ├── 3_dashboard/            # Panel general y sub-vistas
│   │   ├── actores/            # Vistas específicas por rol (PanelDueno, PanelPeon, etc.)
│   │   └── modulos/            # Módulos operativos (Ganado, Partes, Sanidad, Insumos, Reportes)
│   └── 4_permisos/             # Gestión de roles y Route Gates (RBAC)
└── index.css      # Sistema de diseño centralizado en Vanilla CSS
```

#### Reglas del Frontend:
- **Centralización de Peticiones:** Todo llamado a la API debe residir en `client/src/api/*.api.js` usando la función `request` de `client.js`. Prohibido utilizar `fetch` directo en los componentes JSX.
- **Estilos y Diseño:** Utilizar únicamente las variables CSS y clases predefinidas de `index.css` (`--bg-primary`, `--accent-color`, `.card-elevada`, `.badge-estado`, etc.).
  *No instalar ni inyectar TailwindCSS, Bootstrap ni librerías de estilos externas.*
### 2.3 Backend Analítico Python (`server_py/`)
```
server_py/
├── vakera_backend/ # Configuración Django (settings.py, urls.py maestro con prefijo /api/py/)
├── core/           # authentication.py (UnifiedJWT), permissions.py (RBAC), responses.py
├── legacy_models/  # models.py (managed = False, mapeo unmanaged de tablas Prisma)
├── reportes/       # Resumen ejecutivo, exportación PDF (ReportLab) y Excel (openpyxl)
├── nutricion/      # Motor nutricional bovino (requerimiento MS, PB, raciones y proyección ADG)
└── manage.py       # Entrada CLI de Django
```

#### Reglas de Python / Django:
- **Aislamiento DDL:** Queda terminantemente prohibido ejecutar `makemigrations` sobre las tablas existentes de Prisma. Todos los modelos en `legacy_models/models.py` deben declarar estrictamente `class Meta: managed = False`.
- **Estandarización de Respuestas:** Utilizar `core.responses.api_success` y `core.responses.api_error` para garantizar idéntico formato JSON `{ ok: True/False, data?, mensaje?, error? }` que el backend de Node.js.
- **Autenticación Unificada:** Validar tokens vía `core.authentication.UnifiedJWTAuthentication` utilizando `JWT_SECRET` y algoritmo `HS256`. Normalizar roles con `.lower()` antes de evaluar permisos RBAC.
- **Manejo Defensivo:** No capturar excepciones silenciosamente. Ante caídas de PostgreSQL, retornar `503 Service Unavailable` a través de `core.exceptions.vakera_exception_handler`.

---

## 3. Directrices Críticas para Reducir Errores y Bugs

### 3.1 Sincronización del Patrón Dual (Prisma vs. Memoria)
Uno de los puntos más sensibles del sistema es el fallback en memoria:
- **Espejo de Datos:** Si agregás o modificás un campo en `prisma/schema.prisma`, **debés replicarlo** en los objetos semilla de `server/src/config/db.js` y en las transformaciones del modelo correspondiente.
- **Mutabilidad en Memoria:** Cuando Prisma falle o no esté disponible, las operaciones de creación/modificación (`crear`, `actualizar`, `eliminar`) en los modelos deben modificar los arreglos de `db` en memoria, asegurando consistencia durante la ejecución del proceso.
- **IDs Consistentes:** Usar prefijos identificables para entidades creadas en memoria (`gan-XXX`, `usr-XXX`, `ins-XXX`, `pd-XXX`, `san-XXX`) compatibles con strings tipo CUID.

### 3.2 Normalización de Roles y Casos (RBAC)
- En Prisma el enum se guarda en **MAYÚSCULAS** (`DUENO`, `CAPATAZ`, `PEON`, `OFICINA`, `VETERINARIO`).
- En la lógica de aplicación backend y frontend se utiliza en **minúsculas** (`dueno`, `capataz`, etc.).
- **Regla:** Al leer usuarios desde la base de datos o validar roles en middlewares, siempre normalizar con `.toLowerCase()` antes de comparar con `ROLES`:
  ```javascript
  const rolNormalizado = (usuario.rol || "").toLowerCase();
  if (rolNormalizado !== ROLES.DUENO) { ... }
  ```

### 3.3 Seguridad y Manejo de Credenciales
- **Nunca exponer el campo `password`:** En los modelos y controladores de usuario, siempre excluir el password antes de enviar la respuesta al cliente (`delete usuario.password` o proyección Prisma `{ select: { id: true, nombre: true, ... } }`).
- **Hasheo de Passwords:** Utilizar siempre `bcryptjs` con mínimo 10 rondas para cualquier nuevo usuario registrado.
- **Protección de Rutas Privadas:** Toda ruta de la API que acceda o modifique datos operativos (`/dashboard`, `/ganado`, `/partes`, etc.) debe incluir obligatoriamente el middleware `requerirAutenticacion` y, de corresponder, `requerirRoles(...)`.

### 3.4 Validaciones Defensivas de Lógica de Negocio
- **Ganado:** La caravana (`caravana`) debe ser única, normalizada (sin espacios, mayúsculas) y el peso debe ser un número positivo.
- **Partes Diarios:**
  - El peón solo puede cargar partes en estado `PENDIENTE`.
  - Solo el capataz o el dueño pueden cambiar el estado a `APROBADO` o `RECHAZADO`.
- **Insumos y Stock:**
  - No permitir decrementos de stock por debajo de cero sin emitir advertencia o bloqueo según configuración.
  - El indicador `requiereReposicion` debe calcularse automáticamente: `stockActual <= stockMinimo`.

### 3.5 Eliminación de Silenciamientos de Error (`catch` vacíos)
- Queda terminantemente prohibido el uso de bloques vacíos `catch (_) {}`.
- Si un error es recuperable (ej. fallback de DB o lectura de entorno opcional), debe quedar explícitamente logueado con `console.warn(...)` indicando causa y contexto.
- En los endpoints, los errores no controlados deben ser pasados a `next(err)` o capturados con `apiResponse.error(res, ...)`.

---

## 4. Flujo de Trabajo para Nuevas Funcionalidades

Cuando un agente reciba la tarea de implementar un nuevo módulo o endpoint, debe seguir este orden estricto:

1. **Revisión de Especificación:** Consultar [PLAN_DE_TRABAJO.md](./PLAN_DE_TRABAJO.md) para verificar roles autorizados, requerimientos y alcances.
2. **Definición de Modelo:**
   - Si requiere cambios de base de datos, actualizar `prisma/schema.prisma` y documentar el cambio.
   - Actualizar el modelo en `server/src/models/` implementando tanto la consulta Prisma como la alternativa en `server/src/config/db.js`.
3. **Controlador y Rutas:**
   - Crear o actualizar el controlador en `server/src/controllers/` validando campos requeridos y tipos de datos.
   - Declarar las rutas en `server/src/routes/` aplicando `auth.middleware.js` y `rbac.middleware.js`.
4. **Capa API de Frontend:**
   - Agregar las funciones correspondientes en `client/src/api/`.
5. **Componente / Vista React:**
   - Implementar la vista en el directorio temático correspondiente (`1_inicio_presentacion`, `2_login_registro`, `3_dashboard`, `4_permisos`).
   - Aplicar `tienePermiso(...)` o `RoleGate` si la vista contiene acciones restringidas por rol.
   - Utilizar las clases visuales de `index.css`.
6. **Verificación:**
   - Asegurarse de que no existan errores de sintaxis o consola.
   - Probar tanto con respuestas exitosas como con escenarios de error (red caída, credenciales inválidas, datos incompletos).

---

## 5. Comandos de Referencia y Verificación

| Operación | Comando (desde la raíz o carpeta indicada) |
| :--- | :--- |
| **Levantar Postgres (Docker)** | `npm run db:up` (desde raíz) |
| **Migración de Prisma** | `npm run db:migrate` (desde raíz) |
| **Poblar BD (Seed)** | `npm run db:seed` (desde raíz) |
| **Iniciar Backend Node (Dev)** | `npm run server:node` (o `cd server && npm run dev`) |
| **Iniciar Backend Python (Dev)** | `npm run server:py` (o `python server_py/manage.py runserver 8000`) |
| **Tests Backend Python** | `npm run py:test` |
| **Iniciar Frontend (Dev)** | `npm run client:dev` (o `cd client && npm run dev`) |
| **Build Frontend** | `npm --prefix client run build` |

---

## 6. Lista de Verificación (Checklist) para Agentes antes de Finalizar
- [ ] ¿Se mantuvieron las convenciones de CommonJS en server/, ESM en client/ y PEP 8 en server_py/?
- [ ] ¿Las respuestas de la API utilizan `apiResponse.exito` / `apiResponse.error` (Node) y `api_success` / `api_error` (Python)?
- [ ] ¿Se preservó el aislamiento DDL (`managed = False`) en los modelos Django reflejados de Prisma?
- [ ] ¿Se contempló el fallback a `db.js` en Node.js y manejo de error 503 en Python ante caída de BD?
- [ ] ¿Los roles y permisos se validan de forma case-insensitive (`.toLowerCase()`) en ambos backends?
- [ ] ¿Se evitaron dependencias de CSS externas (como Tailwind) respetando `index.css`?
- [ ] ¿El código contiene validaciones defensivas sin bloques `catch` silenciosos?
- [ ] ¿Se preservaron los comentarios explicativos y la documentación existente?
