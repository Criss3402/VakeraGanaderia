import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import Button from "../ui/Button";

// Mapa de pre-carga bajo demanda al pasar el cursor (Hover Prefetching)
const PREFETCH_MODULOS = {
  metricas: () => import("../../views/3_dashboard/DashboardView.jsx"),
  ganado: () => import("../../views/3_dashboard/modulos/GanadoView.jsx"),
  "ganado-lotes": () => import("../../views/3_dashboard/modulos/GanadoView.jsx"),
  "ganado-potreros": () => import("../../views/3_dashboard/modulos/GanadoView.jsx"),
  "ganado-reproduccion": () => import("../../views/3_dashboard/modulos/GanadoView.jsx"),
  parcelas: () => import("../../views/3_dashboard/modulos/ParcelasView.jsx"),
  partes: () => import("../../views/3_dashboard/modulos/PartesView.jsx"),
  sanidad: () => import("../../views/3_dashboard/modulos/SanidadView.jsx"),
  insumos: () => import("../../views/3_dashboard/modulos/InsumosView.jsx"),
  finanzas: () => import("../../views/3_dashboard/modulos/FinanzasView.jsx"),
  "finanzas-parametros": () => import("../../views/3_dashboard/modulos/FinanzasView.jsx"),
  reportes: () => import("../../views/3_dashboard/modulos/ReportesView.jsx"),
  tambo: () => import("../../views/3_dashboard/modulos/TamboLecheView.jsx"),
  "tambo-vacas-ordenadas": () => import("../../views/3_dashboard/modulos/TamboLecheView.jsx"),
  permisos: () => import("../../views/4_permisos/GestionUsuariosView.jsx"),
};

function precargarModulo(id) {
  const loader = PREFETCH_MODULOS[id];
  if (loader) {
    loader().catch(() => {});
  }
}

