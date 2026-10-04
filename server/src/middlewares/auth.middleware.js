const UsuarioModel = require("../models/usuario.model");
const { error } = require("../utils/apiResponse");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return error(res, "No autorizado. Token de sesión no proporcionado.", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    let userId = null;

    // Soporte para tokens firmados base64 o tokens tipo "vakera-usr-1"
    if (token.startsWith("vakera-token-")) {
      userId = token.replace("vakera-token-", "");
    } else {
      try {
        const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
        userId = decoded.id;
      } catch {
        userId = token;
      }
    }

    const usuario = await UsuarioModel.buscarPorId(userId);

    if (!usuario) {
      return error(res, "Sesión inválida o expirada.", 401);
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    return error(res, "Error al autenticar sesión.", 401, err.message);
  }
}

module.exports = authMiddleware;
