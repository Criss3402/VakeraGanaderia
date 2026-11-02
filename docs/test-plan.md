# Plan de Pruebas — Monorepo Vakera Ganadería

> [!IMPORTANT]
> Este plan está basado en la **investigación real del repositorio** (01/11/2026). Varias premisas del enunciado no coinciden con el código. Ver §0.1 antes de aprobar.

---

## 0. Diagnóstico previo (investigación)

### 0.1 Stack real detectado vs. enunciado

| Capa | Enunciado | Realidad en el repo | Impacto en el plan |
|---|---|---|---|
| Backend Node | Express + **TypeScript** | Express `^4.19.2`, **JavaScript CommonJS** (`"type": "commonjs"`), sin `tsconfig`, sin TS | No hay typecheck. No se propone migrar a TS (fuera de alcance). |
| Django | DRF con serializers, viewsets, managers, signals, migraciones | DRF con **3 `APIView` de solo lectura + 2 de cálculo**. **Cero** serializers, viewsets, managers, signals o migraciones. Modelos `managed = False` reflejando tablas Prisma | Se testean vistas, auth, permisos, servicios y queries. Lo demás es N/A (con guía si se agrega a futuro). |
| ORM / DDL | — | **Prisma 6.19.3** es dueño del esquema; Django solo lee | PostgreSQL de test se crea con Prisma, no con Django. |
| React | React + Vite | React `18.3.1`, Vite `5.4`, JS (sin TS), sin router (navegación por estado en `App.jsx`), `maplibre-gl` en Parcelas | Vitest + Testing Library + msw. |
| BD | PostgreSQL | `postgres:16-alpine` en Docker, puerto **5433** | Base efímera separada en puerto 5434 (Fase 5). |
| CI | — | **No existe** (`.github/` ausente) | Se crea en Fase 6. |
| Lint / format | — | **Ninguno** (sin ESLint, Prettier, ruff, flake8) | Se propone ruff para Python; ESLint queda como pregunta. |

### 0.2 Herramientas de testing presentes

| Paquete | Runner actual | Archivos | Tests |
|---|---|---|---|
| `server/` | `node --test` nativo (Node **v24.19.0**) + `node:assert/strict` | `server/tests/unit.test.js` | 21 |
| `client/` | `node --test` nativo, mocks manuales de `fetch` y `localStorage` | `client/src/api/client.test.js` | 6 |
| `server_py/` | `manage.py test` (unittest) + `APIClient` + `pyjwt` | `core/tests.py`, `nutricion/tests.py`, `reportes/tests.py` | 14 |

- **No hay**: Supertest, Vitest, Testing Library, msw, pytest, factory-boy, cobertura (c8/coverage.py), fixtures compartidas ni factories.
- **Patrón de mocks actual**: monkey-patch manual de métodos estáticos (`UsuarioModel.buscarPorId = async () => …`) y de `prisma.ganado.count`, con restauración en `finally`/`after`.
- **BD en tests Django**: `settings.py` cambia a SQLite `:memory:` **solo si `"test" in sys.argv`** (no funciona con `pytest`).

### 0.3 Módulos críticos identificados

| Área | Archivos | Por qué es crítico |
|---|---|---|
| Autenticación JWT | `server/src/middlewares/auth.middleware.js`, `controllers/auth.controller.js`, `server_py/core/authentication.py` | Emisión (Node) y verificación en 2 backends con secreto compartido |
| RBAC | `middlewares/rbac.middleware.js`, `routes/*.routes.js`, `core/permissions.py`, `client/src/views/4_permisos/*` | 5 roles, normalización mayúsculas/minúsculas |
| Multi-tenant | `obtenerEstablecimientoContexto` en `dashboard.controller.js`, todos los `models/*.js` | Aislamiento por `establecimientoId` |
| Inventario | `models/insumo.model.js` | Stock, reposición, eliminación masiva, locaciones |
| Rodeo | `models/ganado.model.js` | Caravana única, bajas/traslados masivos |
| Partes diarios | `models/parteDiario.model.js` | Máquina de estados PENDIENTE/APROBADO/RECHAZADO |
| Usuarios | `models/usuario.model.js`, `controllers/permisos.controller.js` | Roles, vinculación de empleados, protección del dueño |
| Reportes | `server_py/reportes/views.py` | Agregaciones sobre toda la hacienda |
| Fallback en memoria | `server/src/config/db.js` + `catch` en cada modelo | Enmascara errores de BD |

### 0.4 Invariantes del sistema (lo que los tests deben proteger)

| ID | Invariante |
|---|---|
| **I1** | **Aislamiento entre tenants**: toda lectura/escritura de Ganado, Insumo, Potrero, ParteDiario, SanidadEvento y Usuario queda limitada al `establecimientoId` del usuario autenticado. |
| **I2** | **RBAC**: cada ruta exige exactamente los roles definidos en `dashboard.routes.js` / `permisos.routes.js`; los roles se comparan en minúsculas. |
| **I3** | **Sin filtrado de secretos**: las respuestas nunca contienen `password`, `tokenVerificacion`, `tokenRecuperacion` ni sus fechas de expiración. |
| **I4** | **Stock**: `stockActual ≥ 0` y `requiereReposicion === (stockActual <= stockMinimo)` después de cada mutación. |
| **I5** | **Partes**: el peón solo crea en `PENDIENTE`; solo capataz o dueño cambian el estado. |
| **I6** | **Caravana**: única, sin espacios y en mayúsculas. |
| **I7** | **Dueño**: no puede ser degradado ni desvinculado. |
| **I8** | **Formato de respuesta**: `{ ok, data?, mensaje?, error?, detalles? }` en Node y Django. |
| **I9** | **JWT**: el mismo secreto y HS256 en ambos backends; tokens vencidos o con firma inválida se rechazan con 401. |
| **I10** | **Caída de BD**: Django responde 503; Node usa el fallback en memoria **y lo registra con `console.warn`**. |

### 0.5 Riesgos reales encontrados en el código (los tests deben exponerlos)

> [!CAUTION]
> Estos son defectos detectados durante la investigación. El plan **no los corrige**: escribe tests que documentan el comportamiento esperado. Cómo marcarlos depende de tu respuesta a la pregunta Q3 (§7).

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| R1 | 🔴 Crítico | **El registro devuelve el código de activación** en el body (`usuario.tokenVerificacion`): permite saltear la verificación por email | `auth.controller.js` `registro` → `usuario: nuevoUsuario`; `UsuarioModel.crear` solo quita `password` |
| R2 | 🔴 Crítico | **Escalada de privilegios en registro**: el body acepta `rol` y `establecimientoId` → cualquiera se registra como `dueno` **dentro de un establecimiento ajeno** | `registro` usa `rol \|\| "dueno"` y `establecimientoId` del body |
| R3 | 🔴 Crítico | **IDOR entre tenants**: actualizar/dar de baja ganado, ver ficha, actualizar stock, eliminar insumo, cambiar estado de parte o sanidad, trasladar a potrero ajeno y cambiar rol de usuario operan **solo por `id`**, sin `establecimientoId` | `GanadoModel.actualizar/darDeBaja/buscarPorId/trasladoMasivo`, `InsumoModel.eliminar/actualizarStock`, `ParteDiarioModel.cambiarEstado`, `SanidadModel.actualizarEstado`, `UsuarioModel.actualizarRol` |
| R4 | 🔴 Crítico | **`GET /api/contacto` es público** y lista nombre, email y teléfono de todos los contactos (datos personales) | `presentacion.routes.js` sin `authMiddleware` |
| R5 | 🔴 Crítico | **Reportes Django agregan la hacienda de TODOS los tenants**: `Ganado.objects.all()`; `AuthUser` descarta `establecimientoId` del JWT | `reportes/views.py`, `core/authentication.py` |
| R6 | 🟠 Alto | `/me` y login devuelven `tokenVerificacion` / `tokenRecuperacion` | `buscarPorId` y `login` solo quitan `password` |
| R7 | 🟠 Alto | **Condición de carrera en stock**: lectura y escritura separadas (`findUnique` + `update`) → actualizaciones perdidas bajo concurrencia | `InsumoModel.actualizarStock` |
| R8 | 🟠 Alto | Códigos de 6 dígitos (`Math.random`) sin límite de intentos en `verificar-email` / `restablecer-password` → fuerza bruta viable (900.000 combinaciones) | `auth.controller.js` |
| R9 | 🟠 Alto | **Valores por defecto de `JWT_SECRET` distintos**: Node `vakera_dev_secret_no_usar_en_produccion` vs Django `vakera_super_secret_jwt_key_2026` → sin `.env`, los tokens de Node fallan en Django | `auth.middleware.js` vs `settings.py` |
| R10 | 🟠 Alto | **Migraciones Prisma desincronizadas**: `migration.sql` no tiene `establecimientoId`, `emailVerificado` ni tokens, y conserva `UNIQUE(potreros.nombre)`; el esquema real se aplicó con `db push` | `prisma/migrations/20261004220652_init_vakera_schema/migration.sql` |
| R11 | 🟡 Medio | Usuario `usr-1` / `dueno@vakera.com` es **siempre `dueno`** por código, ignore lo que diga la BD | `UsuarioModel.buscarPorId` |
| R12 | 🟡 Medio | Vistas Django con `except Exception: pass` → nunca llegan al handler 503 (viola AGENTS.md §2.3) | `reportes/views.py`, `nutricion/views.py` |
| R13 | 🟡 Medio | `CalcularRacionView` acepta `"nan"` / `"inf"` (`float("nan") <= 0` es `False`) → JSON inválido | `nutricion/views.py` |
| R14 | 🟡 Medio | Vocabulario de estado de stock inconsistente: `registrar` usa `"Crítico"` y `actualizarStock` usa `"Bajo Stock"` | `insumo.model.js` |
| R15 | 🟡 Medio | Borrar un `Usuario` borra en cascada sus partes diarios (`onDelete: Cascade`) | `schema.prisma` |
| R16 | 🟡 Medio | `index.js` llama a `app.listen()` incondicionalmente → no se puede usar Supertest sin abrir un puerto | `server/src/index.js` |
| R17 | 🟢 Bajo | Fechas con `toISOString().split("T")[0]` (UTC) → error de un día después de las 21:00 en Argentina | `parteDiario.model.js`, `sanidad.model.js` |

