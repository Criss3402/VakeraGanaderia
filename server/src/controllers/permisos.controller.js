const UsuarioModel = require("../models/usuario.model");
const { ROLES, ROLES_INFO } = require("../utils/roles.constants");
const { exito, error } = require("../utils/apiResponse");

const MATRIZ_PERMISOS = {
  [ROLES.DUENO]: {
    descripcion: "Control total, auditoría ejecutiva y finanzas",
    modulos: {
      dashboardEjecutivo: true,
      gestionUsuarios: true,
      controlSanitario: true,
      gestionInsumos: true,
      aprobacionGastos: true,
      partesDiariosLectura: true,
      partesDiariosEdicion: true,
      asignacionTareas: true,
    },
  },
  [ROLES.CAPATAZ]: {
    descripcion: "Supervisión operativa y validación de campo",
    modulos: {
      dashboardEjecutivo: false,
      gestionUsuarios: false,
      controlSanitario: true,
      gestionInsumos: true,
      aprobacionGastos: false,
      partesDiariosLectura: true,
      partesDiariosEdicion: true,
      asignacionTareas: true,
    },
  },
  [ROLES.PEON]: {
    descripcion: "Carga de partes operativos e inventario local",
    modulos: {
      dashboardEjecutivo: false,
      gestionUsuarios: false,
      controlSanitario: false,
      gestionInsumos: false,
      aprobacionGastos: false,
      partesDiariosLectura: true,
      partesDiariosEdicion: true,
      asignacionTareas: false,
    },
  },
  [ROLES.OFICINA]: {
    descripcion: "Administración, comprobantes y compras",
    modulos: {
      dashboardEjecutivo: true,
      gestionUsuarios: false,
      controlSanitario: true,
      gestionInsumos: true,
      aprobacionGastos: true,
      partesDiariosLectura: true,
      partesDiariosEdicion: false,
      asignacionTareas: false,
    },
  },
  [ROLES.VETERINARIO]: {
    descripcion: "Salud animal, planes de vacunación y recetas",
    modulos: {
      dashboardEjecutivo: false,
      gestionUsuarios: false,
      controlSanitario: true,
      gestionInsumos: true,
      aprobacionGastos: false,
      partesDiariosLectura: true,
      partesDiariosEdicion: false,
      asignacionTareas: false,
    },
  },
};

class PermisosController {
  static obtenerRoles(req, res) {
    return exito(res, {
      roles: ROLES_INFO,
      matrizPermisos: MATRIZ_PERMISOS,
    });
  }

  static async obtenerUsuarios(req, res) {
    const usuarios = await UsuarioModel.listarTodos();
    return exito(res, usuarios);
  }

  static async cambiarRolUsuario(req, res) {
    const { id } = req.params;
    const { nuevoRol } = req.body;

    if (!nuevoRol) {
      return error(res, "Debe especificar el nuevo rol a asignar.", 400);
    }

    try {
      const usuarioActualizado = await UsuarioModel.actualizarRol(id, nuevoRol);
      return exito(
        res,
        usuarioActualizado,
        `Rol de ${usuarioActualizado.nombre} actualizado a ${nuevoRol.toUpperCase()}.`
      );
    } catch (err) {
      return error(res, err.message, 400);
    }
  }
}

module.exports = PermisosController;
