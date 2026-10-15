# Plan de Trabajo: Sistema de Gestión Ganadera "Vakera"

Documento maestro de planificación, alcance, actores y arquitectura técnica para la plataforma web de gestión y trazabilidad ganadera.

---

## 1. Resumen y Visión General

**Vakera** es una plataforma web centralizada y responsive diseñada para transformar la administración tradicional de establecimientos ganaderos, eliminando las anotaciones en papel y los reportes verbales diferidos mediante la digitalización del flujo de trabajo entre el campo y la administración.

### Objetivo General
Desarrollar una plataforma web centralizada y accesible desde cualquier navegador para la gestión integral del ganado, trazabilidad sanitaria, control de insumos y comunicación operativa en establecimientos ganaderos.

### Objetivos Específicos
- **Control de stock y calendario sanitario:** Implementar un registro de animales e insumos con alertas automáticas de vencimiento y fechas de aplicación de vacunas.
- **Canales de reporte y validación directa:** Conectar en tiempo real a operarios de campo (peones), supervisores (capataz) y administración (oficina/dueño).
- **Tableros de control ejecutivos:** Proveer métricas clave (mortalidad, stock, insumos y costos) accesibles desde cualquier dispositivo.

---

## 2. Diagnóstico del Problema

| Problema Crítico | Consecuencia en el Campo | Solución Vakera |
| :--- | :--- | :--- |
| **Fallas de comunicación** | Asincronía e inconsistencia en el flujo de información entre el personal en el campo (peones/capataz) y la administración (oficina/dueño). | Flujo de partes diarios digitales con circuito de aprobación y notificaciones en tiempo real. |
| **Pérdida de trazabilidad sanitaria** | Omisión en calendarios de vacunación, medicamentos vencidos y demoras en intervenciones veterinarias. | Calendario sanitario con alertas automáticas preventivas y ficha clínica histórica por animal/lote. |
| **Descontrol de stock** | Desconocimiento en tiempo real de insumos, herramientas y stock de hacienda (altas, bajas, nacimientos, traslados). | Módulo de inventario con stock mínimo y registro digital de movimientos de ganado por potrero. |

---

## 3. Matriz de Usuarios, Actores y Permisos (RBAC)

El sistema se estructura bajo un control de acceso basado en roles (**Role-Based Access Control**):

```
                        ┌──────────────┐
                        │    DUEÑO     │ (Visión global, auditoría y pagos)
                        └──────┬───────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
    ┌──────────────┐                      ┌──────────────┐
    │   CAPATAZ    │                      │   OFICINA    │
    │(Campo/Equipo)│                      │(Admin/Compras│
    └──────┬───────┘                      └──────────────┘
           │                                      ▲
           ▼                                      │
    ┌──────────────┐                     ┌────────┴─────┐
    │     PEÓN     │                     │ VETERINARIO  │
    │(Parte diario)│                     │(Sanidad/Ext.)│
    └──────────────┘                     └──────────────┘
```

### Detalle de Funciones por Rol:

1. **Peón (Operario de Campo):**
   - Carga de partes y eventos diarios (nacimientos, animales enfermos, tareas realizadas).
   - Solicitud de reposición de insumos y herramientas.
   - Consulta básica de ubicación de animales por potrero.

2. **Capataz (Supervisor de Campo):**
   - Revisión y aprobación de los partes diarios cargados por los peones.
   - Asignación de tareas operativas diarias y semanales.
   - Control del inventario local de campo y herramientas.
   - Enlace y contacto operativo directo con el médico veterinario.

3. **Oficina (Administración):**
   - Carga de comprobantes de compras y facturas de insumos.
   - Gestión de compras y relación con proveedores.
   - Control documental sanitario y certificados oficiales.
   - Generación de reportes contables y administrativos.

4. **Dueño (Dirección Ejecutiva):**
   - Visualización del dashboard ejecutivo con métricas globales consolidadas.
   - Auditoría de módulos, trazabilidad y registros históricos.
   - Aprobación final de presupuestos, órdenes de compra y pagos mayores.
   - Administración de usuarios y niveles de acceso.

