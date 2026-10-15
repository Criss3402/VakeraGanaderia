# Arquitectura de Coexistencia: Node.js (Express) y Python (Django) en Vakera

## 1. Resumen Ejecutivo y Visión

Este documento consolida el análisis arquitectónico, las decisiones técnicas de diseño y los componentes implementados para lograr la **coexistencia armónica entre Node.js (Express) y Python (Django 6.1 + DRF)** dentro del backend del sistema ganadero **Vakera**.

El objetivo cumplido fue **no sustituir ni migrar** el backend existente de Node.js, sino dotar a la plataforma de una arquitectura políglota donde cada tecnología atiende el dominio donde ofrece mayores fortalezas técnicas.

---

## 2. Diagrama de la Arquitectura Coexistente

```
                                 [Navegador / Cliente Móvil]
                                              │
                                              │ HTTP (Puerto 5173)
                                              ▼
                             [Frontend SPA React 18 + Vite]
                                              │
                 ┌────────────────────────────┴────────────────────────────┐
                 │ Enrutamiento transparente por proxy (vite.config.js)   │
                 ▼                                                         ▼
       /api/* (Operativo)                                        /api/py/* (Analítica)
                 │                                                         │
                 ▼                                                         ▼
    ┌─────────────────────────────┐                           ┌─────────────────────────────┐
    │     BACKEND NODE.JS         │                           │     BACKEND PYTHON          │
    │      (Express.js)           │                           │    (Django 6.1 + DRF)       │
    │      Puerto :4000           │                           │       Puerto :8000          │
    ├─────────────────────────────┤                           ├─────────────────────────────┤
    │ • Autenticación & Registro  │                           │ • Resumen Ejecutivo BI      │
    │ • Emisión de Tokens JWT     │                           │ • Informes Oficiales PDF    │
    │ • Partes Diarios (Peón)     │                           │   (Motor ReportLab)         │
    │ • ABM Ganado e Insumos      │                           │ • Planillas Excel (.xlsx)   │
    │ • Alertas operativas        │                           │   (Motor openpyxl)          │
    │ • Dual Database Fallback    │                           │ • Motor Bio-Nutricional     │
    │   (en memoria db.js)        │                           │   (Balance Raciones MS/PB)  │
    │ • Prisma Client (Postgres)  │                           │ • Proyecciones Peso (ADG)   │
    └──────────────┬──────────────┘                           └──────────────┬──────────────┘
                   │                                                         │
                   │ (DDL Owner: Prisma Migrate)                             │ (managed = False)
                   └────────────────────────────┬────────────────────────────┘
                                                ▼
                                    ┌───────────────────────┐
                                    │     PostgreSQL 16     │
                                    │  Docker (vakera_db)   │
                                    │      Puerto :5433     │
                                    └───────────────────────┘
```

---

## 3. Delimitación de Dominios y Responsabilidades

| Dimensión | Backend Node.js + Express (`server/`) | Backend Python + Django (`server_py/`) |
| :--- | :--- | :--- |
| **Enfoque de Negocio** | **OLTP (Transaccional Rápido)** | **OLAP / BI / Cálculos Bio-Matemáticos** |
| **Módulos Principales** | Autenticación, catálogo, partes diarios, ABM de ganado y stock de insumos. | Informes ejecutivos, exportaciones formales (PDF/Excel), balance de raciones y proyecciones. |
| **Frecuencia de Uso** | Alta frecuencia (operarios en campo cargando novedades). | Media/Baja frecuencia (administración, veterinario y dueño analizando métricas). |
| **Rol en Autenticación** | **Autoridad emisora:** Valida contraseñas y firma tokens JWT con expiración. | **Consumidor:** Decodifica y valida la firma del token sin requerir round-trips adicionales. |
| **Manejo de Base de Datos** | Dueño absoluto del esquema DDL mediante **Prisma ORM**. Fallback a memoria si la BD cae. | Lector seguro de PostgreSQL mediante modelos con `managed = False`. |

---

## 4. Decisiones Técnicas Implementadas

