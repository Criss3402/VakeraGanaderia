const express = require("express");
const PermisosController = require("../controllers/permisos.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const rbacMiddleware = require("../middlewares/rbac.middleware");
const { ROLES } = require("../utils/roles.constants");

const router = express.Router();

router.use(authMiddleware);

// Consulta de roles y matriz de permisos
router.get("/roles", PermisosController.obtenerRoles);

// Consulta de usuarios registrados y sus roles
router.get(
  "/usuarios",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ, ROLES.OFICINA),
  PermisosController.obtenerUsuarios
);

// Modificación de rol de usuario (exclusivo para Dueño)
router.patch(
  "/usuarios/:id/rol",
  rbacMiddleware(ROLES.DUENO),
  PermisosController.cambiarRolUsuario
);

module.exports = router;
