import { useState, useEffect, useRef, useCallback } from "react";
import Alert from "../../../components/ui/Alert.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import {
  obtenerContactosChat,
  obtenerMensajesChat,
  enviarMensajeChat,
  ocultarContactoChat,
  restaurarContactosChat,
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
 * MATRIZ ESTRICTA DE PERMISOS DE CHAT POR ROL DE ESTANCIA:
 * - PEÓN: Solo puede enviar y recibir mensajes del CAPATAZ.
 * - CAPATAZ: Puede chatear con el ADMINISTRADOR (oficina), PEÓN y VETERINARIO.
 * - VETERINARIO: Puede chatear con el DUEÑO, ADMINISTRADOR (oficina) y CAPATAZ.
 * - ADMINISTRADOR (oficina): Puede chatear con el CAPATAZ, VETERINARIO y DUEÑO.
 * - DUEÑO: Puede chatear con el VETERINARIO y ADMINISTRADOR (oficina).
 */
export const MATRIZ_CHAT_ROLES = {
  peon: ["capataz"],
  capataz: ["oficina", "peon", "veterinario"],
  veterinario: ["dueno", "oficina", "capataz"],
  oficina: ["capataz", "veterinario", "dueno"],
  dueno: ["veterinario", "oficina"],
};

export const ETIQUETAS_ROLES_CHAT = {
  peon: "Peón",
  capataz: "Capataz",
  veterinario: "Veterinario",
  oficina: "Administrador",
  dueno: "Dueño",
};

/**
 * Filtro defensivo estricto de contactos por rol permitido y pertenencia al mismo espacio (campo).
 */
