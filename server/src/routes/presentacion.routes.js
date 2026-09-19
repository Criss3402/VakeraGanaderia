const express = require("express");
const PresentacionController = require("../controllers/presentacion.controller");

const router = express.Router();

// Rutas de Catálogo de Servicios
router.get("/servicios", PresentacionController.obtenerServicios);
router.get("/servicios/:id", PresentacionController.obtenerServicioPorId);

// Rutas de Formulario de Contacto
router.post("/contacto", PresentacionController.recibirContacto);
router.get("/contacto", PresentacionController.listarContactos);

module.exports = router;
