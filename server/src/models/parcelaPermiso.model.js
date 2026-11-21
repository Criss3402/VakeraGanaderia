const prisma = require("../config/prisma");
const db = require("../config/db");
const UsuarioModel = require("./usuario.model");
const { ROLES } = require("../utils/roles.constants");

function serializarSolicitud(s, mapaUsuarios = new Map()) {
  if (!s) return null;
  const solUsr = mapaUsuarios.get(s.solicitanteId);
  const revUsr = s.revisorId ? mapaUsuarios.get(s.revisorId) : null;
  return {
    id: s.id,
    solicitanteId: s.solicitanteId,
    solicitanteNombre: s.solicitanteNombre || solUsr?.nombre || "Administrador",
    solicitanteEmail: s.solicitanteEmail || solUsr?.email || "",
    establecimientoId: s.establecimientoId,
    accion: s.accion || "AGREGAR",
    parcelaId: s.parcelaId || null,
    parcelaNombre: s.parcelaNombre || null,
    motivo: s.motivo || "",
    estado: s.estado,
    revisorId: s.revisorId || null,
    revisorNombre: s.revisorNombre || revUsr?.nombre || null,
    fechaSolicitud: s.fechaSolicitud instanceof Date ? s.fechaSolicitud.toISOString() : s.fechaSolicitud,
    fechaRespuesta: s.fechaRespuesta instanceof Date ? s.fechaRespuesta.toISOString() : s.fechaRespuesta || null,
  };
}

function coincideSolicitudConAccion(sol, accion, parcelaId = null) {
  if (!sol) return false;
  const accSol = String(sol.accion || "").toUpperCase();
  const accReq = String(accion || "").toUpperCase();

  if (accReq === "AGREGAR") {
    return accSol === "AGREGAR" || accSol === "GESTIONAR";
  }
  if (accReq === "EDITAR") {
    if (accSol !== "EDITAR" && accSol !== "GESTIONAR") return false;
    if (!sol.parcelaId) return false;
    return String(sol.parcelaId) === String(parcelaId || "");
  }
  return false;
}

class ParcelaPermisoModel {
  static async _listarTodasDelCampo(establecimientoId) {
    if (!establecimientoId) return [];
    try {
      if (!prisma.solicitudPermisoParcela) {
        throw new Error("Modelo SolicitudPermisoParcela no inicializado en cliente Prisma");
      }
      return await prisma.solicitudPermisoParcela.findMany({
        where: { establecimientoId },
        orderBy: { fechaSolicitud: "desc" },
      });
    } catch (err) {
      console.warn("[ParcelaPermisoModel._listarTodasDelCampo] Usando fallback en memoria:", err.message);
      return (db.solicitudesParcelas || [])
        .filter((s) => s.establecimientoId === establecimientoId)
        .sort((a, b) => new Date(b.fechaSolicitud).getTime() - new Date(a.fechaSolicitud).getTime());
    }
  }

  /**
   * Verifica si el usuario tiene permiso aprobado (y no consumido) para una acción puntual:
   * - AGREGAR una nueva parcela, o
   * - EDITAR una parcela específica (`parcelaId`).
   */
  static async tienePermisoParaAccion({ usuarioId, rol, establecimientoId, accion, parcelaId = null }) {
    const rolNorm = String(rol || "").toLowerCase();
    if (rolNorm === ROLES.DUENO || rolNorm === ROLES.CAPATAZ) {
      return { autorizado: true, solicitudId: null };
    }
    if (rolNorm !== ROLES.OFICINA || !usuarioId || !establecimientoId) {
      return { autorizado: false, solicitudId: null };
    }

    const todas = await this._listarTodasDelCampo(establecimientoId);
    const aprobada = todas.find(
      (s) =>
        s.solicitanteId === usuarioId &&
        s.estado === "APROBADA" &&
        coincideSolicitudConAccion(s, accion, parcelaId)
    );

    return {
      autorizado: Boolean(aprobada),
      solicitudId: aprobada?.id || null,
    };
  }

  /**
   * Marca un permiso aprobado como consumido (`USADA`) una vez que el Administrador ejecutó la modificación/alta,
   * obligando a solicitar permiso nuevamente para la próxima modificación.
   */
  static async consumirPermiso(solicitudId) {
    if (!solicitudId) return null;
    try {
      if (!prisma.solicitudPermisoParcela) {
        throw new Error("Modelo SolicitudPermisoParcela no inicializado en cliente Prisma");
      }
      return await prisma.solicitudPermisoParcela.update({
        where: { id: solicitudId },
        data: { estado: "USADA" },
      });
    } catch (err) {
      console.warn("[ParcelaPermisoModel.consumirPermiso] Usando fallback en memoria:", err.message);
      const sol = (db.solicitudesParcelas || []).find((s) => s.id === solicitudId);
      if (sol) {
        sol.estado = "USADA";
      }
      return sol || null;
    }
  }