**Sin flujos de dinero reales**: el único cálculo monetario es `valorHaciendaEstimado` (`precioKgVivo = 2400` ARS fijo, en float) en `obtenerReportes`. El dominio crítico equivalente es **inventario + rodeo + usuarios**.

### 0.6 Puntos donde un test mal diseñado da falsa confianza

| ID | Trampa | Contramedida obligatoria |
|---|---|---|
| **F1** | Django en SQLite con `managed=False`: **las tablas no existen**, las vistas atrapan la excepción y devuelven ceros → el test pasa con 200 **sin ejecutar ninguna query**. `test_endpoint_resumen_ejecutivo` ya es un caso así. | Los tests de queries corren **solo contra PostgreSQL real** (Fase 5) y verifican valores concretos insertados con factories. |
| **F2** | El `catch` de cada modelo Node cae a memoria ante **cualquier** error (incluido un mock mal armado o un typo en un campo) → el test pasa con datos semilla. | Todo test de modelo: (a) espía `console.warn` y verifica que **no** se llamó, o (b) verifica que el método de Prisma se llamó con el `where` esperado, incluido `establecimientoId`. |
| **F3** | Los tests "unitarios" de Node importan el `PrismaClient` real: con Docker levantado tocan la **BD de desarrollo**; además `db.js` y `solicitudesInsumos` son estado global compartido entre tests. | Los tests unitarios fuerzan `DATABASE_URL` a un host inexistente o stubbean Prisma; el estado en memoria se reinicia en `beforeEach`. |
| **F4** | Mockear `authMiddleware` completo en tests de rutas oculta el contexto de tenant y rol. | Firmar **JWT reales** con el secreto de test y stubbear solo `UsuarioModel.buscarPorId`. |
| **F5** | Testear `rbacMiddleware` de forma aislada no prueba que **cada ruta** lo tenga. | Tests de rutas basados en una tabla (ruta × método × 5 roles) vía Supertest. |
| **F6** | `RoleGate` / `tienePermiso` en React son cosméticos. | Nunca contar los tests de frontend como cobertura de autorización; el backend debe tener su propio test por cada permiso. |
| **F7** | Caché de 30 s de `client.js` compartida entre tests. | `limpiarCacheApi()` + `localStorage.clear()` en `beforeEach` global. |
| **F8** | Snapshots de vistas gigantes (`InsumosView` 87 KB, `ParcelasView` 75 KB). | **Prohibidos** los snapshots de vistas; solo aserciones de comportamiento por rol/texto accesible. |
| **F9** | `db.js` (seeds) y `index.js` inflan o reducen la cobertura. | Se excluyen explícitamente de la cobertura. |
| **F10** | Probar con `prisma db push` no valida las migraciones; probar con `migrate deploy` hoy falla (R10). | Decisión explícita en Q4; un test de deriva de esquema en Fase 5. |
| **F11** | Tests que dependen de la hora (expiración 24 h / 1 h, fechas UTC). | Relojes falsos (`mock.timers` en Node, `vi.useFakeTimers` en React, `freezegun` en Python). |

---

## 1. Alcance y objetivos

### 1.1 Dentro del alcance
- **Node/Express**: middlewares, controllers, modelos (ruta Prisma y fallback), rutas (contrato HTTP), manejo global de errores, servicios externos (email, clima) con dobles de prueba.
- **Django/DRF**: autenticación JWT unificada, permisos, manejador de excepciones, vistas de reportes y nutrición, servicios PDF/Excel/ración, queries sobre modelos `managed=False` contra PostgreSQL real.
- **React**: `api/*.js`, `AuthContext`, `ProtectedRoute`, `RoleGate`, `permisos.config.js`, componentes `ui/*`, `Sidebar`, flujos de login/registro/verificación y flujos críticos de `GanadoView` e `InsumosView`.
- **PostgreSQL**: aislamiento entre tenants, restricciones (`UNIQUE`, `onDelete`), concurrencia de stock y deriva de esquema.
- **Contrato entre backends**: JWT emitido por Node aceptado por Django y formato de respuesta idéntico.

### 1.2 Fuera del alcance (explícito)
- **Corregir** los defectos R1–R17 (se documentan con tests; se corrigen en tickets aparte, salvo que respondas otra cosa en Q3).
- Migración a TypeScript, ESLint o refactors de producción más allá de los mínimos listados en la Fase 1.
- `ParcelasView` / `maplibre-gl` (render WebGL), `WidgetClima` con API real, envío real de emails por SMTP.
- Tests de rendimiento, carga y pentesting automatizado.
- Landing pública (`1_inicio_presentacion`) salvo el formulario de contacto.
- E2E con Playwright más allá de un smoke opcional (Q6).

### 1.3 Cobertura objetivo (realista)

| Capa | Hoy | Objetivo | Alcance de medición |
|---|---|---|---|
| Node — `middlewares/`, `utils/` | Sin medir | **≥ 95 % líneas / 90 % ramas** | |
| Node — `controllers/`, `models/` | Sin medir | **≥ 75 % líneas / 65 % ramas** | Excluye `config/db.js`, `index.js`, `data/` |
| Node — `services/` | Sin medir | **≥ 60 %** | Con dobles de nodemailer y `fetch` |
| Django — `core/`, `nutricion/` | Sin medir | **≥ 90 %** | |
| Django — `reportes/` | Sin medir | **≥ 80 %** | |
| React — `api/`, `context/`, `views/4_permisos/`, `components/ui/` | Sin medir | **≥ 80 %** | |
| React — global | Sin medir | **≥ 40 %** | Excluye `ParcelasView`, landing |
| Integración PostgreSQL | 0 | **100 % de los modelos con al menos un test de aislamiento entre tenants** | Métrica por casos, no por líneas |

> [!NOTE]
> La cobertura es un piso, no la meta. La meta es que **cada invariante I1–I10 tenga al menos un test que falle si se rompe**.

---

## 2. Estrategia por capa

### 2.1 Node.js + Express (`server/`)

