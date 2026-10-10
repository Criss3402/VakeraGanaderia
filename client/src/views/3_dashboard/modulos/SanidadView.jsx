import { useState, useEffect } from "react";
import {
  obtenerSanidad,
  registrarEventoSanitario,
  actualizarEstadoSanitario,
  obtenerGanado,
} from "../../../api/dashboard.api";
import { useAuth } from "../../../context/AuthContext";

export default function SanidadView() {
  const { rol } = useAuth();
  const [eventos, setEventos] = useState([]);
  const [ganado, setGanado] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const [nuevoEvento, setNuevoEvento] = useState({
    evento: "",
    tipo: "Vacunación",
    lote: "Rodeo General",
    fechaProgramada: new Date().toISOString().split("T")[0],
    prioridad: "Alta",
    notas: "",
  });
  const [guardando, setGuardando] = useState(false);

  const puedeGestionarSanidad = rol === "veterinario" || rol === "capataz" || rol === "dueno";

  async function cargarDatos() {
    try {
      const [resSan, resGan] = await Promise.all([
        obtenerSanidad(),
        obtenerGanado(),
      ]);
      if (resSan?.data) setEventos(resSan.data);
      if (resGan?.data) setGanado(resGan.data);
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
      setMensaje("Evento sanitario registrado en la base de datos.");
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
      alert("Error: " + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(id, nuevoEstado) {
    try {
      await actualizarEstadoSanitario(id, nuevoEstado);
      setMensaje(`Evento sanitario actualizado a '${nuevoEstado}'.`);
      await cargarDatos();
      setTimeout(() => setMensaje(""), 4000);
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  const eventosFiltrados = eventos.filter((e) => {
    if (filtroTipo === "TODOS") return true;
    return e.tipo === filtroTipo;
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              Módulo Sanitario & Vacunaciones
            </span>
            <span className="text-xs text-[#8fb56b]">Control Clínico Oficial</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Calendario Sanitario y Tratamientos
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-xl">
            Campañas preventivas oficiales (SENASA), tratamientos clínicos, registro de dosis y alertas sanitarias por animal o lote.
          </p>
        </div>

        {puedeGestionarSanidad && (
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <i className="fa-solid fa-syringe"></i> + Programar Acto Sanitario
          </button>
        )}
      </div>

      {mensaje && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm animate-fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600 text-lg"></i>
          <span>{mensaje}</span>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#182920] uppercase">Tipo de Acto:</span>
          {["TODOS", "Vacunación", "Tratamiento", "Mantenimiento"].map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setFiltroTipo(tipo)}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                filtroTipo === tipo
                  ? "bg-[#182920] text-[#f1ecdd] border-[#182920]"
                  : "bg-[#f8f5eb] text-[#4a5c4e] border-[#ded7c4] hover:bg-[#e7dfcb]"
              }`}
            >
              {tipo === "TODOS" ? "Todos" : tipo}
            </button>
          ))}
        </div>

        <span className="text-xs text-[#6b7c6d]">
          Total: <strong className="text-[#182920]">{eventosFiltrados.length}</strong> eventos registrados
        </span>
      </div>

      {/* Lista de Eventos */}
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm space-y-3.5">
        {eventosFiltrados.map((ev) => {
          const completado = ev.estado === "Completado";
          return (
            <div
              key={ev.id}
              className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors ${
                completado
                  ? "bg-[#f8f5eb]/60 border-[#ded7c4] opacity-80"
                  : "bg-[#f8f5eb] border-[#8fb56b]/40 shadow-sm"
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-[#182920]">{ev.evento}</span>
                  <span className="text-[10px] bg-white text-[#4a5c4e] font-bold px-2 py-0.5 rounded border border-[#ded7c4]">
                    {ev.tipo}
                  </span>
                  <span className="text-xs text-[#6b7c6d]">· 📍 Lote: {ev.lote || "Rodeo"}</span>
                  <span className="text-xs text-[#6b7c6d]">· 📅 Programado: {ev.fecha}</span>
                </div>
                {ev.notas && <p className="text-xs text-[#555] italic">"{ev.notas}"</p>}
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

                {puedeGestionarSanidad && !completado && (
                  <button
                    type="button"
                    onClick={() => cambiarEstado(ev.id, "Completado")}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors"
                  >
                    Marcar Aplicado
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Programar Evento */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-md w-full animate-fade-in text-xs">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#ded7c4]">
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Registrar Acto Sanitario
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={manejarCrearEvento} className="space-y-3">
              <div>
                <label className="block font-bold text-[#182920] mb-1">Nombre de la Práctica</label>
                <input
                  type="text"
                  value={nuevoEvento.evento}
                  onChange={(e) => setNuevoEvento({ ...nuevoEvento, evento: e.target.value })}
                  placeholder="Ej: Vacunación Antiaftosa / Antiparasitario"
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Tipo</label>
                  <select
                    value={nuevoEvento.tipo}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, tipo: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  >
                    <option value="Vacunación">Vacunación Oficial</option>
                    <option value="Tratamiento">Tratamiento Clínico</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Lote / Potrero</label>
                  <input
                    type="text"
                    value={nuevoEvento.lote}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, lote: e.target.value })}
                    placeholder="Ej: Terneros / Novillos"
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
                <label className="block font-bold text-[#182920] mb-1">Notas Clínicas o Dosis</label>
                <textarea
                  rows="2"
                  value={nuevoEvento.notas}
                  onChange={(e) => setNuevoEvento({ ...nuevoEvento, notas: e.target.value })}
                  placeholder="Instrucciones para la aplicación en manga..."
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
                  {guardando ? "Guardando..." : "Guardar en Base de Datos"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
