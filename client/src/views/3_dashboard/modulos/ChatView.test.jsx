import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/msw/server.js";
import ChatView, { filtrarContactosPermitidos, MATRIZ_CHAT_ROLES } from "./ChatView.jsx";
import * as AuthContextModule from "../../../context/AuthContext.jsx";

describe("Vista de Chat Compartimentado por Rol y Espacio (ChatView.jsx)", () => {
  const todosLosContactosCandidatos = [
    {
      id: "usr-dueno",
      nombre: "Cristian Joaquín",
      rol: "dueno",
      cargo: "Propietario",
      establecimientoId: "est-el-rancho",
      establecimiento: "El Rancho, Goya, Corrientes",
    },
    {
      id: "usr-admin",
      nombre: "Valeria Rossi",
      rol: "oficina",
      cargo: "Administradora",
      establecimientoId: "est-el-rancho",
      establecimiento: "El Rancho, Goya, Corrientes",
    },
    {
      id: "usr-vet",
      nombre: "Dra. Sofía Navarro",
      rol: "veterinario",
      cargo: "Médica Veterinaria",
      establecimientoId: "est-el-rancho",
      establecimiento: "El Rancho, Goya, Corrientes",
    },
    {
      id: "usr-capataz",
      nombre: "Martín Benítez",
      rol: "capataz",
      cargo: "Capataz de Campo",
      establecimientoId: "est-el-rancho",
      establecimiento: "El Rancho, Goya, Corrientes",
    },
    {
      id: "usr-peon",
      nombre: "Lucas Giménez",
      rol: "peon",
      cargo: "Peón Operario",
      establecimientoId: "est-el-rancho",
      establecimiento: "El Rancho, Goya, Corrientes",
    },
    {
      id: "usr-ajeno",
      nombre: "Capataz Otro Campo",
      rol: "capataz",
      cargo: "Capataz Externo",
      establecimientoId: "est-otro-campo",
      establecimiento: "Estancia Ajena",
    },
    {
      id: "usr-sin-campo",
      nombre: "Veterinario Sin Asignar",
      rol: "veterinario",
      cargo: "Veterinario Libre",
      establecimientoId: null,
      establecimiento: null,
    },
  ];

  beforeEach(() => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      rol: "capataz",
      usuario: {
        id: "usr-capataz",
        nombre: "Martín Benítez",
        rol: "capataz",
        establecimientoId: "est-el-rancho",
        establecimiento: "El Rancho, Goya, Corrientes",
      },
    });
  });

  it("aplica la matriz estricta de roles y filtra únicamente agentes del mismo espacio (campo)", () => {
    // 1. PEÓN: solo ve al CAPATAZ de su mismo campo
    const visiblesPeon = filtrarContactosPermitidos(todosLosContactosCandidatos, {
      id: "usr-peon",
      rol: "peon",
      establecimientoId: "est-el-rancho",
    });
    expect(visiblesPeon.map((c) => c.id)).toEqual(["usr-capataz"]);

    // 2. CAPATAZ: ve a ADMINISTRADOR (oficina), PEÓN y VETERINARIO de su campo
    const visiblesCapataz = filtrarContactosPermitidos(todosLosContactosCandidatos, {
      id: "usr-capataz",
      rol: "capataz",
      establecimientoId: "est-el-rancho",
    });
    expect(visiblesCapataz.map((c) => c.id).sort()).toEqual([
      "usr-admin",
      "usr-peon",
      "usr-vet",
    ]);

    // 3. VETERINARIO: ve a DUEÑO, ADMINISTRADOR y CAPATAZ de su campo
    const visiblesVet = filtrarContactosPermitidos(todosLosContactosCandidatos, {
      id: "usr-vet",
      rol: "veterinario",
      establecimientoId: "est-el-rancho",
    });
    expect(visiblesVet.map((c) => c.id).sort()).toEqual([
      "usr-admin",
      "usr-capataz",
      "usr-dueno",
    ]);

    // 4. ADMINISTRADOR: ve a CAPATAZ, VETERINARIO y DUEÑO de su campo
    const visiblesAdmin = filtrarContactosPermitidos(todosLosContactosCandidatos, {
      id: "usr-admin",
      rol: "administrador",
      establecimientoId: "est-el-rancho",
    });
    expect(visiblesAdmin.map((c) => c.id).sort()).toEqual([
      "usr-capataz",
      "usr-dueno",
      "usr-vet",
    ]);

    // 5. DUEÑO: ve a VETERINARIO y ADMINISTRADOR de su campo
    const visiblesDueno = filtrarContactosPermitidos(todosLosContactosCandidatos, {
      id: "usr-dueno",
      rol: "dueno",
      establecimientoId: "est-el-rancho",
    });
    expect(visiblesDueno.map((c) => c.id).sort()).toEqual(["usr-admin", "usr-vet"]);
  });

  it("renderiza la interfaz divisoria con contactos permitidos, abre conversación y envía mensaje", async () => {
    server.use(
      http.get("*/api/chat/contactos", () => {
        return HttpResponse.json({
          ok: true,
          data: {
            usuarioActual: {
              id: "usr-capataz",
              nombre: "Martín Benítez",
              rol: "capataz",
              establecimientoId: "est-el-rancho",
              establecimiento: "El Rancho, Goya, Corrientes",
            },
            rolesPermitidos: MATRIZ_CHAT_ROLES.capataz,
            contactos: [
              todosLosContactosCandidatos[1], // Admin
              todosLosContactosCandidatos[2], // Vet
              todosLosContactosCandidatos[4], // Peón
            ],
            ocultosCount: 0,
          },
        });
      }),
      http.get("*/api/chat/mensajes/usr-peon", () => {
        return HttpResponse.json({
          ok: true,
          data: {
            contacto: todosLosContactosCandidatos[4],
            mensajes: [
              {
                id: "msg-1",
                remitenteId: "usr-peon",
                destinatarioId: "usr-capataz",
                contenido: "Buen día capataz, aguada norte lista.",
                esMio: false,
                leido: true,
                fechaEnvio: "2026-11-15T09:00:00Z",
              },
            ],
          },
        });
      }),
      http.post("*/api/chat/mensajes", async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json(
          {
            ok: true,
            data: {
              id: "msg-2",
              remitenteId: "usr-capataz",
              destinatarioId: body.destinatarioId,
              contenido: body.contenido,
              esMio: true,
              leido: false,
              fechaEnvio: "2026-11-15T09:05:00Z",
            },
          },
          { status: 201 }
        );
      })
    );

    render(<ChatView />);

    // Abrir la ventana flotante haciendo clic en el botón flotante de la esquina inferior derecha
    const btnFlotante = screen.getByRole("button", {
      name: /Abrir o cerrar chat flotante de campo/i,
    });
    await userEvent.click(btnFlotante);

    await waitFor(() => {
      expect(screen.getByText("Lucas Giménez")).toBeInTheDocument();
      expect(screen.getByText("Valeria Rossi")).toBeInTheDocument();
      expect(screen.getByText("Dra. Sofía Navarro")).toBeInTheDocument();
    });

    // Seleccionar al Peón en el panel lateral
    await userEvent.click(screen.getByText("Lucas Giménez"));

    await waitFor(() => {
      expect(
        screen.getByText("Buen día capataz, aguada norte lista.")
      ).toBeInTheDocument();
    });

    // Enviar respuesta desde el panel principal
    const inputMensaje = screen.getByLabelText("Escribir mensaje");
    await userEvent.type(inputMensaje, "Recibido Lucas, gracias.");
    await userEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      expect(screen.getByText("Recibido Lucas, gracias.")).toBeInTheDocument();
    });
  });

  it("permite borrar/ocultar un contacto quitándolo inmediatamente de la vista activa", async () => {
    let deleteLlamadoPara = null;

    server.use(
      http.get("*/api/chat/contactos", () => {
        return HttpResponse.json({
          ok: true,
          data: {
            usuarioActual: {
              id: "usr-capataz",
              nombre: "Martín Benítez",
              rol: "capataz",
              establecimientoId: "est-el-rancho",
              establecimiento: "El Rancho, Goya, Corrientes",
            },
            rolesPermitidos: MATRIZ_CHAT_ROLES.capataz,
            contactos: [
              todosLosContactosCandidatos[1], // Admin
              todosLosContactosCandidatos[4], // Peón
            ],
            ocultosCount: 0,
          },
        });
      }),
      http.delete("*/api/chat/contactos/:contactoId", ({ params }) => {
        deleteLlamadoPara = params.contactoId;
        return HttpResponse.json({
          ok: true,
          mensaje: "El chat con Lucas Giménez ha sido ocultado de tu vista activa.",
          data: { contactoId: params.contactoId, oculto: true },
        });
      })
    );

    render(<ChatView abiertoInicial={true} />);

    await waitFor(() => {
      expect(screen.getByText("Lucas Giménez")).toBeInTheDocument();
    });

    const btnBorrar = screen.getByRole("button", {
      name: /Borrar contacto Lucas Giménez/i,
    });
    await userEvent.click(btnBorrar);

    await waitFor(() => {
      expect(screen.queryByText("Lucas Giménez")).not.toBeInTheDocument();
      expect(deleteLlamadoPara).toBe("usr-peon");
    });

    expect(screen.getByText("Valeria Rossi")).toBeInTheDocument();
  });

  it("permite deshacer el ocultamiento de un contacto con un clic", async () => {
    let restaurarBody = null;
    let ocultado = false;

    server.use(
      http.get("*/api/chat/contactos", () => {
        return HttpResponse.json({
          ok: true,
          data: {
            usuarioActual: {
              id: "usr-capataz",
              nombre: "Martín Benítez",
              rol: "capataz",
              establecimientoId: "est-el-rancho",
              establecimiento: "El Rancho, Goya, Corrientes",
            },
            rolesPermitidos: MATRIZ_CHAT_ROLES.capataz,
            contactos: ocultado
              ? [todosLosContactosCandidatos[1]]
              : [todosLosContactosCandidatos[1], todosLosContactosCandidatos[4]],
            ocultosCount: ocultado ? 1 : 0,
          },
        });
      }),
      http.delete("*/api/chat/contactos/:contactoId", ({ params }) => {
        ocultado = true;
        return HttpResponse.json({
          ok: true,
          mensaje: "El chat con Lucas Giménez ha sido ocultado de tu vista activa.",
          data: { contactoId: params.contactoId, oculto: true },
        });
      }),
      http.post("*/api/chat/contactos/restaurar", async ({ request }) => {
        restaurarBody = await request.json();
        ocultado = false;
        return HttpResponse.json({
          ok: true,
          mensaje: "Contactos restaurados.",
          data: { restaurados: 1 },
        });
      })
    );

    render(<ChatView abiertoInicial={true} />);

    await waitFor(() => {
      expect(screen.getByText("Lucas Giménez")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Borrar contacto Lucas Giménez/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Deshacer/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Deshacer/i }));

    await waitFor(() => {
      expect(restaurarBody).toEqual({ contactoId: "usr-peon" });
      expect(screen.getByText("Lucas Giménez")).toBeInTheDocument();
    });
  });

  it("muestra estado específico al buscar sin coincidencias y permite limpiar el filtro", async () => {
    server.use(
      http.get("*/api/chat/contactos", () => {
        return HttpResponse.json({
          ok: true,
          data: {
            usuarioActual: {
              id: "usr-capataz",
              nombre: "Martín Benítez",
              rol: "capataz",
              establecimientoId: "est-el-rancho",
              establecimiento: "El Rancho, Goya, Corrientes",
            },
            rolesPermitidos: MATRIZ_CHAT_ROLES.capataz,
            contactos: [todosLosContactosCandidatos[1]],
            ocultosCount: 0,
          },
        });
      })
    );

    render(<ChatView abiertoInicial={true} />);

    await waitFor(() => {
      expect(screen.getByText("Valeria Rossi")).toBeInTheDocument();
    });

    const buscador = screen.getByLabelText("Filtrar contactos permitidos");
    await userEvent.type(buscador, "Inexistente");

    expect(screen.getByText("Sin resultados")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Ver todos los contactos" }));

    expect(screen.getByText("Valeria Rossi")).toBeInTheDocument();
  });

  it("ofrece sugerencias iniciales en chats vacíos y envía al presionar Enter", async () => {
    let mensajeEnviado = null;

    server.use(
      http.get("*/api/chat/contactos", () => {
        return HttpResponse.json({
          ok: true,
          data: {
            usuarioActual: {
              id: "usr-capataz",
              nombre: "Martín Benítez",
              rol: "capataz",
              establecimientoId: "est-el-rancho",
              establecimiento: "El Rancho, Goya, Corrientes",
            },
            rolesPermitidos: MATRIZ_CHAT_ROLES.capataz,
            contactos: [todosLosContactosCandidatos[1]],
            ocultosCount: 0,
          },
        });
      }),
      http.get("*/api/chat/mensajes/usr-admin", () => {
        return HttpResponse.json({
          ok: true,
          data: {
            contacto: todosLosContactosCandidatos[1],
            mensajes: [],
          },
        });
      }),
      http.post("*/api/chat/mensajes", async ({ request }) => {
        mensajeEnviado = await request.json();
        return HttpResponse.json(
          {
            ok: true,
            data: {
              id: "msg-nuevo",
              remitenteId: "usr-capataz",
              destinatarioId: mensajeEnviado.destinatarioId,
              contenido: mensajeEnviado.contenido,
              esMio: true,
              leido: false,
              fechaEnvio: new Date().toISOString(),
            },
          },
          { status: 201 }
        );
      })
    );

    render(<ChatView abiertoInicial={true} />);

    await waitFor(() => {
      expect(screen.getByText("Valeria Rossi")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Valeria Rossi"));

    await waitFor(() => {
      expect(screen.getByText("Buen día, ¿cómo viene la jornada?")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Buen día, ¿cómo viene la jornada?"));

    const compositor = screen.getByLabelText("Escribir mensaje");
    expect(compositor).toHaveValue("Buen día, ¿cómo viene la jornada?");

    await userEvent.type(compositor, "{Enter}");

    await waitFor(() => {
      expect(mensajeEnviado).toEqual({
        destinatarioId: "usr-admin",
        contenido: "Buen día, ¿cómo viene la jornada?",
      });
      expect(screen.getByText("Hoy")).toBeInTheDocument();
    });
  });

  it("permite colapsar el panel de contactos para mostrar solo el ícono del usuario y volver a expandirlo", async () => {
    server.use(
      http.get("*/api/chat/contactos", () => {
        return HttpResponse.json({
          ok: true,
          data: {
            usuarioActual: {
              id: "usr-capataz",
              nombre: "Martín Benítez",
              rol: "capataz",
              establecimientoId: "est-el-rancho",
              establecimiento: "El Rancho, Goya, Corrientes",
            },
            rolesPermitidos: MATRIZ_CHAT_ROLES.capataz,
            contactos: [todosLosContactosCandidatos[1]],
            ocultosCount: 0,
          },
        });
      }),
      http.get("*/api/chat/mensajes/usr-admin", () => {
        return HttpResponse.json({
          ok: true,
          data: {
            contacto: todosLosContactosCandidatos[1],
            mensajes: [],
          },
        });
      })
    );

    render(<ChatView abiertoInicial={true} />);

    await waitFor(() => {
      expect(screen.getByText("Valeria Rossi")).toBeInTheDocument();
    });

    const btnColapsar = screen.getByRole("button", { name: "Colapsar lista de contactos" });
    await userEvent.click(btnColapsar);

    expect(screen.queryByLabelText("Filtrar contactos permitidos")).not.toBeInTheDocument();
    expect(screen.queryByText("Valeria Rossi")).not.toBeInTheDocument();
    expect(screen.getByText("VR")).toBeInTheDocument();

    // Seleccionar contacto usando solo el ícono colapsado
    await userEvent.click(
      screen.getByRole("button", { name: /Abrir chat con Valeria Rossi/i })
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Escribir mensaje")).toBeInTheDocument();
    });

    // Expandir nuevamente el panel
    const btnExpandir = screen.getByRole("button", { name: "Expandir lista de contactos" });
    await userEvent.click(btnExpandir);

    expect(screen.getByLabelText("Filtrar contactos permitidos")).toBeInTheDocument();
    expect(screen.getAllByText("Valeria Rossi").length).toBeGreaterThanOrEqual(2);
  });
});