export default function Sidebar({
  vistaActiva,
  alCambiarVista,
  menuAbierto,
  alCerrarMenu,
  alIrALanding,
  colapsado = false,
  alToggleColapso,
}) {
  const { usuario, rol, cerrarSesion } = useAuth();
  const [mostrarOpcionesPerfil, setMostrarOpcionesPerfil] = useState(false);
  const [confirmarCerrarSesion, setConfirmarCerrarSesion] = useState(false);
  const [cerrandoModal, setCerrandoModal] = useState(false);
  const timerCierreRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerCierreRef.current) clearTimeout(timerCierreRef.current);
    };
  }, []);

  const abrirConfirmacionCerrarSesion = useCallback(() => {
    if (timerCierreRef.current) {
      clearTimeout(timerCierreRef.current);
      timerCierreRef.current = null;
    }
    setCerrandoModal(false);
    setConfirmarCerrarSesion(true);
  }, []);

  const cancelarConfirmacionCerrarSesion = useCallback(() => {
    if (!confirmarCerrarSesion || cerrandoModal) return;
    setCerrandoModal(true);
    timerCierreRef.current = setTimeout(() => {
      setCerrandoModal(false);
      setConfirmarCerrarSesion(false);
      timerCierreRef.current = null;
    }, 280);
  }, [confirmarCerrarSesion, cerrandoModal]);

  useEffect(() => {
    if (!confirmarCerrarSesion || cerrandoModal) return;
    function manejarEscape(e) {
      if (e.key === "Escape") cancelarConfirmacionCerrarSesion();
    }
    window.addEventListener("keydown", manejarEscape);
    return () => window.removeEventListener("keydown", manejarEscape);
  }, [confirmarCerrarSesion, cerrandoModal, cancelarConfirmacionCerrarSesion]);

  function confirmarSalida() {
    if (timerCierreRef.current) {
      clearTimeout(timerCierreRef.current);
      timerCierreRef.current = null;
    }
    setCerrandoModal(false);
    setConfirmarCerrarSesion(false);
    cerrarSesion();
  }

  const esDueno = rol === "dueno";

  const enlaces = [
    { id: "metricas", etiqueta: "Panel General", icono: "fa-house" },
    { id: "parcelas", etiqueta: "Parcelas", icono: "fa-draw-polygon" },
    {
      id: "ganado",
      etiqueta: "Ganado",
      icono: "fa-cow",
      subEnlaces: [
        { id: "ganado-lotes", etiqueta: "Lotes y Traslados", icono: "fa-layer-group" },
        { id: "ganado-potreros", etiqueta: "Zonificación", icono: "fa-map" },
        { id: "ganado-reproduccion", etiqueta: "Reproducción y Preñez", icono: "fa-heart-pulse" },
      ],
    },
    {
      id: "tambo",
      etiqueta: "Tambo y Leche",
      icono: "fa-droplet",
      subEnlaces: [
        { id: "tambo-vacas-ordenadas", etiqueta: "Vacas Ordeñadas", icono: "fa-clipboard-check" },
      ],
    },
    { id: "insumos", etiqueta: "Insumos y Stock", icono: "fa-boxes-stacked" },
    { id: "sanidad", etiqueta: "Sanidad y Vacunas", icono: "fa-syringe" },
    { id: "partes", etiqueta: "Partes de Campo", icono: "fa-clipboard-list" },
    {
      id: "finanzas",
      etiqueta: "Costos y Finanzas",
      icono: "fa-coins",
      visible: rol === "dueno" || rol === "oficina",
      subEnlaces: [
        { id: "finanzas-parametros", etiqueta: "Parámetros Modelo", icono: "fa-sliders" },
      ],
    },
    { id: "reportes", etiqueta: "Reportes", icono: "fa-chart-simple", visible: rol === "dueno" || rol === "oficina" },
    { id: "permisos", etiqueta: "Usuarios y Roles", icono: "fa-shield-halved", visible: esDueno },
  ];

  const iniciales = usuario?.nombre
    ? usuario.nombre
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    : "CJ";

  return (
    <aside
      className={`
        bg-[#132219] text-[#eef2e9] flex flex-col justify-between flex-shrink-0 relative
        transition-all duration-300 ease-in-out z-30 border-r border-[#8fb56b]/15
        ${colapsado ? "w-20" : "w-64"}
        ${menuAbierto ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        fixed md:static inset-y-0 left-0
      `}
    >
      {/* Top Section */}
      <div className="flex flex-col h-full overflow-hidden">
        {/* Logo & Header */}
        <div className={`h-20 border-b border-[#8fb56b]/15 flex items-center ${colapsado ? "justify-center px-2" : "justify-between px-5"} relative transition-all duration-300`}>
          {!colapsado ? (
            <div className="flex items-center overflow-hidden">
              <img
                src="/logo-vakera.png"
                alt="Vakera"
                className="h-9 w-auto object-contain select-none"
              />
            </div>
          ) : (
            <div
              className="w-10 h-10 overflow-hidden flex items-center justify-start flex-shrink-0"
              title="Vakera"
            >
              <img
                src="/logo-vakera.png"
                alt="Vakera"
                className="h-9 w-auto max-w-none object-left object-contain select-none"
              />
            </div>
          )}

          {/* Mobile close button */}
          <button
            type="button"
            onClick={alCerrarMenu}
            className="md:hidden text-gray-400 hover:text-white p-1"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Establecimiento tag (solo si no está colapsado) */}
        {!colapsado && (
          <div className="px-5 py-3 border-b border-[#8fb56b]/10 bg-[#111d15]/50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#8fb56b] animate-pulse"></span>
            <span className="text-[11px] text-[#eef2e9]/70 font-medium truncate">
              {usuario?.establecimiento || "El Rancho, Goya, Corrientes"}
            </span>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {!colapsado && (
            <p className="px-3 text-[10px] font-bold text-[#8fb56b]/80 uppercase tracking-wider mb-2">
              Módulos
            </p>
          )}

          {enlaces
            .filter((e) => e.visible !== false)
            .map((enlace) => {
              const tieneSubActivo = (enlace.subEnlaces || []).some((s) => s.id === vistaActiva);
              const activo = vistaActiva === enlace.id || tieneSubActivo;
              return (
                <div key={enlace.id} className="space-y-1">
                  <button
                    type="button"
                    onMouseEnter={() => precargarModulo(enlace.id)}
                    onFocus={() => precargarModulo(enlace.id)}
                    onClick={() => {
                      alCambiarVista(enlace.id);
                      if (alCerrarMenu) alCerrarMenu();
                    }}
                    title={colapsado ? enlace.etiqueta : ""}
                    className={`
                      w-full flex items-center rounded-xl transition-all duration-200 font-medium text-left
                      ${colapsado ? "justify-center px-0 py-3" : "gap-3.5 px-3.5 py-2.5"}
                      ${activo
                        ? "bg-[#243e2e] text-[#f1ecdd] border-l-4 border-[#8fb56b] shadow-sm font-semibold"
                        : "text-[#eef2e9]/75 hover:bg-[#192b20] hover:text-white"
                      }
                    `}
                  >
                    <i
                      className={`fa-solid ${enlace.icono} text-base transition-colors ${activo ? "text-[#8fb56b]" : "text-[#8fb56b]/70 group-hover:text-[#8fb56b]"
                        } ${colapsado ? "text-center" : "w-5 text-center"}`}
                    ></i>
                    {!colapsado && (
                      <span className="text-sm truncate">{enlace.etiqueta}</span>
                    )}
                    {activo && !colapsado && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#8fb56b]"></span>
                    )}
                  </button>

                  {!colapsado && activo && enlace.subEnlaces && enlace.subEnlaces.length > 0 && (
                    <div className="ml-5 pl-3 border-l border-[#8fb56b]/25 space-y-1">
                      {enlace.subEnlaces.map((sub) => {
                        const subActivo = vistaActiva === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onMouseEnter={() => precargarModulo(sub.id)}
                            onClick={() => {
                              alCambiarVista(sub.id);
                              if (alCerrarMenu) alCerrarMenu();
                            }}
                            className={`
                              w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-all text-left
                              ${subActivo
                                ? "bg-[#8fb56b] text-[#182920] font-bold shadow-sm"
                                : "bg-[#17281e]/70 text-[#ded7c4]/85 hover:bg-[#1e3528] hover:text-white font-medium"
                              }
                            `}
                          >
                            <i className={`fa-solid ${sub.icono} text-[11px] ${subActivo ? "text-[#182920]" : "text-[#8fb56b]"}`}></i>
                            <span className="truncate">{sub.etiqueta}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </nav>
      </div>

      {/* Bottom User / Profile Section */}
      <div className={`p-3 border-t border-[#8fb56b]/15 bg-[#0f1b13]/80 ${colapsado ? "text-center" : ""}`}>
        {!colapsado ? (
          <div>
            <div
              onClick={() => setMostrarOpcionesPerfil((v) => !v)}
              className="flex items-center justify-between p-2 rounded-xl bg-[#16271e] hover:bg-[#1c3226] border border-[#8fb56b]/20 cursor-pointer transition-colors"
              title="Opciones de cuenta"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#8fb56b] flex items-center justify-center text-[#182920] font-bold text-sm shadow-sm flex-shrink-0">
                  {iniciales}
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-bold text-[#f1ecdd] leading-tight truncate">
                    {usuario?.nombre || "Cristian Joaquín"}
                  </p>
                  <span className="inline-block mt-0.5 text-[10px] text-[#8fb56b] bg-[#1e3828] px-2 py-0.5 rounded-full border border-[#8fb56b]/30 uppercase font-semibold">
                    {rol || "DUEÑO"}
                  </span>
                </div>
              </div>
              <i className={`fa-solid ${mostrarOpcionesPerfil ? "fa-chevron-down" : "fa-chevron-right"} text-[#8fb56b] text-xs`}></i>
            </div>

            {/* Menú de opciones de perfil */}
            {mostrarOpcionesPerfil && (
              <div className="mt-2 bg-[#16271e] border border-[#8fb56b]/30 rounded-xl p-2.5 text-xs space-y-1 shadow-2xl animate-fade-in">
                <button
                  type="button"
                  onClick={alIrALanding}
                  className="w-full text-left px-2 py-1.5 hover:bg-[#1e3828] text-[#eef2e9] rounded-lg flex items-center gap-2 transition-colors"
                >
                  <i className="fa-solid fa-globe text-[#8fb56b]"></i> Ver Web Inicio
                </button>
                <button
                  type="button"
                  onClick={abrirConfirmacionCerrarSesion}
                  className="w-full text-left px-2 py-1.5 hover:bg-red-950/40 text-red-300 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <i className="fa-solid fa-right-from-bracket text-red-400"></i> Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-10 h-10 rounded-xl bg-[#8fb56b] flex items-center justify-center text-[#182920] font-bold text-sm cursor-pointer shadow-sm"
              title={`${usuario?.nombre || "Usuario"} (${rol || "Dueño"})`}
              onClick={alToggleColapso}
            >
              {iniciales}
            </div>
            <button
              type="button"
              onClick={abrirConfirmacionCerrarSesion}
              className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-[#1a3023] transition-colors"
              title="Cerrar Sesión"
            >
              <i className="fa-solid fa-right-from-bracket text-sm"></i>
            </button>
          </div>
        )}
      </div>

      {confirmarCerrarSesion &&
        createPortal(
          <div
            className={`auth-modal-backdrop ${cerrandoModal ? "auth-modal-backdrop--cerrando" : ""}`}
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) cancelarConfirmacionCerrarSesion();
            }}
          >
            <div
              className={`auth-modal-card ${cerrandoModal ? "auth-modal-card--cerrando" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-cerrar-sesion-titulo"
              style={{ maxWidth: "380px", padding: "28px 24px", textAlign: "center" }}
            >
              <div className="auth-modal-cabecera" style={{ marginBottom: "18px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "9999px",
                    background: "#fef2f2",
                    color: "#dc2626",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "12px",
                    fontSize: "20px",
                  }}
                >
                  <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
                </div>
                <h3
                  id="modal-cerrar-sesion-titulo"
                  className="auth-modal-titulo"
                  style={{ marginBottom: "6px" }}
                >
                  ¿Seguro?
                </h3>
                <p className="auth-modal-subtitulo">
                  ¿Querés cerrar sesión de tu cuenta?
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <Button
                  tipo="button"
                  variante="contorno"
                  className="boton--bloque"
                  onClick={cancelarConfirmacionCerrarSesion}
                >
                  Cancelar
                </Button>
                <Button
                  tipo="button"
                  variante="peligro"
                  className="boton--bloque"
                  onClick={confirmarSalida}
                >
                  Cerrar Sesión
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </aside>
  );
}
