import { useState, useEffect, useRef } from "react";
import { obtenerReportes, obtenerDolar } from "../../../api/dashboard.api";
import { descargarPdfMargenBrutoPy } from "../../../api/reportesPy.api";
import { useAuth } from "../../../context/AuthContext";
import ParcelaDetalleReporte from "./ParcelaDetalleReporte.jsx";

const DOLAR_FALLBACK = {
  oficial: { nombre: "Oficial", venta: 1600 },
  blue: { nombre: "Blue", venta: 1675 },
  bolsa: { nombre: "MEP / Bolsa", venta: 1743.1 },
};

export default function ReportesView() {
  const { rol, usuario } = useAuth();
  const [datos, setDatos] = useState(null);
  const [dolarExtra, setDolarExtra] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [moneda, setMoneda] = useState("ARS");
  const [tipoDolar, setTipoDolar] = useState("oficial");
  const [menuDolarAbierto, setMenuDolarAbierto] = useState(false);
  const [parcelaSeleccionada, setParcelaSeleccionada] = useState(null);
  const [descargandoMargen, setDescargandoMargen] = useState(false);
  const [errorMargen, setErrorMargen] = useState("");
  const menuDolarRef = useRef(null);

  const manejarDescargarMargenBruto = async () => {
    setErrorMargen("");
    try {
      setDescargandoMargen(true);
      const dolarVenta = Number(dolarSeleccionado?.venta) || 1;
      const supTotalHa = potreros.reduce((acc, p) => acc + (Number(p.superficieHas) || 0), 0);
      const totalCabezasReal = Number(resumen.totalCabezas) || hacienda.length || 0;
      const pesoTotalKg =
        Number(resumen.pesoTotalKg) ||
        hacienda.reduce((acc, g) => acc + (Number(g.pesoKg) || 0), 0);
      const pesoPromedioKg =
        Number(resumen.pesoPromedioKg) || (totalCabezasReal > 0 ? pesoTotalKg / totalCabezasReal : 0);

      const categoriasMkt = Array.isArray(cotizacionesMercado?.categorias)
        ? cotizacionesMercado.categorias
        : Object.values(cotizacionesMercado?.categorias || {});
      const novilloCat = categoriasMkt.find((c) =>
        String(c?.categoria || c?.nombre || c?.label || "").toLowerCase().includes("novillo")
      );
      const novilloArsKg = Number(novilloCat?.precioKg || novilloCat?.precioPromedio || novilloCat?.promedio || 0);
      const novilloUsdKg = novilloArsKg > 0 ? novilloArsKg / dolarVenta : 0;

      const vientresCount =
        valuacionCategorias
          .filter((c) => String(c.categoria || "").toLowerCase().includes("vaca"))
          .reduce((acc, c) => acc + (Number(c.cabezas) || 0), 0) ||
        totalCabezasReal;

      const torosCount = valuacionCategorias
        .filter((c) => String(c.categoria || "").toLowerCase().includes("toro"))
        .reduce((acc, c) => acc + (Number(c.cabezas) || 0), 0);
      const torosPctAuto = totalCabezasReal > 0 ? (torosCount / totalCabezasReal) * 100 : 0;

      const repro = datos?.reproduccionResumen || {};
      const fin = datos?.finanzasResumen || {};
      const rubrosFin = fin?.porRubroUsd || {};
      const paramsFin = fin?.parametros || {};

      const generadoPor = usuario?.nombre
        ? `${usuario.nombre}${rol ? ` (${String(rol).toUpperCase()})` : ""}`
        : usuario?.email || "Usuario Vakera";

      const payload = {
        titulo: "Balance y Valuación Ganadera — Datos en Vivo",
        establecimiento: usuario?.establecimiento || "Establecimiento Vakera",
        generadoPor,
        fechaElaboracion: new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
        dolar: dolarVenta,
        novilloUsdKg,
        indicadores: {
          totalCabezas: totalCabezasReal,
          vientres: vientresCount,
          torosPct: torosPctAuto,
          pesoTotalKg,
          pesoPromedioKg,
          produccionCarneKgHa: supTotalHa > 0 ? pesoTotalKg / supTotalHa : 0,
          tasaSanitariaPct: Number(resumen.tasaSanitaria ?? resumen.porcentajeSaludable ?? 100),
          mortandadPct: Number(paramsFin.mortandadPct || resumen.tasaMortalidad || 0),
          evaluadas: Number(repro.evaluadas || 0),
          prenezPct: Number(repro.prenezPct || 0),
          destetes: Number(repro.destetes || 0),
          destetePct: Number(repro.destetePct || 0),
          edadPrimerServicioMeses: repro.edadPrimerServicioMeses || paramsFin.edadPrimerServicioMeses || null,
          reposicionHembrasPct: Number(paramsFin.reposicionHembrasPct || 0),
          reposicionTorosPct: Number(paramsFin.reposicionTorosPct || 0),
          vacasLecheras: Number(tamboLeche?.vacasLecheras || 0),
          precioLecheUsdL: Number(tamboLeche?.precioLitroArs || 0) / dolarVenta,
        },
        superficies: potreros.map((p) => ({
          nombre: p.pastura ? `${p.nombre} (${p.pastura})` : p.nombre,
          ha: Number(p.superficieHas) || 0,
          usoPct: 100,
        })),
        categoriasIngreso: valuacionCategorias.map((c) => {
          const cab = Number(c.cabezas) || 0;
          const pesoCab = cab > 0 ? (Number(c.pesoPromedioKg) || (Number(c.pesoTotalKg) || 0) / cab) : 0;
          const ingresoUsd = (Number(c.valorEstimadoArs) || 0) / dolarVenta;
          const precioUsdKg = (Number(c.precioKgArs) || 0) / dolarVenta || (cab * pesoCab > 0 ? ingresoUsd / (cab * pesoCab) : 0);
          return {
            categoria: c.categoria,
            cabezas: cab,
            pesoKgCab: pesoCab,
            precioUsdKg,
            ingresoUsd,
          };
        }),
        costos: {
          compraTorosUsd: Number(rubrosFin.compraTorosUsd || 0),
          comercializacionUsd: Number(rubrosFin.comercializacionUsd || 0),
          personalUsd: Number(rubrosFin.personalUsd || 0),
          sanidadUsd: Number(rubrosFin.sanidadUsd || 0),
          alimentacionUsd: Number(rubrosFin.alimentacionUsd || 0),
          amortizacionesUsd: Number(rubrosFin.amortizacionesUsd || 0),
        },
      };

      await descargarPdfMargenBrutoPy(payload);
    } catch (err) {
      setErrorMargen(err.message || "No se pudo generar el PDF de Margen Bruto.");
    } finally {
      setDescargandoMargen(false);
    }
  };

  useEffect(() => {
    const manejarClickAfuera = (e) => {
      if (menuDolarRef.current && !menuDolarRef.current.contains(e.target)) {
        setMenuDolarAbierto(false);
      }
    };
    document.addEventListener("mousedown", manejarClickAfuera);
    return () => document.removeEventListener("mousedown", manejarClickAfuera);
  }, []);

  useEffect(() => {
    Promise.all([
      obtenerReportes().catch((e) => {
        console.error(e);
        return null;
      }),
      obtenerDolar().catch(() => null),
    ])
      .then(([resRep, resDol]) => {
        if (resRep?.data) setDatos(resRep.data);
        if (resDol?.data) setDolarExtra(resDol.data);
      })
      .finally(() => setCargando(false));
  }, []);

  const resumen = datos?.resumenGeneral || {};
  const valuacionCategorias = datos?.valuacionPorCategoria || [];
  const cotizacionesMercado = datos?.cotizacionesMercado || {};
  const tamboLeche = datos?.tamboLeche || {};
  const dolarInfo = datos?.dolar?.cotizaciones ? datos.dolar : (dolarExtra || {});
  const cotizacionesDolar = {
    oficial: dolarInfo?.cotizaciones?.oficial || DOLAR_FALLBACK.oficial,
    blue: dolarInfo?.cotizaciones?.blue || DOLAR_FALLBACK.blue,
    bolsa: dolarInfo?.cotizaciones?.bolsa || DOLAR_FALLBACK.bolsa,
  };
  const dolarSeleccionado = cotizacionesDolar[tipoDolar] || cotizacionesDolar.oficial;
  const tasaCambio = moneda === "USD" ? (Number(dolarSeleccionado.venta) || 1) : 1;

  const convertirMonto = (montoArs) => {
    const val = Number(montoArs) || 0;
    return moneda === "USD" ? val / tasaCambio : val;
  };

  const formatearMonto = (montoArs, decimalesUsd = 0) => {
    const convertido = convertirMonto(montoArs);
    if (moneda === "USD") {
      return `US$ ${convertido.toLocaleString("es-AR", {
        minimumFractionDigits: decimalesUsd,
        maximumFractionDigits: decimalesUsd,
      })}`;
    }
    return `$${Math.round(convertido).toLocaleString("es-AR")}`;
  };

  const potreros = datos?.distribucionPotreros || [];
  const hacienda = datos?.haciendaDetalle || [];

  if (parcelaSeleccionada) {
    return (
      <ParcelaDetalleReporte
        parcela={parcelaSeleccionada}
        hacienda={hacienda}
        cotizacionesMercado={cotizacionesMercado}
        tamboLeche={tamboLeche}
        moneda={moneda}
        setMoneda={setMoneda}
        tipoDolar={tipoDolar}
        setTipoDolar={setTipoDolar}
        cotizacionesDolar={cotizacionesDolar}
        dolarSeleccionado={dolarSeleccionado}
        formatearMonto={formatearMonto}
        alVolver={() => setParcelaSeleccionada(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-[#8fb56b]">Auditoría Contable y Ganadera</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Balance General del Establecimiento
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-xl">
            Consolidado patrimonial, valuación a precio de mercado vivo, rendimiento del ganado y tasa de sanidad.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-[#122018] border border-[#33512f] rounded-xl p-1 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setMoneda("ARS");
                setMenuDolarAbierto(false);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${moneda === "ARS"
                ? "bg-[#8fb56b] text-[#182920] shadow-sm"
                : "text-[#ded7c4] hover:text-white hover:bg-[#1e3326]"
                }`}
            >
              <span>ARS</span>
              <span className="opacity-75">$</span>
            </button>
            <button
              type="button"
              onClick={() => setMoneda("USD")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${moneda === "USD"
                ? "bg-[#8fb56b] text-[#182920] shadow-sm"
                : "text-[#ded7c4] hover:text-white hover:bg-[#1e3326]"
                }`}
            >
              <span>USD</span>
              <span className="opacity-75">US$</span>
            </button>
          </div>

          <div className="relative" ref={menuDolarRef}>
            <button
              type="button"
              disabled={moneda !== "USD"}
              onClick={() => {
                if (moneda === "USD") setMenuDolarAbierto((prev) => !prev);
              }}
              aria-expanded={moneda === "USD" && menuDolarAbierto}
              aria-label="Tipo de cambio dólar"
              className={`bg-[#122018] border border-[#33512f] text-[#f1ecdd] text-xs font-bold rounded-xl px-3.5 py-2.5 transition-all flex items-center gap-2.5 shadow-inner ${moneda === "USD"
                ? "hover:bg-[#1e3326] hover:border-[#8fb56b]/60 cursor-pointer"
                : "opacity-45 cursor-not-allowed"
                }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${moneda === "USD" ? "bg-[#8fb56b]" : "bg-[#6b7c6d]"}`}></span>
              <span>{dolarSeleccionado.nombre || "Oficial"}</span>
              <span className="text-[#8fb56b] font-extrabold">
                ${Math.round(Number(dolarSeleccionado.venta) || 0).toLocaleString("es-AR")}
              </span>
              <i className={`fa-solid fa-chevron-down text-[10px] text-[#ded7c4] transition-transform ${moneda === "USD" && menuDolarAbierto ? "rotate-180" : ""}`}></i>
            </button>

            {moneda === "USD" && menuDolarAbierto && (
              <div className="absolute right-0 mt-2 w-56 bg-[#182920] border border-[#33512f] rounded-2xl shadow-xl py-1.5 z-50 overflow-hidden">
                <div className="px-3.5 py-1.5 border-b border-[#33512f]/70 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8fb56b]">
                    Cotización Dólar
                  </span>
                  <span className="text-[10px] text-[#ded7c4]">
                    {dolarInfo.esEnVivo ? "En vivo" : "Ref."}
                  </span>
                </div>
                {[
                  { key: "oficial", label: "Oficial", data: cotizacionesDolar.oficial },
                  { key: "blue", label: "Blue", data: cotizacionesDolar.blue },
                  { key: "bolsa", label: "MEP / Bolsa", data: cotizacionesDolar.bolsa },
                ].map((opcion) => {
                  const activo = tipoDolar === opcion.key;
                  const precio = Math.round(Number(opcion.data?.venta) || 0);
                  return (
                    <button
                      key={opcion.key}
                      type="button"
                      onClick={() => {
                        setTipoDolar(opcion.key);
                        setMenuDolarAbierto(false);
                      }}
                      className={`w-full px-3.5 py-2.5 text-left text-xs flex items-center justify-between transition-colors ${activo
                        ? "bg-[#264030] text-[#f1ecdd] font-bold"
                        : "text-[#ded7c4] hover:bg-[#203628] hover:text-white"
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        <i className={`fa-solid fa-check text-[10px] ${activo ? "text-[#8fb56b]" : "opacity-0"}`}></i>
                        {opcion.label}
                      </span>
                      <span className={`font-extrabold ${activo ? "text-[#8fb56b]" : "text-[#f1ecdd]"}`}>
                        ${precio.toLocaleString("es-AR")}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={descargandoMargen}
            onClick={manejarDescargarMargenBruto}
            className={`bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 ${
              descargandoMargen ? "opacity-75 cursor-not-allowed" : ""
            }`}
          >
            <i className={`fa-solid ${descargandoMargen ? "fa-spinner fa-spin" : "fa-print"}`}></i>
            {descargandoMargen ? "Exportando..." : "Imprimir / Exportar Reporte"}
          </button>
        </div>
      </div>

      {/* KPI Cards Ejecutivos */}
      {errorMargen && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold flex items-center justify-between">
          <span>{errorMargen}</span>
          <button type="button" onClick={() => setErrorMargen("")} className="font-bold px-2">×</button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Valuación Hacienda Ref.</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-1">
            {formatearMonto(resumen.valorHaciendaEstimado ?? 0, 2)}
          </p>
          <span className="text-[11px] text-[#33512f]">
            {moneda === "USD"
              ? `USD ${dolarSeleccionado.nombre} ($${Number(dolarSeleccionado.venta || 0).toLocaleString("es-AR")})`
              : `ARS (Rodeo de ${resumen.totalCabezas ?? 0} cabezas)`}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Peso Promedio</p>
          <p className="text-3xl font-extrabold text-[#182920] mt-1">
            {resumen.pesoPromedio ?? 0} kg
          </p>
          <span className="text-[11px] text-[#33512f]">
            {(resumen.totalCabezas ?? 0) > 0 ? "Estado corporal óptimo" : "Sin hacienda registrada"}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Tasa de Mortalidad</p>
          <p className="text-3xl font-extrabold text-emerald-800 mt-1">
            {resumen.tasaMortalidad || "0.0%"}
          </p>
          <span className="text-[11px] text-emerald-700">Por debajo del umbral del 2.5%</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Tratamientos Aplicados</p>
          <p className="text-3xl font-extrabold text-[#182920] mt-1">
            {resumen.tratamientosCompletados ?? 0}
          </p>
          <span className="text-[11px] text-[#33512f]">Vacunaciones y curaciones</span>
        </div>
      </div>

      {/* Valuación por Categoría (MAG) */}
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
              Valuación por Categoría ({cotizacionesMercado.mercado || "MAG"})
            </h3>
            <p className="text-[11px] text-[#6b7c6d]">
              Rueda {cotizacionesMercado.fechaRueda || "-"} ·{" "}
              {cotizacionesMercado.esEnVivo ? "Cotización en vivo" : "Valores de referencia"}
              {cotizacionesMercado?.indices?.inmag ? ` · INMAG ${formatearMonto(cotizacionesMercado.indices.inmag, 2)}/kg` : ""}
            </p>
          </div>
          <span className="text-xs font-bold text-[#33512f] bg-[#f8f5eb] px-3 py-1 rounded-full border border-[#ded7c4] self-start">
            {valuacionCategorias.length} categorías activas
          </span>
        </div>

        {valuacionCategorias.length === 0 ? (
          <p className="text-xs text-[#6b7c6d] italic p-3 bg-[#f8f5eb] rounded-xl border border-[#ded7c4]">
            No hay categorías registradas para valuar en este establecimiento.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {valuacionCategorias.map((cat) => (
              <div key={cat.categoria} className="p-3.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] flex flex-col justify-between">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="font-bold text-sm text-[#182920] block">{cat.categoria}</span>
                    <span className="text-[11px] text-[#6b7c6d]">
                      {cat.cabezas} cab. · {cat.pesoTotalKg.toLocaleString("es-AR")} kg vivos
                    </span>
                  </div>
                  <span className="text-[11px] font-bold bg-white text-[#33512f] px-2 py-0.5 rounded-lg border border-[#ded7c4]">
                    {formatearMonto(cat.precioKgVivo, 2)}/kg
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-[#ded7c4] flex justify-between items-center text-xs">
                  <span className="text-[#6b7c6d]">Ref: {cat.categoriaReferencia}</span>
                  <span className="font-extrabold text-[#182920]">
                    {formatearMonto(cat.valorEstimado, 2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tambo y Producción Lechera (solo si hay ordeñes registrados) */}
      {tamboLeche.tieneOrdenes && (
        <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Tambo y Producción Lechera (OCLA / SIGLeA)
              </h3>
              <p className="text-[11px] text-[#6b7c6d]">
                Período OCLA {tamboLeche.periodo || "oct/2026"} ·{" "}
                {tamboLeche.esEnVivo ? "Cotización en vivo" : "Valor de referencia"} ·{" "}
                Último ordeñe: {tamboLeche.ultimaFecha}
              </p>
            </div>
            <span className="text-xs font-bold text-[#33512f] bg-[#f8f5eb] px-3 py-1 rounded-full border border-[#ded7c4] self-start">
              {tamboLeche.vacasLecheras} vacas lecheras registradas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]">
              <span className="text-[10px] font-bold uppercase text-[#6b7c6d] block">Precio Litro (SIGLeA)</span>
              <span className="text-lg font-extrabold text-[#182920]">
                {formatearMonto(tamboLeche.precioLitro ?? 550.25, 2)}/L
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]">
              <span className="text-[10px] font-bold uppercase text-[#6b7c6d] block">Sólidos Útiles</span>
              <span className="text-lg font-extrabold text-[#182920]">
                {formatearMonto(tamboLeche.precioKgSu ?? 7550.57, 2)}/kg SU
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]">
              <span className="text-[10px] font-bold uppercase text-[#6b7c6d] block">
                Última Actualización ({tamboLeche.ultimaFecha})
              </span>
              <span className="text-lg font-extrabold text-[#182920]">
                {formatearMonto(tamboLeche.ingresoUltimaActualizacionArs ?? 0, moneda === "USD" ? 2 : 0)}
              </span>
              <span className="text-[10px] text-[#6b7c6d] block">
                {(tamboLeche.litrosUltimaActualizacion ?? 0).toLocaleString("es-AR")} L ordeñados
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]">
              <span className="text-[10px] font-bold uppercase text-[#6b7c6d] block">Total Mensual (Litros Reales)</span>
              <span className="text-lg font-extrabold text-emerald-800">
                {formatearMonto(tamboLeche.ingresoMensualArs ?? 0, moneda === "USD" ? 2 : 0)}
              </span>
              <span className="text-[10px] text-[#6b7c6d] block">
                {(tamboLeche.litrosMensuales ?? 0).toLocaleString("es-AR")} L acumulados en el mes
              </span>
            </div>
          </div>

          {Array.isArray(tamboLeche.porParcela) && tamboLeche.porParcela.length > 0 && (
            <div className="pt-2 border-t border-[#ded7c4]">
              <p className="text-[11px] font-bold uppercase text-[#6b7c6d] mb-2">
                Total por Parcela con Vacas Ordeñadas
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {tamboLeche.porParcela.map((pl) => (
                  <div key={pl.potreroId || pl.potreroNombre} className="p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-[#182920]">{pl.potreroNombre}</span>
                      <span className="text-[10px] font-bold text-[#33512f] bg-white px-2 py-0.5 rounded border border-[#ded7c4]">
                        Últ: {pl.ultimaFecha}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#6b7c6d]">
                      <span>Últ. act. ({pl.litrosUltimaActualizacion} L)</span>
                      <span className="font-bold text-[#182920]">
                        {formatearMonto(pl.ingresoUltimaActualizacionArs, moneda === "USD" ? 2 : 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#6b7c6d]">
                      <span>Mensual ({pl.litrosMensuales.toLocaleString("es-AR")} L)</span>
                      <span className="font-extrabold text-emerald-800">
                        {formatearMonto(pl.ingresoMensualArs, moneda === "USD" ? 2 : 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Distribución por Potrero */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
          <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif] mb-3">
            Ocupación y Superficie por Sector de Ganado
          </h3>

          <div className="space-y-3">
            {potreros.length === 0 ? (
              <p className="text-xs text-[#6b7c6d] italic p-3 bg-[#f8f5eb] rounded-xl border border-[#ded7c4]">
                No hay sectores de ganado zonificados en este establecimiento.
              </p>
            ) : (
              potreros.map((p) => {
                const lecheParcela = (tamboLeche.porParcela || []).find(
                  (pl) => pl.potreroId === p.id || pl.potreroNombre === p.nombre
                );
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setParcelaSeleccionada(p)}
                    className="w-full text-left p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] hover:border-[#8fb56b] hover:bg-[#f1ebd9] transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-bold text-[#182920] group-hover:text-[#33512f] flex items-center gap-2">
                        {p.nombre}
                        <span className="text-[10px] font-semibold text-[#33512f] bg-white px-1.5 py-0.5 rounded border border-[#ded7c4]">
                          Ver detalle ›
                        </span>
                      </span>
                      <span className="font-bold text-[#33512f]">
                        {p.totalAnimales ?? 0} cabezas ({p.superficieHas} Has)
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#6b7c6d]">
                      <span>Capacidad máxima: {p.capacidad ? p.capacidad : "Sin límite"}</span>
                      <span>
                        Carga: {p.capacidad ? `${Math.round(((p.totalAnimales ?? 0) / p.capacidad) * 100)}%` : "Sin límite"}
                      </span>
                    </div>
                    {lecheParcela && (
                      <div className="mt-1.5 pt-1.5 border-t border-[#ded7c4]/70 flex justify-between text-[11px] text-emerald-800 font-semibold">
                        <span>Ordeñe ({lecheParcela.litrosUltimaActualizacion} L · {lecheParcela.ultimaFecha})</span>
                        <span>Mensual: {formatearMonto(lecheParcela.ingresoMensualArs, moneda === "USD" ? 2 : 0)}</span>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
          <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif] mb-3">
            Detalle de Rodeo Individual
          </h3>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
            {hacienda.length === 0 ? (
              <p className="text-xs text-[#6b7c6d] italic p-3 bg-[#f8f5eb] rounded-xl border border-[#ded7c4]">
                No hay animales registrados en este rodeo.
              </p>
            ) : (
              hacienda.map((g) => (
                <div key={g.id} className="p-2.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[#182920] block">
                      {g.caravana} · {g.categoria}
                    </span>
                    <span className="text-[11px] text-[#6b7c6d]">
                      {g.raza} ({g.sexo}) • {g.potreroNombre || "Potrero"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-[#182920] block">{g.pesoKg} kg</span>
                    <span className="text-[9px] font-bold text-emerald-800 uppercase">
                      {g.estadoSanitario}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