5. **Veterinario (Profesional Externo):**
   - Definición y seguimiento del calendario de vacunación oficial y optativo.
   - Registro de diagnósticos, tratamientos aplicados y recetas médicas.
   - Emisión de alertas sanitarias y cuarentenas preventivas.

---

## 4. Alcance del Proyecto

### Dentro del Alcance
- **Ficha individual y por lote:** Registro por caravana/identificador, categoría, peso, historial clínico, genealogía y potrero asignado.
- **Módulo sanitario:** Calendario de vacunación, registro de tratamientos aplicados, control de vencimiento de stock médico.
- **Gestión de inventario:** Insumos ganaderos (vacunas, fármacos, alimentos, sales) y herramientas de trabajo.
- **Partes diarios de novedades:** Flujo de carga de peones y aprobación por el capataz.
- **Sistema de notificaciones internas:** Alertas de vencimientos, tareas pendientes y canal con veterinario.
- **Diseño Web App Responsive:** Optimizado para computadoras de escritorio, tablets y teléfonos móviles en navegadores modernos.

### Fuera del Alcance
- Módulos de agricultura o agronomía (siembras, cosechas, maquinaria pesada agrícola).
- Aplicaciones móviles nativas empaquetadas (iOS/Android en tiendas de apps); se prioriza formato Web App adaptable.
- Facturación electrónica fiscal directa (se gestiona control documental y comprobantes).

---

## 5. Estado Actual del Proyecto (Lo que ya está construido)

Actualmente, el repositorio cuenta con la **Fase 1 (Presentación Institucional)** concluida:

- **Frontend (`client/`):**
  - Aplicación React creada con Vite.
  - Navbar responsivo con anclaje a secciones.
  - Hero institucional con ilustración vectorial propia.
  - Sección *"Quiénes Somos"* con valores y propuesta de valor de cuentas y roles.
  - Sección *"Servicios"* con consumo de datos vía API.
  - Sección *"Preguntas Frecuentes"* (acordeón interactivo).
  - Formulario de *"Contacto"* validado y conectado al backend.
  - Hoja de estilos `index.css` personalizada.

- **Backend (`server/`):**
  - Servidor Express en Node.js en puerto 4000.
  - Endpoint de salud (`GET /api/health`).
  - Endpoints de catálogo de servicios (`GET /api/servicios`, `GET /api/servicios/:id`).
  - Endpoints de contacto (`POST /api/contacto`, `GET /api/contacto`).
  - Soporte para CORS y procesamiento de cuerpos JSON.

---

## 6. Propuesta de Estructura de Carpetas

Organización modular recomendada para escalar el proyecto, separando ordenadamente las 4 áreas solicitadas:
1. **Inicio / Presentación**
2. **Login / Registro**
3. **Dashboard**
4. **Permisos y Roles**

### 6.1. Estructura del Backend (`server/src/`)

Organización modular en capas, ordenada específicamente para las 4 partes requeridas del sistema:

```text
server/
└── src/
    ├── index.js                          # Punto de entrada principal Express y montaje de rutas
    │
    ├── config/                           # Configuraciones globales
    │   └── db.js                         # Conexión a base de datos y variables de entorno
    │
    ├── middlewares/                      # Seguridad y control de acceso
    │   ├── auth.middleware.js            # Validación de tokens JWT y sesiones activas
    │   └── rbac.middleware.js            # Validación de permisos por rol (Peón, Capataz, etc.)
    │
    ├── routes/                           # Ruteo ordenado por cada parte del sistema:
    │   ├── presentacion.routes.js        # [PARTE 1: INICIO / PRESENTACIÓN] -> /api/servicios, /api/contacto
    │   ├── auth.routes.js                # [PARTE 2: LOGIN / REGISTRO] -> /api/auth/login, /api/auth/registro
    │   ├── dashboard.routes.js           # [PARTE 3: DASHBOARD] -> /api/dashboard/metricas, /kpis
    │   └── permisos.routes.js            # [PARTE 4: PERMISOS] -> /api/permisos/roles, /api/permisos/usuarios
    │
    ├── controllers/                      # Lógica de negocio para cada parte del sistema:
    │   ├── presentacion.controller.js    # Catálogo de servicios y recepción de formularios
    │   ├── auth.controller.js            # Autenticación, generación de tokens y registro
    │   ├── dashboard.controller.js       # Cálculo de stock, mortalidad, alertas de vacunas y costos
    │   └── permisos.controller.js        # Matriz de roles, asignación de permisos y auditoría
    │
    ├── models/                           # Esquemas de datos y persistencia:
    │   ├── usuario.model.js              # Credenciales, datos personales y rol asignado
    │   ├── ganado.model.js               # Ficha de animal (caravana, categoría, peso, potrero)
    │   ├── sanidad.model.js              # Vacunaciones, vencimientos de stock y tratamientos
    │   ├── insumo.model.js               # Stock de insumos, herramientas y pedidos de reposición
    │   └── parteDiario.model.js          # Reportes diarios de campo (peón -> capataz)
    │
    └── utils/                            # Utilidades compartidas
        ├── apiResponse.js                # Formato estándar de respuestas HTTP (éxito/error)
        └── roles.constants.js            # Definición formal de roles (PEON, CAPATAZ, OFICINA, DUENO, VETERINARIO)
```

