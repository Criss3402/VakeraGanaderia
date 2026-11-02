/**
 * Suite de Tests Unitarios — Cliente API y Caché Inteligente en Memoria (ESM)
 * Ejecutado con Vitest (migrado desde el runner nativo `node --test`; aserciones sin cambios).
 */
import { describe, it, beforeEach } from "vitest";
import assert from "node:assert/strict";

// Mock de localStorage para entorno Node.js
const storageMap = new Map();
globalThis.localStorage = {
  getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
  setItem: (key, val) => storageMap.set(key, String(val)),
  removeItem: (key) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

import { getToken, setToken, request, limpiarCacheApi } from "./client.js";

describe("Frontend API Client y Caché en Memoria (client.js)", () => {
  let fetchCalls = [];

  beforeEach(() => {
    storageMap.clear();
    limpiarCacheApi();
    fetchCalls = [];

    globalThis.fetch = async (url, config) => {
      fetchCalls.push({ url, config });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: { endpoint: url, timestamp: fetchCalls.length },
        }),
      };
    };
  });

  it("gestiona el token JWT en localStorage con setToken y getToken", () => {
    assert.equal(getToken(), null);

    setToken("jwt-token-demo-123");
    assert.equal(getToken(), "jwt-token-demo-123");

    setToken(null);
    assert.equal(getToken(), null);
  });

  it("inyecta el header Authorization Bearer cuando existe un token activo", async () => {
    setToken("token-secreto-abc");
    await request("/auth/me");

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].config.headers.Authorization, "Bearer token-secreto-abc");
  });

  it("almacena en caché las lecturas GET y evita peticiones de red duplicadas", async () => {
    const primera = await request("/dashboard/metricas");
    const segunda = await request("/dashboard/metricas");

    assert.equal(fetchCalls.length, 1);
    assert.deepEqual(primera, segunda);
  });

  it("permite forzar la recarga omitiendo la caché con { noCache: true }", async () => {
    await request("/dashboard/metricas");
    await request("/dashboard/metricas", { noCache: true });

    assert.equal(fetchCalls.length, 2);
  });

  it("invalida automáticamente la caché del recurso tras una mutación (POST / PATCH / DELETE)", async () => {
    // 1. Primera lectura: va a red y queda en caché
    await request("/dashboard/ganado");
    assert.equal(fetchCalls.length, 1);

    // 2. Segunda lectura: se sirve desde memoria (0 llamadas extra)
    await request("/dashboard/ganado");
    assert.equal(fetchCalls.length, 1);

    // 3. Mutación POST en el mismo prefijo (/dashboard/...): invalida caché de /dashboard
    await request("/dashboard/ganado", {
      method: "POST",
      body: JSON.stringify({ caravana: "AR-9999" }),
    });
    assert.equal(fetchCalls.length, 2);

    // 4. Nueva lectura GET tras la mutación: vuelve a consultar a la red por datos frescos
    await request("/dashboard/ganado");
    assert.equal(fetchCalls.length, 3);
  });

  it("propaga errores HTTP estructurados con código de estado y detalles", async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        ok: false,
        error: "Acceso restringido al rol Dueño",
        detalles: { rolRequerido: "dueno" },
      }),
    });

    await assert.rejects(
      async () => {
        await request("/permisos/usuarios");
      },
      (err) => {
        assert.equal(err.message, "Acceso restringido al rol Dueño");
        assert.equal(err.status, 403);
        assert.deepEqual(err.detalles, { rolRequerido: "dueno" });
        return true;
      }
    );
  });
});

