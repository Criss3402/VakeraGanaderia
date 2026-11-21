import { useState, useEffect, useRef } from "react";
import { obtenerReportes, obtenerDolar } from "../../../api/dashboard.api";
import { useAuth } from "../../../context/AuthContext";
import ParcelaDetalleView from "./ParcelaDetalleView";

const DOLAR_FALLBACK = {
  oficial: { nombre: "Oficial", venta: 1600 },
  blue: { nombre: "Blue", venta: 1675 },
  bolsa: { nombre: "MEP / Bolsa", venta: 1743.1 },
};

export default function ReportesView() {
  const { rol } = useAuth();
  const [datos, setDatos] = useState(null);
  const [dolarExtra, setDolarExtra] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [moneda, setMoneda] = useState("ARS");
  const [tipoDolar, setTipoDolar] = useState("oficial");
  const [menuDolarAbierto, setMenuDolarAbierto] = useState(false);
  const [parcelaSeleccionada, setParcelaSeleccionada] = useState(null);
  const menuDolarRef = useRef(null);

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
      <ParcelaDetalleView
        parcela={parcelaSeleccionada}
        hacienda={hacienda}
        cotizacionesMercado={cotizacionesMercado}
        dolarInfo={dolarInfo}
        moneda={moneda}
        tipoDolar={tipoDolar}
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
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              Módulo de Reportes & Trazabilidad
            </span>
            <span className="text-xs text-[#8fb56b]">Auditoría Contable y Ganadera</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Balance General del Establecimiento
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-xl">
            Consolidado patrimonial, valuación a precio de mercado vivo, rendimiento por potrero y tasa de sanidad.
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
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                moneda === "ARS"
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
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                moneda === "USD"
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
              className={`bg-[#122018] border border-[#33512f] text-[#f1ecdd] text-xs font-bold rounded-xl px-3.5 py-2.5 transition-all flex items-center gap-2.5 shadow-inner ${
                moneda === "USD"
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
                      className={`w-full px-3.5 py-2.5 text-left text-xs flex items-center justify-between transition-colors ${
                        activo
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
            onClick={() => window.print()}
            className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <i className="fa-solid fa-print"></i> Imprimir / Exportar Reporte
          </button>
        </div>
      </div>

      {/* KPI Cards Ejecutivos */}
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

      {/* Distribución por Potrero */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
          <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif] mb-3">
            Ocupación y Superficie por Potrero
          </h3>

          <div className="space-y-3">
            {potreros.length === 0 ? (
              <p className="text-xs text-[#6b7c6d] italic p-3 bg-[#f8f5eb] rounded-xl border border-[#ded7c4]">
                No hay potreros zonificados en este establecimiento.
              </p>
            ) : (
              potreros.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setParcelaSeleccionada(p)}
                  className="w-full text-left p-3 rounded-xl bg-[#f8f5eb] hover:bg-[#efead9] border border-[#ded7c4] hover:border-[#8fb56b] transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-bold text-[#182920] group-hover:text-[#33512f] flex items-center gap-1.5">
                      {p.nombre}
                      <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-[#8fb56b] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </span>
                    <span className="font-bold text-[#33512f]">
                      {p.totalAnimales ?? 0} cabezas ({p.superficieHas} Has)
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#6b7c6d]">
                    <span>Capacidad máxima: {p.capacidad}</span>
                    <span>Carga: {Math.round(((p.totalAnimales ?? 0) / (p.capacidad || 100)) * 100)}%</span>
                  </div>
                </button>
              ))
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
