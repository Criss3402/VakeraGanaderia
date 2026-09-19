const servicios = require("../data/servicios");
const db = require("../config/db");
const { exito, error } = require("../utils/apiResponse");

class PresentacionController {
  static obtenerServicios(req, res) {
    return res.json(servicios);
  }

  static obtenerServicioPorId(req, res) {
    const { id } = req.params;
    const servicio = servicios.find((s) => s.id === id);
    if (!servicio) {
      return error(res, "Servicio no encontrado", 404);
    }
    return res.json(servicio);
  }

  static recibirContacto(req, res) {
    const { nombre, email, mensaje } = req.body || {};

    if (!nombre || !email || !mensaje) {
      return error(res, "Los campos nombre, email y mensaje son obligatorios.", 400);
    }

    const nuevoMensaje = {
      id: db.mensajesContacto.length + 1,
      nombre,
      email,
      mensaje,
      fecha: new Date().toISOString(),
    };

    db.mensajesContacto.push(nuevoMensaje);

    return res.status(201).json({
      ok: true,
      detalle: "Gracias, recibimos tu mensaje. Te contactaremos a la brevedad.",
      data: nuevoMensaje,
    });
  }

  static listarContactos(req, res) {
    return res.json(db.mensajesContacto);
  }
}

module.exports = PresentacionController;
