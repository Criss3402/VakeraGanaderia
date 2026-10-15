const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UsuarioModel = require("../models/usuario.model");
const { exito, error } = require("../utils/apiResponse");

const JWT_SECRET = process.env.JWT_SECRET || "vakera_dev_secret_no_usar_en_produccion";
const JWT_EXPIRES_IN = "8h";

function generarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

class AuthController {
  static async login(req, res) {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return error(res, "Email y contraseña son obligatorios.", 400);
    }

    // Obtener usuario con password (método especial)
    const usuario = await UsuarioModel.buscarPorEmailConPassword(email);

    if (!usuario) {
      // Mensaje genérico para no revelar qué campo es incorrecto
      return error(res, "Credenciales incorrectas.", 401);
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      return error(res, "Credenciales incorrectas.", 401);
    }

    const token = generarToken(usuario);
    const { password: _, ...usuarioSinPassword } = usuario;

    return exito(res, {
      token,
      usuario: usuarioSinPassword,
    }, "Inicio de sesión exitoso.");
  }

  static async registro(req, res) {
    const { nombre, email, password, rol, cargo, establecimiento } = req.body || {};

    if (!nombre || !email || !password) {
      return error(res, "Nombre, email y contraseña son obligatorios.", 400);
    }

    if (password.length < 6) {
      return error(res, "La contraseña debe tener al menos 6 caracteres.", 400);
    }

    // Validación básica de formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return error(res, "El formato del correo electrónico no es válido.", 400);
    }

    try {
      const nuevoUsuario = await UsuarioModel.crear({
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

  /**
   * Solo disponible en modo de desarrollo/demo.
   * No expone contraseñas — solo devuelve datos públicos del usuario.
   */
  static async obtenerUsuariosDemo(req, res) {
    if (process.env.NODE_ENV === "production") {
      return error(res, "Endpoint no disponible en producción.", 403);
    }

    const lista = await UsuarioModel.listarTodos();
    const usuariosDemo = lista.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      cargo: u.cargo,
      // La contraseña demo es pública por diseño en entorno de desarrollo
      passwordDemo: "password123",
    }));

    return exito(res, usuariosDemo);
  }
}

module.exports = AuthController;