---

### 6.2. Estructura del Backend Analítico y Documental (`server_py/`)

Microservicio especializado en Python (Django 6.1 + Django REST Framework) que coexiste con Node.js bajo el prefijo `/api/py/`:

```text
server_py/
├── manage.py                         # Punto de entrada de comandos Django
├── requirements.txt                  # Dependencias (Django, DRF, ReportLab, openpyxl, PyJWT)
├── Dockerfile                        # Despliegue contenerizado del servicio
│
├── vakera_backend/                   # Configuración del proyecto Django
│   ├── settings.py                   # Conexión Postgres, JWT compartido, CORS y DRF
│   ├── urls.py                       # Ruteo maestro (/api/py/health, /reportes, /nutricion)
│   └── wsgi.py
│
├── core/                             # Utilidades transversales y seguridad
│   ├── authentication.py             # Validador de tokens JWT de Node.js (PyJWT, HS256)
│   ├── permissions.py                # RBAC de roles (IsDueno, IsCapataz, CanAccessReports)
│   ├── responses.py                  # Formato unificado de respuesta ({ ok, data, error })
│   └── exceptions.py                 # Manejo global de excepciones y fallas de BD
│
├── legacy_models/                    # Modelos reflejados de Prisma (managed = False)
│   └── models.py                     # Mapeo de tablas 'usuarios', 'ganado', 'insumos', etc.
│
├── reportes/                         # Generación y exportación de documentos
│   ├── views.py                      # Resumen ejecutivo, exportar PDF, exportar Excel
│   ├── urls.py
│   └── services/
│       ├── pdf_service.py            # Generador formal de informes PDF con ReportLab
│       └── excel_service.py          # Generador de planillas de cálculo con openpyxl
│
└── nutricion/                        # Motor bio-nutricional y proyecciones
    ├── views.py                      # Cálculo de raciones y curvas de crecimiento
    ├── urls.py
    └── services/
        └── racion_calculator.py      # Modelo bio-matemático de nutrición bovina (CMS, PB)
```

---

### 6.3. Estructura del Frontend (`client/src/`)

Organización modular en React orientada a vistas y componentes, ordenada para las 4 partes requeridas:

