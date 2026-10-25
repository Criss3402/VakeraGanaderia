import { useState, useEffect } from "react";

export default function PrivateHeader({ alAbrirMenu, alIrALanding, colapsado = false, alToggleColapso }) {
  const [hora, setHora] = useState("");
  const [fecha, setFecha] = useState("");

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

  return (
    <header className="h-20 bg-[#f1ecdd] border-b border-[#ded7c4] flex items-center justify-between px-4 md:px-6 lg:px-8 shrink-0 z-10 transition-colors shadow-sm">
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

        {/* Alertas */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="relative w-10 h-10 rounded-xl bg-[#e7dfcb] hover:bg-[#d8cfb7] border border-[#d2c8b0] text-[#182920] flex items-center justify-center transition-colors shadow-sm"
            title="3 Alertas sanitarias y de stock pendientes"
          >
            <i className="fa-regular fa-bell text-base"></i>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 border-2 border-[#f1ecdd] rounded-full text-[9px] text-white flex items-center justify-center font-bold">
              3
            </span>
          </button>
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
