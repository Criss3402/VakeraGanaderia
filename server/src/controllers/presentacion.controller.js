const servicios = require("../data/servicios");
const db = require("../config/db");
const prisma = require("../config/prisma");
const { exito, error } = require("../utils/apiResponse");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class PresentacionController {
  static obtenerServicios(req, res) {
    return exito(res, servicios);
  }

  static obtenerServicioPorId(req, res) {
    const { id } = req.params;
    const servicio = servicios.find((s) => s.id === id);
    if (!servicio) {
      return error(res, "Servicio no encontrado", 404);
    }
    return exito(res, servicio);
  }

  static async recibirContacto(req, res) {
    const { nombre, email, mensaje, telefono } = req.body || {};

    if (!nombre || !email || !mensaje) {
      return error(res, "Los campos nombre, email y mensaje son obligatorios.", 400);
    }

    if (!EMAIL_REGEX.test(email)) {
      return error(res, "El formato del correo electrónico no es válido.", 400);
    }

    if (nombre.trim().length < 2) {
      return error(res, "El nombre debe tener al menos 2 caracteres.", 400);
    }

    if (mensaje.trim().length < 10) {
      return error(res, "El mensaje debe tener al menos 10 caracteres.", 400);
    }

    try {
      // Persistir en PostgreSQL (Prisma)
      const nuevoMensaje = await prisma.mensajeContacto.create({
        data: {
          nombre: nombre.trim(),
          email: email.toLowerCase().trim(),
          telefono: telefono?.trim() || null,
          mensaje: mensaje.trim(),
        },
      });

      return exito(
        res,
        nuevoMensaje,
        "Gracias, recibimos tu mensaje. Te contactaremos a la brevedad.",
        201
      );
    } catch (err) {
      console.warn("Fallo Prisma en contacto, guardando en memoria:", err.message);

      // Fallback en memoria
      const nuevoMensaje = {
        id: db.mensajesContacto.length + 1,
        nombre: nombre.trim(),
        email: email.toLowerCase().trim(),
        telefono: telefono?.trim() || null,
        mensaje: mensaje.trim(),
        leido: false,
        fechaEnvio: new Date().toISOString(),
      };
      db.mensajesContacto.push(nuevoMensaje);

      return exito(
        res,
        nuevoMensaje,
        "Gracias, recibimos tu mensaje. Te contactaremos a la brevedad.",
        201
      );
    }
  }

  static async listarContactos(req, res) {
    try {
      const mensajes = await prisma.mensajeContacto.findMany({
        orderBy: { fechaEnvio: "desc" },
      });
      return exito(res, mensajes);
    } catch {
      return exito(res, db.mensajesContacto);
    }
  }
}

module.exports = PresentacionController;
