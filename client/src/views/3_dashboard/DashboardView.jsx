import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  obtenerMetricas,
  obtenerAlertasSanitarias,
  obtenerInsumosCriticos,
  obtenerPartesDiarios,
  obtenerClimaActual,
} from "../../api/dashboard.api";
import PartesPendientes from "./PartesPendientes";
import AlertasVacunacion from "./AlertasVacunacion";
import InsumosCriticos from "./InsumosCriticos";

export default function DashboardView({ alCambiarVista, seccionActiva = "metricas" }) {
  const { usuario } = useAuth();
  const [metricas, setMetricas] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [partes, setPartes] = useState([]);
  const [clima, setClima] = useState(null);
  const [cargandoClima, setCargandoClima] = useState(true);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const doughnutCanvasRef = useRef(null);
  const lineCanvasRef = useRef(null);
  const doughnutChartRef = useRef(null);
  const lineChartRef = useRef(null);

  const cargarDatos = useCallback(async () => {
    try {
      const [resMetricas, resAlertas, resInsumos, resPartes, resClima] = await Promise.all([
        obtenerMetricas().catch(() => null),
        obtenerAlertasSanitarias().catch(() => null),
        obtenerInsumosCriticos().catch(() => null),
        obtenerPartesDiarios().catch(() => null),
        obtenerClimaActual().catch(() => null),
      ]);
      if (resMetricas?.data) setMetricas(resMetricas.data);
      if (resAlertas?.data) setAlertas(resAlertas.data);
      if (resInsumos?.data) setInsumos(resInsumos.data);
      if (resPartes?.data) setPartes(resPartes.data);
      if (resClima?.data) setClima(resClima.data);
    } finally {
      setCargandoClima(false);
      setCargandoDatos(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Inicializar Gráficos con Chart.js cuando cambian las métricas
  useEffect(() => {
    if (seccionActiva !== "metricas") return;

    const Chart = window.Chart;
    if (!Chart) return;

    const porCat = metricas?.resumenGanado?.porCategoria || {};
    const categoriasKeys = Object.keys(porCat);
    const labels = categoriasKeys.length > 0 ? categoriasKeys : ["Vacas", "Toros", "Novillos", "Terneras", "Vaquillonas"];
    const dataValues = categoriasKeys.length > 0 ? Object.values(porCat) : [1, 1, 1, 1, 1];
    const colores = ["#182920", "#33512f", "#6f9a4f", "#8fb56b", "#6b4a32", "#a67c52"];

    // 1. Doughnut Chart: Distribución del Rodeo
    if (doughnutCanvasRef.current) {
      if (doughnutChartRef.current) {
        doughnutChartRef.current.destroy();
      }

      const ctxDoughnut = doughnutCanvasRef.current.getContext("2d");
      doughnutChartRef.current = new Chart(ctxDoughnut, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data: dataValues,
              backgroundColor: labels.map((_, i) => colores[i % colores.length]),
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
              data: [350, 370, 385, 395, 410, metricas?.resumenGanado?.pesoPromedioKg || 419],
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
  }, [metricas, seccionActiva]);

  // Si la sub-vista solicitada es 'partes', renderizar PartesPendientes
  if (seccionActiva === "partes") {
    return (
      <div className="space-y-6">
        <PartesPendientes
          partes={partes}
          cargando={cargandoDatos}
          alActualizar={cargarDatos}
        />
      </div>
    );
  }

  // Si la sub-vista solicitada es 'sanidad', renderizar AlertasVacunacion
  if (seccionActiva === "sanidad") {
    return (
      <div className="space-y-6">
        <AlertasVacunacion
          alertas={alertas}
          cargando={cargandoDatos}
        />
      </div>
    );
  }

  // Si la sub-vista solicitada es 'insumos', renderizar InsumosCriticos
  if (seccionActiva === "insumos") {
    return (
      <div className="space-y-6">
        <InsumosCriticos
          insumos={insumos}
          cargando={cargandoDatos}
        />
      </div>
    );
  }

  // Si la sub-vista solicitada es 'ganado', renderizar vista previa de rodeo
  if (seccionActiva === "ganado") {
    const porCat = metricas?.resumenGanado?.porCategoria || {};
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-bold text-[#8fb56b] uppercase tracking-wider block mb-1">
                Fase 4: En Preparación
              </span>
              <h2 className="text-2xl font-bold text-[#182920] font-['Fraunces',serif]">
                Gestión y Trazabilidad de Ganado
              </h2>
              <p className="text-xs text-[#6b7c6d] mt-1">
                Inventario de animales por caravana, raza, pesaje y potrero asignado.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs bg-[#f1ecdd] border border-[#ded7c4] text-[#182920] px-3 py-1.5 rounded-xl font-bold">
                Total Cabezas: {metricas?.resumenGanado?.totalCabezas ?? 5}
              </span>
              <span className="text-xs bg-[#f8f5eb] border border-[#ded7c4] text-[#6b4a32] px-3 py-1.5 rounded-xl font-bold">
                Peso Promedio: {metricas?.resumenGanado?.pesoPromedioKg ?? 419} kg
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {Object.entries(porCat).map(([cat, cant]) => (
              <div key={cat} className="p-3 rounded-xl bg-[#f8f5eb] border border-[#e8e1d2] text-center">
                <span className="text-[11px] text-[#4a5c4e] uppercase font-bold block">{cat}</span>
                <span className="text-2xl font-extrabold text-[#182920]">{cant}</span>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-3">
            <i className="fa-solid fa-circle-info text-amber-700 text-base"></i>
            <span>
              El módulo completo de alta de caravanas, pesaje histórico y movimientos entre potreros se desarrollará en la <strong>Fase 4 del Roadmap</strong> una vez consolidadas las fases operativas iniciales.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Sub-vista por defecto: 'metricas' (Panel General)
  const totalCabezas = metricas?.resumenGanado?.totalCabezas ?? 5;
  const pesoPromedio = metricas?.resumenGanado?.pesoPromedioKg ?? 419;
  const porCat = metricas?.resumenGanado?.porCategoria || {};
  const labels = Object.keys(porCat).length > 0 ? Object.keys(porCat) : ["Vacas", "Toros", "Novillos", "Terneras", "Vaquillonas"];
  const dataValues = Object.keys(porCat).length > 0 ? Object.values(porCat) : [1, 1, 1, 1, 1];
  const colores = ["#182920", "#33512f", "#6f9a4f", "#8fb56b", "#6b4a32", "#a67c52"];

  const nombreUsuario = usuario?.nombre || "Cristian Joaquín";
  const establecimiento = usuario?.establecimiento || "El Rancho, Goya, Corrientes";

  return (
    <div className="space-y-6 text-[#182920]">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden h-48 md:h-56 shadow-md flex items-center border border-[#ded7c4]">
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
            <div className="flex items-center gap-3.5 mb-2 bg-[#132219]/70 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-[#8fb56b]/25 shadow-lg">
              <div className="text-2xl">
                {clima?.iconoUrl ? (
                  <img src={clima.iconoUrl} alt={clima.descripcion} className="w-8 h-8 object-contain" />
                ) : (
                  <i className={clima?.iconoFontAwesome || "fa-solid fa-sun text-amber-400"}></i>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-extrabold text-white leading-none">
                    {clima ? `${clima.temperatura}°C` : "21°C"}
                  </p>
                  <span className="text-[10px] bg-[#1e3828] text-[#8fb56b] font-bold px-1.5 py-0.5 rounded border border-[#8fb56b]/30">
                    {clima?.esEnVivo ? "Google Weather" : "Establecimiento"}
                  </span>
                </div>
                <p className="text-xs text-[#8fb56b] font-medium mt-0.5">
                  {clima?.descripcion || "Cielo despejado"}
                </p>
              </div>
            </div>

            {clima && (
              <div className="flex items-center gap-3 text-[11px] text-[#f1ecdd]/80 bg-[#182920]/60 backdrop-blur-sm px-3 py-1 rounded-xl border border-[#f1ecdd]/10 mb-2">
                <span>ST: <strong className="text-white">{clima.sensacionTermica}°C</strong></span>
                <span className="text-[#8fb56b]">·</span>
                <span>Humedad: <strong className="text-white">{clima.humedad}%</strong></span>
                <span className="text-[#8fb56b]">·</span>
                <span>Viento: <strong className="text-white">{clima.vientoKmH} km/h</strong></span>
              </div>
            )}

            <p className="text-xs text-[#f1ecdd]/80 italic max-w-xs border-r-2 border-[#8fb56b] pr-3">
              "El campo siempre da más<br />a quienes lo cuidan."
            </p>
          </div>
        </div>
      </div>

      {/* KPIs Grid */}
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
                <i className="fa-solid fa-arrow-up"></i> Trazadas
              </span>
              <span className="text-[#6b7c6d] text-[11px]">en base de datos activa</span>
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
              <span className="text-[#33512f] font-bold flex items-center gap-1">
                <i className="fa-solid fa-check"></i> Normal
              </span>
              <span className="text-[#6b7c6d] text-[11px]">promedio del rodeo</span>
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
                {metricas?.alertasSanitariasCount ?? alertas.length}
              </p>
            </div>
            <div className="flex flex-col text-xs mt-2">
              <span className="text-amber-700 font-bold flex items-center gap-1">
                <i className="fa-solid fa-bell"></i> Activas
              </span>
              <span className="text-[#6b7c6d] text-[11px]">pendientes de aplicación</span>
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
                {metricas?.insumosCriticosCount ?? insumos.filter(i => i.requiereReposicion).length}
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

            {/* Dynamic Legend */}
            <div className="space-y-2 text-xs flex-1">
              {labels.map((lbl, idx) => (
                <div key={lbl} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-[#4a5c4e] font-medium">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colores[idx % colores.length] }}></span>
                    {lbl}
                  </div>
                  <span className="font-bold text-[#182920]">{dataValues[idx] || 0}</span>
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
                <i className="fa-solid fa-arrow-trend-up text-[#33512f]"></i> {pesoPromedio} kg
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
              <p className="text-xs text-[#6b7c6d] mt-0.5">Calendario sanitario de campo</p>
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
            {alertas.slice(0, 3).map((item) => {
              const diaMes = item.fechaProgramada ? item.fechaProgramada.split("-") : ["", "01", "15"];
              const dia = diaMes[2] || "15";
              const mesNombre = diaMes[1] === "10" ? "Oct" : diaMes[1] === "09" ? "Sep" : "Nov";
              return (
                <div key={item.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#f8f5eb] border border-[#e8e1d2] hover:bg-[#f1ecdd] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-center w-8 flex-shrink-0">
                      <p className="text-base font-bold text-[#182920] leading-none">{dia}</p>
                      <p className="text-[9px] font-bold text-[#6b4a32] uppercase">{mesNombre}</p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-[#e7dfcb] flex items-center justify-center text-[#182920] flex-shrink-0">
                      <i className={`fa-solid ${item.icono || "fa-syringe"} text-xs`}></i>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#182920] truncate">{item.evento}</p>
                      <p className="text-[11px] text-[#6b7c6d] truncate">{item.lote || "Rodeo General"}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase flex-shrink-0 ${
                    item.estado === "Completado" || item.estado === "Hecho"
                      ? "bg-[#e7dfcb] text-[#33512f] border-[#ded7c4]"
                      : item.prioridad === "Urgente"
                      ? "bg-red-100 text-red-800 border-red-200"
                      : "bg-amber-100 text-amber-800 border-amber-200"
                  }`}>
                    {item.estado}
                  </span>
                </div>
              );
            })}
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
            {partes.slice(0, 2).map((p) => {
              const esPendiente = p.estado === "PENDIENTE";
              return (
                <div key={p.id} className="flex gap-3.5 p-3 rounded-xl bg-[#f8f5eb] border border-[#e8e1d2] hover:bg-[#f1ecdd] transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-[#1e3828] text-[#8fb56b] flex items-center justify-center flex-shrink-0 text-xl">
                    <i className="fa-solid fa-clipboard-check"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-xs text-[#4a5c4e] font-bold truncate">
                        {p.fecha} · {p.potrero}
                      </p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                        esPendiente
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : p.estado === "APROBADO"
                          ? "bg-[#e7dfcb] text-[#33512f] border-[#ded7c4]"
                          : "bg-red-100 text-red-800 border-red-200"
                      }`}>
                        {p.estado}
                      </span>
                    </div>
                    <p className="text-xs text-[#182920] leading-relaxed line-clamp-2">
                      {p.novedades}
                    </p>
                  </div>
                </div>
              );
            })}
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
            {insumos.slice(0, 4).map((insumo) => {
              const esBajo = insumo.requiereReposicion || Number(insumo.stockActual) <= Number(insumo.stockMinimo);
              return (
                <div key={insumo.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8f5eb] border border-[#e8e1d2]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#e7dfcb] flex items-center justify-center text-[#182920] flex-shrink-0 text-xs">
                      <i className={`fa-solid ${insumo.icono || "fa-box-archive"}`}></i>
                    </div>
                    <span className="text-xs font-semibold text-[#182920] truncate">{insumo.nombre}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-bold ${esBajo ? "text-red-700" : "text-[#182920]"}`}>
                      {insumo.stockActual} {insumo.unidad}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                      esBajo
                        ? "bg-red-100 text-red-800 border-red-200"
                        : "bg-[#e7dfcb] text-[#33512f] border-[#ded7c4]"
                    }`}>
                      {esBajo ? "Bajo" : "OK"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Promo / Banner Institucional Vakera */}
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
