const jwt = require("jsonwebtoken");
const UsuarioModel = require("../models/usuario.model");
const { error } = require("../utils/apiResponse");

const { JWT_SECRET } = require("../config/env");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return error(res, "No autorizado. Token de sesión no proporcionado.", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verificación criptográfica del JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    // Buscar el usuario en la base de datos para verificar que aún existe
    const usuario = await UsuarioModel.buscarPorId(decoded.id);

    if (!usuario) {
      return error(res, "Sesión inválida: el usuario ya no existe.", 401);
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return error(res, "La sesión ha expirado. Por favor, volvé a iniciar sesión.", 401);
    }
    if (err.name === "JsonWebTokenError") {
      return error(res, "Token de sesión inválido.", 401);
    }
    return error(res, "Error al verificar la sesión.", 401);
  }
}

module.exports = authMiddleware;
