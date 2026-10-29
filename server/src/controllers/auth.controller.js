const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UsuarioModel = require("../models/usuario.model");
const emailService = require("../services/email.service");
const { exito, error } = require("../utils/apiResponse");

const JWT_SECRET = process.env.JWT_SECRET || "vakera_dev_secret_no_usar_en_produccion";
const JWT_EXPIRES_IN = "8h";

function generarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      establecimientoId: usuario.establecimientoId,
      establecimiento: usuario.establecimiento,
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

    // Obtener usuario con password
    const usuario = await UsuarioModel.buscarPorEmailConPassword(email);

    if (!usuario) {
      return error(res, "Credenciales incorrectas.", 401);
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      return error(res, "Credenciales incorrectas.", 401);
    }

    // Comprobación de cuenta verificada
    if (usuario.emailVerificado === false) {
      return error(
        res,
        "Tu cuenta aún no ha sido activada. Por favor confirma tu correo electrónico.",
        403,
        { requiereVerificacion: true, email: usuario.email }
      );
    }

    const token = generarToken(usuario);
    const { password: _, ...usuarioSinPassword } = usuario;

    return exito(
      res,
      {
        token,
        usuario: usuarioSinPassword,
      },
      "Inicio de sesión exitoso."
    );
  }

  static async registro(req, res) {
    const { nombre, email, password, rol, cargo, establecimiento, establecimientoId, telefono } = req.body || {};

    if (!nombre || !email || !password) {
      return error(res, "Nombre, email y contraseña son obligatorios.", 400);
    }

    if (password.length < 6) {
      return error(res, "La contraseña debe tener al menos 6 caracteres.", 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return error(res, "El formato del correo electrónico no es válido.", 400);
    }

    try {
      // Generar código numérico amigable de 6 dígitos para verificación
      const tokenVerificacion = Math.floor(100000 + Math.random() * 900000).toString();
      const tokenExpiracion = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      const nuevoUsuario = await UsuarioModel.crear({
        nombre,
        email,
        password,
        rol: rol || "dueno",
        cargo: cargo || (rol === "dueno" ? "Propietario / Director" : "Colaborador"),
        establecimiento: establecimiento || "Mi Establecimiento Ganadero",
        establecimientoId,
        telefono,
        emailVerificado: false,
        tokenVerificacion,
        tokenExpiracion,
      });

      // Despachar correo de activación
      const urlBase = req.headers.origin || "http://localhost:5173";
      await emailService.enviarEmailVerificacion({
        email: nuevoUsuario.email,
        nombre: nuevoUsuario.nombre,
        token: tokenVerificacion,
        urlBase,
      });

      return exito(
        res,
        {
          requiereVerificacion: true,
          email: nuevoUsuario.email,
          usuario: nuevoUsuario,
        },
        "Usuario registrado exitosamente. Te enviamos un correo electrónico con tu código de activación.",
        201
      );
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Valida el token recibido y activa la cuenta del usuario.
   */
  static async verificarEmail(req, res) {
    const token = req.body?.token || req.query?.token;

    if (!token) {
      return error(res, "El token de activación es obligatorio.", 400);
    }

    try {
      const usuario = await UsuarioModel.buscarPorTokenVerificacion(token);

      if (!usuario) {
        return error(
          res,
          "El código o enlace de activación es inválido o ya ha sido utilizado.",
          400
        );
      }

      if (usuario.tokenExpiracion && new Date(usuario.tokenExpiracion) < new Date()) {
        return error(
          res,
          "El enlace de activación ha expirado. Por favor solicita un nuevo envío.",
          400,
          { expirado: true, email: usuario.email }
        );
      }

      const usuarioActivado = await UsuarioModel.marcarEmailVerificado(usuario.id);
      const tokenSesion = generarToken(usuarioActivado);

      return exito(
        res,
        {
          token: tokenSesion,
          usuario: usuarioActivado,
        },
        "¡Cuenta activada exitosamente! Ya podés utilizar Vakera."
      );
    } catch (err) {
      return error(res, `Error al verificar cuenta: ${err.message}`, 500);
    }
  }

  /**
   * Reenvía el correo de verificación en caso de extravío o expiración.
   */
  static async reenviarVerificacion(req, res) {
    const { email } = req.body || {};

    if (!email) {
      return error(res, "El correo electrónico es obligatorio.", 400);
    }

    try {
      const usuario = await UsuarioModel.buscarPorEmail(email);

      if (!usuario) {
        return error(res, "No existe ninguna cuenta registrada con este correo.", 404);
      }

      if (usuario.emailVerificado) {
        return error(res, "Esta cuenta ya está verificada. Podés iniciar sesión normalmente.", 400);
      }

      const nuevoToken = Math.floor(100000 + Math.random() * 900000).toString();
      const nuevaExpiracion = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await UsuarioModel.guardarTokenVerificacion(usuario.id, nuevoToken, nuevaExpiracion);

      const urlBase = req.headers.origin || "http://localhost:5173";
      await emailService.enviarEmailVerificacion({
        email: usuario.email,
        nombre: usuario.nombre,
        token: nuevoToken,
        urlBase,
      });

      return exito(
        res,
        { email: usuario.email },
        "Hemos reenviado el correo de verificación. Revisá tu bandeja de entrada o spam."
      );
    } catch (err) {
      return error(res, `Error al reenviar verificación: ${err.message}`, 500);
    }
  }

  /**
   * Genera token para recuperar contraseña y despacha el correo.
   */
  static async solicitarRecuperacion(req, res) {
    const { email } = req.body || {};

    if (!email) {
      return error(res, "El correo electrónico es obligatorio.", 400);
    }

    try {
      const usuario = await UsuarioModel.buscarPorEmail(email);

      // Respuesta neutral por seguridad si no existe
      if (!usuario) {
        return exito(
          res,
          null,
          "Si el correo se encuentra registrado, recibirás un enlace y código de seguridad para restablecer tu contraseña."
        );
      }

      // Código de 6 dígitos para recuperación
      const tokenRecuperacion = Math.floor(100000 + Math.random() * 900000).toString();
      const expiracion = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await UsuarioModel.guardarTokenRecuperacion(usuario.id, tokenRecuperacion, expiracion);

      const urlBase = req.headers.origin || "http://localhost:5173";
      await emailService.enviarEmailRecuperacion({
        email: usuario.email,
        nombre: usuario.nombre,
        token: tokenRecuperacion,
        urlBase,
      });

      return exito(
        res,
        null,
        "Si el correo se encuentra registrado, recibirás un código de seguridad para restablecer tu contraseña."
      );
    } catch (err) {
      return error(res, `Error al procesar solicitud: ${err.message}`, 500);
    }
  }

  /**
   * Establece una nueva contraseña utilizando el token de recuperación.
   */
  static async restablecerPassword(req, res) {
    const { token, nuevaPassword } = req.body || {};

    if (!token || !nuevaPassword) {
      return error(res, "Token y nueva contraseña son obligatorios.", 400);
    }

    if (nuevaPassword.length < 6) {
      return error(res, "La contraseña debe tener al menos 6 caracteres.", 400);
    }

    try {
      const usuario = await UsuarioModel.buscarPorTokenRecuperacion(token);

      if (!usuario) {
        return error(
          res,
          "El código o enlace de recuperación es inválido o ya ha sido utilizado.",
          400
        );
      }

      if (usuario.expiracionRecuperacion && new Date(usuario.expiracionRecuperacion) < new Date()) {
        return error(
          res,
          "El enlace de recuperación ha expirado. Por favor solicita uno nuevo.",
          400
        );
      }

      const usuarioActualizado = await UsuarioModel.restablecerPassword(usuario.id, nuevaPassword);
      const tokenSesion = generarToken(usuarioActualizado);

      return exito(
        res,
        {
          token: tokenSesion,
          usuario: usuarioActualizado,
        },
        "Contraseña actualizada exitosamente. Ya podés acceder a tu cuenta."
      );
    } catch (err) {
      return error(res, `Error al restablecer contraseña: ${err.message}`, 500);
    }
  }

  static me(req, res) {
    if (!req.usuario) {
      return error(res, "No autorizado.", 401);
    }
    return exito(res, { usuario: req.usuario });
  }
}

module.exports = AuthController;
