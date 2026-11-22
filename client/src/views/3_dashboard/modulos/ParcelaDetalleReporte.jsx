import { useState, useMemo } from "react";

function resolverPrecioCategoriaLocal(categoriaNombre, cotizacionesCategorias, inmagFallback) {
  const cats = cotizacionesCategorias || {};
  const norm = String(categoriaNombre || "").trim().toLowerCase();

  let clave = null;
  if (norm.includes("novillito")) clave = "NOVILLITOS";
  else if (norm.includes("novillo")) clave = "NOVILLOS";
  else if (norm.includes("vaquill")) clave = "VAQUILLONAS";
  else if (norm.includes("terner")) clave = "TERNEROS_CORRIENTES";
  else if (norm.includes("vaca")) clave = "VACAS";
  else if (norm.includes("toro")) clave = "TOROS";
  else if (norm.includes("mej")) clave = "MEJ";

  if (clave && cats[clave]?.precioPromedioKg) {
    return cats[clave].precioPromedioKg;
  }
  return Math.round(Number(inmagFallback) || 3476);
}

export default function ParcelaDetalleReporte({
  parcela,
  hacienda = [],
  cotizacionesMercado = {},
  tamboLeche = {},
  moneda = "ARS",
  setMoneda,
  tipoDolar = "oficial",
  setTipoDolar,
  cotizacionesDolar = {},
  dolarSeleccionado = {},
  formatearMonto,
  alVolver,
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("TODAS");

  const animalesParcela = useMemo(() => {
    return hacienda.filter((g) => {
      if (parcela?.id && g.potreroId) {
        return g.potreroId === parcela.id;
      }
      return (g.potreroNombre || "").toLowerCase() === (parcela?.nombre || "").toLowerCase();
    });
  }, [hacienda, parcela]);

  const inmag = cotizacionesMercado?.indices?.inmag || cotizacionesMercado?.indices?.promedioGeneralMag || 3476;
  const categoriasCot = cotizacionesMercado?.categorias || {};

  const animalesConValor = useMemo(() => {
    return animalesParcela.map((g) => {
      const peso = Number(g.pesoKg) || 0;
      const precioKg = resolverPrecioCategoriaLocal(g.categoria, categoriasCot, inmag);
      return {
        ...g,
        pesoKgNum: peso,
        precioKgVivo: precioKg,
        valorEstimadoArs: Math.round(peso * precioKg),
      };
    });
  }, [animalesParcela, categoriasCot, inmag]);

  const categoriasUnicas = useMemo(() => {
    const set = new Set(animalesConValor.map((a) => a.categoria || "Sin categoría"));
    return ["TODAS", ...Array.from(set)];
  }, [animalesConValor]);

  const animalesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return animalesConValor.filter((a) => {
      const coincideCat =
        filtroCategoria === "TODAS" || (a.categoria || "Sin categoría") === filtroCategoria;
      const coincideBusq =
        !q ||
        (a.caravana || "").toLowerCase().includes(q) ||
        (a.raza || "").toLowerCase().includes(q) ||
        (a.categoria || "").toLowerCase().includes(q);
      return coincideCat && coincideBusq;
    });
  }, [animalesConValor, busqueda, filtroCategoria]);

  const resumenPorCategoria = useMemo(() => {
    const mapa = new Map();
    for (const a of animalesConValor) {
      const cat = a.categoria || "Sin categoría";
      const actual = mapa.get(cat) || {
        categoria: cat,
        cabezas: 0,
        pesoTotalKg: 0,
        precioKgVivo: a.precioKgVivo,
        valorEstimadoArs: 0,
      };
      actual.cabezas += 1;
      actual.pesoTotalKg += a.pesoKgNum;
      actual.valorEstimadoArs += a.valorEstimadoArs;
      mapa.set(cat, actual);
    }
    return Array.from(mapa.values());
  }, [animalesConValor]);

  const totalCabezas = animalesConValor.length;
  const pesoTotalKg = animalesConValor.reduce((acc, a) => acc + a.pesoKgNum, 0);
  const pesoPromedio = totalCabezas > 0 ? Math.round(pesoTotalKg / totalCabezas) : 0;
  const valorTotalArs = animalesConValor.reduce((acc, a) => acc + a.valorEstimadoArs, 0);
  const saludables = animalesConValor.filter(
    (a) => (a.estadoSanitario || "").toUpperCase() === "SALUDABLE"
  ).length;
  const capacidad = Number(parcela?.capacidad) || 0;
  const porcentajeCarga = capacidad > 0 ? Math.round((totalCabezas / capacidad) * 100) : 0;
  const superficie = Number(parcela?.superficieHas) || 0;
  const densidad = superficie > 0 ? (totalCabezas / superficie).toFixed(2) : "0.00";

  return (
    <div className="space-y-6">
      {/* Banner de Parcela con flecha atrás al costado */}
      <div className="flex items-stretch gap-3">
        <button
          type="button"
          onClick={alVolver}
          title="Volver al Balance General"
          aria-label="Volver al Balance General"
          className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] rounded-2xl px-4 flex items-center justify-center shadow-sm transition-all shrink-0"
        >
          <i className="fa-solid fa-arrow-left text-lg"></i>
        </button>

        <div className="flex-1 bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs text-[#ded7c4]">
                {superficie} Has · {capacidad ? `Capacidad máx. ${capacidad} cab.` : "Sin límite de cabezas"}
              </span>
            </div>
            <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
              Sector: {parcela?.nombre || "Parcela"}
            </h2>
            <p className="text-xs text-[#ded7c4] mt-1">
              Inventario completo, carga animal, valuación por categoría y trazabilidad individual del rodeo en este potrero.
            </p>
          </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-[#122018] border border-[#33512f] rounded-xl p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setMoneda("ARS")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${moneda === "ARS" ? "bg-[#8fb56b] text-[#182920] shadow-sm" : "text-[#ded7c4] hover:text-white"
                }`}
            >
              ARS $
            </button>
            <button
              type="button"
              onClick={() => setMoneda("USD")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${moneda === "USD" ? "bg-[#8fb56b] text-[#182920] shadow-sm" : "text-[#ded7c4] hover:text-white"
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
            className={`bg-[#122018] border border-[#33512f] text-[#f1ecdd] text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none ${moneda === "USD" ? "cursor-pointer" : "opacity-45 cursor-not-allowed"
              }`}
          >
            <option value="oficial">Oficial (${Math.round(cotizacionesDolar.oficial?.venta || 1600).toLocaleString("es-AR")})</option>
            <option value="blue">Blue (${Math.round(cotizacionesDolar.blue?.venta || 1675).toLocaleString("es-AR")})</option>
            <option value="bolsa">MEP (${Math.round(cotizacionesDolar.bolsa?.venta || 1743).toLocaleString("es-AR")})</option>
          </select>

          <button
            type="button"
            onClick={() => window.print()}
            className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <i className="fa-solid fa-print"></i> Imprimir
          </button>
        </div>
        </div>
      </div>

      {/* KPIs de la Parcela */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Valuación del Sector</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-1">
            {formatearMonto(valorTotalArs, 2)}
          </p>
          <span className="text-[11px] text-[#33512f]">
            {moneda === "USD"
              ? `USD ${dolarSeleccionado.nombre || "Oficial"}`
              : `${totalCabezas} cabezas valuadas`}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Ocupación y Carga</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-1">
            {capacidad ? `${totalCabezas} / ${capacidad} cab.` : `${totalCabezas} cab.`}
          </p>
          <span className="text-[11px] text-[#33512f]">
            {capacidad ? `Carga: ${porcentajeCarga}%` : "Sin límite"} · {densidad} cab/Ha
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Peso Total / Promedio</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-1">
            {Math.round(pesoTotalKg).toLocaleString("es-AR")} kg
          </p>
          <span className="text-[11px] text-[#33512f]">
            Promedio: {pesoPromedio} kg por animal
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Estado Sanitario</p>
          <p className="text-2xl font-extrabold text-emerald-800 mt-1">
            {saludables} / {totalCabezas}
          </p>
          <span className="text-[11px] text-emerald-700">
            {totalCabezas > 0 ? `${Math.round((saludables / totalCabezas) * 100)}% saludables` : "Sin animales"}
          </span>
        </div>
      </div>

      {/* Producción Lechera de la Parcela (solo si hubo ordeñes reales) */}
      {(() => {
        const parcelaLeche = (tamboLeche.porParcela || []).find(
          (pl) => pl.potreroId === parcela?.id || pl.potreroNombre === parcela?.nombre
        );
        if (!parcelaLeche) return null;
        const precioLitro = Number(tamboLeche.precioLitro) || 550.25;

        return (
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                  Producción Lechera en {parcela?.nombre} (OCLA / SIGLeA)
                </h3>
                <p className="text-[11px] text-[#6b7c6d]">
                  Calculado en base a litros sacados reales · Último ordeñe: {parcelaLeche.ultimaFecha}
                </p>
              </div>
              <span className="text-xs font-bold text-[#33512f] bg-[#f8f5eb] px-3 py-1 rounded-full border border-[#ded7c4]">
                Precio OCLA: {formatearMonto(precioLitro, 2)}/L
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]">
                <span className="text-[10px] font-bold uppercase text-[#6b7c6d] block">Precio Litro</span>
                <span className="text-lg font-extrabold text-[#182920]">
                  {formatearMonto(precioLitro, 2)} / L
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]">
                <span className="text-[10px] font-bold uppercase text-[#6b7c6d] block">
                  Última Actualización ({parcelaLeche.ultimaFecha})
                </span>
                <span className="text-lg font-extrabold text-[#182920]">
                  {formatearMonto(parcelaLeche.ingresoUltimaActualizacionArs, moneda === "USD" ? 2 : 0)}
                </span>
                <span className="text-[10px] text-[#6b7c6d] block">
                  {parcelaLeche.litrosUltimaActualizacion} L sacados
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]">
                <span className="text-[10px] font-bold uppercase text-[#6b7c6d] block">Total Mensual (Litros Reales)</span>
                <span className="text-lg font-extrabold text-emerald-800">
                  {formatearMonto(parcelaLeche.ingresoMensualArs, moneda === "USD" ? 2 : 0)}
                </span>
                <span className="text-[10px] text-[#6b7c6d] block">
                  {parcelaLeche.litrosMensuales.toLocaleString("es-AR")} L acumulados en el mes
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Resumen por Categoría en esta Parcela */}
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
        <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif] mb-3">
          Desglose por Categoría en {parcela?.nombre}
        </h3>
        {resumenPorCategoria.length === 0 ? (
          <p className="text-xs text-[#6b7c6d] italic p-3 bg-[#f8f5eb] rounded-xl border border-[#ded7c4]">
            Esta parcela no tiene hacienda asignada actualmente.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {resumenPorCategoria.map((cat) => (
              <div key={cat.categoria} className="p-3.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-sm text-[#182920] block">{cat.categoria}</span>
                    <span className="text-[11px] text-[#6b7c6d]">
                      {cat.cabezas} cab. · {Math.round(cat.pesoTotalKg).toLocaleString("es-AR")} kg
                    </span>
                  </div>
                  <span className="text-[11px] font-bold bg-white text-[#33512f] px-2 py-0.5 rounded-lg border border-[#ded7c4]">
                    {formatearMonto(cat.precioKgVivo, 2)}/kg
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-[#ded7c4] flex justify-between text-xs">
                  <span className="text-[#6b7c6d]">Subtotal</span>
                  <span className="font-extrabold text-[#182920]">
                    {formatearMonto(cat.valorEstimadoArs, 2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Listado Completo del Rodeo de la Parcela */}
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
            Animales en {parcela?.nombre} ({animalesFiltrados.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar caravana o raza..."
              className="text-xs px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920] focus:outline-none"
            />
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920] font-semibold focus:outline-none"
            >
              {categoriasUnicas.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "TODAS" ? "Todas las categorías" : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {animalesFiltrados.length === 0 ? (
          <p className="text-xs text-[#6b7c6d] italic p-4 bg-[#f8f5eb] rounded-xl border border-[#ded7c4]">
            No hay animales que coincidan con el filtro en esta parcela.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#ded7c4] text-[11px] uppercase text-[#6b7c6d]">
                  <th className="py-2.5 px-3">Caravana</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3">Raza / Sexo</th>
                  <th className="py-2.5 px-3 text-right">Peso</th>
                  <th className="py-2.5 px-3 text-right">Valuación Est.</th>
                  <th className="py-2.5 px-3 text-right">Sanidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee8d8]">
                {animalesFiltrados.map((g) => (
                  <tr key={g.id} className="hover:bg-[#f8f5eb] transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[#182920]">{g.caravana}</td>
                    <td className="py-2.5 px-3 text-[#33512f] font-semibold">{g.categoria}</td>
                    <td className="py-2.5 px-3 text-[#6b7c6d]">
                      {g.raza} ({g.sexo})
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#182920]">
                      {g.pesoKgNum} kg
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-[#182920]">
                      {formatearMonto(g.valorEstimadoArs, 2)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {g.estadoSanitario}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