**Herramientas** (recomendación; confirmar en Q1):
| Herramienta | Uso | Motivo |
|---|---|---|
| `node:test` + `node:assert/strict` (ya presente) | Runner | Cero migración, soporta CommonJS, `mock.method`, `mock.timers` |
| `node --test --experimental-test-coverage` (Node 24) | Cobertura | Integrado; umbrales con `--test-coverage-lines` y similares |
| **`supertest`** (nuevo, devDependency) | Tests de contrato HTTP | Requiere exportar `app` sin `listen` (R16) |
| Stubs manuales de `nodemailer.createTransport` y `globalThis.fetch` | Servicios externos | msw no aporta valor en el servidor con solo 2 integraciones |

**Tipos de test**
| Tipo | Qué cubre | Sufijo |
|---|---|---|
| Unitario | `apiResponse`, `rbacMiddleware`, `authMiddleware`, `generarToken`, `normalizarInsumo`, `formatearParte`, validaciones de controllers con `res` falso | `*.unit.test.js` |
| Contrato / API | Ruta completa vía Supertest: middlewares, controller, modelo stubbeado y formato de respuesta | `*.api.test.js` |
| Integración | Modelo con Prisma real contra PostgreSQL efímero | `*.int.test.js` (Fase 5) |

**Qué se mockea y qué no**
| Se mockea | NO se mockea |
|---|---|
| `UsuarioModel.buscarPorId` (para inyectar el usuario en `authMiddleware`) | `jsonwebtoken` (siempre se firman tokens reales) |
| Métodos de los modelos en tests de contrato | `rbacMiddleware`, `authMiddleware`, `apiResponse` |
| `prisma.<modelo>.<método>` en tests unitarios de modelos | `bcryptjs` (usar `SALT_ROUNDS` real; es rápido con 10) |
| `nodemailer`, `fetch` (clima) | Express, el router y el handler global de errores |
| Reloj (`mock.timers`) para expiraciones | |

**Fixtures y datos**
- `server/tests/helpers/tokens.js`: `firmarToken({ id, rol, establecimientoId, expiresIn })` usando `JWT_SECRET` de test.
- `server/tests/helpers/usuarios.js`: un usuario por rol para **dos tenants** (`est-A`, `est-B`).
- `server/tests/helpers/memoria.js`: `resetearMemoria()` que restaura `db.js` a un clon profundo inicial (contra F3).
- `server/tests/helpers/res.js`: `crearMockRes()` (extraído del test actual).

**PostgreSQL**: los tests unitarios y de contrato **nunca** tocan una BD (con `DATABASE_URL` apuntando a `127.0.0.1:1` y Prisma stubbeado). Solo `*.int.test.js` usa la BD efímera.

### 2.2 Django + DRF (`server_py/`)

**Herramientas**
| Herramienta | Uso |
|---|---|
| **`pytest` + `pytest-django`** | Runner, `django_db`, `django_assert_num_queries`, `settings` fixture |
| **`factory-boy`** | Factories para modelos `managed=False` (solo en integración) |
| `rest_framework.test.APIClient` (ya presente) | Contrato HTTP |
| **`pytest-cov`** | Cobertura |
| **`freezegun`** | Expiración de JWT |
| **`ruff`** | Lint (nuevo; hoy no hay ninguno) |

Los tests `unittest.TestCase` existentes siguen funcionando bajo pytest sin cambios.

**Por componente**
| Componente | Estado en el repo | Estrategia |
|---|---|---|
| Autenticación (`UnifiedJWTAuthentication`) | Existe | Unitarios parametrizados: sin header, `Basic`, `Bearer` sin token, 3 partes, firma inválida, `alg: none`, vencido, sin `exp`, sin `id`, rol en mayúsculas o ausente |
| Permisos (`require_roles`, `Is*`, `CanAccessReports`) | Existe | Matriz parametrizada 5 roles × clase de permiso + usuario anónimo |
| Manejador de excepciones | Existe | `OperationalError` → 503; `ValidationError` dict/lista → formato `{ok:false}`; 401/403/404/405 |
| Vistas (`APIView`) | 5 vistas | Contrato HTTP: método no permitido (405), sin token (401), rol denegado (403), validación (400) y respuesta exitosa |
| Servicios (`racion_calculator`, `pdf_service`, `excel_service`) | Existe | Unitarios puros: límites (peso 49/50, gdp 0.5/0.51/0.8/0.81/0.9/0.91), PDF/XLSX con listas vacías, Unicode (ñ, tildes), 5.000 filas |
| Modelos `legacy_models` | `managed=False` | Test de guardia: **todos** los modelos tienen `managed is False` (AGENTS.md); test de mapeo `db_column` contra el esquema real (Fase 5) |
| Queries / N+1 | Agregaciones en reportes | `django_assert_num_queries(N)` en `resumen-ejecutivo` con datos reales (Fase 5) |
| Serializers, viewsets, managers, signals, migraciones | **No existen** | N/A. Regla: si se agregan, cada serializer tiene tests de `is_valid` (requeridos, tipos, límites) y cada viewset un test por acción × rol |
| Transacciones / constraints | Solo lectura | Fase 5: `django_db(transaction=True)` para verificar que la violación de `UNIQUE(caravana)` lanza `IntegrityError` (la constraint la impone PostgreSQL) |

**Base de datos de test** (resuelve F1)
- **Unitarios** (`-m "not integration"`): SQLite en memoria vía `DJANGO_TEST_DB=sqlite`. **No** pueden tocar `legacy_models`; si lo hacen, el test debe fallar (no pasar silenciosamente).
- **Integración** (`-m integration`): PostgreSQL efímero ya preparado por Prisma. Se sobrescribe `django_db_setup` para **usar la BD existente** (patrón documentado de pytest-django para BD externa) y cada test corre dentro de una transacción con rollback.

### 2.3 React + Vite (`client/`)

**Herramientas**
| Herramienta | Uso |
|---|---|
| **`vitest`** + **`jsdom`** | Runner (reusa la configuración de Vite) |
| **`@testing-library/react`**, **`@testing-library/user-event`**, **`@testing-library/jest-dom`** | Componentes |
| **`msw` v2** | Mock de red para `api/*.js` y flujos completos |
| **`@vitest/coverage-v8`** | Cobertura |
| Playwright | **Solo** E2E smoke opcional (Q6) |

**Tipos de test**
| Tipo | Qué cubre | Mock |
|---|---|---|
| Unitario | `tienePermiso`, `client.js` (caché, headers, errores), utilidades | msw o `fetch` falso |
| Componente | `ui/*`, `RoleGate`, `ProtectedRoute`, `Sidebar` | `AuthContext` envuelto con un usuario de prueba |
| Integración de UI | `LoginView`, `RegistroView`, `VerificarEmailView`, flujos de eliminación masiva en `GanadoView` e `InsumosView` | **msw** (red real simulada; los módulos `api/*.js` NO se mockean) |

**Qué se mockea y qué no**
| Se mockea | NO se mockea |
|---|---|
| Red (msw) | `client.js`, `auth.api.js`, `dashboard.api.js` (se ejercitan a través de msw) |
| `maplibre-gl` (`vi.mock`) si algún test toca Parcelas | `AuthContext` en tests de flujo (se usa el provider real) |
| Reloj para TTL de caché | `localStorage` (jsdom lo provee; se limpia en cada test) |

**Datos**: `client/src/test/fixtures/usuarios.js` (un usuario por rol), `client/src/test/msw/handlers.js` (respuestas `{ok,data}` con la forma real del backend).

### 2.4 PostgreSQL — qué usa BD real y qué no

| Caso | BD real efímera | Mock |
|---|---|---|
| Aislamiento entre tenants (I1) | ✅ | ❌ (un mock no prueba el `WHERE` real) |
| `UNIQUE(caravana)`, `UNIQUE(email)`, códigos `P2002` / `P2025` | ✅ | ❌ |
| `onDelete: Cascade / SetNull` (R15) | ✅ | ❌ |
| Concurrencia de stock (R7) | ✅ | ❌ |
| Agregaciones de reportes Django y número de queries | ✅ | ❌ |
| Deriva de esquema (R10) | ✅ | ❌ |
| Validación de entrada, RBAC, formato de respuesta | ❌ | ✅ |
| Fallback en memoria de Node | ❌ | ✅ (Prisma forzado a fallar) |

