import { useState, useEffect } from "react";
import {
  obtenerSanidad,
  registrarEventoSanitario,
  actualizarEstadoSanitario,
  obtenerGanado,
  obtenerInsumos,
  actualizarGanado,
} from "../../../api/dashboard.api";

export default function PanelVeterinario({ alCambiarVista }) {
  const [eventos, setEventos] = useState([]);
  const [ganado, setGanado] = useState([]);
  const [fármacos, setFármacos] = useState([]);
  const [misPertenencias, setMisPertenencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // Nuevo evento o receta sanitaria
  const [nuevoEvento, setNuevoEvento] = useState({
    evento: "",
    tipo: "Vacunación",
    lote: "Rodeo General",
    fechaProgramada: new Date().toISOString().split("T")[0],
    prioridad: "Alta",
    notas: "",
  });
  const [guardando, setGuardando] = useState(false);

  async function cargarDatos() {
    try {
      const [resSan, resGan, resIns] = await Promise.all([
        obtenerSanidad(),
        obtenerGanado(),
        obtenerInsumos(),
      ]);
      if (resSan?.data) setEventos(resSan.data);
      if (resGan?.data) setGanado(resGan.data);
      if (resIns?.data) {
        setFármacos(resIns.data.filter((i) => i.categoria === "Fármaco"));
        setMisPertenencias(
          resIns.data.filter(
            (i) =>
              i.ubicacion?.toLowerCase().includes("veterin") ||
              i.ubicacion?.toLowerCase().includes("sanitario")
          )
        );
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

  async function manejarCrearEvento(e) {
    e.preventDefault();
    if (!nuevoEvento.evento) return;
    setGuardando(true);
    try {
      await registrarEventoSanitario(nuevoEvento);
      setMensaje("Evento sanitario registrado en el calendario.");
      setModalAbierto(false);
      setNuevoEvento({
        evento: "",
        tipo: "Vacunación",
        lote: "Rodeo General",
        fechaProgramada: new Date().toISOString().split("T")[0],
        prioridad: "Alta",
        notas: "",
      });
      await cargarDatos();
      setTimeout(() => setMensaje(""), 4000);
    } catch (err) {
      alert("Error al registrar evento: " + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function marcarCompletado(id) {
    try {
      await actualizarEstadoSanitario(id, "Completado");
      setMensaje("Tratamiento marcado como completado.");
      await cargarDatos();
      setTimeout(() => setMensaje(""), 4000);
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  async function cambiarEstadoAnimal(animalId, nuevoEstado) {
    try {
      await actualizarGanado(animalId, { estadoSanitario: nuevoEstado });
      setMensaje(`Estado del animal actualizado a ${nuevoEstado}.`);
      await cargarDatos();
      setTimeout(() => setMensaje(""), 4000);
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  const eventosPendientes = eventos.filter((e) => e.estado !== "Completado");
  const animalesEnTratamiento = ganado.filter(
    (g) => g.estadoSanitario === "EN_TRATAMIENTO" || g.estadoSanitario === "OBSERVACION"
  );

  return (
    <div className="space-y-6">
      {/* Banner Veterinario */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              Rol: Médica Veterinaria
            </span>
            <span className="text-xs text-[#8fb56b]">Sanidad Animal & Protocolos Clínicos</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Puesto de Sanidad y Trazabilidad Médica
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-xl">
            Control de calendarios oficiales de vacunación (SENASA), prescripción de tratamientos, fichas clínicas y cuarentenas preventivas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
        >
          <i className="fa-solid fa-plus-circle"></i> Nueva Alerta / Tratamiento
        </button>
      </div>

      {mensaje && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm animate-fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600 text-lg"></i>
          <span>{mensaje}</span>
        </div>
      )}

      {/* Grid: Calendario Sanitario Oficial + Animales en Observación/Tratamiento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendario Sanitario y Vacunaciones */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ded7c4]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center text-lg">
                <i className="fa-solid fa-calendar-check"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#182920] font-['Fraunces',serif]">
                  Calendario Sanitario y Campañas Oficiales
                </h3>
                <p className="text-xs text-[#6b7c6d]">
                  Vacunaciones oficiales y tratamientos clínicos programados
                </p>
              </div>
            </div>
            <span className="text-xs font-bold bg-[#f8f5eb] text-[#33512f] px-2.5 py-1 rounded-md border border-[#ded7c4]">
              {eventosPendientes.length} pendientes
            </span>
          </div>

          <div className="space-y-3">
            {eventos.map((ev) => {
              const completado = ev.estado === "Completado";
              return (
                <div
                  key={ev.id}
                  className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-3 transition-colors ${
                    completado
                      ? "bg-[#f8f5eb]/60 border-[#ded7c4] opacity-75"
                      : "bg-[#f8f5eb] border-[#8fb56b]/40 shadow-sm"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#182920]">{ev.evento}</span>
                      <span className="text-[10px] bg-white text-[#4a5c4e] font-bold px-2 py-0.5 rounded border border-[#ded7c4]">
                        {ev.tipo}
                      </span>
                      <span className="text-xs text-[#6b7c6d]">· 📍 {ev.lote || "Rodeo General"}</span>
                      <span className="text-xs text-[#6b7c6d]">· 📅 {ev.fecha}</span>
                    </div>
                    {ev.notas && (
                      <p className="text-xs text-[#555] italic">"{ev.notas}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${
                        completado
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : ev.prioridad === "Urgente"
                          ? "bg-red-100 text-red-800 border-red-300"
                          : "bg-amber-100 text-amber-800 border-amber-300"
                      }`}
                    >
                      {completado ? "✓ Completado" : ev.estado || "Pendiente"}
                    </span>
                    {!completado && (
                      <button
                        type="button"
                        onClick={() => marcarCompletado(ev.id)}
                        className="bg-[#182920] hover:bg-[#284835] text-[#f1ecdd] font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Aplicar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Animales en Observación / Cuarentena */}
        <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ded7c4]">
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Atención Sanitaria de Hacienda
              </h3>
              <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-md border border-amber-200">
                {animalesEnTratamiento.length} en cuidado
              </span>
            </div>

            <p className="text-xs text-[#6b7c6d] mb-3">
              Animales apartados por signos de enfermedad reportados en partes:
            </p>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {ganado.map((g) => {
                const esSaludable = g.estadoSanitario === "SALUDABLE";
                return (
                  <div
                    key={g.id}
                    className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-colors ${
                      !esSaludable ? "bg-amber-50/70 border-amber-300" : "bg-[#f8f5eb] border-[#ded7c4]"
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#182920]">
                        Caravana: {g.caravana} ({g.categoria})
                      </span>
                      <span className="text-[10px] font-bold text-[#6b7c6d]">{g.pesoKg} kg</span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                          g.estadoSanitario === "EN_TRATAMIENTO"
                            ? "bg-red-100 text-red-800 border-red-300"
                            : g.estadoSanitario === "OBSERVACION"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                        }`}
                      >
                        {g.estadoSanitario}
                      </span>

                      <div className="space-x-1">
                        {!esSaludable ? (
                          <button
                            type="button"
                            onClick={() => cambiarEstadoAnimal(g.id, "SALUDABLE")}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[9px] px-2 py-1 rounded-md"
                          >
                            Dar Alta
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => cambiarEstadoAnimal(g.id, "EN_TRATAMIENTO")}
                            className="bg-amber-700 hover:bg-amber-800 text-white font-bold text-[9px] px-2 py-1 rounded-md"
                          >
                            Tratar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#ded7c4]">
            <p className="text-[11px] text-[#6b7c6d] italic">
              * El cambio de estado sanitario se sincroniza en vivo con el registro del rodeo.
            </p>
          </div>
        </div>
      </div>

      {/* Botiquín Veterinario & Equipamiento Asignado */}
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#ded7c4]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center text-lg">
              <i className="fa-solid fa-kit-medical"></i>
            </div>
            <div>
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Botiquín Veterinario & Equipamiento Asignado
              </h3>
              <p className="text-xs text-[#6b7c6d]">
                Inventario de fármacos, jeringas y equipos bajo custodia de la veterinaria
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => alCambiarVista && alCambiarVista("insumos")}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <i className="fa-solid fa-clipboard-list"></i> Conteo de Botiquín / Solicitar Stock
            </button>
          </div>
        </div>

        {misPertenencias.length === 0 ? (
          <div className="py-4 text-center">
            <i className="fa-solid fa-box-open text-[#ded7c4] text-2xl mb-2 block"></i>
            <p className="text-xs text-[#6b7c6d]">
              No hay equipamiento registrado bajo custodia veterinaria todavía.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {misPertenencias.map((item) => {
              const esBajoStock = item.stockActual <= item.stockMinimo;
              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                    esBajoStock
                      ? "bg-red-50 border-red-200 hover:border-red-400"
                      : "bg-[#f8f5eb] border-[#ded7c4] hover:border-[#8fb56b]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white border border-[#ded7c4] flex items-center justify-center text-[#182920]">
                      <i className={`fa-solid ${item.icono || "fa-syringe"}`}></i>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#182920]">{item.nombre}</p>
                      <p className="text-[10px] text-[#6b7c6d]">{item.ubicacion}</p>
                      {esBajoStock && (
                        <span className="text-[9px] font-bold text-red-700">
                          ⚠ Bajo mínimo requerido
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-extrabold ${esBajoStock ? "text-red-700" : "text-[#182920]"}`}>
                      {item.stockActual}
                    </span>
                    <span className="text-[10px] text-[#6b7c6d] block">{item.unidad}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal para Crear Evento Sanitario */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-md w-full animate-fade-in">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#ded7c4]">
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Programar Tratamiento o Campaña Sanitaria
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={manejarCrearEvento} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#182920] mb-1">Nombre de la Práctica</label>
                <input
                  type="text"
                  value={nuevoEvento.evento}
                  onChange={(e) => setNuevoEvento({ ...nuevoEvento, evento: e.target.value })}
                  placeholder="Ej: Vacunación Antiaftosa Otoño 2026"
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Tipo de Acto</label>
                  <select
                    value={nuevoEvento.tipo}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, tipo: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  >
                    <option value="Vacunación">Vacunación Oficial</option>
                    <option value="Tratamiento">Tratamiento Clínico</option>
                    <option value="Control">Control Reproductivo</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Lote / Rodeo</label>
                  <input
                    type="text"
                    value={nuevoEvento.lote}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, lote: e.target.value })}
                    placeholder="Ej: Terneros destete"
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Fecha Programada</label>
                  <input
                    type="date"
                    value={nuevoEvento.fechaProgramada}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, fechaProgramada: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Prioridad</label>
                  <select
                    value={nuevoEvento.prioridad}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, prioridad: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  >
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                    <option value="Normal">Normal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#182920] mb-1">Indicaciones / Prescripción Médica</label>
                <textarea
                  rows="2"
                  value={nuevoEvento.notas}
                  onChange={(e) => setNuevoEvento({ ...nuevoEvento, notas: e.target.value })}
                  placeholder="Dosis recomendada, vía de administración (subcutánea), recomendaciones..."
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl p-2.5 text-[#182920] outline-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2 rounded-xl bg-[#182920] text-[#f1ecdd] font-bold hover:bg-[#284835]"
                >
                  {guardando ? "Guardando..." : "Registrar en Plan Sanitario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
