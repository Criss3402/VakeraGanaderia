import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "./Sidebar.jsx";
import * as AuthContextModule from "../../context/AuthContext.jsx";

describe("Barra Lateral de Navegación (Sidebar.jsx)", () => {
  it("muestra el logo oficial '/logo-vakera.png' con alt='Vakera'", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      usuario: { nombre: "Carlos Dueño", establecimiento: "Estancia Sur" },
      rol: "dueno",
      cerrarSesion: vi.fn(),
    });

    render(<Sidebar vistaActiva="metricas" alCambiarVista={vi.fn()} />);

    const logo = screen.getByRole("img", { name: "Vakera" });
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/logo-vakera.png");
  });

  it("el enlace 'Usuarios y Roles' solo es visible para el rol Dueño", () => {
    // 1. Caso Dueño: visible
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      usuario: { nombre: "Patrón Juan" },
      rol: "dueno",
      cerrarSesion: vi.fn(),
    });

    const { unmount } = render(
      <Sidebar vistaActiva="metricas" alCambiarVista={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /Usuarios y Roles/i })).toBeInTheDocument();
    unmount();

    // 2. Otros roles (capataz, peon, oficina, veterinario): NO visible
    const rolesRestringidos = ["capataz", "peon", "oficina", "veterinario"];
    rolesRestringidos.forEach((rolNoAutorizado) => {
      vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
        usuario: { nombre: "Empleado" },
        rol: rolNoAutorizado,
        cerrarSesion: vi.fn(),
      });

      const { unmount: unmountRestringido } = render(
        <Sidebar vistaActiva="metricas" alCambiarVista={vi.fn()} />
      );
      expect(
        screen.queryByRole("button", { name: /Usuarios y Roles/i })
      ).not.toBeInTheDocument();
      unmountRestringido();
    });
  });

  it("regresión: no existe botón de colapso interno en el header del Sidebar", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      usuario: { nombre: "Carlos Dueño" },
      rol: "dueno",
      cerrarSesion: vi.fn(),
    });

    const { container } = render(
      <Sidebar vistaActiva="metricas" alCambiarVista={vi.fn()} colapsado={false} />
    );

    // Solo debe existir el botón de cerrar menú en mobile (fa-xmark), no botones de colapso interno
    const botonesHeader = container.querySelectorAll(".h-20 button");
    expect(botonesHeader.length).toBe(1); // únicamente el botón mobile
    expect(botonesHeader[0].querySelector(".fa-xmark")).not.toBeNull();
  });

  it("dispara alCambiarVista con el ID del módulo al hacer clic en un enlace", async () => {
    const alCambiarVista = vi.fn();
    const alCerrarMenu = vi.fn();

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      usuario: { nombre: "Carlos Dueño" },
      rol: "dueno",
      cerrarSesion: vi.fn(),
    });

    render(
      <Sidebar
        vistaActiva="metricas"
        alCambiarVista={alCambiarVista}
        alCerrarMenu={alCerrarMenu}
      />
    );

    const botonGanado = screen.getByRole("button", { name: /Ganado/i });
    await userEvent.click(botonGanado);

    expect(alCambiarVista).toHaveBeenCalledWith("ganado");
    expect(alCerrarMenu).toHaveBeenCalled();
  });

  it("despliega el menú de perfil, muestra confirmación centrada '¿Seguro?' con 'Cancelar' y cierra sesión al confirmar", async () => {
    const cerrarSesion = vi.fn();
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      usuario: { nombre: "Cristian Joaquín" },
      rol: "dueno",
      cerrarSesion,
    });

    render(<Sidebar vistaActiva="metricas" alCambiarVista={vi.fn()} />);

    // Clic en la tarjeta de perfil
    const perfilCard = screen.getByTitle("Opciones de cuenta");
    await userEvent.click(perfilCard);

    // Clic en Cerrar Sesión abre el modal de confirmación centrado
    const btnCerrarSesionMenu = screen.getByRole("button", { name: /Cerrar Sesión/i });
    await userEvent.click(btnCerrarSesionMenu);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("¿Seguro?")).toBeInTheDocument();
    const btnCancelar = screen.getByRole("button", { name: /Cancelar/i });
    expect(btnCancelar).toBeInTheDocument();
    expect(cerrarSesion).not.toHaveBeenCalled();

    // Confirmar en el modal ejecuta cerrarSesion
    const botonesConfirmar = screen.getAllByRole("button", { name: /Cerrar Sesión/i });
    await userEvent.click(botonesConfirmar[botonesConfirmar.length - 1]);
    expect(cerrarSesion).toHaveBeenCalledTimes(1);
  });
});