### 4.1. Single Source of Truth para la Base de Datos
- **Problema abordado:** Si dos ORMs (`Prisma` y `Django ORM`) ejecutan migraciones sobre la misma base de datos, se producen colisiones destructivas en las tablas de seguimiento (`_prisma_migrations` vs `django_migrations`) y conflictos de tipos/restricciones.
- **Solución implementada:** Prisma es la **única fuente de verdad** para DDL (`prisma migrate dev`). Los modelos de Django en `legacy_models/models.py` declaran estrictamente `class Meta: managed = False`. Django jamás genera ni ejecuta sentencias `ALTER TABLE` o `CREATE TABLE` sobre el dominio compartido.
- **Mapeo de Nombres CamelCase y CUIDs:** Los identificadores generados por Prisma (`cuid()`) se mapearon como `CharField(max_length=32, primary_key=True)`. Las columnas con notación camelCase de Postgres se asociaron explícitamente mediante `db_column` (`fechaRegistro`, `pesoKg`, `stockActual`, etc.).

### 4.2. Autenticación y Autorización Unificada (Single Sign-On vía JWT)
- **Token interoperable:** Node.js firma los tokens usando `jsonwebtoken` con `JWT_SECRET` y algoritmo `HS256`, incluyendo `{ id, email, rol }`.
- **Validador en Django:** Se implementó `core.authentication.UnifiedJWTAuthentication` utilizando `PyJWT`. Valida la firma criptográfica con la misma clave y extrae la identidad del usuario.
- **Normalización RBAC:** En estricto apego a la regla de normalización de roles del proyecto, los roles se normalizan a minúsculas (`.lower()`), garantizando compatibilidad entre `dueno`, `capataz`, `peon`, `oficina` y `veterinario`.

