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
const SanidadModel = require("../src/models/sanidad.model");
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
    db.solicitudesChat = [];
    prisma.usuario.findUnique = origFindUnique;
    prisma.usuario.findMany = origFindMany;
  });

  it("verifica la matriz exacta de permisos para PEÓN, CAPATAZ, VETERINARIO, ADMINISTRADOR y DUEÑO", () => {
    assert.deepEqual(MATRIZ_CHAT_ROLES.peon, ["capataz"]);
    assert.deepEqual(MATRIZ_CHAT_ROLES.capataz.slice().sort(), ["oficina", "peon", "veterinario"]);
    assert.deepEqual(MATRIZ_CHAT_ROLES.veterinario.slice().sort(), ["capataz", "dueno", "oficina"]);
    assert.deepEqual(MATRIZ_CHAT_ROLES.oficina.slice().sort(), ["capataz", "dueno", "peon", "veterinario"]);
    assert.deepEqual(MATRIZ_CHAT_ROLES.dueno.slice().sort(), ["oficina", "peon", "veterinario"]);
  });

  it("PEÓN ve a CAPATAZ habilitado y a ADMINISTRADOR y DUEÑO de su campo requiriendo solicitud", async () => {
    const res = await ChatModel.listarContactosPermitidos("usr-chat-peon");
    const ids = res.contactos.map((c) => c.id).sort();
    assert.deepEqual(ids, ["usr-chat-admin", "usr-chat-capataz", "usr-chat-dueno"]);
    const capataz = res.contactos.find((c) => c.id === "usr-chat-capataz");
    const admin = res.contactos.find((c) => c.id === "usr-chat-admin");
    const dueno = res.contactos.find((c) => c.id === "usr-chat-dueno");
    assert.equal(capataz.requiereSolicitud, false);
    assert.equal(capataz.chatHabilitado, true);
    assert.equal(admin.requiereSolicitud, true);
    assert.equal(admin.chatHabilitado, false);
    assert.equal(dueno.requiereSolicitud, true);
    assert.equal(dueno.chatHabilitado, false);
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

  it("ADMINISTRADOR (oficina) ve a CAPATAZ, VETERINARIO, DUEÑO y PEÓN de su campo", async () => {
    const res = await ChatModel.listarContactosPermitidos("usr-chat-admin");
    const ids = res.contactos.map((c) => c.id).sort();
    assert.deepEqual(ids, ["usr-chat-capataz", "usr-chat-dueno", "usr-chat-peon", "usr-chat-vet"]);
  });

  it("DUEÑO ve a VETERINARIO, ADMINISTRADOR y PEÓN de su campo", async () => {
    const res = await ChatModel.listarContactosPermitidos("usr-chat-dueno");
    const ids = res.contactos.map((c) => c.id).sort();
    assert.deepEqual(ids, ["usr-chat-admin", "usr-chat-peon", "usr-chat-vet"]);
  });

  it("DUEÑO y ADMINISTRACIÓN pueden escribir directamente al PEÓN sin solicitud previa", async () => {
    const reqDueno = {
      usuario: { id: "usr-chat-dueno" },
      body: { destinatarioId: "usr-chat-peon", contenido: "Buen día, revisar potrero 3" },
    };
    const resDueno = crearMockRes();
    await ChatController.enviarMensaje(reqDueno, resDueno);
    assert.equal(resDueno.statusCode, 201);
    assert.equal(resDueno.body.ok, true);

    const reqAdmin = {
      usuario: { id: "usr-chat-admin" },
      body: { destinatarioId: "usr-chat-peon", contenido: "Pasar planilla de insumos" },
    };
    const resAdmin = crearMockRes();
    await ChatController.enviarMensaje(reqAdmin, resAdmin);
    assert.equal(resAdmin.statusCode, 201);
    assert.equal(resAdmin.body.ok, true);
  });

  it("PEÓN debe solicitar permiso a DUEÑO o ADMINISTRACIÓN para chatear: bloquea con 403 hasta aprobación y habilita al aprobar", async () => {
    db.mensajesChat = [];
    db.solicitudesChat = [];

    // 1. Antes de solicitar, PEÓN -> DUEÑO falla con 403
    const reqSinSol = {
      usuario: { id: "usr-chat-peon" },
      body: { destinatarioId: "usr-chat-dueno", contenido: "Hola patrón" },
    };
    const resSinSol = crearMockRes();
    await ChatController.enviarMensaje(reqSinSol, resSinSol);
    assert.equal(resSinSol.statusCode, 403);
    assert.equal(resSinSol.body.ok, false);

    // 2. PEÓN envía solicitud al DUEÑO -> 201 PENDIENTE
    const reqSolicitar = {
      usuario: { id: "usr-chat-peon" },
      body: { destinatarioId: "usr-chat-dueno", motivo: "Necesito informar sobre aguada norte" },
    };
    const resSolicitar = crearMockRes();
    await ChatController.solicitarChat(reqSolicitar, resSolicitar);
    assert.equal(resSolicitar.statusCode, 201);
    assert.equal(resSolicitar.body.ok, true);
    assert.equal(resSolicitar.body.data.estado, "PENDIENTE");
    const solicitudId = resSolicitar.body.data.id;

    // 3. Mientras esté PENDIENTE, PEÓN -> DUEÑO sigue bloqueado (403)
    const resPend = crearMockRes();
    await ChatController.enviarMensaje(reqSinSol, resPend);
    assert.equal(resPend.statusCode, 403);

    // 4. DUEÑO rechaza primero -> sigue bloqueado (403)
    const resRechazo = crearMockRes();
    await ChatController.responderSolicitud(
      { usuario: { id: "usr-chat-dueno" }, params: { solicitudId }, body: { estado: "RECHAZADA" } },
      resRechazo
    );
    assert.equal(resRechazo.statusCode, 200);
    assert.equal(resRechazo.body.data.estado, "RECHAZADA");

    const resPostRechazo = crearMockRes();
    await ChatController.enviarMensaje(reqSinSol, resPostRechazo);
    assert.equal(resPostRechazo.statusCode, 403);

    // 5. DUEÑO aprueba -> ahora PEÓN puede enviar mensaje al DUEÑO (201)
    const resAprobado = crearMockRes();
    await ChatController.responderSolicitud(
      { usuario: { id: "usr-chat-dueno" }, params: { solicitudId }, body: { estado: "APROBADA" } },
      resAprobado
    );
    assert.equal(resAprobado.statusCode, 200);
    assert.equal(resAprobado.body.data.estado, "APROBADA");

    const resPermitido = crearMockRes();
    await ChatController.enviarMensaje(reqSinSol, resPermitido);
    assert.equal(resPermitido.statusCode, 201);
    assert.equal(resPermitido.body.ok, true);

    // 6. Envío y solicitud a contacto de otro establecimiento se bloquean con 403
    const resOtroCampoSol = crearMockRes();
    await ChatController.solicitarChat(
      { usuario: { id: "usr-chat-peon" }, body: { destinatarioId: "usr-chat-otro-campo", motivo: "Hola" } },
      resOtroCampoSol
    );
    assert.equal(resOtroCampoSol.statusCode, 403);

    const reqOtroCampo = {
      usuario: { id: "usr-chat-peon" },
      body: { destinatarioId: "usr-chat-otro-campo", contenido: "Hola otro campo" },
    };
    const resCampo = crearMockRes();
    await ChatController.enviarMensaje(reqOtroCampo, resCampo);
    assert.equal(resCampo.statusCode, 403);
    assert.equal(resCampo.body.ok, false);
  });

  it("cuando un superior (DUEÑO o ADMINISTRACIÓN) envía un mensaje al PEÓN, el PEÓN puede responder aunque su solicitud haya sido RECHAZADA o esté PENDIENTE", async () => {
    db.mensajesChat = [];
    db.solicitudesChat = [];

    // 1. PEÓN solicita a ADMINISTRACIÓN y luego ADMINISTRACIÓN rechaza
    const resSol = crearMockRes();
    await ChatController.solicitarChat(
      { usuario: { id: "usr-chat-peon" }, body: { destinatarioId: "usr-chat-admin", motivo: "Consulta" } },
      resSol
    );
    assert.equal(resSol.statusCode, 201);

    const resRechazo = crearMockRes();
    await ChatController.responderSolicitud(
      {
        usuario: { id: "usr-chat-admin" },
        params: { solicitudId: resSol.body.data.id },
        body: { estado: "RECHAZADA" },
      },
      resRechazo
    );
    assert.equal(resRechazo.statusCode, 200);
    assert.equal(resRechazo.body.data.estado, "RECHAZADA");

    // 2. ADMINISTRACIÓN (superior) decide escribirle un mensaje al PEÓN
    const resMsgAdmin = crearMockRes();
    await ChatController.enviarMensaje(
      {
        usuario: { id: "usr-chat-admin" },
        body: { destinatarioId: "usr-chat-peon", contenido: "Confirmame si recibiste el alambre" },
      },
      resMsgAdmin
    );
    assert.equal(resMsgAdmin.statusCode, 201);

    // 3. Tanto listarContactosPermitidos como obtenerMensajesConversacion marcan chatHabilitado = true para el PEÓN
    const contactosPeon = await ChatModel.listarContactosPermitidos("usr-chat-peon");
    const adminContacto = contactosPeon.contactos.find((c) => c.id === "usr-chat-admin");
    assert.equal(adminContacto.estadoSolicitud, "RECHAZADA");
    assert.equal(adminContacto.chatHabilitado, true);

    const convPeon = await ChatModel.obtenerMensajesConversacion("usr-chat-peon", "usr-chat-admin");
    assert.equal(convPeon.contacto.chatHabilitado, true);

    // 4. El PEÓN ahora puede responder directamente sin tener que volver a solicitar (201)
    const resRespuestaPeon = crearMockRes();
    await ChatController.enviarMensaje(
      {
        usuario: { id: "usr-chat-peon" },
        body: { destinatarioId: "usr-chat-admin", contenido: "Sí, ya llegó el rollo al galpón" },
      },
      resRespuestaPeon
    );
    assert.equal(resRespuestaPeon.statusCode, 201);
    assert.equal(resRespuestaPeon.body.ok, true);
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

    // Verificar que capataz ya no aparece en la vista activa de contactos del peón
    const listaDespues = await ChatModel.listarContactosPermitidos("usr-chat-peon");
    assert.equal(
      listaDespues.contactos.some((c) => c.id === "usr-chat-capataz"),
      false
    );
    assert.equal(listaDespues.ocultosCount, 1);
  });
});

