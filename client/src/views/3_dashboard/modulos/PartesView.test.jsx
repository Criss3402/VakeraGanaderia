import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/msw/server.js";
import PartesView from "./PartesView.jsx";
import * as AuthContextModule from "../../../context/AuthContext.jsx";

describe("Vista de Partes Diarios de Campo (PartesView.jsx)", () => {
  let mockPartes;

  beforeEach(() => {
    mockPartes = [
      {
        id: "pd-1",
        fecha: "2026-09-19",
        peonNombre: "Lucas Giménez",
        potreroNombre: "Potrero General",
        novedades: "Nacimiento de 2 terneros machos en buen estado.",
        animalesRevisados: 85,
        estado: "RECHAZADO",
        revisadoPorNombre: "Cristian Joaquín",
      },
      {
        id: "pd-2",
        fecha: "2026-09-18",
        peonNombre: "Lucas Giménez",
        potreroNombre: "Potrero General",
        novedades: "Novillo AR-84922 apartado con renguera.",
        animalesRevisados: 120,
        estado: "APROBADO",
        revisadoPorNombre: "Martín Benítez",
      },
    ];

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      rol: "dueno",
      usuario: { id: "usr-1", establecimientoId: "est-test", email: "dueno@test.com" },
    });

    server.use(
      http.get("*/api/dashboard/partes", () => {
        return HttpResponse.json({ ok: true, data: mockPartes });
      }),
      http.get("*/api/dashboard/potreros", () => {
        return HttpResponse.json({ ok: true, data: [] });
      })
    );
  });

  it("muestra el botón Eliminar y ejecuta DELETE /api/dashboard/partes/:id al confirmar", async () => {
    let idEliminado = null;

    server.use(
      http.delete("*/api/dashboard/partes/:id", ({ params }) => {
        idEliminado = params.id;
        mockPartes = mockPartes.filter((p) => p.id !== params.id);
        return HttpResponse.json({ ok: true, data: { id: params.id } });
      })
    );

    render(<PartesView />);

    await waitFor(() => {
      expect(screen.getByText(/Nacimiento de 2 terneros machos/i)).toBeInTheDocument();
      expect(screen.getByText(/Novillo AR-84922 apartado/i)).toBeInTheDocument();
    });

    const botonesEliminar = screen.getAllByRole("button", { name: /Eliminar/i });
    expect(botonesEliminar).toHaveLength(2);

    await userEvent.click(botonesEliminar[0]);

    expect(screen.getByText("Eliminar Parte Diario")).toBeInTheDocument();
    const btnConfirmar = screen.getByRole("button", { name: /Confirmar Eliminación/i });
    await userEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(idEliminado).toBe("pd-1");
      expect(screen.queryByText(/Nacimiento de 2 terneros machos/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Novillo AR-84922 apartado/i)).toBeInTheDocument();
  });

  it("permite marcar múltiples partes con 'Marcar todos' y eliminarlos en lote", async () => {
    let idsRecibidos = null;

    server.use(
      http.post("*/api/dashboard/partes/eliminar-masivo", async ({ request }) => {
        const body = await request.json();
        idsRecibidos = body.ids;
        mockPartes = mockPartes.filter((p) => !idsRecibidos.includes(p.id));
        return HttpResponse.json({ ok: true, data: { count: idsRecibidos.length, ids: idsRecibidos } });
      })
    );

    render(<PartesView />);

    await waitFor(() => {
      expect(screen.getByText(/Nacimiento de 2 terneros machos/i)).toBeInTheDocument();
    });

    const checkTodos = screen.getByLabelText(/Marcar todos/i);
    await userEvent.click(checkTodos);

    const btnEliminarMarcados = await screen.findByRole("button", {
      name: /Eliminar Marcados \(2\)/i,
    });
    await userEvent.click(btnEliminarMarcados);

    expect(screen.getByText(/Eliminar 2 Partes Marcados/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Confirmar Eliminación/i }));

    await waitFor(() => {
      expect(idsRecibidos).toEqual(["pd-1", "pd-2"]);
      expect(screen.queryByText(/Nacimiento de 2 terneros machos/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Novillo AR-84922 apartado/i)).not.toBeInTheDocument();
    });
  });

  it("oculta el botón Eliminar cuando el rol es peón", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      rol: "peon",
      usuario: { id: "usr-peon", establecimientoId: "est-test" },
    });

    render(<PartesView />);

    await waitFor(() => {
      expect(screen.getByText(/Nacimiento de 2 terneros machos/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /Eliminar/i })).not.toBeInTheDocument();
  });
});