**Infraestructura**: `docker-compose.test.yml` con `postgres:16-alpine`, puerto **5434**, `tmpfs` (sin volumen) y base `vakera_test`. Esquema aplicado con Prisma (según Q4). Nunca se apunta a `vakera_db` (5433).

---

## 3. Matriz de riesgos y casos prioritarios

Prioridad: **P0** bloquea la entrega · **P1** importante · **P2** deseable.

| P | Módulo / flujo | Riesgo | Tipo de test | Casos prioritarios | Criterio de aceptación |
|---|---|---|---|---|---|
| P0 | `POST /api/auth/registro` | R1 filtración del código; R2 escalada de rol/tenant | API (Supertest) | (a) el body de la respuesta **no** contiene `tokenVerificacion`, `password` ni `tokenExpiracion` en ningún nivel; (b) `rol:"dueno"` + `establecimientoId` ajeno → el usuario creado **no** queda en ese tenant; (c) email duplicado → 409 (hoy 400); (d) password de 5 caracteres → 400; (e) email inválido → 400; (f) body vacío o `null` → 400 | Inspección profunda recursiva de claves prohibidas; estado creado verificado vía el stub del modelo |
| P0 | `POST /api/auth/login` | Enumeración de usuarios, filtración de secretos | API | Usuario inexistente vs password incorrecta → **mismo** 401 y mismo mensaje; no verificado → 403 con `requiereVerificacion`; éxito → token decodificable con `id`, `rol`, `establecimientoId`, sin campos prohibidos (R6); email con mayúsculas/espacios → normaliza | Mensajes idénticos para ambos casos de 401 |
| P0 | Verificación y recuperación | Expiración, reutilización, fuerza bruta (R8) | API + reloj falso | Código vencido (+24h01m) → 400 `expirado:true`; código usado dos veces → 2.º intento 400; `solicitar-recuperacion` con email inexistente → **200 neutral** idéntico; restablecer vencido (+1h01m) → 400; R8 como test documentado (100 intentos sin 429) | Reloj falso; ningún test depende del reloj real |
| P0 | `authMiddleware` (Node) / `UnifiedJWTAuthentication` (Django) | Bypass de autenticación | Unitario | `Bearer` sin token, `bearer` en minúsculas, token con `alg:none`, firmado con otro secreto, vencido, usuario borrado (Node → 401), sin `id` (Django → 401), sin `exp` (documentar el comportamiento) | Todos → 401 con `ok:false` |
| P0 | RBAC en **todas** las rutas | F5: una ruta sin middleware | API basada en tabla | Para cada `(método, ruta)` de `dashboard.routes.js` y `permisos.routes.js`: sin token → 401; cada uno de los 5 roles → 2xx/4xx de negocio si está permitido, 403 si no | La tabla de casos se deriva de las rutas; agregar una ruta sin caso hace fallar un test de completitud |
| P0 | Aislamiento entre tenants (R3) | IDOR | API (contrato) + Integración (Fase 5) | Usuario de `est-A` ejecuta `PATCH /ganado/:idB`, `DELETE /ganado/:idB`, `GET /ganado/:idB`, `PATCH /insumos/:idB/stock`, `DELETE /insumos/:idB`, `PATCH /partes/:idB/estado`, `PATCH /sanidad/:idB/estado`, `POST /ganado/traslado-masivo` hacia un potrero de B, `PATCH /permisos/usuarios/:idB/rol` → **404** y el recurso de B **no cambia** | En integración, el registro de B se relee de PostgreSQL y no cambió |
| P0 | `GET /api/contacto` (R4) | Exposición de datos personales | API | Sin token → 401; con rol ≠ dueño → 403 | Ningún email ni teléfono en la respuesta pública |
| P0 | Reportes Django (R5) | Fuga entre tenants | Integración (PG) | Insertar 3 animales en A y 5 en B; token de A → `total_cabezas == 3`; PDF/Excel de A no contienen caravanas de B | Valores exactos, no `> 0` |
| P0 | Respuestas sin secretos (I3) | R6 | API | `/me`, login, registro, verificar, restablecer, `permisos/usuarios`, `solicitar-empleado` → ninguna clave prohibida | Helper `assertSinSecretos(body)` reutilizado |
| P1 | Stock (I4) | Stock negativo, estado incoherente (R14) | Unitario + Integración | `restar` mayor al stock → 0 (no negativo); `conteo` negativo → 0; `cantidad:"abc"` → hoy suma 0 (debería ser 400); `stockActual == stockMinimo` → `requiereReposicion:true`; `stockMinimo + 0.01` → `false`; `estado` en el conjunto permitido | Invariante verificada tras cada operación |
| P1 | Concurrencia de stock (R7) | Actualización perdida | Integración (PG) | 20 llamadas `Promise.all` de `actualizarStock(id, 1, "sumar")` → stock final = inicial + 20 | Test documentado; falla hoy (Q3) |
| P1 | Eliminación masiva de insumos y ganado | Borrar recursos ajenos, lista vacía | API + Integración | `ids: []` → 400; `ids` con IDs de A y B → solo se borran los de A y `count` refleja solo esos; `ids` no array → 400; IDs inexistentes → `count: 0` | `count` exacto y releído desde BD |
| P1 | Locaciones de insumos | Renombrado parcial, colisión | API + Integración | Renombrar a un nombre vacío → 400; eliminar locación reasigna a la de destino; no afecta insumos de otro tenant; nombre con ` - ` (separador) | Releer `ubicacion` desde BD |
| P1 | Ganado (I6) | Caravana duplicada o mal normalizada | API + Integración | `" ar-001 "` → `AR-001`; duplicada → **409** (hoy 400 por fallback o 500); `pesoKg` 0, negativo, `"abc"`, `null` → 400 (hoy por defecto 400 kg sin error, documentar) | |
| P1 | Partes diarios (I5) | Peón aprueba, transición inválida | API | Peón `PATCH /partes/:id/estado` → 403; capataz → 200; estado `"aprobado"` (minúsculas) → normaliza; `"CANCELADO"` → 400; parte inexistente → 404 (hoy 500) | |
| P1 | Usuarios y roles (I7) | Degradar al dueño, rol inválido | API + Unitario | `nuevoRol:"admin"` → 400; degradar dueño → 400; desvincular dueño → 400; capataz cambia rol → 403; R11 documentado | |
| P1 | Fallback en memoria (I10) | Errores de BD enmascarados (F2) | Unitario | Con Prisma fallando: la operación usa memoria **y** `console.warn` se llama una vez con contexto; IDs en memoria con prefijo (`gan-`, `ins-`, …) | `console.warn` espiado |
| P1 | Django: manejador 503 | R12 | Unitario | `OperationalError` lanzado desde una vista → 503 con formato; documentar que `reportes` lo traga | |
| P1 | Django: nutrición | R13, límites | Unitario + API | `peso_kg` `"nan"`, `"inf"`, `"-1"`, `0`, `"abc"`, `null` → 400; `gdp` en límites de tramo; categoría desconocida → coeficientes de novillo; proyección con `gdp=-1` | Respuesta siempre es JSON válido |
| P1 | Contrato JWT Node ↔ Django (I9, R9) | Tokens incompatibles | Contrato | Token generado por `generarToken` (forma real) aceptado por `UnifiedJWTAuthentication` con el mismo `.env.test`; rol `DUENO` → `dueno` | Ambos backends leen el mismo `JWT_SECRET` de test |
| P1 | React `AuthContext` | Sesión fantasma tras 401 | Integración de UI (msw) | Usuario en caché + `/me` 401 → se limpian el token y `vakera_usuario_cache`, `estaAutenticado:false`; `/me` caído (red) → cierra sesión; login 403 no verificado → muestra el botón de activación | |
| P1 | React `client.js` | Caché cruzada entre cuentas | Unitario | `setToken(B)` invalida la caché de A; TTL vencido → vuelve a la red; respuesta no JSON → error con `status`; error de red (`fetch` lanza) → se propaga | |
| P1 | React registro | Regresión del código visible | Integración de UI | Tras registrarse **no** se muestra ningún código de 6 dígitos ni el botón "Activar e ingresar directamente" | |
| P2 | React vistas por rol | Botones visibles para roles sin permiso | Componente | `Sidebar` muestra "Usuarios y Roles" solo al dueño; `GanadoView` oculta "Eliminar Marcados" a peón y veterinario; `InsumosView` oculta la papelera a peón | (F6: no reemplaza el test de backend) |
| P2 | React eliminación masiva | Confirmación omitida | Integración de UI | Marcar 3 → "Eliminar Marcados (3)" → modal → confirmar → 1 request con `ids` exactos → lista recargada; cancelar → 0 requests | Requests contadas en msw |
| P2 | Fechas (R17) | Error de un día | Unitario + reloj falso | `formatearParte` con `2026-10-28T23:30-03:00` → `2026-10-28` | Documentado |
| P2 | Paginación `GET /ganado?take&skip` | Valores inválidos | API | `take=-1`, `take=abc`, `take=100000`, `skip` sin `take` → sin 500 | |
| P2 | Body inválido | Errores 400/413 | API | JSON malformado → 400 con `{ok:false}`; body > 1 MB → 413; método no soportado → 404 JSON | |
| P2 | Producción | Filtración del stack | API | `NODE_ENV=production`: error 500 sin `detalle` ni `stack`; CORS con origen no permitido → rechazado | |