describe("7. Eliminación de Actos Sanitarios y Partes Diarios de Campo", () => {
  it("SanidadModel.eliminarEvento elimina evento en fallback en memoria y bloquea otro establecimiento", async () => {
    const origFindUnique = prisma.sanidadEvento.findUnique;
    prisma.sanidadEvento.findUnique = async () => {
      throw new Error("Usar fallback en memoria en test unitario");
    };

    db.sanidad.push(
      {
        id: "san-unit-del-1",
        evento: "Vacuna Test",
        tipo: "Vacunación",
        lote: "Rodeo Test",
        fechaProgramada: "2026-11-16",
        estado: "Pendiente",
        establecimientoId: "est-unit-a",
      },
      {
        id: "san-unit-del-2",
        evento: "Vacuna Otro Campo",
        tipo: "Vacunación",
        lote: "Lote B",
        fechaProgramada: "2026-11-16",
        estado: "Pendiente",
        establecimientoId: "est-unit-b",
      }
    );

    try {
      await assert.rejects(
        async () => {
          await SanidadModel.eliminarEvento("san-unit-del-2", "est-unit-a");
        },
        /No tenés permisos/
      );

      const reqDel = {
        params: { id: "san-unit-del-1" },
        usuario: { id: "usr-1", establecimientoId: "est-unit-a", email: "test@unit.com" },
      };
      const resDel = crearMockRes();
      await DashboardController.eliminarEventoSanitario(reqDel, resDel);

      assert.equal(resDel.statusCode, 200);
      assert.equal(resDel.body.ok, true);
      assert.equal(db.sanidad.some((s) => s.id === "san-unit-del-1"), false);
    } finally {
      prisma.sanidadEvento.findUnique = origFindUnique;
      db.sanidad = db.sanidad.filter((s) => s.id !== "san-unit-del-1" && s.id !== "san-unit-del-2");
    }
  });

  it("ParteDiarioModel.eliminar elimina parte diario en fallback en memoria y bloquea otro establecimiento", async () => {
    const origFindUnique = prisma.parteDiario.findUnique;
    prisma.parteDiario.findUnique = async () => {
      throw new Error("Usar fallback en memoria en test unitario");
    };

    db.partesDiarios.push(
      {
        id: "pd-unit-del-1",
        fecha: "2026-11-16",
        peonNombre: "Lucas Giménez",
        potrero: "Potrero Test",
        novedades: "Sin novedades",
        animalesRevisados: 10,
        estado: "APROBADO",
        establecimientoId: "est-unit-a",
      },
      {
        id: "pd-unit-del-2",
        fecha: "2026-11-16",
        peonNombre: "Otro Peón",
        potrero: "Otro Potrero",
        novedades: "Otro campo",
        animalesRevisados: 5,
        estado: "PENDIENTE",
        establecimientoId: "est-unit-b",
      }
    );

    try {
      await assert.rejects(
        async () => {
          await ParteDiarioModel.eliminar("pd-unit-del-2", "est-unit-a");
        },
        /No tenés permisos/
      );

      const reqDel = {
        params: { id: "pd-unit-del-1" },
        usuario: { id: "usr-1", establecimientoId: "est-unit-a", email: "test@unit.com" },
      };
      const resDel = crearMockRes();
      await DashboardController.eliminarParteDiario(reqDel, resDel);

      assert.equal(resDel.statusCode, 200);
      assert.equal(resDel.body.ok, true);
      assert.equal(db.partesDiarios.some((p) => p.id === "pd-unit-del-1"), false);
    } finally {
      prisma.parteDiario.findUnique = origFindUnique;
      db.partesDiarios = db.partesDiarios.filter(
        (p) => p.id !== "pd-unit-del-1" && p.id !== "pd-unit-del-2"
      );
    }
  });

  it("SanidadModel.eliminarMasivo y ParteDiarioModel.eliminarMasivo eliminan los IDs marcados del establecimiento", async () => {
    const origSanDelMany = prisma.sanidadEvento.deleteMany;
    const origPdDelMany = prisma.parteDiario.deleteMany;
    prisma.sanidadEvento.deleteMany = async () => {
      throw new Error("Usar memoria");
    };
    prisma.parteDiario.deleteMany = async () => {
      throw new Error("Usar memoria");
    };

    db.sanidad.push(
      { id: "san-mas-1", evento: "E1", establecimientoId: "est-mas" },
      { id: "san-mas-2", evento: "E2", establecimientoId: "est-mas" }
    );
    db.partesDiarios.push(
      { id: "pd-mas-1", novedades: "N1", establecimientoId: "est-mas" },
      { id: "pd-mas-2", novedades: "N2", establecimientoId: "est-mas" }
    );

    try {
      const resSan = await SanidadModel.eliminarMasivo(["san-mas-1", "san-mas-2"], "est-mas");
      const resPd = await ParteDiarioModel.eliminarMasivo(["pd-mas-1", "pd-mas-2"], "est-mas");
      assert.equal(resSan.count, 2);
      assert.equal(resPd.count, 2);
      assert.equal(db.sanidad.some((s) => s.id === "san-mas-1" || s.id === "san-mas-2"), false);
      assert.equal(db.partesDiarios.some((p) => p.id === "pd-mas-1" || p.id === "pd-mas-2"), false);
    } finally {
      prisma.sanidadEvento.deleteMany = origSanDelMany;
      prisma.parteDiario.deleteMany = origPdDelMany;
      db.sanidad = db.sanidad.filter((s) => s.id !== "san-mas-1" && s.id !== "san-mas-2");
      db.partesDiarios = db.partesDiarios.filter((p) => p.id !== "pd-mas-1" && p.id !== "pd-mas-2");
    }
  });

  it("InsumoModel permite denegar, eliminar individualmente y eliminar masivamente solicitudes de reposición", async () => {
    const s1 = InsumoModel.registrarSolicitud({
      insumoNombre: "Alambre Test 1",
      cantidad: 2,
      unidad: "Rollos",
      establecimientoId: "est-sol-test",
    });
    const s2 = InsumoModel.registrarSolicitud({
      insumoNombre: "Vacuna Test 2",
      cantidad: 10,
      unidad: "Dosis",
      establecimientoId: "est-sol-test",
    });
    const s3 = InsumoModel.registrarSolicitud({
      insumoNombre: "Boyero Test 3",
      cantidad: 1,
      unidad: "Unidades",
      establecimientoId: "est-sol-test",
    });

    const denegada = await InsumoModel.actualizarEstadoSolicitud(s1.id, "Denegado", "Dueño");
    assert.equal(denegada.estado, "Denegado");

    const eliminada = InsumoModel.eliminarSolicitud(s1.id, "est-sol-test");
    assert.equal(eliminada.id, s1.id);

    const resMasivo = InsumoModel.eliminarSolicitudesMasivo([s2.id, s3.id], "est-sol-test");
    assert.equal(resMasivo.count, 2);
    const restantes = InsumoModel.listarSolicitudes("est-sol-test");
    assert.equal(restantes.some((s) => s.id === s1.id || s.id === s2.id || s.id === s3.id), false);
  });

  it("GanadoModel.actualizarPotrero actualiza datos de parcela en memoria y sincroniza nombre", async () => {
    const origFindUnique = prisma.potrero.findUnique;
    prisma.potrero.findUnique = async () => {
      throw new Error("Usar memoria en test unitario");
    };

    db.potreros.push(
      {
        id: "pot-edit-1",
        nombre: "Parcela Original",
        superficieHas: 5.7,
        capacidad: 10,
        pastura: "Campo Natural",
        aguada: "Bebedero",
        estadoPastura: "Óptimo",
        color: "#ea580c",
        coordinates: [[-59.25, -29.14], [-59.24, -29.14], [-59.24, -29.15]],
        establecimientoId: "est-pot-edit",
      },
      {
        id: "pot-edit-2",
        nombre: "Parcela Ajena",
        superficieHas: 3,
        establecimientoId: "est-otro-pot",
      }
    );

    try {
      await assert.rejects(
        async () => {
          await GanadoModel.actualizarPotrero("pot-edit-2", { nombre: "Intruso" }, "est-pot-edit");
        },
        /No tenés permisos/
      );

      const reqEdit = {
        params: { id: "pot-edit-1" },
        body: {
          nombre: "Potrero Norte Renovado",
          superficieHas: 8.2,
          pastura: "Gatton Panic",
          aguada: "Molino Solar",
          color: "#0284c7",
        },
        usuario: { id: "usr-1", establecimientoId: "est-pot-edit", email: "test@unit.com" },
      };
      const resEdit = crearMockRes();
      await DashboardController.actualizarPotrero(reqEdit, resEdit);

      assert.equal(resEdit.statusCode, 200);
      assert.equal(resEdit.body.ok, true);
      assert.equal(resEdit.body.data.nombre, "Potrero Norte Renovado");
      assert.equal(resEdit.body.data.superficieHas, 8.2);
      assert.equal(resEdit.body.data.pastura, "Gatton Panic");
    } finally {
      prisma.potrero.findUnique = origFindUnique;
      db.potreros = db.potreros.filter((p) => p.id !== "pot-edit-1" && p.id !== "pot-edit-2");
    }
  });
});

