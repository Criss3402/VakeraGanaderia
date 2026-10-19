const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const db = require("../config/db");
const { ROLES, ROLES_LIST } = require("../utils/roles.constants");

const SALT_ROUNDS = 10;

class UsuarioModel {
  static async listarTodos() {
    try {
      const usuarios = await prisma.usuario.findMany({
        orderBy: { fechaRegistro: "asc" },
      });
      return usuarios.map(({ password, ...u }) => ({
        ...u,
        // Normalizar a lowercase para consistencia en frontend y RBAC
        rol: (u.rol || "").toLowerCase(),
      }));
    } catch (e) {
      console.warn("Fallo al consultar Prisma, usando fallback en memoria:", e.message);
      return db.usuarios.map(({ password, ...u }) => ({
        ...u,
        rol: (u.rol || "").toLowerCase(),
      }));
    }
  }

  static async buscarPorId(id) {
    if (!id) return null;
    try {
      const usuario = await prisma.usuario.findUnique({ where: { id } });
      if (!usuario) return null;
      const { password, ...resto } = usuario;
      return { ...resto, rol: (usuario.rol || "").toLowerCase() };
    } catch {
      const usuario = db.usuarios.find((u) => u.id === id);
      if (!usuario) return null;
      const { password, ...resto } = usuario;
      return { ...resto, rol: (resto.rol || "").toLowerCase() };
    }
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
        return { ...usuario, rol: (usuario.rol || "").toLowerCase() };
      }
      return null;
    } catch {
      return db.usuarios.find((u) => u.email.toLowerCase() === emailNormalizado) || null;
    }
  }

  static async buscarPorEmail(email) {
    if (!email) return null;
    const emailNormalizado = email.toLowerCase().trim();
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { email: emailNormalizado },
      });
      if (usuario) {
        const { password, ...resto } = usuario;
        return { ...resto, rol: (usuario.rol || "").toLowerCase() };
      }
      return null;
    } catch {
      const usuario = db.usuarios.find((u) => u.email.toLowerCase() === emailNormalizado);
      if (!usuario) return null;
      const { password, ...resto } = usuario;
      return { ...resto, rol: (resto.rol || "").toLowerCase() };
    }
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
      const { password, ...resto } = actualizado;
      return { ...resto, rol: (actualizado.rol || "").toLowerCase() };
    } catch {
      const usuario = db.usuarios.find((u) => u.id === id);
      if (!usuario) return null;
      usuario.emailVerificado = true;
      usuario.tokenVerificacion = null;
      usuario.tokenExpiracion = null;
      const { password, ...resto } = usuario;
      return { ...resto, rol: (resto.rol || "").toLowerCase() };
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
      const { password, ...resto } = actualizado;
      return { ...resto, rol: (actualizado.rol || "").toLowerCase() };
    } catch {
      const usuario = db.usuarios.find((u) => u.id === id);
      if (!usuario) return null;
      usuario.password = passwordHasheada;
      usuario.tokenRecuperacion = null;
      usuario.expiracionRecuperacion = null;
      usuario.emailVerificado = true;
      const { password, ...resto } = usuario;
      return { ...resto, rol: (resto.rol || "").toLowerCase() };
    }
  }

  static async crear({
    nombre,
    email,
    password,
    rol = ROLES.PEON,
    cargo = "Operario",
    establecimiento = "Estancia Principal",
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
          establecimiento,
          telefono,
          emailVerificado,
          tokenVerificacion,
          tokenExpiracion,
        },
      });

      const { password: _, ...usuarioCreado } = nuevo;
      return { ...usuarioCreado, rol: (nuevo.rol || "").toLowerCase() };
    } catch (err) {
      console.warn("Fallo al persistir en Prisma, guardando en memoria:", err.message);
      const nuevoUsuario = {
        id: `usr-${Date.now()}`,
        nombre,
        email: emailNormalizado,
        password: passwordHasheada,
        rol: (rol || "peon").toLowerCase(),
        cargo,
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
      const { password: _, ...usuarioCreado } = nuevoUsuario;
      return { ...usuarioCreado, rol: (usuarioCreado.rol || "").toLowerCase() };
    }
  }

  static async actualizarRol(id, nuevoRol) {
    // Validar que el nuevo rol sea válido
    const rolNormalizado = nuevoRol.toUpperCase();
    if (!ROLES_LIST.includes(rolNormalizado.toLowerCase())) {
      throw new Error(`Rol inválido: ${nuevoRol}. Roles permitidos: ${ROLES_LIST.join(", ")}`);
    }

    try {
      const usuario = await prisma.usuario.update({
        where: { id },
        data: { rol: rolNormalizado },
      });
      const { password, ...usuarioActualizado } = usuario;
      return { ...usuarioActualizado, rol: (usuario.rol || "").toLowerCase() };
    } catch (err) {
      if (err.code === "P2025") {
        throw new Error("Usuario no encontrado.");
      }
      const usuario = db.usuarios.find((u) => u.id === id);
      if (!usuario) {
        throw new Error("Usuario no encontrado.");
      }
      usuario.rol = nuevoRol.toLowerCase();
      const { password, ...usuarioActualizado } = usuario;
      return { ...usuarioActualizado, rol: (usuarioActualizado.rol || "").toLowerCase() };
    }
  }
}

module.exports = UsuarioModel;