---

## 4. Plan de implementación por fases

> [!IMPORTANT]
> **Reglas para el agente que implemente cada fase**
> 1. Solo puede crear o modificar los archivos listados en "Archivos permitidos". Cualquier otro cambio → detenerse y preguntar.
> 2. Ningún cambio en `src/` de producción salvo los listados en Fase 1.
> 3. Los tests que exponen defectos R1–R17 se marcan según Q3; **nunca** se ajusta la aserción para que pase.
> 4. Al terminar, pegar la salida completa de los comandos del DoD.

---

### Fase 1 — Configuración base de testing

**Objetivo**: dejar los 3 runners funcionando con la nueva estructura, sin cambiar el comportamiento, y los 41 tests actuales pasando.

**Archivos permitidos**: ver lista exacta al final del documento.

**Tareas**
1. **Node**: hacer importable `app` sin abrir puerto: envolver `app.listen` en `if (require.main === module)` en `server/src/index.js` (única línea de producción tocada). Agregar `supertest`. Scripts `test`, `test:unit`, `test:api`, `test:int`, `test:coverage`. Helpers de tokens, `res` falso y reinicio de memoria. Smoke test con Supertest.
2. **Django**: corregir la detección de BD de test en `settings.py` para soportar pytest (`DJANGO_TEST_DB` + detección de `pytest`), **manteniendo** el comportamiento de `manage.py test`. Crear `requirements-dev.txt`, `pytest.ini` y `conftest.py` con fixtures `api_client`, `make_token(rol, establecimiento_id, exp_delta)` y `auth_client(rol)`.
3. **React**: instalar Vitest y Testing Library; crear `vitest.config.js` (`mergeConfig` con `vite.config.js`), `src/test/setup.js` (jest-dom, limpieza de `localStorage` y caché, ciclo de vida de msw) y handlers base. **Migrar** `client.test.js` de `node:test` a la API de Vitest **sin cambiar ninguna aserción** (equivalencia 1:1 revisable en el diff).
4. **Raíz**: scripts agregados y `.env.test.example` con un `JWT_SECRET` común de test (resuelve R9 en tests).

**Tests a crear**
| Archivo | Casos |
|---|---|
| `server/tests/api/app.smoke.api.test.js` | `GET /api/health` → 200 `status:"ok"`; ruta inexistente → 404 `{ok:false}`; `GET /api/dashboard/metricas` sin token → 401 |
| `server_py/core/tests/test_smoke.py` | `GET /api/py/health` → 200 sin token; `make_token` produce un token aceptado por `UnifiedJWTAuthentication` |
| `client/src/test/smoke.test.jsx` | `<Button>` renderiza y dispara `onClick` |

**Comandos**
```powershell
npm --prefix server install
npm --prefix client install
python -m pip install -r server_py/requirements.txt -r server_py/requirements-dev.txt
npm run test:node
npm run test:client
cd server_py; python -m pytest; cd ..
npm run py:test
```

**Definition of Done**
- [ ] `npm run test:node` → **22 pasan** (21 existentes + smoke), 0 fallan.
- [ ] `npm run test:client` (Vitest) → **7 pasan** (6 migrados + smoke).
- [ ] `python -m pytest` en `server_py/` → **16 pasan** (14 + 2), 0 errores de conexión a PostgreSQL.
- [ ] `npm run py:test` (runner legado) sigue en verde: **14 pasan**.
- [ ] `npm run server:node` sigue escuchando en `:4000` (verificado con `GET /api/health`).
- [ ] `git diff --stat` solo muestra archivos de la lista permitida.

**Criterio de finalización**: los cuatro comandos en verde en una terminal limpia y sin la BD levantada.

**Riesgos / dependencias**
- La ruta de OneDrive provocó `EPERM realpath` con Vite en el sandbox → ejecutar Vitest con permisos si ocurre.
- `python` no estuvo accesible en el sandbox durante la investigación; la versión instalada de Django no se pudo confirmar (Q8).
- Requiere respuesta a Q1 (runner de Node).

---

### Fase 2 — Dominio crítico en Django DRF

**Objetivo**: blindar auth, permisos, manejo de errores y servicios de cálculo/exportación (todo **sin** BD).

**Archivos permitidos**: `server_py/core/tests/*.py`, `server_py/nutricion/tests/*.py`, `server_py/reportes/tests/*.py`, `server_py/conftest.py` (solo agregar fixtures). Los `tests.py` existentes se **mueven** a `tests/test_legacy_*.py` sin modificar su contenido.

**Tests a crear**
| Archivo | Casos (mínimo) |
|---|---|
| `core/tests/test_authentication.py` | 12 parametrizados: sin header, `Basic`, `Bearer` solo, 3 partes, firma inválida, `alg:none`, vencido (freezegun), sin `exp`, sin `id`, rol `DUENO`→`dueno`, rol ausente → `""`, token Unicode inválido |
| `core/tests/test_permissions.py` | Matriz 5 roles × {`IsDueno`, `IsCapataz`, `IsOficina`, `IsPeon`, `IsVeterinario`, `CanAccessReports`, `require_roles(...)`} + usuario `None` + rol `None` |
| `core/tests/test_exceptions.py` | `OperationalError` → 503; `DatabaseError` → 503; `ValidationError` dict → `detalles`; lista → unida; `NotAuthenticated` → 401 formateado; formato `{ok,error}` en todos |
| `core/tests/test_guardia_modelos.py` | Todos los modelos de `legacy_models` tienen `managed is False`; ninguna app tiene carpeta `migrations/` con archivos |
| `nutricion/tests/test_racion_calculator.py` | Límites de tramo de gdp (0.5/0.51/0.9/0.91), `cms_pct` +0.15 si gdp > 0.8, peso < 50 → 50, categoría desconocida, `None` en todo, suma forraje + concentrado = CMS (±0.01) |
| `nutricion/tests/test_views.py` | 401 sin token; 405 en GET a calcular-racion; 400 para `nan`, `inf`, `-1`, `0`, `"abc"`, `null` (R13: `nan`/`inf` documentados); proyección: 4 puntos, gdp inválido → 0.75, gdp negativo (documentado) |
| `reportes/tests/test_services.py` | PDF y XLSX con listas vacías, con Unicode, con 5.000 filas (< 5 s), con `peso_kg=None`; XLSX releído con `openpyxl` y con encabezados correctos |
| `reportes/tests/test_views_rbac.py` | 3 endpoints × 5 roles + sin token: peón → 403; resto → 200; `Content-Disposition` correcto |

**Comandos**
```powershell
cd server_py
python -m pytest -m "not integration" -q
python -m pytest core/tests/test_authentication.py -q
python -m pytest -m "not integration" --cov=core --cov=nutricion --cov=reportes --cov-report=term-missing
python -m ruff check .
cd ..
```

**Definition of Done**
- [ ] ≥ **60 tests** nuevos y todos los legados en verde (los marcados como defecto según Q3).
- [ ] Cobertura `core/` ≥ 90 %, `nutricion/` ≥ 90 % (reportes se mide en Fase 5).
- [ ] Ningún test toca `legacy_models` con SQLite (si se intenta, falla).
- [ ] `ruff check` sin errores en los archivos de test nuevos.

**Criterio de finalización**: los comandos anteriores en verde sin PostgreSQL levantado.

