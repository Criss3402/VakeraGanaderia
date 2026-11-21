import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../test/msw/server.js";
import PrivateHeader from "./PrivateHeader";

describe("Cabecera Privada y Centro de Notificaciones (PrivateHeader.jsx)", () => {
  it("muestra el contador real, abre el panel al hacer clic y permite aprobar solicitudes de parcelas", async () => {
    let notificacionesActuales = [
      {
        id: "perm-parcela-sol-1",
        tipo: "permiso_parcela",
        prioridad: "alta",
        titulo: "Solicitud de permiso en Parcelas",
        descripcion: "Valeria Admin solicita permiso para agregar y editar parcelas.",
        vistaDestino: "parcelas",
        solicitudId: "sol-1",
        requiereAccion: true,
      },
      {
        id: "stock-ins-1",
        tipo: "stock",
        prioridad: "alta",
        titulo: "Stock crítico: Vacuna",
        descripcion: "Disponible: 10 Dosis.",
        vistaDestino: "insumos",
        requiereAccion: false,
      },
    ];
    let payloadRespuesta = null;

    server.use(
      http.get("*/api/dashboard/notificaciones", () => {
        return HttpResponse.json({
          ok: true,
          data: {
            totalNoLeidas: notificacionesActuales.length,
            notificaciones: notificacionesActuales,
          },
        });
      }),
      http.patch("*/api/dashboard/potreros/permisos/sol-1", async ({ request }) => {
        payloadRespuesta = await request.json();
        notificacionesActuales = notificacionesActuales.filter(
          (n) => n.solicitudId !== "sol-1"
        );
        return HttpResponse.json({
          ok: true,
          data: { id: "sol-1", estado: payloadRespuesta.estado },
        });
      })
    );

    const alCambiarVista = vi.fn();
    render(<PrivateHeader alCambiarVista={alCambiarVista} />);

    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Abrir notificaciones/i }));

    expect(await screen.findByText("Solicitud de permiso en Parcelas")).toBeInTheDocument();
    expect(screen.getByText("Stock crítico: Vacuna")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Aprobar$/i }));

    await waitFor(() => {
      expect(payloadRespuesta).toEqual({ estado: "APROBADA" });
    });

    await waitFor(() => {
      expect(screen.queryByText("Solicitud de permiso en Parcelas")).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Stock crítico: Vacuna"));
    expect(alCambiarVista).toHaveBeenCalledWith("insumos");
  });

  it("muestra el clima actual en la barra superior junto a la fecha y hora", async () => {
    server.use(
      http.get("*/api/dashboard/notificaciones", () =>
        HttpResponse.json({ ok: true, data: { totalNoLeidas: 0, notificaciones: [] } })
      ),
      http.get("*/api/dashboard/clima", () =>
        HttpResponse.json({
          ok: true,
          data: {
            ubicacion: "El Rancho, Goya, Corrientes",
            temperatura: 23,
            descripcion: "Cielo despejado",
            iconoFontAwesome: "fa-solid fa-sun text-amber-500",
            humedad: 58,
            vientoKmH: 14,
          },
        })
      )
    );

    render(<PrivateHeader />);

    expect(await screen.findByText("23°C")).toBeInTheDocument();
    expect(screen.getByText("Cielo despejado")).toBeInTheDocument();
  });
});
