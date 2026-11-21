import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/msw/server.js";
import * as AuthContextModule from "../../../context/AuthContext.jsx";

vi.mock("maplibre-gl", () => {
  class MockMap {
    on() {}
    addControl() {}
    addSource() {}
    addLayer() {}
    getSource() {
      return { setData: () => {} };
    }
    getCanvas() {
      return { style: {} };
    }
    doubleClickZoom = { enable: () => {}, disable: () => {} };
    project() {
      return { x: 100, y: 100 };
    }
    flyTo() {}
    remove() {}
  }
  class MockMarker {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }
  class MockControl {}
  return {
    Map: MockMap,
    Marker: MockMarker,
    NavigationControl: MockControl,
    ScaleControl: MockControl,
    FullscreenControl: MockControl,
  };
});

import ParcelasView from "./ParcelasView.jsx";

describe("Vista de Parcelas y Potreros (ParcelasView.jsx)", () => {
  let mockPotreros;

  beforeEach(() => {
    localStorage.clear();
    mockPotreros = [
      {
        id: "pot-custom-1",
        nombre: "Parcela 1",
        superficieHas: 5.7,
        capacidad: 10,
        pastura: "Campo Natural y Gramíneas",
        estadoPastura: "Óptimo",
        aguada: "Bebedero / Tanque",
        color: "#ea580c",
        coordinates: [
          [-59.255, -29.142],
          [-59.253, -29.142],
          [-59.253, -29.144],
        ],
        totalAnimales: 0,
      },
    ];

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      rol: "dueno",
      usuario: { id: "usr-1", establecimientoId: "est-parcelas", email: "dueno@test.com" },
    });

    server.use(
      http.get("*/api/dashboard/potreros", () => {
        return HttpResponse.json({ ok: true, data: mockPotreros });
      }),
      http.get("*/api/dashboard/ganado", () => {
        return HttpResponse.json({ ok: true, data: [] });
      }),
      http.get("*/api/dashboard/potreros/permisos", () => {
        return HttpResponse.json({
          ok: true,
          data: {
            puedeAgregar: true,
            puedeEditar: true,
            requiereSolicitud: false,
            solicitudActual: null,
            solicitudesPendientes: [],
          },
        });
      })
    );
  });

  it("muestra superficie en m² por defecto, oculta Capacidad Máxima y permite cambiar métrica con el menú de 3 rayitas", async () => {
    render(<ParcelasView />);

    await waitFor(() => {
      expect(screen.getByText("Parcela 1")).toBeInTheDocument();
    });

    // Verificar que Capacidad Máxima, Carga Animal en Campo y Carga Media Global no se muestran
    expect(screen.queryByText(/Capacidad Máx\./i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Receptividad Máxima/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Carga Animal en Campo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Carga Media Global/i)).not.toBeInTheDocument();

    // Seleccionar la parcela para abrir su ficha inspectora
    await userEvent.click(screen.getByText("Parcela 1"));

    await waitFor(() => {
      expect(screen.getByText(/Superficie \(Metros cuadrados\)/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/57\.000 m²|57,000 m²/i).length).toBeGreaterThanOrEqual(1);

    // Abrir el menú de 3 rayitas y cambiar a Hectáreas (Has)
    const btnMetrica = screen.getByRole("button", { name: /Cambiar métrica de superficie/i });
    await userEvent.click(btnMetrica);

    const opcionHas = screen.getByRole("button", { name: /Has — Hectáreas/i });
    await userEvent.click(opcionHas);

    await waitFor(() => {
      expect(screen.getByText(/Superficie \(Hectáreas\)/i)).toBeInTheDocument();
      expect(screen.getAllByText(/5,7 Has|5\.7 Has/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("permite editar una parcela existente desde el menú de opciones (3 rayitas) enviando PATCH /api/dashboard/potreros/:id", async () => {
    let capturedPatch = null;

    server.use(
      http.patch("*/api/dashboard/potreros/:id", async ({ params, request }) => {
        capturedPatch = await request.json();
        mockPotreros = mockPotreros.map((p) =>
          p.id === params.id ? { ...p, ...capturedPatch } : p
        );
        return HttpResponse.json({
          ok: true,
          data: mockPotreros.find((p) => p.id === params.id),
        });
      })
    );

    render(<ParcelasView />);

    await waitFor(() => {
      expect(screen.getByText("Parcela 1")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Parcela 1"));

    // Pastura / Cobertura y Estado de Pastura no deben renderizarse; sí Característica
    expect(screen.queryByText(/Pastura \/ Cobertura/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Estado: Óptimo/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Característica$/i)).toBeInTheDocument();

    // Abrir menú de 3 rayitas (Opciones de parcela) con Editar Parcela y Eliminar Parcela
    const btnOpciones = screen.getByRole("button", { name: /Opciones de parcela/i });
    await userEvent.click(btnOpciones);

    expect(screen.getByRole("button", { name: /Eliminar Parcela/i })).toBeInTheDocument();
    const btnEditar = screen.getByRole("button", { name: /Editar Parcela/i });
    await userEvent.click(btnEditar);

    expect(screen.getByText("Editar Parcela Delimitada")).toBeInTheDocument();
    expect(screen.queryByText(/Pastura \/ Cobertura/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Estado de la Pastura/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/^Característica$/i)).toHaveLength(2);

    const inputNombre = screen.getByDisplayValue("Parcela 1");
    await userEvent.clear(inputNombre);
    await userEvent.type(inputNombre, "Potrero La Loma");

    const btnGuardarCambios = screen.getByRole("button", { name: /Guardar Cambios/i });
    await userEvent.click(btnGuardarCambios);

    await waitFor(() => {
      expect(capturedPatch).toBeTruthy();
      expect(capturedPatch.nombre).toBe("Potrero La Loma");
      expect(screen.getAllByText("Potrero La Loma").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("Administrador (oficina) debe solicitar permiso al Dueño antes de agregar o editar una parcela", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      usuario: {
        id: "usr-oficina-1",
        nombre: "Valeria Admin",
        email: "oficina@vakera.com",
        rol: "oficina",
        establecimientoId: "est-el-rancho",
      },
      rol: "oficina",
    });

    let solicitudEnviada = null;

    server.use(
      http.get("*/api/dashboard/potreros", () => {
        return HttpResponse.json({
          ok: true,
          data: [
            {
              id: "pot-1",
              nombre: "Parcela 1",
              superficieHas: 5.7,
              color: "#ea580c",
              coordinates: [[-59.25, -29.14], [-59.24, -29.14], [-59.24, -29.15]],
              totalAnimales: 0,
            },
          ],
        });
      }),
      http.get("*/api/dashboard/ganado", () => {
        return HttpResponse.json({ ok: true, data: [] });
      }),
      http.get("*/api/dashboard/potreros/permisos", () => {
        return HttpResponse.json({
          ok: true,
          data: {
            puedeAgregar: false,
            puedeEditar: false,
            requiereSolicitud: true,
            solicitudActual: solicitudEnviada
              ? { id: "sol-p-1", estado: "PENDIENTE", motivo: solicitudEnviada.motivo }
              : null,
            solicitudesPendientes: [],
          },
        });
      }),
      http.post("*/api/dashboard/potreros/permisos/solicitar", async ({ request }) => {
        solicitudEnviada = await request.json();
        return HttpResponse.json(
          {
            ok: true,
            data: {
              id: "sol-p-1",
              estado: "PENDIENTE",
              accion: solicitudEnviada.accion,
              motivo: solicitudEnviada.motivo,
            },
          },
          { status: 201 }
        );
      })
    );

    render(<ParcelasView />);

    await waitFor(() => {
      expect(
        screen.getByText(/debés solicitar permiso al Dueño \(un permiso por modificación\)/i)
      ).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Trazar Parcela en Mapa/i }));

    const inputMotivo = await screen.findByLabelText("Motivo de permiso para parcelas");
    await userEvent.type(inputMotivo, "Agregar subdivisión sur");
    await userEvent.click(screen.getByRole("button", { name: /Enviar Solicitud al Dueño/i }));

    await waitFor(() => {
      expect(solicitudEnviada).toMatchObject({
        accion: "AGREGAR",
        motivo: "Agregar subdivisión sur",
      });
    });
  });
});
