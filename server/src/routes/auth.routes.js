const express = require("express");
const AuthController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

// Autenticación pública
router.post("/login", AuthController.login);
router.post("/registro", AuthController.registro);
router.post("/verificar-email", AuthController.verificarEmail);
router.get("/verificar-email", AuthController.verificarEmail);
router.post("/reenviar-verificacion", AuthController.reenviarVerificacion);
router.post("/solicitar-recuperacion", AuthController.solicitarRecuperacion);
router.post("/restablecer-password", AuthController.restablecerPassword);
router.get("/usuarios-demo", AuthController.obtenerUsuariosDemo);

// Autenticación protegida (sesión actual)
router.get("/me", authMiddleware, AuthController.me);

module.exports = router;
