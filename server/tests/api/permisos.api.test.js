/**
 * Tests de API — Gestión de Permisos, Usuarios y Roles (RBAC)
 * Evalúa /api/permisos/*: consulta de roles, listado por tenant, modificación de roles (I7),
 * vinculación y desvinculación de colaboradores.
 */
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

// Inicializa variables de test y aísla DATABASE_URL
require("../helpers/tokens");

const { firmarToken, encabezadoBearer } = require("../helpers/tokens");
const { resetearMemoria } = require("../helpers/memoria");
const { assertSinSecretos } = require("../helpers/assertSinSecretos");
const app = require("../../src/index");
const db = require("../../src/config/db");
const { ROLES } = require("../../src/utils/roles.constants");

describe("API — /api/permisos (Gestión de Roles, Asignación y Control de Empleados)", () => {
  beforeEach(() => {
    resetearMemoria();
  });

  describe("GET /api/permisos/roles", () => {
    it("sin token de autenticación responde 401", async () => {
      const res = await request(app).get("/api/permisos/roles");

      assert.equal(res.status, 401);
      assert.equal(res.body.ok, false);
    });

    it("autenticado responde 200 con metadata de roles y matriz de permisos", async () => {
      const token = firmarToken({ id: "usr-1", rol: ROLES.DUENO });

      const res = await request(app)
        .get("/api/permisos/roles")
        .set(encabezadoBearer(token));

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.ok(res.body.data.roles);
      assert.ok(res.body.data.matrizPermisos);
      assert.equal(res.headers["cache-control"], "public, max-age=3600, stale-while-revalidate=600");

      // Validar presencia de los 5 roles en la matriz
      const rolesMatriz = Object.keys(res.body.data.matrizPermisos);
      assert.deepEqual(rolesMatriz.sort(), ["capataz", "dueno", "oficina", "peon", "veterinario"]);
    });
  });

  describe("GET /api/permisos/usuarios (Listado y Matriz RBAC)", () => {
    it("sin token responde 401", async () => {
      const res = await request(app).get("/api/permisos/usuarios");

      assert.equal(res.status, 401);
      assert.equal(res.body.ok, false);
    });

    it("rol dueno responde 200 y retorna usuarios pertenecientes a su establecimiento", async () => {
      const token = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .get("/api/permisos/usuarios")
        .set(encabezadoBearer(token));

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.ok(Array.isArray(res.body.data));
      // Todos los usuarios devueltos deben ser del establecimiento
      for (const u of res.body.data) {
        assert.equal(u.establecimientoId, "est-el-rancho");
        assert.equal(u.password, undefined);
      }
    });

    it("rol capataz está autorizado por RBAC y responde 200", async () => {
      const token = firmarToken({
        id: "usr-2",
        rol: ROLES.CAPATAZ,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .get("/api/permisos/usuarios")
        .set(encabezadoBearer(token));

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
    });

    it("rol oficina está autorizado por RBAC y responde 200", async () => {
      const token = firmarToken({
        id: "usr-4",
        rol: ROLES.OFICINA,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .get("/api/permisos/usuarios")
        .set(encabezadoBearer(token));

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
    });

    it("rol peon no tiene acceso y responde 403", async () => {
      const token = firmarToken({
        id: "usr-3",
        rol: ROLES.PEON,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .get("/api/permisos/usuarios")
        .set(encabezadoBearer(token));

      assert.equal(res.status, 403);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Acceso denegado/i);
    });

    it("rol veterinario no tiene acceso y responde 403", async () => {
      const token = firmarToken({
        id: "usr-5",
        rol: ROLES.VETERINARIO,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .get("/api/permisos/usuarios")
        .set(encabezadoBearer(token));

      assert.equal(res.status, 403);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Acceso denegado/i);
    });

    it("los usuarios listados no exponen secretos ni tokens sensibles (R6)", { todo: "R6: permisos/usuarios expone tokenVerificacion y tokenRecuperacion" }, async () => {
      const token = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .get("/api/permisos/usuarios")
        .set(encabezadoBearer(token));

      assert.equal(res.status, 200);
      assertSinSecretos(res.body);
    });
  });

  describe("PATCH /api/permisos/usuarios/:id/rol (Modificación y Protección I7)", () => {
    it("dueño cambia el rol de un colaborador a un rol permitido y responde 200", async () => {
      const tokenDueno = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .patch("/api/permisos/usuarios/usr-3/rol")
        .set(encabezadoBearer(tokenDueno))
        .send({ nuevoRol: ROLES.CAPATAZ });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.data.rol, "capataz");

      // Comprobar que en memoria el rol cambió
      const enMemoria = db.usuarios.find((u) => u.id === "usr-3");
      assert.equal(enMemoria.rol, "capataz");
    });

    it("I7: no permite modificar ni degradar el rol del dueño del establecimiento", async () => {
      const tokenDueno = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .patch("/api/permisos/usuarios/usr-1/rol")
        .set(encabezadoBearer(tokenDueno))
        .send({ nuevoRol: ROLES.PEON });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /No es posible modificar el rol del propietario/i);
    });

    it("rechaza asignación con un rol no válido", async () => {
      const tokenDueno = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .patch("/api/permisos/usuarios/usr-3/rol")
        .set(encabezadoBearer(tokenDueno))
        .send({ nuevoRol: "superadmin_invalido" });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Rol inválido/i);
    });

    it("rechaza petición sin nuevoRol en el body", async () => {
      const tokenDueno = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
      });

      const res = await request(app)
        .patch("/api/permisos/usuarios/usr-3/rol")
        .set(encabezadoBearer(tokenDueno))
        .send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Debe especificar el nuevo rol/i);
    });

    it("capataz intenta cambiar rol y es bloqueado con 403", async () => {
      const tokenCapataz = firmarToken({
        id: "usr-2",
        rol: ROLES.CAPATAZ,
      });

      const res = await request(app)
        .patch("/api/permisos/usuarios/usr-3/rol")
        .set(encabezadoBearer(tokenCapataz))
        .send({ nuevoRol: ROLES.OFICINA });

      assert.equal(res.status, 403);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Acceso denegado/i);
    });

    it("intento de modificar rol de un usuario inexistente responde 400", async () => {
      const tokenDueno = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
      });

      const res = await request(app)
        .patch("/api/permisos/usuarios/usr-no-existe-999/rol")
        .set(encabezadoBearer(tokenDueno))
        .send({ nuevoRol: ROLES.PEON });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Usuario no encontrado/i);
    });

    it("R3 IDOR: dueño de establecimiento A no puede modificar el rol de un usuario del establecimiento B", { todo: "R3: falta aislamiento de tenant al modificar rol de usuario ajeno" }, async () => {
      // Crear usuario de otro establecimiento B
      const usuarioB = {
        id: "usr-tenant-b",
        nombre: "Peon B",
        email: "peonB@example.test",
        password: "hash",
        rol: ROLES.PEON,
        establecimientoId: "est-tenant-b",
      };
      db.usuarios.push(usuarioB);

      // Dueño del establecimiento A
      const tokenDuenoA = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .patch("/api/permisos/usuarios/usr-tenant-b/rol")
        .set(encabezadoBearer(tokenDuenoA))
        .send({ nuevoRol: ROLES.CAPATAZ });

      // Esperado: 404 (o 403) y el recurso de B no cambia
      assert.equal(res.status, 404);
      assert.equal(usuarioB.rol, ROLES.PEON);
    });
  });

  describe("POST /api/permisos/solicitar-empleado", () => {
    it("dueño vincula a un colaborador existente y responde 201", async () => {
      // Crear colaborador registrado sin establecimiento
      db.usuarios.push({
        id: "usr-candidato",
        nombre: "Candidato",
        email: "candidato@example.test",
        password: "hash",
        rol: ROLES.PEON,
        establecimientoId: null,
        establecimiento: null,
      });

      const tokenDueno = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
        establecimientoId: "est-el-rancho",
        establecimiento: "El Rancho, Goya, Corrientes",
      });

      const res = await request(app)
        .post("/api/permisos/solicitar-empleado")
        .set(encabezadoBearer(tokenDueno))
        .send({
          email: "candidato@example.test",
          rol: ROLES.VETERINARIO,
          cargo: "Médico Veterinario",
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.data.establecimientoId, "est-el-rancho");
      assert.equal(res.body.data.rol, "veterinario");
      assert.equal(res.body.data.password, undefined);
    });

    it("la respuesta de vinculación no expone secretos (R6)", { todo: "R6: solicitar-empleado expone tokens de verificación/recuperación" }, async () => {
      db.usuarios.push({
        id: "usr-candidato-2",
        nombre: "Candidato 2",
        email: "candidato2@example.test",
        password: "hash",
        rol: ROLES.PEON,
        establecimientoId: null,
      });

      const tokenDueno = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .post("/api/permisos/solicitar-empleado")
        .set(encabezadoBearer(tokenDueno))
        .send({ email: "candidato2@example.test" });

      assert.equal(res.status, 201);
      assertSinSecretos(res.body);
    });

    it("rechaza vinculación si el email no está registrado previamente", async () => {
      const tokenDueno = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .post("/api/permisos/solicitar-empleado")
        .set(encabezadoBearer(tokenDueno))
        .send({ email: "no-registrado@example.test" });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /No existe ningún usuario registrado/i);
    });

    it("rechaza vinculación si el usuario ya está asignado al mismo establecimiento", async () => {
      const tokenDueno = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .post("/api/permisos/solicitar-empleado")
        .set(encabezadoBearer(tokenDueno))
        .send({ email: "dueno@vakera.com" });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /ya se encuentra asignado a este establecimiento/i);
    });

    it("peón intenta vincular empleado y responde 403", async () => {
      const tokenPeon = firmarToken({
        id: "usr-3",
        rol: ROLES.PEON,
      });

      const res = await request(app)
        .post("/api/permisos/solicitar-empleado")
        .set(encabezadoBearer(tokenPeon))
        .send({ email: "alguien@example.test" });

      assert.equal(res.status, 403);
      assert.equal(res.body.ok, false);
    });
  });

  describe("DELETE /api/permisos/usuarios/:id/desvincular", () => {
    it("dueño desvincula a un empleado de su establecimiento y responde 200", async () => {
      // Asignar un usuario a est-el-rancho
      const emp = db.usuarios.find((u) => u.id === "usr-2");
      emp.establecimientoId = "est-el-rancho";

      const tokenDueno = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .delete("/api/permisos/usuarios/usr-2/desvincular")
        .set(encabezadoBearer(tokenDueno));

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.data.establecimientoId, null);
      assert.equal(emp.establecimientoId, null);
    });

    it("I7: no permite desvincular al propietario del establecimiento", async () => {
      const tokenDueno = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .delete("/api/permisos/usuarios/usr-1/desvincular")
        .set(encabezadoBearer(tokenDueno));

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /No es posible desvincular al propietario/i);
    });

    it("rol peón intenta desvincular y es bloqueado con 403", async () => {
      const tokenPeon = firmarToken({
        id: "usr-3",
        rol: ROLES.PEON,
      });

      const res = await request(app)
        .delete("/api/permisos/usuarios/usr-2/desvincular")
        .set(encabezadoBearer(tokenPeon));

      assert.equal(res.status, 403);
      assert.equal(res.body.ok, false);
    });

    it("desvincular usuario inexistente responde 400", async () => {
      const tokenDueno = firmarToken({
        id: "usr-1",
        rol: ROLES.DUENO,
        establecimientoId: "est-el-rancho",
      });

      const res = await request(app)
        .delete("/api/permisos/usuarios/usr-inexistente-888/desvincular")
        .set(encabezadoBearer(tokenDueno));

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Usuario no encontrado/i);
    });
  });
});