```text
client/
└── src/
    ├── main.jsx                          # Punto de entrada de la aplicación React (Vite)
    ├── App.jsx                           # Enrutador principal y layout general
    ├── index.css                         # Estilos globales y tokens de diseño
    │
    ├── api/                              # Servicios de comunicación con el backend (HTTP)
    │   ├── client.js                     # Configuración base de fetch/axios con interceptor de token
    │   ├── presentacion.api.js           # Peticiones de servicios y contacto de la landing
    │   ├── auth.api.js                   # Peticiones de login, registro y perfil
    │   ├── dashboard.api.js              # Peticiones de métricas, alertas y gráficos
    │   └── permisos.api.js               # Consulta de roles y permisos
    │
    ├── context/                          # Estado global de la aplicación
    │   └── AuthContext.jsx               # Manejo de usuario logueado, token y rol actual
    │
    ├── components/                       # Componentes compartidos y reutilizables
    │   ├── ui/                           # Botones, campos de texto, modales, alertas, badges
    │   ├── layout/                       # Sidebar de navegación interna, Header y Footer privado
    │   └── Icons.jsx                     # Iconografía SVG del sistema
    │
    └── views/                            # Vistas ordenadas para cada una de las 4 partes:
        │
        ├── 1_inicio_presentacion/        # [PARTE 1: INICIO / PRESENTACIÓN]
        │   ├── LandingView.jsx           # Vista completa de la página institucional
        │   ├── NavbarLanding.jsx         # Barra de navegación pública
        │   ├── Hero.jsx                  # Presentación con ilustración de campo
        │   ├── QuienesSomos.jsx          # Valores, pilares institucionales y propuesta
        │   ├── Servicios.jsx             # Cuadrícula de servicios ganaderos (desde API)
        │   ├── Faq.jsx                   # Preguntas frecuentes interactivas
        │   ├── Contacto.jsx              # Formulario de contacto
        │   └── FooterLanding.jsx         # Pie de página público
        │
        ├── 2_login_registro/             # [PARTE 2: LOGIN / REGISTRO]
        │   ├── LoginView.jsx             # Formulario de inicio de sesión
        │   ├── RegistroView.jsx          # Formulario de alta de usuario y establecimiento
        │   └── RecuperarPasswordView.jsx # Solicitud de restablecimiento de contraseña
        │
        ├── 3_dashboard/                  # [PARTE 3: DASHBOARD]
        │   ├── DashboardView.jsx         # Tablero general según el rol del usuario
        │   ├── MetricCards.jsx           # Indicadores clave (Total cabezas, Mortalidad, Costos)
        │   ├── AlertasVacunacion.jsx     # Semáforo de vencimientos sanitarios y fechas próximas
        │   ├── InsumosCriticos.jsx       # Alertas de stock mínimo y reposiciones solicitadas
        │   └── PartesPendientes.jsx      # Bandeja de revisión de partes diarios (para Capataz)
        │
        └── 4_permisos/                   # [PARTE 4: PERMISOS Y CONTROL DE ACCESO]
            ├── ProtectedRoute.jsx        # Guardián de rutas (restringe navegación sin permisos)
            ├── RoleGate.jsx              # Componente para mostrar/ocultar botones y acciones según rol
            ├── GestionUsuariosView.jsx   # Pantalla de asignación y auditoría de roles (para Dueño)
            └── permisos.config.js        # Matriz de permisos frontend por rol
```

---

### 6.4. Arquitectura de Datos y Persistencia (Docker, PostgreSQL y Prisma ORM)

Para garantizar la persistencia de datos y el escalado del sistema, se sustituye el almacenamiento temporal en memoria por una base de datos relacional PostgreSQL contenida en Docker y administrada mediante el ORM Prisma.

#### 6.3.1. Modelo Entidad-Relación (DER) y Tablas del Sistema:

```
┌─────────────────┐        ┌──────────────────┐        ┌─────────────────┐
│     USUARIO     │ 1    N │   PARTE_DIARIO   │ N    1 │     POTRERO     │
│─────────────────│◄───────│──────────────────│───────►│─────────────────│
│ id (PK)         │(peon)  │ id (PK)          │(campo) │ id (PK)         │
│ email (UQ)      │        │ novedades        │        │ nombre (UQ)     │
│ password (Hash) │ 1    N │ animalesRev (Int)│        │ superficieHas   │
│ rol (ENUM RBAC) │◄───────│ estado (ENUM)    │        │ capacidad       │
│ establecimiento │(revisor│ peonId (FK)      │        └────────┬────────┘
└────────┬────────┘        │ potreroId (FK)   │                 │ 1
         │                 │ revisadoPorId(FK)│                 │
         │ 1               └──────────────────┘                 │ N
         │                                                      ▼
         │ N               ┌──────────────────┐        ┌─────────────────┐
         └────────────────►│  SANIDAD_EVENTO  │ N    1 │     GANADO      │
           (responsable)   │──────────────────│───────►│─────────────────│
                           │ id (PK)          │(animal)│ id (PK)         │
                           │ evento           │        │ caravana (UQ)   │
                           │ tipo/lote        │        │ categoria/raza  │
                           │ fechaProgramada  │        │ pesoKg (Float)  │
                           │ estado/prioridad │        │ estadoSanitario │
                           │ responsableId(FK)│        │ potreroId (FK)  │
                           │ ganadoId (FK)    │        └─────────────────┘
                           └──────────────────┘

┌─────────────────┐        ┌──────────────────┐
│     INSUMO      │        │ MENSAJE_CONTACTO │
│─────────────────│        │──────────────────│
│ id (PK)         │        │ id (PK)          │
│ nombre (VarChar)│        │ nombre / email   │
│ categoria       │        │ telefono         │
│ stockActual/Min │        │ mensaje          │
│ requiereRep (B) │        │ leido (Boolean)  │
└─────────────────┘        └──────────────────┘
```

