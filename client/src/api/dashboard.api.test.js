import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/msw/server.js";
import {
  bajaMasivaGanado,
  eliminarInsumosMasivo,
  gestionarLocacionInsumos,
  eliminarInsumo,
  trasladoMasivoGanado,
  actualizarStockInsumo,
  registrarConteoPertenencias,
  obtenerGanado,
  obtenerInsumos,
} from "./dashboard.api.js";

describe("API Dashboard — Funciones de Mutación y Consulta (dashboard.api.js)", () => {
  it("bajaMasivaGanado envía método POST, URL y body exactos con animalIds y motivo", async () => {
    let capturedRequest = null;
    let capturedBody = null;

    server.use(
      http.post("*/api/dashboard/ganado/baja-masiva", async ({ request }) => {
        capturedRequest = request;
        capturedBody = await request.json();
        return HttpResponse.json({
          ok: true,
          data: { bajas: 2, motivo: capturedBody.motivo },
        });
      })
    );

    const res = await bajaMasivaGanado({ animalIds: ["g-1", "g-2"], motivo: "Faena" });

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest.method).toBe("POST");
    expect(new URL(capturedRequest.url).pathname).toBe("/api/dashboard/ganado/baja-masiva");
    expect(capturedBody).toEqual({ animalIds: ["g-1", "g-2"], motivo: "Faena" });
    expect(res).toEqual({
      ok: true,
      data: { bajas: 2, motivo: "Faena" },
    });
  });

  it("eliminarInsumosMasivo envía POST con la lista exacta de IDs a eliminar", async () => {
    let capturedBody = null;

    server.use(
      http.post("*/api/dashboard/insumos/eliminar-masivo", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          ok: true,
          data: { eliminados: capturedBody.ids.length },
        });
      })
    );

    const res = await eliminarInsumosMasivo([101, 102, 103]);

    expect(capturedBody).toEqual({ ids: [101, 102, 103] });
    expect(res.data.eliminados).toBe(3);
  });

  it("gestionarLocacionInsumos envía PATCH con nombreAnterior, nuevoNombre y accion editar", async () => {
    let capturedMethod = null;
    let capturedBody = null;

    server.use(
      http.patch("*/api/dashboard/insumos/locaciones", async ({ request }) => {
        capturedMethod = request.method;
        capturedBody = await request.json();
        return HttpResponse.json({
          ok: true,
          data: { afectadas: 4 },
        });
      })
    );

    const res = await gestionarLocacionInsumos({
      nombreAnterior: "Galpón Norte",
      nuevoNombre: "Galpón Principal",
      accion: "editar",
    });

    expect(capturedMethod).toBe("PATCH");
    expect(capturedBody).toEqual({
      nombreAnterior: "Galpón Norte",
      nuevoNombre: "Galpón Principal",
      accion: "editar",
    });
    expect(res.ok).toBe(true);
  });

  it("gestionarLocacionInsumos envía PATCH con accion eliminar para reasignación", async () => {
    let capturedBody = null;

    server.use(
      http.patch("*/api/dashboard/insumos/locaciones", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ok: true, data: { reasignadas: 2 } });
      })
    );

    await gestionarLocacionInsumos({
      nombreAnterior: "Silo Auxiliar",
      accion: "eliminar",
    });

    expect(capturedBody).toEqual({
      nombreAnterior: "Silo Auxiliar",
      nuevoNombre: undefined,
      accion: "eliminar",
    });
  });

  it("eliminarInsumo envía DELETE al endpoint específico con el ID correspondiente", async () => {
    let capturedMethod = null;
    let capturedPath = null;

    server.use(
      http.delete("*/api/dashboard/insumos/:id", ({ request, params }) => {
        capturedMethod = request.method;
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json({ ok: true, data: { id: params.id } });
      })
    );

    const res = await eliminarInsumo(55);

    expect(capturedMethod).toBe("DELETE");
    expect(capturedPath).toBe("/api/dashboard/insumos/55");
    expect(res.data.id).toBe("55");
  });

  it("trasladoMasivoGanado envía POST con animalIds y potreroDestinoId", async () => {
    let capturedBody = null;

    server.use(
      http.post("*/api/dashboard/ganado/traslado-masivo", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ok: true, data: { trasladados: 2 } });
      })
    );

    const res = await trasladoMasivoGanado({
      animalIds: ["a1", "a2"],
      potreroDestinoId: 8,
    });

    expect(capturedBody).toEqual({
      animalIds: ["a1", "a2"],
      potreroDestinoId: 8,
    });
    expect(res.data.trasladados).toBe(2);
  });

  it("actualizarStockInsumo envía PATCH con cantidad y tipo de operación", async () => {
    let capturedBody = null;

    server.use(
      http.patch("*/api/dashboard/insumos/:id/stock", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ok: true, data: { stockActual: 150 } });
      })
    );

    const res = await actualizarStockInsumo(12, 50, "sumar");

    expect(capturedBody).toEqual({ cantidad: 50, operacion: "sumar" });
    expect(res.data.stockActual).toBe(150);
  });

  it("registrarConteoPertenencias envía PATCH con el conteo físico de stock", async () => {
    let capturedBody = null;

    server.use(
      http.patch("*/api/dashboard/insumos/:id/conteo", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ok: true, data: { stockContado: 80 } });
      })
    );

    const res = await registrarConteoPertenencias(7, 80);

    expect(capturedBody).toEqual({ stockContado: 80 });
    expect(res.data.stockContado).toBe(80);
  });

  it("obtenerGanado serializa los query params de paginación y filtros", async () => {
    let capturedQuery = null;

    server.use(
      http.get("*/api/dashboard/ganado", ({ request }) => {
        capturedQuery = new URL(request.url).searchParams;
        return HttpResponse.json({ ok: true, data: { animales: [] } });
      })
    );

    await obtenerGanado({ page: 2, limit: 15, categoria: "Toro" });

    expect(capturedQuery.get("page")).toBe("2");
    expect(capturedQuery.get("limit")).toBe("15");
    expect(capturedQuery.get("categoria")).toBe("Toro");
  });

  it("propaga errores HTTP cuando el backend responde con error 400", async () => {
    server.use(
      http.post("*/api/dashboard/ganado/baja-masiva", () => {
        return HttpResponse.json(
          { ok: false, error: "Lista de animales inválida" },
          { status: 400 }
        );
      })
    );

    await expect(
      bajaMasivaGanado({ animalIds: [], motivo: "Venta" })
    ).rejects.toThrow("Lista de animales inválida");
  });
});

