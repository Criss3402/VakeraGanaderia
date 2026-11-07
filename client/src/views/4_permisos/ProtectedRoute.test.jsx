import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProtectedRoute from "./ProtectedRoute.jsx";
import * as AuthContextModule from "../../context/AuthContext.jsx";

describe("Componente de Guarda de Ruta (ProtectedRoute.jsx)", () => {
  it("muestra el mensaje de verificación mientras el estado de autenticación está cargando", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      estaAutenticado: false,
      rol: null,
      cargando: true,
    });

    render(
      <ProtectedRoute>
        <div>Contenido Privado</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Verificando credenciales de acceso...")).toBeInTheDocument();
    expect(screen.queryByText("Contenido Privado")).not.toBeInTheDocument();
  });

  it("muestra alerta de acceso denegado y botón de redirección si el usuario no está autenticado", async () => {
    const alIrALogin = vi.fn();
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      estaAutenticado: false,
      rol: null,
      cargando: false,
    });

    render(
      <ProtectedRoute alIrALogin={alIrALogin}>
        <div>Contenido Privado</div>
      </ProtectedRoute>
    );

    expect(screen.getByText(/Debes iniciar sesión para acceder a este módulo/i)).toBeInTheDocument();
    expect(screen.queryByText("Contenido Privado")).not.toBeInTheDocument();

    const boton = screen.getByRole("button", { name: /Ir al Inicio de Sesión/i });
    await userEvent.click(boton);
    expect(alIrALogin).toHaveBeenCalledTimes(1);
  });

  it("bloquea el acceso y muestra advertencia RBAC si el rol del usuario no está autorizado", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      estaAutenticado: true,
      rol: "peon",
      cargando: false,
    });

    render(
      <ProtectedRoute rolesPermitidos={["dueno", "capataz"]}>
        <div>Panel Administrativo</div>
      </ProtectedRoute>
    );

    expect(screen.getByText(/Permiso Insuficiente \(RBAC\)/i)).toBeInTheDocument();
    expect(screen.getByText(/PEON/)).toBeInTheDocument();
    expect(screen.queryByText("Panel Administrativo")).not.toBeInTheDocument();
  });

  it("renderiza el contenido protegido si el rol del usuario coincide con los permitidos", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      estaAutenticado: true,
      rol: "capataz",
      cargando: false,
    });

    render(
      <ProtectedRoute rolesPermitidos={["dueno", "capataz"]}>
        <div>Panel de Operaciones de Campo</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Panel de Operaciones de Campo")).toBeInTheDocument();
    expect(screen.queryByText(/Permiso Insuficiente/i)).not.toBeInTheDocument();
  });

  it("permite el acceso a cualquier usuario autenticado cuando la lista rolesPermitidos está vacía", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      estaAutenticado: true,
      rol: "veterinario",
      cargando: false,
    });

    render(
      <ProtectedRoute rolesPermitidos={[]}>
        <div>Sección Común del Sistema</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Sección Común del Sistema")).toBeInTheDocument();
  });
});