  /**
   * Lista las solicitudes y estado de permiso de parcelas para Dueño o Administrador.
   */
  static async obtenerEstadoYSolicitudes({ usuarioId, rol, establecimientoId }) {
    const rolNorm = String(rol || "").toLowerCase();
    const todas = await this._listarTodasDelCampo(establecimientoId);
    let usuariosCampo = [];
    try {
      usuariosCampo = await UsuarioModel.listarTodos(establecimientoId);
    } catch (err) {
      console.warn("[ParcelaPermisoModel.obtenerEstadoYSolicitudes] No se pudieron cargar usuarios:", err.message);
      usuariosCampo = db.usuarios || [];
    }
    const mapaUsuarios = new Map(usuariosCampo.map((u) => [u.id, u]));
    const serializadas = todas.map((s) => serializarSolicitud(s, mapaUsuarios));

    if (rolNorm === ROLES.DUENO) {
      const pendientes = serializadas.filter((s) => s.estado === "PENDIENTE");
      return {
        puedeAgregar: true,
        puedeEditar: true,
        requiereSolicitud: false,
        solicitudActual: null,
        solicitudesPendientes: pendientes,
        solicitudes: serializadas,
        permisoAgregarEstado: "APROBADA",
        permisosEditarPorParcela: {},
      };
    }

    if (rolNorm === ROLES.CAPATAZ) {
      return {
        puedeAgregar: true,
        puedeEditar: true,
        requiereSolicitud: false,
        solicitudActual: null,
        solicitudesPendientes: [],
        solicitudes: [],
        permisoAgregarEstado: "APROBADA",
        permisosEditarPorParcela: {},
      };
    }

    const mias = serializadas.filter((s) => s.solicitanteId === usuarioId);
    const activas = mias.filter((s) => s.estado !== "USADA");

    const solAgregar = activas.find((s) => s.accion === "AGREGAR" || s.accion === "GESTIONAR") || null;
    const permisosEditarPorParcela = {};
    for (const s of activas) {
      if (s.accion === "EDITAR" && s.parcelaId && !permisosEditarPorParcela[s.parcelaId]) {
        permisosEditarPorParcela[s.parcelaId] = s.estado;
      }
    }

    return {
      puedeAgregar: solAgregar?.estado === "APROBADA",
      puedeEditar: Object.values(permisosEditarPorParcela).includes("APROBADA"),
      requiereSolicitud: rolNorm === ROLES.OFICINA,
      solicitudActual: activas[0] || mias[0] || null,
      solicitudesActivas: activas,
      solicitudesPendientes: [],
      solicitudes: mias,
      permisoAgregarEstado: solAgregar?.estado || "NINGUNA",
      permisosEditarPorParcela,
    };
  }

