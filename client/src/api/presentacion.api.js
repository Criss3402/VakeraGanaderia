import { request } from "./client.js";

export async function obtenerServicios() {
  return request("/servicios");
}

export async function obtenerServicioPorId(id) {
  return request(`/servicios/${id}`);
}

export async function enviarContacto(datosContacto) {
  return request("/contacto", {
    method: "POST",
    body: JSON.stringify(datosContacto),
  });
}
