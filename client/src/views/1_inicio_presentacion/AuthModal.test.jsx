import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthModal from "./AuthModal.jsx";
import * as AuthContextModule from "../../context/AuthContext.jsx";

describe("Modal Emergente de Acceso y Registro (AuthModal.jsx)", () => {
  it("renderiza 'Continuar con Google' en modo login y permite alternar a registro en 2 pasos", async () => {
    const registrarse = vi.fn().mockResolvedValue({
      requiereVerificacion: true,
      email: "nuevo@estancia.com",
    });
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      iniciarSesion: vi.fn(),
      registrarse,
    });

    render(<AuthModal abierto={true} modoInicial="login" alCerrar={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Continuar con Google/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Regístrate$/i }));

    expect(await screen.findByRole("button", { name: /Registrarse con Google/i })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Correo electrónico/i), "nuevo@estancia.com");
    await userEvent.type(screen.getByLabelText(/^Contraseña/i), "secreta123");
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/i), "secreta123");
    await userEvent.click(screen.getByRole("button", { name: /^Continuar$/i }));

    expect(await screen.findByText(/Configurá tu establecimiento/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Nombre y apellido completo/i), "Lucas Campo");
    await userEvent.type(screen.getByLabelText(/Nombre del establecimiento/i), "Estancia Norte");
    await userEvent.click(screen.getByRole("button", { name: /Registrar Establecimiento/i }));

    await waitFor(() => {
      expect(registrarse).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "nuevo@estancia.com",
          nombre: "Lucas Campo",
          establecimiento: "Estancia Norte",
        })
      );
    });
  });

  it("permite completar establecimiento y rol cuando llega desde Google OAuth (google-completar)", async () => {
    const completarRegistroConGoogle = vi.fn().mockResolvedValue({ id: "usr-g-1" });
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      iniciarSesion: vi.fn(),
      registrarse: vi.fn(),
      completarRegistroConGoogle,
    });

    render(
      <AuthModal
        abierto={true}
        modoInicial="google-completar"
        googleSetup={{ setupToken: "tok-setup-1", email: "lucia@gmail.com", nombre: "Lucía" }}
        alCerrar={vi.fn()}
      />
    );

    expect(screen.getByText(/Cuenta verificada con Google \(lucia@gmail\.com\)/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Nombre del establecimiento/i), "Estancia Sol");
    await userEvent.selectOptions(screen.getByLabelText(/Rol inicial de la cuenta/i), "dueno");
    await userEvent.click(screen.getByRole("button", { name: /Finalizar Registro con Google/i }));

    await waitFor(() => {
      expect(completarRegistroConGoogle).toHaveBeenCalledWith(
        expect.objectContaining({
          setupToken: "tok-setup-1",
          nombre: "Lucía",
          establecimiento: "Estancia Sol",
          rol: "dueno",
        })
      );
    });
  });

  it("muestra solo el aviso y el botón 'Registrarse' en modo google-no-registrado y permite pasar a registro", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      iniciarSesion: vi.fn(),
      registrarse: vi.fn(),
      completarRegistroConGoogle: vi.fn(),
    });
    const mensajeError =
      "No se encontró ninguna cuenta vinculada a esta plataforma con este correo. Por favor registrá una cuenta válida.";

    render(
      <AuthModal
        abierto={true}
        modoInicial="google-no-registrado"
        errorInicial={mensajeError}
        alCerrar={vi.fn()}
      />
    );

    expect(screen.getByText(mensajeError)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Correo electrónico/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continuar con Google/i })).not.toBeInTheDocument();

    const btnRegistrarse = screen.getByRole("button", { name: /^Registrarse$/i });
    await userEvent.click(btnRegistrarse);

    expect(screen.getByRole("heading", { name: /Regístrate/i })).toBeInTheDocument();
  });
});
