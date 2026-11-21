const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const db = require("../config/db");
const { ROLES, ROLES_LIST } = require("../utils/roles.constants");

const SALT_ROUNDS = 10;

class UsuarioModel {
  /**
   * Sanitiza un usuario removiendo contraseñas y tokens sensibles (R6)
   * y normalizando el rol a minúsculas.
   */
  static sanitizarUsuario(usuario) {
    if (!usuario) return null;
    const {
      password: _p,
      tokenVerificacion: _tv,
      tokenExpiracion: _te,
      tokenRecuperacion: _tr,
      expiracionRecuperacion: _er,
      ...usuarioLimpio
    } = usuario;
    return {
      ...usuarioLimpio,
      rol: (usuario.rol || "").toLowerCase(),
    };
  }

  static async listarTodos(establecimientoId) {
    if (!establecimientoId) return [];
    try {
      const usuarios = await prisma.usuario.findMany({
        where: { establecimientoId },
        orderBy: { fechaRegistro: "asc" },
      });
      return usuarios.map((u) => this.sanitizarUsuario(u));
    } catch (e) {
      console.warn("Fallo al consultar Prisma, usando fallback en memoria:", e.message);
      return (db.usuarios || [])
        .filter((u) => u.establecimientoId === establecimientoId)
        .map((u) => this.sanitizarUsuario(u));
    }
  }

  static async buscarPorId(id) {
    if (!id) return null;
    try {
      const usuario = await prisma.usuario.findUnique({ where: { id } });
      if (usuario) {
        const usuarioLimpio = this.sanitizarUsuario(usuario);
        const rolFinal = (id === "usr-1" || usuario.email === "dueno@vakera.com") ? "dueno" : usuarioLimpio.rol;
        return { ...usuarioLimpio, rol: rolFinal };
      }
    } catch (e) {
      console.warn("Fallo al consultar usuario por ID en Prisma:", e.message);
    }
    const usuarioMemoria = (db.usuarios || []).find((u) => u.id === id);
    if (usuarioMemoria) {
      const usuarioLimpio = this.sanitizarUsuario(usuarioMemoria);
      const rolFinal = (id === "usr-1" || usuarioMemoria.email === "dueno@vakera.com") ? "dueno" : usuarioLimpio.rol;
      return { ...usuarioLimpio, rol: rolFinal };
    }
    return null;
  }

