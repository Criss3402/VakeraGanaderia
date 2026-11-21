const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UsuarioModel = require("../models/usuario.model");
const emailService = require("../services/email.service");
const { exito, error } = require("../utils/apiResponse");

const { ROLES } = require("../utils/roles.constants");

const { JWT_SECRET } = require("../config/env");
const JWT_EXPIRES_IN = "8h";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const estadosOAuthGoogle = new Map();

const CARGOS_POR_ROL = {
  [ROLES.DUENO]: "Propietario / Director",
  [ROLES.CAPATAZ]: "Capataz de Campo",
  [ROLES.PEON]: "Operario de Campo",
  [ROLES.OFICINA]: "Administrador / Compras",
  [ROLES.VETERINARIO]: "Médico Veterinario",
};

function limpiarEstadosOAuthExpirados() {
  const ahora = Date.now();
  for (const [clave, valor] of estadosOAuthGoogle.entries()) {
    if (!valor || valor.expira <= ahora) {
      estadosOAuthGoogle.delete(clave);
    }
  }
}

function obtenerFrontendUrl(req) {
  return (
    process.env.FRONTEND_URL ||
    req?.headers?.origin ||
    "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function obtenerGoogleRedirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  const host = req?.get?.("host") || "localhost:4000";
  const proto = req?.protocol || "http";
  return `${proto}://${host}/api/auth/google/callback`;
}

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
    const usuarioSinPassword = UsuarioModel.sanitizarUsuario(usuario);

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
    const { nombre, email, password, rol, cargo, establecimiento, telefono } = req.body || {};

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
      // Generar código numérico criptográfico de 6 dígitos para verificación
      const tokenVerificacion = crypto.randomInt(100000, 1000000).toString();
      const tokenExpiracion = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      const nuevoUsuario = await UsuarioModel.crear({
        nombre,
        email,
        password,
        rol: rol || "dueno",
        cargo: cargo || (rol === "dueno" ? "Propietario / Director" : "Colaborador"),
        establecimiento: establecimiento || "Mi Establecimiento Ganadero",
        establecimientoId: undefined, // Seguridad (R2): ignorar establecimientoId externo en registro público
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

      const nuevoToken = crypto.randomInt(100000, 1000000).toString();
      const nuevaExpiracion = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await UsuarioModel.guardarTokenVerificacion(usuario.id, nuevoToken, nuevaExpiracion);

      const urlBase = process.env.FRONTEND_URL || "http://localhost:5173";
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
      const tokenRecuperacion = crypto.randomInt(100000, 1000000).toString();
      const expiracion = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await UsuarioModel.guardarTokenRecuperacion(usuario.id, tokenRecuperacion, expiracion);

      const urlBase = process.env.FRONTEND_URL || "http://localhost:5173";
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

  static estadoGoogle(req, res) {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    return exito(res, {
      configurado: Boolean(clientId && clientSecret),
      redirectUri: obtenerGoogleRedirectUri(req),
    });
  }

  static iniciarGoogle(req, res) {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const frontendUrl = obtenerFrontendUrl(req);
    const modo = req.query?.modo === "registro" ? "registro" : "login";
    const rolSolicitado = String(req.query?.rol || ROLES.DUENO).toLowerCase().trim();
    const rolValido = Object.values(ROLES).includes(rolSolicitado) ? rolSolicitado : ROLES.DUENO;
    const establecimiento = String(req.query?.establecimiento || "").trim().slice(0, 120);

    if (!clientId || !clientSecret) {
      const msg = "El acceso con Google aún no está configurado en el servidor (faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET).";
      return res.redirect(`${frontendUrl}/?ruta=${modo}&googleError=${encodeURIComponent(msg)}`);
    }

    limpiarEstadosOAuthExpirados();
    const state = crypto.randomBytes(24).toString("hex");
    const redirectUri = obtenerGoogleRedirectUri(req);

    estadosOAuthGoogle.set(state, {
      frontendUrl,
      redirectUri,
      modo,
      rol: rolValido,
      establecimiento,
      expira: Date.now() + 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });

    return res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  }

  static async callbackGoogle(req, res) {
    const { code, state, error: oauthError } = req.query || {};
    const registroEstado = state ? estadosOAuthGoogle.get(String(state)) : null;
    if (state) {
      estadosOAuthGoogle.delete(String(state));
    }

    const frontendUrl = registroEstado?.frontendUrl || obtenerFrontendUrl(req);
    const rutaError = registroEstado?.modo === "registro" ? "registro" : "login";

    const redirigirConError = (mensaje) =>
      res.redirect(`${frontendUrl}/?ruta=${rutaError}&googleError=${encodeURIComponent(mensaje)}`);

    if (oauthError) {
      return redirigirConError("Se canceló la autenticación con Google.");
    }

    if (!registroEstado || registroEstado.expira <= Date.now()) {
      return redirigirConError("La sesión de autorización con Google expiró o es inválida (state). Intentá nuevamente.");
    }

    if (!code) {
      return redirigirConError("Google no devolvió un código de autorización válido.");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) {
      return redirigirConError("Faltan credenciales de Google OAuth en el servidor.");
    }

    try {
      const bodyToken = new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: registroEstado.redirectUri,
        grant_type: "authorization_code",
      });

      const respToken = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: bodyToken.toString(),
      });

      const dataToken = await respToken.json().catch(() => null);
      if (!respToken.ok || !dataToken?.access_token) {
        return redirigirConError("No se pudo validar el código de autorización con Google.");
      }

      const respPerfil = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${dataToken.access_token}` },
      });

      const perfil = await respPerfil.json().catch(() => null);
      if (!respPerfil.ok || !perfil?.email) {
        return redirigirConError("No se pudo obtener el correo electrónico desde Google.");
      }

      if (perfil.email_verified === false) {
        return redirigirConError("Tu cuenta de Google no tiene el correo electrónico verificado.");
      }

      let usuario = await UsuarioModel.buscarPorEmailConPassword(perfil.email);
      if (!usuario) {
        if (registroEstado.modo !== "registro") {
          const msgNoCuenta =
            "No se encontró ninguna cuenta vinculada a esta plataforma con este correo. Por favor registrá una cuenta válida.";
          return res.redirect(
            `${frontendUrl}/?ruta=login&googleNoRegistrado=1&googleEmail=${encodeURIComponent(
              perfil.email
            )}&googleError=${encodeURIComponent(msgNoCuenta)}`
          );
        }

        const setupToken = jwt.sign(
          {
            tipo: "google_registro_pendiente",
            email: perfil.email,
            nombre: perfil.name || perfil.given_name || perfil.email.split("@")[0],
          },
          JWT_SECRET,
          { expiresIn: "15m" }
        );
        return res.redirect(
          `${frontendUrl}/?ruta=google-completar&setupToken=${encodeURIComponent(setupToken)}`
        );
      }

      if (usuario.emailVerificado === false) {
        usuario = await UsuarioModel.marcarEmailVerificado(usuario.id);
      }

      const token = generarToken(usuario);
      return res.redirect(`${frontendUrl}/?ruta=google-callback&token=${encodeURIComponent(token)}`);
    } catch (err) {
      console.error("[AuthController.callbackGoogle] Error:", err.message);
      return redirigirConError("Ocurrió un error al autenticar con Google.");
    }
  }

  static async completarRegistroGoogle(req, res) {
    const { setupToken, nombre, establecimiento, rol, cargo } = req.body || {};

    if (!setupToken) {
      return error(res, "Falta el token de verificación de Google.", 400);
    }

    let payload;
    try {
      payload = jwt.verify(setupToken, JWT_SECRET);
    } catch {
      return error(res, "La sesión de registro con Google expiró. Volvé a intentarlo.", 401);
    }

    if (!payload || payload.tipo !== "google_registro_pendiente" || !payload.email) {
      return error(res, "Token de registro de Google inválido.", 400);
    }

    const nombreLimpio = String(nombre || payload.nombre || "").trim();
    const establecimientoLimpio = String(establecimiento || "").trim();
    const rolNorm = String(rol || ROLES.PEON).toLowerCase().trim();
    const rolValido = Object.values(ROLES).includes(rolNorm) ? rolNorm : ROLES.PEON;

    if (!nombreLimpio || !establecimientoLimpio) {
      return error(res, "El nombre completo y el nombre del establecimiento son obligatorios.", 400);
    }

    try {
      let usuario = await UsuarioModel.buscarPorEmailConPassword(payload.email);
      if (!usuario) {
        usuario = await UsuarioModel.crear({
          nombre: nombreLimpio,
          email: payload.email,
          password: crypto.randomBytes(32).toString("hex"),
          rol: rolValido,
          cargo: cargo || CARGOS_POR_ROL[rolValido] || "Colaborador",
          establecimiento: establecimientoLimpio,
          emailVerificado: true,
        });
      } else if (usuario.emailVerificado === false) {
        usuario = await UsuarioModel.marcarEmailVerificado(usuario.id);
      }

      const token = generarToken(usuario);
      return exito(
        res,
        {
          token,
          usuario: UsuarioModel.sanitizarUsuario(usuario),
        },
        "Cuenta registrada con Google exitosamente.",
        201
      );
    } catch (err) {
      return error(res, err.message || "No se pudo completar el registro con Google.", 400);
    }
  }
}

AuthController._estadosOAuthGoogle = estadosOAuthGoogle;

module.exports = AuthController;