**Riesgos**: R5/R12/R13 aparecen como defectos documentados; la cobertura de `reportes/views.py` será baja hasta la Fase 5 (esperado).

---

### Fase 3 — Servicios y rutas en Node.js/Express

Dividida en 3 sub-fases independientes (cada una se entrega por separado).

#### 3A — Autenticación y usuarios
**Archivos permitidos**: `server/tests/api/auth.api.test.js`, `server/tests/api/permisos.api.test.js`, `server/tests/unit/usuario.model.unit.test.js`, `server/tests/helpers/*`.
**Casos**: todos los de P0 de registro, login, verificación, recuperación y `/me` de la matriz; `assertSinSecretos`; cambio de rol, vinculación y desvinculación (I7, R2, R3 en usuarios, R6, R8, R11).
**DoD**: ≥ **40 tests**; `node --test tests/api/auth.api.test.js` en verde (excepto los defectos marcados).

#### 3B — RBAC por tabla y aislamiento entre tenants (contrato)
**Archivos permitidos**: `server/tests/api/rbac.matrix.api.test.js`, `server/tests/api/tenant.api.test.js`, `server/tests/helpers/rutas.js`.
**Casos**: matriz completa (≈ 35 rutas × 6 identidades ≈ 210 aserciones generadas); test de completitud que recorre `router.stack` y falla si una ruta no figura en la tabla; IDOR con modelos stubbeados que verifican que se recibió `establecimientoId` (R3).
**DoD**: el test de completitud cubre el 100 % de las rutas de `dashboard`, `permisos` y `auth`; `GET /api/contacto` público aparece como defecto R4.

#### 3C — Dominio de inventario, rodeo, partes y sanidad
**Archivos permitidos**: `server/tests/unit/{insumo,ganado,parteDiario,sanidad}.model.unit.test.js`, `server/tests/api/dashboard.api.test.js`, `server/tests/unit/services/{email,weather}.unit.test.js`.
**Casos**: I4 (stock), I5 (partes), I6 (caravana), eliminación masiva, locaciones, fallback con `console.warn` espiado (F2), paginación, JSON malformado, 413, producción sin stack, clima con `fetch` fallando → contingencia, email sin SMTP → no lanza.
**DoD**: ≥ **60 tests**; cobertura `models/` ≥ 75 % y `middlewares/` ≥ 95 %.

**Comandos (toda la Fase 3)**
```powershell
cd server
node --test "tests/**/*.unit.test.js" "tests/**/*.api.test.js"
node --test --test-name-pattern="registro" tests/api/auth.api.test.js
node --test --experimental-test-coverage --test-coverage-exclude="src/config/db.js" --test-coverage-exclude="tests/**" "tests/**/*.unit.test.js" "tests/**/*.api.test.js"
cd ..
```

**Riesgos**: los tests de 3B fallarán en masa por R3 si Q3 = "fallar en rojo"; se recomienda marcarlos como defecto conocido para que el CI siga siendo útil.

---

### Fase 4 — Componentes y hooks en React

**Archivos permitidos**: `client/src/**/*.test.{js,jsx}`, `client/src/test/**`.

**Tests a crear**
| Archivo | Casos |
|---|---|
| `src/api/client.test.js` (ampliar) | TTL vencido (reloj falso), `setToken` invalida la caché, respuesta no JSON, `fetch` lanza, `ttlMs:0`, mutación solo invalida su prefijo |
| `src/api/dashboard.api.test.js` | Cada función nueva (`bajaMasivaGanado`, `eliminarInsumosMasivo`, `gestionarLocacionInsumos`, `eliminarInsumo`) envía método, URL y body exactos (verificado en msw) |
| `src/context/AuthContext.test.jsx` | Hidratación desde caché, `/me` 401 → logout, error de red → logout, `iniciarSesion` con respuesta inválida → lanza, `cerrarSesion` limpia todo, `useAuth` fuera del provider → lanza |
| `src/views/4_permisos/permisos.config.test.js` | Matriz completa `tienePermiso` (5 roles × 9 permisos), rol `null`, permiso inexistente |
| `src/views/4_permisos/ProtectedRoute.test.jsx`, `RoleGate.test.jsx` | Cargando, no autenticado, rol no permitido, permitido |
| `src/components/layout/Sidebar.test.jsx` | "Usuarios y Roles" solo para el dueño; logo `/logo-vakera.png`; no existe el botón de colapso interno (regresión) |
| `src/views/2_login_registro/{Login,Registro,VerificarEmail}View.test.jsx` | Errores 400/401/403 visibles; 403 no verificado → botón de activación; registro **no** muestra código (regresión) |
| `src/views/3_dashboard/modulos/GanadoView.test.jsx` | Marcar → botones con contador; modal de baja masiva → 1 request con `animalIds` exactos; cancelar → 0 requests; peón no ve acciones |
| `src/views/3_dashboard/modulos/InsumosView.test.jsx` | Alternar Tarjetas/Lista; marcar todos; eliminar marcados; modal de locaciones: editar y eliminar → request con `accion` correcta; locaciones aisladas por cuenta en `localStorage` |

**Comandos**
```powershell
cd client
npx vitest run
npx vitest run src/context/AuthContext.test.jsx
npx vitest run -t "baja masiva"
npx vitest run --coverage
cd ..
```

**Definition of Done**
- [ ] ≥ **70 tests**; cobertura `api/`, `context/`, `views/4_permisos/`, `components/ui/` ≥ 80 %; global ≥ 40 %.
- [ ] 0 snapshots de vistas; 0 advertencias `act(...)` sin resolver.
- [ ] `npm run client:build` sigue en verde.

**Riesgos**: `GanadoView` (62 KB) e `InsumosView` (87 KB) son monolíticos → tests lentos y frágiles; usar consultas por rol accesible (`getByRole`), nunca clases CSS.

---

### Fase 5 — Integración con PostgreSQL

**Objetivo**: verificar I1, I4, I6, constraints, concurrencia y queries Django contra una BD real y efímera.

**Archivos permitidos**: `docker-compose.test.yml`, `server/tests/integration/**`, `server/tests/helpers/db.js`, `server_py/conftest.py`, `server_py/tests_integration/**`, `server_py/factories.py`, scripts en `package.json` raíz.

**Preparación de la BD** (según Q4)
```powershell
docker compose -f docker-compose.test.yml up -d --wait
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5434/vakera_test?schema=public"
npx prisma db push --force-reset --skip-generate
```

**Tests a crear**
| Archivo | Casos |
|---|---|
| `server/tests/integration/tenant.int.test.js` | Por cada modelo: crear en A y B; operar como A sobre IDs de B → B intacto (R3) |
| `server/tests/integration/constraints.int.test.js` | Caravana duplicada → error controlado; email duplicado; borrar un potrero → animales con `potreroId=null`; borrar un usuario → partes en cascada (R15, documentar) |
| `server/tests/integration/stock.concurrency.int.test.js` | 20 sumas concurrentes → +20 (R7); restas concurrentes nunca dejan stock < 0 |
| `server/tests/integration/insumos.int.test.js` | Eliminación masiva solo del tenant propio; renombrar/eliminar locación releído desde BD |
| `server/tests/integration/no-fallback.int.test.js` | Con BD arriba, ninguna operación llama a `console.warn` de fallback (F2) |
| `server/tests/integration/schema-drift.int.test.js` | Las columnas de `schema.prisma` existen en la BD; documenta R10 |
| `server_py/tests_integration/test_reportes_pg.py` | Factories de Ganado/Insumo/Parte/Sanidad; valores exactos de `total_cabezas`, `peso_promedio_kg`, `por_categoria`; fuga entre tenants (R5); `django_assert_num_queries` en `resumen-ejecutivo` (fija N); `estado_sanitario` en mayúsculas |
| `server_py/tests_integration/test_mapeo_columnas.py` | Cada `db_column` de `legacy_models` existe en `information_schema.columns` |
| `server_py/tests_integration/test_constraints.py` | `IntegrityError` por caravana duplicada con `django_db(transaction=True)` |
| `server_py/tests_integration/test_jwt_contrato.py` | Token con la forma exacta de `generarToken` (Node) aceptado por Django |