describe("8. Permisos de Modificación de Parcelas (Administrador -> Dueño) y Notificaciones", () => {
  it("Administrador (oficina) requiere solicitud aprobada por el Dueño para agregar o editar parcelas y genera notificación al Dueño", async () => {
    db.solicitudesParcelas = [];
    const origFindUnique = prisma.potrero.findUnique;
    prisma.potrero.findUnique = async () => {
      throw new Error("Usar memoria");
    };

    db.potreros.push({
      id: "pot-perm-1",
      nombre: "Potrero Permiso",
      superficieHas: 4,
      capacidad: 10,
      establecimientoId: "est-perm-parcela",
    });

    const usrAdmin = {
      id: "usr-oficina-perm",
      rol: "oficina",
      establecimientoId: "est-perm-parcela",
      nombre: "Valeria Admin",
    };
    const usrDueno = {
      id: "usr-dueno-perm",
      rol: "dueno",
      establecimientoId: "est-perm-parcela",
      nombre: "Esteban Dueño",
    };

    try {
      // 1. Sin permiso aprobado, oficina recibe 403 al intentar agregar o editar
      const resCrearSin = crearMockRes();
      await DashboardController.registrarPotrero(
        { usuario: usrAdmin, body: { nombre: "Potrero Nuevo", superficieHas: 2 } },
        resCrearSin
      );
      assert.equal(resCrearSin.statusCode, 403);

      const resEditSin = crearMockRes();
      await DashboardController.actualizarPotrero(
        { usuario: usrAdmin, params: { id: "pot-perm-1" }, body: { nombre: "Editado" } },
        resEditSin
      );
      assert.equal(resEditSin.statusCode, 403);

      // 2. Oficina solicita permiso al Dueño -> 201 PENDIENTE
      const resSol = crearMockRes();
      await DashboardController.solicitarPermisoParcelas(
        {
          usuario: usrAdmin,
          body: { accion: "GESTIONAR", motivo: "Necesito delimitar potrero nuevo" },
        },
        resSol
      );
      assert.equal(resSol.statusCode, 201);
      assert.equal(resSol.body.data.estado, "PENDIENTE");
      const solicitudId = resSol.body.data.id;

      // 3. El Dueño recibe la notificación pendiente en /api/dashboard/notificaciones
      const resNotif = crearMockRes();
      await DashboardController.obtenerNotificaciones({ usuario: usrDueno }, resNotif);
      assert.equal(resNotif.statusCode, 200);
      assert.equal(
        resNotif.body.data.notificaciones.some(
          (n) => n.tipo === "permiso_parcela" && n.solicitudId === solicitudId
        ),
        true
      );

      // 4. Si el Dueño rechaza, oficina sigue bloqueada con 403
      const resRech = crearMockRes();
      await DashboardController.responderPermisoParcelas(
        { usuario: usrDueno, params: { solicitudId }, body: { estado: "RECHAZADA" } },
        resRech
      );
      assert.equal(resRech.statusCode, 200);
      assert.equal(resRech.body.data.estado, "RECHAZADA");

      const resPostRech = crearMockRes();
      await DashboardController.actualizarPotrero(
        { usuario: usrAdmin, params: { id: "pot-perm-1" }, body: { nombre: "Editado" } },
        resPostRech
      );
      assert.equal(resPostRech.statusCode, 403);

      // 5. Oficina solicita permiso puntual para editar pot-perm-1 y Dueño aprueba -> 1 edición permitida (200), luego se consume y vuelve a exigir solicitud (403)
      const resReSol = crearMockRes();
      await DashboardController.solicitarPermisoParcelas(
        {
          usuario: usrAdmin,
          body: { accion: "EDITAR", parcelaId: "pot-perm-1", parcelaNombre: "Potrero Permiso", motivo: "Reenvío" },
        },
        resReSol
      );
      assert.equal(resReSol.statusCode, 201);
      const solEditId = resReSol.body.data.id;

      const resAprob = crearMockRes();
      await DashboardController.responderPermisoParcelas(
        { usuario: usrDueno, params: { solicitudId: solEditId }, body: { estado: "APROBADA" } },
        resAprob
      );
      assert.equal(resAprob.statusCode, 200);
      assert.equal(resAprob.body.data.estado, "APROBADA");

      // No habilita agregar otra parcela ni editar una parcela distinta
      const resAgregarNoAut = crearMockRes();
      await DashboardController.registrarPotrero(
        { usuario: usrAdmin, body: { nombre: "Potrero Extra", superficieHas: 2 } },
        resAgregarNoAut
      );
      assert.equal(resAgregarNoAut.statusCode, 403);

      // Primera edición de pot-perm-1 permitida (200) y consume el permiso
      const resEditOk = crearMockRes();
      await DashboardController.actualizarPotrero(
        {
          usuario: usrAdmin,
          params: { id: "pot-perm-1" },
          body: { nombre: "Potrero Permiso Editado" },
        },
        resEditOk
      );
      assert.equal(resEditOk.statusCode, 200);
      assert.equal(resEditOk.body.data.nombre, "Potrero Permiso Editado");

      // Segunda edición inmediata sobre pot-perm-1 exige nueva solicitud (403)
      const resSegundaEdit = crearMockRes();
      await DashboardController.actualizarPotrero(
        {
          usuario: usrAdmin,
          params: { id: "pot-perm-1" },
          body: { nombre: "Segundo Cambio Sin Permiso" },
        },
        resSegundaEdit
      );
      assert.equal(resSegundaEdit.statusCode, 403);
    } finally {
      prisma.potrero.findUnique = origFindUnique;
      db.potreros = db.potreros.filter((p) => p.id !== "pot-perm-1");
      db.solicitudesParcelas = [];
    }
  });
});

