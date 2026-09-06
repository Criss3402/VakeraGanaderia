const express = require("express");

const router = express.Router();

// Almacenamiento en memoria a modo de ejemplo.
// En producción esto se guardaría en una base de datos.
const mensajes = [];

// POST /api/contacto -> recibe un mensaje del formulario de contacto
router.post("/", (req, res) => {
  const { nombre, email, mensaje } = req.body || {};

  if (!nombre || !email || !mensaje) {
    return res.status(400).json({
      error: "Los campos nombre, email y mensaje son obligatorios.",
    });
  }

  const nuevoMensaje = {
    id: mensajes.length + 1,
    nombre,
    email,
    mensaje,
    fecha: new Date().toISOString(),
  };

  mensajes.push(nuevoMensaje);

  res.status(201).json({
    ok: true,
    detalle: "Gracias, recibimos tu mensaje. Te contactaremos a la brevedad.",
  });
});

// GET /api/contacto -> lista los mensajes recibidos (uso administrativo)
router.get("/", (req, res) => {
  res.json(mensajes);
});

module.exports = router;
