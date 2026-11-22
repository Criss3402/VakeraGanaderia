import { getToken } from "./client";

/**
 * Conecta al WebSocket de Django Channels (/ws/realtime/?token=<jwt>)
 * con reconexión automática (backoff exponencial + jitter) y resincronización REST.
 */
export function conectarRealtime({
  obtenerToken = getToken,
  alRecibir,
  alReconectar,
  alCambiarEstado,
} = {}) {
  if (typeof window === "undefined" || typeof WebSocket === "undefined") {
    return () => { };
  }

  let espera = 1000;
  let socket = null;
  let timerReconexion = null;
  let cerradoAProposito = false;

  const construirUrl = (token) => {
    const protocolo = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocolo}//${window.location.host}/ws/realtime/?token=${encodeURIComponent(token)}`;
  };

  function abrir() {
    if (cerradoAProposito) return;
    const token = obtenerToken ? obtenerToken() : null;
    if (!token) {
      if (alCambiarEstado) alCambiarEstado("desconectado");
      return;
    }

    try {
      socket = new WebSocket(construirUrl(token));
    } catch (err) {
      console.warn("[Realtime] No se pudo abrir WebSocket:", err.message);
      return;
    }

    socket.onopen = () => {
      espera = 1000;
      if (alCambiarEstado) alCambiarEstado("conectado");
      if (alReconectar) alReconectar();
    };

    socket.onmessage = (evento) => {
      try {
        const datos = JSON.parse(evento.data);
        if (alRecibir) alRecibir(datos);
      } catch (err) {
        console.warn("[Realtime] Mensaje WebSocket inválido:", err.message);
      }
    };

    socket.onclose = () => {
      if (cerradoAProposito) return;
      if (alCambiarEstado) alCambiarEstado("reconectando");
      const demora = espera + Math.random() * 500;
      timerReconexion = setTimeout(abrir, demora);
      espera = Math.min(espera * 2, 30000);
    };
  }

  abrir();

  return () => {
    cerradoAProposito = true;
    if (timerReconexion) clearTimeout(timerReconexion);
    if (socket) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1000);
      } else if (socket.readyState === WebSocket.CONNECTING) {
        // No llamar close() aquí: el handshake todavía no terminó.
        // Solo "apagar" los handlers para que no disparen nada.
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
      }
    }
  };
}
