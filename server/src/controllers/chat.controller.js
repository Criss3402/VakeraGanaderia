const {
  ChatModel,
  MATRIZ_CHAT_ROLES,
  MATRIZ_SOLICITUD_CHAT_ROLES,
  ETIQUETAS_ROL_CHAT,
} = require("../models/chat.model");
const { exito, error } = require("../utils/apiResponse");

class ChatController {
  /**
   * GET /api/chat/contactos
   * Evalúa el rol y establecimiento del usuario logueado en la base de datos y retorna
   * únicamente los contactos registrados en su espacio (campo) permitidos por la matriz.
   */
  static async obtenerContactos(req, res) {
    try {
      const usuarioId = req.usuario?.id;
      if (!usuarioId) {
        return error(res, "Usuario no autenticado.", 401);
      }

      const resultado = await ChatModel.listarContactosPermitidos(usuarioId);
      return exito(res, {
        ...resultado,
        matrizChat: MATRIZ_CHAT_ROLES,
        matrizSolicitudesChat: MATRIZ_SOLICITUD_CHAT_ROLES,
        etiquetasRoles: ETIQUETAS_ROL_CHAT,
      });
    } catch (err) {
      return error(res, err.message || "Error al cargar la lista de contactos.", err.status || 400);
    }
  }

  /**
   * GET /api/chat/mensajes/:contactoId
   * Obtiene el historial de mensajes con un contacto permitido del mismo espacio (campo).
   */
  static async obtenerMensajes(req, res) {
    try {
      const usuarioId = req.usuario?.id;
      const { contactoId } = req.params;

      if (!contactoId) {
        return error(res, "Debe especificar el contacto de la conversación.", 400);
      }

      const conversacion = await ChatModel.obtenerMensajesConversacion(usuarioId, contactoId);
      return exito(res, conversacion);
    } catch (err) {
      return error(res, err.message || "No se pudo obtener la conversación.", err.status || 400);
    }
  }

  /**
   * POST /api/chat/mensajes
   * Envía un mensaje validando estrictamente rol y pertenencia al mismo espacio (campo).
   */
  static async enviarMensaje(req, res) {
    try {
      const remitenteId = req.usuario?.id;
      const { destinatarioId, contenido } = req.body || {};

      if (!destinatarioId) {
        return error(res, "El destinatario del mensaje es obligatorio.", 400);
      }

      if (!contenido || !String(contenido).trim()) {
        return error(res, "El contenido del mensaje no puede estar vacío.", 400);
      }

      const nuevoMensaje = await ChatModel.enviarMensaje({
        remitenteId,
        destinatarioId,
        contenido,
      });

      return exito(res, nuevoMensaje, "Mensaje enviado correctamente.", 201);
    } catch (err) {
      return error(res, err.message || "Error al enviar el mensaje.", err.status || 400);
    }
  }

  /**
   * DELETE /api/chat/contactos/:contactoId
   * Oculta / borra (soft-delete) un contacto de la vista activa del usuario logueado.
   */
  static async ocultarContacto(req, res) {
    try {
      const usuarioId = req.usuario?.id;
      const { contactoId } = req.params;

      if (!contactoId) {
        return error(res, "Debe indicar el contacto a ocultar.", 400);
      }

      const resultado = await ChatModel.ocultarContacto(usuarioId, contactoId);
      return exito(
        res,
        resultado,
        `El chat con ${resultado.nombre} ha sido ocultado de tu vista activa.`
      );
    } catch (err) {
      return error(res, err.message || "No se pudo ocultar el contacto.", err.status || 400);
    }
  }

  /**
   * POST /api/chat/contactos/restaurar
   * Restaura los contactos previamente ocultados en la vista activa del usuario logueado.
   */
  static async restaurarContactos(req, res) {
    try {
      const usuarioId = req.usuario?.id;
      const { contactoId } = req.body || {};

      const resultado = await ChatModel.restaurarContactosOcultos(usuarioId, contactoId || null);
      return exito(res, resultado, "Contactos restaurados en la vista activa.");
    } catch (err) {
      return error(res, err.message || "No se pudieron restaurar los contactos.", err.status || 400);
    }
  }

  /**
   * POST /api/chat/solicitudes
   * Permite a un Peón enviar una solicitud para chatear con Administración o Dueño.
   */
  static async solicitarChat(req, res) {
    try {
      const solicitanteId = req.usuario?.id;
      const { destinatarioId, motivo } = req.body || {};

      if (!destinatarioId) {
        return error(res, "Debe indicar el contacto al que solicita chatear.", 400);
      }

      const solicitud = await ChatModel.solicitarChat({
        solicitanteId,
        destinatarioId,
        motivo,
      });

      return exito(
        res,
        solicitud,
        solicitud.estado === "APROBADA"
          ? "La conversación ya se encuentra habilitada."
          : "Solicitud de chat enviada correctamente.",
        201
      );
    } catch (err) {
      return error(res, err.message || "No se pudo enviar la solicitud de chat.", err.status || 400);
    }
  }

  /**
   * PATCH /api/chat/solicitudes/:solicitudId
   * Permite al Dueño o Administrador aprobar o rechazar una solicitud de chat de un Peón.
   */
  static async responderSolicitud(req, res) {
    try {
      const revisorId = req.usuario?.id;
      const { solicitudId } = req.params;
      const { estado } = req.body || {};

      if (!solicitudId) {
        return error(res, "Debe indicar la solicitud a responder.", 400);
      }

      const actualizada = await ChatModel.responderSolicitud({
        solicitudId,
        revisorId,
        estado,
      });

      return exito(
        res,
        actualizada,
        actualizada.estado === "APROBADA"
          ? "Solicitud de chat aprobada. Ya podés conversar con el peón."
          : "Solicitud de chat rechazada."
      );
    } catch (err) {
      return error(res, err.message || "No se pudo responder la solicitud de chat.", err.status || 400);
    }
  }
}

module.exports = ChatController;
