import { request } from "./client.js";

/**
 * Obtiene la lista de contactos permitidos según el rol del usuario logueado
 * y registrados en el mismo espacio (campo).
 */
export async function obtenerContactosChat() {
  return request("/chat/contactos", { noCache: true, ttlMs: 0 });
}

/**
 * Obtiene el historial de mensajes con un contacto permitido y marca los recibidos como leídos.
 */
export async function obtenerMensajesChat(contactoId) {
  return request(`/chat/mensajes/${contactoId}`, { noCache: true, ttlMs: 0 });
}

/**
 * Envía un mensaje rápido a un contacto permitido dentro del mismo establecimiento.
 */
export async function enviarMensajeChat({ destinatarioId, contenido }) {
  return request("/chat/mensajes", {
    method: "POST",
    body: JSON.stringify({ destinatarioId, contenido }),
  });
}

/**
 * Oculta / borra (soft-delete) un contacto de la vista activa de chat del usuario logueado.
 */
export async function ocultarContactoChat(contactoId) {
  return request(`/chat/contactos/${contactoId}`, {
    method: "DELETE",
  });
}

/**
 * Restaura los contactos previamente ocultados en la vista activa del usuario logueado.
 */
export async function restaurarContactosChat(contactoId = null) {
  return request("/chat/contactos/restaurar", {
    method: "POST",
    body: JSON.stringify(contactoId ? { contactoId } : {}),
  });
}
