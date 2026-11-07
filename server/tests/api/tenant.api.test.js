/**
 * Tests de API — Aislamiento entre Tenants y Protección contra IDOR (Fase 3B)
 *
 * Evalúa las garantías de aislamiento multi-tenant del sistema:
 * - Aislamiento en lecturas (cada tenant solo visualiza sus propios recursos).
 * - Protección contra IDOR (Insecure Direct Object Reference):
 *   Un usuario autenticado de `est-A` intenta acceder o modificar recursos de `est-B`.
 *   El contrato esperado es 404 Not Found y el recurso de `est-B` no debe alterarse.
 * - Los defectos conocidos donde el backend actual carece de validación de tenantId
 *   se marcan con `{ todo: "R3: ..." }` según lo especificado en el test plan.
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

// Inicializa tokens y entorno seguro de test
require("../helpers/tokens");

const { firmarToken, encabezadoBearer } = require("../helpers/tokens");
const { resetearMemoria } = require("../helpers/memoria");
require("../helpers/rutas"); // Inicializa stubs de Prisma para fallback instantáneo en memoria
const app = require("../../src/index");
const db = require("../../src/config/db");
const { ROLES } = require("../../src/utils/roles.constants");

const TENANT_A = "est-tenant-a";
const TENANT_B = "est-tenant-b";

describe("Fase 3B — Aislamiento Multi-Tenant y Protección IDOR (Contrato API)", () => {
  let tokenDuenoA;
  let tokenCapatazA;
  let tokenDuenoB;

  beforeEach(() => {
    resetearMemoria();

    tokenDuenoA = firmarToken({
      id: "usr-dueno-a",
      rol: ROLES.DUENO,
      establecimientoId: TENANT_A,
      establecimiento: "Establecimiento A",
    });

    tokenCapatazA = firmarToken({
      id: "usr-capataz-a",
      rol: ROLES.CAPATAZ,
      establecimientoId: TENANT_A,
      establecimiento: "Establecimiento A",
    });

    tokenDuenoB = firmarToken({
      id: "usr-dueno-b",
      rol: ROLES.DUENO,
      establecimientoId: TENANT_B,
      establecimiento: "Establecimiento B",
    });

    // Usuarios en memoria para autenticación de authMiddleware
    if (!Array.isArray(db.usuarios)) db.usuarios = [];
    db.usuarios.push(
      {
        id: "usr-dueno-a",
        nombre: "Dueño A",
        email: "duenoA@tenant-a.test",
        rol: ROLES.DUENO,
        emailVerificado: true,
        establecimientoId: TENANT_A,
        establecimiento: "Establecimiento A",
      },
      {
        id: "usr-capataz-a",
        nombre: "Capataz A",
        email: "capatazA@tenant-a.test",
        rol: ROLES.CAPATAZ,
        emailVerificado: true,
        establecimientoId: TENANT_A,
        establecimiento: "Establecimiento A",
      },
      {
        id: "usr-peon-a",
        nombre: "Peón A",
        email: "peonA@tenant-a.test",
        rol: ROLES.PEON,
        emailVerificado: true,
        establecimientoId: TENANT_A,
        establecimiento: "Establecimiento A",
      },
      {
        id: "usr-dueno-b",
        nombre: "Dueño B",
        email: "duenoB@tenant-b.test",
        rol: ROLES.DUENO,
        emailVerificado: true,
        establecimientoId: TENANT_B,
        establecimiento: "Establecimiento B",
      },
      {
        id: "usr-peon-b",
        nombre: "Peón B",
        email: "peonB@tenant-b.test",
        rol: ROLES.PEON,
        emailVerificado: true,
        establecimientoId: TENANT_B,
        establecimiento: "Establecimiento B",
      }
    );

    // Semillas para Tenant A
    if (!Array.isArray(db.ganado)) db.ganado = [];
    db.ganado.push({
      id: "gan-tenant-a",
      caravana: "AR-A-001",
      categoria: "Novillos",
      pesoKg: 420,
      potreroId: "pot-tenant-a",
      potrero: "Potrero A1",
      potreroNombre: "Potrero A1",
      estadoSanitario: "SALUDABLE",
      establecimientoId: TENANT_A,
      establecimiento: "Establecimiento A",
    });

    if (!Array.isArray(db.potreros)) db.potreros = [];
    db.potreros.push({
      id: "pot-tenant-a",
      nombre: "Potrero A1",
      superficieHectareas: 40,
      establecimientoId: TENANT_A,
      establecimiento: "Establecimiento A",
    });

    if (!Array.isArray(db.insumos)) db.insumos = [];
    db.insumos.push({
      id: "ins-tenant-a",
      nombre: "Antiparasitario A",
      stockActual: 80,
      stockMinimo: 15,
      unidad: "Litros",
      campo: "Campo A",
      ubicacion: "Depósito A",
      estado: "OK",
      requiereReposicion: false,
      establecimientoId: TENANT_A,
      establecimiento: "Establecimiento A",
    });

    if (!Array.isArray(db.partesDiarios)) db.partesDiarios = [];
    db.partesDiarios.push({
      id: "part-tenant-a",
      novedades: "Recorrido Potrero A1",
      animalesRevisados: 35,
      estado: "PENDIENTE",
      peonNombre: "Operario A",
      establecimientoId: TENANT_A,
      establecimiento: "Establecimiento A",
    });

    // Semillas para Tenant B (objetivo de intentos IDOR desde Tenant A)
    db.ganado.push({
      id: "gan-tenant-b",
      caravana: "AR-B-999",
      categoria: "Toros",
      pesoKg: 650,
      potreroId: "pot-tenant-b",
      potrero: "Potrero B1",
      potreroNombre: "Potrero B1",
      estadoSanitario: "SALUDABLE",
      establecimientoId: TENANT_B,
      establecimiento: "Establecimiento B",
    });

    db.potreros.push({
      id: "pot-tenant-b",
      nombre: "Potrero B1",
      superficieHectareas: 60,
      establecimientoId: TENANT_B,
      establecimiento: "Establecimiento B",
    });

    db.insumos.push({
      id: "ins-tenant-b",
      nombre: "Vacuna Bivalente B",
      stockActual: 100,
      stockMinimo: 20,
      unidad: "Dosis",
      campo: "Campo B",
      ubicacion: "Depósito B",
      estado: "OK",
      requiereReposicion: false,
      establecimientoId: TENANT_B,
      establecimiento: "Establecimiento B",
    });

    db.partesDiarios.push({
      id: "part-tenant-b",
      novedades: "Ronda Tenant B sin novedades",
      animalesRevisados: 50,
      estado: "PENDIENTE",
      peonNombre: "Operario B",
      establecimientoId: TENANT_B,
      establecimiento: "Establecimiento B",
    });

    if (!Array.isArray(db.sanidad)) db.sanidad = [];
    db.sanidad.push({
      id: "san-tenant-b",
      evento: "Vacunación Aftosa B",
      estado: "Pendiente",
      prioridad: "Alta",
      establecimientoId: TENANT_B,
      establecimiento: "Establecimiento B",
    });
  });

  describe("1. Aislamiento positivo en consultas (Data Filtering)", () => {
    it("GET /api/dashboard/ganado solo retorna animales de su propio establecimiento", async () => {
      const res = await request(app)
        .get("/api/dashboard/ganado")
        .set(encabezadoBearer(tokenDuenoA));

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.ok(Array.isArray(res.body.data));

      const ids = res.body.data.map((g) => g.id);
      assert.ok(ids.includes("gan-tenant-a"), "Debe incluir animales del Tenant A");
      assert.ok(!ids.includes("gan-tenant-b"), "NO debe incluir animales del Tenant B");

      for (const item of res.body.data) {
        assert.equal(item.establecimientoId, TENANT_A);
      }
    });

    it("GET /api/dashboard/insumos solo retorna insumos de su propio establecimiento", async () => {
      const res = await request(app)
        .get("/api/dashboard/insumos")
        .set(encabezadoBearer(tokenDuenoA));

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);

      const ids = res.body.data.map((i) => i.id);
      assert.ok(ids.includes("ins-tenant-a"), "Debe incluir insumos del Tenant A");
      assert.ok(!ids.includes("ins-tenant-b"), "NO debe incluir insumos del Tenant B");
    });

    it("GET /api/dashboard/partes solo retorna partes diarios de su propio establecimiento", async () => {
      const res = await request(app)
        .get("/api/dashboard/partes")
        .set(encabezadoBearer(tokenDuenoA));

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);

      const ids = res.body.data.map((p) => p.id);
      assert.ok(ids.includes("part-tenant-a"), "Debe incluir partes del Tenant A");
      assert.ok(!ids.includes("part-tenant-b"), "NO debe incluir partes del Tenant B");
    });

    it("GET /api/permisos/usuarios solo retorna usuarios de su propio establecimiento", async () => {
      const res = await request(app)
        .get("/api/permisos/usuarios")
        .set(encabezadoBearer(tokenDuenoA));

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);

      const ids = res.body.data.map((u) => u.id);
      assert.ok(ids.includes("usr-peon-a"), "Debe incluir colaboradores del Tenant A");
      assert.ok(!ids.includes("usr-peon-b"), "NO debe incluir colaboradores del Tenant B");
    });
  });

  describe("2. Casos de riesgo IDOR (R3) especificados en el Test Plan", () => {
    it(
      "R3 IDOR: GET /api/dashboard/ganado/:idB de otro tenant debe responder 404",
      { todo: "R3: GanadoModel.buscarPorId no valida establecimientoId y expone ganado de otros tenants" },
      async () => {
        const res = await request(app)
          .get("/api/dashboard/ganado/gan-tenant-b")
          .set(encabezadoBearer(tokenDuenoA));

        assert.equal(res.status, 404, "Debe responder 404 al consultar un recurso ajeno");
        assert.equal(res.body.ok, false);
      }
    );

    it(
      "R3 IDOR: PATCH /api/dashboard/ganado/:idB de otro tenant debe responder 404 y no modificar el recurso",
      { todo: "R3: GanadoModel.actualizar no valida establecimientoId y permite alterar ganado de otro tenant" },
      async () => {
        const res = await request(app)
          .patch("/api/dashboard/ganado/gan-tenant-b")
          .set(encabezadoBearer(tokenCapatazA))
          .send({ pesoKg: 999 });

        assert.equal(res.status, 404, "Debe responder 404");
        assert.equal(res.body.ok, false);

        // El animal de Tenant B no debe haber sido modificado
        const animalB = db.ganado.find((g) => g.id === "gan-tenant-b");
        assert.equal(animalB.pesoKg, 650);
      }
    );

    it(
      "R3 IDOR: DELETE /api/dashboard/ganado/:idB de otro tenant debe responder 404 y no dar de baja",
      { todo: "R3: GanadoModel.darDeBaja no valida establecimientoId y permite dar de baja ganado de otro tenant" },
      async () => {
        const res = await request(app)
          .delete("/api/dashboard/ganado/gan-tenant-b")
          .set(encabezadoBearer(tokenCapatazA));

        assert.equal(res.status, 404, "Debe responder 404");
        assert.equal(res.body.ok, false);

        // El animal de Tenant B debe seguir existiendo intacto
        const existeB = db.ganado.some((g) => g.id === "gan-tenant-b");
        assert.ok(existeB, "El animal de Tenant B no debe ser eliminado ni dado de baja por Tenant A");
      }
    );

    it(
      "R3 IDOR: PATCH /api/dashboard/insumos/:idB/stock de otro tenant debe responder 404 y no alterar stock",
      { todo: "R3: InsumoModel.actualizarStock no valida establecimientoId y altera inventario ajeno" },
      async () => {
        const res = await request(app)
          .patch("/api/dashboard/insumos/ins-tenant-b/stock")
          .set(encabezadoBearer(tokenDuenoA))
          .send({ cantidad: 30, operacion: "restar" });

        assert.equal(res.status, 404, "Debe responder 404");
        assert.equal(res.body.ok, false);

        // El stock de Tenant B no debe alterarse
        const insumoB = db.insumos.find((i) => i.id === "ins-tenant-b");
        assert.equal(insumoB.stockActual, 100);
      }
    );

    it(
      "R3 IDOR: DELETE /api/dashboard/insumos/:idB de otro tenant debe responder 404 y no eliminar",
      { todo: "R3: DashboardController.eliminarInsumo responde 400 en vez de 404 para recursos ajenos" },
      async () => {
        const res = await request(app)
          .delete("/api/dashboard/insumos/ins-tenant-b")
          .set(encabezadoBearer(tokenDuenoA));

        assert.equal(res.status, 404, "Debe responder 404");
        assert.equal(res.body.ok, false);

        // El insumo de Tenant B debe preservarse
        const insumoB = db.insumos.find((i) => i.id === "ins-tenant-b");
        assert.ok(insumoB, "El insumo de Tenant B no debe ser eliminado");
      }
    );

    it(
      "R3 IDOR: PATCH /api/dashboard/partes/:idB/estado de otro tenant debe responder 404 y no alterar el estado",
      { todo: "R3: ParteDiarioModel.cambiarEstado no valida establecimientoId y permite aprobar partes ajenos" },
      async () => {
        const res = await request(app)
          .patch("/api/dashboard/partes/part-tenant-b/estado")
          .set(encabezadoBearer(tokenCapatazA))
          .send({ estado: "APROBADO" });

        assert.equal(res.status, 404, "Debe responder 404");
        assert.equal(res.body.ok, false);

        // El estado en Tenant B debe seguir siendo PENDIENTE
        const parteB = db.partesDiarios.find((p) => p.id === "part-tenant-b");
        assert.equal(parteB.estado, "PENDIENTE");
      }
    );

    it(
      "R3 IDOR: PATCH /api/dashboard/sanidad/:idB/estado de otro tenant debe responder 404 y no alterar evento",
      { todo: "R3: SanidadModel.actualizarEstado no valida establecimientoId y altera eventos de otro tenant" },
      async () => {
        const res = await request(app)
          .patch("/api/dashboard/sanidad/san-tenant-b/estado")
          .set(encabezadoBearer(tokenCapatazA))
          .send({ estado: "Completado" });

        assert.equal(res.status, 404, "Debe responder 404");
        assert.equal(res.body.ok, false);

        // El evento de Tenant B debe seguir en Pendiente
        const eventoB = db.sanidad.find((s) => s.id === "san-tenant-b");
        assert.equal(eventoB.estado, "Pendiente");
      }
    );

    it(
      "R3 IDOR: POST /api/dashboard/ganado/traslado-masivo hacia potrero de otro tenant debe responder 404",
      { todo: "R3: GanadoModel.trasladoMasivo no valida que el potreroDestinoId pertenezca al tenant del solicitante" },
      async () => {
        const res = await request(app)
          .post("/api/dashboard/ganado/traslado-masivo")
          .set(encabezadoBearer(tokenCapatazA))
          .send({
            animalIds: ["gan-tenant-a"],
            potreroDestinoId: "pot-tenant-b",
          });

        assert.equal(res.status, 404, "Debe responder 404 al intentar trasladar a un potrero ajeno");
        assert.equal(res.body.ok, false);

        // El animal de Tenant A no debe quedar asignado al potrero de Tenant B
        const animalA = db.ganado.find((g) => g.id === "gan-tenant-a");
        assert.notEqual(animalA.potreroId, "pot-tenant-b");
      }
    );

    it(
      "R3 IDOR: PATCH /api/permisos/usuarios/:idB/rol de otro tenant debe responder 404 y no alterar el rol",
      { todo: "R3: PermisosController y UsuarioModel.actualizarRol no validan tenantId del usuario a modificar" },
      async () => {
        const res = await request(app)
          .patch("/api/permisos/usuarios/usr-peon-b/rol")
          .set(encabezadoBearer(tokenDuenoA))
          .send({ nuevoRol: ROLES.CAPATAZ });

        assert.equal(res.status, 404, "Debe responder 404");
        assert.equal(res.body.ok, false);

        // El rol del peón de Tenant B no debe haber sido cambiado
        const usuarioB = db.usuarios.find((u) => u.id === "usr-peon-b");
        assert.equal(usuarioB.rol, ROLES.PEON);
      }
    );
  });
});
