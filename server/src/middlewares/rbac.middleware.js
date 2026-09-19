const { error } = require("../utils/apiResponse");

/**
 * Middleware para validar si el usuario autenticado posee uno de los roles permitidos.
 * @param  {...string} rolesPermitidos - Lista de roles con permiso (ej: 'dueno', 'capataz')
 */
function rbacMiddleware(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return error(res, "Autenticación requerida para acceder a este recurso.", 401);
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return error(
        res,
        `Acceso denegado. Se requiere uno de los siguientes roles: [${rolesPermitidos.join(", ")}]. Tu rol actual es '${req.usuario.rol}'.`,
        403
      );
    }

    next();
  };
}

module.exports = rbacMiddleware;
