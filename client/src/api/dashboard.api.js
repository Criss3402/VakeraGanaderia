import { request } from "./client.js";

export async function obtenerMetricas() {
  return request("/dashboard/metricas");
}

export async function obtenerAlertasSanitarias() {
  return request("/dashboard/alertas");
}

export async function obtenerInsumosCriticos() {
  return request("/dashboard/insumos-criticos");
}

export async function obtenerPartesDiarios() {
  return request("/dashboard/partes");
}

export async function registrarParteDiario(datosParte) {
  return request("/dashboard/partes", {
    method: "POST",
    body: JSON.stringify(datosParte),
  });
}

export async function actualizarEstadoParte(id, estado) {
  return request(`/dashboard/partes/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado }),
  });
}
