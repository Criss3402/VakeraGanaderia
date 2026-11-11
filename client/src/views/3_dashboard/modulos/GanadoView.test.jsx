import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/msw/server.js";
import GanadoView from "./GanadoView.jsx";
import * as AuthContextModule from "../../../context/AuthContext.jsx";

describe("Vista de Gestión de Ganado y Rodeo (GanadoView.jsx)", () => {
  const mockGanado = [
    {
      id: "gan-1",
      caravana: "AR-001",
      categoria: "Vacas",
      raza: "Angus Negro",
      sexo: "Hembra",
      pesoKg: 420,
      estadoSanitario: "SALUDABLE",
      potreroId: "pot-1",
      potreroNombre: "Potrero Norte",
    },
    {
      id: "gan-2",
      caravana: "AR-002",
      categoria: "Novillos",
      raza: "Hereford",
      sexo: "Macho",
      pesoKg: 380,
      estadoSanitario: "SALUDABLE",
      potreroId: "pot-2",
      potreroNombre: "Potrero Sur",
    },
  ];

  const mockPotreros = [
    { id: "pot-1", nombre: "Potrero Norte", capacidad: 50 },
    { id: "pot-2", nombre: "Potrero Sur", capacidad: 60 },
  ];

  beforeEach(() => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      rol: "dueno",
      usuario: { id: "usr-1", establecimientoId: "est-test" },
    });

    server.use(
      http.get("*/api/dashboard/ganado", () => {
        return HttpResponse.json({ ok: true, data: mockGanado });
      }),
      http.get("*/api/dashboard/potreros", () => {
        return HttpResponse.json({ ok: true, data: mockPotreros });
      })
    );
  });

  it("renderiza la lista de animales y potreros tras cargar los datos", async () => {
    render(<GanadoView />);

    await waitFor(() => {
      expect(screen.getByText("AR-001")).toBeInTheDocument();
      expect(screen.getByText("AR-002")).toBeInTheDocument();
    });

    expect(screen.getByText(/2 Cabezas/i)).toBeInTheDocument();
    expect(screen.getAllByText("Potrero Norte").length).toBeGreaterThanOrEqual(1);
  });

  it("marcar un animal actualiza los contadores en las tarjetas y botones de acción", async () => {
    render(<GanadoView />);

    await waitFor(() => {
      expect(screen.getByText("AR-001")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    // El primer checkbox es el 'seleccionar todos', el segundo es AR-001
    await userEvent.click(checkboxes[1]);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Eliminar Marcados \(1\)/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Trasladar Lote \(1\)/i })
      ).toBeInTheDocument();
    });
  });

  it("modal de baja masiva envía 1 request con animalIds exactos y motivo al confirmar", async () => {
    let capturedBody = null;
    let requestsCount = 0;

    server.use(
      http.post("*/api/dashboard/ganado/baja-masiva", async ({ request }) => {
        requestsCount++;
        capturedBody = await request.json();
        return HttpResponse.json({
          ok: true,
          data: { bajas: 2, motivo: capturedBody.motivo },
        });
      })
    );

    render(<GanadoView />);

    await waitFor(() => {
      expect(screen.getByText("AR-001")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    // Marcar ambos animales
    await userEvent.click(checkboxes[1]);
    await userEvent.click(checkboxes[2]);

    const btnBaja = await screen.findByRole("button", {
      name: /Eliminar Marcados \(2\)/i,
    });
    await userEvent.click(btnBaja);

    // Modal de confirmación abierto
    expect(
      screen.getByText(/Eliminar 2 Animales Marcados/i)
    ).toBeInTheDocument();

    const btnConfirmar = screen.getByRole("button", {
      name: /Eliminar \(2\)/i,
    });
    await userEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(requestsCount).toBe(1);
      expect(capturedBody).toEqual({
        animalIds: ["gan-1", "gan-2"],
        motivo: expect.any(String),
      });
    });
  });

  it("cancelar en el modal de baja masiva cierra el diálogo y no ejecuta ninguna petición", async () => {
    let requestsCount = 0;

    server.use(
      http.post("*/api/dashboard/ganado/baja-masiva", async () => {
        requestsCount++;
        return HttpResponse.json({ ok: true, data: { bajas: 1 } });
      })
    );

    render(<GanadoView />);

    await waitFor(() => {
      expect(screen.getByText("AR-001")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[1]);

    const btnBaja = await screen.findByRole("button", {
      name: /Eliminar Marcados \(1\)/i,
    });
    await userEvent.click(btnBaja);

    expect(
      screen.getByText(/Eliminar 1 Animales Marcados/i)
    ).toBeInTheDocument();

    const btnCancelar = screen.getByRole("button", { name: /Cancelar/i });
    await userEvent.click(btnCancelar);

    await waitFor(() => {
      expect(
        screen.queryByText(/Eliminar 1 Animales Marcados/i)
      ).not.toBeInTheDocument();
    });

    expect(requestsCount).toBe(0);
  });

  it("usuario con rol peón no visualiza botones de alta, nuevo potrero ni acciones destructivas de lote", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      rol: "peon",
      usuario: { id: "usr-peon", establecimientoId: "est-test" },
    });

    render(<GanadoView />);

    await waitFor(() => {
      expect(screen.getByText("AR-001")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /\+ Alta de Animal/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /\+ Nuevo Potrero/i })
    ).not.toBeInTheDocument();

    // Al marcar un animal, peón solo puede trasladar pero no eliminar
    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[1]);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Trasladar Lote \(1\)/i })
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /Eliminar Marcados/i })
    ).not.toBeInTheDocument();
  });

  it("seleccionar todos marca y desmarca el conjunto completo del rodeo", async () => {
    render(<GanadoView />);

    await waitFor(() => {
      expect(screen.getByText("AR-001")).toBeInTheDocument();
    });

    const checkboxTodos = screen.getByTitle(/Seleccionar todos/i);
    await userEvent.click(checkboxTodos);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Eliminar Marcados \(2\)/i })
      ).toBeInTheDocument();
    });

    await userEvent.click(checkboxTodos);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Eliminar Marcados/i })
      ).not.toBeInTheDocument();
    });
  });
});
