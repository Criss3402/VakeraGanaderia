import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Alert from "../../../components/ui/Alert.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import {
  obtenerContactosChat,
  obtenerMensajesChat,
  enviarMensajeChat,
  ocultarContactoChat,
  restaurarContactosChat,
  solicitarChat,
  responderSolicitudChat,
} from "../../../api/chat.api.js";

/**
 * Normaliza variantes de rol al identificador en minúsculas del sistema.
 * El rol ADMINISTRADOR se mapea a "oficina" (aceptando también "administrador" o "admin").
 */
export function normalizarRolChat(rol) {
  const limpio = String(rol || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (limpio === "administrador" || limpio === "admin" || limpio === "oficina") {
    return "oficina";
  }
  if (limpio === "dueno") return "dueno";
  if (limpio === "capataz") return "capataz";
  if (limpio === "peon") return "peon";
  if (limpio === "veterinario") return "veterinario";
  return limpio;
}

/**
 * MATRIZ DE PERMISOS DE CHAT POR ROL DE ESTANCIA:
 * - PEÓN: Chat directo con CAPATAZ; requiere solicitud aprobada para ADMINISTRADOR y DUEÑO.
 * - CAPATAZ: Puede chatear con el ADMINISTRADOR (oficina), PEÓN y VETERINARIO.
 * - VETERINARIO: Puede chatear con el DUEÑO, ADMINISTRADOR (oficina) y CAPATAZ.
 * - ADMINISTRADOR (oficina): Puede chatear con CAPATAZ, VETERINARIO, DUEÑO y PEÓN.
 * - DUEÑO: Puede chatear con VETERINARIO, ADMINISTRADOR (oficina) y PEÓN.
 */
export const MATRIZ_CHAT_ROLES = {
  peon: ["capataz"],
  capataz: ["oficina", "peon", "veterinario"],
  veterinario: ["dueno", "oficina", "capataz"],
  oficina: ["capataz", "veterinario", "dueno", "peon"],
  dueno: ["veterinario", "oficina", "peon"],
};

export const MATRIZ_SOLICITUD_CHAT_ROLES = {
  peon: ["oficina", "dueno"],
};

export const ETIQUETAS_ROLES_CHAT = {
  peon: "Peón",
  capataz: "Capataz",
  veterinario: "Veterinario",
  oficina: "Administrador",
  dueno: "Dueño",
};

const SUGERENCIAS_INICIO = [
  "Buen día, ¿cómo viene la jornada?",
  "¿Podemos revisar los pendientes del campo?",
  "Te paso una novedad operativa.",
];

const LIMITE_CARACTERES_MENSAJE = 2000;

/**
 * Filtro defensivo estricto de contactos por rol permitido (directo o con solicitud) y mismo espacio (campo).
 */
export function filtrarContactosPermitidos(contactos, usuarioActual, idsOcultosLocal = new Set()) {
  if (!usuarioActual || !usuarioActual.establecimientoId || !Array.isArray(contactos)) {
    return [];
  }
  const rolUsuario = normalizarRolChat(usuarioActual.rol);
  const rolesPermitidos = MATRIZ_CHAT_ROLES[rolUsuario] || [];
  const rolesConSolicitud = MATRIZ_SOLICITUD_CHAT_ROLES[rolUsuario] || [];

  return contactos.filter((c) => {
    if (!c || c.id === usuarioActual.id) return false;
    if (idsOcultosLocal.has(c.id)) return false;
    if (!c.establecimientoId || c.establecimientoId !== usuarioActual.establecimientoId) {
      return false;
    }
    const rolContacto = normalizarRolChat(c.rol);
    return rolesPermitidos.includes(rolContacto) || rolesConSolicitud.includes(rolContacto);
  });
}

function obtenerIniciales(nombre) {
  if (!nombre) return "VK";
  return nombre
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function parsearFechaValida(fechaIso) {
  if (!fechaIso) return null;
  const fecha = new Date(fechaIso);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function obtenerClaveDia(fecha) {
  if (!fecha) return "";
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatearHoraMensaje(fechaIso) {
  const fecha = parsearFechaValida(fechaIso);
  if (!fecha) return "";
  try {
    return fecha.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (err) {
    console.warn("[ChatView] Error al formatear hora:", err);
    return "";
  }
}

function formatearEtiquetaDia(fechaIso) {
  const fecha = parsearFechaValida(fechaIso);
  if (!fecha) return "";

  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);

  const claveFecha = obtenerClaveDia(fecha);
  if (claveFecha === obtenerClaveDia(hoy)) return "Hoy";
  if (claveFecha === obtenerClaveDia(ayer)) return "Ayer";

  try {
    const mismoAnio = fecha.getFullYear() === hoy.getFullYear();
    return fecha.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      ...(mismoAnio ? {} : { year: "numeric" }),
    });
  } catch (err) {
    console.warn("[ChatView] Error al formatear día:", err);
    return "";
  }
}

function formatearTiempoContacto(fechaIso) {
  const fecha = parsearFechaValida(fechaIso);
  if (!fecha) return "";

  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);

  const claveFecha = obtenerClaveDia(fecha);
  if (claveFecha === obtenerClaveDia(hoy)) {
    return formatearHoraMensaje(fechaIso);
  }
  if (claveFecha === obtenerClaveDia(ayer)) {
    return "Ayer";
  }

  try {
    return fecha.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
    });
  } catch (err) {
    console.warn("[ChatView] Error al formatear fecha de contacto:", err);
    return "";
  }
}

function esMensajePropio(msg, usuarioId) {
  return Boolean(msg?.esMio || (usuarioId && msg?.remitenteId === usuarioId));
}

function debeAgruparConAnterior(actual, previo, usuarioId) {
  if (!actual || !previo) return false;
  if (esMensajePropio(actual, usuarioId) !== esMensajePropio(previo, usuarioId)) {
    return false;
  }
  const fActual = parsearFechaValida(actual.fechaEnvio);
  const fPrevio = parsearFechaValida(previo.fechaEnvio);
  if (!fActual || !fPrevio) return false;
  if (obtenerClaveDia(fActual) !== obtenerClaveDia(fPrevio)) return false;

  const diferenciaMs = Math.abs(fActual.getTime() - fPrevio.getTime());
  return diferenciaMs <= 5 * 60 * 1000;
}

function obtenerClaseRol(rol) {
  const norm = normalizarRolChat(rol);
  if (["dueno", "oficina", "veterinario", "capataz", "peon"].includes(norm)) {
    return `chat-rol-tone--${norm}`;
  }
  return "chat-rol-tone--default";
}

