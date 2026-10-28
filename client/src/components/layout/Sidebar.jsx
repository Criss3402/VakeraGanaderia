import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

// Mapa de pre-carga bajo demanda al pasar el cursor (Hover Prefetching)
const PREFETCH_MODULOS = {
  metricas: () => import("../../views/3_dashboard/DashboardView.jsx"),
  ganado: () => import("../../views/3_dashboard/modulos/GanadoView.jsx"),
  parcelas: () => import("../../views/3_dashboard/modulos/ParcelasView.jsx"),
  partes: () => import("../../views/3_dashboard/modulos/PartesView.jsx"),
  sanidad: () => import("../../views/3_dashboard/modulos/SanidadView.jsx"),
  insumos: () => import("../../views/3_dashboard/modulos/InsumosView.jsx"),
  reportes: () => import("../../views/3_dashboard/modulos/ReportesView.jsx"),
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

  const esDueno = rol === "dueno";

  const enlaces = [
    { id: "metricas", etiqueta: "Panel General", icono: "fa-house" },
    { id: "ganado", etiqueta: "Ganado", icono: "fa-cow" },
    { id: "parcelas", etiqueta: "Parcelas", icono: "fa-draw-polygon" },
    { id: "partes", etiqueta: "Partes de Campo", icono: "fa-clipboard-list" },
    { id: "sanidad", etiqueta: "Sanidad y Vacunas", icono: "fa-syringe" },
    { id: "insumos", etiqueta: "Insumos y Stock", icono: "fa-boxes-stacked" },
    { id: "reportes", etiqueta: "Reportes", icono: "fa-chart-simple" },
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
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-[#1e3828] border border-[#8fb56b]/30 flex items-center justify-center text-xl text-[#8fb56b] shadow-glow flex-shrink-0">
                <i className="fa-solid fa-cow"></i>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xl font-bold tracking-wider text-white font-['Fraunces',serif] leading-tight truncate">
                  Vakera
                </span>
                <span className="text-[10px] tracking-widest text-[#8fb56b] uppercase font-semibold">
                  Gestión Ganadera
                </span>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[#1e3828] border border-[#8fb56b]/30 flex items-center justify-center text-xl text-[#8fb56b] shadow-glow flex-shrink-0" title="Vakera Gestión Ganadera">
              <i className="fa-solid fa-cow"></i>
            </div>
          )}

          {/* Botón de Colapso Desktop */}
          <button
            type="button"
            onClick={alToggleColapso}
            className={`
              hidden md:flex items-center justify-center w-7 h-7 rounded-lg bg-[#1a3023] hover:bg-[#8fb56b]
              hover:text-[#182920] text-[#8fb56b] border border-[#8fb56b]/30 transition-all duration-200
              ${colapsado ? "absolute -right-3 top-6 shadow-md z-40 bg-[#1e3828]" : ""}
            `}
            title={colapsado ? "Expandir barra lateral" : "Colapsar barra lateral"}
            aria-label={colapsado ? "Expandir barra lateral" : "Colapsar barra lateral"}
          >
            <i className={`fa-solid ${colapsado ? "fa-chevron-right" : "fa-chevron-left"} text-xs`}></i>
          </button>

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
              const activo = vistaActiva === enlace.id;
              return (
                <button
                  key={enlace.id}
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
                  onClick={cerrarSesion}
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
              onClick={cerrarSesion}
              className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-[#1a3023] transition-colors"
              title="Cerrar Sesión"
            >
              <i className="fa-solid fa-right-from-bracket text-sm"></i>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
