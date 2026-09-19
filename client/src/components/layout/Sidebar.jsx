import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function Sidebar({
  vistaActiva,
  alCambiarVista,
  menuAbierto,
  alCerrarMenu,
  alIrALanding,
}) {
  const { usuario, rol, cerrarSesion, loginRapido } = useAuth();
  const [mostrarOpcionesPerfil, setMostrarOpcionesPerfil] = useState(false);

  const esDueno = rol === "dueno";

  const enlaces = [
    { id: "metricas", etiqueta: "Inicio", icono: "fa-house" },
    { id: "ganado", etiqueta: "Ganado", icono: "fa-cow" },
    { id: "partes", etiqueta: "Partes de Campo", icono: "fa-clipboard-list" },
    { id: "sanidad", etiqueta: "Sanidad y Vacunas", icono: "fa-syringe" },
    { id: "insumos", etiqueta: "Insumos y Stock", icono: "fa-boxes-stacked" },
    { id: "reportes", etiqueta: "Reportes", icono: "fa-chart-simple" },
    { id: "permisos", etiqueta: "Usuarios y Permisos", icono: "fa-users", visible: esDueno },
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
      className={`w-64 bg-sidebar-bg text-gray-300 flex flex-col justify-between flex-shrink-0 relative transition-transform duration-300 z-30 ${
        menuAbierto ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      } fixed md:static inset-y-0 left-0`}
    >
      {/* Top Menu */}
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="h-20 flex flex-col justify-center items-center border-b border-gray-800 pt-4 pb-2 relative">
          <i className="fa-solid fa-cow text-3xl text-white mb-1"></i>
          <h1 className="text-xl font-bold tracking-widest text-white uppercase">Vakera</h1>
          <span className="text-[10px] tracking-widest text-gray-500 uppercase mt-0.5">
            Gestión Ganadera
          </span>
          {/* Mobile close button */}
          <button
            type="button"
            onClick={alCerrarMenu}
            className="md:hidden absolute top-4 right-4 text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {enlaces
            .filter((e) => e.visible !== false)
            .map((enlace) => {
              const activo = vistaActiva === enlace.id;
              return (
                <button
                  key={enlace.id}
                  type="button"
                  onClick={() => {
                    alCambiarVista(enlace.id);
                    if (alCerrarMenu) alCerrarMenu();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left ${
                    activo
                      ? "bg-sidebar-active text-white"
                      : "hover:bg-sidebar-hover text-gray-400 hover:text-white"
                  }`}
                >
                  <i
                    className={`fa-solid ${enlace.icono} w-5 text-center ${
                      activo ? "text-emerald-400" : ""
                    }`}
                  ></i>
                  <span className="text-sm font-medium">{enlace.etiqueta}</span>
                </button>
              );
            })}
        </nav>
      </div>

      {/* Bottom Profile Card */}
      <div className="h-48 relative overflow-hidden flex flex-col justify-end p-4">
        {/* Background Image */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1546445317-29f4545e9d53?auto=format&fit=crop&q=80')] bg-cover bg-center"></div>
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111316] via-[#111316]/80 to-transparent"></div>

        <div className="relative z-10">
          <p className="text-sm font-medium text-white italic mb-4">
            Campo hoy,<br />producción mañana.
          </p>

          <div
            onClick={() => setMostrarOpcionesPerfil((v) => !v)}
            className="flex items-center justify-between mt-2 cursor-pointer hover:opacity-90 transition-opacity bg-black/30 p-1.5 rounded-lg border border-white/10"
            title="Opciones de cuenta"
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-[#82c91e] flex items-center justify-center text-sidebar-bg font-bold text-sm">
                {iniciales}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white leading-tight">
                  {usuario?.nombre || "Cristian Joaquín"}
                </p>
                <span className="bg-sidebar-active text-[10px] text-emerald-200 px-1.5 py-0.5 rounded border border-emerald-700/50 uppercase">
                  {rol || "DUEÑO"}
                </span>
              </div>
            </div>
            <i className={`fa-solid ${mostrarOpcionesPerfil ? "fa-chevron-down" : "fa-chevron-right"} text-gray-400 text-xs`}></i>
          </div>

          {/* Menú flotante de perfil */}
          {mostrarOpcionesPerfil && (
            <div className="mt-2 bg-[#1b1e24] border border-gray-700 rounded-lg p-2 text-xs space-y-1 shadow-lg">
              <div className="text-gray-400 px-2 py-1 font-semibold border-b border-gray-700/50">
                Cambiar Rol de Prueba:
              </div>
              <div className="grid grid-cols-2 gap-1 py-1">
                {["dueno", "capataz", "peon", "oficina", "veterinario"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      loginRapido(r);
                      setMostrarOpcionesPerfil(false);
                    }}
                    className={`px-2 py-1 rounded text-left uppercase text-[10px] font-bold ${
                      rol === r ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={alIrALanding}
                className="w-full text-left px-2 py-1.5 hover:bg-gray-800 text-gray-300 rounded flex items-center gap-2"
              >
                <i className="fa-solid fa-globe"></i> Ver Web Institucional
              </button>
              <button
                type="button"
                onClick={cerrarSesion}
                className="w-full text-left px-2 py-1.5 hover:bg-red-900/40 text-red-400 rounded flex items-center gap-2"
              >
                <i className="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