### 4.3. Ruteo Transparente y Prevención de CORS
- En desarrollo, [client/vite.config.js](file:///c:/Users/tomas/OneDrive/Documentos/ProgramacionIV/TFI/VakeraGanaderia/client/vite.config.js) enruta según el prefijo:
  - `/api/py/*` ──► `http://localhost:8000` (Django)
  - `/api/*`    ──► `http://localhost:4000` (Node.js Express)
- El cliente React consume la API unificada a través de `/api`, evitando configuraciones complejas de CORS cruzado en el navegador.

### 4.4. Estandarización de Respuestas HTTP
- Para mantener la consistencia en el frontend, se crearon los helpers `core.responses.api_success` y `core.responses.api_error` en Django, replicando con exactitud la estructura JSON de Node.js:
  ```json
  // Éxito:
  { "ok": true, "mensaje": "...", "data": { ... } }
  // Error:
  { "ok": false, "error": "...", "detalles": { ... } }
  ```

---

## 5. Módulos y Funcionalidades Desarrolladas en Python

### 5.1. Módulo `reportes` (`server_py/reportes/`)
1. **Resumen Ejecutivo (`GET /api/py/reportes/resumen-ejecutivo`):**
   - Agregaciones estadísticas de hacienda (cabezas totales, peso promedio, porcentaje saludable por lote/categoría).
   - Indicadores de eventos sanitarios pendientes, insumos críticos y partes sin revisar.
2. **Exportación Oficial en PDF (`GET /api/py/reportes/exportar-pdf`):**
   - Construcción de documentos PDF con membrete institucional mediante `ReportLab`.
   - Incluye tarjetas de resumen y tabla detallada de caravanas, categorías, pesos y estado sanitario.
3. **Exportación de Inventario en Excel (`GET /api/py/reportes/exportar-excel`):**
   - Generación de libros de trabajo `.xlsx` mediante `openpyxl`.
   - Incluye hojas independientes para "Inventario de Hacienda" y "Control de Insumos y Stock", con formato visual, encabezados corporativos y auto-ajuste de columnas.

### 5.2. Módulo `nutricion` (`server_py/nutricion/`)
1. **Formulación de Raciones Bovina (`POST /api/py/nutricion/calcular-racion`):**
   - Modelo bio-nutricional que estima:
     - Consumo de Materia Seca (CMS) según porcentaje de Peso Vivo (PV).
     - Requerimiento mínimo de Proteína Bruta (PB) y Energía según la ganancia diaria objetivo (ADG en kg/día).
     - Reparto óptimo entre forraje verde fresco (pasto/silaje), concentrado/grano y suplementación mineral.
     - Pautas prácticas de manejo ganadero (aclimatación ruminal y acceso a agua).
2. **Proyección Biométrica de Peso (`GET /api/py/nutricion/proyeccion-peso`):**
   - Curva de crecimiento a 30, 60, 90 y 120 días por animal individual (vía caravana) o para el rodeo general.

### 5.3. Módulo `legacy_models` (`server_py/legacy_models/`)
- Mapeo unmanaged de todas las entidades del dominio ganadero:
  - `Usuario` (`usuarios`)
  - `Potrero` (`potreros`)
  - `Ganado` (`ganado`)
  - `SanidadEvento` (`sanidad_eventos`)
  - `Insumo` (`insumos`)
  - `ParteDiario` (`partes_diarios`)

---

## 6. Archivos Creados y Modificados en el Repositorio

### Archivos Nuevos Creados:
- `server_py/requirements.txt` — Especificación de librerías Python.
- `server_py/manage.py` — Entrada administrativa Django.
- `server_py/Dockerfile` — Despliegue en contenedor Docker.
- `server_py/vakera_backend/settings.py` — Configuración Django (Postgres, DRF, JWT, CORS).
- `server_py/vakera_backend/urls.py` — Enrutador maestro con prefijo `/api/py/`.
- `server_py/core/authentication.py` — Validador JWT unificado (`UnifiedJWTAuthentication`).
- `server_py/core/permissions.py` — RBAC canónico de roles.
- `server_py/core/responses.py` — Respuestas estándar (`api_success` / `api_error`).
- `server_py/core/exceptions.py` — Manejo global de excepciones.
- `server_py/core/tests.py` — Tests unitarios de autenticación y permisos.
- `server_py/legacy_models/models.py` — Modelos Prisma en Django con `managed = False`.
- `server_py/reportes/views.py` — Controladores de resumen, PDF y Excel.
- `server_py/reportes/services/pdf_service.py` — Generador PDF con ReportLab.
- `server_py/reportes/services/excel_service.py` — Generador Excel con openpyxl.
- `server_py/reportes/urls.py` y `server_py/reportes/tests.py`.
- `server_py/nutricion/views.py` — Controladores de raciones y proyecciones.
- `server_py/nutricion/services/racion_calculator.py` — Motor de nutrición bovina.
- `server_py/nutricion/urls.py` y `server_py/nutricion/tests.py`.
- `client/src/api/reportesPy.api.js` — Cliente frontend para consumo y descarga de reportes.

### Archivos Modificados:
- `client/vite.config.js` — Proxy agregado para redirigir `/api/py` a `localhost:8000`.
- `package.json` — Scripts agregados (`server:node`, `server:py`, `py:check`, `py:test`).
- `docker-compose.yml` — Servicio `backend-python` añadido vinculado a `vakera-postgres`.
- `.env` y `.env.example` — Variables añadidas (`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`).
- `README.md` — Guía de ejecución actualizada con la arquitectura híbrida.
- `PLAN_DE_TRABAJO.md` — Roadmap y fases actualizadas incorporando Python en la Fase 8.
- `AGENTS.md` — Reglas operativas para agentes actualizadas con convenciones de Python.

---

## 7. Comprobación de Calidad y Tests

La suite completa de pruebas unitarias e integración se ejecuta con:

```bash
npm run py:test
```

Resultados de la suite:
- **14 tests ejecutados satisfactoriamente (OK):**
  - Autenticación JWT con tokens válidos, expirados, alterados y sin credenciales.
  - Normalización de roles a minúsculas y restricción RBAC de Dueño vs Peón.
  - Cálculo de requerimientos nutricionales (CMS, Proteína Bruta, división de forraje/grano).
  - Integridad binaria del archivo PDF generado (cabecera `%PDF` y estilos de tabla).
  - Integridad binaria del archivo Excel generado (cabecera `PK` y hojas separadas).
  - Restricción de exportación de informes para roles no autorizados (Peón rechaza con `403 Forbidden`).
  - Autorización para Dueño (`200 OK` con tipo MIME `application/pdf` y `application/vnd.openxmlformats...`).
