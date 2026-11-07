/**
 * Tests de API — Dashboard (Validaciones de Entrada, Paginación y Robustez HTTP)
 *
 * Fase 3C del Implementation Plan:
 * - Paginación en GET /api/dashboard/ganado (?take, ?skip) y resiliencia ante valores inválidos.
 * - Validaciones de entrada en bajas masivas de ganado e insumos (arreglos vacíos o no-array -> 400).
 * - Validaciones en traslados de hacienda, locaciones, conteo físico y solicitudes de insumos.
 * - Validación de estados permitidos en partes diarios (rechazo de CANCELADO -> 400).
 * - Robustez HTTP: rechazo de JSON malformado (400), payload > 1MB (413) y rutas 404 formateadas.
 * - Modo producción: supresión de stacktrace en errores no controlados.
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

// Inicializa tokens y entorno seguro de test
require("../helpers/tokens");

const { firmarToken, encabezadoBearer } = require("../helpers/tokens");
const { resetearMemoria } = require("../helpers/memoria");
require("../helpers/rutas");
const app = require("../../src/index");
const db = require("../../src/config/db");
const { ROLES } = require("../../src/utils/roles.constants");

const ESTABLECIMIENTO_ID = "est-dash-test";

describe("API — /api/dashboard (Validaciones, Paginación y Robustez HTTP)", () => {
  let tokenDueno;
  let tokenCapataz;

  beforeEach(() => {
    resetearMemoria();

    tokenDueno = firmarToken({
      id: "usr-dueno-dash",
      rol: ROLES.DUENO,
      establecimientoId: ESTABLECIMIENTO_ID,
    });

    tokenCapataz = firmarToken({
      id: "usr-capataz-dash",
      rol: ROLES.CAPATAZ,
      establecimientoId: ESTABLECIMIENTO_ID,
    });

    if (!Array.isArray(db.usuarios)) db.usuarios = [];
    db.usuarios.push(
      {
        id: "usr-dueno-dash",
        nombre: "Dueño Dash",
        email: "dueno@dash.test",
        rol: ROLES.DUENO,
        emailVerificado: true,
        establecimientoId: ESTABLECIMIENTO_ID,
      },
      {
        id: "usr-capataz-dash",
        nombre: "Capataz Dash",
        email: "capataz@dash.test",
        rol: ROLES.CAPATAZ,
        emailVerificado: true,
        establecimientoId: ESTABLECIMIENTO_ID,
      }
    );

    // Sembrar ganado para pruebas de paginación
    if (!Array.isArray(db.ganado)) db.ganado = [];
    db.ganado.push(
      { id: "gan-p-1", caravana: "AR-P1", categoria: "Vacas", establecimientoId: ESTABLECIMIENTO_ID },
      { id: "gan-p-2", caravana: "AR-P2", categoria: "Novillos", establecimientoId: ESTABLECIMIENTO_ID },
      { id: "gan-p-3", caravana: "AR-P3", categoria: "Toros", establecimientoId: ESTABLECIMIENTO_ID },
      { id: "gan-p-4", caravana: "AR-P4", categoria: "Terneras", establecimientoId: ESTABLECIMIENTO_ID }
    );
  });

  describe("1. Paginación y Robustez en GET /api/dashboard/ganado", () => {
    it("soporta paginación con take=2 y skip=1 retornando 2 animales", async () => {
      const res = await request(app)
        .get("/api/dashboard/ganado?take=2&skip=1")
        .set(encabezadoBearer(tokenDueno));

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.data.length, 2);
      assert.equal(res.body.data[0].id, "gan-p-2");
      assert.equal(res.body.data[1].id, "gan-p-3");
    });

    it("resiste valores atípicos de paginación (take=-1, take=abc, take=100000) sin arrojar error 500", async () => {
      const casos = [
        "/api/dashboard/ganado?take=-1",
        "/api/dashboard/ganado?take=abc",
        "/api/dashboard/ganado?take=100000",
        "/api/dashboard/ganado?skip=2", // skip sin take
      ];

      for (const url of casos) {
        const res = await request(app)
          .get(url)
          .set(encabezadoBearer(tokenDueno));

        assert.equal(res.status, 200, `Falló para URL: ${url}`);
        assert.equal(res.body.ok, true);
        assert.ok(Array.isArray(res.body.data));
      }
    });
  });

  describe("2. Validaciones de Entrada en Bajas Masivas y Traslados", () => {
    it("POST /api/dashboard/ganado/baja-masiva con arreglo vacío responde 400", async () => {
      const res = await request(app)
        .post("/api/dashboard/ganado/baja-masiva")
        .set(encabezadoBearer(tokenCapataz))
        .send({ animalIds: [] });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Debe seleccionar al menos un animal/i);
    });

    it("POST /api/dashboard/ganado/baja-masiva con parámetro animalIds no-array responde 400", async () => {
      const res = await request(app)
        .post("/api/dashboard/ganado/baja-masiva")
        .set(encabezadoBearer(tokenCapataz))
        .send({ animalIds: "no-array" });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
    });

    it("POST /api/dashboard/ganado/traslado-masivo sin animales seleccionados responde 400", async () => {
      const res = await request(app)
        .post("/api/dashboard/ganado/traslado-masivo")
        .set(encabezadoBearer(tokenCapataz))
        .send({ animalIds: [], potreroDestinoId: "pot-1" });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
    });

    it("POST /api/dashboard/insumos/eliminar-masivo con ids vacío responde 400", async () => {
      const res = await request(app)
        .post("/api/dashboard/insumos/eliminar-masivo")
        .set(encabezadoBearer(tokenDueno))
        .send({ ids: [] });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Debe seleccionar al menos un insumo/i);
    });
  });

  describe("3. Validaciones de Insumos, Locaciones y Partes Diarios", () => {
    it("PATCH /api/dashboard/insumos/locaciones con nuevoNombre vacío en acción editar responde 400", async () => {
      const res = await request(app)
        .patch("/api/dashboard/insumos/locaciones")
        .set(encabezadoBearer(tokenDueno))
        .send({ nombreAnterior: "Depósito Central", nuevoNombre: "", accion: "editar" });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
    });

    it("PATCH /api/dashboard/insumos/:id/conteo sin stockContado responde 400", async () => {
      const res = await request(app)
        .patch("/api/dashboard/insumos/ins-1/conteo")
        .set(encabezadoBearer(tokenDueno))
        .send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Debe ingresar la cantidad física contada/i);
    });

    it("POST /api/dashboard/insumos/solicitudes sin insumoNombre responde 400", async () => {
      const res = await request(app)
        .post("/api/dashboard/insumos/solicitudes")
        .set(encabezadoBearer(tokenCapataz))
        .send({ cantidad: 2 });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Debe especificar el insumo/i);
    });

    it("POST /api/dashboard/partes sin novedades responde 400", async () => {
      const res = await request(app)
        .post("/api/dashboard/partes")
        .set(encabezadoBearer(tokenCapataz))
        .send({ animalesRevisados: 50 });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Las novedades son requeridas/i);
    });

    it("PATCH /api/dashboard/partes/:id/estado con estado inválido 'CANCELADO' responde 400", async () => {
      const res = await request(app)
        .patch("/api/dashboard/partes/pd-test-1/estado")
        .set(encabezadoBearer(tokenCapataz))
        .send({ estado: "CANCELADO" });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Estado inválido/i);
    });
  });

  describe("4. Robustez de Middleware HTTP (JSON, Tamaño y Errores)", () => {
    it("responde 400 ante payload con JSON sintácticamente malformado", async () => {
      const res = await request(app)
        .post("/api/dashboard/ganado")
        .set(encabezadoBearer(tokenDueno))
        .set("Content-Type", "application/json")
        .send("{ caravana: 'AR-MALFORMADO', "); // JSON trunco

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
    });

    it("responde 413 Payload Too Large ante peticiones con body mayor a 1 MB", async () => {
      const cuerpoGigante = "a".repeat(1024 * 1024 + 100); // > 1 MB

      const res = await request(app)
        .post("/api/dashboard/ganado")
        .set(encabezadoBearer(tokenDueno))
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ caravana: "AR-GRANDE", datos: cuerpoGigante }));

      assert.equal(res.status, 413);
      assert.equal(res.body.ok, false);
    });

    it("ruta inexistente en Express responde 404 JSON estándar { ok: false, error }", async () => {
      const res = await request(app).get("/api/ruta-totalmente-inexistente-xyz");

      assert.equal(res.status, 404);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Ruta no encontrada/i);
    });
  });
});

