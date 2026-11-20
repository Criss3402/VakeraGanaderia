import { useState, useEffect } from "react";
import { obtenerReportes } from "../../../api/dashboard.api";
import { useAuth } from "../../../context/AuthContext";

export default function ReportesView() {
  const { rol } = useAuth();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerReportes()
      .then((res) => {
        if (res?.data) setDatos(res.data);
      })
      .catch((e) => console.error(e))
      .finally(() => setCargando(false));
  }, []);

  const resumen = datos?.resumenGeneral || {};
  const potreros = datos?.distribucionPotreros || [];
  const hacienda = datos?.haciendaDetalle || [];

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
            Consolidado patrimonial, valuación a precio de mercado vivo, rendimiento del ganado y tasa de sanidad.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
        >
          <i className="fa-solid fa-print"></i> Imprimir / Exportar Reporte
        </button>
      </div>

      {/* KPI Cards Ejecutivos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Valuación Hacienda Ref.</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-1">
            ${(resumen.valorHaciendaEstimado ?? 0).toLocaleString("es-AR")}
          </p>
          <span className="text-[11px] text-[#33512f]">ARS (Rodeo de {resumen.totalCabezas ?? 0} cabezas)</span>
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
              potreros.map((p) => (
                <div key={p.id} className="p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-bold text-[#182920]">{p.nombre}</span>
                    <span className="font-bold text-[#33512f]">
                      {p.totalAnimales ?? 0} cabezas ({p.superficieHas} Has)
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#6b7c6d]">
                    <span>Capacidad máxima: {p.capacidad}</span>
                    <span>Carga: {Math.round(((p.totalAnimales ?? 0) / (p.capacidad || 100)) * 100)}%</span>
                  </div>
                </div>
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
