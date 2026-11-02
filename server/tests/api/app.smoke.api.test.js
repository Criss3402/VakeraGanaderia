/**
 * Smoke test de contrato HTTP (Supertest sobre `app`, sin abrir puerto).
 * No toca PostgreSQL: las rutas probadas responden antes de consultar la BD.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// Debe ir primero: fija JWT_SECRET de test y aísla DATABASE_URL.
require("../helpers/tokens");

const request = require("supertest");
const app = require("../../src/index");

describe("Smoke de la API Express (sin puerto ni base de datos)", () => {
  it("GET /api/health responde 200 con status ok", async () => {
    const res = await request(app).get("/api/health");

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
    assert.ok(Array.isArray(res.body.modulos));
  });

  it("ruta inexistente responde 404 con el formato { ok: false, error }", async () => {
    const res = await request(app).get("/api/ruta-que-no-existe");

    assert.equal(res.status, 404);
    assert.equal(res.body.ok, false);
    assert.match(res.body.error, /Ruta no encontrada/);
  });

  it("GET /api/dashboard/metricas sin token responde 401", async () => {
    const res = await request(app).get("/api/dashboard/metricas");

    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
  });
});

