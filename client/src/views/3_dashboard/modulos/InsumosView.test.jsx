import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/msw/server.js";
import InsumosView from "./InsumosView.jsx";
import * as AuthContextModule from "../../../context/AuthContext.jsx";

describe("Vista de Inventario e Insumos (InsumosView.jsx)", () => {
  const mockInsumos = [
    {
      id: "ins-1",
      nombre: "Vacuna Antiaftosa",
      categoria: "Fármaco",
      stockActual: 50,
      stockMinimo: 20,
      unidad: "Dosis",
      campo: "Campo Principal",
      ubicacion: "Heladera Veterinaria",
      requiereReposicion: false,
      icono: "fa-syringe",
    },
    {
      id: "ins-2",
      nombre: "Alambre 17/15",
      categoria: "Herramientas",
      stockActual: 2,
      stockMinimo: 5,
      unidad: "Rollos",
      campo: "Campo Principal",
      ubicacion: "Galpón 1",
      requiereReposicion: true,
      icono: "fa-screwdriver-wrench",
    },
  ];

  beforeEach(() => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      rol: "dueno",
      usuario: { id: "usr-1", establecimientoId: "est-test", email: "dueno@test.com" },
    });

    server.use(
      http.get("*/api/dashboard/insumos", () => {
        return HttpResponse.json({ ok: true, data: mockInsumos });
      }),
      http.get("*/api/dashboard/insumos/solicitudes", () => {
        return HttpResponse.json({ ok: true, data: [] });
      }),
      http.get("*/api/dashboard/potreros", () => {
        return HttpResponse.json({ ok: true, data: [] });
      })
    );
  });

  it("renderiza el inventario con los productos cargados y contadores de stock", async () => {
    render(<InsumosView />);

    await waitFor(() => {
      expect(screen.getByText("Vacuna Antiaftosa")).toBeInTheDocument();
      expect(screen.getByText("Alambre 17/15")).toBeInTheDocument();
    });

    expect(screen.getByText(/2 Productos/i)).toBeInTheDocument();
  });

  it("alterna correctamente entre vista de Tarjetas y vista de Lista", async () => {
    render(<InsumosView />);

    await waitFor(() => {
      expect(screen.getByText("Vacuna Antiaftosa")).toBeInTheDocument();
    });

    // Cambiar a vista de Lista
    const btnLista = screen.getByRole("button", { name: /Lista/i });
    await userEvent.click(btnLista);

    // En vista lista debe haber un elemento table
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Producto / Herramienta")).toBeInTheDocument();

    // Cambiar nuevamente a vista de Tarjetas
    const btnTarjetas = screen.getByRole("button", { name: /Tarjetas/i });
    await userEvent.click(btnTarjetas);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("checkbox 'Marcar todos' selecciona todos los insumos y permite desmarcarlos", async () => {
    render(<InsumosView />);

    await waitFor(() => {
      expect(screen.getByText("Vacuna Antiaftosa")).toBeInTheDocument();
    });

    const checkboxMarcarTodos = screen.getByLabelText(/Marcar todos/i);
    await userEvent.click(checkboxMarcarTodos);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Eliminar Marcados \(2\)/i })
      ).toBeInTheDocument();
    });

    // Desmarcar todos
    await userEvent.click(checkboxMarcarTodos);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Eliminar Marcados/i })
      ).not.toBeInTheDocument();
    });
  });

  it("eliminación masiva abre modal y ejecuta 1 request con los ids seleccionados", async () => {
    let capturedBody = null;
    let requestsCount = 0;

    server.use(
      http.post("*/api/dashboard/insumos/eliminar-masivo", async ({ request }) => {
        requestsCount++;
        capturedBody = await request.json();
        return HttpResponse.json({
          ok: true,
          data: { eliminados: capturedBody.ids.length },
        });
      })
    );

    render(<InsumosView />);

    await waitFor(() => {
      expect(screen.getByText("Vacuna Antiaftosa")).toBeInTheDocument();
    });

    const checkboxMarcarTodos = screen.getByLabelText(/Marcar todos/i);
    await userEvent.click(checkboxMarcarTodos);

    const btnEliminarMarcados = await screen.findByRole("button", {
      name: /Eliminar Marcados \(2\)/i,
    });
    await userEvent.click(btnEliminarMarcados);

    // Modal de confirmación abierto
    expect(
      screen.getByText(/Eliminar 2 Artículos Marcados/i)
    ).toBeInTheDocument();

    const btnConfirmar = screen.getByRole("button", {
      name: /Confirmar Eliminación/i,
    });
    await userEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(requestsCount).toBe(1);
      expect(capturedBody).toEqual({ ids: ["ins-1", "ins-2"] });
    });
  });

  it("modal de gestión de locaciones permite editar una locación enviando la acción correspondiente", async () => {
    let capturedBody = null;

    server.use(
      http.patch("*/api/dashboard/insumos/locaciones", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          ok: true,
          data: { locacion: capturedBody.nuevoNombre },
        });
      })
    );

    render(<InsumosView />);

    await waitFor(() => {
      expect(screen.getByText("Vacuna Antiaftosa")).toBeInTheDocument();
    });

    // Abrir modal de gestión de locaciones
    const btnGestionar = screen.getByRole("button", { name: /Editar \/ Eliminar/i });
    await userEvent.click(btnGestionar);

    expect(
      screen.getByText("Gestionar Locaciones / Campos")
    ).toBeInTheDocument();

    // Clic en editar en la fila de Campo Principal
    const btnEditarLocacion = screen.getByTitle("Editar nombre de locación");
    await userEvent.click(btnEditarLocacion);

    // Input para nuevo nombre
    const inputEdicion = screen.getByDisplayValue("Campo Principal");
    await userEvent.clear(inputEdicion);
    await userEvent.type(inputEdicion, "Campo El Ceibo");

    const btnGuardar = screen.getByRole("button", { name: "Guardar" });
    await userEvent.click(btnGuardar);

    await waitFor(() => {
      expect(capturedBody).toEqual({
        nombreAnterior: "Campo Principal",
        nuevoNombre: "Campo El Ceibo",
        accion: "editar",
      });
    });
  });

  it("modal de gestión de locaciones permite eliminar una locación reasignando destino", async () => {
    let capturedBody = null;

    server.use(
      http.patch("*/api/dashboard/insumos/locaciones", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ok: true, data: { status: "eliminada" } });
      })
    );

    render(<InsumosView />);

    await waitFor(() => {
      expect(screen.getByText("Vacuna Antiaftosa")).toBeInTheDocument();
    });

    const btnGestionar = screen.getByRole("button", { name: /Editar \/ Eliminar/i });
    await userEvent.click(btnGestionar);

    const btnEliminarLocacion = screen.getByTitle("Eliminar locación");
    await userEvent.click(btnEliminarLocacion);

    // Confirmación en el modal
    expect(
      screen.getByText(/¿Eliminar locación/i)
    ).toBeInTheDocument();

    const btnSiEliminar = screen.getByRole("button", { name: /Sí, eliminar/i });
    await userEvent.click(btnSiEliminar);

    await waitFor(() => {
      expect(capturedBody).toEqual({
        nombreAnterior: "Campo Principal",
        nuevoNombre: expect.any(String),
        accion: "eliminar",
      });
    });
  });

  it("las locaciones se aíslan por cuenta de usuario en localStorage", async () => {
    localStorage.setItem(
      "vakera_locaciones_est-alfa",
      JSON.stringify(["Estancia Alfa 1", "Estancia Alfa 2"])
    );

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      rol: "dueno",
      usuario: { id: "usr-alfa", establecimientoId: "est-alfa" },
    });

    render(<InsumosView />);

    await waitFor(() => {
      expect(screen.getByText("Estancia Alfa 1")).toBeInTheDocument();
      expect(screen.getByText("Estancia Alfa 2")).toBeInTheDocument();
    });

    // Verificar que est-beta tiene clave separada
    expect(localStorage.getItem("vakera_locaciones_est-beta")).toBeNull();
  });

  it("usuario con rol peón no visualiza el botón '+ Añadir Producto'", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      rol: "peon",
      usuario: { id: "usr-peon", establecimientoId: "est-test" },
    });

    render(<InsumosView />);

    await waitFor(() => {
      expect(screen.getByText("Vacuna Antiaftosa")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /\+ Añadir Producto/i })
    ).not.toBeInTheDocument();
  });

  it("sincroniza automáticamente las parcelas delimitadas con las locaciones de insumos permitiendo además agregar manuales", async () => {
    server.use(
      http.get("*/api/dashboard/potreros", () => {
        return HttpResponse.json({
          ok: true,
          data: [
            { id: "pot-custom-1", nombre: "Parcela Norte - Goya", superficieHas: 120 },
            { id: "pot-custom-2", nombre: "Lote Sur Aguada", superficieHas: 85 },
          ],
        });
      })
    );

    render(<InsumosView />);

    await waitFor(() => {
      expect(screen.getByText("Parcela Norte - Goya")).toBeInTheDocument();
      expect(screen.getByText("Lote Sur Aguada")).toBeInTheDocument();
    });

    // Abrir modal de gestión de locaciones y verificar que figura como parcela sincronizada y permite agregar manual
    const btnGestionar = screen.getByRole("button", { name: /Editar \/ Eliminar/i });
    await userEvent.click(btnGestionar);

    expect(screen.getAllByText(/Parcela sincronizada/i).length).toBeGreaterThanOrEqual(2);

    const inputNueva = screen.getByPlaceholderText(/Nueva locación/i);
    await userEvent.type(inputNueva, "Galpón Manual Auxiliar");
    const btnAgregar = screen.getByRole("button", { name: /Agregar/i });
    await userEvent.click(btnAgregar);

    await waitFor(() => {
      expect(screen.getAllByText("Galpón Manual Auxiliar").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("en Solicitudes de Reposición permite denegar, marcar todas y eliminar en lote", async () => {
    let mockSolicitudes = [
      {
        id: "sol-1",
        insumoNombre: "Rollo de Alambre Alta Resistencia 1000m",
        cantidad: 2,
        unidad: "Rollos",
        solicitanteNombre: "Lucas Giménez",
        solicitanteRol: "peon",
        fecha: "2026-10-09",
        sector: "Pertenencias de Peón",
        motivo: "Reparación de alambrado",
        estado: "Pendiente",
      },
      {
        id: "sol-2",
        insumoNombre: "Vacuna Antiaftosa Bivalente",
        cantidad: 50,
        unidad: "Dosis",
        solicitanteNombre: "Dra. Sofía Navarro",
        solicitanteRol: "veterinario",
        fecha: "2026-10-08",
        sector: "Botiquín Veterinario",
        motivo: "Campaña oficial",
        estado: "Aprobado",
      },
    ];
    let estadoEnviado = null;
    let idsMasivo = null;

    server.use(
      http.get("*/api/dashboard/insumos/solicitudes", () => {
        return HttpResponse.json({ ok: true, data: mockSolicitudes });
      }),
      http.patch("*/api/dashboard/insumos/solicitudes/:id/estado", async ({ params, request }) => {
        const body = await request.json();
        estadoEnviado = body.estado;
        mockSolicitudes = mockSolicitudes.map((s) =>
          s.id === params.id ? { ...s, estado: body.estado } : s
        );
        return HttpResponse.json({ ok: true, data: { id: params.id, estado: body.estado } });
      }),
      http.post("*/api/dashboard/insumos/solicitudes/eliminar-masivo", async ({ request }) => {
        const body = await request.json();
        idsMasivo = body.ids;
        mockSolicitudes = mockSolicitudes.filter((s) => !idsMasivo.includes(s.id));
        return HttpResponse.json({ ok: true, data: { count: idsMasivo.length, ids: idsMasivo } });
      })
    );

    render(<InsumosView />);

    await waitFor(() => {
      expect(screen.getByText("Vacuna Antiaftosa")).toBeInTheDocument();
    });

    const tabSolicitudes = screen.getByRole("button", { name: /Solicitudes de Reposición/i });
    await userEvent.click(tabSolicitudes);

    await waitFor(() => {
      expect(screen.getByText("Rollo de Alambre Alta Resistencia 1000m")).toBeInTheDocument();
    });

    // Denegar la primera solicitud
    const botonesDenegar = screen.getAllByRole("button", { name: /^Denegar$/i });
    await userEvent.click(botonesDenegar[0]);

    await waitFor(() => {
      expect(estadoEnviado).toBe("Denegado");
      expect(screen.getByText(/✕ Denegado/i)).toBeInTheDocument();
    });

    // Marcar todas y eliminar en lote
    const checkTodas = screen.getByLabelText(/Marcar todas/i);
    await userEvent.click(checkTodas);

    const btnEliminarMarcadas = await screen.findByRole("button", {
      name: /Eliminar Marcadas \(2\)/i,
    });
    await userEvent.click(btnEliminarMarcadas);

    expect(screen.getByText(/Eliminar 2 Solicitudes Marcadas/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Confirmar Eliminación/i }));

    await waitFor(() => {
      expect(idsMasivo).toEqual(["sol-1", "sol-2"]);
      expect(screen.queryByText("Rollo de Alambre Alta Resistencia 1000m")).not.toBeInTheDocument();
      expect(screen.queryByText("Vacuna Antiaftosa Bivalente")).not.toBeInTheDocument();
    });
  });
});
