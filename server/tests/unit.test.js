/**
 * Suite de Tests Unitarios — Backend Node.js (Vakera Ganadería)
 * Ejecutado con el runner nativo `node --test` (CommonJS).
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const { exito, error } = require("../src/utils/apiResponse");
const { ROLES, ROLES_LIST, ROLES_INFO } = require("../src/utils/roles.constants");
const rbacMiddleware = require("../src/middlewares/rbac.middleware");
const authMiddleware = require("../src/middlewares/auth.middleware");
const prisma = require("../src/config/prisma");
const UsuarioModel = require("../src/models/usuario.model");
const GanadoModel = require("../src/models/ganado.model");
const InsumoModel = require("../src/models/insumo.model");
const ParteDiarioModel = require("../src/models/parteDiario.model");
const PermisosController = require("../src/controllers/permisos.controller");
const DashboardController = require("../src/controllers/dashboard.controller");
const ChatController = require("../src/controllers/chat.controller");
const { ChatModel, MATRIZ_CHAT_ROLES } = require("../src/models/chat.model");
const db = require("../src/config/db");

const JWT_SECRET = process.env.JWT_SECRET || "vakera_dev_secret_no_usar_en_produccion";

function crearMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("1. Estandarización de Respuestas HTTP (apiResponse)", () => {
  it("exito() retorna estructura { ok: true, data, mensaje } y código HTTP esperado", () => {
    const res = crearMockRes();
    exito(res, { id: "gan-1" }, "Creado con éxito", 201);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, {
      ok: true,
      mensaje: "Creado con éxito",
      data: { id: "gan-1" },
    });
  });

  it("exito() omite data y mensaje cuando son nulos (default 200)", () => {
    const res = crearMockRes();
    exito(res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true });
  });

  it("error() retorna estructura { ok: false, error, detalles } y código de error", () => {
    const res = crearMockRes();
    error(res, "Caravana duplicada", 400, { caravana: "AR-1001" });

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      ok: false,
      error: "Caravana duplicada",
      detalles: { caravana: "AR-1001" },
    });
  });
});

describe("2. Control de Acceso Basado en Roles (RBAC y Constantes)", () => {
  it("define exactamente los 5 roles oficiales del sistema en minúsculas", () => {
    assert.deepEqual(ROLES_LIST.sort(), ["capataz", "dueno", "oficina", "peon", "veterinario"]);
    for (const rol of ROLES_LIST) {
      assert.ok(ROLES_INFO[rol], `Falta metadata en ROLES_INFO para ${rol}`);
    }
  });

  it("rbacMiddleware bloquea peticiones sin usuario autenticado con 401", () => {
    const middleware = rbacMiddleware(ROLES.DUENO);
    const req = {};
    const res = crearMockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.ok, false);
  });

  it("rbacMiddleware normaliza el rol en mayúsculas (ej. DUENO -> dueno) y permite acceso", () => {
    const middleware = rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ);
    const req = { usuario: { id: "usr-1", rol: "DUENO" } };
    const res = crearMockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.body, null);
  });

  it("rbacMiddleware rechaza un rol no autorizado con 403", () => {
    const middleware = rbacMiddleware(ROLES.DUENO, ROLES.OFICINA);
    const req = { usuario: { id: "usr-3", rol: "peon" } };
    const res = crearMockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.ok, false);
    assert.match(res.body.error, /Acceso denegado/);
  });
});

describe("3. Autenticación JWT (authMiddleware)", () => {
  const originalBuscarPorId = UsuarioModel.buscarPorId;

  before(() => {
    UsuarioModel.buscarPorId = async (id) => {
      if (id === "usr-test-1") {
        return {
          id: "usr-test-1",
          nombre: "Cristian Test",
          email: "dueno@vakera.com",
          rol: "dueno",
          establecimientoId: "est-el-rancho",
        };
      }
      return null;
    };
  });

  after(() => {
    UsuarioModel.buscarPorId = originalBuscarPorId;
  });

  it("rechaza petición sin header Authorization con 401", async () => {
    const req = { headers: {} };
    const res = crearMockRes();
    let nextCalled = false;

    await authMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.ok, false);
  });

  it("rechaza token con firma inválida con 401", async () => {
    const tokenInvalido = jwt.sign({ id: "usr-test-1" }, "clave_secreta_falsa");
    const req = { headers: { authorization: `Bearer ${tokenInvalido}` } };
    const res = crearMockRes();
    let nextCalled = false;

    await authMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /inválido/i);
  });

  it("rechaza token expirado con 401", async () => {
    const tokenExpirado = jwt.sign({ id: "usr-test-1" }, JWT_SECRET, { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${tokenExpirado}` } };
    const res = crearMockRes();
    let nextCalled = false;

    await authMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /expirado/i);
  });

  it("autentica correctamente un token válido e inyecta req.usuario", async () => {
    const tokenValido = jwt.sign({ id: "usr-test-1", rol: "dueno" }, JWT_SECRET, { expiresIn: "1h" });
    const req = { headers: { authorization: `Bearer ${tokenValido}` } };
    const res = crearMockRes();
    let nextCalled = false;

    await authMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.usuario.id, "usr-test-1");
    assert.equal(req.usuario.rol, "dueno");
    assert.equal(req.usuario.password, undefined);
  });
});

describe("4. Lógica de Negocio y Modelos (Patrón Dual en Memoria)", () => {
  it("ParteDiarioModel.formatearParte normaliza estado en mayúsculas y valores por defecto", () => {
    const parteFormateado = ParteDiarioModel.formatearParte({
      id: "pd-test-1",
      fecha: new Date("2026-10-28T12:00:00Z"),
      peonNombre: "Lucas Giménez",
      potrero: "Potrero Norte",
      novedades: "Revisión de aguadas completa",
      animalesRevisados: "45",
      estado: "pendiente",
    });

    assert.equal(parteFormateado.id, "pd-test-1");
    assert.equal(parteFormateado.fecha, "2026-10-28");
    assert.equal(parteFormateado.animalesRevisados, 45);
    assert.equal(parteFormateado.estado, "PENDIENTE");
  });

  it("ParteDiarioModel.cambiarEstado rechaza estados inválidos", async () => {
    await assert.rejects(
      async () => {
        await ParteDiarioModel.cambiarEstado("pd-1", "ESTADO_INEXISTENTE");
      },
      /Estado inválido/
    );
  });

  it("GanadoModel.trasladoMasivo lanza error si no se envían animales", async () => {
    await assert.rejects(
      async () => {
        await GanadoModel.trasladoMasivo([], "pot-1");
      },
      /Debe seleccionar al menos un animal/
    );
  });

  it("GanadoModel.obtenerMetricas utiliza agregaciones nativas de Prisma (count, aggregate, groupBy)", async () => {
    const origCount = prisma.ganado.count;
    const origAggregate = prisma.ganado.aggregate;
    const origGroupBy = prisma.ganado.groupBy;

    prisma.ganado.count = async () => 3;
    prisma.ganado.aggregate = async () => ({ _avg: { pesoKg: 420.4 } });
    prisma.ganado.groupBy = async ({ by }) => {
      if (by.includes("categoria")) {
        return [
          { categoria: "Vacas", _count: { _all: 2 } },
          { categoria: "Toros", _count: { _all: 1 } },
        ];
      }
      return [{ estadoSanitario: "SALUDABLE", _count: { _all: 3 } }];
    };

    try {
      const metricas = await GanadoModel.obtenerMetricas("est-el-rancho");
      assert.equal(metricas.totalCabezas, 3);
      assert.equal(metricas.pesoPromedioKg, 420);
      assert.deepEqual(metricas.porCategoria, { Vacas: 2, Toros: 1 });
      assert.deepEqual(metricas.porEstadoSanitario, { SALUDABLE: 3 });
      assert.equal(metricas.tasaMortalidadMensual, "0.8%");
    } finally {
      prisma.ganado.count = origCount;
      prisma.ganado.aggregate = origAggregate;
      prisma.ganado.groupBy = origGroupBy;
    }
  });

  it("GanadoModel.obtenerMetricas calcula agregaciones en fallback cuando Prisma no responde", async () => {
    const origCount = prisma.ganado.count;
    const origAggregate = prisma.ganado.aggregate;
    const origGroupBy = prisma.ganado.groupBy;

    const failFn = async () => {
      throw new Error("Simulación desconexión DB");
    };
    prisma.ganado.count = failFn;
    prisma.ganado.aggregate = failFn;
    prisma.ganado.groupBy = failFn;

    try {
      const metricas = await GanadoModel.obtenerMetricas("est-el-rancho");
      assert.equal(typeof metricas.totalCabezas, "number");
      assert.ok(metricas.totalCabezas > 0);
      assert.ok(metricas.pesoPromedioKg > 0);
      assert.equal(typeof metricas.porCategoria, "object");
      assert.equal(typeof metricas.porEstadoSanitario, "object");
    } finally {
      prisma.ganado.count = origCount;
      prisma.ganado.aggregate = origAggregate;
      prisma.ganado.groupBy = origGroupBy;
    }
  });

  it("InsumoModel.registrarSolicitud crea solicitud en estado Pendiente con cantidad numérica", () => {
    const nueva = InsumoModel.registrarSolicitud({
      insumoNombre: "Jeringa Autodosificadora 50ml",
      cantidad: "3",
      unidad: "Unidades",
      motivo: "Campaña aftosa",
      urgencia: "Alta",
      solicitanteNombre: "Dra. Sofía Navarro",
      solicitanteRol: "veterinario",
      establecimientoId: "est-test-unit",
    });

    assert.match(nueva.id, /^sol-/);
    assert.equal(nueva.cantidad, 3);
    assert.equal(nueva.estado, "Pendiente");
    assert.equal(nueva.establecimientoId, "est-test-unit");

    const lista = InsumoModel.listarSolicitudes("est-test-unit");
    assert.equal(lista.length, 1);
    assert.equal(lista[0].insumoNombre, "Jeringa Autodosificadora 50ml");
  });

  it("UsuarioModel nunca expone el campo password y protege al rol dueno de degradación", async () => {
    const origFindUnique = prisma.usuario.findUnique;
    prisma.usuario.findUnique = async () => {
      throw new Error("Usar memoria");
    };

    try {
      const dueno = await UsuarioModel.buscarPorId("usr-1");
      assert.ok(dueno);
      assert.equal(dueno.password, undefined);
      assert.equal(dueno.rol, "dueno");

      await assert.rejects(
        async () => {
          await UsuarioModel.actualizarRol("usr-1", "peon");
        },
        /No es posible modificar el rol del propietario/
      );
    } finally {
      prisma.usuario.findUnique = origFindUnique;
    }
  });
});

describe("5. Controladores y Cabeceras de Optimización", () => {
  it("PermisosController.obtenerRoles inyecta Cache-Control y retorna matriz RBAC", () => {
    const req = {};
    const res = crearMockRes();

    PermisosController.obtenerRoles(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Cache-Control"], "public, max-age=3600, stale-while-revalidate=600");
    assert.equal(res.body.ok, true);
    assert.ok(res.body.data.roles);
    assert.ok(res.body.data.matrizPermisos.dueno.modulos.dashboardEjecutivo);
    assert.equal(res.body.data.matrizPermisos.peon.modulos.dashboardEjecutivo, false);
  });

  it("DashboardController.registrarParteDiario valida que el campo novedades sea obligatorio", async () => {
    const req = { body: { potrero: "Lote 1" }, usuario: { id: "usr-3", rol: "peon" } };
    const res = crearMockRes();

    await DashboardController.registrarParteDiario(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.ok, false);
    assert.match(res.body.error, /novedades son requeridas/i);
  });

  it("DashboardController.actualizarEstadoParte rechaza estados fuera de [APROBADO, RECHAZADO, PENDIENTE]", async () => {
    const req = { params: { id: "pd-1" }, body: { estado: "CANCELADO" }, usuario: { id: "usr-2", rol: "capataz" } };
    const res = crearMockRes();

    await DashboardController.actualizarEstadoParte(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.ok, false);
    assert.match(res.body.error, /Estado inválido/i);
  });
});

describe("6. Módulo de Chat Compartimentado (Matriz Estricta por Rol y Espacio/Campo)", () => {
  const campoTest = "est-chat-test";
  let snapshotUsuarios;
  let origFindUnique;
  let origFindMany;

  before(() => {
    snapshotUsuarios = structuredClone(db.usuarios);
    origFindUnique = prisma.usuario.findUnique;
    origFindMany = prisma.usuario.findMany;

    // Forzar fallback en memoria durante el test unitario
    prisma.usuario.findUnique = async () => {
      throw new Error("Usar memoria en test de chat");
    };
    prisma.usuario.findMany = async () => {
      throw new Error("Usar memoria en test de chat");
    };

    // Registrar los 5 roles dentro del mismo campoTest y 1 usuario fuera del campo
    db.usuarios.push(
      {
        id: "usr-chat-dueno",
        nombre: "Dueño Estancia",
        email: "dueno.chat@vakera.com",
        rol: "dueno",
        establecimientoId: campoTest,
        establecimiento: "Campo Norte",
      },
      {
        id: "usr-chat-admin",
        nombre: "Admin Oficina",
        email: "admin.chat@vakera.com",
        rol: "oficina",
        establecimientoId: campoTest,
        establecimiento: "Campo Norte",
      },
      {
        id: "usr-chat-vet",
        nombre: "Vet Estancia",
        email: "vet.chat@vakera.com",
        rol: "veterinario",
        establecimientoId: campoTest,
        establecimiento: "Campo Norte",
      },
      {
        id: "usr-chat-capataz",
        nombre: "Capataz Estancia",
        email: "capataz.chat@vakera.com",
        rol: "capataz",
        establecimientoId: campoTest,
        establecimiento: "Campo Norte",
      },
      {
        id: "usr-chat-peon",
        nombre: "Peón Estancia",
        email: "peon.chat@vakera.com",
        rol: "peon",
        establecimientoId: campoTest,
        establecimiento: "Campo Norte",
      },
      {
        id: "usr-chat-otro-campo",
        nombre: "Capataz Ajeno",
        email: "ajeno.chat@vakera.com",
        rol: "capataz",
        establecimientoId: "est-otro-campo",
        establecimiento: "Otro Campo",
      },
      {
        id: "usr-chat-sin-campo",
        nombre: "Veterinario Sin Campo",
        email: "sincampo.chat@vakera.com",
        rol: "veterinario",
        establecimientoId: null,
        establecimiento: null,
      }
    );
  });

  after(() => {
    db.usuarios = snapshotUsuarios;
    db.mensajesChat = [];
    db.chatContactosOcultos = [];
    prisma.usuario.findUnique = origFindUnique;
    prisma.usuario.findMany = origFindMany;
  });

  it("verifica la matriz exacta de permisos para PEÓN, CAPATAZ, VETERINARIO, ADMINISTRADOR y DUEÑO", () => {
    assert.deepEqual(MATRIZ_CHAT_ROLES.peon, ["capataz"]);
    assert.deepEqual(MATRIZ_CHAT_ROLES.capataz.slice().sort(), ["oficina", "peon", "veterinario"]);
    assert.deepEqual(MATRIZ_CHAT_ROLES.veterinario.slice().sort(), ["capataz", "dueno", "oficina"]);
    assert.deepEqual(MATRIZ_CHAT_ROLES.oficina.slice().sort(), ["capataz", "dueno", "veterinario"]);
    assert.deepEqual(MATRIZ_CHAT_ROLES.dueno.slice().sort(), ["oficina", "veterinario"]);
  });

  it("PEÓN solo ve al CAPATAZ registrado en su mismo espacio (campo)", async () => {
    const res = await ChatModel.listarContactosPermitidos("usr-chat-peon");
    assert.equal(res.contactos.length, 1);
    assert.equal(res.contactos[0].id, "usr-chat-capataz");
    assert.equal(res.contactos[0].rol, "capataz");
  });

  it("CAPATAZ ve únicamente a ADMINISTRADOR, PEÓN y VETERINARIO de su campo (no ve a DUEÑO ni a otros campos)", async () => {
    const res = await ChatModel.listarContactosPermitidos("usr-chat-capataz");
    const ids = res.contactos.map((c) => c.id).sort();
    assert.deepEqual(ids, ["usr-chat-admin", "usr-chat-peon", "usr-chat-vet"]);
  });

  it("VETERINARIO ve únicamente a DUEÑO, ADMINISTRADOR y CAPATAZ de su campo", async () => {
    const res = await ChatModel.listarContactosPermitidos("usr-chat-vet");
    const ids = res.contactos.map((c) => c.id).sort();
    assert.deepEqual(ids, ["usr-chat-admin", "usr-chat-capataz", "usr-chat-dueno"]);
  });

  it("ADMINISTRADOR (oficina) ve únicamente a CAPATAZ, VETERINARIO y DUEÑO de su campo", async () => {
    const res = await ChatModel.listarContactosPermitidos("usr-chat-admin");
    const ids = res.contactos.map((c) => c.id).sort();
    assert.deepEqual(ids, ["usr-chat-capataz", "usr-chat-dueno", "usr-chat-vet"]);
  });

  it("DUEÑO ve únicamente a VETERINARIO y ADMINISTRADOR de su campo", async () => {
    const res = await ChatModel.listarContactosPermitidos("usr-chat-dueno");
    const ids = res.contactos.map((c) => c.id).sort();
    assert.deepEqual(ids, ["usr-chat-admin", "usr-chat-vet"]);
  });

  it("bloquea con 403 el envío de mensajes entre roles no permitidos (ej. PEÓN -> DUEÑO) o de distinto campo", async () => {
    const reqProhibidoRol = {
      usuario: { id: "usr-chat-peon" },
      body: { destinatarioId: "usr-chat-dueno", contenido: "Hola patrón" },
    };
    const resRol = crearMockRes();
    await ChatController.enviarMensaje(reqProhibidoRol, resRol);
    assert.equal(resRol.statusCode, 403);
    assert.equal(resRol.body.ok, false);

    const reqOtroCampo = {
      usuario: { id: "usr-chat-peon" },
      body: { destinatarioId: "usr-chat-otro-campo", contenido: "Hola otro campo" },
    };
    const resCampo = crearMockRes();
    await ChatController.enviarMensaje(reqOtroCampo, resCampo);
    assert.equal(resCampo.statusCode, 403);
    assert.equal(resCampo.body.ok, false);
  });

  it("permite enviar mensajes entre roles autorizados y ocultar/borrar contacto de la vista activa", async () => {
    const reqEnvio = {
      usuario: { id: "usr-chat-peon" },
      body: { destinatarioId: "usr-chat-capataz", contenido: "Potrero 3 revisado sin novedades." },
    };
    const resEnvio = crearMockRes();
    await ChatController.enviarMensaje(reqEnvio, resEnvio);
    assert.equal(resEnvio.statusCode, 201);
    assert.equal(resEnvio.body.ok, true);
    assert.equal(resEnvio.body.data.contenido, "Potrero 3 revisado sin novedades.");

    // Ocultar / borrar el contacto de la lista activa del peón
    const reqOcultar = {
      usuario: { id: "usr-chat-peon" },
      params: { contactoId: "usr-chat-capataz" },
    };
    const resOcultar = crearMockRes();
    await ChatController.ocultarContacto(reqOcultar, resOcultar);
    assert.equal(resOcultar.statusCode, 200);
    assert.equal(resOcultar.body.data.oculto, true);

    // Verificar que ya no aparece en la vista activa de contactos del peón
    const listaDespues = await ChatModel.listarContactosPermitidos("usr-chat-peon");
    assert.equal(listaDespues.contactos.length, 0);
    assert.equal(listaDespues.ocultosCount, 1);
  });
});