export default function ChatView({ abiertoInicial = false }) {
  const { usuario } = useAuth();
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [cerrando, setCerrando] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [contactosColapsado, setContactosColapsado] = useState(false);

  const [contactos, setContactos] = useState([]);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [usuarioChatInfo, setUsuarioChatInfo] = useState(null);
  const [idsOcultosLocal, setIdsOcultosLocal] = useState(() => new Set());
  const [ocultosCount, setOcultosCount] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [contactoActivo, setContactoActivo] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [textoMensaje, setTextoMensaje] = useState("");
  const [motivoSolicitud, setMotivoSolicitud] = useState("");

  const [cargandoContactos, setCargandoContactos] = useState(false);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [procesandoSolicitud, setProcesandoSolicitud] = useState(false);
  const [ocultandoId, setOcultandoId] = useState(null);
  const [restaurando, setRestaurando] = useState(false);
  const [error, setError] = useState(null);
  const [notificacion, setNotificacion] = useState(null); // { texto: string, contactoOculto?: { id, nombre } }
  const [mostrarIrAlFinal, setMostrarIrAlFinal] = useState(false);

  const timerCierreRef = useRef(null);
  const timerNotificacionRef = useRef(null);
  const pollingEnCursoRef = useRef(false);
  const finMensajesRef = useRef(null);
  const contenedorMensajesRef = useRef(null);
  const inputMensajeRef = useRef(null);
  const cercaDelFinalRef = useRef(true);
  const forzarScrollRef = useRef(false);

  const limpiarNotificacion = useCallback(() => {
    if (timerNotificacionRef.current) {
      clearTimeout(timerNotificacionRef.current);
      timerNotificacionRef.current = null;
    }
    setNotificacion(null);
  }, []);

  const mostrarNotificacionTemporal = useCallback(
    (payload) => {
      if (timerNotificacionRef.current) {
        clearTimeout(timerNotificacionRef.current);
      }
      setNotificacion(payload);
      timerNotificacionRef.current = setTimeout(() => {
        setNotificacion(null);
        timerNotificacionRef.current = null;
      }, 6500);
    },
    []
  );

  const abrirChat = useCallback(() => {
    if (timerCierreRef.current) {
      clearTimeout(timerCierreRef.current);
      timerCierreRef.current = null;
    }
    setCerrando(false);
    setAbierto(true);
  }, []);

  const cerrarChat = useCallback(() => {
    if (!abierto || cerrando) return;
    setCerrando(true);
    timerCierreRef.current = setTimeout(() => {
      setAbierto(false);
      setCerrando(false);
      timerCierreRef.current = null;
    }, 280);
  }, [abierto, cerrando]);

  const alternarChat = useCallback(() => {
    if (abierto && !cerrando) {
      cerrarChat();
    } else {
      abrirChat();
    }
  }, [abierto, cerrando, abrirChat, cerrarChat]);

  useEffect(() => {
    return () => {
      if (timerCierreRef.current) clearTimeout(timerCierreRef.current);
      if (timerNotificacionRef.current) clearTimeout(timerNotificacionRef.current);
    };
  }, []);

  // Cerrar con tecla Escape cuando el chat está abierto
  useEffect(() => {
    if (!abierto || cerrando) return;
    function manejarTeclaGlobal(e) {
      if (e.key === "Escape") {
        cerrarChat();
      }
    }
    window.addEventListener("keydown", manejarTeclaGlobal);
    return () => window.removeEventListener("keydown", manejarTeclaGlobal);
  }, [abierto, cerrando, cerrarChat]);

  const usuarioEfectivo = usuarioChatInfo || usuario;
  const rolNorm = normalizarRolChat(usuarioEfectivo?.rol || "peon");
  const rolesPermitidos = MATRIZ_CHAT_ROLES[rolNorm] || [];
  const rolesConSolicitud = MATRIZ_SOLICITUD_CHAT_ROLES[rolNorm] || [];
  const nombresRolesPermitidos = rolesPermitidos.map(
    (r) => ETIQUETAS_ROLES_CHAT[r] || r.toUpperCase()
  );
  const nombresRolesConSolicitud = rolesConSolicitud.map(
    (r) => ETIQUETAS_ROLES_CHAT[r] || r.toUpperCase()
  );

  const cargarContactos = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargandoContactos(true);
      try {
        const res = await obtenerContactosChat();
        if (res?.data) {
          const usrServidor = res.data.usuarioActual || usuario;
          setUsuarioChatInfo(usrServidor);
          setContactos(res.data.contactos || []);
          setSolicitudesPendientes(res.data.solicitudesPendientes || []);
          setOcultosCount(res.data.ocultosCount || 0);
        }
      } catch (err) {
        if (!silencioso) {
          setError(err.message || "No se pudo cargar la lista de contactos del campo.");
        }
      } finally {
        if (!silencioso) setCargandoContactos(false);
      }
    },
    [usuario]
  );

  const cargarConversacion = useCallback(async (idContacto, silencioso = false) => {
    if (!idContacto) return;
    if (!silencioso) setCargandoMensajes(true);
    try {
      const res = await obtenerMensajesChat(idContacto);
      if (res?.data) {
        setMensajes(res.data.mensajes || []);
        if (res.data.contacto) {
          setContactoActivo((prev) =>
            prev && prev.id === idContacto ? { ...prev, ...res.data.contacto } : res.data.contacto
          );
        }
        setContactos((prev) =>
          prev.map((c) =>
            c.id === idContacto
              ? {
                  ...c,
                  ...(res.data.contacto || {}),
                  mensajesNoLeidos: 0,
                }
              : c
          )
        );
      }
    } catch (err) {
      if (!silencioso) {
        setError(err.message || "Error al abrir la conversación.");
      }
    } finally {
      if (!silencioso) setCargandoMensajes(false);
    }
  }, []);

  // Cargar contactos al montar y cuando se abre el panel flotante
  useEffect(() => {
    cargarContactos(!abierto);
  }, [abierto, cargarContactos]);

  // Polling ligero de respaldo + refresco inmediato por WebSocket (Django Channels)
  useEffect(() => {
    async function sincronizarChat() {
      if (pollingEnCursoRef.current) return;
      pollingEnCursoRef.current = true;
      try {
        await cargarContactos(true);
        if (abierto && contactoActivo?.id) {
          await cargarConversacion(contactoActivo.id, true);
        }
      } finally {
        pollingEnCursoRef.current = false;
      }
    }

    function manejarEventoRealtime(e) {
      if (e?.detail?.event === "chat_message") {
        sincronizarChat();
      }
    }
    window.addEventListener("vakera:realtime-evento", manejarEventoRealtime);

    const timer = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      await sincronizarChat();
    }, 6000);

    return () => {
      clearInterval(timer);
      window.removeEventListener("vakera:realtime-evento", manejarEventoRealtime);
    };
  }, [abierto, cargarContactos, cargarConversacion, contactoActivo?.id]);

  const desplazarAlFinal = useCallback((comportamiento = "smooth") => {
    if (finMensajesRef.current && typeof finMensajesRef.current.scrollIntoView === "function") {
      finMensajesRef.current.scrollIntoView({ behavior: comportamiento });
    }
    cercaDelFinalRef.current = true;
    setMostrarIrAlFinal(false);
  }, []);

  // Desplazar automáticamente al último mensaje solo si el usuario está al final o acaba de enviar/abrir
  useEffect(() => {
    if (!abierto) return;
    if (forzarScrollRef.current || cercaDelFinalRef.current) {
      desplazarAlFinal(forzarScrollRef.current ? "auto" : "smooth");
      forzarScrollRef.current = false;
    }
  }, [abierto, mensajes.length, contactoActivo?.id, desplazarAlFinal]);

  // Auto-ajustar altura del textarea del compositor
  useEffect(() => {
    const el = inputMensajeRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 108)}px`;
  }, [textoMensaje, contactoActivo?.id]);

  function manejarScrollMensajes() {
    const el = contenedorMensajesRef.current;
    if (!el) return;
    const distanciaAlFondo = el.scrollHeight - el.scrollTop - el.clientHeight;
    const estaCerca = distanciaAlFondo <= 72;
    cercaDelFinalRef.current = estaCerca;
    setMostrarIrAlFinal(!estaCerca && mensajes.length > 0);
  }

  // Aplicar filtro estricto (rol en base de datos + mismo espacio/campo + no oculto + búsqueda)
  const contactosFiltradosPorRegla = useMemo(
    () => filtrarContactosPermitidos(contactos, usuarioEfectivo, idsOcultosLocal),
    [contactos, usuarioEfectivo, idsOcultosLocal]
  );

  const totalNoLeidos = useMemo(
    () =>
      contactosFiltradosPorRegla.reduce(
        (acc, c) => acc + (Number(c.mensajesNoLeidos) || 0),
        0
      ),
    [contactosFiltradosPorRegla]
  );

  const contactosVisibles = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return contactosFiltradosPorRegla;
    return contactosFiltradosPorRegla.filter((c) => {
      const etiqueta = (
        c.rolEtiqueta ||
        ETIQUETAS_ROLES_CHAT[normalizarRolChat(c.rol)] ||
        ""
      ).toLowerCase();
      return (
        (c.nombre || "").toLowerCase().includes(q) ||
        (c.cargo || "").toLowerCase().includes(q) ||
        etiqueta.includes(q)
      );
    });
  }, [contactosFiltradosPorRegla, busqueda]);

  // Pre-calcular separadores de día y agrupación visual entre burbujas consecutivas
  const itemsMensajesRender = useMemo(() => {
    const items = [];
    let ultimoDia = "";
    mensajes.forEach((msg, idx) => {
      const fecha = parsearFechaValida(msg.fechaEnvio);
      const claveDia = obtenerClaveDia(fecha);
      if (claveDia && claveDia !== ultimoDia) {
        ultimoDia = claveDia;
        items.push({
          tipo: "separador-dia",
          key: `dia-${claveDia}-${idx}`,
          etiqueta: formatearEtiquetaDia(msg.fechaEnvio),
        });
      }

      const previo = idx > 0 ? mensajes[idx - 1] : null;
      const siguiente = idx < mensajes.length - 1 ? mensajes[idx + 1] : null;
      const agrupadoConAnterior = debeAgruparConAnterior(msg, previo, usuarioEfectivo?.id);
      const agrupadoConSiguiente = debeAgruparConAnterior(siguiente, msg, usuarioEfectivo?.id);

      items.push({
        tipo: "mensaje",
        key: msg.id || `msg-${idx}`,
        msg,
        esMio: esMensajePropio(msg, usuarioEfectivo?.id),
        agrupadoConAnterior,
        mostrarPie: !agrupadoConSiguiente,
      });
    });
    return items;
  }, [mensajes, usuarioEfectivo?.id]);

  async function manejarSeleccionarContacto(contacto) {
    setError(null);
    forzarScrollRef.current = true;
    cercaDelFinalRef.current = true;
    setMostrarIrAlFinal(false);
    setContactoActivo(contacto);
    await cargarConversacion(contacto.id, false);
    if (inputMensajeRef.current && typeof inputMensajeRef.current.focus === "function") {
      inputMensajeRef.current.focus();
    }
  }

  async function manejarBorrarContacto(evento, contacto) {
    if (evento) {
      evento.stopPropagation();
    }
    if (!contacto?.id) return;

    setError(null);
    setOcultandoId(contacto.id);

    // Ocultar de la vista activa de inmediato (soft-delete reactivo)
    setIdsOcultosLocal((prev) => {
      const nuevo = new Set(prev);
      nuevo.add(contacto.id);
      return nuevo;
    });
    setContactos((prev) => prev.filter((c) => c.id !== contacto.id));
    setOcultosCount((prev) => prev + 1);

    if (contactoActivo?.id === contacto.id) {
      setContactoActivo(null);
      setMensajes([]);
    }

    try {
      const res = await ocultarContactoChat(contacto.id);
      mostrarNotificacionTemporal({
        texto: res?.mensaje || `Conversación con ${contacto.nombre} ocultada.`,
        contactoOculto: { id: contacto.id, nombre: contacto.nombre },
      });
    } catch (err) {
      setError(err.message || "Error al ocultar el contacto en el servidor.");
      setIdsOcultosLocal((prev) => {
        const nuevo = new Set(prev);
        nuevo.delete(contacto.id);
        return nuevo;
      });
      await cargarContactos(true);
    } finally {
      setOcultandoId(null);
    }
  }

  async function manejarRestaurarContactos(contactoIdEspecifico = null) {
    setError(null);
    setRestaurando(true);
    try {
      await restaurarContactosChat(contactoIdEspecifico);
      setIdsOcultosLocal((prev) => {
        if (!contactoIdEspecifico) return new Set();
        const nuevo = new Set(prev);
        nuevo.delete(contactoIdEspecifico);
        return nuevo;
      });
      mostrarNotificacionTemporal({
        texto: contactoIdEspecifico
          ? "Conversación restaurada en tu lista activa."
          : "Los contactos ocultos de tu espacio fueron restaurados.",
      });
      await cargarContactos(false);
    } catch (err) {
      setError(err.message || "No se pudieron restaurar los contactos ocultos.");
    } finally {
      setRestaurando(false);
    }
  }

  async function enviarContenidoActual() {
    if (!contactoActivo?.id || !textoMensaje.trim() || enviando) return;

    const contenidoEnviar = textoMensaje.trim();
    setEnviando(true);
    setError(null);

    try {
      const res = await enviarMensajeChat({
        destinatarioId: contactoActivo.id,
        contenido: contenidoEnviar,
      });

      if (res?.data) {
        forzarScrollRef.current = true;
        cercaDelFinalRef.current = true;
        setMensajes((prev) => [...prev, res.data]);
        setTextoMensaje("");
        setContactos((prev) =>
          prev.map((c) =>
            c.id === contactoActivo.id
              ? {
                  ...c,
                  ultimoMensaje: {
                    id: res.data.id,
                    contenido: res.data.contenido,
                    fechaEnvio: res.data.fechaEnvio,
                    esMio: true,
                    leido: false,
                  },
                }
              : c
          )
        );
      }
    } catch (err) {
      setError(err.message || "No se pudo enviar el mensaje.");
    } finally {
      setEnviando(false);
      if (inputMensajeRef.current && typeof inputMensajeRef.current.focus === "function") {
        inputMensajeRef.current.focus();
      }
    }
  }

  async function manejarEnviarMensaje(e) {
    e.preventDefault();
    await enviarContenidoActual();
  }

  function manejarTeclaCompositor(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarContenidoActual();
    }
  }

  function usarSugerenciaInicio(texto) {
    setTextoMensaje(texto);
    if (inputMensajeRef.current && typeof inputMensajeRef.current.focus === "function") {
      inputMensajeRef.current.focus();
    }
  }

  async function manejarSolicitarChat(e) {
    if (e) e.preventDefault();
    if (!contactoActivo?.id || procesandoSolicitud) return;
    setProcesandoSolicitud(true);
    setError(null);
    try {
      const res = await solicitarChat({
        destinatarioId: contactoActivo.id,
        motivo: motivoSolicitud,
      });
      if (res?.data) {
        const nuevoEstado = res.data.estado || "PENDIENTE";
        const habilitado = nuevoEstado === "APROBADA";
        setContactoActivo((prev) =>
          prev
            ? {
                ...prev,
                estadoSolicitud: nuevoEstado,
                solicitudId: res.data.id,
                motivoSolicitud: res.data.motivo,
                chatHabilitado: habilitado,
              }
            : prev
        );
        setContactos((prev) =>
          prev.map((c) =>
            c.id === contactoActivo.id
              ? {
                  ...c,
                  estadoSolicitud: nuevoEstado,
                  solicitudId: res.data.id,
                  motivoSolicitud: res.data.motivo,
                  chatHabilitado: habilitado,
                }
              : c
          )
        );
        setMotivoSolicitud("");
        mostrarNotificacionTemporal({
          texto:
            res.mensaje ||
            `Solicitud enviada a ${contactoActivo.nombre}. Esperando su aprobación.`,
        });
      }
    } catch (err) {
      setError(err.message || "No se pudo enviar la solicitud de chat.");
    } finally {
      setProcesandoSolicitud(false);
    }
  }

  async function manejarResponderSolicitud(solicitudId, estado, nombreSolicitante = "el peón") {
    if (!solicitudId || procesandoSolicitud) return;
    setProcesandoSolicitud(true);
    setError(null);
    try {
      const res = await responderSolicitudChat(solicitudId, estado);
      setSolicitudesPendientes((prev) => prev.filter((s) => s.id !== solicitudId));
      setContactos((prev) =>
        prev.map((c) =>
          c.solicitudEntrante?.id === solicitudId
            ? {
                ...c,
                solicitudEntrante: { ...c.solicitudEntrante, estado },
              }
            : c
        )
      );
      if (contactoActivo?.solicitudEntrante?.id === solicitudId) {
        setContactoActivo((prev) =>
          prev
            ? {
                ...prev,
                solicitudEntrante: { ...prev.solicitudEntrante, estado },
              }
            : prev
        );
      }
      mostrarNotificacionTemporal({
        texto:
          res?.mensaje ||
          (estado === "APROBADA"
            ? `Chat habilitado con ${nombreSolicitante}.`
            : `Solicitud de ${nombreSolicitante} rechazada.`),
      });
      await cargarContactos(true);
    } catch (err) {
      setError(err.message || "No se pudo responder la solicitud de chat.");
    } finally {
      setProcesandoSolicitud(false);
    }
  }

  const hayBusquedaActiva = busqueda.trim().length > 0;
  const longitudActual = textoMensaje.length;
  const badgeGlobalTotal = totalNoLeidos + solicitudesPendientes.length;

  const contactoActivoRequiereSolicitud = Boolean(
    contactoActivo &&
      (contactoActivo.requiereSolicitud ??
        (rolNorm === "peon" &&
          (normalizarRolChat(contactoActivo.rol) === "oficina" ||
            normalizarRolChat(contactoActivo.rol) === "dueno")))
  );
  const superiorEnvioMensajeActivo = Boolean(
    contactoActivo &&
      mensajes.some((m) => !esMensajePropio(m, usuarioEfectivo?.id))
  );
  const contactoActivoChatHabilitado =
    !contactoActivoRequiereSolicitud ||
    Boolean(contactoActivo?.chatHabilitado) ||
    contactoActivo?.estadoSolicitud === "APROBADA" ||
    superiorEnvioMensajeActivo;
  const contactoActivoEstadoSol = contactoActivo?.estadoSolicitud || "NINGUNA";

  return (
    <>
      {abierto && (
        <div
          className={`chat-flotante-backdrop ${cerrando ? "chat-flotante-backdrop--cerrando" : ""}`}
          onClick={cerrarChat}
          aria-hidden="true"
        />
      )}

      <div className="chat-flotante-raiz">
        {abierto && (
          <div
            className={`chat-flotante-ventana ${
              expandido ? "chat-flotante-ventana--expandida" : ""
            } ${cerrando ? "chat-flotante-ventana--cerrando" : ""}`}
            role="dialog"
            aria-label="Ventana flotante de chat de estancia"
          >
            {/* Barra superior de la ventana flotante */}
            <div className="chat-flotante-topbar">
              <div className="chat-flotante-topbar__izq">
                <img
                  src="/icono-chat.png"
                  alt="Chat Vakera"
                  className="chat-flotante-topbar__icono"
                />
                <div className="chat-flotante-topbar__titulos">
                  <div className="chat-flotante-topbar__titulo">
                    <span>Chat de Estancia</span>
                    <span className="chat-flotante-topbar__sep">·</span>
                    <span className="chat-flotante-topbar__campo">
                      {usuarioEfectivo?.establecimiento || "Campo Activo"}
                    </span>
                  </div>
                  <div className="chat-flotante-topbar__subtitulo">
                    <span className="chat-punto-estado" aria-hidden="true" />
                    <span>Solamente agentes registrados en este espacio (campo)</span>
                  </div>
                </div>
              </div>

              <div className="chat-flotante-topbar__der">
                <button
                  type="button"
                  onClick={() => setExpandido((prev) => !prev)}
                  className="chat-flotante-btn-cerrar chat-flotante-btn-expandir"
                  title={expandido ? "Tamaño estándar" : "Ampliar ventana de chat"}
                  aria-label={expandido ? "Compactar ventana de chat" : "Ampliar ventana de chat"}
                >
                  <i
                    className={`fa-solid ${
                      expandido ? "fa-down-left-and-up-right-to-center" : "fa-up-right-and-down-left-from-center"
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={cerrarChat}
                  className="chat-flotante-btn-cerrar"
                  title="Minimizar chat (Esc)"
                  aria-label="Cerrar ventana de chat"
                >
                  <i className="fa-solid fa-minus" />
                </button>
              </div>
            </div>

            {/* Aviso de matriz de visibilidad */}
            <div className="chat-aviso-espacio">
              <div className="chat-aviso-espacio__info">
                <i className="fa-solid fa-shield-halved chat-aviso-espacio__icono" aria-hidden="true" />
                <span>
                  Rol activo:{" "}
                  <strong>{ETIQUETAS_ROLES_CHAT[rolNorm] || rolNorm.toUpperCase()}</strong>
                </span>
              </div>

              <div className="chat-aviso-espacio__roles">
                <span className="chat-aviso-espacio__label">Habilitado con:</span>
                {nombresRolesPermitidos.map((etiquetaRol) => (
                  <span key={etiquetaRol} className="chat-rol-pill">
                    {etiquetaRol}
                  </span>
                ))}
                {nombresRolesConSolicitud.length > 0 && (
                  <>
                    <span className="chat-aviso-espacio__label">· Con solicitud:</span>
                    {nombresRolesConSolicitud.map((etiquetaSol) => (
                      <span key={`sol-${etiquetaSol}`} className="chat-rol-pill chat-rol-pill--solicitud">
                        {etiquetaSol}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Banner de solicitudes entrantes de peones para Dueño / Administrador */}
            {(rolNorm === "dueno" || rolNorm === "oficina") && solicitudesPendientes.length > 0 && (
              <div className="chat-solicitudes-banner" data-testid="chat-solicitudes-pendientes">
                <div className="chat-solicitudes-banner__titulo">
                  <i className="fa-solid fa-user-clock" aria-hidden="true" />
                  <span>
                    Solicitudes de Peones pendientes ({solicitudesPendientes.length})
                  </span>
                </div>
                <div className="chat-solicitudes-banner__lista">
                  {solicitudesPendientes.map((sol) => (
                    <div key={sol.id} className="chat-solicitud-item-banner">
                      <div className="chat-solicitud-item-banner__info">
                        <strong>{sol.solicitanteNombre}</strong>
                        <span className="chat-solicitud-item-banner__motivo">
                          {sol.motivo || "Solicita chatear"}
                        </span>
                      </div>
                      <div className="chat-solicitud-item-banner__acciones">
                        <button
                          type="button"
                          disabled={procesandoSolicitud}
                          onClick={() =>
                            manejarResponderSolicitud(sol.id, "APROBADA", sol.solicitanteNombre)
                          }
                          className="chat-btn-solicitud chat-btn-solicitud--aprobar"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={procesandoSolicitud}
                          onClick={() =>
                            manejarResponderSolicitud(sol.id, "RECHAZADA", sol.solicitanteNombre)
                          }
                          className="chat-btn-solicitud chat-btn-solicitud--rechazar"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {notificacion && (
              <div className="chat-alerta-wrapper">
                <Alert tipo="exito" alCerrar={limpiarNotificacion}>
                  <div className="chat-alerta-fila">
                    <span>{notificacion.texto}</span>
                    {notificacion.contactoOculto?.id && (
                      <button
                        type="button"
                        disabled={restaurando}
                        onClick={() => manejarRestaurarContactos(notificacion.contactoOculto.id)}
                        className="chat-btn-deshacer"
                      >
                        <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                        <span>Deshacer</span>
                      </button>
                    )}
                  </div>
                </Alert>
              </div>
            )}

            {error && (
              <div className="chat-alerta-wrapper">
                <Alert tipo="error" alCerrar={() => setError(null)}>
                  {error}
                </Alert>
              </div>
            )}

            {/* Interfaz Divisoria: Panel Lateral de Contactos + Panel Principal de Conversación */}
            <div
              className={`chat-divisorio ${
                contactoActivo ? "chat-divisorio--con-conversacion" : ""
              } ${contactosColapsado ? "chat-divisorio--contactos-colapsados" : ""}`}
            >
              {/* PANEL LATERAL IZQUIERDO: LISTA DE CONTACTOS PERMITIDOS */}
              <aside
                className={`chat-panel-contactos ${
                  contactosColapsado ? "chat-panel-contactos--colapsado" : ""
                }`}
                aria-label="Lista de contactos permitidos"
              >
                <div className="chat-panel-contactos__header">
                  <div className="chat-panel-contactos__titulo-fila">
                    {!contactosColapsado && (
                      <h3 className="chat-panel-contactos__titulo">
                        <i
                          className="fa-solid fa-users chat-panel-contactos__icono"
                          aria-hidden="true"
                        />
                        <span>Contactos ({contactosVisibles.length})</span>
                      </h3>
                    )}

                    <div className="chat-panel-contactos__acciones-header">
                      {!contactosColapsado && ocultosCount > 0 && (
                        <button
                          type="button"
                          disabled={restaurando}
                          onClick={() => manejarRestaurarContactos(null)}
                          className="chat-btn-restaurar"
                          title="Restaurar contactos ocultados previamente"
                        >
                          <i className="fa-solid fa-eye" aria-hidden="true" />
                          <span>Restaurar ({ocultosCount})</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setContactosColapsado((prev) => !prev)}
                        className="chat-btn-colapsar-contactos"
                        title={
                          contactosColapsado
                            ? "Mostrar panel de contactos"
                            : "Ocultar detalles (solo íconos)"
                        }
                        aria-label={
                          contactosColapsado
                            ? "Expandir lista de contactos"
                            : "Colapsar lista de contactos"
                        }
                        aria-expanded={!contactosColapsado}
                      >
                        <i
                          className={`fa-solid ${
                            contactosColapsado ? "fa-angles-right" : "fa-angles-left"
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>

                  {!contactosColapsado && (
                    <div className="chat-buscador-caja">
                      <i
                        className="fa-solid fa-magnifying-glass chat-buscador-icono"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar por nombre o rol..."
                        className="chat-buscador-input"
                        aria-label="Filtrar contactos permitidos"
                      />
                      {hayBusquedaActiva && (
                        <button
                          type="button"
                          onClick={() => setBusqueda("")}
                          className="chat-buscador-limpiar"
                          aria-label="Limpiar búsqueda"
                          title="Limpiar búsqueda"
                        >
                          <i className="fa-solid fa-xmark" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="chat-contactos-lista">
                  {cargandoContactos ? (
                    <div className="chat-vacio-panel chat-vacio-panel--compacto">
                      <i className="fa-solid fa-spinner fa-spin chat-vacio-icono" aria-hidden="true" />
                      {!contactosColapsado && (
                        <p className="chat-vacio-texto">Cargando agentes del campo...</p>
                      )}
                    </div>
                  ) : contactosVisibles.length === 0 ? (
                    contactosColapsado ? (
                      <div
                        className="chat-vacio-panel chat-vacio-panel--compacto"
                        title={
                          hayBusquedaActiva
                            ? "Sin coincidencias en la búsqueda"
                            : "Sin contactos visibles en este espacio"
                        }
                      >
                        <i
                          className={`fa-solid ${
                            hayBusquedaActiva ? "fa-magnifying-glass" : "fa-user-lock"
                          } chat-vacio-icono chat-vacio-icono--suave`}
                          aria-hidden="true"
                        />
                      </div>
                    ) : hayBusquedaActiva ? (
                      <div className="chat-vacio-panel chat-vacio-panel--compacto">
                        <i className="fa-solid fa-magnifying-glass chat-vacio-icono chat-vacio-icono--suave" aria-hidden="true" />
                        <p className="chat-vacio-titulo">Sin resultados</p>
                        <p className="chat-vacio-texto">
                          No encontramos contactos que coincidan con «{busqueda.trim()}».
                        </p>
                        <button
                          type="button"
                          onClick={() => setBusqueda("")}
                          className="chat-btn-secundario-sm"
                        >
                          Ver todos los contactos
                        </button>
                      </div>
                    ) : (
                      <div className="chat-vacio-panel chat-vacio-panel--compacto">
                        <i className="fa-solid fa-user-lock chat-vacio-icono chat-vacio-icono--suave" aria-hidden="true" />
                        <p className="chat-vacio-titulo">Sin contactos visibles en este espacio</p>
                        <p className="chat-vacio-texto">
                          Solo se muestran los agentes registrados en{" "}
                          <strong>{usuarioEfectivo?.establecimiento || "tu campo"}</strong> con rol{" "}
                          <strong>{nombresRolesPermitidos.join(", ")}</strong>.
                        </p>
                        {ocultosCount > 0 && (
                          <button
                            type="button"
                            disabled={restaurando}
                            onClick={() => manejarRestaurarContactos(null)}
                            className="chat-btn-secundario-sm"
                          >
                            <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                            <span>Mostrar {ocultosCount} oculto(s)</span>
                          </button>
                        )}
                      </div>
                    )
                  ) : (
                    contactosVisibles.map((contacto) => {
                      const esActivo = contactoActivo?.id === contacto.id;
                      const tieneNoLeidos = Number(contacto.mensajesNoLeidos) > 0;
                      const etiquetaRol =
                        contacto.rolEtiqueta ||
                        ETIQUETAS_ROLES_CHAT[normalizarRolChat(contacto.rol)] ||
                        contacto.rol?.toUpperCase();
                      const claseRol = obtenerClaseRol(contacto.rol);
                      const horaUltimo = formatearTiempoContacto(contacto.ultimoMensaje?.fechaEnvio);

                      return (
                        <div
                          key={contacto.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => manejarSeleccionarContacto(contacto)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              manejarSeleccionarContacto(contacto);
                            }
                          }}
                          className={`chat-contacto-item ${
                            esActivo ? "chat-contacto-item--activo" : ""
                          } ${tieneNoLeidos ? "chat-contacto-item--no-leido" : ""} ${
                            contactosColapsado ? "chat-contacto-item--colapsado" : ""
                          }`}
                          title={
                            contactosColapsado
                              ? `${contacto.nombre} (${etiquetaRol})`
                              : undefined
                          }
                          aria-label={
                            contactosColapsado
                              ? `Abrir chat con ${contacto.nombre} (${etiquetaRol})`
                              : undefined
                          }
                          data-testid={`contacto-item-${contacto.id}`}
                        >
                          <div className="chat-contacto-avatar-wrap">
                            <div className={`chat-contacto-avatar ${claseRol}`}>
                              {obtenerIniciales(contacto.nombre)}
                            </div>
                            {contactosColapsado && tieneNoLeidos && (
                              <span
                                className="chat-avatar-badge-colapsado"
                                title={`${contacto.mensajesNoLeidos} mensaje(s) sin leer`}
                              >
                                {contacto.mensajesNoLeidos > 9 ? "9+" : contacto.mensajesNoLeidos}
                              </span>
                            )}
                          </div>

                          {!contactosColapsado && (
                            <>
                              <div className="chat-contacto-cuerpo">
                                <div className="chat-contacto-fila-superior">
                                  <span className="chat-contacto-nombre">{contacto.nombre}</span>
                                  {horaUltimo && (
                                    <span className="chat-contacto-hora">{horaUltimo}</span>
                                  )}
                                </div>

                                <div className="chat-contacto-meta">
                                  <span className={`chat-contacto-rol-badge ${claseRol}`}>
                                    {etiquetaRol}
                                  </span>
                                  {contacto.requiereSolicitud &&
                                    !contacto.chatHabilitado &&
                                    !(contacto.ultimoMensaje && !contacto.ultimoMensaje.esMio) && (
                                    <span
                                      className={`chat-contacto-estado-sol ${
                                        contacto.estadoSolicitud === "PENDIENTE"
                                          ? "chat-contacto-estado-sol--pendiente"
                                          : contacto.estadoSolicitud === "RECHAZADA"
                                          ? "chat-contacto-estado-sol--rechazada"
                                          : "chat-contacto-estado-sol--ninguna"
                                      }`}
                                    >
                                      {contacto.estadoSolicitud === "PENDIENTE"
                                        ? "Sol. pendiente"
                                        : contacto.estadoSolicitud === "RECHAZADA"
                                        ? "Rechazada"
                                        : "Requiere solicitud"}
                                    </span>
                                  )}
                                  {contacto.solicitudEntrante?.estado === "PENDIENTE" && (
                                    <span className="chat-contacto-estado-sol chat-contacto-estado-sol--pendiente">
                                      Solicitó chat
                                    </span>
                                  )}
                                  {tieneNoLeidos && (
                                    <span
                                      className="chat-badge-no-leidos"
                                      title={`${contacto.mensajesNoLeidos} mensaje(s) sin leer`}
                                    >
                                      {contacto.mensajesNoLeidos}
                                    </span>
                                  )}
                                </div>

                                <div className="chat-contacto-preview">
                                  {contacto.ultimoMensaje ? (
                                    <>
                                      {contacto.ultimoMensaje.esMio ? "Tú: " : ""}
                                      {contacto.ultimoMensaje.contenido}
                                    </>
                                  ) : (
                                    "Iniciar conversación"
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={ocultandoId === contacto.id}
                                onClick={(e) => manejarBorrarContacto(e, contacto)}
                                className="chat-btn-ocultar-contacto"
                                title={`Ocultar chat con ${contacto.nombre}`}
                                aria-label={`Borrar contacto ${contacto.nombre}`}
                              >
                                <i className="fa-solid fa-eye-slash" aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </aside>

              {/* PANEL PRINCIPAL DERECHO: CONVERSACIÓN ACTIVA */}
              <section className="chat-panel-principal" aria-label="Panel de conversación activa">
                {!contactoActivo ? (
                  <div className="chat-vacio-panel">
                    <div className="chat-vacio-ilustracion">
                      <img src="/icono-chat.png" alt="Chat Vakera" />
                    </div>
                    <h4 className="chat-vacio-titulo-grande">
                      Seleccioná un contacto del campo
                    </h4>
                    <p className="chat-vacio-texto-grande">
                      Elegí un agente permitido de la lista izquierda para enviar o recibir mensajes de{" "}
                      <strong>{usuarioEfectivo?.establecimiento || "tu estancia"}</strong>.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Cabecera de la conversación activa */}
                    <header className="chat-conversacion-header">
                      <div className="chat-conversacion-header__izq">
                        <button
                          type="button"
                          onClick={() => setContactoActivo(null)}
                          className="chat-btn-volver-mobile"
                          aria-label="Volver a contactos"
                          title="Volver a la lista de contactos"
                        >
                          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
                        </button>

                        <div
                          className={`chat-contacto-avatar chat-contacto-avatar--header ${obtenerClaseRol(
                            contactoActivo.rol
                          )}`}
                        >
                          {obtenerIniciales(contactoActivo.nombre)}
                        </div>

                        <div className="chat-conversacion-header__datos">
                          <div className="chat-conversacion-header__titulo-fila">
                            <h4 className="chat-conversacion-header__nombre">
                              {contactoActivo.nombre}
                            </h4>
                            <span
                              className={`chat-contacto-rol-badge ${obtenerClaseRol(
                                contactoActivo.rol
                              )}`}
                            >
                              {contactoActivo.rolEtiqueta ||
                                ETIQUETAS_ROLES_CHAT[normalizarRolChat(contactoActivo.rol)] ||
                                contactoActivo.rol?.toUpperCase()}
                            </span>
                          </div>
                          <div className="chat-conversacion-header__sub">
                            {contactoActivo.cargo || "Agente registrado"} ·{" "}
                            {contactoActivo.establecimiento || usuarioEfectivo?.establecimiento}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={ocultandoId === contactoActivo.id}
                        onClick={(e) => manejarBorrarContacto(e, contactoActivo)}
                        className="chat-btn-ocultar-header"
                        title="Ocultar conversación de la vista activa"
                      >
                        <i className="fa-solid fa-eye-slash" aria-hidden="true" />
                        <span>Ocultar chat</span>
                      </button>
                    </header>

                    {/* Barra de aprobación inline para Dueño / Administrador cuando el peón tiene solicitud pendiente */}
                    {(rolNorm === "dueno" || rolNorm === "oficina") &&
                      contactoActivo.solicitudEntrante?.estado === "PENDIENTE" && (
                        <div className="chat-solicitud-inline">
                          <div className="chat-solicitud-inline__texto">
                            <i className="fa-solid fa-user-clock" aria-hidden="true" />
                            <span>
                              <strong>{contactoActivo.nombre}</strong> solicitó permiso para responder:{" "}
                              <em>"{contactoActivo.solicitudEntrante.motivo || "Solicita chatear"}"</em>
                            </span>
                          </div>
                          <div className="chat-solicitud-item-banner__acciones">
                            <button
                              type="button"
                              disabled={procesandoSolicitud}
                              onClick={() =>
                                manejarResponderSolicitud(
                                  contactoActivo.solicitudEntrante.id,
                                  "APROBADA",
                                  contactoActivo.nombre
                                )
                              }
                              className="chat-btn-solicitud chat-btn-solicitud--aprobar"
                            >
                              Aprobar chat
                            </button>
                            <button
                              type="button"
                              disabled={procesandoSolicitud}
                              onClick={() =>
                                manejarResponderSolicitud(
                                  contactoActivo.solicitudEntrante.id,
                                  "RECHAZADA",
                                  contactoActivo.nombre
                                )
                              }
                              className="chat-btn-solicitud chat-btn-solicitud--rechazar"
                            >
                              Rechazar
                            </button>
                          </div>
                        </div>
                      )}

                    {/* Historial de mensajes */}
                    <div className="chat-mensajes-wrapper">
                      <div
                        ref={contenedorMensajesRef}
                        onScroll={manejarScrollMensajes}
                        className="chat-mensajes-contenedor"
                        data-testid="chat-mensajes-lista"
                      >
                        {cargandoMensajes ? (
                          <div className="chat-vacio-panel">
                            <i className="fa-solid fa-spinner fa-spin chat-vacio-icono" aria-hidden="true" />
                            <p className="chat-vacio-texto">Cargando conversación...</p>
                          </div>
                        ) : mensajes.length === 0 ? (
                          <div className="chat-conversacion-vacia">
                            <div
                              className={`chat-contacto-avatar chat-contacto-avatar--grande ${obtenerClaseRol(
                                contactoActivo.rol
                              )}`}
                            >
                              {obtenerIniciales(contactoActivo.nombre)}
                            </div>
                            <h5 className="chat-conversacion-vacia__titulo">
                              Iniciá la conversación con{" "}
                              <strong>{contactoActivo.nombre}</strong>
                            </h5>
                            <p className="chat-conversacion-vacia__desc">
                              {contactoActivo.cargo || "Agente del campo"} · Mensajes privados dentro
                              de tu establecimiento.
                            </p>

                            <div className="chat-sugerencias-lista" aria-label="Mensajes rápidos sugeridos">
                              {SUGERENCIAS_INICIO.map((sugerencia) => (
                                <button
                                  key={sugerencia}
                                  type="button"
                                  onClick={() => usarSugerenciaInicio(sugerencia)}
                                  className="chat-sugerencia-chip"
                                >
                                  {sugerencia}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          itemsMensajesRender.map((item) => {
                            if (item.tipo === "separador-dia") {
                              return (
                                <div key={item.key} className="chat-separador-dia">
                                  <span>{item.etiqueta}</span>
                                </div>
                              );
                            }

                            const { msg, esMio, agrupadoConAnterior, mostrarPie } = item;
                            return (
                              <div
                                key={item.key}
                                className={`chat-burbuja-fila ${
                                  esMio ? "chat-burbuja-fila--mia" : "chat-burbuja-fila--ajena"
                                } ${agrupadoConAnterior ? "chat-burbuja-fila--agrupada" : ""}`}
                              >
                                <div
                                  className={`chat-burbuja ${
                                    esMio ? "chat-burbuja--mia" : "chat-burbuja--ajena"
                                  } ${agrupadoConAnterior ? "chat-burbuja--agrupada" : ""}`}
                                >
                                  {msg.contenido}
                                </div>
                                {mostrarPie && (
                                  <span className="chat-burbuja-hora">
                                    <span>{formatearHoraMensaje(msg.fechaEnvio)}</span>
                                    {esMio && (
                                      <i
                                        className={`fa-solid ${
                                          msg.leido ? "fa-check-double" : "fa-check"
                                        } ${
                                          msg.leido
                                            ? "chat-estado-leido"
                                            : "chat-estado-enviado"
                                        }`}
                                        title={msg.leido ? "Leído" : "Enviado"}
                                        aria-label={msg.leido ? "Leído" : "Enviado"}
                                      />
                                    )}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                        <div ref={finMensajesRef} />
                      </div>

                      {mostrarIrAlFinal && (
                        <button
                          type="button"
                          onClick={() => desplazarAlFinal("smooth")}
                          className="chat-btn-ir-final"
                          aria-label="Ir al último mensaje"
                        >
                          <i className="fa-solid fa-arrow-down" aria-hidden="true" />
                          <span>Ir al final</span>
                        </button>
                      )}
                    </div>

                    {/* Barra inferior de envío de mensaje o panel de solicitud para Peón -> Admin/Dueño */}
                    {contactoActivoRequiereSolicitud && !contactoActivoChatHabilitado ? (
                      <div className="chat-solicitud-compositor" data-testid="chat-panel-solicitud-peon">
                        {contactoActivoEstadoSol === "PENDIENTE" ? (
                          <div className="chat-solicitud-pendiente-estado">
                            <i className="fa-solid fa-hourglass-half" aria-hidden="true" />
                            <div>
                              <strong>Solicitud enviada y pendiente de aprobación</strong>
                              <p>
                                Esperando que {contactoActivo.nombre} (
                                {contactoActivo.rolEtiqueta ||
                                  ETIQUETAS_ROLES_CHAT[normalizarRolChat(contactoActivo.rol)]}
                                ) apruebe la conversación para poder enviar mensajes.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <form onSubmit={manejarSolicitarChat} className="chat-solicitud-form">
                            <div className="chat-solicitud-form__info">
                              <i className="fa-solid fa-lock" aria-hidden="true" />
                              <span>
                                {contactoActivoEstadoSol === "RECHAZADA"
                                  ? `Tu solicitud anterior fue rechazada por ${contactoActivo.nombre}. Podés enviar una nueva solicitud:`
                                  : `Para chatear con ${contactoActivo.nombre} (${
                                      contactoActivo.rolEtiqueta ||
                                      ETIQUETAS_ROLES_CHAT[normalizarRolChat(contactoActivo.rol)]
                                    }), primero debés enviar una solicitud:`}
                              </span>
                            </div>
                            <div className="chat-solicitud-form__controles">
                              <input
                                type="text"
                                value={motivoSolicitud}
                                onChange={(e) => setMotivoSolicitud(e.target.value)}
                                placeholder="Motivo de la solicitud (opcional)..."
                                maxLength={300}
                                className="chat-solicitud-form__input"
                                aria-label="Motivo de solicitud de chat"
                              />
                              <button
                                type="submit"
                                disabled={procesandoSolicitud}
                                className="chat-btn-enviar"
                              >
                                <i
                                  className={`fa-solid ${
                                    procesandoSolicitud ? "fa-spinner fa-spin" : "fa-paper-plane"
                                  }`}
                                  aria-hidden="true"
                                />
                                <span>
                                  {procesandoSolicitud
                                    ? "Enviando..."
                                    : contactoActivoEstadoSol === "RECHAZADA"
                                    ? "Volver a solicitar"
                                    : "Solicitar chat"}
                                </span>
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ) : (
                      <form onSubmit={manejarEnviarMensaje} className="chat-input-barra">
                        <div className="chat-input-compositor">
                          <textarea
                            ref={inputMensajeRef}
                            rows={1}
                            value={textoMensaje}
                            onChange={(e) => setTextoMensaje(e.target.value)}
                            onKeyDown={manejarTeclaCompositor}
                            placeholder={`Escribir mensaje a ${contactoActivo.nombre}...`}
                            className="chat-input-texto"
                            maxLength={LIMITE_CARACTERES_MENSAJE}
                            disabled={enviando}
                            aria-label="Escribir mensaje"
                          />
                          {longitudActual >= 1600 && (
                            <span
                              className={`chat-contador-caracteres ${
                                longitudActual >= 1950 ? "chat-contador-caracteres--limite" : ""
                              }`}
                            >
                              {longitudActual}/{LIMITE_CARACTERES_MENSAJE}
                            </span>
                          )}
                        </div>

                        <button
                          type="submit"
                          disabled={enviando || !textoMensaje.trim()}
                          className="chat-btn-enviar"
                        >
                          <i
                            className={`fa-solid ${
                              enviando ? "fa-spinner fa-spin" : "fa-paper-plane"
                            }`}
                            aria-hidden="true"
                          />
                          <span>{enviando ? "Enviando..." : "Enviar"}</span>
                        </button>
                      </form>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>
        )}

        {/* BOTÓN FLOTANTE EN LA ESQUINA INFERIOR DERECHA */}
        <button
          type="button"
          onClick={alternarChat}
          className={`chat-flotante-boton ${abierto && !cerrando ? "chat-flotante-boton--activo" : ""}`}
          title={abierto && !cerrando ? "Cerrar chat de campo" : "Abrir chat de campo"}
          aria-label="Abrir o cerrar chat flotante de campo"
          aria-expanded={abierto && !cerrando}
        >
          <img
            src="/icono-chat.png"
            alt="Icono de Chat Vakera"
            className="chat-flotante-icono-img"
          />
          {badgeGlobalTotal > 0 && (
            <span
              className="chat-flotante-badge-global"
              title={`${totalNoLeidos} mensaje(s) sin leer y ${solicitudesPendientes.length} solicitud(es) pendiente(s)`}
            >
              {badgeGlobalTotal > 99 ? "99+" : badgeGlobalTotal}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
