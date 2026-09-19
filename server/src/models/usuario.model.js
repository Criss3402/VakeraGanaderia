const db = require("../config/db");
const { ROLES, ROLES_LIST } = require("../utils/roles.constants");

class UsuarioModel {
  static listarTodos() {
    return db.usuarios.map(({ password, ...u }) => u);
  }

  static buscarPorId(id) {
    const usuario = db.usuarios.find((u) => u.id === id);
    if (!usuario) return null;
    const { password, ...resto } = usuario;
    return resto;
  }

  static buscarPorEmail(email) {
    return db.usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  static crear({ nombre, email, password, rol = ROLES.PEON, cargo = "Operario", establecimiento = "Estancia Principal" }) {
    if (!ROLES_LIST.includes(rol)) {
      throw new Error(`El rol ${rol} no es válido.`);
    }

    const existe = this.buscarPorEmail(email);
    if (existe) {
      throw new Error("Ya existe un usuario registrado con ese correo electrónico.");
    }

    const nuevoUsuario = {
      id: `usr-${Date.now()}`,
      nombre,
      email: email.toLowerCase(),
      password,
      rol,
      cargo,
      establecimiento,
      telefono: "",
      fechaRegistro: new Date().toISOString(),
    };

    db.usuarios.push(nuevoUsuario);
    const { password: _, ...usuarioCreado } = nuevoUsuario;
    return usuarioCreado;
  }

  static actualizarRol(id, nuevoRol) {
    if (!ROLES_LIST.includes(nuevoRol)) {
      throw new Error(`El rol ${nuevoRol} no es válido en el sistema.`);
    }

    const usuario = db.usuarios.find((u) => u.id === id);
    if (!usuario) {
      throw new Error("Usuario no encontrado.");
    }

    usuario.rol = nuevoRol;
    const { password, ...usuarioActualizado } = usuario;
    return usuarioActualizado;
  }
}

module.exports = UsuarioModel;
