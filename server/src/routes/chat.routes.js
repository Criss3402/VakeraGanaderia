const express = require("express");
const ChatController = require("../controllers/chat.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const rbacMiddleware = require("../middlewares/rbac.middleware");
const { ROLES } = require("../utils/roles.constants");

const router = express.Router();

// Todas las rutas del chat requieren sesión activa y un rol válido de la estancia
router.use(authMiddleware);
router.use(
  rbacMiddleware(
    ROLES.DUENO,
    ROLES.OFICINA,
    ROLES.CAPATAZ,
    ROLES.VETERINARIO,
    ROLES.PEON
  )
);

// Obtener lista de contactos filtrada estrictamente por rol y establecimiento (campo)
router.get("/contactos", ChatController.obtenerContactos);

// Restaurar contactos ocultos en la vista activa
router.post("/contactos/restaurar", ChatController.restaurarContactos);

// Ocultar / borrar contacto de la vista activa (soft-delete)
router.delete("/contactos/:contactoId", ChatController.ocultarContacto);

// Obtener conversación activa con un contacto permitido
router.get("/mensajes/:contactoId", ChatController.obtenerMensajes);

// Enviar mensaje a un contacto permitido
router.post("/mensajes", ChatController.enviarMensaje);

module.exports = router;