describe("9. Login y Registro con Google (OAuth 2.0 / OpenID Connect)", () => {
  it("estadoGoogle informa configuración, iniciarGoogle valida state y callbackGoogle autentica o registra usuarios nuevos", async () => {
    const AuthController = require("../src/controllers/auth.controller");
    const origClientId = process.env.GOOGLE_CLIENT_ID;
    const origClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const origFetch = global.fetch;
    const emailNuevoGoogle = `google.nuevo.${Date.now()}@gmail.com`;

    try {
      // 1. Sin credenciales, estadoGoogle devuelve configurado: false
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      const resSinConf = crearMockRes();
      AuthController.estadoGoogle({ get: () => "localhost:4000", protocol: "http" }, resSinConf);
      assert.equal(resSinConf.statusCode, 200);
      assert.equal(resSinConf.body.data.configurado, false);

      // 2. Con credenciales, iniciarGoogle redirige a Google con state CSRF válido (modo registro)
      process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
      let redirectedUrl = "";
      AuthController.iniciarGoogle(
        {
          query: { modo: "registro", rol: "capataz", establecimiento: "Estancia El Sol" },
          headers: { origin: "http://localhost:5173" },
          get: () => "localhost:4000",
          protocol: "http",
        },
        {
          redirect(url) {
            redirectedUrl = url;
            return this;
          },
        }
      );
      assert.equal(redirectedUrl.startsWith("https://accounts.google.com/o/oauth2/v2/auth?"), true);
      const stateGenerado = new URL(redirectedUrl).searchParams.get("state");
      assert.ok(stateGenerado && stateGenerado.length >= 32);

      // 3. callbackGoogle con state inválido rechaza redirigiendo con googleError
      let urlErrorState = "";
      await AuthController.callbackGoogle(
        { query: { code: "abc", state: "state-invalido" }, headers: {} },
        {
          redirect(url) {
            urlErrorState = url;
            return this;
          },
        }
      );
      assert.equal(urlErrorState.includes("googleError="), true);

      // 4. callbackGoogle válido registra usuario nuevo en fallback en memoria y emite JWT
      global.fetch = async (url) => {
        if (String(url).includes("oauth2.googleapis.com/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "mock-google-access-token" }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            email: emailNuevoGoogle,
            email_verified: true,
            name: "Lucía Google",
          }),
        };
      };

      let urlExito = "";
      await AuthController.callbackGoogle(
        { query: { code: "valid-code-123", state: stateGenerado }, headers: {} },
        {
          redirect(url) {
            urlExito = url;
            return this;
          },
        }
      );

      const parsedExito = new URL(urlExito);
      assert.equal(parsedExito.searchParams.get("ruta"), "google-completar");
      const setupToken = parsedExito.searchParams.get("setupToken");
      assert.ok(setupToken && setupToken.split(".").length === 3);

      // 5. Completar registro con establecimiento y rol elegidos por el usuario
      const resCompletar = crearMockRes();
      await AuthController.completarRegistroGoogle(
        {
          body: {
            setupToken,
            nombre: "Lucía Google",
            establecimiento: "Estancia El Sol",
            rol: "capataz",
          },
        },
        resCompletar
      );
      assert.equal(resCompletar.statusCode, 201);
      assert.equal(resCompletar.body.ok, true);
      assert.ok(resCompletar.body.data.token);

      const usuarioCreado = db.usuarios.find((u) => u.email === emailNuevoGoogle);
      assert.ok(usuarioCreado);
      assert.equal(usuarioCreado.rol, "capataz");
      assert.equal(usuarioCreado.establecimiento, "Estancia El Sol");
      assert.equal(usuarioCreado.emailVerificado, true);

      // 6. callbackGoogle con modo=login y correo no registrado redirige a ruta=login con googleNoRegistrado=1 y googleError
      let urlIniciarLogin = "";
      await AuthController.iniciarGoogle(
        { query: { modo: "login" }, headers: {} },
        {
          redirect(url) {
            urlIniciarLogin = url;
            return this;
          },
        }
      );
      const stateLogin = new URL(urlIniciarLogin).searchParams.get("state");
      const emailNoRegistrado = `no.registrado.${Date.now()}@gmail.com`;
      global.fetch = async (url) => {
        if (String(url).includes("oauth2.googleapis.com/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "mock-google-access-token-login" }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            email: emailNoRegistrado,
            email_verified: true,
            name: "Usuario Nuevo",
          }),
        };
      };

      let urlLoginNoReg = "";
      await AuthController.callbackGoogle(
        { query: { code: "valid-code-login", state: stateLogin }, headers: {} },
        {
          redirect(url) {
            urlLoginNoReg = url;
            return this;
          },
        }
      );
      const parsedLoginNoReg = new URL(urlLoginNoReg);
      assert.equal(parsedLoginNoReg.searchParams.get("ruta"), "login");
      assert.equal(parsedLoginNoReg.searchParams.get("googleNoRegistrado"), "1");
      assert.equal(parsedLoginNoReg.searchParams.get("googleEmail"), emailNoRegistrado);
      assert.ok(
        (parsedLoginNoReg.searchParams.get("googleError") || "").includes("No se encontró ninguna cuenta")
      );
    } finally {
      global.fetch = origFetch;
      db.usuarios = db.usuarios.filter((u) => u.email !== emailNuevoGoogle);
      if (origClientId !== undefined) process.env.GOOGLE_CLIENT_ID = origClientId;
      else delete process.env.GOOGLE_CLIENT_ID;
      if (origClientSecret !== undefined) process.env.GOOGLE_CLIENT_SECRET = origClientSecret;
      else delete process.env.GOOGLE_CLIENT_SECRET;
      AuthController._estadosOAuthGoogle.clear();
    }
  });
});



