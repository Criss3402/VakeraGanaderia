import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegistroView from "./RegistroView.jsx";
import * as AuthContextModule from "../../context/AuthContext.jsx";

describe("Vista de Registro de Cuenta (RegistroView.jsx)", () => {
  it("renderiza el formulario con todos los campos esenciales de alta de establecimiento", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ registrarse: vi.fn() });

    render(<RegistroView alIrALogin={vi.fn()} />);

    expect(screen.getByLabelText(/Nombre y apellido completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre del establecimiento/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Registrar Establecimiento/i })).toBeInTheDocument();
  });

  it("valida localmente que las contraseñas coincidan antes de enviar al servidor", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ registrarse: vi.fn() });

    render(<RegistroView alIrALogin={vi.fn()} />);

    // Completar campos requeridos para superar validación HTML
    await userEvent.type(screen.getByLabelText(/Nombre y apellido completo/i), "Test User");
    await userEvent.type(screen.getByLabelText(/Correo electrónico corporativo/i), "test@test.com");
    await userEvent.type(screen.getByLabelText(/Nombre del establecimiento/i), "Mi Campo");
    await userEvent.type(screen.getByLabelText(/^Contraseña/), "password123");
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/i), "diferente999");
    await userEvent.click(screen.getByRole("button", { name: /Registrar Establecimiento/i }));

    await waitFor(() => {
      expect(screen.getByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    });
  });

  it("valida que la contraseña tenga al menos 6 caracteres antes de llamar al servidor", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ registrarse: vi.fn() });

    render(<RegistroView alIrALogin={vi.fn()} />);

    // Necesitamos nombre, email y establecimiento para que el form pase la validación HTML
    await userEvent.type(screen.getByLabelText(/Nombre y apellido completo/i), "Test User");
    await userEvent.type(screen.getByLabelText(/Correo electrónico corporativo/i), "test@test.com");
    await userEvent.type(screen.getByLabelText(/Nombre del establecimiento/i), "Mi Campo");
    await userEvent.type(screen.getByLabelText(/^Contraseña/), "abc");
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/i), "abc");
    await userEvent.click(screen.getByRole("button", { name: /Registrar Establecimiento/i }));

    await waitFor(() => {
      expect(screen.getByText(/al menos 6 caracteres/i)).toBeInTheDocument();
    });
  });

  it("muestra el mensaje de activación pendiente sin exponer el código de 6 dígitos (Regresión R1)", async () => {
    // R1: El código de 6 dígitos nunca debe aparecer en el cliente tras el registro
    const registrarse = vi.fn().mockResolvedValue({
      requiereVerificacion: true,
      email: "usuario@establecimiento.com",
      // El código nunca llega al frontend: solo el email
    });
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ registrarse });

    render(<RegistroView alIrALogin={vi.fn()} alIrAVerificar={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Nombre y apellido/i), "Juan Pérez");
    await userEvent.type(screen.getByLabelText(/Correo electrónico/i), "usuario@establecimiento.com");
    await userEvent.type(screen.getByLabelText(/Nombre del establecimiento/i), "Estancia Santa Ana");
    await userEvent.type(screen.getByLabelText(/^Contraseña/), "password123");
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /Registrar Establecimiento/i }));

    await waitFor(() => {
      expect(screen.getByText(/Correo de activación enviado/i)).toBeInTheDocument();
    });

    // Regresión R1: el código de 6 dígitos nunca debe verse en pantalla
    const contenido = document.body.textContent || "";
    expect(contenido).not.toMatch(/\b\d{6}\b/);

    // El email sí se muestra (confirmación de envío)
    expect(screen.getByText(/usuario@establecimiento\.com/i)).toBeInTheDocument();
  });

  it("muestra el botón 'Ingresar Código de Activación' tras registro con verificación pendiente (sin botón directo de activación)", async () => {
    const registrarse = vi.fn().mockResolvedValue({
      requiereVerificacion: true,
      email: "nuevo@test.com",
    });
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ registrarse });

    render(<RegistroView alIrALogin={vi.fn()} alIrAVerificar={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Nombre y apellido/i), "Pedro Test");
    await userEvent.type(screen.getByLabelText(/Correo electrónico/i), "nuevo@test.com");
    await userEvent.type(screen.getByLabelText(/Nombre del establecimiento/i), "Estancia Test");
    await userEvent.type(screen.getByLabelText(/^Contraseña/), "segura123");
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/i), "segura123");
    await userEvent.click(screen.getByRole("button", { name: /Registrar Establecimiento/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Ingresar Código de Activación/i })
      ).toBeInTheDocument();
    });
  });

  it("muestra el error del servidor cuando el registro falla (HTTP 400 — email ya registrado)", async () => {
    const registrarse = vi.fn().mockRejectedValue(
      Object.assign(new Error("El correo ya está registrado en el sistema"), { status: 400 })
    );
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ registrarse });

    render(<RegistroView alIrALogin={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Nombre y apellido/i), "Ana López");
    await userEvent.type(screen.getByLabelText(/Correo electrónico/i), "existente@test.com");
    await userEvent.type(screen.getByLabelText(/Nombre del establecimiento/i), "El Rancho");
    await userEvent.type(screen.getByLabelText(/^Contraseña/), "clave123");
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/i), "clave123");
    await userEvent.click(screen.getByRole("button", { name: /Registrar Establecimiento/i }));

    await waitFor(() => {
      expect(screen.getByText("El correo ya está registrado en el sistema")).toBeInTheDocument();
    });
  });
});
