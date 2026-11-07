import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../test/msw/server.js";
import { AuthProvider, useAuth } from "./AuthContext.jsx";

describe("Contexto de Autenticación (AuthContext.jsx)", () => {
  it("useAuth lanza un error descriptivo cuando se invoca fuera de AuthProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow("useAuth debe ser utilizado dentro de un AuthProvider");
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("hidrata inmediatamente el usuario desde la caché de localStorage (Stale-While-Revalidate)", async () => {
    const usuarioMock = { id: 10, nombre: "Juan Dueño", rol: "dueno", email: "dueno@vakera.test" };
    localStorage.setItem("vakera_token", "jwt-token-valido");
    localStorage.setItem("vakera_usuario_cache", JSON.stringify(usuarioMock));

    // MSW responde con datos actualizados en segundo plano
    server.use(
      http.get("*/api/auth/me", () => {
        return HttpResponse.json({
          ok: true,
          data: { usuario: { ...usuarioMock, nombre: "Juan Dueño Actualizado" } },
        });
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    // Inmediatamente (sincrónico): hidratado desde caché sin bloquear UI
    expect(result.current.cargando).toBe(false);
    expect(result.current.usuario.nombre).toBe("Juan Dueño");
    expect(result.current.rol).toBe("dueno");
    expect(result.current.estaAutenticado).toBe(true);

    // Tras resolver /me: se actualiza con datos del servidor
    await waitFor(() => {
      expect(result.current.usuario.nombre).toBe("Juan Dueño Actualizado");
    });
  });

  it("si /me retorna 401 Unauthorized, ejecuta logout y purga el almacenamiento local", async () => {
    localStorage.setItem("vakera_token", "token-expirado");
    localStorage.setItem(
      "vakera_usuario_cache",
      JSON.stringify({ id: 1, email: "expirado@vakera.test" })
    );

    server.use(
      http.get("*/api/auth/me", () => {
        return HttpResponse.json(
          { ok: false, error: "Token inválido o expirado" },
          { status: 401 }
        );
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });

    expect(result.current.estaAutenticado).toBe(false);
    expect(result.current.usuario).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem("vakera_token")).toBeNull();
    expect(localStorage.getItem("vakera_usuario_cache")).toBeNull();
  });

  it("si /me sufre un error de red, ejecuta logout preventivo y limpia estado", async () => {
    localStorage.setItem("vakera_token", "token-red");
    localStorage.setItem(
      "vakera_usuario_cache",
      JSON.stringify({ id: 2, email: "red@vakera.test" })
    );

    server.use(
      http.get("*/api/auth/me", () => {
        return HttpResponse.error();
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });

    expect(result.current.estaAutenticado).toBe(false);
    expect(result.current.usuario).toBeNull();
    expect(localStorage.getItem("vakera_token")).toBeNull();
    expect(localStorage.getItem("vakera_usuario_cache")).toBeNull();
  });

  it("iniciarSesion lanza error si el backend retorna una respuesta inválida sin usuario", async () => {
    server.use(
      http.post("*/api/auth/login", () => {
        return HttpResponse.json({ ok: true, data: { mensaje: "Sin usuario" } });
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await expect(
      result.current.iniciarSesion("test@vakera.test", "pass123")
    ).rejects.toThrow("Respuesta inválida del servidor");

    expect(result.current.estaAutenticado).toBe(false);
  });

  it("iniciarSesion exitoso actualiza estado, persiste en caché y entrega usuario", async () => {
    const usuarioValido = { id: 5, nombre: "Capataz Pedro", rol: "capataz", email: "pedro@vakera.test" };

    server.use(
      http.post("*/api/auth/login", () => {
        return HttpResponse.json({
          ok: true,
          data: { token: "jwt-nuevo-sesion", usuario: usuarioValido },
        });
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    let usuarioRetornado;
    await act(async () => {
      usuarioRetornado = await result.current.iniciarSesion("pedro@vakera.test", "secreto123");
    });

    expect(usuarioRetornado).toEqual(usuarioValido);
    expect(result.current.usuario).toEqual(usuarioValido);
    expect(result.current.rol).toBe("capataz");
    expect(result.current.estaAutenticado).toBe(true);
    expect(localStorage.getItem("vakera_token")).toBe("jwt-nuevo-sesion");
    expect(JSON.parse(localStorage.getItem("vakera_usuario_cache"))).toEqual(usuarioValido);
  });

  it("cerrarSesion limpia el token, usuario, caché de localStorage y restablece estado", async () => {
    const usuarioMock = { id: 7, rol: "peon", nombre: "Carlos Peon" };
    localStorage.setItem("vakera_token", "jwt-peon");
    localStorage.setItem("vakera_usuario_cache", JSON.stringify(usuarioMock));

    server.use(
      http.get("*/api/auth/me", () => {
        return HttpResponse.json({ ok: true, data: { usuario: usuarioMock } });
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.estaAutenticado).toBe(true);
    });

    act(() => {
      result.current.cerrarSesion();
    });

    expect(result.current.estaAutenticado).toBe(false);
    expect(result.current.usuario).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.rol).toBeNull();
    expect(localStorage.getItem("vakera_token")).toBeNull();
    expect(localStorage.getItem("vakera_usuario_cache")).toBeNull();
  });
});