#### 6.3.2. Detalle de Modelos Prisma (`prisma/schema.prisma`):
1. **`Usuario`**: Autenticación segura (contraseña cifrada con `bcrypt`), perfiles y control de acceso basado en el Enum `Rol` (`DUENO`, `CAPATAZ`, `PEON`, `OFICINA`, `VETERINARIO`).
2. **`Potrero`**: Divisiones geográficas del establecimiento con registro de hectáreas y capacidad ganadera.
3. **`Ganado`**: Registro individual con caravana única, raza, categoría, peso actual, estado sanitario y potrero asignado.
4. **`SanidadEvento`**: Calendario sanitario preventivo, alertas de vacunación por vencer, tratamientos y responsable asignado.
5. **`Insumo`**: Control de stock de medicamentos, raciones y herramientas con semáforo de reposición automática.
6. **`ParteDiario`**: Reportes de novedades cargados por peones, vinculados al potrero inspeccionado y con flujo de aprobación por capataz.
7. **`MensajeContacto`**: Almacenamiento de consultas recibidas a través de la landing institucional pública.

#### 6.3.3. Ciclo de Vida y Comandos de Base de Datos:
```bash
# 1. Iniciar el contenedor de PostgreSQL en segundo plano
docker compose up -d

# 2. Generar el cliente de Prisma sincronizado con los modelos
npx prisma generate

# 3. Crear y aplicar las migraciones a PostgreSQL
npx prisma migrate dev --name init_vakera_schema

# 4. Poblar la base de datos con los datos semilla (usuarios demo, ganado, insumos)
npx prisma db seed

# 5. Explorador visual web de tablas y datos (opcional)
npx prisma studio
```

---

## 7. Fases de Implementación (Roadmap)

```
[FASE 1] Landing Page & Presentación (COMPLETADO)
    │
    ▼
[FASE 2] Persistencia (Docker + PostgreSQL + Prisma) & Autenticación RBAC
    │
    ▼
[FASE 3] Dashboard Principal (KPIs, Métricas y Alertas con Datos Reales)
    │
    ▼
[FASE 4] Gestión de Ganado y Potreros (ABM completo y traslados)
    │
    ▼
[FASE 5] Módulo Sanitario y Vacunación (Alertas y vencimientos)
    │
    ▼
[FASE 6] Inventario de Insumos y Herramientas (Control de stock y reposición)
    │
    ▼
[FASE 7] Partes Diarios y Flujo Operativo (Peón -> Capataz -> Veterinario)
    │
    ▼
[FASE 8] Auditoría Ejecutiva, Pruebas y Despliegue en Producción
```

### Detalle de Fases:

#### Fase 1: Inicio y Presentación Institucional *(Estado: Finalizado)*
- Landing page responsiva completa.
- Formulario de contacto conectado con backend.
- Catálogo de servicios provisto por API Express.

#### Fase 2: Persistencia (Docker + PostgreSQL + Prisma) y Autenticación RBAC *(Próximo paso)*
- **Infraestructura de Datos:**
  - Contenedor PostgreSQL 16 activo vía Docker (`vakera_db`).
  - Creación y ejecución de migraciones con Prisma ORM (`prisma/schema.prisma`).
  - Carga de semillas iniciales (`prisma/seed.js`) con las 5 cuentas demo y animales de prueba.
  - Conexión del cliente Prisma en `server/src/config/prisma.js`.
