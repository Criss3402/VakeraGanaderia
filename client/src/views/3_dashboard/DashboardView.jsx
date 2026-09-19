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
                "#1e5631", // Dark green
                "#4c9a2a", // Light green
                "#76ba1b", // Lime green
                "#d4a373", // Tan
                "#8b5a2b", // Brown
              ],
              borderWidth: 2,
              borderColor: "#ffffff",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "75%",
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
      gradient.addColorStop(0, "rgba(16, 185, 129, 0.2)");
      gradient.addColorStop(1, "rgba(16, 185, 129, 0)");

      lineChartRef.current = new Chart(ctxLine, {
        type: "line",
        data: {
          labels: ["Abr", "May", "Jun", "Jul", "Ago", "Sep"],
          datasets: [
            {
              label: "Peso Promedio (kg)",
              data: [350, 370, 385, 395, 410, 419],
              borderColor: "#10b981",
              backgroundColor: gradient,
              borderWidth: 3,
              pointBackgroundColor: "#ffffff",
              pointBorderColor: "#10b981",
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: {
              min: 320,
              max: 480,
              ticks: {
                stepSize: 40,
                color: "#9ca3af",
                font: { size: 11 },
              },
              grid: {
                color: "#f3f4f6",
                drawBorder: false,
              },
            },
            x: {
              ticks: {
                color: "#9ca3af",
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
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden h-48 md:h-56 shadow-soft flex items-center">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&q=80')] bg-cover bg-center"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/60 to-transparent"></div>

        <div className="relative z-10 flex w-full justify-between items-center px-8 md:px-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Hola, {nombreUsuario}
            </h2>
            <p className="text-gray-200 text-sm md:text-base">
              Aquí tenés el estado general de tu establecimiento.
            </p>
          </div>

          <div className="hidden md:flex flex-col items-end text-right">
            <div className="flex items-center gap-3 mb-4">
              <i className="fa-solid fa-sun text-yellow-400 text-3xl"></i>
              <div>
                <p className="text-2xl font-bold text-white leading-none">18°C</p>
                <p className="text-sm text-gray-200">Cielo despejado</p>
                <p className="text-xs text-gray-400 mt-0.5">{establecimiento}</p>
              </div>
            </div>
            <p className="text-xs text-gray-300 italic max-w-xs border-r-2 border-emerald-500 pr-3">
              "El campo siempre da más<br />a quienes lo cuidan."
            </p>
          </div>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1: Total Cabezas */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft relative overflow-hidden flex flex-col justify-between">
          <i className="fa-solid fa-cow absolute -right-4 -bottom-4 text-7xl text-gray-50 opacity-50 transform -rotate-12"></i>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                <i className="fa-solid fa-cow"></i>
              </div>
              <h3 className="text-sm font-medium text-gray-500">Total de Cabezas</h3>
            </div>
            <div className="flex items-end gap-3 mb-1">
              <p className="text-4xl font-bold text-gray-800">{totalCabezas}</p>
            </div>
            <div className="flex flex-col text-xs mt-2">
              <span className="text-emerald-500 font-medium flex items-center gap-1">
                <i className="fa-solid fa-arrow-up"></i> +1
              </span>
              <span className="text-gray-400">vs. mes anterior</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => alCambiarVista && alCambiarVista("ganado")}
            className="text-xs font-semibold text-emerald-600 mt-4 relative z-10 flex items-center gap-1 hover:text-emerald-700 text-left"
          >
            Ver detalle <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>

        {/* KPI 2: Peso Promedio */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft relative overflow-hidden flex flex-col justify-between">
          <i className="fa-solid fa-scale-balanced absolute -right-2 -bottom-4 text-7xl text-gray-50 opacity-50 transform -rotate-12"></i>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                <i className="fa-solid fa-weight-hanging"></i>
              </div>
              <h3 className="text-sm font-medium text-gray-500">Peso Promedio del Rodeo</h3>
            </div>
            <div className="flex items-end gap-1 mb-1">
              <p className="text-4xl font-bold text-gray-800">{pesoPromedio}</p>
              <span className="text-lg text-gray-500 font-medium mb-1">kg</span>
            </div>
            <div className="flex flex-col text-xs mt-2">
              <span className="text-red-500 font-medium flex items-center gap-1">
                <i className="fa-solid fa-arrow-down"></i> -2.3%
              </span>
              <span className="text-gray-400">vs. mes anterior</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => alCambiarVista && alCambiarVista("ganado")}
            className="text-xs font-semibold text-blue-600 mt-4 relative z-10 flex items-center gap-1 hover:text-blue-700 text-left"
          >
            Ver evolución <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>

        {/* KPI 3: Alertas Sanitarias */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft relative overflow-hidden flex flex-col justify-between">
          <i className="fa-solid fa-stethoscope absolute -right-2 -bottom-4 text-7xl text-gray-50 opacity-50 transform -rotate-12"></i>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h3 className="text-sm font-medium text-gray-500">Alertas Sanitarias</h3>
            </div>
            <div className="flex items-end gap-3 mb-1">
              <p className="text-4xl font-bold text-gray-800">
                {metricas?.alertasSanitariasCount ?? 2}
              </p>
            </div>
            <div className="flex flex-col text-xs mt-2">
              <span className="text-amber-500 font-medium flex items-center gap-1">
                <i className="fa-solid fa-arrow-up"></i> +1
              </span>
              <span className="text-gray-400">respecto al mes anterior</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => alCambiarVista && alCambiarVista("sanidad")}
            className="text-xs font-semibold text-amber-600 mt-4 relative z-10 flex items-center gap-1 hover:text-amber-700 text-left"
          >
            Ver alertas <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>

        {/* KPI 4: Insumos Críticos */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft relative overflow-hidden flex flex-col justify-between">
          <i className="fa-solid fa-box-open absolute -right-2 -bottom-4 text-7xl text-gray-50 opacity-50 transform -rotate-12"></i>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                <i className="fa-solid fa-box"></i>
              </div>
              <h3 className="text-sm font-medium text-gray-500">Insumos Críticos</h3>
            </div>
            <div className="flex items-end gap-3 mb-1">
              <p className="text-4xl font-bold text-gray-800">
                {metricas?.insumosCriticosCount ?? 3}
              </p>
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 text-[10px] font-bold px-2 py-1 rounded border border-red-100 uppercase">
                <i className="fa-solid fa-lock"></i> Bajo stock mínimo
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => alCambiarVista && alCambiarVista("insumos")}
            className="text-xs font-semibold text-red-600 mt-4 relative z-10 flex items-center gap-1 hover:text-red-700 text-left"
          >
            Ver inventario <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>

      {/* Middle Row: Charts + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Distribución */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-base font-bold text-gray-800">Distribución del Rodeo</h3>
              <p className="text-xs text-gray-500 mt-0.5">Cantidad de animales por categoría</p>
            </div>
            <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 text-gray-600 outline-none">
              <option>Por categoría</option>
            </select>
          </div>

          <div className="flex items-center justify-center gap-8 h-48">
            <div className="relative w-40 h-40">
              <canvas ref={doughnutCanvasRef}></canvas>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-gray-800">{totalCabezas}</span>
                <span className="text-[10px] text-gray-500 font-medium">Cabezas</span>
              </div>
            </div>

            {/* Custom Legend */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 text-gray-600 font-medium">
                  <span className="w-3 h-3 rounded-full bg-[#1e5631]"></span> Vacas
                </div>
                <span className="font-bold text-gray-800">1</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 text-gray-600 font-medium">
                  <span className="w-3 h-3 rounded-full bg-[#4c9a2a]"></span> Toros
                </div>
                <span className="font-bold text-gray-800">1</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 text-gray-600 font-medium">
                  <span className="w-3 h-3 rounded-full bg-[#76ba1b]"></span> Novillos
                </div>
                <span className="font-bold text-gray-800">1</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 text-gray-600 font-medium">
                  <span className="w-3 h-3 rounded-full bg-[#d4a373]"></span> Terneras
                </div>
                <span className="font-bold text-gray-800">1</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 text-gray-600 font-medium">
                  <span className="w-3 h-3 rounded-full bg-[#8b5a2b]"></span> Vaquillonas
                </div>
                <span className="font-bold text-gray-800">1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: Evolución Peso */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-base font-bold text-gray-800">Evolución del Peso Promedio</h3>
            <div className="flex gap-2">
              <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                <i className="fa-solid fa-arrow-trend-up"></i> +12%
              </span>
              <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 text-gray-600 outline-none">
                <option>Últimos 6 meses</option>
              </select>
            </div>
          </div>
          <div className="h-48 w-full">
            <canvas ref={lineCanvasRef}></canvas>
          </div>
        </div>

        {/* Tasks List */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-base font-bold text-gray-800">Próximas Tareas</h3>
            <button
              type="button"
              onClick={() => alCambiarVista && alCambiarVista("sanidad")}
              className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 border border-gray-200 px-2 py-1 rounded bg-gray-50"
            >
              Ver todas <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>

          <div className="flex-1 space-y-4">
            {/* Task 1 */}
            <div className="flex items-center justify-between gap-3 group">
              <div className="flex items-center gap-4">
                <div className="text-center w-10">
                  <p className="text-lg font-bold text-gray-800 leading-none">15</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Oct</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                  <i className="fa-solid fa-syringe text-sm"></i>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Vacunación Antiaftosa</p>
                  <p className="text-xs text-gray-500">Rodeo General</p>
                </div>
              </div>
              <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase border border-amber-100">
                Pendiente
              </span>
            </div>

            {/* Task 2 */}
            <div className="flex items-center justify-between gap-3 group">
              <div className="flex items-center gap-4">
                <div className="text-center w-10">
                  <p className="text-lg font-bold text-gray-800 leading-none">25</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Sep</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 group-hover:bg-red-50 group-hover:text-red-600 transition-colors">
                  <i className="fa-solid fa-tags text-sm"></i>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Control de Carbunclo</p>
                  <p className="text-xs text-gray-500">Terneros destete</p>
                </div>
              </div>
              <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase border border-red-100">
                Próximo
              </span>
            </div>

            {/* Task 3 */}
            <div className="flex items-center justify-between gap-3 group">
              <div className="flex items-center gap-4">
                <div className="text-center w-10">
                  <p className="text-lg font-bold text-gray-400 leading-none">18</p>
                  <p className="text-[10px] font-bold text-gray-300 uppercase">Sep</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                  <i className="fa-solid fa-bottle-droplet text-sm"></i>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-500 line-through decoration-gray-300">
                    Tratamiento Antiparasitario
                  </p>
                  <p className="text-xs text-gray-400">Novillos Potrero 5</p>
                </div>
              </div>
              <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase border border-emerald-100">
                Completado
              </span>
            </div>

            {/* Task 4 */}
            <div className="flex items-center justify-between gap-3 group">
              <div className="flex items-center gap-4">
                <div className="text-center w-10">
                  <p className="text-lg font-bold text-gray-800 leading-none">05</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Oct</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <i className="fa-solid fa-clipboard-check text-sm"></i>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Revisión de alambrados</p>
                  <p className="text-xs text-gray-500">Potrero 2 - La Loma</p>
                </div>
              </div>
              <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase border border-blue-100">
                Programado
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Novedades + Stock + Promo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
        {/* Novedades */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
          <div className="flex justify-between items-start mb-5">
            <h3 className="text-base font-bold text-gray-800">Últimas Novedades de Campo</h3>
            <button
              type="button"
              onClick={() => alCambiarVista && alCambiarVista("partes")}
              className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 border border-gray-200 px-2 py-1 rounded bg-gray-50"
            >
              Ver todas <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>

          <div className="space-y-4">
            {/* Novedad 1 */}
            <div className="flex gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
              <img
                src="https://images.unsplash.com/photo-1546445317-29f4545e9d53?auto=format&fit=crop&q=80&w=100"
                alt="Vacas"
                className="w-16 h-16 rounded-lg object-cover shadow-sm"
              />
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">2026-09-19</span> • Potrero 2 - La Loma
                  </p>
                  <span className="bg-amber-50 text-amber-600 text-[9px] font-bold px-2 py-0.5 rounded uppercase border border-amber-100">
                    Pendiente
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-snug">
                  Nacimiento de 2 terneros machos en buen estado. Alambrado perimetral este con hilo caído por viento.
                </p>
              </div>
            </div>

            {/* Novedad 2 */}
            <div className="flex gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
              <img
                src="https://images.unsplash.com/photo-1596733430284-f743728fc1e0?auto=format&fit=crop&q=80&w=100"
                alt="Novillo"
                className="w-16 h-16 rounded-lg object-cover shadow-sm"
              />
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">2026-09-18</span> • Potrero 5 - La Aguada
                  </p>
                  <span className="bg-emerald-50 text-emerald-600 text-[9px] font-bold px-2 py-0.5 rounded uppercase border border-emerald-100">
                    Aprobado
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-snug">
                  Novillo A-8-4922 apartado con renguera en pata trasera derecha. Se apartó a corralillo.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stock de Insumos */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
          <div className="flex justify-between items-start mb-5">
            <h3 className="text-base font-bold text-gray-800">Stock de Insumos</h3>
            <button
              type="button"
              onClick={() => alCambiarVista && alCambiarVista("insumos")}
              className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 border border-gray-200 px-2 py-1 rounded bg-gray-50"
            >
              Ver inventario <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>

          <div className="space-y-0 text-sm">
            {/* Item 1 */}
            <div className="flex items-center justify-between py-3 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                  <i className="fa-solid fa-prescription-bottle-medical text-xs"></i>
                </div>
                <span className="font-medium text-gray-700">Vacuna Antiaftosa Bivalente</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-red-500 font-bold">18 Dosis</span>
                <span className="bg-red-50 text-red-600 text-[9px] font-bold px-2 py-0.5 rounded uppercase border border-red-100 w-20 text-center">
                  Bajo Stock
                </span>
              </div>
            </div>

            {/* Item 2 */}
            <div className="flex items-center justify-between py-3 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                  <i className="fa-solid fa-syringe text-xs"></i>
                </div>
                <span className="font-medium text-gray-700">Ivermectina Inyectable 500ml</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-red-500 font-bold">3 Frascos</span>
                <span className="bg-red-50 text-red-600 text-[9px] font-bold px-2 py-0.5 rounded uppercase border border-red-100 w-20 text-center">
                  Bajo Stock
                </span>
              </div>
            </div>

            {/* Item 3 */}
            <div className="flex items-center justify-between py-3 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                  <i className="fa-solid fa-box-archive text-xs"></i>
                </div>
                <span className="font-medium text-gray-700">Complejo Vitamínico</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-600 font-medium">12 Kg</span>
                <span className="bg-emerald-50 text-emerald-600 text-[9px] font-bold px-2 py-0.5 rounded uppercase border border-emerald-100 w-20 text-center">
                  OK
                </span>
              </div>
            </div>

            {/* Item 4 */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                  <i className="fa-solid fa-sack-xmark text-xs"></i>
                </div>
                <span className="font-medium text-gray-700">Sales Minerales</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-600 font-medium">8 Bolsas</span>
                <span className="bg-emerald-50 text-emerald-600 text-[9px] font-bold px-2 py-0.5 rounded uppercase border border-emerald-100 w-20 text-center">
                  OK
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Promo Card */}
        <div className="rounded-2xl shadow-soft relative overflow-hidden flex flex-col justify-end bg-gray-900 group cursor-pointer">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&q=80')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent"></div>

          <div className="relative z-10 p-5 w-full">
            <div className="mb-4">
              <i className="fa-solid fa-chart-column text-emerald-400 text-2xl mb-2"></i>
              <h3 className="text-lg font-bold text-white leading-tight">
                Gestión eficiente<br />para un campo más rentable.
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-white/20 pt-4 mt-2">
              <div className="text-center">
                <i className="fa-solid fa-leaf text-gray-400 text-sm mb-1"></i>
                <p className="text-[10px] text-gray-300 font-medium">Bienestar animal</p>
              </div>
              <div className="text-center border-l border-white/10">
                <i className="fa-solid fa-gear text-gray-400 text-sm mb-1"></i>
                <p className="text-[10px] text-gray-300 font-medium">Trazabilidad</p>
              </div>
              <div className="text-center border-l border-white/10">
                <i className="fa-solid fa-arrow-trend-up text-gray-400 text-sm mb-1"></i>
                <p className="text-[10px] text-gray-300 font-medium">Mayor productividad</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
