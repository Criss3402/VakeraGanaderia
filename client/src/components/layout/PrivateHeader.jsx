import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";

export default function PrivateHeader({ alAbrirMenu, alIrALanding }) {
  const { rol, loginRapido } = useAuth();
  const [hora, setHora] = useState("");
  const [fecha, setFecha] = useState("");

  useEffect(() => {
    function actualizarFechaHora() {
      const ahora = new Date();
      const opcionesFecha = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      };
      const fechaFormateada = ahora.toLocaleDateString("es-ES", opcionesFecha);
      // Capitalizar la primera letra
      setFecha(fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1));
      
      const horas = String(ahora.getHours()).padStart(2, "0");
      const minutos = String(ahora.getMinutes()).padStart(2, "0");
      setHora(`${horas}:${minutos}`);
    }

    actualizarFechaHora();
    const intervalo = setInterval(actualizarFechaHora, 1000 * 30);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-6 lg:px-8 shrink-0 z-10">
      {/* Mobile Hamburger & Search */}
      <div className="flex items-center gap-4 flex-1 max-w-lg">
        <button
          type="button"
          onClick={alAbrirMenu}
          className="md:hidden text-gray-600 hover:text-gray-900 text-xl"
          aria-label="Abrir menú de navegación"
        >
          <i className="fa-solid fa-bars"></i>
        </button>

        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
            placeholder="Buscar animales, lotes, insumos..."
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 lg:gap-6">
        <div className="hidden sm:flex items-center gap-2 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
          <span className="text-[11px] font-semibold text-gray-500 uppercase">Rol:</span>
          <select
            value={rol || "dueno"}
            onChange={(e) => loginRapido(e.target.value)}
            className="bg-transparent text-xs font-bold text-gray-800 outline-none cursor-pointer"
          >
            <option value="dueno">Dueño</option>
            <option value="capataz">Capataz</option>
            <option value="peon">Peón</option>
            <option value="oficina">Oficina</option>
            <option value="veterinario">Veterinario</option>
          </select>
        </div>

        <button
          type="button"
          onClick={alIrALanding}
          className="hidden md:inline-flex text-xs font-semibold text-gray-600 hover:text-emerald-600 items-center gap-1 transition-colors"
          title="Ver Landing Page pública"
        >
          <i className="fa-solid fa-globe"></i> Ver Web
        </button>

        <div className="flex items-center gap-4">
          <button
            type="button"
            className="relative text-gray-500 hover:text-gray-700 transition-colors"
            title="3 Alertas sanitarias y de stock pendientes"
          >
            <i className="fa-regular fa-bell text-lg"></i>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full text-[9px] text-white flex items-center justify-center font-bold">
              3
            </span>
          </button>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700 transition-colors"
            title="Configuración"
          >
            <i className="fa-solid fa-gear text-lg"></i>
          </button>
        </div>

        <div className="hidden md:block h-8 w-px bg-gray-200"></div>

        <div className="hidden md:flex items-center gap-3 text-sm text-gray-600">
          <i className="fa-regular fa-calendar text-gray-400"></i>
          <div>
            <p className="font-medium text-gray-800 text-xs sm:text-sm">
              {fecha || "Sábado, 19 de Septiembre de 2026"}
            </p>
            <p className="text-xs text-gray-500">{hora || "16:49"}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
