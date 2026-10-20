import { request } from "./client.js";

export async function obtenerRolesYPermisos() {
  return request("/permisos/roles");
}

export async function obtenerUsuariosRegistrados() {
  return request("/permisos/usuarios");
}

export async function actualizarRolUsuario(idUsuario, nuevoRol) {
  return request(`/permisos/usuarios/${idUsuario}/rol`, {
    method: "PATCH",
    body: JSON.stringify({ nuevoRol }),
  });
}

export async function solicitarAnadirEmpleado({ email, rol, cargo, mensaje }) {
  return request("/permisos/solicitar-empleado", {
    method: "POST",
    body: JSON.stringify({ email, rol, cargo, mensaje }),
  });
}

export async function desvincularEmpleado(idUsuario) {
  return request(`/permisos/usuarios/${idUsuario}/desvincular`, {
    method: "DELETE",
  });
}
