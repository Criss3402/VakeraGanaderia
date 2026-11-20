import { useState, useEffect } from "react";
import {
  obtenerPartesDiarios,
  registrarParteDiario,
  obtenerPotreros,
  obtenerGanado,
  obtenerInsumos,
} from "../../../api/dashboard.api";

export default function PanelPeon({ alCambiarVista }) {
  const [partes, setPartes] = useState([]);
  const [potreros, setPotreros] = useState([]);
  const [ganado, setGanado] = useState([]);
  const [misHerramientas, setMisHerramientas] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Formulario rápido de parte
  const [potreroSeleccionado, setPotreroSeleccionado] = useState("");
  const [novedades, setNovedades] = useState("");
  const [animalesRevisados, setAnimalesRevisados] = useState(50);
  const [solicitudInsumos, setSolicitudInsumos] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");

  async function cargarDatos() {
    try {
      const [resPartes, resPotreros, resGanado, resInsumos] = await Promise.all([
        obtenerPartesDiarios(),
        obtenerPotreros(),
        obtenerGanado(),
        obtenerInsumos(),
      ]);
      if (resPartes?.data) setPartes(resPartes.data);
      if (resPotreros?.data) {
        setPotreros(resPotreros.data);
        if (resPotreros.data.length > 0 && !potreroSeleccionado) {
          setPotreroSeleccionado(resPotreros.data[0].id);
        }
      }
      if (resGanado?.data) setGanado(resGanado.data);
      if (resInsumos?.data) {
        setMisHerramientas(
          resInsumos.data.filter(
            (i) =>
              i.ubicacion?.toLowerCase().includes("peón") ||
              i.ubicacion?.toLowerCase().includes("peon")
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

  async function manejarEnviarParte(e) {
    e.preventDefault();
    if (!novedades.trim()) return;

    setEnviando(true);
    setMensajeExito("");
    try {
      const potreroObj = potreros.find((p) => p.id === potreroSeleccionado);
      await registrarParteDiario({
        potreroId: potreroSeleccionado,
        potrero: potreroObj ? potreroObj.nombre : "Potrero de Campo",
        novedades,
        animalesRevisados: Number(animalesRevisados) || 0,
        solicitudInsumos,
      });

      setMensajeExito("¡Parte de campo registrado y enviado al Capataz para revisión!");
      setNovedades("");
      setSolicitudInsumos("");
      await cargarDatos();
      setTimeout(() => setMensajeExito(""), 5000);
    } catch (err) {
      alert("Error al cargar parte: " + err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner de bienvenida y rol */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              Rol: Peón de Campo
            </span>
            <span className="text-xs text-[#8fb56b]">Operaciones & Terreno</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Puesto de Trabajo de Campo
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-xl">
            Herramientas directas para carga ágil de partes diarios, reporte de novedades de ganado y solicitud de insumos.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#122019] px-4 py-3 rounded-xl border border-[#8fb56b]/30">
          <i className="fa-solid fa-clipboard-check text-[#8fb56b] text-xl"></i>
          <div>
            <p className="text-xs text-gray-300 font-medium">Mis Partes Cargados</p>
            <p className="text-lg font-bold text-[#8fb56b] leading-tight">{partes.length}</p>
          </div>
        </div>
      </div>

      {mensajeExito && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm animate-fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600 text-lg"></i>
          <span>{mensajeExito}</span>
        </div>
      )}

      {/* Grid: Formulario Rápido (Principal para el Peón) + Potreros donde está el rodeo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario Rápido de Novedades */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#ded7c4]">
            <div className="w-10 h-10 rounded-xl bg-[#e7dfcb] text-[#182920] flex items-center justify-center text-lg font-bold">
              <i className="fa-solid fa-pen-to-square"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#182920] font-['Fraunces',serif]">
                Cargar Novedad o Parte Diario
              </h3>
              <p className="text-xs text-[#6b7c6d]">
                Se sincroniza directamente con la base de datos y notifica al Capataz
              </p>
            </div>
          </div>

          <form onSubmit={manejarEnviarParte} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#182920] uppercase mb-1">
                  Sector de Ganado Inspeccionado
                </label>
                <select
                  value={potreroSeleccionado}
                  onChange={(e) => setPotreroSeleccionado(e.target.value)}
                  className="w-full text-xs font-medium bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2.5 text-[#182920] focus:ring-2 focus:ring-[#8fb56b] outline-none"
                  required
                >
                  {potreros.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.totalAnimales ?? 0} cabezas)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#182920] uppercase mb-1">
                  Animales Revisados (Aprox.)
                </label>
                <input
                  type="number"
                  min="1"
                  value={animalesRevisados}
                  onChange={(e) => setAnimalesRevisados(e.target.value)}
                  className="w-full text-xs font-medium bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2.5 text-[#182920] focus:ring-2 focus:ring-[#8fb56b] outline-none"
                  placeholder="Ej: 80"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#182920] uppercase mb-1">
                Novedades del Campo (Nacimientos, Rengueras, Alambrados)
              </label>
              <textarea
                rows="3"
                value={novedades}
                onChange={(e) => setNovedades(e.target.value)}
                placeholder="Detalla lo observado en la recorrida (ej: Nacieron 2 terneros en buen estado, novillo con renguera en pata trasera, alambrado flojo este...)"
                className="w-full text-xs font-medium bg-[#f8f5eb] border border-[#ded7c4] rounded-xl p-3 text-[#182920] focus:ring-2 focus:ring-[#8fb56b] outline-none"
                required
              ></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#182920] uppercase mb-1">
                Solicitud de Insumos o Herramientas (Opcional)
              </label>
              <input
                type="text"
                value={solicitudInsumos}
                onChange={(e) => setSolicitudInsumos(e.target.value)}
                placeholder="Ej: Se precisan 15 varillas y 2 rollos de alambre para el bajo..."
                className="w-full text-xs font-medium bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] focus:ring-2 focus:ring-[#8fb56b] outline-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={enviando}
                className="bg-[#182920] hover:bg-[#284835] text-[#f1ecdd] font-bold text-xs uppercase px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
              >
                {enviando ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Guardando...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane text-[#8fb56b]"></i> Enviar Parte al Capataz
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Consulta Rápida: Ubicación de Potreros */}
        <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ded7c4]">
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Rodeo por Sector de Ganado
              </h3>
              <span className="text-[10px] bg-[#f8f5eb] text-[#33512f] font-bold px-2 py-0.5 rounded-md border border-[#ded7c4]">
                {potreros.length} Sectores
              </span>
            </div>

            <p className="text-xs text-[#6b7c6d] mb-3">
              Consulta rápida para saber dónde se encuentra distribuida la hacienda en el campo:
            </p>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {potreros.map((pot) => (
                <div
                  key={pot.id}
                  className="p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] flex items-center justify-between hover:bg-[#f1ecdd] transition-colors"
                >
                  <div>
                    <p className="text-xs font-bold text-[#182920]">{pot.nombre}</p>
                    <p className="text-[10px] text-[#6b7c6d]">
                      {pot.superficieHas ? `${pot.superficieHas} Has` : "Área rural"} • Capacidad: {pot.capacidad || 100}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-[#33512f]">
                      {pot.totalAnimales ?? 0}
                    </span>
                    <span className="text-[10px] text-[#6b7c6d] block">cabezas</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => alCambiarVista && alCambiarVista("ganado")}
            className="w-full mt-4 bg-[#f8f5eb] hover:bg-[#e7dfcb] text-[#182920] font-bold text-xs py-2.5 rounded-xl border border-[#ded7c4] transition-colors flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-cow text-[#33512f]"></i> Ver Todo el Ganado
          </button>
        </div>
      </div>

      {/* Mis Pertenencias y Herramientas Asignadas (Conteo y Solicitud) */}
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#ded7c4]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8fb56b]/20 text-[#182920] flex items-center justify-center text-lg font-bold">
              <i className="fa-solid fa-toolbox text-[#33512f]"></i>
            </div>
            <div>
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Mis Pertenencias y Herramientas Asignadas
              </h3>
              <p className="text-xs text-[#6b7c6d]">
                Control de inventario en mano, conteo físico y solicitud de reposición al Capataz
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => alCambiarVista && alCambiarVista("insumos")}
              className="bg-[#182920] hover:bg-[#284835] text-[#f1ecdd] font-bold text-xs px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <i className="fa-solid fa-calculator text-[#8fb56b]"></i> Realizar Conteo / Solicitar Stock
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
                    <i className={`fa-solid ${item.icono || "fa-gavel"}`}></i>
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

      {/* Historial de Partes Enviados por el Peón */}
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ded7c4]">
          <div>
            <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
              Historial de Partes y Estado de Aprobación
            </h3>
            <p className="text-xs text-[#6b7c6d]">
              Seguimiento del estado de revisión por el Capataz
            </p>
          </div>
          <button
            type="button"
            onClick={() => alCambiarVista && alCambiarVista("partes")}
            className="text-xs text-[#33512f] font-bold hover:underline flex items-center gap-1"
          >
            Ver bandeja completa <i className="fa-solid fa-arrow-right text-[10px]"></i>
          </button>
        </div>

        {partes.length === 0 ? (
          <p className="text-xs text-[#6b7c6d] py-4 text-center">No hay partes registrados todavía.</p>
        ) : (
          <div className="divide-y divide-[#ded7c4]">
            {partes.slice(0, 5).map((p) => {
              const estadoMayus = String(p.estado).toUpperCase();
              const esAprobado = estadoMayus === "APROBADO";
              const esRechazado = estadoMayus === "RECHAZADO";

              return (
                <div key={p.id} className="py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#182920]">
                        {p.potreroNombre || p.potrero || "Potrero"}
                      </span>
                      <span className="text-[11px] text-[#6b7c6d]">· {p.fecha}</span>
                      <span className="text-[11px] text-[#6b7c6d]">
                        ({p.animalesRevisados || 0} animales)
                      </span>
                    </div>
                    <p className="text-xs text-[#333] leading-relaxed max-w-2xl">
                      {p.novedades}
                    </p>
                    {p.solicitudInsumos && (
                      <p className="text-[11px] text-amber-800 font-medium">
                        📦 Solicitud: {p.solicitudInsumos}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${
                        esAprobado
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : esRechazado
                          ? "bg-red-100 text-red-800 border-red-300"
                          : "bg-amber-100 text-amber-800 border-amber-300"
                      }`}
                    >
                      {esAprobado ? "✓ Aprobado" : esRechazado ? "✕ Rechazado" : "⏳ Pendiente"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