  /**
   * Crea una solicitud nueva (PENDIENTE) para agregar una parcela o editar una parcela específica.
   */
  static async solicitarPermiso({
    solicitanteId,
    establecimientoId,
    accion = "AGREGAR",
    parcelaId = null,
    parcelaNombre = null,
    motivo = "",
  }) {
    if (!solicitanteId || !establecimientoId) {
      const err = new Error("Datos de sesión o establecimiento incompletos.");
      err.status = 400;
      throw err;
    }

    const accionLimpia = String(accion || "AGREGAR").trim().toUpperCase();
    const parcelaIdLimpio = parcelaId ? String(parcelaId) : null;
    const parcelaNombreLimpio = parcelaNombre ? String(parcelaNombre).trim() : null;
    const motivoLimpio = String(motivo || "").trim().slice(0, 300) || null;

    if (accionLimpia === "EDITAR" && !parcelaIdLimpio) {
      const err = new Error("Debes indicar qué parcela deseas solicitar permiso para editar.");
      err.status = 400;
      throw err;
    }

    let usuariosCampo = [];
    try {
      usuariosCampo = await UsuarioModel.listarTodos(establecimientoId);
    } catch (err) {
      console.warn("[ParcelaPermisoModel.solicitarPermiso] No se pudieron cargar usuarios:", err.message);
      usuariosCampo = db.usuarios || [];
    }
    const mapaUsuarios = new Map(usuariosCampo.map((u) => [u.id, u]));

    const todas = await this._listarTodasDelCampo(establecimientoId);
    const yaVigente = todas.find(
      (s) =>
        s.solicitanteId === solicitanteId &&
        (s.estado === "APROBADA" || s.estado === "PENDIENTE") &&
        coincideSolicitudConAccion(s, accionLimpia, parcelaIdLimpio)
    );

    if (yaVigente) {
      return serializarSolicitud(yaVigente, mapaUsuarios);
    }

    try {
      if (!prisma.solicitudPermisoParcela) {
        throw new Error("Modelo SolicitudPermisoParcela no inicializado en cliente Prisma");
      }

      const guardada = await prisma.solicitudPermisoParcela.create({
        data: {
          solicitanteId,
          establecimientoId,
          accion: accionLimpia,
          parcelaId: parcelaIdLimpio,
          parcelaNombre: parcelaNombreLimpio,
          motivo: motivoLimpio,
          estado: "PENDIENTE",
        },
      });

      return serializarSolicitud(guardada, mapaUsuarios);
    } catch (err) {
      console.warn("[ParcelaPermisoModel.solicitarPermiso] Usando fallback en memoria:", err.message);
      if (!db.solicitudesParcelas) db.solicitudesParcelas = [];

      const solUsr = mapaUsuarios.get(solicitanteId);
      const nueva = {
        id: `solparc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        solicitanteId,
        solicitanteNombre: solUsr?.nombre || "Administrador",
        solicitanteEmail: solUsr?.email || "",
        establecimientoId,
        accion: accionLimpia,
        parcelaId: parcelaIdLimpio,
        parcelaNombre: parcelaNombreLimpio,
        motivo: motivoLimpio,
        estado: "PENDIENTE",
        revisorId: null,
        fechaSolicitud: new Date().toISOString(),
        fechaRespuesta: null,
      };
      db.solicitudesParcelas.unshift(nueva);
      return serializarSolicitud(nueva, mapaUsuarios);
    }
  }

  /**
   * Permite al Dueño aprobar o rechazar una solicitud puntual de permiso de parcela.
   */
  static async responderSolicitud({ solicitudId, revisorId, establecimientoId, estado }) {
    const estadoMayus = String(estado || "").trim().toUpperCase();
    if (estadoMayus !== "APROBADA" && estadoMayus !== "RECHAZADA") {
      const err = new Error("Estado inválido. Debe ser APROBADA o RECHAZADA.");
      err.status = 400;
      throw err;
    }

    let usuariosCampo = [];
    try {
      usuariosCampo = await UsuarioModel.listarTodos(establecimientoId);
    } catch (err) {
      console.warn("[ParcelaPermisoModel.responderSolicitud] No se pudieron cargar usuarios:", err.message);
      usuariosCampo = db.usuarios || [];
    }
    const mapaUsuarios = new Map(usuariosCampo.map((u) => [u.id, u]));

    try {
      if (!prisma.solicitudPermisoParcela) {
        throw new Error("Modelo SolicitudPermisoParcela no inicializado en cliente Prisma");
      }

      const solicitud = await prisma.solicitudPermisoParcela.findUnique({
        where: { id: solicitudId },
      });

      if (!solicitud) {
        const notFound = new Error("Solicitud de permiso de parcela no encontrada.");
        notFound.status = 404;
        throw notFound;
      }

      if (solicitud.establecimientoId !== establecimientoId) {
        const forbidden = new Error("No tenés permisos para responder solicitudes de otro establecimiento.");
        forbidden.status = 403;
        throw forbidden;
      }

      const actualizada = await prisma.solicitudPermisoParcela.update({
        where: { id: solicitudId },
        data: {
          estado: estadoMayus,
          revisorId,
          fechaRespuesta: new Date(),
        },
      });

      return serializarSolicitud(actualizada, mapaUsuarios);
    } catch (err) {
      if (err.status) throw err;
      console.warn("[ParcelaPermisoModel.responderSolicitud] Usando fallback en memoria:", err.message);
      if (!db.solicitudesParcelas) db.solicitudesParcelas = [];

      const solicitud = db.solicitudesParcelas.find((s) => s.id === solicitudId);
      if (!solicitud) {
        const notFound = new Error("Solicitud de permiso de parcela no encontrada.");
        notFound.status = 404;
        throw notFound;
      }

      if (solicitud.establecimientoId !== establecimientoId) {
        const forbidden = new Error("No tenés permisos para responder solicitudes de otro establecimiento.");
        forbidden.status = 403;
        throw forbidden;
      }

      solicitud.estado = estadoMayus;
      solicitud.revisorId = revisorId;
      solicitud.fechaRespuesta = new Date().toISOString();
      return serializarSolicitud(solicitud, mapaUsuarios);
    }
  }
}

module.exports = ParcelaPermisoModel;
