import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import PanelDueno from "./actores/PanelDueno.jsx";
import PanelCapataz from "./actores/PanelCapataz.jsx";
import PanelPeon from "./actores/PanelPeon.jsx";
import PanelOficina from "./actores/PanelOficina.jsx";
import PanelVeterinario from "./actores/PanelVeterinario.jsx";

export default function DashboardView({ alCambiarVista }) {
  const { rol, usuario, loginRapido } = useAuth();
  
  // Cuenta de demostración si pertenece a @vakera.com o establecimiento demo
  const esCuentaDemo =
    usuario?.email?.endsWith("@vakera.com") ||
    usuario?.establecimientoId === "est-el-rancho";

  // Actor seleccionado para visualizar (por defecto el rol logueado)
  const [actorActivo, setActorActivo] = useState(rol || "dueno");

  // Sincronizar si cambia el rol de sesión
  useEffect(() => {
    if (rol) setActorActivo(rol);
  }, [rol]);

  const actoresInfo = [
    {
      id: "dueno",
      titulo: "Dueño / Dirección",
      icono: "fa-crown",
      desc: "Visión global, auditoría ejecutiva y finanzas",
    },
    {
      id: "capataz",
      titulo: "Capataz de Campo",
      icono: "fa-hat-cowboy",
      desc: "Supervisión, aprobación de partes y control de potreros",
    },
    {
      id: "peon",
      titulo: "Peón Operario",
      icono: "fa-shoe-prints",
      desc: "Carga de novedades en potreros y solicitud de insumos",
    },
    {
      id: "oficina",
      titulo: "Oficina & Compras",
      icono: "fa-briefcase",
      desc: "Gestión documental, facturas y reposición de stock",
    },
    {
      id: "veterinario",
      titulo: "Médica Veterinaria",
      icono: "fa-user-doctor",
      desc: "Calendario de vacunación y recetas clínicas",
    },
  ];

  return (
    <div className="space-y-6 text-[#182920]">
      {/* Barra de Contexto: Si es demo permite alternar roles; si es cuenta real muestra su establecimiento aislado */}
      {esCuentaDemo ? (
        <div className="bg-[#f8f5eb] p-3 rounded-2xl border border-[#ded7c4] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8fb56b] animate-ping"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#182920]">
              Entorno Demo: Interfaces por Actor:
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
            {actoresInfo.map((actor) => {
              const esActivo = actorActivo === actor.id;
              return (
                <button
                  key={actor.id}
                  type="button"
                  onClick={() => {
                    setActorActivo(actor.id);
                    if (loginRapido && rol !== actor.id) {
                      loginRapido(actor.id);
                    }
                  }}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                    esActivo
                      ? "bg-[#182920] text-[#f1ecdd] border-[#182920] shadow-sm scale-105"
                      : "bg-white text-[#4a5c4e] border-[#ded7c4] hover:bg-[#e7dfcb] hover:text-[#182920]"
                  }`}
                  title={actor.desc}
                >
                  <i className={`fa-solid ${actor.icono} ${esActivo ? "text-[#8fb56b]" : "text-[#6b7c6d]"}`}></i>
                  <span>{actor.titulo}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white p-4 rounded-2xl border border-[#ded7c4] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e3828] text-[#8fb56b] flex items-center justify-center text-lg shadow-sm">
              <i className="fa-solid fa-tree-city"></i>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#182920] uppercase tracking-wide">
                {usuario?.establecimiento || "Mi Establecimiento Ganadero"}
              </h2>
              <p className="text-xs text-[#526354]">
                Espacio privado &bull; Rol en sesión: <span className="font-bold uppercase text-[#2d4d38]">{rol || "Operario"}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#8fb56b]/20 text-[#1e3828] border border-[#8fb56b]/30">
              <span className="w-2 h-2 rounded-full bg-[#356d25] animate-pulse"></span>
              Entorno Privado
            </span>
          </div>
        </div>
      )}

      {/* Renderizado Dinámico de la Interfaz del Actor */}
      {actorActivo === "peon" && <PanelPeon alCambiarVista={alCambiarVista} />}
      {actorActivo === "capataz" && <PanelCapataz alCambiarVista={alCambiarVista} />}
      {actorActivo === "oficina" && <PanelOficina alCambiarVista={alCambiarVista} />}
      {actorActivo === "veterinario" && <PanelVeterinario alCambiarVista={alCambiarVista} />}
      {(actorActivo === "dueno" || !["peon", "capataz", "oficina", "veterinario"].includes(actorActivo)) && (
        <PanelDueno alCambiarVista={alCambiarVista} />
      )}
    </div>
  );
}
