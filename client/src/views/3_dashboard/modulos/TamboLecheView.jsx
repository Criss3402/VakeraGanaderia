import { useState, useEffect, useMemo } from "react";
import { obtenerLeche, obtenerGanado } from "../../../api/dashboard.api";
import VacasOrdenadasView from "./VacasOrdenadasView.jsx";

const DOLAR_FALLBACK = {
  oficial: { nombre: "Oficial", venta: 1600 },
  blue: { nombre: "Blue", venta: 1675 },
  bolsa: { nombre: "MEP / Bolsa", venta: 1743.1 },
};

const VOLUMENES_REFERENCIA = [500, 1000, 2500, 5000, 10000, 30000, 50000];

export default function TamboLecheView({
  vistaSubModulo,
  alIrAVacasOrdenadas,
  alVolverTambo,
} = {}) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);

  // Moneda ARS / USD
  const [moneda, setMoneda] = useState("ARS");
  const [tipoDolar, setTipoDolar] = useState("oficial");

  // Calculadora del tambo (inicia en 0, sin guardar en BDD)
  const [subModulo, setSubModulo] = useState("resumen"); // "resumen" | "vacas-ordenadas"
  const [listaVacasLecheras, setListaVacasLecheras] = useState([]);
  const [vacasLecherasRegistradas, setVacasLecherasRegistradas] = useState(0);
  const [modoEntrada, setModoEntrada] = useState("vacas"); // "vacas" | "litros"
  const [vacasOrdenie, setVacasOrdenie] = useState(0);
  const [litrosPorVaca, setLitrosPorVaca] = useState(0);
  const [litrosDiariosManual, setLitrosDiariosManual] = useState(0);
  const [diasPeriodo, setDiasPeriodo] = useState(0);
  const [diferencialPorc, setDiferencialPorc] = useState(0); // % calidad / bonificación o flete

  const cargarDatos = async (forzar = false) => {
    if (forzar) setActualizando(true);
    else setCargando(true);
    try {
      const [resLeche, resGanado] = await Promise.all([
        obtenerLeche(forzar ? { refresh: "true" } : {}),
        obtenerGanado().catch(() => null),
      ]);
      if (resLeche?.data) setDatos(resLeche.data);

      if (Array.isArray(resGanado?.data)) {
        const lecheras = resGanado.data.filter((g) =>
          String(g.categoria || "").toLowerCase().includes("lecher")
        );
        setListaVacasLecheras(lecheras);
        setVacasLecherasRegistradas(lecheras.length);
      }
    } catch (e) {
      console.error("Error al cargar cotización de leche OCLA:", e);
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  };

  useEffect(() => {
    cargarDatos(false);
  }, []);

  const cotizacionesDolar = {
    oficial: datos?.dolar?.cotizaciones?.oficial || DOLAR_FALLBACK.oficial,
    blue: datos?.dolar?.cotizaciones?.blue || DOLAR_FALLBACK.blue,
    bolsa: datos?.dolar?.cotizaciones?.bolsa || DOLAR_FALLBACK.bolsa,
  };
  const dolarSeleccionado = cotizacionesDolar[tipoDolar] || cotizacionesDolar.oficial;
  const tasaCambio = moneda === "USD" ? Number(dolarSeleccionado.venta) || 1 : 1;

  const formatearMonto = (montoArs, decimales = 2) => {
    const val = Number(montoArs) || 0;
    const convertido = moneda === "USD" ? val / tasaCambio : val;
    if (moneda === "USD") {
      return `US$ ${convertido.toLocaleString("es-AR", {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      })}`;
    }
    return `$${convertido.toLocaleString("es-AR", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    })}`;
  };

  const precioBaseLitro = Number(datos?.precioLitro) || 550.25;
  const precioAjustadoLitro = useMemo(() => {
    const factor = 1 + (Number(diferencialPorc) || 0) / 100;
    return Math.max(0, precioBaseLitro * factor);
  }, [precioBaseLitro, diferencialPorc]);

  const litrosDiariosTotales = useMemo(() => {
    if (modoEntrada === "vacas") {
      return Math.max(0, (Number(vacasOrdenie) || 0) * (Number(litrosPorVaca) || 0));
    }
    return Math.max(0, Number(litrosDiariosManual) || 0);
  }, [modoEntrada, vacasOrdenie, litrosPorVaca, litrosDiariosManual]);

  const litrosPeriodo = litrosDiariosTotales * Math.max(0, Number(diasPeriodo) || 0);
  const ingresoDiarioArs = litrosDiariosTotales * precioAjustadoLitro;
  const ingresoPeriodoArs = litrosPeriodo * precioAjustadoLitro;
  const ingresoAnualArs = litrosDiariosTotales * 365 * precioAjustadoLitro;

  const subModuloActual = vistaSubModulo || subModulo;

  if (subModuloActual === "vacas-ordenadas") {
    return (
      <VacasOrdenadasView
        vacasLecheras={listaVacasLecheras}
        precioLitro={precioBaseLitro}
        formatearMonto={formatearMonto}
        alVolver={() => {
          if (alVolverTambo) alVolverTambo();
          else setSubModulo("resumen");
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner Principal */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              Módulo Lechero · OCLA / SIGLeA
            </span>
            <span className="text-xs text-[#8fb56b]">
              {datos?.esEnVivo ? "Datos en vivo" : "Valores de referencia"} · Período {datos?.periodo || "oct/2026"}
            </span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Precio del Tambo de Leche y Liquidación por Litros
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-2xl">
            Cotización oficial promedio al productor (SIGLeA / OCLA) con calculadora de producción diaria, mensual y tabla por volumen de litros.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-[#122018] border border-[#33512f] rounded-xl p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setMoneda("ARS")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                moneda === "ARS" ? "bg-[#8fb56b] text-[#182920] shadow-sm" : "text-[#ded7c4] hover:text-white"
              }`}
            >
              ARS $
            </button>
            <button
              type="button"
              onClick={() => setMoneda("USD")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                moneda === "USD" ? "bg-[#8fb56b] text-[#182920] shadow-sm" : "text-[#ded7c4] hover:text-white"
              }`}
            >
              USD US$
            </button>
          </div>

          <select
            disabled={moneda !== "USD"}
            value={tipoDolar}
            onChange={(e) => setTipoDolar(e.target.value)}
            aria-label="Tipo de cambio dólar"
            className={`bg-[#122018] border border-[#33512f] text-[#f1ecdd] text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none ${
              moneda === "USD" ? "cursor-pointer" : "opacity-45 cursor-not-allowed"
            }`}
          >
            <option value="oficial">Oficial (${Math.round(cotizacionesDolar.oficial.venta).toLocaleString("es-AR")})</option>
            <option value="blue">Blue (${Math.round(cotizacionesDolar.blue.venta).toLocaleString("es-AR")})</option>
            <option value="bolsa">MEP (${Math.round(cotizacionesDolar.bolsa.venta).toLocaleString("es-AR")})</option>
          </select>

          <button
            type="button"
            onClick={() => cargarDatos(true)}
            disabled={actualizando}
            className="bg-[#233a2d] hover:bg-[#2c4938] text-[#f1ecdd] border border-[#33512f] font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
          >
            <i className={`fa-solid fa-rotate ${actualizando ? "animate-spin" : ""}`}></i>
            {actualizando ? "Actualizando..." : "Actualizar OCLA"}
          </button>
        </div>
      </div>

      {/* Botón Vacas Ordeñadas entre el banner y los KPIs */}
      <button
        type="button"
        onClick={() => {
          if (alIrAVacasOrdenadas) alIrAVacasOrdenadas();
          else setSubModulo("vacas-ordenadas");
        }}
        className="w-full bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-extrabold text-xs uppercase py-3.5 px-5 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2.5"
      >
        <i className="fa-solid fa-cow text-sm"></i>
        <span>Vacas Ordeñadas</span>
        <i className="fa-solid fa-chevron-right text-[11px]"></i>
      </button>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Precio Promedio Litro (SIGLeA)</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-1">
            {cargando ? "..." : formatearMonto(precioBaseLitro, 2)}
            <span className="text-xs font-bold text-[#6b7c6d] ml-1">/ L</span>
          </p>
          <span className="text-[11px] text-[#33512f]">
            Fuente: OCLA ({datos?.periodo || "oct/2026"})
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Precio Sólidos Útiles</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-1">
            {cargando ? "..." : formatearMonto(datos?.precioKgSu || 7550.57, 2)}
            <span className="text-xs font-bold text-[#6b7c6d] ml-1">/ kg SU</span>
          </p>
          <span className="text-[11px] text-[#33512f]">Grasa butirosa + Proteína</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Leche en Polvo Entera (Export.)</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-1">
            US$ {(Number(datos?.lpeUsdTon) || 4081).toLocaleString("es-AR")}
            <span className="text-xs font-bold text-[#6b7c6d] ml-1">/ ton</span>
          </p>
          <span className="text-[11px] text-[#33512f]">Referencia internacional GDT / OCLA</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">
            Ingreso Estimado ({diasPeriodo} días)
          </p>
          <p className="text-2xl font-extrabold text-emerald-800 mt-1">
            {formatearMonto(ingresoPeriodoArs, moneda === "USD" ? 2 : 0)}
          </p>
          <span className="text-[11px] text-emerald-700">
            {litrosPeriodo.toLocaleString("es-AR")} litros totales
          </span>
        </div>
      </div>

      {/* Calculadora de Producción + Tabla por Litros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calculadora por Tambo y Litros */}
        <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
              Calculadora de Producción del Tambo
            </h3>
            <div className="flex bg-[#f8f5eb] border border-[#ded7c4] rounded-xl p-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setModoEntrada("vacas")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  modoEntrada === "vacas" ? "bg-[#182920] text-[#f1ecdd]" : "text-[#6b7c6d]"
                }`}
              >
                Por vacas en ordeñe
              </button>
              <button
                type="button"
                onClick={() => setModoEntrada("litros")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  modoEntrada === "litros" ? "bg-[#182920] text-[#f1ecdd]" : "text-[#6b7c6d]"
                }`}
              >
                Por litros directos
              </button>
            </div>
          </div>

          {modoEntrada === "vacas" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs">
                <span className="font-bold text-[#182920] flex items-center justify-between gap-2 mb-1">
                  <span>Vacas en ordeñe</span>
                  <span className="text-[10px] font-semibold text-[#33512f] bg-[#f8f5eb] px-2 py-0.5 rounded-full border border-[#ded7c4]">
                    En Ganado: {vacasLecherasRegistradas}
                  </span>
                </span>
                <input
                  type="number"
                  min="0"
                  value={vacasOrdenie}
                  onChange={(e) => setVacasOrdenie(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] font-bold text-[#182920]"
                />
              </label>
              <label className="block text-xs">
                <span className="font-bold text-[#182920] block mb-1">Litros promedio / vaca / día</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={litrosPorVaca}
                  onChange={(e) => setLitrosPorVaca(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] font-bold text-[#182920]"
                />
              </label>
            </div>
          ) : (
            <label className="block text-xs">
              <span className="font-bold text-[#182920] block mb-1">Litros totales producidos por día</span>
              <input
                type="number"
                min="0"
                step="50"
                value={litrosDiariosManual}
                onChange={(e) => setLitrosDiariosManual(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] font-bold text-[#182920]"
              />
            </label>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="font-bold text-[#182920] block mb-1">Días del período a liquidar</span>
              <input
                type="number"
                min="1"
                value={diasPeriodo}
                onChange={(e) => setDiasPeriodo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] font-bold text-[#182920]"
              />
            </label>
            <label className="block text-xs">
              <span className="font-bold text-[#182920] block mb-1">Ajuste calidad / bonificación (%)</span>
              <input
                type="number"
                step="0.5"
                value={diferencialPorc}
                onChange={(e) => setDiferencialPorc(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] font-bold text-[#182920]"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]">
              <span className="text-[10px] font-bold uppercase text-[#6b7c6d] block">Diario ({litrosDiariosTotales.toLocaleString("es-AR")} L)</span>
              <span className="text-base font-extrabold text-[#182920]">
                {formatearMonto(ingresoDiarioArs, moneda === "USD" ? 2 : 0)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]">
              <span className="text-[10px] font-bold uppercase text-[#6b7c6d] block">Período ({diasPeriodo} días)</span>
              <span className="text-base font-extrabold text-[#33512f]">
                {formatearMonto(ingresoPeriodoArs, moneda === "USD" ? 2 : 0)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]">
              <span className="text-[10px] font-bold uppercase text-[#6b7c6d] block">Proyección Anual</span>
              <span className="text-base font-extrabold text-[#182920]">
                {formatearMonto(ingresoAnualArs, moneda === "USD" ? 2 : 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Tabla de Referencia por Volumen de Litros */}
        <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
              Tabla de Cotización por Litros
            </h3>
            <span className="text-[11px] font-bold text-[#33512f] bg-[#f8f5eb] px-2.5 py-1 rounded-full border border-[#ded7c4]">
              {formatearMonto(precioAjustadoLitro, 2)} / litro
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#ded7c4] text-[11px] uppercase text-[#6b7c6d]">
                  <th className="py-2.5 px-3">Volumen (Litros)</th>
                  <th className="py-2.5 px-3 text-right">Precio / Litro</th>
                  <th className="py-2.5 px-3 text-right">Valor Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee8d8]">
                {VOLUMENES_REFERENCIA.map((litros) => (
                  <tr key={litros} className="hover:bg-[#f8f5eb] transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[#182920]">
                      {litros.toLocaleString("es-AR")} litros
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#6b7c6d]">
                      {formatearMonto(precioAjustadoLitro, 2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-[#182920]">
                      {formatearMonto(litros * precioAjustadoLitro, moneda === "USD" ? 2 : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
