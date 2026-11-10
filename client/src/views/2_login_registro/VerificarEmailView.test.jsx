import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../test/msw/server.js";
import VerificarEmailView from "./VerificarEmailView.jsx";
import * as AuthContextModule from "../../context/AuthContext.jsx";

describe("Vista de Verificación de Email (VerificarEmailView.jsx)", () => {
  it("renderiza el formulario con el campo de código de 6 dígitos y botón de activación", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      verificarEmailConToken: vi.fn(),
    });

    render(<VerificarEmailView alIrALogin={vi.fn()} />);

    expect(screen.getByLabelText(/Código de 6 dígitos/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Activar Mi Cuenta/i })).toBeInTheDocument();
  });

  it("muestra la confirmación de cuenta verificada cuando el token es válido", async () => {
    const verificarEmailConToken = vi.fn().mockResolvedValue({ data: { usuario: { id: 1 } } });
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ verificarEmailConToken });

    render(<VerificarEmailView alIrALogin={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Código de 6 dígitos/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: /Activar Mi Cuenta/i }));

    await waitFor(() => {
      expect(screen.getByText(/¡Cuenta Verificada!/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Acceder al Sistema/i })).toBeInTheDocument();
  });

  it("muestra error cuando el token es inválido o ya fue usado (HTTP 400 — código incorrecto)", async () => {
    const verificarEmailConToken = vi.fn().mockRejectedValue(
      Object.assign(new Error("El código de verificación es incorrecto o ya fue utilizado"), {
        status: 400,
      })
    );
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ verificarEmailConToken });

    render(<VerificarEmailView alIrALogin={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Código de 6 dígitos/i), "999999");
    await userEvent.click(screen.getByRole("button", { name: /Activar Mi Cuenta/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/El código de verificación es incorrecto o ya fue utilizado/i)
      ).toBeInTheDocument();
    });
  });

  it("muestra error 403 — cuenta ya verificada o sin autorización para esta acción", async () => {
    const verificarEmailConToken = vi.fn().mockRejectedValue(
      Object.assign(new Error("Esta cuenta ya fue verificada anteriormente"), { status: 403 })
    );
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ verificarEmailConToken });

    render(<VerificarEmailView alIrALogin={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Código de 6 dígitos/i), "111111");
    await userEvent.click(screen.getByRole("button", { name: /Activar Mi Cuenta/i }));

    await waitFor(() => {
      expect(screen.getByText(/Esta cuenta ya fue verificada/i)).toBeInTheDocument();
    });
  });

  it("envía reenvío de verificación con el email ingresado y muestra mensaje de éxito via MSW", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      verificarEmailConToken: vi.fn().mockRejectedValue(new Error("sin token")),
    });

    server.use(
      http.post("*/api/auth/reenviar-verificacion", async ({ request }) => {
        const body = await request.json();
        expect(body.email).toBe("usuario@test.com");
        return HttpResponse.json({
          ok: true,
          mensaje: "Código de activación reenviado correctamente",
        });
      })
    );

    render(<VerificarEmailView alIrALogin={vi.fn()} emailInicial="usuario@test.com" />);

    // Busca el botón Reenviar (dentro del formulario de reenvío)
    const botonReenviar = await screen.findByRole("button", { name: /Reenviar/i });
    await userEvent.click(botonReenviar);

    await waitFor(() => {
      expect(screen.getByText(/Código de activación reenviado correctamente/i)).toBeInTheDocument();
    });
  });

  it("muestra error al intentar reenviar sin ingresar email", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      verificarEmailConToken: vi.fn(),
    });

    render(<VerificarEmailView alIrALogin={vi.fn()} />);

    const botonReenviar = screen.getByRole("button", { name: /Reenviar/i });
    await userEvent.click(botonReenviar);

    await waitFor(() => {
      expect(screen.getByText(/Ingresá tu correo para reenviar la activación/i)).toBeInTheDocument();
    });
  });
});

