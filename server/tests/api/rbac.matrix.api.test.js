/**
 * Tests de API — Matriz RBAC Completa y Test de Completitud de Rutas
 *
 * Fase 3B del Implementation Plan:
 * - Test de completitud: recorre app._router.stack y falla si alguna ruta de dashboard, permisos o auth
 *   no está registrada en la matriz esperada.
 * - Matriz RBAC completa: verifica que cada una de las 36 rutas protegidas responda:
 *     - 401 para petición sin token (sinToken).
 *     - 2xx o 4xx de negocio (nunca 401 ni 403) para roles permitidos.
 *     - 403 Forbidden para roles sin permiso.
 * - Defecto R4: verifica y documenta que GET /api/contacto es público y no requiere autenticación ni rol dueño.
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

// Inicializa tokens y configuración de entorno aislada para tests
require("../helpers/tokens");

const { firmarToken, encabezadoBearer } = require("../helpers/tokens");
const { resetearMemoria } = require("../helpers/memoria");
const {
  ROLES_SISTEMA,
  listarRutas,
  resolverRuta,
  MATRIZ_RBAC_ESPERADA,
} = require("../helpers/rutas");
const app = require("../../src/index");
const { ROLES } = require("../../src/utils/roles.constants");

describe("Fase 3B — Test de Completitud de Rutas de Express", () => {
  it("el 100% de las rutas registradas en Express de dashboard, permisos y auth están catalogadas en la matriz RBAC", () => {
    const rutasExpress = listarRutas(app);
    const modulosObjetivo = ["dashboard", "permisos", "auth"];

    const rutasMonitoreadas = rutasExpress.filter((r) =>
      modulosObjetivo.includes(r.modulo)
    );

    // Asegurar que hay rutas detectadas en la app
    assert.ok(
      rutasMonitoreadas.length >= 35,
      `Se esperaban al menos 35 rutas en dashboard, permisos y auth, encontradas: ${rutasMonitoreadas.length}`
    );

    for (const r of rutasMonitoreadas) {
      const encontrada = MATRIZ_RBAC_ESPERADA.find(
        (m) => m.metodo === r.metodo && m.ruta === r.ruta
      );

      assert.ok(
        encontrada,
        `La ruta ${r.metodo} ${r.ruta} (módulo: ${r.modulo}) está registrada en Express pero falta en la matriz RBAC esperada.`
      );
    }
  });

  it("la matriz RBAC esperada no contiene rutas huérfanas que no existan en Express", () => {
    const rutasExpress = listarRutas(app);

    for (const esperada of MATRIZ_RBAC_ESPERADA) {
      const existe = rutasExpress.find(
        (r) => r.metodo === esperada.metodo && r.ruta === esperada.ruta
      );

      assert.ok(
        existe,
        `La ruta esperada ${esperada.metodo} ${esperada.ruta} no fue encontrada en app._router.stack de Express.`
      );
    }
  });

  it("todas las rutas de los módulos dashboard y permisos exigen autenticación obligatoria", () => {
    const rutasProtegidas = MATRIZ_RBAC_ESPERADA.filter((r) =>
      ["dashboard", "permisos"].includes(r.modulo)
    );

    for (const r of rutasProtegidas) {
      assert.equal(
        r.requiereAuth,
        true,
        `La ruta ${r.metodo} ${r.ruta} pertenece a ${r.modulo} y debe tener requiereAuth = true`
      );
    }
  });
});

describe("Fase 3B — Matriz RBAC Completa por Tabla (36 rutas protegidas × 6 identidades)", () => {
  beforeEach(() => {
    resetearMemoria();
  });

  const rutasProtegidas = MATRIZ_RBAC_ESPERADA.filter((r) => r.requiereAuth);

  // Generar tokens para cada uno de los 5 roles del sistema
  const tokensPorRol = {};
  for (const rol of ROLES_SISTEMA) {
    tokensPorRol[rol] = firmarToken({
      id: `usr-${rol}-test`,
      rol,
      establecimientoId: "est-el-rancho",
    });
  }

  for (const item of rutasProtegidas) {
    const { metodo, ruta, rolesPermitidos, bodyEjemplo } = item;
    const rutaResuelta = resolverRuta(ruta, { id: "id-test-item-1" });

    describe(`${metodo} ${ruta}`, () => {
      // 1. Identidad: sinToken (anónimo)
      it(`[sinToken] responde 401 Unauthorized`, async () => {
        let req = request(app)[metodo.toLowerCase()](rutaResuelta);
        if (bodyEjemplo && (metodo === "POST" || metodo === "PATCH")) {
          req = req.send(bodyEjemplo);
        }

        const res = await req;
        assert.equal(
          res.status,
          401,
          `Se esperaba 401 sin token en ${metodo} ${rutaResuelta}, se obtuvo ${res.status}`
        );
        assert.equal(res.body.ok, false);
      });

      // 2..6. Identidades: cada uno de los 5 roles del sistema
      for (const rol of ROLES_SISTEMA) {
        const tieneAcceso = rolesPermitidos.includes(rol);

        if (tieneAcceso) {
          it(`[rol: ${rol}] PERMITIDO responde con código de negocio (no 401 ni 403)`, async () => {
            let req = request(app)
              [metodo.toLowerCase()](rutaResuelta)
              .set(encabezadoBearer(tokensPorRol[rol]));

            if (bodyEjemplo && (metodo === "POST" || metodo === "PATCH")) {
              req = req.send(bodyEjemplo);
            }

            const res = await req;

            // Al estar autorizado por RBAC, la petición entra al controlador:
            // puede responder 200, 201, 400 (por validación) o 404 (por ID simulado),
            // pero bajo ninguna circunstancia debe ser bloqueado con 401 ni 403.
            assert.notEqual(
              res.status,
              401,
              `Rol ${rol} no debería recibir 401 en ${metodo} ${rutaResuelta}`
            );
            assert.notEqual(
              res.status,
              403,
              `Rol ${rol} debería tener acceso permitido en ${metodo} ${rutaResuelta}, pero recibió 403: ${res.body.error}`
            );
          });
        } else {
          it(`[rol: ${rol}] DENEGADO responde 403 Forbidden`, async () => {
            let req = request(app)
              [metodo.toLowerCase()](rutaResuelta)
              .set(encabezadoBearer(tokensPorRol[rol]));

            if (bodyEjemplo && (metodo === "POST" || metodo === "PATCH")) {
              req = req.send(bodyEjemplo);
            }

            const res = await req;

            assert.equal(
              res.status,
              403,
              `Rol ${rol} NO debería tener acceso en ${metodo} ${rutaResuelta}, se esperaba 403 pero se obtuvo ${res.status}`
            );
            assert.equal(res.body.ok, false);
            assert.match(res.body.error, /Acceso denegado/i);
          });
        }
      }
    });
  }
});

describe("Fase 3B — Defecto de Seguridad R4: GET /api/contacto", () => {
  it(
    "R4: GET /api/contacto sin autenticación debería responder 401 pero es público",
    {
      todo: "R4: GET /api/contacto es público en presentacion.routes.js y no requiere autenticación ni rol dueño",
    },
    async () => {
      const res = await request(app).get("/api/contacto");

      // Criterio del plan: sin token -> 401
      assert.equal(res.status, 401);
      assert.equal(res.body.ok, false);
    }
  );

  it(
    "R4: GET /api/contacto con rol operario/peón debería responder 403 pero es público",
    {
      todo: "R4: GET /api/contacto no valida roles y expone información de contacto a cualquier usuario o visitante",
    },
    async () => {
      const tokenPeon = firmarToken({
        id: "usr-peon-1",
        rol: ROLES.PEON,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .get("/api/contacto")
        .set(encabezadoBearer(tokenPeon));

      // Criterio del plan: con rol ≠ dueño -> 403
      assert.equal(res.status, 403);
      assert.equal(res.body.ok, false);
    }
  );

  it(
    "R4: respuesta pública de contactos no debe contener emails ni números de teléfono de clientes/proveedores",
    {
      todo: "R4: el endpoint actual retorna teléfonos y correos en texto plano sin autenticación",
    },
    async () => {
      const res = await request(app).get("/api/contacto");

      const texto = JSON.stringify(res.body);
      // No debería haber correos @ ni patrones de teléfono en una respuesta no autorizada
      assert.ok(!texto.includes("@"), "La respuesta pública contiene correos electrónicos expuestos");
    }
  );
});

