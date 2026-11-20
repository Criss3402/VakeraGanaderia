/**
 * Cliente puente para despachar eventos en tiempo real al servidor WebSocket Python (Django Channels).
 * Patrón Productor -> Broker -> Consumidor desacoplado: si Python no está activo, solo loguea advertencia.
 */
const PYTHON_WS_EMIT_URL =
  process.env.PYTHON_WS_EMIT_URL || "http://127.0.0.1:8000/api/py/ws/emit";

function emitirEventoRealtime({ targetUserIds = [], broadcast = false, payload }) {
  if (!payload || typeof payload !== "object") return;
  if (process.env.NODE_ENV === "test") return;

  const secret = process.env.INTERNAL_WS_SECRET || process.env.JWT_SECRET || "vakera_super_secret_jwt_key_2026";
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
