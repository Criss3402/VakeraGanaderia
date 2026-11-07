import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RoleGate from "./RoleGate.jsx";
import * as AuthContextModule from "../../context/AuthContext.jsx";

describe("Componente de Control de Acceso por Rol (RoleGate.jsx)", () => {
  it("renderiza fallback (o nada) si el usuario no tiene rol asignado", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ rol: null });

    render(
      <RoleGate fallback={<span>Sin acceso</span>}>
        <button>Acción Sensible</button>
      </RoleGate>
    );

    expect(screen.queryByText("Acción Sensible")).not.toBeInTheDocument();
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("renderiza los hijos si el permiso RBAC granular está concedido al rol", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ rol: "dueno" });

    render(
      <RoleGate permiso="GESTION_USUARIOS_ROLES">
        <button>Crear Usuario</button>
      </RoleGate>
    );

    expect(screen.getByRole("button", { name: "Crear Usuario" })).toBeInTheDocument();
  });

  it("renderiza el fallback si el permiso granular está denegado al rol", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ rol: "peon" });

    render(
      <RoleGate permiso="GESTION_USUARIOS_ROLES" fallback={<p>No autorizado</p>}>
        <button>Crear Usuario</button>
      </RoleGate>
    );

    expect(screen.queryByRole("button", { name: "Crear Usuario" })).not.toBeInTheDocument();
    expect(screen.getByText("No autorizado")).toBeInTheDocument();
  });

  it("renderiza los hijos si el rol está incluido en rolesPermitidos", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ rol: "veterinario" });

    render(
      <RoleGate rolesPermitidos={["veterinario", "dueno"]}>
        <div>Módulo Sanitario Veterinario</div>
      </RoleGate>
    );

    expect(screen.getByText("Módulo Sanitario Veterinario")).toBeInTheDocument();
  });

  it("oculta los hijos y muestra fallback si el rol no coincide con rolesPermitidos", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ rol: "oficina" });

    render(
      <RoleGate rolesPermitidos={["dueno"]}>
        <div>Ajustes Críticos</div>
      </RoleGate>
    );

    expect(screen.queryByText("Ajustes Críticos")).not.toBeInTheDocument();
  });
});