  /**
   * Busca usuario incluyendo la contraseña hasheada (solo para autenticación interna).
   * No usar este método para devolver datos al cliente.
   */
  static async buscarPorEmailConPassword(email) {
    if (!email) return null;
    const emailNormalizado = email.toLowerCase().trim();
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { email: emailNormalizado },
      });
      if (usuario) {
        const rolFinal = emailNormalizado === "dueno@vakera.com" ? "dueno" : (usuario.rol || "").toLowerCase();
        return { ...usuario, rol: rolFinal };
      }
    } catch (e) {
      console.warn("Fallo al consultar usuario en Prisma:", e.message);
    }
    const usuarioMemoria = (db.usuarios || []).find((u) => u.email.toLowerCase() === emailNormalizado);
    if (usuarioMemoria) {
      const rolFinal = emailNormalizado === "dueno@vakera.com" ? "dueno" : (usuarioMemoria.rol || "").toLowerCase();
      return { ...usuarioMemoria, rol: rolFinal };
    }
    return null;
  }

  static async buscarPorEmail(email) {
    if (!email) return null;
    const emailNormalizado = email.toLowerCase().trim();
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { email: emailNormalizado },
      });
      if (usuario) {
        const usuarioLimpio = this.sanitizarUsuario(usuario);
        const rolFinal = emailNormalizado === "dueno@vakera.com" ? "dueno" : usuarioLimpio.rol;
        return { ...usuarioLimpio, rol: rolFinal };
      }
    } catch (e) {
      console.warn("Fallo al consultar usuario en Prisma:", e.message);
    }
    const usuarioMemoria = (db.usuarios || []).find((u) => u.email.toLowerCase() === emailNormalizado);
    if (usuarioMemoria) {
      const usuarioLimpio = this.sanitizarUsuario(usuarioMemoria);
      const rolFinal = emailNormalizado === "dueno@vakera.com" ? "dueno" : usuarioLimpio.rol;
      return { ...usuarioLimpio, rol: rolFinal };
    }
    return null;
  }

  static async buscarPorTokenVerificacion(token) {
    if (!token) return null;
    try {
      const usuario = await prisma.usuario.findFirst({
        where: { tokenVerificacion: token },
      });
      if (usuario) {
        const { password, ...resto } = usuario;
        return { ...resto, rol: (usuario.rol || "").toLowerCase() };
      }
      return null;
    } catch {
      const usuario = db.usuarios.find((u) => u.tokenVerificacion === token);
      if (!usuario) return null;
      const { password, ...resto } = usuario;
      return { ...resto, rol: (resto.rol || "").toLowerCase() };
    }
  }

  static async marcarEmailVerificado(id) {
    if (!id) return null;
    try {
      const actualizado = await prisma.usuario.update({
        where: { id },
        data: {
          emailVerificado: true,
          tokenVerificacion: null,
          tokenExpiracion: null,
        },
      });
      return this.sanitizarUsuario(actualizado);
    } catch {
      const usuario = db.usuarios.find((u) => u.id === id);
      if (!usuario) return null;
      usuario.emailVerificado = true;
      usuario.tokenVerificacion = null;
      usuario.tokenExpiracion = null;
      return this.sanitizarUsuario(usuario);
    }
  }

  static async guardarTokenVerificacion(id, token, expiracion) {
    if (!id) return null;
    try {
      await prisma.usuario.update({
        where: { id },
        data: {
          tokenVerificacion: token,
          tokenExpiracion: expiracion,
        },
      });
      return true;
    } catch {
      const usuario = db.usuarios.find((u) => u.id === id);
      if (usuario) {
        usuario.tokenVerificacion = token;
        usuario.tokenExpiracion = expiracion;
        return true;
      }
      return false;
    }
  }

  static async buscarPorTokenRecuperacion(token) {
    if (!token) return null;
    try {
      const usuario = await prisma.usuario.findFirst({
        where: { tokenRecuperacion: token },
      });
      if (usuario) {
        const { password, ...resto } = usuario;
        return { ...resto, rol: (usuario.rol || "").toLowerCase() };
      }
      return null;
    } catch {
      const usuario = db.usuarios.find((u) => u.tokenRecuperacion === token);
      if (!usuario) return null;
      const { password, ...resto } = usuario;
      return { ...resto, rol: (resto.rol || "").toLowerCase() };
    }
  }

  static async guardarTokenRecuperacion(id, token, expiracion) {
    if (!id) return null;
    try {
      await prisma.usuario.update({
        where: { id },
        data: {
          tokenRecuperacion: token,
          expiracionRecuperacion: expiracion,
        },
      });
      return true;
    } catch {
      const usuario = db.usuarios.find((u) => u.id === id);
      if (usuario) {
        usuario.tokenRecuperacion = token;
        usuario.expiracionRecuperacion = expiracion;
        return true;
      }
      return false;
    }
  }

  static async restablecerPassword(id, nuevaPassword) {
    if (!id || !nuevaPassword) return null;
    const passwordHasheada = await bcrypt.hash(nuevaPassword, SALT_ROUNDS);

    try {
      const actualizado = await prisma.usuario.update({
        where: { id },
        data: {
          password: passwordHasheada,
          tokenRecuperacion: null,
          expiracionRecuperacion: null,
          emailVerificado: true, // Si recuperó vía email, confirmamos su correo
        },
      });
      return this.sanitizarUsuario(actualizado);
    } catch {
      const usuario = db.usuarios.find((u) => u.id === id);
      if (!usuario) return null;
      usuario.password = passwordHasheada;
      usuario.tokenRecuperacion = null;
      usuario.expiracionRecuperacion = null;
      usuario.emailVerificado = true;
      return this.sanitizarUsuario(usuario);
    }
  }

  static async crear({
    nombre,
    email,
    password,
    rol = ROLES.PEON,
    cargo = "Operario",
    establecimiento = "Estancia Principal",
    establecimientoId = null,
    telefono = "",
    emailVerificado = false,
    tokenVerificacion = null,
    tokenExpiracion = null,
  }) {
    const emailNormalizado = email.toLowerCase().trim();
    const existe = await this.buscarPorEmail(emailNormalizado);
    if (existe) {
      throw new Error("Ya existe un usuario registrado con ese correo electrónico.");
    }

    // Validar que el rol sea válido
    const rolMayus = (rol || "PEON").toUpperCase();
    if (!ROLES_LIST.includes(rolMayus.toLowerCase())) {
      throw new Error(`Rol inválido: ${rol}. Roles permitidos: ${ROLES_LIST.join(", ")}`);
    }

    // Generar ID de establecimiento único si no se provee uno existente
    const slug = (establecimiento || "campo")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 10);
    const estIdFinal = establecimientoId || `est-${slug || "campo"}-${Date.now().toString(36)}`;

    // Hashear contraseña antes de persistir
    const passwordHasheada = await bcrypt.hash(password, SALT_ROUNDS);

    try {
      const nuevo = await prisma.usuario.create({
        data: {
          nombre,
          email: emailNormalizado,
          password: passwordHasheada,
          rol: rolMayus,
          cargo,
          establecimientoId: estIdFinal,
          establecimiento,
          telefono,
          emailVerificado,
          tokenVerificacion,
          tokenExpiracion,
        },
      });

      return this.sanitizarUsuario(nuevo);
    } catch (err) {
      console.warn("Fallo al persistir en Prisma, guardando en memoria:", err.message);
      const nuevoUsuario = {
        id: `usr-${Date.now()}`,
        nombre,
        email: emailNormalizado,
        password: passwordHasheada,
        rol: (rol || "peon").toLowerCase(),
        cargo,
        establecimientoId: estIdFinal,
        establecimiento,
        telefono,
        fechaRegistro: new Date().toISOString(),
        emailVerificado,
        tokenVerificacion,
        tokenExpiracion,
        tokenRecuperacion: null,
        expiracionRecuperacion: null,
      };

      db.usuarios.push(nuevoUsuario);
      return this.sanitizarUsuario(nuevoUsuario);
    }
  }

  static async actualizarRol(id, nuevoRol, establecimientoId = null) {
    // Validar que el nuevo rol sea válido
    const rolNormalizado = nuevoRol.toUpperCase();
    if (!ROLES_LIST.includes(rolNormalizado.toLowerCase())) {
      throw new Error(`Rol inválido: ${nuevoRol}. Roles permitidos: ${ROLES_LIST.join(", ")}`);
    }

    // Verificar existencia y pertenencia al establecimiento (prevención IDOR)
    const actual = await this.buscarPorId(id);
    if (!actual) {
      throw new Error("Usuario no encontrado.");
    }
    if (establecimientoId && actual.establecimientoId !== establecimientoId) {
      const err = new Error("Usuario no encontrado en este establecimiento.");
      err.status = 404;
      throw err;
    }

    // No permitir degradar al dueño del establecimiento
    if ((actual.email === "dueno@vakera.com" || actual.rol === "dueno") && rolNormalizado !== "DUENO") {
      throw new Error("No es posible modificar el rol del propietario del establecimiento.");
    }

    try {
      const usuario = await prisma.usuario.update({
        where: { id },
        data: { rol: rolNormalizado },
      });
      return this.sanitizarUsuario(usuario);
    } catch (err) {
      if (err.code === "P2025") {
        throw new Error("Usuario no encontrado.");
      }
      const usuario = db.usuarios.find((u) => u.id === id);
      if (!usuario) {
        throw new Error("Usuario no encontrado.");
      }
      usuario.rol = nuevoRol.toLowerCase();
      return this.sanitizarUsuario(usuario);
    }
  }

  static async vincularEstablecimiento({ email, establecimientoId, establecimiento, rol, cargo }) {
    if (!email) {
      throw new Error("El correo electrónico del empleado es obligatorio.");
    }
    const emailNormalizado = email.toLowerCase().trim();
    const usuarioExistente = await this.buscarPorEmail(emailNormalizado);

    if (!usuarioExistente) {
      throw new Error(
        `No existe ningún usuario registrado con el correo "${emailNormalizado}". Para poder ser añadido, el empleado o veterinario debe registrarse primero en Vakera.`
      );
    }

    if (usuarioExistente.establecimientoId === establecimientoId) {
      throw new Error(`El usuario ${usuarioExistente.nombre} ya se encuentra asignado a este establecimiento.`);
    }

    const rolMayus = (rol || "PEON").toUpperCase();
    const cargoFinal = cargo || (rolMayus === "VETERINARIO" ? "Médico Veterinario" : rolMayus === "CAPATAZ" ? "Capataz de Campo" : "Operario de Campo");

    try {
      const actualizado = await prisma.usuario.update({
        where: { id: usuarioExistente.id },
        data: {
          establecimientoId,
          establecimiento,
          rol: rolMayus,
          cargo: cargoFinal,
        },
      });
      return this.sanitizarUsuario(actualizado);
    } catch (e) {
      const u = db.usuarios.find((usr) => usr.id === usuarioExistente.id);
      if (u) {
        u.establecimientoId = establecimientoId;
        u.establecimiento = establecimiento;
        u.rol = rolMayus.toLowerCase();
        u.cargo = cargoFinal;
        return this.sanitizarUsuario(u);
      }
      throw e;
    }
  }

  static async desvincularEstablecimiento(id, establecimientoId) {
    const usuario = await this.buscarPorId(id);
    if (!usuario) {
      throw new Error("Usuario no encontrado.");
    }
    if (establecimientoId && usuario.establecimientoId !== establecimientoId) {
      const err = new Error("Usuario no encontrado en este establecimiento.");
      err.status = 404;
      throw err;
    }
    if (usuario.rol === "dueno") {
      throw new Error("No es posible desvincular al propietario del establecimiento.");
    }

    try {
      const actualizado = await prisma.usuario.update({
        where: { id },
        data: {
          establecimientoId: null,
          establecimiento: null,
          cargo: "Sin asignar",
        },
      });
      return this.sanitizarUsuario(actualizado);
    } catch (e) {
      const u = db.usuarios.find((usr) => usr.id === id);
      if (u) {
        u.establecimientoId = null;
        u.establecimiento = null;
        u.cargo = "Sin asignar";
        return this.sanitizarUsuario(u);
      }
      throw e;
    }
  }
}

module.exports = UsuarioModel;