**Comandos**
```powershell
npm run test:int
cd server; node --test "tests/integration/**/*.int.test.js"; cd ..
cd server_py; python -m pytest -m integration -q; cd ..
docker compose -f docker-compose.test.yml down -v
```

**Definition of Done**
- [ ] El 100 % de los modelos con un test de aislamiento entre tenants.
- [ ] Cobertura de `reportes/` ≥ 80 % sumando unitarios e integración.
- [ ] La suite de integración corre dos veces seguidas con el mismo resultado (sin estado residual).
- [ ] Ningún test apunta al puerto 5433 (verificado con `Select-String` en `tests/`).

**Riesgos**: depende de Docker (en Windows requiere permisos fuera del sandbox); R10 bloquea `migrate deploy`; los tests de concurrencia pueden ser no deterministas → repetir 5 veces en la verificación.

---

### Fase 6 — Cobertura, CI y documentación

**Archivos permitidos**: `.github/workflows/tests.yml`, `server/package.json` (umbrales), `client/vitest.config.js` (umbrales), `server_py/pytest.ini` (umbral `--cov-fail-under`), `docs/testing.md`, `README.md` (sección Testing), `docs/test-plan.md`.

**Tareas**
- Umbrales de cobertura de §1.3 aplicados (el CI falla si se baja).
- Workflow de GitHub Actions con 4 jobs paralelos: `node` (unit + api), `client` (vitest + build), `python` (pytest unit + ruff), `integration` (service `postgres:16-alpine`, `prisma db push`, Node int + pytest integration). Node 24 y Python 3.12 (igual que el `Dockerfile`).
- `docs/testing.md`: cómo correr cada suite, convenciones (§6) y cómo se marcan los defectos conocidos.
- (Opcional, Q6) Playwright smoke: login como dueño → ver Ganado → cerrar sesión.

**Comandos**
```powershell
npm test
npm run test:coverage
npm run test:int
```

**Definition of Done**
- [ ] El workflow pasa en un PR de prueba.
- [ ] Un PR que borra `rbacMiddleware` de una ruta hace fallar el job `node` (prueba de mutación manual).
- [ ] Un PR que quita `establecimientoId` de un `where` hace fallar el job `integration`.
- [ ] `docs/test-plan.md` y `docs/testing.md` publicados.

---

## 5. Comandos de verificación

Leyenda: ✅ existe hoy en el repo · 🆕 se agrega en el plan · ⛔ no aplica / no detectado.

### Backend Node (`server/`)
| Acción | Comando | Estado |
|---|---|---|
| Install | `npm --prefix server install` | ✅ |
| Dev | `npm run server:node` · `npm --prefix server run dev` | ✅ |
| Lint | — | ⛔ (sin ESLint; Q7) |
| Typecheck | — | ⛔ (JavaScript, no TypeScript) |
| Test | `npm run test:node` | ✅ (hoy solo `tests/unit.test.js`) |
| Test único | `cd server; node --test --test-name-pattern="authMiddleware" tests/unit.test.js` | ✅ |
| Coverage | `cd server; node --test --experimental-test-coverage "tests/**/*.test.js"` | 🆕 (script `test:coverage`) |

### Django (`server_py/`)
| Acción | Comando | Estado |
|---|---|---|
| Install | `python -m pip install -r server_py/requirements.txt` | ✅ |
| Install dev | `python -m pip install -r server_py/requirements-dev.txt` | 🆕 |
| Migrate | ⛔ Django no migra (`managed=False`). Esquema: `npm run db:migrate` (Prisma) o `npx prisma db push` | ✅ (Prisma) |
| Check | `npm run py:check` | ✅ |
| Test | `npm run py:test` (unittest) · `cd server_py; python -m pytest` | ✅ / 🆕 |
| Test único | `python server_py/manage.py test nutricion.tests.NutricionTestCase.test_endpoint_calcular_racion` · `python -m pytest core/tests/test_authentication.py::test_x` | ✅ / 🆕 |
| Lint | `cd server_py; python -m ruff check .` | 🆕 |
| Typecheck | — | ⛔ (sin mypy; fuera de alcance) |
| Coverage | `cd server_py; python -m pytest --cov --cov-report=term-missing` | 🆕 |

### React (`client/`)
| Acción | Comando | Estado |
|---|---|---|
| Install | `npm --prefix client install` | ✅ |
| Dev | `npm run client:dev` | ✅ |
| Build | `npm run client:build` | ✅ |
| Lint / Typecheck | — | ⛔ |
| Test | `npm run test:client` (hoy `node --test`; pasa a Vitest) | ✅ → 🆕 |
| Test único | `cd client; npx vitest run src/api/client.test.js -t "caché"` | 🆕 |
| Coverage | `cd client; npx vitest run --coverage` | 🆕 |

### Base de datos y Docker
| Acción | Comando | Estado |
|---|---|---|
| Levantar BD de desarrollo (5433) | `npm run db:up` | ✅ |
| Bajar | `npm run db:down` | ✅ |
| Sincronizar esquema | `npx prisma db push` · `npm run db:migrate` | ✅ |
| Seed | `npm run db:seed` | ✅ |
| Studio | `npm run db:studio` | ✅ |
| BD de test efímera (5434) | `docker compose -f docker-compose.test.yml up -d --wait` | 🆕 |
| Esquema de test | `npx prisma db push --force-reset --skip-generate` (con `DATABASE_URL` de test) | 🆕 |
| Todo | `npm test` | ✅ (se amplía) |

---

## 6. Convenciones obligatorias

### 6.1 Nombres y estructura
```
server/tests/
├── helpers/            # tokens.js, res.js, memoria.js, rutas.js, db.js
├── unit/               # *.unit.test.js  — sin red, sin BD
├── api/                # *.api.test.js   — Supertest, modelos stubbeados
├── integration/        # *.int.test.js   — PostgreSQL efímero
└── unit.test.js        # legado (se conserva tal cual)

server_py/
├── conftest.py         # fixtures globales
├── factories.py        # factory-boy (solo integración)
├── <app>/tests/test_*.py
└── tests_integration/test_*.py   # @pytest.mark.integration

client/src/
├── test/               # setup.js, msw/, fixtures/
└── **/<Componente>.test.jsx      # junto al componente
```
- Nombre de test: **comportamiento observable** en español, formato *"[condición] → [resultado esperado]"*. Ej.: `"peón intenta aprobar un parte → 403 y el parte sigue PENDIENTE"`.
- Un `describe` por unidad; un `it`/`test` por comportamiento.

### 6.2 Unitario vs integración
| | Unitario | Contrato/API | Integración |
|---|---|---|---|
| Red / puertos | ❌ | Supertest en memoria | ✅ |
| PostgreSQL | ❌ | ❌ | ✅ efímero |
| Tiempo máximo por test | 50 ms | 300 ms | 5 s |
| Puede fallar si Docker está apagado | ❌ nunca | ❌ nunca | ✅ |

### 6.3 Reglas para mocks
1. Se mockea **en el borde** (Prisma, red, reloj, SMTP), nunca la unidad bajo prueba.
2. Todo mock se restaura en `afterEach`/`finally`; con `node:test` usar `mock.method` + `mock.restoreAll()`.
3. Un mock de Prisma **debe** verificar los argumentos recibidos (en especial `where.establecimientoId`), no solo devolver datos.
4. Prohibido mockear `jsonwebtoken`, `rbacMiddleware` o `authMiddleware` en tests de rutas.
5. En React, prohibido `vi.mock` de `api/*.js` en tests de flujo: usar msw.
6. Todo test que dependa de la hora usa reloj falso.

### 6.4 Datos sensibles y secretos
- Solo se usa `.env.test` (versionado como `.env.test.example`), con secretos **ficticios** de test. Nunca se leen `.env` ni `server/.env` reales en tests.
- Prohibido usar emails reales: usar el dominio `@example.test`.
- Prohibido imprimir tokens, hashes o códigos en los logs de test.
- El CI usa variables de entorno del workflow, nunca secretos de producción.
- Ningún test envía emails reales ni llama a APIs externas reales.

