import { useState, useEffect } from "react";
import {
  obtenerMetricas,
  obtenerReportes,
  obtenerPotreros,
  obtenerInsumosCriticos,
  obtenerPartesDiarios,
} from "../../../api/dashboard.api";
import { useAuth } from "../../../context/AuthContext";

const POTREROS_PREDETERMINADOS_EXCLUIDOS = new Set([
  "pot-1",
  "pot-2",
  "pot-3",
  "pot-4",
  "pot-5",
]);

export default function PanelDueno({ alCambiarVista }) {
  const { usuario } = useAuth();
  const [metricas, setMetricas] = useState(null);
  const [reportes, setReportes] = useState(null);
  const [potreros, setPotreros] = useState([]);
  const [insumosCriticos, setInsumosCriticos] = useState([]);
  const [partes, setPartes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const scope = usuario?.establecimientoId || usuario?.id;
    const storageKeyParcelas = scope ? `vakera_parcelas_cuenta_${scope}` : null;

    Promise.all([
      obtenerMetricas().catch(() => null),
      obtenerReportes().catch(() => null),
      obtenerPotreros().catch(() => null),
      obtenerInsumosCriticos().catch(() => null),
      obtenerPartesDiarios().catch(() => null),
    ]).then(([resMet, resRep, resPot, resIns, resPart]) => {
      if (resMet?.data) setMetricas(resMet.data);
      if (resRep?.data) setReportes(resRep.data);

      const listaApi = (Array.isArray(resPot?.data) ? resPot.data : []).filter(
        (p) => !POTREROS_PREDETERMINADOS_EXCLUIDOS.has(p?.id)
      );
      let listaLocal = [];
      if (storageKeyParcelas) {
        try {
          const raw = localStorage.getItem(storageKeyParcelas);
          const parsed = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) {
            listaLocal = parsed.filter(
              (p) => !POTREROS_PREDETERMINADOS_EXCLUIDOS.has(p?.id)
            );
          }
        } catch (err) {
          console.warn("No se pudieron leer parcelas locales en PanelDueno:", err);
        }
      }
      let renombres = {};
      try {
        const cuentaScope =
          usuario?.establecimientoId ||
          usuario?.id ||
          usuario?.email ||
          "default";
        const rawRen = localStorage.getItem(`vakera_parcelas_renombres_${cuentaScope}`);
        if (rawRen) renombres = JSON.parse(rawRen);
      } catch (err) {
        console.warn("Aviso al leer renombres en PanelDueno:", err);
      }

      const mapaCombinado = new Map();
      listaLocal.forEach((p) => {
        if (p?.id) mapaCombinado.set(p.id, p);
      });
      listaApi.forEach((p) => {
        if (p?.id) {
          const prev = mapaCombinado.get(p.id) || {};
          const nombreApiLimpio = (p.nombre || "").trim();
          const nombreRenombrado =
            renombres[p.id] ||
            renombres[nombreApiLimpio.toLowerCase()] ||
            prev.nombrePersonalizado ||
            p.nombre;
          mapaCombinado.set(p.id, { ...prev, ...p, nombre: nombreRenombrado });
        }
      });
      setPotreros(Array.from(mapaCombinado.values()));

      if (resIns?.data) setInsumosCriticos(resIns.data);
      if (resPart?.data) setPartes(resPart.data);
      setCargando(false);
    });
  }, [usuario?.establecimientoId, usuario?.id]);

  const totalCabezas = metricas?.resumenGanado?.totalCabezas ?? 0;
  const pesoPromedio = metricas?.resumenGanado?.pesoPromedioKg ?? 0;
  const valuacionHacienda = reportes?.resumenGeneral?.valorHaciendaEstimado ?? 0;
  const partesPendientes = partes.filter((p) => String(p.estado).toUpperCase() === "PENDIENTE").length;

  return (
    <div className="space-y-6">
      {/* Banner de Dirección Ejecutiva */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              Rol: Dueño / Dirección General
            </span>
            <span className="text-xs text-[#8fb56b]">Control Total & Auditoría Ejecutiva</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Tablero de Control Estratégico
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-xl">
            Supervisión integral de hacienda, valuación patrimonial, auditoría de partes de campo y administración del personal ganadero.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => alCambiarVista && alCambiarVista("permisos")}
            className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <i className="fa-solid fa-users-gear"></i> Administrar Roles (RBAC)
          </button>
          <button
            type="button"
            onClick={() => alCambiarVista && alCambiarVista("reportes")}
            className="bg-[#1f3729] hover:bg-[#284835] text-[#f1ecdd] border border-[#8fb56b]/40 font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <i className="fa-solid fa-file-invoice-dollar"></i> Reportes Contables
          </button>
        </div>
      </div>

      {/* Tarjetas Ejecutivas de Impacto Patrimonial */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm hover:border-[#33512f] transition-colors">
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Hacienda Total</p>
            <span className="text-xs text-[#33512f] font-bold bg-[#f8f5eb] px-2 py-0.5 rounded">Rodeo</span>
          </div>
          <p className="text-3xl font-extrabold text-[#182920] mt-1">{totalCabezas}</p>
          <span className="text-[11px] text-[#33512f] font-medium">
            Cabezas registradas en {potreros.length} {potreros.length === 1 ? "parcela" : "parcelas"}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm hover:border-[#6b4a32] transition-colors">
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Peso Promedio</p>
            <span className="text-xs text-[#6b4a32] font-bold bg-[#f8f5eb] px-2 py-0.5 rounded">Balanza</span>
          </div>
          <p className="text-3xl font-extrabold text-[#182920] mt-1">{pesoPromedio} kg</p>
          <span className="text-[11px] text-[#6b7c6d]">Ganancia diaria estimada: +750g</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm hover:border-emerald-600 transition-colors">
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Valuación Hacienda Ref.</p>
            <span className="text-xs text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded">ARS</span>
          </div>
          <p className="text-2xl font-extrabold text-emerald-900 mt-1">
            ${valuacionHacienda.toLocaleString("es-AR")}
          </p>
          <span className="text-[11px] text-emerald-700">Calculado a precio kg vivo promedio</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm hover:border-amber-500 transition-colors">
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Partes Pendientes</p>
            <span className="text-xs text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded">Operativa</span>
          </div>
          <p className="text-3xl font-extrabold text-[#182920] mt-1">{partesPendientes}</p>
          <span className="text-[11px] text-amber-800 font-medium">En espera de validación del capataz</span>
        </div>
      </div>

      {/* Grid: Visión Operativa por Actor & Potreros */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resumen de Módulos & Actores del Establecimiento */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
          <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif] mb-1">
            Estado de Operaciones por Rol y Actor
          </h3>
          <p className="text-xs text-[#6b7c6d] mb-4">
            Monitoreo en tiempo real de cada frente de trabajo en el campo:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Capataz */}
            <div
              onClick={() => alCambiarVista && alCambiarVista("partes")}
              className="p-4 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] hover:border-[#33512f] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#182920]">Supervisión Capataz</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded font-bold text-[#33512f] border border-[#ded7c4]">
                  Campo
                </span>
              </div>
              <p className="text-xs text-[#555] mb-2">
                Validación de partes de peones, control de hacienda y asignación de tareas.
              </p>
              <span className="text-xs font-bold text-[#33512f] group-hover:underline">
                {partes.length} partes cargados en total →
              </span>
            </div>

            {/* Veterinaria */}
            <div
              onClick={() => alCambiarVista && alCambiarVista("sanidad")}
              className="p-4 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] hover:border-[#33512f] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#182920]">Sanidad Veterinaria</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded font-bold text-[#33512f] border border-[#ded7c4]">
                  Clínica
                </span>
              </div>
              <p className="text-xs text-[#555] mb-2">
                Campañas de vacunación, tratamientos aplicados y botiquín de campo.
              </p>
              <span className="text-xs font-bold text-[#33512f] group-hover:underline">
                Plan oficial al día →
              </span>
            </div>

            {/* Oficina */}
            <div
              onClick={() => alCambiarVista && alCambiarVista("insumos")}
              className="p-4 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] hover:border-[#33512f] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#182920]">Oficina & Compras</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded font-bold text-[#33512f] border border-[#ded7c4]">
                  Administración
                </span>
              </div>
              <p className="text-xs text-[#555] mb-2">
                Facturas de insumos, compras de raciones y balance operativo.
              </p>
              <span className="text-xs font-bold text-[#33512f] group-hover:underline">
                {insumosCriticos.length} alertas de stock →
              </span>
            </div>

            {/* Peones */}
            <div
              onClick={() => alCambiarVista && alCambiarVista("ganado")}
              className="p-4 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] hover:border-[#33512f] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#182920]">Peones en Potreros</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded font-bold text-[#33512f] border border-[#ded7c4]">
                  Operario
                </span>
              </div>
              <p className="text-xs text-[#555] mb-2">
                Recorridas de potreros, reporte diario de nacimientos y estado de alambrados.
              </p>
              <span className="text-xs font-bold text-[#33512f] group-hover:underline">
                Ver estado de hacienda →
              </span>
            </div>
          </div>
        </div>

        {/* Distribución de Hacienda por Potrero */}
        <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#ded7c4]">
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Zonificación de Potreros
              </h3>
              <span className="text-xs font-bold text-[#33512f]">{potreros.length} Potreros</span>
            </div>

            <div className="space-y-2.5">
              {potreros.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] text-center space-y-2">
                  <p className="text-xs font-bold text-[#182920]">Sin parcelas delimitadas</p>
                  <p className="text-[11px] text-[#6b7c6d]">
                    Las parcelas trazadas en el mapa se sincronizan con las locaciones de campo e insumos.
                  </p>
                  <button
                    type="button"
                    onClick={() => alCambiarVista && alCambiarVista("parcelas")}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-draw-polygon"></i> Ir a Parcelas
                  </button>
                </div>
              ) : (
                potreros.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => alCambiarVista && alCambiarVista("parcelas")}
                    className="p-2.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] hover:border-[#33512f] cursor-pointer transition-colors flex justify-between items-center text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#182920]">{p.nombre}</p>
                      <p className="text-[10px] text-[#6b7c6d]">{p.superficieHas || 100} Has</p>
                    </div>
                    <span className="font-extrabold text-[#33512f]">
                      {p.totalAnimales ?? 0} cabezas
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => alCambiarVista && alCambiarVista("permisos")}
            className="w-full mt-4 bg-[#182920] hover:bg-[#284835] text-[#f1ecdd] font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <i className="fa-solid fa-shield-halved text-[#8fb56b]"></i> Administrar Nómina y Permisos
          </button>
        </div>
      </div>
    </div>
  );
}
