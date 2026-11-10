import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginView from "./LoginView.jsx";
import * as AuthContextModule from "../../context/AuthContext.jsx";

describe("Vista de Inicio de Sesión (LoginView.jsx)", () => {
  it("renderiza el formulario con los campos de email, contraseña y el botón de submit", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      iniciarSesion: vi.fn(),
    });

    render(<LoginView />);

    expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Iniciar Sesión/i })).toBeInTheDocument();
  });

  it("muestra el mensaje de error cuando iniciarSesion lanza una excepción (HTTP 401)", async () => {
    const iniciarSesion = vi.fn().mockRejectedValue(new Error("Credenciales incorrectas"));
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ iniciarSesion });

    render(<LoginView />);

    await userEvent.type(screen.getByLabelText(/Correo electrónico/i), "user@test.com");
    await userEvent.type(screen.getByLabelText(/Contraseña/i), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /Iniciar Sesión/i }));

    await waitFor(() => {
      expect(screen.getByText("Credenciales incorrectas")).toBeInTheDocument();
    });
  });

  it("muestra el botón de activación cuando el error indica cuenta no verificada (HTTP 403)", async () => {
    const iniciarSesion = vi.fn().mockRejectedValue(
      new Error("Tu cuenta no ha sido activada. Revisá tu correo de verificación.")
    );
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ iniciarSesion });

    const alIrAVerificar = vi.fn();
    render(<LoginView alIrAVerificar={alIrAVerificar} />);

    await userEvent.type(screen.getByLabelText(/Correo electrónico/i), "sinverif@test.com");
    await userEvent.type(screen.getByLabelText(/Contraseña/i), "pass123");
    await userEvent.click(screen.getByRole("button", { name: /Iniciar Sesión/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Activar mi cuenta o reenviar correo/i })
      ).toBeInTheDocument();
    });
  });

  it("muestra el mensaje de error 400 de validación de campos del servidor", async () => {
    const iniciarSesion = vi.fn().mockRejectedValue(
      Object.assign(new Error("El campo email es requerido"), { status: 400 })
    );
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ iniciarSesion });

    render(<LoginView />);
    // Completar campos mínimos para evitar validación HTML nativa
    await userEvent.type(screen.getByLabelText(/Correo electrónico/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/Contraseña/i), "pass123");
    await userEvent.click(screen.getByRole("button", { name: /Iniciar Sesión/i }));

    await waitFor(() => {
      expect(screen.getByText("El campo email es requerido")).toBeInTheDocument();
    });
  });

  it("llama a alIniciarExito después de un login exitoso", async () => {
    const iniciarSesion = vi.fn().mockResolvedValue({ id: 1, rol: "dueno" });
    const alIniciarExito = vi.fn();
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ iniciarSesion });

    render(<LoginView alIniciarExito={alIniciarExito} />);

    await userEvent.type(screen.getByLabelText(/Correo electrónico/i), "dueno@vakera.com");
    await userEvent.type(screen.getByLabelText(/Contraseña/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /Iniciar Sesión/i }));

    await waitFor(() => {
      expect(alIniciarExito).toHaveBeenCalledTimes(1);
    });
  });

  it("navega al registro al hacer clic en el enlace de creación de cuenta", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ iniciarSesion: vi.fn() });
    const alIrARegistro = vi.fn();

    render(<LoginView alIrARegistro={alIrARegistro} />);
    await userEvent.click(screen.getByText(/Registrar nuevo establecimiento/i));

    expect(alIrARegistro).toHaveBeenCalledTimes(1);
  });
});
