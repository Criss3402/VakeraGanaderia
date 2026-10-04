const prisma = require("../config/prisma");
const db = require("../config/db");
const { ROLES, ROLES_LIST } = require("../utils/roles.constants");

class UsuarioModel {
  static async listarTodos() {
    try {
      const usuarios = await prisma.usuario.findMany({
        orderBy: { fechaRegistro: "asc" },
      });
      return usuarios.map(({ password, ...u }) => ({
        ...u,
        rol: (u.rol || "").toLowerCase(),
      }));
    } catch (e) {
      console.warn("Fallo al consultar Prisma, usando fallback en memoria:", e.message);
      return db.usuarios.map(({ password, ...u }) => u);
    }
  }

  static async buscarPorId(id) {
    try {
      const usuario = await prisma.usuario.findUnique({ where: { id } });
      if (!usuario) return null;
      const { password, ...resto } = usuario;
      return { ...resto, rol: (usuario.rol || "").toLowerCase() };
    } catch {
      const usuario = db.usuarios.find((u) => u.id === id);
      if (!usuario) return null;
      const { password, ...resto } = usuario;
      return resto;
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
        return { ...usuario, rol: (usuario.rol || "").toLowerCase() };
      }
      return null;
    } catch {
      return db.usuarios.find((u) => u.email.toLowerCase() === emailNormalizado);
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
  }) {
    const emailNormalizado = email.toLowerCase().trim();
    const existe = await this.buscarPorEmail(emailNormalizado);
    if (existe) {
      throw new Error("Ya existe un usuario registrado con ese correo electrónico.");
    }

    const rolMayus = (rol || "PEON").toUpperCase();

    try {
      const nuevo = await prisma.usuario.create({
        data: {
          nombre,
          email: emailNormalizado,
          password,
          rol: rolMayus,
          cargo,
          establecimiento,
          telefono,
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
        password,
        rol: (rol || "peon").toLowerCase(),
        cargo,
        establecimiento,
        telefono,
        fechaRegistro: new Date().toISOString(),
      };

      db.usuarios.push(nuevoUsuario);
      const { password: _, ...usuarioCreado } = nuevoUsuario;
      return usuarioCreado;
    }
  }

  static async actualizarRol(id, nuevoRol) {
    const rolMayus = nuevoRol.toUpperCase();
    try {
      const usuario = await prisma.usuario.update({
        where: { id },
        data: { rol: rolMayus },
      });
      const { password, ...usuarioActualizado } = usuario;
      return { ...usuarioActualizado, rol: (usuario.rol || "").toLowerCase() };
    } catch {
      const usuario = db.usuarios.find((u) => u.id === id);
      if (!usuario) {
        throw new Error("Usuario no encontrado.");
      }
      usuario.rol = nuevoRol.toLowerCase();
      const { password, ...usuarioActualizado } = usuario;
      return usuarioActualizado;
    }
  }
}

module.exports = UsuarioModel;
