import { useState, useEffect } from "react";
import {
  obtenerPartesDiarios,
  actualizarEstadoParte,
  obtenerPotreros,
  obtenerSanidad,
  obtenerInsumosCriticos,
  obtenerInsumos,
  obtenerSolicitudesInsumos,
} from "../../../api/dashboard.api";
import WidgetClima from "../modulos/WidgetClima";

export default function PanelCapataz({ alCambiarVista }) {
  const [partes, setPartes] = useState([]);
  const [potreros, setPotreros] = useState([]);
  const [sanidad, setSanidad] = useState([]);
  const [insumosCriticos, setInsumosCriticos] = useState([]);
  const [misHerramientas, setMisHerramientas] = useState([]);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [mensaje, setMensaje] = useState("");

  async function cargarDatos() {
    try {
      const [resPartes, resPotreros, resSanidad, resCrit, resTodos, resSol] = await Promise.all([
        obtenerPartesDiarios(),
        obtenerPotreros(),
        obtenerSanidad(),
        obtenerInsumosCriticos(),
        obtenerInsumos(),
        obtenerSolicitudesInsumos(),
      ]);
      if (resPartes?.data) setPartes(resPartes.data);
      if (resPotreros?.data) setPotreros(resPotreros.data);
      if (resSanidad?.data) setSanidad(resSanidad.data);
      if (resCrit?.data) setInsumosCriticos(resCrit.data);
      if (resTodos?.data) {
        setMisHerramientas(
          resTodos.data.filter(
            (i) =>
              i.ubicacion?.toLowerCase().includes("capataz") ||
              i.ubicacion?.toLowerCase().includes("taller")
          )
        );
      }
      if (resSol?.data) {
        setSolicitudesPendientes(resSol.data.filter((s) => s.estado === "Pendiente"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cambiarEstado(id, nuevoEstado) {
    setProcesandoId(id);
    try {
      await actualizarEstadoParte(id, nuevoEstado);
      setMensaje(`Parte marcado como ${nuevoEstado} exitosamente.`);
      await cargarDatos();
      setTimeout(() => setMensaje(""), 4000);
    } catch (err) {
      alert("Error al actualizar parte: " + err.message);
    } finally {
      setProcesandoId(null);
    }
  }

  const partesPendientes = partes.filter(
    (p) => String(p.estado).toUpperCase() === "PENDIENTE"
  );

  return (
    <div className="space-y-6">
      {/* Banner Capataz */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              Rol: Capataz
            </span>
            <span className="text-xs text-[#8fb56b]">Supervisión General de Campo</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Mesa de Control Operativo
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-xl">
            Revisión de novedades reportadas por peones, supervisión de ganado, enlace sanitario con la veterinaria y control de stock local.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#122019] px-4 py-2.5 rounded-xl border border-[#8fb56b]/30 text-center">
            <p className="text-[10px] text-gray-300 uppercase font-semibold">Partes Pendientes</p>
            <p className="text-xl font-extrabold text-amber-400 leading-none mt-0.5">
              {partesPendientes.length}
            </p>
          </div>
          <div className="bg-[#122019] px-4 py-2.5 rounded-xl border border-[#8fb56b]/30 text-center">
            <p className="text-[10px] text-gray-300 uppercase font-semibold">Sectores de Ganado</p>
            <p className="text-xl font-extrabold text-[#8fb56b] leading-none mt-0.5">
              {potreros.length}
            </p>
          </div>
        </div>
      </div>

      <WidgetClima />

      {mensaje && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm animate-fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600 text-lg"></i>
          <span>{mensaje}</span>
        </div>
      )}

      {/* Bandeja de Aprobación de Partes (Acción Crítica del Capataz) */}
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ded7c4]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center text-lg">
              <i className="fa-solid fa-stamp"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#182920] font-['Fraunces',serif]">
                Bandeja de Aprobación de Partes Diarios
              </h3>
              <p className="text-xs text-[#6b7c6d]">
                Valida las novedades enviadas desde el campo por los peones
              </p>
            </div>
          </div>
          <span className="text-xs font-bold bg-[#f8f5eb] text-[#182920] px-3 py-1 rounded-lg border border-[#ded7c4]">
            {partesPendientes.length} por validar
          </span>
        </div>

        {partesPendientes.length === 0 ? (
          <div className="text-center py-8 bg-[#f8f5eb] rounded-xl border border-dashed border-[#ded7c4]">
            <i className="fa-solid fa-check-double text-3xl text-emerald-600 mb-2"></i>
            <p className="text-sm font-bold text-[#182920]">¡Bandeja al día!</p>
            <p className="text-xs text-[#6b7c6d]">No hay partes diarios pendientes de aprobación en este momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {partesPendientes.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-[#f8f5eb] border border-amber-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#182920] bg-white px-2.5 py-0.5 rounded-md border border-[#ded7c4]">
                      📍 {p.potreroNombre || p.potrero || "Potrero"}
                    </span>
                    <span className="text-xs font-medium text-[#4a5c4e]">
                      👤 {p.peonNombre || "Peón"}
                    </span>
                    <span className="text-xs text-[#6b7c6d]">· 📅 {p.fecha}</span>
                    <span className="text-xs text-[#6b7c6d]">· {p.animalesRevisados} cabezas revisadas</span>
                  </div>
                  <p className="text-xs text-[#182920] font-medium leading-relaxed mt-1">
                    "{p.novedades}"
                  </p>
                  {p.solicitudInsumos && (
                    <div className="text-xs text-amber-900 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 mt-1 inline-block">
                      <strong>Solicitud de Insumos:</strong> {p.solicitudInsumos}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <button
                    type="button"
                    disabled={procesandoId === p.id}
                    onClick={() => cambiarEstado(p.id, "APROBADO")}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-check"></i> Aprobar
                  </button>
                  <button
                    type="button"
                    disabled={procesandoId === p.id}
                    onClick={() => cambiarEstado(p.id, "RECHAZADO")}
                    className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-xmark"></i> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid: Estado de Potreros + Enlace Veterinario & Tareas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Potreros y Rodeo */}
        <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ded7c4]">
            <div>
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Estado de Sectores de Ganado
              </h3>
              <p className="text-xs text-[#6b7c6d]">Ocupación y capacidad</p>
            </div>
            <button
              type="button"
              onClick={() => alCambiarVista && alCambiarVista("ganado")}
              className="text-xs text-[#33512f] font-bold hover:underline"
            >
              Trasladar Ganado →
            </button>
          </div>

          <div className="space-y-2.5">
            {potreros.map((p) => {
              const porcentaje = Math.min(100, Math.round(((p.totalAnimales || 0) / (p.capacidad || 100)) * 100));
              return (
                <div key={p.id} className="p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-bold text-[#182920]">{p.nombre}</span>
                    <span className="text-[#33512f] font-bold">
                      {p.totalAnimales || 0} / {p.capacidad || 100} cabezas ({porcentaje}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#ded7c4] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        porcentaje > 90 ? "bg-red-500" : porcentaje > 70 ? "bg-amber-500" : "bg-[#33512f]"
                      }`}
                      style={{ width: `${porcentaje}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tareas Sanitarias y Enlace Veterinario */}
        <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ded7c4]">
            <div>
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Tareas Sanitarias & Botiquín
              </h3>
              <p className="text-xs text-[#6b7c6d]">Coordinadas con la Médica Veterinaria</p>
            </div>
            <button
              type="button"
              onClick={() => alCambiarVista && alCambiarVista("sanidad")}
              className="text-xs text-[#33512f] font-bold hover:underline"
            >
              Ver calendario →
            </button>
          </div>

          <div className="space-y-3">
            {sanidad.slice(0, 3).map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#e7dfcb] text-[#182920] flex items-center justify-center text-xs">
                    <i className="fa-solid fa-syringe"></i>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#182920]">{ev.evento}</p>
                    <p className="text-[11px] text-[#6b7c6d]">
                      {ev.lote || "Rodeo"} • Programado: {ev.fecha || "Pendiente"}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                  {ev.estado}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-[#ded7c4] flex justify-between items-center text-xs">
            <span className="text-[#6b7c6d]">Insumos críticos a reponer:</span>
            <span className="font-bold text-red-700">{insumosCriticos.length} productos bajos</span>
          </div>
        </div>
      </div>

      {/* Custodia de Herramientas del Taller & Solicitudes de Insumos */}
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#ded7c4]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8fb56b]/20 text-[#182920] flex items-center justify-center text-lg font-bold">
              <i className="fa-solid fa-screwdriver-wrench text-[#33512f]"></i>
            </div>
            <div>
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Custodia de Herramientas de Taller & Pedidos de Insumos
              </h3>
              <p className="text-xs text-[#6b7c6d]">
                Conteo de pertenencias a cargo del Capataz y despacho de pedidos enviados por peones
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => alCambiarVista && alCambiarVista("insumos")}
              className="bg-[#182920] hover:bg-[#284835] text-[#f1ecdd] font-bold text-xs px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <i className="fa-solid fa-boxes-stacked text-[#8fb56b]"></i> Conteo & Gestión de Insumos ({solicitudesPendientes.length} por entregar)
            </button>
          </div>
        </div>

        {misHerramientas.length === 0 ? (
          <p className="text-xs text-[#6b7c6d] py-3 text-center">
            No tienes herramientas registradas bajo tu custodia en este momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {misHerramientas.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] flex items-center justify-between hover:border-[#8fb56b] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white border border-[#ded7c4] flex items-center justify-center text-[#182920]">
                    <i className={`fa-solid ${item.icono || "fa-screwdriver-wrench"}`}></i>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#182920]">{item.nombre}</p>
                    <p className="text-[10px] text-[#6b7c6d]">{item.ubicacion}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-[#182920]">
                    {item.stockActual}
                  </span>
                  <span className="text-[10px] text-[#6b7c6d] block">{item.unidad}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
