import { useMemo } from "react";

export default function ParcelaDetalleView({
  parcela,
  hacienda = [],
  cotizacionesMercado = {},
  dolarInfo = {},
  moneda = "ARS",
  tipoDolar = "oficial",
  alVolver,
}) {
  const animalesParcela = useMemo(() => {
    if (!parcela) return [];
    return hacienda.filter(
      (g) =>
        (parcela.id && g.potreroId === parcela.id) ||
        (parcela.nombre && g.potreroNombre === parcela.nombre)
    );
  }, [parcela, hacienda]);

  const cotizacionesDolar = dolarInfo?.cotizaciones || {};
  const dolarSeleccionado = cotizacionesDolar[tipoDolar] || cotizacionesDolar.oficial || { venta: 1600, nombre: "Oficial" };
  const tasaCambio = moneda === "USD" ? (Number(dolarSeleccionado.venta) || 1) : 1;

  const formatearMonto = (montoArs, decimalesUsd = 0) => {
    const val = Number(montoArs) || 0;
    const convertido = moneda === "USD" ? val / tasaCambio : val;
    if (moneda === "USD") {
      return `US$ ${convertido.toLocaleString("es-AR", {
        minimumFractionDigits: decimalesUsd,
        maximumFractionDigits: decimalesUsd,
      })}`;
    }
    return `$${Math.round(convertido).toLocaleString("es-AR")}`;
  };

  const resolverPrecioCategoria = (categoriaNombre) => {
    const cats = cotizacionesMercado?.categorias || {};
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
    return Math.round(
      cotizacionesMercado?.indices?.inmag ||
        cotizacionesMercado?.indices?.promedioGeneralMag ||
        3476
    );
  };

  const metricas = useMemo(() => {
    const cabezas = animalesParcela.length;
    const pesoTotalKg = animalesParcela.reduce((acc, a) => acc + (Number(a.pesoKg) || 0), 0);
    const pesoPromedioKg = cabezas > 0 ? Math.round(pesoTotalKg / cabezas) : 0;

    const porCategoriaMap = new Map();
    let valorTotalArs = 0;

    for (const animal of animalesParcela) {
      const cat = animal.categoria || "Sin categoría";
      const peso = Number(animal.pesoKg) || 0;
      const precioKg = resolverPrecioCategoria(cat);
      const valor = Math.round(peso * precioKg);
      valorTotalArs += valor;

      const actual = porCategoriaMap.get(cat) || {
        categoria: cat,
        cabezas: 0,
        pesoTotalKg: 0,
        precioKgVivo: precioKg,
        valorEstimado: 0,
      };
      actual.cabezas += 1;
      actual.pesoTotalKg += peso;
      actual.valorEstimado += valor;
      porCategoriaMap.set(cat, actual);
    }

    const capacidad = parcela?.capacidad || 100;
    const porcentajeCarga = Math.round((cabezas / capacidad) * 100);

    return {
      cabezas,
      pesoTotalKg: Math.round(pesoTotalKg),
      pesoPromedioKg,
      valorTotalArs,
      porcentajeCarga,
      categorias: Array.from(porCategoriaMap.values()),
    };
  }, [animalesParcela, parcela, cotizacionesMercado]);

  if (!parcela) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm space-y-4">
        <p className="text-sm text-[#6b7c6d]">No se seleccionó ninguna parcela.</p>
        <button
          type="button"
          onClick={alVolver}
          className="bg-[#182920] text-[#f1ecdd] text-xs font-bold px-4 py-2 rounded-xl"
        >
          ← Volver al Balance General
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de Parcela */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={alVolver}
              className="bg-[#233a2d] hover:bg-[#2d4a3a] text-[#8fb56b] text-xs font-bold px-3 py-1 rounded-full border border-[#33512f] transition-all flex items-center gap-1.5"
            >
              <i className="fa-solid fa-arrow-left"></i> Volver al Balance General
            </button>
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              Detalle de Sector / Parcela
            </span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            {parcela.nombre}
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1">
            Superficie: {parcela.superficieHas ?? 0} Has · Capacidad máxima: {parcela.capacidad ?? 0} cabezas · Ocupación actual: {metricas.porcentajeCarga}%
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2"
        >
          <i className="fa-solid fa-print"></i> Imprimir Ficha de Parcela
        </button>
      </div>

      {/* KPIs de la Parcela */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Valuación del Sector</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-1">
            {formatearMonto(metricas.valorTotalArs, 2)}
          </p>
          <span className="text-[11px] text-[#33512f]">
            {moneda === "USD" ? `USD ${dolarSeleccionado.nombre}` : "ARS (Valor mercado MAG)"}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Cabezas en Parcela</p>
          <p className="text-3xl font-extrabold text-[#182920] mt-1">
            {metricas.cabezas} <span className="text-base font-bold text-[#6b7c6d]">/ {parcela.capacidad ?? 0}</span>
          </p>
          <span className="text-[11px] text-[#33512f]">Carga: {metricas.porcentajeCarga}%</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Peso Total / Promedio</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-1">
            {metricas.pesoTotalKg.toLocaleString("es-AR")} kg
          </p>
          <span className="text-[11px] text-[#33512f]">Promedio: {metricas.pesoPromedioKg} kg/cab.</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Superficie</p>
          <p className="text-3xl font-extrabold text-[#182920] mt-1">
            {parcela.superficieHas ?? 0} Has
          </p>
          <span className="text-[11px] text-[#33512f]">
            {parcela.superficieHas > 0
              ? `${(metricas.cabezas / parcela.superficieHas).toFixed(2)} cab/Ha`
              : "Sin superficie asignada"}
          </span>
        </div>
      </div>

      {/* Desglose por Categoría dentro de la Parcela */}
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
        <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif] mb-3">
          Categorías en {parcela.nombre}
        </h3>
        {metricas.categorias.length === 0 ? (
          <p className="text-xs text-[#6b7c6d] italic p-3 bg-[#f8f5eb] rounded-xl border border-[#ded7c4]">
            Esta parcela no tiene animales asignados actualmente.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {metricas.categorias.map((cat) => (
              <div key={cat.categoria} className="p-3.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]">
                <div className="flex justify-between items-start gap-2">
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
                <div className="mt-2 pt-2 border-t border-[#ded7c4] flex justify-between items-center text-xs">
                  <span className="text-[#6b7c6d]">Subtotal</span>
                  <span className="font-extrabold text-[#182920]">
                    {formatearMonto(cat.valorEstimado, 2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rodeo Individual de la Parcela */}
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
        <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif] mb-3">
          Animales Registrados en {parcela.nombre} ({animalesParcela.length})
        </h3>
        {animalesParcela.length === 0 ? (
          <p className="text-xs text-[#6b7c6d] italic p-3 bg-[#f8f5eb] rounded-xl border border-[#ded7c4]">
            No hay animales registrados en esta parcela.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {animalesParcela.map((g) => (
              <div
                key={g.id}
                className="p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] flex justify-between items-center"
              >
                <div>
                  <span className="font-bold text-[#182920] block">
                    {g.caravana} · {g.categoria}
                  </span>
                  <span className="text-[11px] text-[#6b7c6d]">
                    {g.raza} ({g.sexo})
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-[#182920] block">{g.pesoKg} kg</span>
                  <span className="text-[9px] font-bold text-emerald-800 uppercase">
                    {g.estadoSanitario}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
