import { request } from "./client.js";

// Métricas y Clima
export async function obtenerMetricas() {
  return request("/dashboard/metricas");
}

export async function obtenerClimaActual(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/dashboard/clima${query ? `?${query}` : ""}`);
}

// Ganado y Potreros
export async function obtenerGanado(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/dashboard/ganado${query ? `?${query}` : ""}`);
}

export async function obtenerPotreros() {
  return request("/dashboard/potreros");
}

export async function registrarGanado(datos) {
  return request("/dashboard/ganado", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export async function actualizarGanado(id, datos) {
  return request(`/dashboard/ganado/${id}`, {
    method: "PATCH",
    body: JSON.stringify(datos),
  });
}

export async function obtenerFichaAnimal(id) {
  return request(`/dashboard/ganado/${id}`);
}

export async function eliminarGanado(id, motivo = "Venta") {
  return request(`/dashboard/ganado/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ motivo }),
  });
}

export async function bajaMasivaGanado({ animalIds, motivo = "Venta" }) {
  return request("/dashboard/ganado/baja-masiva", {
    method: "POST",
    body: JSON.stringify({ animalIds, motivo }),
  });
}

export async function trasladoMasivoGanado({ animalIds, potreroDestinoId }) {
  return request("/dashboard/ganado/traslado-masivo", {
    method: "POST",
    body: JSON.stringify({ animalIds, potreroDestinoId }),
  });
}

export async function registrarPotrero(datos) {
  return request("/dashboard/potreros", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export async function actualizarPotrero(id, datos) {
  return request(`/dashboard/potreros/${id}`, {
    method: "PATCH",
    body: JSON.stringify(datos),
  });
}

export async function eliminarPotrero(id) {
  return request(`/dashboard/potreros/${id}`, {
    method: "DELETE",
  });
}

// Sanidad y Vacunaciones
export async function obtenerAlertasSanitarias() {
  return request("/dashboard/alertas");
}

export async function obtenerSanidad() {
  return request("/dashboard/sanidad");
}

export async function registrarEventoSanitario(datos) {
  return request("/dashboard/sanidad", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export async function actualizarEstadoSanitario(id, estado) {
  return request(`/dashboard/sanidad/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado }),
  });
}

export async function eliminarEventoSanitario(id) {
  return request(`/dashboard/sanidad/${id}`, {
    method: "DELETE",
  });
}

export async function eliminarEventosSanitariosMasivo(ids) {
  return request("/dashboard/sanidad/eliminar-masivo", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// Insumos y Stock
export async function obtenerInsumosCriticos() {
  return request("/dashboard/insumos-criticos");
}

export async function obtenerInsumos() {
  return request("/dashboard/insumos");
}

export async function registrarInsumo(datos) {
  return request("/dashboard/insumos", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export async function actualizarStockInsumo(id, cantidad, operacion = "sumar") {
  return request(`/dashboard/insumos/${id}/stock`, {
    method: "PATCH",
    body: JSON.stringify({ cantidad, operacion }),
  });
}

export async function eliminarInsumo(id) {
  return request(`/dashboard/insumos/${id}`, {
    method: "DELETE",
  });
}

export async function eliminarInsumosMasivo(ids) {
  return request("/dashboard/insumos/eliminar-masivo", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export async function gestionarLocacionInsumos({ nombreAnterior, nuevoNombre, accion = "editar" }) {
  return request("/dashboard/insumos/locaciones", {
    method: "PATCH",
    body: JSON.stringify({ nombreAnterior, nuevoNombre, accion }),
  });
}

// Solicitudes de Insumos y Reposición
export async function obtenerSolicitudesInsumos() {
  return request("/dashboard/insumos/solicitudes");
}

export async function crearSolicitudInsumo(datos) {
  return request("/dashboard/insumos/solicitudes", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export async function actualizarEstadoSolicitudInsumo(id, estado) {
  return request(`/dashboard/insumos/solicitudes/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado }),
  });
}

export async function eliminarSolicitudInsumo(id) {
  return request(`/dashboard/insumos/solicitudes/${id}`, {
    method: "DELETE",
  });
}

export async function eliminarSolicitudesInsumoMasivo(ids) {
  return request("/dashboard/insumos/solicitudes/eliminar-masivo", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// Conteo Físico de Pertenencias
export async function registrarConteoPertenencias(id, stockContado) {
  return request(`/dashboard/insumos/${id}/conteo`, {
    method: "PATCH",
    body: JSON.stringify({ stockContado }),
  });
}

// Partes Diarios
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

export async function eliminarParteDiario(id) {
  return request(`/dashboard/partes/${id}`, {
    method: "DELETE",
  });
}

export async function eliminarPartesDiariosMasivo(ids) {
  return request("/dashboard/partes/eliminar-masivo", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// Reportes Consolidados
export async function obtenerReportes() {
  return request("/dashboard/reportes");
}
