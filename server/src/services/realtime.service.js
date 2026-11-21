/**
 * Cliente puente para despachar eventos en tiempo real al servidor WebSocket Python (Django Channels).
 * Patrón Productor -> Broker -> Consumidor desacoplado: si Python no está activo, solo loguea advertencia.
 */
const { INTERNAL_WS_SECRET } = require("../config/env");

const PYTHON_WS_EMIT_URL =
  process.env.PYTHON_WS_EMIT_URL || "http://127.0.0.1:8000/api/py/ws/emit";

function emitirEventoRealtime({ targetUserIds = [], broadcast = false, payload }) {
  if (!payload || typeof payload !== "object") return;
  if (process.env.NODE_ENV === "test") return;

  const secret = INTERNAL_WS_SECRET;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 1200) : null;

  fetch(PYTHON_WS_EMIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": secret,
    },
    body: JSON.stringify({ targetUserIds, broadcast, payload }),
    signal: controller ? controller.signal : undefined,
  })
    .catch((err) => {
      console.warn("[RealtimeService] No se pudo emitir evento WebSocket a Python:", err.message);
    })
    .finally(() => {
      if (timer) clearTimeout(timer);
    });
}

module.exports = { emitirEventoRealtime };
