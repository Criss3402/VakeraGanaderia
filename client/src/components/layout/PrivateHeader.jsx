import { useState, useEffect, useRef, useCallback } from "react";
import { obtenerNotificaciones, responderPermisoParcelas } from "../../api/dashboard.api";

function obtenerIconoNotificacion(tipo) {
  switch (tipo) {
    case "permiso_parcela":
    case "estado_permiso_parcela":
      return { icono: "fa-map-location-dot", color: "text-amber-700 bg-amber-100" };
    case "stock":
      return { icono: "fa-boxes-stacked", color: "text-red-700 bg-red-100" };
    case "sanidad":
      return { icono: "fa-syringe", color: "text-emerald-700 bg-emerald-100" };
    case "parte":
      return { icono: "fa-clipboard-list", color: "text-blue-700 bg-blue-100" };
    case "chat":
      return { icono: "fa-comments", color: "text-purple-700 bg-purple-100" };
    default:
      return { icono: "fa-bell", color: "text-[#182920] bg-[#e7dfcb]" };
  }
}

export default function PrivateHeader({
  alAbrirMenu,
  alIrALanding,
  alCambiarVista,
  colapsado = false,
  alToggleColapso,
}) {
  const [hora, setHora] = useState("");
  const [fecha, setFecha] = useState("");
  const [abiertoNotif, setAbiertoNotif] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargandoNotif, setCargandoNotif] = useState(false);
  const [procesandoId, setProcesandoId] = useState(null);
  const [vistasOcultasIds, setVistasOcultasIds] = useState(() => new Set());

  const contenedorNotifRef = useRef(null);

  const cargarNotificaciones = useCallback(async (silencioso = true) => {
    if (!silencioso) setCargandoNotif(true);
    try {
      const res = await obtenerNotificaciones();
      if (res?.data?.notificaciones) {
        setNotificaciones(res.data.notificaciones);
      }
    } catch (err) {
      console.warn("[PrivateHeader] No se pudieron cargar notificaciones:", err.message);
    } finally {
      if (!silencioso) setCargandoNotif(false);
    }
  }, []);

  useEffect(() => {
    function actualizarFechaHora() {
      const ahora = new Date();
      const opcionesFecha = {
        weekday: "short",
        day: "numeric",
        month: "short",
      };
      const fechaFormateada = ahora.toLocaleDateString("es-ES", opcionesFecha);
      setFecha(fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1));

      const horas = String(ahora.getHours()).padStart(2, "0");
      const minutos = String(ahora.getMinutes()).padStart(2, "0");
      setHora(`${horas}:${minutos}`);
    }

    actualizarFechaHora();
    const intervalo = setInterval(actualizarFechaHora, 1000 * 30);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    cargarNotificaciones(true);
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      cargarNotificaciones(true);
    }, 15000);

    function manejarEventoActualizar() {
      cargarNotificaciones(true);
    }
    window.addEventListener("vakera:notificaciones-actualizar", manejarEventoActualizar);
    return () => {
      clearInterval(timer);
      window.removeEventListener("vakera:notificaciones-actualizar", manejarEventoActualizar);
    };
  }, [cargarNotificaciones]);

  useEffect(() => {
    if (!abiertoNotif) return;
    function manejarClickFuera(e) {
      if (contenedorNotifRef.current && !contenedorNotifRef.current.contains(e.target)) {
        setAbiertoNotif(false);
      }
    }
    function manejarEscape(e) {
      if (e.key === "Escape") setAbiertoNotif(false);
    }
    document.addEventListener("mousedown", manejarClickFuera);
    window.addEventListener("keydown", manejarEscape);
    return () => {
      document.removeEventListener("mousedown", manejarClickFuera);
      window.removeEventListener("keydown", manejarEscape);
    };
  }, [abiertoNotif]);

  const notificacionesVisibles = notificaciones.filter((n) => !vistasOcultasIds.has(n.id));
  const totalBadge = notificacionesVisibles.length;

  async function manejarAlternarNotificaciones() {
    const proximo = !abiertoNotif;
    setAbiertoNotif(proximo);
    if (proximo) {
      await cargarNotificaciones(false);
    }
  }

  async function manejarResponderPermiso(e, solicitudId, estado) {
    e.stopPropagation();
    if (!solicitudId || procesandoId) return;
    setProcesandoId(solicitudId);
    try {
      await responderPermisoParcelas(solicitudId, estado);
      await cargarNotificaciones(true);
      window.dispatchEvent(new CustomEvent("vakera:permisos-parcelas-actualizados"));
    } catch (err) {
      console.warn("[PrivateHeader] Error al responder permiso de parcela:", err.message);
    } finally {
      setProcesandoId(null);
    }
  }

  function manejarClickNotificacion(notif) {
    setAbiertoNotif(false);
    if (notif?.vistaDestino && typeof alCambiarVista === "function") {
      alCambiarVista(notif.vistaDestino);
    }
  }

  function manejarMarcarTodasLeidas() {
    setVistasOcultasIds((prev) => {
      const next = new Set(prev);
      notificaciones.forEach((n) => {
        if (!n.requiereAccion) next.add(n.id);
      });
      return next;
    });
  }

  return (
    <header className="h-20 bg-[#f1ecdd] border-b border-[#ded7c4] flex items-center justify-between px-4 md:px-6 lg:px-8 shrink-0 z-20 transition-colors shadow-sm">
      {/* Left: Toggles & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={alAbrirMenu}
          className="md:hidden text-[#182920] hover:text-[#33512f] p-2 rounded-xl bg-[#e7dfcb] border border-[#d2c8b0] text-lg"
          aria-label="Abrir menú de navegación"
        >
          <i className="fa-solid fa-bars"></i>
        </button>

        {/* Desktop Sidebar Toggle Button */}
        <button
          type="button"
          onClick={alToggleColapso}
          className="hidden md:flex items-center justify-center w-10 h-10 rounded-xl bg-[#e7dfcb] hover:bg-[#182920] hover:text-[#f1ecdd] text-[#182920] border border-[#d2c8b0] transition-all duration-200 shadow-sm"
          title={colapsado ? "Expandir barra lateral" : "Colapsar barra lateral"}
          aria-label={colapsado ? "Expandir barra lateral" : "Colapsar barra lateral"}
        >
          <i className={`fa-solid ${colapsado ? "fa-bars-staggered" : "fa-bars"} text-base`}></i>
        </button>

        {/* Search */}
        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7c6d] text-sm"></i>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border border-[#d9ceb7] rounded-xl text-sm bg-[#fcfbf7] text-[#182920] placeholder-[#7d8c7e] focus:bg-white focus:border-[#182920] focus:ring-1 focus:ring-[#182920] outline-none transition-all shadow-inner"
            placeholder="Buscar animales, lotes, insumos..."
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3 lg:gap-5">
        {/* Ver Landing Page */}
        <button
          type="button"
          onClick={alIrALanding}
          className="hidden md:inline-flex text-xs font-semibold text-[#f1ecdd] bg-[#182920] hover:bg-[#33512f] px-3 py-1.5 rounded-xl border border-[#182920] items-center gap-1.5 transition-all shadow-sm"
          title="Ver Landing Page pública"
        >
          <i className="fa-solid fa-globe text-[#8fb56b]"></i> Ver Web
        </button>

        {/* Alertas y Notificaciones */}
        <div className="relative flex items-center gap-2" ref={contenedorNotifRef}>
          <button
            type="button"
            onClick={manejarAlternarNotificaciones}
            aria-label="Abrir notificaciones"
            aria-expanded={abiertoNotif}
            className={`relative w-10 h-10 rounded-xl border flex items-center justify-center transition-colors shadow-sm cursor-pointer ${
              abiertoNotif
                ? "bg-[#182920] text-[#f1ecdd] border-[#182920]"
                : "bg-[#e7dfcb] hover:bg-[#d8cfb7] border-[#d2c8b0] text-[#182920]"
            }`}
            title={
              totalBadge > 0
                ? `${totalBadge} notificación(es) pendiente(s)`
                : "Sin notificaciones pendientes"
            }
          >
            <i className="fa-regular fa-bell text-base"></i>
            {totalBadge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 border-2 border-[#f1ecdd] rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                {totalBadge > 99 ? "99+" : totalBadge}
              </span>
            )}
          </button>

          {abiertoNotif && (
            <div
              role="region"
              aria-label="Centro de notificaciones"
              className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-2xl border border-[#ded7c4] shadow-2xl z-50 overflow-hidden animate-fade-in"
            >
              <div className="bg-[#182920] text-[#f1ecdd] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-bell text-[#8fb56b] text-sm"></i>
                  <span className="font-bold text-sm">Notificaciones</span>
                  {totalBadge > 0 && (
                    <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      {totalBadge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {notificacionesVisibles.some((n) => !n.requiereAccion) && (
                    <button
                      type="button"
                      onClick={manejarMarcarTodasLeidas}
                      className="text-[11px] font-semibold text-[#8fb56b] hover:text-white transition-colors cursor-pointer"
                    >
                      Limpiar avisos
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => cargarNotificaciones(false)}
                    className="text-xs text-[#ded7c4] hover:text-white p-1 cursor-pointer"
                    title="Actualizar notificaciones"
                    aria-label="Actualizar notificaciones"
                  >
                    <i className={`fa-solid fa-rotate ${cargandoNotif ? "fa-spin" : ""}`}></i>
                  </button>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-[#eee7d7]">
                {cargandoNotif && notificacionesVisibles.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#6b7c6d]">
                    <i className="fa-solid fa-spinner fa-spin mr-1.5"></i> Cargando notificaciones...
                  </div>
                ) : notificacionesVisibles.length === 0 ? (
                  <div className="p-6 text-center space-y-1">
                    <i className="fa-regular fa-circle-check text-2xl text-emerald-600"></i>
                    <p className="text-sm font-bold text-[#182920]">Todo al día</p>
                    <p className="text-xs text-[#6b7c6d]">
                      No tenés alertas ni solicitudes pendientes.
                    </p>
                  </div>
                ) : (
                  notificacionesVisibles.map((notif) => {
                    const estilo = obtenerIconoNotificacion(notif.tipo);
                    return (
                      <div
                        key={notif.id}
                        onClick={() => manejarClickNotificacion(notif)}
                        className="p-3.5 hover:bg-[#f8f5eb] transition-colors cursor-pointer flex items-start gap-3"
                      >
                        <div
                          className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-sm ${estilo.color}`}
                        >
                          <i className={`fa-solid ${estilo.icono}`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-extrabold text-[#182920] leading-snug">
                            {notif.titulo}
                          </p>
                          <p className="text-[11px] text-[#526354] mt-0.5 leading-relaxed">
                            {notif.descripcion}
                          </p>

                          {notif.tipo === "permiso_parcela" && notif.solicitudId && (
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                type="button"
                                disabled={procesandoId === notif.solicitudId}
                                onClick={(e) =>
                                  manejarResponderPermiso(e, notif.solicitudId, "APROBADA")
                                }
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                disabled={procesandoId === notif.solicitudId}
                                onClick={(e) =>
                                  manejarResponderPermiso(e, notif.solicitudId, "RECHAZADA")
                                }
                                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="hidden lg:block h-7 w-px bg-[#ded7c4]"></div>

        {/* Fecha y Hora */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-[#182920] bg-[#e7dfcb] px-3 py-1.5 rounded-xl border border-[#d2c8b0] shadow-sm font-medium">
          <i className="fa-regular fa-clock text-[#33512f]"></i>
          <span className="font-bold text-[#182920]">{hora || "12:00"}</span>
          <span className="text-[#8fb56b] font-bold">·</span>
          <span className="capitalize text-[#33512f]">{fecha}</span>
        </div>
      </div>
    </header>
  );
}
