const prisma = require("../config/prisma");
const db = require("../config/db");
const UsuarioModel = require("./usuario.model");
const { ROLES } = require("../utils/roles.constants");

/**
 * Normaliza cualquier variante o alias de rol al identificador canónico en minúsculas.
 * En Vakera, el rol ADMINISTRADOR corresponde a ROLES.OFICINA ("oficina"),
 * aceptando también "administrador" o "admin" como alias directos.
 */
function normalizarRolChat(rol) {
  const limpio = String(rol || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (limpio === "administrador" || limpio === "admin" || limpio === "oficina") {
    return ROLES.OFICINA;
  }
  if (limpio === "dueno") return ROLES.DUENO;
  if (limpio === "capataz") return ROLES.CAPATAZ;
  if (limpio === "peon") return ROLES.PEON;
  if (limpio === "veterinario") return ROLES.VETERINARIO;
  return limpio;
}

/**
 * Etiquetas descriptivas de rol para el módulo de Chat Compartimentado
 */
const ETIQUETAS_ROL_CHAT = {
  [ROLES.PEON]: "Peón",
  [ROLES.CAPATAZ]: "Capataz",
  [ROLES.VETERINARIO]: "Veterinario",
  [ROLES.OFICINA]: "Administrador",
  [ROLES.DUENO]: "Dueño",
};

/**
 * MATRIZ DE PERMISOS DE CHAT POR ROL DE ESTANCIA:
 * - PEÓN: Chat directo con CAPATAZ; requiere solicitud aprobada para chatear con ADMINISTRADOR y DUEÑO.
 * - CAPATAZ: Puede chatear con el ADMINISTRADOR (oficina), con los PEONES a su cargo, y con el VETERINARIO.
 * - VETERINARIO: Puede chatear con el DUEÑO, el ADMINISTRADOR (oficina) y el CAPATAZ.
 * - ADMINISTRADOR (oficina): Puede chatear con CAPATAZ, VETERINARIO, DUEÑO y PEÓN.
 * - DUEÑO: Puede chatear con VETERINARIO, ADMINISTRADOR (oficina) y PEÓN.
 */
const MATRIZ_CHAT_ROLES = {
  [ROLES.PEON]: [ROLES.CAPATAZ],
  [ROLES.CAPATAZ]: [ROLES.OFICINA, ROLES.PEON, ROLES.VETERINARIO],
  [ROLES.VETERINARIO]: [ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ],
  [ROLES.OFICINA]: [ROLES.CAPATAZ, ROLES.VETERINARIO, ROLES.DUENO, ROLES.PEON],
  [ROLES.DUENO]: [ROLES.VETERINARIO, ROLES.OFICINA, ROLES.PEON],
};

/**
 * Roles con los que un usuario puede abrir ficha para enviar solicitud de chat
 * (el mensaje saliente queda habilitado una vez que el destinatario aprueba).
 */
const MATRIZ_SOLICITUD_CHAT_ROLES = {
  [ROLES.PEON]: [ROLES.OFICINA, ROLES.DUENO],
};

class ChatModel {
  static normalizarRol(rol) {
    return normalizarRolChat(rol);
  }

  static obtenerRolesPermitidos(rolUsuario) {
    const rolNorm = normalizarRolChat(rolUsuario);
    return MATRIZ_CHAT_ROLES[rolNorm] || [];
  }

  static obtenerRolesConSolicitud(rolUsuario) {
    const rolNorm = normalizarRolChat(rolUsuario);
    return MATRIZ_SOLICITUD_CHAT_ROLES[rolNorm] || [];
  }

  static obtenerEtiquetaRol(rol) {
    const rolNorm = normalizarRolChat(rol);
    return ETIQUETAS_ROL_CHAT[rolNorm] || String(rol || "").toUpperCase();
  }

  static requiereSolicitudParaEnviar(rolUsuarioA, rolUsuarioB) {
    const rolA = normalizarRolChat(rolUsuarioA);
    const rolB = normalizarRolChat(rolUsuarioB);
    return (MATRIZ_SOLICITUD_CHAT_ROLES[rolA] || []).includes(rolB);
  }

  static puedenChatear(rolUsuarioA, rolUsuarioB) {
    const rolA = normalizarRolChat(rolUsuarioA);
    const rolB = normalizarRolChat(rolUsuarioB);
    const permitidosParaA = MATRIZ_CHAT_ROLES[rolA] || [];
    const permitidosParaB = MATRIZ_CHAT_ROLES[rolB] || [];
    return permitidosParaA.includes(rolB) && permitidosParaB.includes(rolA);
  }

  static puedenVisibilizarContacto(rolUsuarioA, rolUsuarioB) {
    const rolA = normalizarRolChat(rolUsuarioA);
    const rolB = normalizarRolChat(rolUsuarioB);
    const permitidosDirectos = MATRIZ_CHAT_ROLES[rolA] || [];
    const conSolicitud = MATRIZ_SOLICITUD_CHAT_ROLES[rolA] || [];
    return permitidosDirectos.includes(rolB) || conSolicitud.includes(rolB);
  }

  /**
   * Obtiene el conjunto de IDs de contactos ocultos para un usuario dentro de su establecimiento.
   */
  static async _obtenerIdsContactosOcultos(usuarioId, establecimientoId) {
    if (!usuarioId || !establecimientoId) return new Set();
    try {
      if (!prisma.chatContactoOculto) {
        throw new Error("Modelo ChatContactoOculto no inicializado en cliente Prisma");
      }
      const registros = await prisma.chatContactoOculto.findMany({
        where: { usuarioId, establecimientoId },
        select: { contactoId: true },
      });
      return new Set(registros.map((r) => r.contactoId));
    } catch (err) {
      console.warn("[ChatModel._obtenerIdsContactosOcultos] Usando fallback en memoria:", err.message);
      const ocultosMemoria = (db.chatContactosOcultos || []).filter(
        (o) => o.usuarioId === usuarioId && o.establecimientoId === establecimientoId
      );
      return new Set(ocultosMemoria.map((o) => o.contactoId));
    }
  }

  /**
   * Obtiene todos los mensajes de un establecimiento involucrando al usuario actual.
   */
  static async _obtenerMensajesUsuarioEnCampo(usuarioId, establecimientoId) {
    if (!usuarioId || !establecimientoId) return [];
    try {
      if (!prisma.mensajeChat) {
        throw new Error("Modelo MensajeChat no inicializado en cliente Prisma");
      }
      const mensajes = await prisma.mensajeChat.findMany({
        where: {
          establecimientoId,
          OR: [{ remitenteId: usuarioId }, { destinatarioId: usuarioId }],
        },
        orderBy: { fechaEnvio: "asc" },
      });
      return mensajes.map((m) => ({
        id: m.id,
        remitenteId: m.remitenteId,
        destinatarioId: m.destinatarioId,
        establecimientoId: m.establecimientoId,
        contenido: m.contenido,
        leido: Boolean(m.leido),
        fechaEnvio: m.fechaEnvio instanceof Date ? m.fechaEnvio.toISOString() : m.fechaEnvio,
      }));
    } catch (err) {
      console.warn("[ChatModel._obtenerMensajesUsuarioEnCampo] Usando fallback en memoria:", err.message);
      return (db.mensajesChat || [])
        .filter(
          (m) =>
            m.establecimientoId === establecimientoId &&
            (m.remitenteId === usuarioId || m.destinatarioId === usuarioId)
        )
        .sort((a, b) => new Date(a.fechaEnvio).getTime() - new Date(b.fechaEnvio).getTime());
    }
  }

  /**
   * Verifica si existe al menos un mensaje enviado por `remitenteId` hacia `destinatarioId`
   * dentro del mismo establecimiento. Se utiliza para habilitar al Peón a responder cuando
   * un superior (Dueño o Administración) le escribe, incluso si una solicitud previa fue rechazada.
   */
  static async _existeMensajeDe(remitenteId, destinatarioId, establecimientoId) {
    if (!remitenteId || !destinatarioId || !establecimientoId) return false;
    try {
      if (!prisma.mensajeChat) {
        throw new Error("Modelo MensajeChat no inicializado en cliente Prisma");
      }
      const encontrado = await prisma.mensajeChat.findFirst({
        where: {
          establecimientoId,
          remitenteId,
          destinatarioId,
        },
        select: { id: true },
      });
      return Boolean(encontrado);
    } catch (err) {
      console.warn("[ChatModel._existeMensajeDe] Usando fallback en memoria:", err.message);
      return (db.mensajesChat || []).some(
        (m) =>
          m.establecimientoId === establecimientoId &&
          m.remitenteId === remitenteId &&
          m.destinatarioId === destinatarioId
      );
    }
  }

  /**
   * Evalúa el rol y establecimiento del usuario logueado en la base de datos y retorna
   * exclusivamente los contactos registrados en el mismo espacio (campo) cuyos roles
   * estén autorizados por la matriz de permisos y que no hayan sido ocultados.
   */
  static async listarContactosPermitidos(usuarioId) {
    const usuarioActual = await UsuarioModel.buscarPorId(usuarioId);
    if (!usuarioActual) {
      const err = new Error("Usuario autenticado no encontrado en la base de datos.");
      err.status = 404;
      throw err;
    }

    const rolActual = normalizarRolChat(usuarioActual.rol);
    const rolesPermitidos = this.obtenerRolesPermitidos(rolActual);
    const rolesConSolicitud = this.obtenerRolesConSolicitud(rolActual);
    const rolesVisiblesTotal = Array.from(new Set([...rolesPermitidos, ...rolesConSolicitud]));
    const establecimientoId = usuarioActual.establecimientoId || null;
    const establecimientoNombre = usuarioActual.establecimiento || "Sin establecimiento asignado";

    // Si el usuario no pertenece a ningún espacio/campo registrado, no puede ver contactos
    if (!establecimientoId) {
      return {
        usuarioActual: {
          id: usuarioActual.id,
          nombre: usuarioActual.nombre,
          rol: rolActual,
          rolEtiqueta: this.obtenerEtiquetaRol(rolActual),
          establecimientoId: null,
          establecimiento: establecimientoNombre,
        },
        rolesPermitidos,
        rolesPermitidosEtiquetas: rolesPermitidos.map((r) => this.obtenerEtiquetaRol(r)),
        rolesConSolicitud,
        rolesConSolicitudEtiquetas: rolesConSolicitud.map((r) => this.obtenerEtiquetaRol(r)),
        contactos: [],
        solicitudesPendientes: [],
        ocultosCount: 0,
      };
    }

    // 1. Traer únicamente usuarios registrados en el mismo espacio (campo)
    const usuariosDelCampo = await UsuarioModel.listarTodos(establecimientoId);
    const mapaUsuariosPorId = new Map(usuariosDelCampo.map((u) => [u.id, u]));

    // 2. Filtrar estrictamente por rol permitido (directo o mediante solicitud) y excluir al propio usuario
    const candidatosPermitidos = usuariosDelCampo.filter((u) => {
      if (!u || u.id === usuarioActual.id) return false;
      if (!u.establecimientoId || u.establecimientoId !== establecimientoId) return false;
      const rolCandidato = normalizarRolChat(u.rol);
      return rolesVisiblesTotal.includes(rolCandidato);
    });

    // 3. Filtrar contactos ocultados (soft-delete) por el usuario actual
    const idsOcultos = await this._obtenerIdsContactosOcultos(usuarioActual.id, establecimientoId);
    const ocultosCount = candidatosPermitidos.filter((c) => idsOcultos.has(c.id)).length;
    const contactosVisibles = candidatosPermitidos.filter((c) => !idsOcultos.has(c.id));

    // 4. Adjuntar resumen de conversación y estado de solicitudes de chat
    const [mensajes, solicitudesCampo] = await Promise.all([
      this._obtenerMensajesUsuarioEnCampo(usuarioActual.id, establecimientoId),
      this._obtenerSolicitudesCampo(establecimientoId),
    ]);

    const contactosEnriquecidos = contactosVisibles.map((contacto) => {
      const rolNorm = normalizarRolChat(contacto.rol);
      const msgsConContacto = mensajes.filter(
        (m) =>
          (m.remitenteId === usuarioActual.id && m.destinatarioId === contacto.id) ||
          (m.remitenteId === contacto.id && m.destinatarioId === usuarioActual.id)
      );

      const ultimo = msgsConContacto.length > 0 ? msgsConContacto[msgsConContacto.length - 1] : null;
      const mensajesNoLeidos = msgsConContacto.filter(
        (m) => m.remitenteId === contacto.id && m.destinatarioId === usuarioActual.id && !m.leido
      ).length;

      const requiereSolicitud = this.requiereSolicitudParaEnviar(rolActual, rolNorm);
      const solicitudSaliente = requiereSolicitud
        ? solicitudesCampo.find(
            (s) => s.solicitanteId === usuarioActual.id && s.destinatarioId === contacto.id
          ) || null
        : null;
      const solicitudEntrante =
        (rolActual === ROLES.DUENO || rolActual === ROLES.OFICINA) && rolNorm === ROLES.PEON
          ? solicitudesCampo.find(
              (s) => s.solicitanteId === contacto.id && s.destinatarioId === usuarioActual.id
            ) || null
          : null;

      const estadoSolicitud = requiereSolicitud
        ? solicitudSaliente?.estado || "NINGUNA"
        : "NO_APLICA";
      const superiorEnvioMensaje =
        requiereSolicitud &&
        msgsConContacto.some(
          (m) => m.remitenteId === contacto.id && m.destinatarioId === usuarioActual.id
        );
      const chatHabilitado =
        !requiereSolicitud || estadoSolicitud === "APROBADA" || superiorEnvioMensaje;

      return {
        id: contacto.id,
        nombre: contacto.nombre,
        email: contacto.email,
        rol: rolNorm,
        rolEtiqueta: this.obtenerEtiquetaRol(rolNorm),
        cargo: contacto.cargo || this.obtenerEtiquetaRol(rolNorm),
        telefono: contacto.telefono || "",
        establecimientoId: contacto.establecimientoId,
        establecimiento: contacto.establecimiento,
        requiereSolicitud,
        estadoSolicitud,
        solicitudId: solicitudSaliente?.id || null,
        motivoSolicitud: solicitudSaliente?.motivo || null,
        chatHabilitado,
        solicitudEntrante: solicitudEntrante
          ? {
              id: solicitudEntrante.id,
              estado: solicitudEntrante.estado,
              motivo: solicitudEntrante.motivo || "",
              fechaSolicitud: solicitudEntrante.fechaSolicitud,
            }
          : null,
        ultimoMensaje: ultimo
          ? {
              id: ultimo.id,
              contenido: ultimo.contenido,
              fechaEnvio: ultimo.fechaEnvio,
              esMio: ultimo.remitenteId === usuarioActual.id,
              leido: ultimo.leido,
            }
          : null,
        mensajesNoLeidos,
      };
    });

    // Ordenar por fecha del último mensaje descendente, luego por prioridad de aprobación pendiente y alfabéticamente
    contactosEnriquecidos.sort((a, b) => {
      const fechaA = a.ultimoMensaje ? new Date(a.ultimoMensaje.fechaEnvio).getTime() : 0;
      const fechaB = b.ultimoMensaje ? new Date(b.ultimoMensaje.fechaEnvio).getTime() : 0;
      if (fechaA !== fechaB) return fechaB - fechaA;
      return a.nombre.localeCompare(b.nombre, "es");
    });

    const solicitudesPendientes = solicitudesCampo
      .filter((s) => s.destinatarioId === usuarioActual.id && s.estado === "PENDIENTE")
      .map((s) => {
        const solUsuario = mapaUsuariosPorId.get(s.solicitanteId);
        const rolSol = normalizarRolChat(solUsuario?.rol || ROLES.PEON);
        return {
          id: s.id,
          solicitanteId: s.solicitanteId,
          solicitanteNombre: solUsuario?.nombre || "Peón",
          solicitanteRol: rolSol,
          solicitanteRolEtiqueta: this.obtenerEtiquetaRol(rolSol),
          motivo: s.motivo || "Solicita habilitar chat",
          estado: s.estado,
          fechaSolicitud: s.fechaSolicitud,
        };
      });

    return {
      usuarioActual: {
        id: usuarioActual.id,
        nombre: usuarioActual.nombre,
        rol: rolActual,
        rolEtiqueta: this.obtenerEtiquetaRol(rolActual),
        establecimientoId,
        establecimiento: establecimientoNombre,
      },
      rolesPermitidos,
      rolesPermitidosEtiquetas: rolesPermitidos.map((r) => this.obtenerEtiquetaRol(r)),
      rolesConSolicitud,
      rolesConSolicitudEtiquetas: rolesConSolicitud.map((r) => this.obtenerEtiquetaRol(r)),
      contactos: contactosEnriquecidos,
      solicitudesPendientes,
      ocultosCount,
    };
  }

  /**
   * Valida que dos usuarios existan en la BD, pertenezcan al mismo espacio (campo)
   * y tengan permiso estricto según la matriz de roles para comunicarse.
   */
  static async validarPermisoComunicacion(usuarioId, contactoId) {
    if (!usuarioId || !contactoId) {
      const err = new Error("Se requieren el usuario remitente y el contacto destinatario.");
      err.status = 400;
      throw err;
    }

    if (usuarioId === contactoId) {
      const err = new Error("No es posible iniciar un chat con tu propio usuario.");
      err.status = 400;
      throw err;
    }

    const [usuario, contacto] = await Promise.all([
      UsuarioModel.buscarPorId(usuarioId),
      UsuarioModel.buscarPorId(contactoId),
    ]);

    if (!usuario) {
      const err = new Error("Usuario autenticado no encontrado.");
      err.status = 404;
      throw err;
    }

    if (!contacto) {
      const err = new Error("El contacto especificado no existe.");
      err.status = 404;
      throw err;
    }

    // Validación estricta de espacio (campo) compartido
    if (
      !usuario.establecimientoId ||
      !contacto.establecimientoId ||
      usuario.establecimientoId !== contacto.establecimientoId
    ) {
      const err = new Error(
        "Acceso denegado: Solo se permite la comunicación con agentes registrados en el mismo espacio (campo)."
      );
      err.status = 403;
      throw err;
    }

    // Validación estricta de visibilidad/comunicación por rol
    if (!this.puedenVisibilizarContacto(usuario.rol, contacto.rol)) {
      const rolOrigen = this.obtenerEtiquetaRol(usuario.rol);
      const rolDestino = this.obtenerEtiquetaRol(contacto.rol);
      const err = new Error(
        `Comunicación no autorizada por la matriz de estancia: el rol ${rolOrigen} no tiene permisos para chatear con ${rolDestino}.`
      );
      err.status = 403;
      throw err;
    }

    return { usuario, contacto };
  }

  /**
   * Obtiene todas las solicitudes de chat de un establecimiento.
   */
  static async _obtenerSolicitudesCampo(establecimientoId) {
    if (!establecimientoId) return [];
    try {
      if (!prisma.solicitudChat) {
        throw new Error("Modelo SolicitudChat no inicializado en cliente Prisma");
      }
      const lista = await prisma.solicitudChat.findMany({
        where: { establecimientoId },
        orderBy: { fechaSolicitud: "desc" },
      });
      return lista.map((s) => ({
        ...s,
        fechaSolicitud: s.fechaSolicitud instanceof Date ? s.fechaSolicitud.toISOString() : s.fechaSolicitud,
        fechaRespuesta: s.fechaRespuesta instanceof Date ? s.fechaRespuesta.toISOString() : s.fechaRespuesta,
      }));
    } catch (err) {
      console.warn("[ChatModel._obtenerSolicitudesCampo] Usando fallback en memoria:", err.message);
      return (db.solicitudesChat || []).filter((s) => s.establecimientoId === establecimientoId);
    }
  }

  static async _buscarSolicitudEntre(solicitanteId, destinatarioId, establecimientoId) {
    const lista = await this._obtenerSolicitudesCampo(establecimientoId);
    return (
      lista.find(
        (s) => s.solicitanteId === solicitanteId && s.destinatarioId === destinatarioId
      ) || null
    );
  }

  /**
   * Permite que un Peón solicite habilitación para chatear con Administración o Dueño de su campo.
   */
  static async solicitarChat({ solicitanteId, destinatarioId, motivo = "" }) {
    const { usuario, contacto } = await this.validarPermisoComunicacion(solicitanteId, destinatarioId);

    if (!this.requiereSolicitudParaEnviar(usuario.rol, contacto.rol)) {
      const err = new Error("No se requiere solicitud para chatear con este rol.");
      err.status = 400;
      throw err;
    }

    const establecimientoId = usuario.establecimientoId;
    const motivoLimpio = String(motivo || "").trim().slice(0, 300) || "Solicitud para comunicarse";

    // Restaurar contacto si estaba oculto para el remitente
    await this.restaurarContactosOcultos(solicitanteId, destinatarioId);

    try {
      if (!prisma.solicitudChat) {
        throw new Error("Modelo SolicitudChat no inicializado en cliente Prisma");
      }

      const existente = await prisma.solicitudChat.findUnique({
        where: {
          solicitanteId_destinatarioId: {
            solicitanteId,
            destinatarioId,
          },
        },
      });

      if (existente && existente.estado === "APROBADA") {
        return {
          ...existente,
          fechaSolicitud: existente.fechaSolicitud instanceof Date ? existente.fechaSolicitud.toISOString() : existente.fechaSolicitud,
          fechaRespuesta: existente.fechaRespuesta instanceof Date ? existente.fechaRespuesta.toISOString() : existente.fechaRespuesta,
        };
      }

      const guardada = await prisma.solicitudChat.upsert({
        where: {
          solicitanteId_destinatarioId: {
            solicitanteId,
            destinatarioId,
          },
        },
        update: {
          estado: "PENDIENTE",
          motivo: motivoLimpio,
          establecimientoId,
          fechaSolicitud: new Date(),
          fechaRespuesta: null,
        },
        create: {
          solicitanteId,
          destinatarioId,
          establecimientoId,
          motivo: motivoLimpio,
          estado: "PENDIENTE",
        },
      });

      return {
        ...guardada,
        fechaSolicitud: guardada.fechaSolicitud instanceof Date ? guardada.fechaSolicitud.toISOString() : guardada.fechaSolicitud,
        fechaRespuesta: null,
      };
    } catch (err) {
      console.warn("[ChatModel.solicitarChat] Usando fallback en memoria:", err.message);
      if (!db.solicitudesChat) db.solicitudesChat = [];

      const existente = db.solicitudesChat.find(
        (s) =>
          s.establecimientoId === establecimientoId &&
          s.solicitanteId === solicitanteId &&
          s.destinatarioId === destinatarioId
      );

      if (existente) {
        if (existente.estado === "APROBADA") return existente;
        existente.estado = "PENDIENTE";
        existente.motivo = motivoLimpio;
        existente.fechaSolicitud = new Date().toISOString();
        existente.fechaRespuesta = null;
        return existente;
      }

      const nueva = {
        id: `solchat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        solicitanteId,
        destinatarioId,
        establecimientoId,
        motivo: motivoLimpio,
        estado: "PENDIENTE",
        fechaSolicitud: new Date().toISOString(),
        fechaRespuesta: null,
      };
      db.solicitudesChat.unshift(nueva);
      return nueva;
    }
  }

  /**
   * Permite al Dueño o Administrador aprobar o rechazar la solicitud de chat de un Peón.
   */
  static async responderSolicitud({ solicitudId, revisorId, estado }) {
    const estadoMayus = String(estado || "").trim().toUpperCase();
    if (estadoMayus !== "APROBADA" && estadoMayus !== "RECHAZADA") {
      const err = new Error("Estado inválido. Debe ser APROBADA o RECHAZADA.");
      err.status = 400;
      throw err;
    }

    const revisor = await UsuarioModel.buscarPorId(revisorId);
    if (!revisor) {
      const err = new Error("Usuario revisor no encontrado.");
      err.status = 404;
      throw err;
    }

    try {
      if (!prisma.solicitudChat) {
        throw new Error("Modelo SolicitudChat no inicializado en cliente Prisma");
      }

      const solicitud = await prisma.solicitudChat.findUnique({
        where: { id: solicitudId },
      });

      if (!solicitud) {
        const err = new Error("Solicitud de chat no encontrada.");
        err.status = 404;
        throw err;
      }

      if (
        solicitud.destinatarioId !== revisorId ||
        !revisor.establecimientoId ||
        solicitud.establecimientoId !== revisor.establecimientoId
      ) {
        const err = new Error("No tenés permisos para responder esta solicitud de chat.");
        err.status = 403;
        throw err;
      }

      const actualizada = await prisma.solicitudChat.update({
        where: { id: solicitudId },
        data: {
          estado: estadoMayus,
          fechaRespuesta: new Date(),
        },
      });

      return {
        ...actualizada,
        fechaSolicitud: actualizada.fechaSolicitud instanceof Date ? actualizada.fechaSolicitud.toISOString() : actualizada.fechaSolicitud,
        fechaRespuesta: actualizada.fechaRespuesta instanceof Date ? actualizada.fechaRespuesta.toISOString() : actualizada.fechaRespuesta,
      };
    } catch (err) {
      if (err.status) throw err;
      console.warn("[ChatModel.responderSolicitud] Usando fallback en memoria:", err.message);
      if (!db.solicitudesChat) db.solicitudesChat = [];

      const solicitud = db.solicitudesChat.find((s) => s.id === solicitudId);
      if (!solicitud) {
        const notFound = new Error("Solicitud de chat no encontrada.");
        notFound.status = 404;
        throw notFound;
      }

      if (
        solicitud.destinatarioId !== revisorId ||
        !revisor.establecimientoId ||
        solicitud.establecimientoId !== revisor.establecimientoId
      ) {
        const forbidden = new Error("No tenés permisos para responder esta solicitud de chat.");
        forbidden.status = 403;
        throw forbidden;
      }

      solicitud.estado = estadoMayus;
      solicitud.fechaRespuesta = new Date().toISOString();
      return solicitud;
    }
  }

  /**
   * Obtiene el historial de mensajes con un contacto autorizado y marca los entrantes como leídos.
   */
  static async obtenerMensajesConversacion(usuarioId, contactoId) {
    const { usuario, contacto } = await this.validarPermisoComunicacion(usuarioId, contactoId);
    const establecimientoId = usuario.establecimientoId;
    const rolUsuario = normalizarRolChat(usuario.rol);
    const rolContacto = normalizarRolChat(contacto.rol);
    const requiereSolicitud = this.requiereSolicitudParaEnviar(rolUsuario, rolContacto);
    const solicitudSaliente = requiereSolicitud
      ? await this._buscarSolicitudEntre(usuarioId, contactoId, establecimientoId)
      : null;
    const solicitudEntrante =
      (rolUsuario === ROLES.DUENO || rolUsuario === ROLES.OFICINA) && rolContacto === ROLES.PEON
        ? await this._buscarSolicitudEntre(contactoId, usuarioId, establecimientoId)
        : null;
    const estadoSolicitud = requiereSolicitud
      ? solicitudSaliente?.estado || "NINGUNA"
      : "NO_APLICA";
    const construirContactoPayload = (listaMensajes) => {
      const superiorEnvioMensaje =
        requiereSolicitud &&
        (listaMensajes || []).some(
          (m) => m.remitenteId === contactoId && m.destinatarioId === usuarioId
        );
      const chatHabilitado =
        !requiereSolicitud || estadoSolicitud === "APROBADA" || superiorEnvioMensaje;

      return {
        id: contacto.id,
        nombre: contacto.nombre,
        email: contacto.email,
        rol: rolContacto,
        rolEtiqueta: this.obtenerEtiquetaRol(contacto.rol),
        cargo: contacto.cargo || this.obtenerEtiquetaRol(contacto.rol),
        establecimientoId: contacto.establecimientoId,
        establecimiento: contacto.establecimiento,
        requiereSolicitud,
        estadoSolicitud,
        solicitudId: solicitudSaliente?.id || null,
        motivoSolicitud: solicitudSaliente?.motivo || null,
        chatHabilitado,
        solicitudEntrante: solicitudEntrante
          ? {
              id: solicitudEntrante.id,
              estado: solicitudEntrante.estado,
              motivo: solicitudEntrante.motivo || "",
              fechaSolicitud: solicitudEntrante.fechaSolicitud,
            }
          : null,
      };
    };

    try {
      if (!prisma.mensajeChat) {
        throw new Error("Modelo MensajeChat no inicializado en cliente Prisma");
      }

      // Marcar mensajes recibidos de este contacto como leídos
      await prisma.mensajeChat.updateMany({
        where: {
          establecimientoId,
          remitenteId: contactoId,
          destinatarioId: usuarioId,
          leido: false,
        },
        data: { leido: true },
      });

      const mensajes = await prisma.mensajeChat.findMany({
        where: {
          establecimientoId,
          OR: [
            { remitenteId: usuarioId, destinatarioId: contactoId },
            { remitenteId: contactoId, destinatarioId: usuarioId },
          ],
        },
        orderBy: { fechaEnvio: "asc" },
      });

      return {
        contacto: construirContactoPayload(mensajes),
        mensajes: mensajes.map((m) => ({
          id: m.id,
          remitenteId: m.remitenteId,
          destinatarioId: m.destinatarioId,
          establecimientoId: m.establecimientoId,
          contenido: m.contenido,
          leido: Boolean(m.leido),
          esMio: m.remitenteId === usuarioId,
          fechaEnvio: m.fechaEnvio instanceof Date ? m.fechaEnvio.toISOString() : m.fechaEnvio,
        })),
      };
    } catch (err) {
      console.warn("[ChatModel.obtenerMensajesConversacion] Usando fallback en memoria:", err.message);
      if (!db.mensajesChat) db.mensajesChat = [];

      // Marcar como leídos en memoria
      for (const m of db.mensajesChat) {
        if (
          m.establecimientoId === establecimientoId &&
          m.remitenteId === contactoId &&
          m.destinatarioId === usuarioId &&
          !m.leido
        ) {
          m.leido = true;
        }
      }

      const mensajesMemoria = db.mensajesChat
        .filter(
          (m) =>
            m.establecimientoId === establecimientoId &&
            ((m.remitenteId === usuarioId && m.destinatarioId === contactoId) ||
              (m.remitenteId === contactoId && m.destinatarioId === usuarioId))
        )
        .sort((a, b) => new Date(a.fechaEnvio).getTime() - new Date(b.fechaEnvio).getTime())
        .map((m) => ({
          ...m,
          esMio: m.remitenteId === usuarioId,
        }));

      return {
        contacto: construirContactoPayload(mensajesMemoria),
        mensajes: mensajesMemoria,
      };
    }
  }

  /**
   * Envía un mensaje a un contacto autorizado dentro del mismo establecimiento.
   * Si el remitente es Peón y se dirige a Administración o Dueño, exige solicitud aprobada.
   */
  static async enviarMensaje({ remitenteId, destinatarioId, contenido }) {
    const textoLimpio = String(contenido || "").trim();
    if (!textoLimpio) {
      const err = new Error("El contenido del mensaje no puede estar vacío.");
      err.status = 400;
      throw err;
    }

    if (textoLimpio.length > 2000) {
      const err = new Error("El mensaje excede el límite máximo de 2000 caracteres.");
      err.status = 400;
      throw err;
    }

    const { usuario, contacto } = await this.validarPermisoComunicacion(remitenteId, destinatarioId);
    const establecimientoId = usuario.establecimientoId;

    if (this.requiereSolicitudParaEnviar(usuario.rol, contacto.rol)) {
      const solicitud = await this._buscarSolicitudEntre(remitenteId, destinatarioId, establecimientoId);
      const aprobadaPorSolicitud = solicitud?.estado === "APROBADA";
      const habilitadaPorMensajeSuperior = aprobadaPorSolicitud
        ? true
        : await this._existeMensajeDe(destinatarioId, remitenteId, establecimientoId);

      if (!aprobadaPorSolicitud && !habilitadaPorMensajeSuperior) {
        const rolDestino = this.obtenerEtiquetaRol(contacto.rol);
        const err = new Error(
          `Debes enviar una solicitud y contar con la aprobación de ${rolDestino} para poder chatear con este contacto.`
        );
        err.status = 403;
        throw err;
      }
    }

    // Si el contacto estaba oculto para el remitente, restaurarlo automáticamente al enviarle mensaje
    await this.restaurarContactosOcultos(remitenteId, destinatarioId);

    try {
      if (!prisma.mensajeChat) {
        throw new Error("Modelo MensajeChat no inicializado en cliente Prisma");
      }

      const creado = await prisma.mensajeChat.create({
        data: {
          remitenteId,
          destinatarioId,
          establecimientoId,
          contenido: textoLimpio,
          leido: false,
        },
      });

      return {
        id: creado.id,
        remitenteId: creado.remitenteId,
        destinatarioId: creado.destinatarioId,
        establecimientoId: creado.establecimientoId,
        contenido: creado.contenido,
        leido: Boolean(creado.leido),
        esMio: true,
        fechaEnvio: creado.fechaEnvio instanceof Date ? creado.fechaEnvio.toISOString() : creado.fechaEnvio,
      };
    } catch (err) {
      console.warn("[ChatModel.enviarMensaje] Usando fallback en memoria:", err.message);
      if (!db.mensajesChat) db.mensajesChat = [];

      const nuevoMensaje = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        remitenteId,
        destinatarioId,
        establecimientoId,
        contenido: textoLimpio,
        leido: false,
        fechaEnvio: new Date().toISOString(),
      };

      db.mensajesChat.push(nuevoMensaje);
      return {
        ...nuevoMensaje,
        esMio: true,
      };
    }
  }

  /**
   * Soft-delete / Ocultar un contacto de la vista activa de chat del usuario logueado.
   */
  static async ocultarContacto(usuarioId, contactoId) {
    const { usuario, contacto } = await this.validarPermisoComunicacion(usuarioId, contactoId);
    const establecimientoId = usuario.establecimientoId;

    try {
      if (!prisma.chatContactoOculto) {
        throw new Error("Modelo ChatContactoOculto no inicializado en cliente Prisma");
      }

      await prisma.chatContactoOculto.upsert({
        where: {
          usuarioId_contactoId: {
            usuarioId,
            contactoId,
          },
        },
        update: {
          establecimientoId,
          fechaOcultado: new Date(),
        },
        create: {
          usuarioId,
          contactoId,
          establecimientoId,
        },
      });
    } catch (err) {
      console.warn("[ChatModel.ocultarContacto] Usando fallback en memoria:", err.message);
      if (!db.chatContactosOcultos) db.chatContactosOcultos = [];
      const yaExiste = db.chatContactosOcultos.find(
        (o) => o.usuarioId === usuarioId && o.contactoId === contactoId
      );
      if (yaExiste) {
        yaExiste.establecimientoId = establecimientoId;
        yaExiste.fechaOcultado = new Date().toISOString();
      } else {
        db.chatContactosOcultos.push({
          id: `cco-${Date.now()}`,
          usuarioId,
          contactoId,
          establecimientoId,
          fechaOcultado: new Date().toISOString(),
        });
      }
    }

    return {
      contactoId: contacto.id,
      nombre: contacto.nombre,
      oculto: true,
    };
  }

  /**
   * Restaura un contacto específico o todos los contactos ocultos del usuario en su establecimiento.
   */
  static async restaurarContactosOcultos(usuarioId, contactoId = null) {
    const usuario = await UsuarioModel.buscarPorId(usuarioId);
    if (!usuario || !usuario.establecimientoId) {
      return { restaurados: 0 };
    }
    const establecimientoId = usuario.establecimientoId;

    try {
      if (!prisma.chatContactoOculto) {
        throw new Error("Modelo ChatContactoOculto no inicializado en cliente Prisma");
      }
      const filtro = {
        usuarioId,
        establecimientoId,
        ...(contactoId ? { contactoId } : {}),
      };
      const res = await prisma.chatContactoOculto.deleteMany({ where: filtro });
      return { restaurados: res.count || 0 };
    } catch (err) {
      console.warn("[ChatModel.restaurarContactosOcultos] Usando fallback en memoria:", err.message);
      if (!db.chatContactosOcultos) db.chatContactosOcultos = [];
      const antes = db.chatContactosOcultos.length;
      db.chatContactosOcultos = db.chatContactosOcultos.filter((o) => {
        if (o.usuarioId !== usuarioId || o.establecimientoId !== establecimientoId) return true;
        if (contactoId && o.contactoId !== contactoId) return true;
        return false;
      });
      return { restaurados: antes - db.chatContactosOcultos.length };
    }
  }
}

module.exports = {
  ChatModel,
  MATRIZ_CHAT_ROLES,
  MATRIZ_SOLICITUD_CHAT_ROLES,
  ETIQUETAS_ROL_CHAT,
  normalizarRolChat,
};
