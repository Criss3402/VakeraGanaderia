import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/msw/server.js";
import SanidadView from "./SanidadView.jsx";
import * as AuthContextModule from "../../../context/AuthContext.jsx";

describe("Vista de Sanidad y Vacunas (SanidadView.jsx)", () => {
  let mockEventos;

  beforeEach(() => {
    mockEventos = [
      {
        id: "san-1",
        evento: "Vacunación Antiaftosa",
        tipo: "Vacunación",
        lote: "Rodeo General",
        fecha: "2026-10-15",
        estado: "Pendiente",
        prioridad: "Alta",
      },
      {
        id: "san-2",
        evento: "Tratamiento Antiparasitario",
        tipo: "Tratamiento",
        lote: "Novillos Potrero 5",
        fecha: "2026-09-18",
        estado: "Completado",
        prioridad: "Normal",
      },
    ];

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      rol: "dueno",
      usuario: { id: "usr-1", establecimientoId: "est-test", email: "dueno@test.com" },
    });

    server.use(
      http.get("*/api/dashboard/sanidad", () => {
        return HttpResponse.json({ ok: true, data: mockEventos });
      }),
      http.get("*/api/dashboard/ganado", () => {
        return HttpResponse.json({ ok: true, data: [] });
      })
    );
  });

  it("muestra el botón Eliminar y ejecuta DELETE /api/dashboard/sanidad/:id al confirmar", async () => {
    let idEliminado = null;

    server.use(
      http.delete("*/api/dashboard/sanidad/:id", ({ params }) => {
        idEliminado = params.id;
        mockEventos = mockEventos.filter((ev) => ev.id !== params.id);
        return HttpResponse.json({ ok: true, data: { id: params.id } });
      })
    );

    render(<SanidadView />);

    await waitFor(() => {
      expect(screen.getByText("Vacunación Antiaftosa")).toBeInTheDocument();
      expect(screen.getByText("Tratamiento Antiparasitario")).toBeInTheDocument();
    });

    const botonesEliminar = screen.getAllByRole("button", { name: /Eliminar/i });
    expect(botonesEliminar).toHaveLength(2);

    // Eliminar el evento ya completado (Tratamiento Antiparasitario)
    await userEvent.click(botonesEliminar[1]);

    expect(screen.getByText("Eliminar Acto Sanitario")).toBeInTheDocument();
    const btnConfirmar = screen.getByRole("button", { name: /Confirmar Eliminación/i });
    await userEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(idEliminado).toBe("san-2");
      expect(screen.queryByText("Tratamiento Antiparasitario")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Vacunación Antiaftosa")).toBeInTheDocument();
  });

  it("permite marcar múltiples eventos con 'Marcar todos' y eliminarlos en lote", async () => {
    let idsRecibidos = null;

    server.use(
      http.post("*/api/dashboard/sanidad/eliminar-masivo", async ({ request }) => {
        const body = await request.json();
        idsRecibidos = body.ids;
        mockEventos = mockEventos.filter((ev) => !idsRecibidos.includes(ev.id));
        return HttpResponse.json({ ok: true, data: { count: idsRecibidos.length, ids: idsRecibidos } });
      })
    );

    render(<SanidadView />);

    await waitFor(() => {
      expect(screen.getByText("Vacunación Antiaftosa")).toBeInTheDocument();
    });

    const checkTodos = screen.getByLabelText(/Marcar todos/i);
    await userEvent.click(checkTodos);

    const btnEliminarMarcados = await screen.findByRole("button", {
      name: /Eliminar Marcados \(2\)/i,
    });
    await userEvent.click(btnEliminarMarcados);

    expect(screen.getByText(/Eliminar 2 Actos Marcados/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Confirmar Eliminación/i }));

    await waitFor(() => {
      expect(idsRecibidos).toEqual(["san-1", "san-2"]);
      expect(screen.queryByText("Vacunación Antiaftosa")).not.toBeInTheDocument();
      expect(screen.queryByText("Tratamiento Antiparasitario")).not.toBeInTheDocument();
    });
  });

  it("oculta el botón Eliminar cuando el rol es peón", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      rol: "peon",
      usuario: { id: "usr-peon", establecimientoId: "est-test" },
    });

    render(<SanidadView />);

    await waitFor(() => {
      expect(screen.getByText("Vacunación Antiaftosa")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /Eliminar/i })).not.toBeInTheDocument();
  });
});