- **Autenticación y Seguridad:**
  - Cifrado de contraseñas con `bcryptjs`.
  - Endpoints en backend: registro, login, emisión y verificación de token JWT.
  - Vistas de Frontend: pantallas de Login y Registro con validaciones.
  - `AuthContext` y `ProtectedRoute` en React para proteger vistas internas según el rol del usuario.

#### Fase 3: Dashboard Central y Tablero de Control
- Vista de Dashboard con KPIs clave:
  - Total de cabezas de ganado por categoría (vacas, novillos, terneros, toros).
  - Tasa de mortalidad y alertas sanitarias activas.
  - Resumen de stock crítico de insumos.
  - Alertas automáticas de vacunaciones próximas a vencer.
- Adaptación de la vista del Dashboard según el rol del usuario autenticado (panel ejecutivo para Dueño, operativo para Capataz, tareas para Peón).

#### Fase 4: Módulo de Gestión de Ganado y Potreros
- Fichas de animales individuales (número de caravana, raza, categoría, sexo, fecha de nacimiento, peso actual, potrero).
- Fichas por lotes para manejo masivo de rodeo.
- Registro de movimientos y traslados entre potreros.
- Registro de altas (nacimientos, compras) y bajas (ventas, muertes).

#### Fase 5: Módulo Sanitario y Vacunación
- Calendario sanitario digital con fechas programadas de aplicación.
- Sistema de alertas automáticas (anticipación de 15, 7 y 3 días).
- Registro de tratamientos médicos aplicados (fármaco, dosis, lote de animal, profesional responsable).
- Control de fechas de vencimiento del stock de medicamentos en botiquín de campo.

#### Fase 6: Inventario de Insumos y Herramientas
- Catálogo de insumos médicos, raciones/alimentos, sales y herramientas de trabajo.
- Control de stock actual vs. stock mínimo con alertas de reposición.
- Solicitud de insumos desde el campo (Peón -> Capataz -> Oficina).
- Registro de compras y comprobantes por parte de la Oficina.

#### Fase 7: Partes Diarios y Flujo de Comunicación Operativa
- Formulario ágil y simplificado para que el Peón cargue novedades desde el móvil (nacimientos, animales con signos de enfermedad, tareas cumplidas).
- Bandeja de revisión y aprobación para el Capataz.
- Canal de notificación directa para el Veterinario cuando se reporte un animal enfermo.

#### Fase 8: Reportes Ejecutivos, Analítica y Modelos Nutricionales (Coexistencia con Python/Django)
- **Subsistema Python (`server_py/`):**
  - Conexión no invasiva a PostgreSQL mediante modelos Django con `managed = False` (Prisma como único dueño DDL).
  - Autenticación interoperable con validación del Bearer Token emitido por Node.js (`UnifiedJWTAuthentication`).
  - Resumen ejecutivo consolidado de hacienda, mortalidad y rotación de insumos (`/api/py/reportes/resumen-ejecutivo`).
  - Generación formal de informes oficiales de hacienda en PDF con membrete institucional mediante `ReportLab` (`/api/py/reportes/exportar-pdf`).
  - Exportación de inventario general de rodeo y stock a planillas Excel (.xlsx) con `openpyxl` (`/api/py/reportes/exportar-excel`).
  - Motor de balance nutricional bovino (requerimiento de Materia Seca, Proteína Bruta y reparto forraje/concentrado) (`/api/py/nutricion/calcular-racion`).
  - Curvas de proyección de ganancia diaria de peso (ADG) a 30, 60, 90 y 120 días (`/api/py/nutricion/proyeccion-peso`).
- **Enrutamiento Frontend:**
  - Proxy unificado en `vite.config.js` (`/api/py/` hacia Django en :8000 y `/api/` hacia Express en :4000).
  - Servicio de cliente HTTP en `client/src/api/reportesPy.api.js`.

#### Fase 9: Auditoría, Pruebas y Despliegue en Producción
- Pruebas integrales de interoperabilidad cruzada (Node.js + Django + React).
- Verificación de usabilidad en dispositivos móviles bajo condiciones de conectividad de campo.
- Configuración de variables de entorno de producción y contenedorización completa con Docker Compose.

---

*Plan elaborado para el repositorio VakeraGanaderia.*
