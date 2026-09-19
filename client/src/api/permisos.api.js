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
