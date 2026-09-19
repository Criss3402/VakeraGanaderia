const UsuarioModel = require("../models/usuario.model");
const { exito, error } = require("../utils/apiResponse");

function generarToken(usuario) {
  const payload = {
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    timestamp: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

class AuthController {
  static login(req, res) {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return error(res, "Email y contraseña son obligatorios.", 400);
    }

    const usuario = UsuarioModel.buscarPorEmail(email);

    if (!usuario || usuario.password !== password) {
      return error(res, "Credenciales incorrectas. Verifique email y contraseña.", 401);
    }

    const token = generarToken(usuario);
    const { password: _, ...usuarioSinPassword } = usuario;

    return exito(res, {
      token,
      usuario: usuarioSinPassword,
    }, "Inicio de sesión exitoso.");
  }

  static registro(req, res) {
    const { nombre, email, password, rol, cargo, establecimiento } = req.body || {};

    if (!nombre || !email || !password) {
      return error(res, "Nombre, email y contraseña son obligatorios.", 400);
    }

    try {
      const nuevoUsuario = UsuarioModel.crear({
        nombre,
        email,
        password,
        rol,
        cargo,
        establecimiento,
      });

      const token = generarToken(nuevoUsuario);

      return exito(res, {
        token,
        usuario: nuevoUsuario,
      }, "Usuario registrado exitosamente.", 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static me(req, res) {
    if (!req.usuario) {
      return error(res, "No autorizado.", 401);
    }
    return exito(res, { usuario: req.usuario });
  }

  static obtenerUsuariosDemo(req, res) {
    const usuariosDemo = UsuarioModel.listarTodos().map((u) => ({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      cargo: u.cargo,
      passwordDemo: "password123",
    }));

    return exito(res, usuariosDemo);
  }
}

module.exports = AuthController;