export function filtrarContactosPermitidos(contactos, usuarioActual, idsOcultosLocal = new Set()) {
  if (!usuarioActual || !usuarioActual.establecimientoId || !Array.isArray(contactos)) {
    return [];
  }
  const rolUsuario = normalizarRolChat(usuarioActual.rol);
  const rolesPermitidos = MATRIZ_CHAT_ROLES[rolUsuario] || [];

  return contactos.filter((c) => {
    if (!c || c.id === usuarioActual.id) return false;
    if (idsOcultosLocal.has(c.id)) return false;
    if (!c.establecimientoId || c.establecimientoId !== usuarioActual.establecimientoId) {
      return false;
    }
    const rolContacto = normalizarRolChat(c.rol);
    return rolesPermitidos.includes(rolContacto);
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

function formatearHoraMensaje(fechaIso) {
  if (!fechaIso) return "";
  try {
    const fecha = new Date(fechaIso);
    if (Number.isNaN(fecha.getTime())) return "";
    return fecha.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ChatView({ abiertoInicial = false }) {
  const { usuario } = useAuth();
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [cerrando, setCerrando] = useState(false);
  const timerCierreRef = useRef(null);
  const [contactos, setContactos] = useState([]);
  const [usuarioChatInfo, setUsuarioChatInfo] = useState(null);
  const [idsOcultosLocal, setIdsOcultosLocal] = useState(() => new Set());
  const [ocultosCount, setOcultosCount] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [contactoActivo, setContactoActivo] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [textoMensaje, setTextoMensaje] = useState("");

  const [cargandoContactos, setCargandoContactos] = useState(false);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [ocultandoId, setOcultandoId] = useState(null);
  const [error, setError] = useState(null);
  const [notificacion, setNotificacion] = useState(null);

  const finMensajesRef = useRef(null);

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
    }, 330);
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
      if (timerCierreRef.current) {
        clearTimeout(timerCierreRef.current);
      }
    };
  }, []);

  const usuarioEfectivo = usuarioChatInfo || usuario;
  const rolNorm = normalizarRolChat(usuarioEfectivo?.rol || "peon");
  const rolesPermitidos = MATRIZ_CHAT_ROLES[rolNorm] || [];
  const nombresRolesPermitidos = rolesPermitidos.map((r) => ETIQUETAS_ROLES_CHAT[r] || r.toUpperCase());

  const cargarContactos = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargandoContactos(true);
    try {
      const res = await obtenerContactosChat();
      if (res?.data) {
        const usrServidor = res.data.usuarioActual || usuario;
        setUsuarioChatInfo(usrServidor);
        setContactos(res.data.contactos || []);
        setOcultosCount(res.data.ocultosCount || 0);
      }
    } catch (err) {
      if (!silencioso) {
        setError(err.message || "No se pudo cargar la lista de contactos del campo.");
      }
    } finally {
      if (!silencioso) setCargandoContactos(false);
    }
  }, [usuario]);

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
          prev.map((c) => (c.id === idContacto ? { ...c, mensajesNoLeidos: 0 } : c))
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

  // Polling ligero para mantener mensajes y notificaciones al día
  useEffect(() => {
    const timer = setInterval(() => {
      cargarContactos(true);
      if (abierto && contactoActivo?.id) {
        cargarConversacion(contactoActivo.id, true);
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [abierto, cargarContactos, cargarConversacion, contactoActivo?.id]);

  // Desplazar automáticamente al último mensaje cuando llegan nuevos
  useEffect(() => {
    if (abierto && finMensajesRef.current && typeof finMensajesRef.current.scrollIntoView === "function") {
      finMensajesRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [abierto, mensajes.length, contactoActivo?.id]);

  // Aplicar filtro estricto (rol en base de datos + mismo espacio/campo + no oculto + búsqueda)
  const contactosFiltradosPorRegla = filtrarContactosPermitidos(
    contactos,
    usuarioEfectivo,
    idsOcultosLocal
  );

  const totalNoLeidos = contactosFiltradosPorRegla.reduce(
    (acc, c) => acc + (Number(c.mensajesNoLeidos) || 0),
    0
  );

  const contactosVisibles = contactosFiltradosPorRegla.filter((c) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase().trim();
    const etiqueta = (c.rolEtiqueta || ETIQUETAS_ROLES_CHAT[normalizarRolChat(c.rol)] || "").toLowerCase();
    return (
      (c.nombre || "").toLowerCase().includes(q) ||
      (c.cargo || "").toLowerCase().includes(q) ||
      etiqueta.includes(q)
    );
  });

  async function manejarSeleccionarContacto(contacto) {
    setError(null);
    setContactoActivo(contacto);
    await cargarConversacion(contacto.id, false);
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
      setNotificacion(
        res?.mensaje || `El contacto ${contacto.nombre} fue ocultado de tu vista activa.`
      );
    } catch (err) {
      setError(err.message || "Error al ocultar el contacto en el servidor.");
      await cargarContactos(true);
    } finally {
      setOcultandoId(null);
    }
  }

  async function manejarRestaurarContactos() {
    setError(null);
    try {
      await restaurarContactosChat();
      setIdsOcultosLocal(new Set());
      setNotificacion("Los contactos ocultos de tu espacio fueron restaurados.");
      await cargarContactos(false);
    } catch (err) {
      setError(err.message || "No se pudieron restaurar los contactos ocultos.");
    }
  }

  async function manejarEnviarMensaje(e) {
    e.preventDefault();
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
    }
  }

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
      {/* VENTANA FLOTANTE COMPARTIMENTADA (SE DESPLIEGA SOBRE EL BOTÓN FLOTANTE) */}
      {abierto && (
        <div
          className={`chat-flotante-ventana ${cerrando ? "chat-flotante-ventana--cerrando" : ""}`}
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
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.92rem", lineHeight: 1.2 }}>
                  Chat de Estancia · {usuarioEfectivo?.establecimiento || "Campo Activo"}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#8fb56b", marginTop: "2px" }}>
                  Solamente agentes registrados en este espacio (campo)
                </div>
              </div>
            </div>

            <div className="chat-flotante-topbar__der">
              <button
                type="button"
                onClick={cerrarChat}
                className="chat-flotante-btn-cerrar"
                title="Minimizar chat"
                aria-label="Cerrar ventana de chat"
              >
                <i className="fa-solid fa-minus"></i>
              </button>
            </div>
          </div>

          {/* Aviso de matriz de visibilidad */}
          <div className="chat-aviso-espacio">
            <div className="chat-aviso-espacio__info">
              <i className="fa-solid fa-shield-halved" style={{ color: "#33512f" }}></i>
              <span>
                Rol activo: <strong>{ETIQUETAS_ROLES_CHAT[rolNorm] || rolNorm.toUpperCase()}</strong>
              </span>
            </div>

            <div className="chat-aviso-espacio__roles">
              <span>Habilitado con:</span>
              {nombresRolesPermitidos.map((etiquetaRol) => (
                <span key={etiquetaRol} className="chat-rol-pill">
                  {etiquetaRol}
                </span>
              ))}
            </div>
          </div>

          {notificacion && (
            <div style={{ padding: "8px 12px 0 12px" }}>
              <Alert tipo="exito" alCerrar={() => setNotificacion(null)}>
                {notificacion}
              </Alert>
            </div>
          )}

          {error && (
            <div style={{ padding: "8px 12px 0 12px" }}>
              <Alert tipo="error" alCerrar={() => setError(null)}>
                {error}
              </Alert>
            </div>
          )}

          {/* Interfaz Divisoria: Panel Lateral de Contactos + Panel Principal de Conversación */}
          <div className="chat-divisorio">
            {/* PANEL LATERAL IZQUIERDO: LISTA DE CONTACTOS PERMITIDOS */}
            <aside className="chat-panel-contactos" aria-label="Lista de contactos permitidos">
              <div className="chat-panel-contactos__header">
                <div className="chat-panel-contactos__titulo-fila">
                  <h3 className="chat-panel-contactos__titulo">
                    <i className="fa-solid fa-users" style={{ color: "#33512f", fontSize: "0.85rem" }}></i>
                    <span style={{ fontSize: "0.88rem" }}>Contactos ({contactosVisibles.length})</span>
                  </h3>

                  {ocultosCount > 0 && (
                    <button
                      type="button"
                      onClick={manejarRestaurarContactos}
                      className="chat-rol-pill chat-rol-pill--secundario"
                      style={{ cursor: "pointer" }}
                      title="Restaurar contactos ocultados previamente"
                    >
                      <i className="fa-solid fa-eye"></i> Restaurar ({ocultosCount})
                    </button>
                  )}
                </div>

                <div style={{ position: "relative" }}>
                  <i
                    className="fa-solid fa-magnifying-glass"
                    style={{
                      position: "absolute",
                      left: "11px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#6b7c6d",
                      fontSize: "0.78rem",
                    }}
                  ></i>
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar contacto..."
                    className="chat-buscador-input"
                    aria-label="Filtrar contactos permitidos"
                  />
                </div>
              </div>

              <div className="chat-contactos-lista">
                {cargandoContactos ? (
                  <div className="chat-vacio-panel" style={{ padding: "16px" }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: "1.2rem", color: "#33512f", marginBottom: "8px" }}></i>
                    <p style={{ fontSize: "0.78rem" }}>Cargando agentes del campo...</p>
                  </div>
                ) : contactosVisibles.length === 0 ? (
                  <div className="chat-vacio-panel" style={{ padding: "16px 12px" }}>
                    <i className="fa-solid fa-user-lock" style={{ fontSize: "1.35rem", color: "#8fb56b", marginBottom: "8px" }}></i>
                    <p style={{ fontWeight: 700, color: "#182920", fontSize: "0.82rem", marginBottom: "4px" }}>
                      Sin contactos visibles en este espacio
                    </p>
                    <p style={{ fontSize: "0.74rem", lineHeight: 1.35 }}>
                      Solo se muestran los agentes registrados en <strong>{usuarioEfectivo?.establecimiento || "tu campo"}</strong> con rol{" "}
                      <strong>{nombresRolesPermitidos.join(", ")}</strong>.
                    </p>
                    {ocultosCount > 0 && (
                      <button
                        type="button"
                        onClick={manejarRestaurarContactos}
                        className="boton-anadir-empleado"
                        style={{ marginTop: "10px", fontSize: "0.74rem", padding: "6px 12px" }}
                      >
                        <i className="fa-solid fa-rotate-left"></i> Mostrar {ocultosCount} oculto(s)
                      </button>
                    )}
                  </div>
                ) : (
                  contactosVisibles.map((contacto) => {
                    const esActivo = contactoActivo?.id === contacto.id;
                    const etiquetaRol =
                      contacto.rolEtiqueta ||
                      ETIQUETAS_ROLES_CHAT[normalizarRolChat(contacto.rol)] ||
                      contacto.rol?.toUpperCase();

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
                        className={`chat-contacto-item ${esActivo ? "chat-contacto-item--activo" : ""}`}
                        data-testid={`contacto-item-${contacto.id}`}
                      >
                        <div className="chat-contacto-avatar" style={{ width: "34px", height: "34px", fontSize: "0.76rem" }}>
                          {obtenerIniciales(contacto.nombre)}
                        </div>

                        <div className="chat-contacto-cuerpo">
                          <div className="chat-contacto-nombre" style={{ fontSize: "0.82rem" }}>
                            {contacto.nombre}
                          </div>
                          <div className="chat-contacto-meta">
                            <span className="chat-contacto-rol-badge">{etiquetaRol}</span>
                          </div>
                          <div className="chat-contacto-preview" style={{ fontSize: "0.72rem" }}>
                            {contacto.ultimoMensaje ? (
                              <>
                                {contacto.ultimoMensaje.esMio ? "Tú: " : ""}
                                {contacto.ultimoMensaje.contenido}
                              </>
                            ) : (
                              "Iniciar chat"
                            )}
                          </div>
                        </div>

                        <div className="chat-contacto-acciones">
                          {contacto.mensajesNoLeidos > 0 && (
                            <span
                              className="chat-badge-no-leidos"
                              title={`${contacto.mensajesNoLeidos} mensaje(s) sin leer`}
                            >
                              {contacto.mensajesNoLeidos}
                            </span>
                          )}

                          <button
                            type="button"
                            disabled={ocultandoId === contacto.id}
                            onClick={(e) => manejarBorrarContacto(e, contacto)}
                            className="chat-btn-borrar-contacto"
                            title={`Borrar contacto / Ocultar chat con ${contacto.nombre}`}
                            aria-label={`Borrar contacto ${contacto.nombre}`}
                          >
                            <i className="fa-solid fa-eye-slash"></i>
                            <span>Borrar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>

            {/* PANEL PRINCIPAL DERECHO: CONVERSACIÓN ACTIVA */}
            <section className="chat-panel-principal" aria-label="Panel de conversación activa">
              {!contactoActivo ? (
                <div className="chat-vacio-panel" style={{ padding: "24px" }}>
                  <img
                    src="/icono-chat.png"
                    alt="Chat"
                    style={{ width: "56px", height: "56px", objectFit: "contain", marginBottom: "12px" }}
                  />
                  <h4 style={{ fontSize: "1rem", color: "#182920", marginBottom: "6px" }}>
                    Seleccioná un contacto del campo
                  </h4>
                  <p style={{ fontSize: "0.8rem", maxWidth: "320px", lineHeight: 1.45 }}>
                    Elegí un agente permitido de la lista izquierda para enviar o recibir mensajes de{" "}
                    <strong>{usuarioEfectivo?.establecimiento || "tu estancia"}</strong>.
                  </p>
                </div>
              ) : (
                <>
                  {/* Cabecera de la conversación activa */}
                  <header className="chat-conversacion-header" style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <div className="chat-contacto-avatar" style={{ width: "34px", height: "34px", fontSize: "0.78rem" }}>
                        {obtenerIniciales(contactoActivo.nombre)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#182920" }}>
                            {contactoActivo.nombre}
                          </h4>
                          <span className="chat-contacto-rol-badge">
                            {contactoActivo.rolEtiqueta ||
                              ETIQUETAS_ROLES_CHAT[normalizarRolChat(contactoActivo.rol)] ||
                              contactoActivo.rol?.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.71rem", color: "#5e6f61" }}>
                          {contactoActivo.cargo || "Agente registrado"} · {contactoActivo.establecimiento || usuarioEfectivo?.establecimiento}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => manejarBorrarContacto(e, contactoActivo)}
                      className="chat-btn-borrar-contacto"
                      title="Ocultar chat / Borrar contacto de la vista activa"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                      <span>Ocultar chat</span>
                    </button>
                  </header>

                  {/* Historial de mensajes */}
                  <div className="chat-mensajes-contenedor" data-testid="chat-mensajes-lista" style={{ padding: "14px" }}>
                    {cargandoMensajes ? (
                      <div className="chat-vacio-panel">
                        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: "1.2rem", color: "#33512f", marginBottom: "8px" }}></i>
                        <p style={{ fontSize: "0.8rem" }}>Cargando conversación...</p>
                      </div>
                    ) : mensajes.length === 0 ? (
                      <div className="chat-vacio-panel">
                        <p style={{ fontSize: "0.82rem", color: "#5e6f61" }}>
                          Iniciá la conversación con <strong>{contactoActivo.nombre}</strong>.
                        </p>
                      </div>
                    ) : (
                      mensajes.map((msg) => {
                        const esMio = Boolean(msg.esMio || msg.remitenteId === usuarioEfectivo?.id);
                        return (
                          <div
                            key={msg.id}
                            className={`chat-burbuja-fila ${esMio ? "chat-burbuja-fila--mia" : "chat-burbuja-fila--ajena"}`}
                          >
                            <div className={`chat-burbuja ${esMio ? "chat-burbuja--mia" : "chat-burbuja--ajena"}`}>
                              {msg.contenido}
                            </div>
                            <span className="chat-burbuja-hora">
                              <span>{formatearHoraMensaje(msg.fechaEnvio)}</span>
                              {esMio && (
                                <i
                                  className="fa-solid fa-check-double"
                                  style={{ color: msg.leido ? "#33512f" : "#9aa89c" }}
                                  title={msg.leido ? "Leído" : "Enviado"}
                                ></i>
                              )}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={finMensajesRef} />
                  </div>

                  {/* Barra inferior de envío de mensaje */}
                  <form onSubmit={manejarEnviarMensaje} className="chat-input-barra" style={{ padding: "10px 12px" }}>
                    <input
                      type="text"
                      value={textoMensaje}
                      onChange={(e) => setTextoMensaje(e.target.value)}
                      placeholder={`Escribir mensaje a ${contactoActivo.nombre}...`}
                      className="chat-input-texto"
                      style={{ padding: "9px 12px", fontSize: "0.84rem" }}
                      maxLength={2000}
                      disabled={enviando}
                      aria-label="Escribir mensaje"
                    />
                    <button
                      type="submit"
                      disabled={enviando || !textoMensaje.trim()}
                      className="chat-btn-enviar"
                      style={{ padding: "9px 14px", fontSize: "0.82rem" }}
                    >
                      <i className="fa-solid fa-paper-plane"></i>
                      <span>{enviando ? "..." : "Enviar"}</span>
                    </button>
                  </form>
                </>
              )}
            </section>
          </div>
        </div>
      )}

      {/* BOTÓN FLOTANTE EN LA ESQUINA INFERIOR DERECHA CON EL ICONO DE LA 3RA IMAGEN */}
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
        {totalNoLeidos > 0 && (
          <span className="chat-flotante-badge-global" title={`${totalNoLeidos} mensaje(s) sin leer`}>
            {totalNoLeidos}
          </span>
        )}
      </button>
    </div>
    </>
  );
}
