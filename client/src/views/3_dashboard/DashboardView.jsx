import { useAuth } from "../../context/AuthContext";
import PanelDueno from "./actores/PanelDueno.jsx";
import PanelCapataz from "./actores/PanelCapataz.jsx";
import PanelPeon from "./actores/PanelPeon.jsx";
import PanelOficina from "./actores/PanelOficina.jsx";
import PanelVeterinario from "./actores/PanelVeterinario.jsx";

export default function DashboardView({ alCambiarVista }) {
  const { rol, usuario } = useAuth();
  const rolNormalizado = (rol || "dueno").toLowerCase();

  return (
    <div className="space-y-6 text-[#182920]">
      {/* Tarjeta de Contexto del Establecimiento */}
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
              Espacio privado &bull; Rol en sesión: <span className="font-bold uppercase text-[#2d4d38]">{rol || "Dueño"}</span>
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

      {/* Renderizado Dinámico de la Interfaz según el Rol del Usuario */}
      {rolNormalizado === "peon" && <PanelPeon alCambiarVista={alCambiarVista} />}
      {rolNormalizado === "capataz" && <PanelCapataz alCambiarVista={alCambiarVista} />}
      {rolNormalizado === "oficina" && <PanelOficina alCambiarVista={alCambiarVista} />}
      {rolNormalizado === "veterinario" && <PanelVeterinario alCambiarVista={alCambiarVista} />}
      {(rolNormalizado === "dueno" || !["peon", "capataz", "oficina", "veterinario"].includes(rolNormalizado)) && (
        <PanelDueno alCambiarVista={alCambiarVista} />
      )}
    </div>
  );
}
