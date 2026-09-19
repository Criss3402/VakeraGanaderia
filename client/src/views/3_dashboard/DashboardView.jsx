import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  obtenerMetricas,
  obtenerAlertasSanitarias,
  obtenerInsumosCriticos,
  obtenerPartesDiarios,
} from "../../api/dashboard.api";

export default function DashboardView({ alCambiarVista }) {
  const { usuario, rol } = useAuth();
  const [metricas, setMetricas] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [partes, setPartes] = useState([]);

  const doughnutCanvasRef = useRef(null);
  const lineCanvasRef = useRef(null);
  const doughnutChartRef = useRef(null);
  const lineChartRef = useRef(null);

  useEffect(() => {
    let activo = true;
    Promise.all([
      obtenerMetricas().catch(() => null),
      obtenerAlertasSanitarias().catch(() => null),
      obtenerInsumosCriticos().catch(() => null),
      obtenerPartesDiarios().catch(() => null),
    ]).then(([resMetricas, resAlertas, resInsumos, resPartes]) => {
      if (!activo) return;
      if (resMetricas?.data) setMetricas(resMetricas.data);
      if (resAlertas?.data) setAlertas(resAlertas.data);
      if (resInsumos?.data) setInsumos(resInsumos.data);
      if (resPartes?.data) setPartes(resPartes.data);
    });

    return () => {
      activo = false;
    };
  }, []);

  // Inicializar Gráficos con Chart.js
  useEffect(() => {
    const Chart = window.Chart;
    if (!Chart) return;

    // 1. Doughnut Chart: Distribución del Rodeo
    if (doughnutCanvasRef.current) {
      if (doughnutChartRef.current) {
        doughnutChartRef.current.destroy();
      }

      const ctxDoughnut = doughnutCanvasRef.current.getContext("2d");
      doughnutChartRef.current = new Chart(ctxDoughnut, {
        type: "doughnut",
        data: {
          labels: ["Vacas", "Toros", "Novillos", "Terneras", "Vaquillonas"],
          datasets: [
            {
              data: [1, 1, 1, 1, 1],
              backgroundColor: [
                "#182920", // Verde profundo
                "#33512f", // Verde musgo
                "#6f9a4f", // Verde brote oscuro
                "#8fb56b", // Verde brote
                "#6b4a32", // Tierra
              ],
              borderWidth: 3,
              borderColor: "#ffffff",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "74%",
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return " " + context.label + ": " + context.raw + " cabeza(s)";
                },
              },
            },
          },
        },
      });
    }

    // 2. Line Chart: Evolución del Peso Promedio
    if (lineCanvasRef.current) {
      if (lineChartRef.current) {
        lineChartRef.current.destroy();
      }

      const ctxLine = lineCanvasRef.current.getContext("2d");
      let gradient = ctxLine.createLinearGradient(0, 0, 0, 200);
      gradient.addColorStop(0, "rgba(111, 154, 79, 0.28)");
      gradient.addColorStop(1, "rgba(111, 154, 79, 0.02)");

      lineChartRef.current = new Chart(ctxLine, {
        type: "line",
        data: {
          labels: ["Abr", "May", "Jun", "Jul", "Ago", "Sep"],
          datasets: [
            {
              label: "Peso Promedio (kg)",
              data: [350, 370, 385, 395, 410, 419],
              borderColor: "#33512f",
              backgroundColor: gradient,
              borderWidth: 2.8,
              pointBackgroundColor: "#f1ecdd",
              pointBorderColor: "#182920",
              pointBorderWidth: 2,
              pointRadius: 4.5,
              pointHoverRadius: 6,
              fill: true,
              tension: 0.38,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#182920",
              titleColor: "#8fb56b",
              bodyColor: "#f1ecdd",
              borderColor: "rgba(143, 181, 107, 0.3)",
              borderWidth: 1,
            },
          },
          scales: {
            y: {
              min: 300,
              max: 500,
              ticks: {
                stepSize: 50,
                color: "#6b7c6d",
                font: { size: 11 },
              },
              grid: {
                color: "#e8e1d2",
                drawBorder: false,
              },
            },
            x: {
              ticks: {
                color: "#6b7c6d",
                font: { size: 11 },
              },
              grid: {
                display: false,
                drawBorder: false,
              },
            },
          },
          interaction: {
            intersect: false,
            mode: "index",
          },
        },
      });
    }

    return () => {
      if (doughnutChartRef.current) doughnutChartRef.current.destroy();
      if (lineChartRef.current) lineChartRef.current.destroy();
    };
  }, []);

  const totalCabezas = metricas?.resumenGanado?.totalCabezas || 5;
  const pesoPromedio = metricas?.resumenGanado?.pesoPromedioKg || 419;
  const nombreUsuario = usuario?.nombre || "Cristian Joaquín";
  const establecimiento = usuario?.establecimiento || "El Rancho, Goya, Corrientes";

  return (
    <div className="space-y-6 text-[#182920]">
      {/* Hero Banner (Verde Profundo + Ganado para contraste con fondo crema) */}
      <div className="relative rounded-2xl overflow-hidden h-48 md:h-56 shadow-md flex items-center border border-[#ded7c4]">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&q=80')] bg-cover bg-center"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#182920]/95 via-[#182920]/80 to-transparent"></div>

        <div className="relative z-10 flex w-full justify-between items-center px-6 md:px-12">
          <div>
            <span className="text-[11px] font-bold text-[#8fb56b] uppercase tracking-widest block mb-1">
              Panel de Control · {establecimiento}
            </span>
            <h2 className="text-2xl md:text-4xl font-bold text-[#f1ecdd] font-['Fraunces',serif] mb-2">
              Bienvenido, {nombreUsuario}
            </h2>
            <p className="text-[#f1ecdd]/80 text-xs md:text-sm">
              Aquí tenés el estado operativo y sanitario completo de tu establecimiento.
            </p>
          </div>

          <div className="hidden md:flex flex-col items-end text-right">
            <div className="flex items-center gap-3 mb-3 bg-[#132219]/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-[#8fb56b]/20">
              <i className="fa-solid fa-sun text-amber-400 text-2xl"></i>
              <div>
                <p className="text-xl font-bold text-white leading-none">18°C</p>
                <p className="text-xs text-[#8fb56b]">Cielo despejado</p>
              </div>
            </div>
            <p className="text-xs text-[#f1ecdd]/80 italic max-w-xs border-r-2 border-[#8fb56b] pr-3">
              "El campo siempre da más<br />a quienes lo cuidan."
            </p>
          </div>
        </div>
      </div>

      {/* KPIs Grid (Fondos claros crema/blanco con toques de verde profundo) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Total Cabezas */}
        <div
          onClick={() => alCambiarVista && alCambiarVista("ganado")}
          className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm hover:shadow-md hover:border-[#33512f] transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group"
        >
          <i className="fa-solid fa-cow absolute -right-4 -bottom-4 text-7xl text-[#182920]/5 opacity-40 transform -rotate-12 transition-transform group-hover:scale-110"></i>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#182920] flex items-center justify-center text-[#8fb56b] shadow-sm">
                <i className="fa-solid fa-cow"></i>
              </div>
              <h3 className="text-xs font-bold text-[#4a5c4e] uppercase tracking-wider">Total de Cabezas</h3>
            </div>
            <div className="flex items-end gap-3 mb-1">
              <p className="text-4xl font-extrabold text-[#182920]">{totalCabezas}</p>
            </div>
            <div className="flex flex-col text-xs mt-2">
              <span className="text-[#33512f] font-bold flex items-center gap-1">
                <i className="fa-solid fa-arrow-up"></i> +1
              </span>
              <span className="text-[#6b7c6d] text-[11px]">vs. mes anterior</span>
            </div>
          </div>
          <div className="text-xs font-bold text-[#33512f] mt-4 relative z-10 flex items-center gap-1 group-hover:underline">
            Ver detalle <i className="fa-solid fa-arrow-right text-[10px]"></i>
          </div>
        </div>

        {/* KPI 2: Peso Promedio */}
        <div
          onClick={() => alCambiarVista && alCambiarVista("ganado")}
          className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm hover:shadow-md hover:border-[#6b4a32] transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group"
        >
          <i className="fa-solid fa-scale-balanced absolute -right-2 -bottom-4 text-7xl text-[#6b4a32]/5 opacity-40 transform -rotate-12 transition-transform group-hover:scale-110"></i>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#f1ecdd] border border-[#ded7c4] flex items-center justify-center text-[#6b4a32] shadow-sm">
                <i className="fa-solid fa-weight-hanging"></i>
              </div>
              <h3 className="text-xs font-bold text-[#6b4a32] uppercase tracking-wider">Peso Promedio</h3>
            </div>
            <div className="flex items-end gap-1 mb-1">
              <p className="text-4xl font-extrabold text-[#182920]">{pesoPromedio}</p>
              <span className="text-base text-[#6b4a32] font-bold mb-1">kg</span>
            </div>
            <div className="flex flex-col text-xs mt-2">
              <span className="text-amber-700 font-bold flex items-center gap-1">
                <i className="fa-solid fa-arrow-down"></i> -2.3%
              </span>
              <span className="text-[#6b7c6d] text-[11px]">vs. mes anterior</span>
            </div>
          </div>
          <div className="text-xs font-bold text-[#6b4a32] mt-4 relative z-10 flex items-center gap-1 group-hover:underline">
            Ver evolución <i className="fa-solid fa-arrow-right text-[10px]"></i>
          </div>
        </div>

        {/* KPI 3: Alertas Sanitarias */}
        <div
          onClick={() => alCambiarVista && alCambiarVista("sanidad")}
          className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm hover:shadow-md hover:border-amber-500 transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group"
        >
          <i className="fa-solid fa-stethoscope absolute -right-2 -bottom-4 text-7xl text-amber-500/5 opacity-40 transform -rotate-12 transition-transform group-hover:scale-110"></i>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shadow-sm">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Alertas Sanitarias</h3>
            </div>
            <div className="flex items-end gap-3 mb-1">
              <p className="text-4xl font-extrabold text-[#182920]">
                {metricas?.alertasSanitariasCount ?? 2}
              </p>
            </div>
            <div className="flex flex-col text-xs mt-2">
              <span className="text-amber-700 font-bold flex items-center gap-1">
                <i className="fa-solid fa-arrow-up"></i> +1
              </span>
              <span className="text-[#6b7c6d] text-[11px]">respecto al mes anterior</span>
            </div>
          </div>
          <div className="text-xs font-bold text-amber-800 mt-4 relative z-10 flex items-center gap-1 group-hover:underline">
            Ver alertas <i className="fa-solid fa-arrow-right text-[10px]"></i>
          </div>
        </div>

        {/* KPI 4: Insumos Críticos */}
        <div
          onClick={() => alCambiarVista && alCambiarVista("insumos")}
          className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm hover:shadow-md hover:border-red-500 transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group"
        >
          <i className="fa-solid fa-box-open absolute -right-2 -bottom-4 text-7xl text-red-500/5 opacity-40 transform -rotate-12 transition-transform group-hover:scale-110"></i>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700 shadow-sm">
                <i className="fa-solid fa-box"></i>
              </div>
              <h3 className="text-xs font-bold text-red-800 uppercase tracking-wider">Insumos Críticos</h3>
            </div>
            <div className="flex items-end gap-3 mb-1">
              <p className="text-4xl font-extrabold text-[#182920]">
                {metricas?.insumosCriticosCount ?? 3}
              </p>
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200 uppercase">
                <i className="fa-solid fa-triangle-exclamation"></i> Bajo stock mínimo
              </span>
            </div>
          </div>
          <div className="text-xs font-bold text-red-800 mt-4 relative z-10 flex items-center gap-1 group-hover:underline">
            Ver inventario <i className="fa-solid fa-arrow-right text-[10px]"></i>
          </div>
        </div>
      </div>

      {/* Middle Row: Charts + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Distribución */}
        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">Distribución del Rodeo</h3>
              <p className="text-xs text-[#6b7c6d] mt-0.5">Cantidad de animales por categoría</p>
            </div>
            <span className="text-xs border border-[#ded7c4] rounded-lg px-2.5 py-1 bg-[#f8f5eb] text-[#182920] font-medium">
              Por categoría
            </span>
          </div>

          <div className="flex items-center justify-center gap-6 h-48">
            <div className="relative w-40 h-40 flex-shrink-0">
              <canvas ref={doughnutCanvasRef}></canvas>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-[#182920]">{totalCabezas}</span>
                <span className="text-[10px] text-[#4a5c4e] uppercase font-bold tracking-wider">Cabezas</span>
              </div>
            </div>

            {/* Custom Legend */}
            <div className="space-y-2 text-xs flex-1">
              {[
                { label: "Vacas", color: "#182920" },
                { label: "Toros", color: "#33512f" },
                { label: "Novillos", color: "#6f9a4f" },
                { label: "Terneras", color: "#8fb56b" },
                { label: "Vaquillonas", color: "#6b4a32" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-[#4a5c4e] font-medium">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                    {item.label}
                  </div>
                  <span className="font-bold text-[#182920]">1</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 2: Evolución Peso */}
        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">Evolución de Peso Promedio</h3>
              <p className="text-xs text-[#6b7c6d] mt-0.5">Kilogramos promedio del rodeo</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-[#f1ecdd] text-[#182920] border border-[#ded7c4] text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                <i className="fa-solid fa-arrow-trend-up text-[#33512f]"></i> +12%
              </span>
            </div>
          </div>
          <div className="h-48 w-full">
            <canvas ref={lineCanvasRef}></canvas>
          </div>
        </div>

        {/* Tasks List */}
        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">Próximas Tareas</h3>
              <p className="text-xs text-[#6b7c6d] mt-0.5">Calendario de campo</p>
            </div>
            <button
              type="button"
              onClick={() => alCambiarVista && alCambiarVista("sanidad")}
              className="text-xs text-[#182920] hover:text-[#33512f] font-bold flex items-center gap-1 border border-[#ded7c4] px-2.5 py-1 rounded-lg bg-[#f8f5eb] transition-colors"
            >
              Ver todas <i className="fa-solid fa-arrow-right text-[10px]"></i>
            </button>
          </div>

          <div className="flex-1 space-y-2.5">
            {/* Task 1 */}
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#f8f5eb] border border-[#e8e1d2] hover:bg-[#f1ecdd] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-center w-8 flex-shrink-0">
                  <p className="text-base font-bold text-[#182920] leading-none">15</p>
                  <p className="text-[9px] font-bold text-[#6b4a32] uppercase">Oct</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-[#e7dfcb] flex items-center justify-center text-[#182920] flex-shrink-0">
                  <i className="fa-solid fa-syringe text-xs"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#182920] truncate">Vacunación Antiaftosa</p>
                  <p className="text-[11px] text-[#6b7c6d] truncate">Rodeo General</p>
                </div>
              </div>
              <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-200 uppercase flex-shrink-0">
                Pendiente
              </span>
            </div>

            {/* Task 2 */}
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#f8f5eb] border border-[#e8e1d2] hover:bg-[#f1ecdd] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-center w-8 flex-shrink-0">
                  <p className="text-base font-bold text-[#182920] leading-none">25</p>
                  <p className="text-[9px] font-bold text-[#6b4a32] uppercase">Sep</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-[#e7dfcb] flex items-center justify-center text-red-600 flex-shrink-0">
                  <i className="fa-solid fa-tags text-xs"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#182920] truncate">Control de Carbunclo</p>
                  <p className="text-[11px] text-[#6b7c6d] truncate">Terneros destete</p>
                </div>
              </div>
              <span className="bg-red-100 text-red-800 text-[9px] font-bold px-2 py-0.5 rounded-full border border-red-200 uppercase flex-shrink-0">
                Próximo
              </span>
            </div>

            {/* Task 3 */}
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#f8f5eb] border border-[#e8e1d2] opacity-75 hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-center w-8 flex-shrink-0">
                  <p className="text-base font-bold text-[#6b7c6d] leading-none">18</p>
                  <p className="text-[9px] font-bold text-[#6b7c6d] uppercase">Sep</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-[#e7dfcb] flex items-center justify-center text-[#33512f] flex-shrink-0">
                  <i className="fa-solid fa-check text-xs"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#6b7c6d] line-through truncate">Tratamiento Antiparasitario</p>
                  <p className="text-[11px] text-[#6b7c6d] truncate">Novillos Potrero 5</p>
                </div>
              </div>
              <span className="bg-[#e7dfcb] text-[#33512f] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#ded7c4] uppercase flex-shrink-0">
                Hecho
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Novedades + Stock + Promo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
        {/* Novedades */}
        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">Novedades de Campo</h3>
              <p className="text-xs text-[#6b7c6d] mt-0.5">Partes diarios recientes</p>
            </div>
            <button
              type="button"
              onClick={() => alCambiarVista && alCambiarVista("partes")}
              className="text-xs text-[#182920] hover:text-[#33512f] font-bold flex items-center gap-1 border border-[#ded7c4] px-2.5 py-1 rounded-lg bg-[#f8f5eb] transition-colors"
            >
              Ver todas <i className="fa-solid fa-arrow-right text-[10px]"></i>
            </button>
          </div>

          <div className="space-y-3">
            {/* Novedad 1 */}
            <div className="flex gap-3.5 p-3 rounded-xl bg-[#f8f5eb] border border-[#e8e1d2] hover:bg-[#f1ecdd] transition-colors">
              <img
                src="https://images.unsplash.com/photo-1546445317-29f4545e9d53?auto=format&fit=crop&q=80&w=120"
                alt="Vacas"
                className="w-14 h-14 rounded-xl object-cover shadow-sm flex-shrink-0 border border-[#ded7c4]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-xs text-[#4a5c4e] font-bold">
                    2026-09-19 · Potrero 2
                  </p>
                  <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-200 uppercase">
                    Pendiente
                  </span>
                </div>
                <p className="text-xs text-[#182920] leading-relaxed line-clamp-2">
                  Nacimiento de 2 terneros machos en buen estado. Alambrado perimetral este con hilo caído por viento.
                </p>
              </div>
            </div>

            {/* Novedad 2 */}
            <div className="flex gap-3.5 p-3 rounded-xl bg-[#f8f5eb] border border-[#e8e1d2] hover:bg-[#f1ecdd] transition-colors">
              <img
                src="https://images.unsplash.com/photo-1596733430284-f743728fc1e0?auto=format&fit=crop&q=80&w=120"
                alt="Novillo"
                className="w-14 h-14 rounded-xl object-cover shadow-sm flex-shrink-0 border border-[#ded7c4]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-xs text-[#4a5c4e] font-bold">
                    2026-09-18 · Potrero 5
                  </p>
                  <span className="bg-[#e7dfcb] text-[#33512f] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#ded7c4] uppercase">
                    Aprobado
                  </span>
                </div>
                <p className="text-xs text-[#182920] leading-relaxed line-clamp-2">
                  Novillo AR-84922 apartado con renguera en pata trasera derecha. Se apartó a corralillo.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stock de Insumos */}
        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">Stock de Insumos</h3>
              <p className="text-xs text-[#6b7c6d] mt-0.5">Control de productos críticos</p>
            </div>
            <button
              type="button"
              onClick={() => alCambiarVista && alCambiarVista("insumos")}
              className="text-xs text-[#182920] hover:text-[#33512f] font-bold flex items-center gap-1 border border-[#ded7c4] px-2.5 py-1 rounded-lg bg-[#f8f5eb] transition-colors"
            >
              Ver inventario <i className="fa-solid fa-arrow-right text-[10px]"></i>
            </button>
          </div>

          <div className="space-y-2">
            {[
              { nombre: "Vacuna Antiaftosa Bivalente", cantidad: "18 Dosis", icono: "fa-prescription-bottle-medical", bajo: true },
              { nombre: "Ivermectina Inyectable 500ml", cantidad: "3 Frascos", icono: "fa-syringe", bajo: true },
              { nombre: "Complejo Vitamínico", cantidad: "12 Kg", icono: "fa-box-archive", bajo: false },
              { nombre: "Sales Minerales", cantidad: "8 Bolsas", icono: "fa-cubes-stacked", bajo: false },
            ].map((insumo) => (
              <div key={insumo.nombre} className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8f5eb] border border-[#e8e1d2]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#e7dfcb] flex items-center justify-center text-[#182920] flex-shrink-0 text-xs">
                    <i className={`fa-solid ${insumo.icono}`}></i>
                  </div>
                  <span className="text-xs font-semibold text-[#182920] truncate">{insumo.nombre}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-bold ${insumo.bajo ? "text-red-700" : "text-[#182920]"}`}>{insumo.cantidad}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                    insumo.bajo
                      ? "bg-red-100 text-red-800 border-red-200"
                      : "bg-[#e7dfcb] text-[#33512f] border-[#ded7c4]"
                  }`}>
                    {insumo.bajo ? "Bajo" : "OK"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Promo / Banner Institucional Vakera (Verde Profundo para impacto de marca) */}
        <div className="rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-end border border-[#182920] group bg-[#182920]">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&q=80')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105 opacity-40"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#182920] via-[#182920]/80 to-transparent"></div>

          <div className="relative z-10 p-5 w-full">
            <div className="mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#8fb56b] text-[#182920] flex items-center justify-center text-base font-bold mb-2 shadow-sm">
                <i className="fa-solid fa-cow"></i>
              </div>
              <h3 className="text-lg font-bold text-[#f1ecdd] font-['Fraunces',serif] leading-tight">
                Gestión ganadera para un campo más rentable.
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#f1ecdd]/15 pt-3 mt-2 text-center">
              <div>
                <p className="text-[10px] text-[#8fb56b] font-bold">🌿 Bienestar</p>
                <p className="text-[9px] text-[#f1ecdd]/70">Animal continuo</p>
              </div>
              <div className="border-l border-[#f1ecdd]/15">
                <p className="text-[10px] text-[#8fb56b] font-bold">⚙️ Trazabilidad</p>
                <p className="text-[9px] text-[#f1ecdd]/70">Por lote y rodeo</p>
              </div>
              <div className="border-l border-[#f1ecdd]/15">
                <p className="text-[10px] text-[#8fb56b] font-bold">📈 Rendimiento</p>
                <p className="text-[9px] text-[#f1ecdd]/70">Producción ágil</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