### 6.5 Integridad de los tests
> [!WARNING]
> **Prohibido modificar un test para hacerlo pasar artificialmente.** Esto incluye: debilitar aserciones (`=== 3` → `> 0`), agregar `skip`/`todo` sin ticket, ampliar `try/catch` en el test, cambiar el código HTTP esperado para que coincida con un bug, o borrar casos.
> - Si un test revela un defecto de producción, se marca según Q3 **con referencia al riesgo (R1…R17)** y se informa.
> - Migrar de runner (Fase 1) está permitido solo si las aserciones quedan equivalentes 1:1 y el diff lo demuestra.

---

## 7. Preguntas y supuestos

### Preguntas (requieren tu decisión antes de implementar)
| # | Pregunta | Recomendación |
|---|---|---|
| **Q1** | ¿Runner de Node: mantener **`node:test`** (+ Supertest) o migrar a **Vitest**? | Mantener `node:test`: ya funciona con CommonJS, tiene mocks y cobertura nativos y evita migrar 21 tests. Vitest solo en el cliente. |
| **Q2** | ¿Confirmás que el stack real es **JavaScript sin TypeScript** y que DRF no usa serializers/viewsets? ¿Se planea agregarlos? | Planificar sobre lo que existe; dejar reglas para cuando se agreguen. |
| **Q3** | ¿Cómo se tratan los tests que exponen defectos (R1–R17)? (a) fallan en rojo y bloquean el CI, (b) se marcan como "defecto conocido" (`xfail(strict=True)` en pytest, `{ todo: "R3" }` en node:test, `test.fails` en Vitest) que **avisan cuando se corrige**, (c) se corrigen dentro de cada fase. | **(b)**, y abrir tickets para R1, R2, R3, R4 y R5 con prioridad inmediata (son de seguridad). |
| **Q4** | Por la deriva de migraciones (R10), ¿el esquema de la BD de test se crea con **`prisma db push`** o se genera primero una **migración nueva** para que `migrate deploy` funcione? | `db push` para avanzar en Fase 5 + un ticket aparte para regenerar la migración; el test de deriva lo vigila. |
| **Q5** | ¿El orden de fases es obligatorio? La superficie de Django es chica (5 vistas); el mayor riesgo está en Node (auth y tenants). | Permitir hacer **Fase 3A/3B antes que la Fase 2** (ver recomendación final). |
| **Q6** | ¿Incluir un smoke E2E con Playwright en la Fase 6? | Sí, 1 solo flujo (login → Ganado → logout), opcional. |
| **Q7** | ¿Agregar linters (ESLint en Node/React, ruff en Python)? | Solo ruff ahora (cero configuración); ESLint en otra iniciativa. |
| **Q8** | ¿Qué versión de Python y Django está instalada? (`requirements.txt` permite `>=5.0,<6.2`; el código menciona 6.1; no pude ejecutar `python` en el sandbox.) | Fijar versiones en `requirements-dev.txt` tras confirmarlas. |
| **Q9** | ¿Proveedor de CI? | GitHub Actions (asumido). |
| **Q10** | Reglas de negocio ambiguas: ¿la caravana es única **global** o **por establecimiento**? ¿`APROBADO`/`RECHAZADO` son estados finales? ¿Decrementar por debajo de 0 debe **bloquear** (400) o recortar a 0 (actual)? ¿Duplicados deben devolver **409** en vez de 400? | Necesito tu definición; los tests codifican la respuesta. |
| **Q11** | ¿El fallback en memoria de Node debe seguir activo en producción? Afecta qué se considera "éxito" en los tests de caída de BD. | Mantenerlo según AGENTS.md, pero siempre con `console.warn` verificable. |

### Supuestos (si no respondés, se aplican estos)
- S1: Node 24 en local y en CI; Python 3.12 (igual que el `Dockerfile`).
- S2: Docker disponible para la Fase 5 (en Windows, fuera del sandbox).
- S3: Se acepta el único cambio de producción de la Fase 1 en `server/src/index.js` y el ajuste de detección de BD de test en `settings.py`.
- S4: Los 41 tests existentes se conservan y se consideran correctos.
- S5: Los tests documentan el comportamiento **esperado**, no el actual, cuando difieren (ver Q3).

---

## Resumen ejecutivo

1. El repo tiene 41 tests (Node 21, Django 14, React 6) pero **no** protegen los riesgos reales.
2. Hay 5 defectos de seguridad críticos: código de activación en la respuesta del registro, escalada de rol/tenant en el registro, IDOR entre establecimientos, `GET /api/contacto` público y reportes Django sin filtro de tenant.
3. Los tests de Django pasan sin ejecutar queries (SQLite + `managed=False` + `except: pass`) y los modelos Node enmascaran errores con el fallback en memoria: ambas cosas dan falsa confianza.
4. El stack real es JavaScript (sin TS) y DRF sin serializers/viewsets; el plan se adapta a eso.
5. Herramientas: `node:test` + Supertest (Node), pytest + factory-boy (Django), Vitest + Testing Library + msw (React), PostgreSQL efímero en el puerto 5434.
6. Seis fases verificables; cada una con archivos permitidos, comandos y DoD numérico.
7. Objetivo: ≥ 230 tests nuevos, middlewares ≥ 95 %, modelos ≥ 75 %, Django `core` ≥ 90 %, React crítico ≥ 80 %.
8. La deriva de migraciones Prisma (R10) bloquea la integración y requiere decisión (Q4).
9. Los defectos se documentan como "conocidos" (Q3) sin debilitar ningún test.
10. Preguntas Q1, Q3, Q4 y Q10 son bloqueantes antes de empezar.

## Archivos exactos de la Fase 1

| Acción | Archivo |
|---|---|
| Modificar | `server/package.json` (devDependency `supertest`; scripts `test`, `test:unit`, `test:api`, `test:int`, `test:coverage`) |
| Modificar | `server/src/index.js` (envolver `app.listen` en `if (require.main === module)`) |
| Crear | `server/tests/helpers/tokens.js` |
| Crear | `server/tests/helpers/res.js` |
| Crear | `server/tests/helpers/memoria.js` |
| Crear | `server/tests/api/app.smoke.api.test.js` |
| Modificar | `server_py/vakera_backend/settings.py` (detección de BD de test compatible con pytest vía `DJANGO_TEST_DB`) |
| Crear | `server_py/requirements-dev.txt` |
| Crear | `server_py/pytest.ini` |
| Crear | `server_py/conftest.py` |
| Crear | `server_py/core/tests/__init__.py` |
| Crear | `server_py/core/tests/test_smoke.py` |
| Modificar | `client/package.json` (devDependencies de Vitest/Testing Library/msw/jsdom/coverage; scripts `test`, `test:watch`, `test:coverage`) |
| Crear | `client/vitest.config.js` |
| Crear | `client/src/test/setup.js` |
| Crear | `client/src/test/msw/server.js` |
| Crear | `client/src/test/msw/handlers.js` |
| Crear | `client/src/test/smoke.test.jsx` |
| Modificar | `client/src/api/client.test.js` (migración de runner, aserciones 1:1) |
| Modificar | `package.json` (raíz: scripts `test:py`, `test:int`, `test:coverage`) |
| Crear | `.env.test.example` |

> [!NOTE]
> `server_py/core/tests.py` y el nuevo paquete `server_py/core/tests/` no pueden coexistir en Python. En la Fase 1 el smoke de Django se ubicará en `server_py/test_smoke.py` (raíz de `server_py`) **o** se moverá `core/tests.py` → `core/tests/test_legacy_core.py` sin cambiar su contenido. Recomiendo lo segundo; si lo aprobás, se agrega ese movimiento a la lista.

## Recomendación: qué implementar primero

**Primero la Fase 1, inmediatamente después la Fase 3A + 3B (Node: auth, RBAC por tabla y tenants), y recién luego la Fase 2.**

Motivos:
- La Fase 1 es prerequisito técnico de todo (sin el guard en `index.js` no hay Supertest; sin el fix de `settings.py`, pytest intenta conectarse a PostgreSQL).
- Los 5 defectos críticos (R1–R5) están en Node, salvo R5. La Fase 3A/3B los convierte en tests ejecutables en ~2 sesiones, y da el mayor retorno en seguridad por hora invertida.
- La superficie de Django es chica (5 vistas, solo lectura) y su riesgo principal (R5, fuga entre tenants) **solo** se puede probar con PostgreSQL real (Fase 5); hacer la Fase 2 primero produciría tests verdes de poco valor (F1).
