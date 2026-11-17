import { useState, useEffect } from "react";
import {
  obtenerPartesDiarios,
  registrarParteDiario,
  actualizarEstadoParte,
  eliminarParteDiario,
  eliminarPartesDiariosMasivo,
  obtenerPotreros,
} from "../../../api/dashboard.api";
import {
  leerColaPartesOffline,
  encolarParteOffline,
  sincronizarPartesOffline,
} from "../../../api/offlineQueue";
import { useAuth } from "../../../context/AuthContext";

export default function PartesView() {
  const { rol } = useAuth();
  const [partes, setPartes] = useState([]);
  const [potreros, setPotreros] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [seleccionadosPartes, setSeleccionadosPartes] = useState([]);
  const [parteAEliminar, setParteAEliminar] = useState(null);
  const [modalEliminarMasivo, setModalEliminarMasivo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [procesandoId, setProcesandoId] = useState(null);
  const [partesOffline, setPartesOffline] = useState(() => leerColaPartesOffline());
  const [sincronizandoOffline, setSincronizandoOffline] = useState(false);

  // Formulario nuevo parte
  const [nuevoParte, setNuevoParte] = useState({
    potreroId: "",
    novedades: "",
    animalesRevisados: 50,
    solicitudInsumos: "",
  });
  const [guardando, setGuardando] = useState(false);

  const puedeAprobar = rol === "capataz" || rol === "dueno";
  const puedeEliminar = rol === "capataz" || rol === "dueno";
  const puedeCargar = rol === "peon" || rol === "capataz" || rol === "dueno";

  async function cargarDatos() {
    try {
      const [resPart, resPot] = await Promise.all([
        obtenerPartesDiarios(),
        obtenerPotreros(),
      ]);
      if (resPart?.data) setPartes(resPart.data);
      if (resPot?.data) {
        setPotreros(resPot.data);
        if (resPot.data.length > 0 && !nuevoParte.potreroId) {
          setNuevoParte((v) => ({ ...v, potreroId: resPot.data[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  async function intentarSincronizarOffline() {
    if (sincronizandoOffline) return;
    setSincronizandoOffline(true);
    try {
      const res = await sincronizarPartesOffline(registrarParteDiario);
      setPartesOffline(leerColaPartesOffline());
      if (res.sincronizados > 0) {
        setMensaje(`Se sincronizaron ${res.sincronizados} parte(s) diario(s) pendientes del Modo Rural.`);
        await cargarDatos();
        setTimeout(() => setMensaje(""), 4500);
      }
    } finally {
      setSincronizandoOffline(false);
    }
  }

  useEffect(() => {
    cargarDatos();
    if (leerColaPartesOffline().length > 0 && navigator.onLine !== false) {
      intentarSincronizarOffline();
    }
    function alVolverConexion() {
      intentarSincronizarOffline();
    }
    window.addEventListener("online", alVolverConexion);
    return () => window.removeEventListener("online", alVolverConexion);
  }, []);

  async function manejarCrearParte(e) {
    e.preventDefault();
    if (!nuevoParte.novedades) return;
    setGuardando(true);
    const potreroObj = potreros.find((p) => p.id === nuevoParte.potreroId);
    const payload = {
      potreroId: nuevoParte.potreroId,
      potrero: potreroObj ? potreroObj.nombre : "Potrero",
      novedades: nuevoParte.novedades,
      animalesRevisados: Number(nuevoParte.animalesRevisados) || 0,
      solicitudInsumos: nuevoParte.solicitudInsumos,
    };

    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        encolarParteOffline(payload);
        setPartesOffline(leerColaPartesOffline());
        setMensaje("Sin señal: parte guardado en cola offline (se sincronizará al volver la conexión).");
        setModalAbierto(false);
        setNuevoParte({
          potreroId: potreros[0]?.id || "",
          novedades: "",
          animalesRevisados: 50,
          solicitudInsumos: "",
        });
        setTimeout(() => setMensaje(""), 4500);
        return;
      }

      await registrarParteDiario(payload);

      setMensaje("Parte diario registrado exitosamente en la base de datos.");
      setModalAbierto(false);
      setNuevoParte({
        potreroId: potreros[0]?.id || "",
        novedades: "",
        animalesRevisados: 50,
        solicitudInsumos: "",
      });
      await cargarDatos();
      setTimeout(() => setMensaje(""), 4000);
    } catch (err) {
      if (!err?.status) {
        encolarParteOffline(payload);
        setPartesOffline(leerColaPartesOffline());
        setMensaje("Sin señal de red: parte guardado en cola offline para sincronizar luego.");
        setModalAbierto(false);
        setTimeout(() => setMensaje(""), 4500);
      } else {
        alert("Error: " + err.message);
      }
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(id, nuevoEstado) {
    setProcesandoId(id);
    try {
      await actualizarEstadoParte(id, nuevoEstado);
      setMensaje(`Parte marcado como ${nuevoEstado}.`);
      await cargarDatos();
      setTimeout(() => setMensaje(""), 4000);
    } catch (err) {
      alert("Error al actualizar parte: " + err.message);
    } finally {
      setProcesandoId(null);
    }
  }

  async function manejarEliminarParte() {
    if (parteAEliminar) {
      const idObjetivo = parteAEliminar.id;
      setProcesandoId(idObjetivo);
      try {
        await eliminarParteDiario(idObjetivo);
        setPartes((prev) => prev.filter((item) => item.id !== idObjetivo));
        setSeleccionadosPartes((prev) => prev.filter((id) => id !== idObjetivo));
        setParteAEliminar(null);
        setMensaje("Parte diario eliminado correctamente.");
        await cargarDatos();
        setTimeout(() => setMensaje(""), 4000);
      } catch (err) {
        alert("Error al eliminar parte diario: " + err.message);
      } finally {
        setProcesandoId(null);
      }
      return;
    }

    if (seleccionadosPartes.length > 0) {
      const cantidad = seleccionadosPartes.length;
      setProcesandoId("__MASIVO__");
      try {
        await eliminarPartesDiariosMasivo(seleccionadosPartes);
        setPartes((prev) => prev.filter((item) => !seleccionadosPartes.includes(item.id)));
        setSeleccionadosPartes([]);
        setModalEliminarMasivo(false);
        setMensaje(`Se eliminaron ${cantidad} partes diarios marcados.`);
        await cargarDatos();
        setTimeout(() => setMensaje(""), 4000);
      } catch (err) {
        alert("Error al eliminar partes diarios: " + err.message);
      } finally {
        setProcesandoId(null);
      }
    }
  }

  const partesFiltrados = partes.filter((p) => {
    if (filtroEstado === "TODOS") return true;
    return String(p.estado).toUpperCase() === filtroEstado;
  });

  function toggleSeleccionParte(id) {
    setSeleccionadosPartes((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function seleccionarTodosPartes() {
    if (
      seleccionadosPartes.length === partesFiltrados.length &&
      partesFiltrados.length > 0
    ) {
      setSeleccionadosPartes([]);
    } else {
      setSeleccionadosPartes(partesFiltrados.map((p) => p.id));
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              Módulo de Partes de Campo
            </span>
            <span className="text-xs text-[#8fb56b]">Flujo Operativo Peón → Capataz</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Partes Diarios de Novedades de Campo
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-xl">
            Circuito digital de reporte de rodeos, nacimientos, animales apartados, alambrados y pedidos de insumos.
          </p>
        </div>

        {puedeCargar && (
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <i className="fa-solid fa-feather-pointed"></i> + Cargar Parte Diario
          </button>
        )}
      </div>

      {mensaje && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm animate-fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600 text-lg"></i>
          <span>{mensaje}</span>
        </div>
      )}

      {/* Filtros y Selección Múltiple */}
      <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {puedeEliminar && partesFiltrados.length > 0 && (
            <label
              className="flex items-center gap-1.5 text-xs font-bold text-[#182920] bg-[#f8f5eb] px-3 py-1.5 rounded-xl border border-[#ded7c4] cursor-pointer select-none hover:bg-[#e7dfcb] transition-colors"
              title="Marcar o desmarcar todos los partes visibles"
            >
              <input
                type="checkbox"
                checked={
                  seleccionadosPartes.length === partesFiltrados.length &&
                  partesFiltrados.length > 0
                }
                onChange={seleccionarTodosPartes}
                className="rounded cursor-pointer"
              />
              <span>Marcar todos</span>
            </label>
          )}

          <span className="text-xs font-bold text-[#182920] uppercase">Filtrar Estado:</span>
          {["TODOS", "PENDIENTE", "APROBADO", "RECHAZADO"].map((est) => (
            <button
              key={est}
              type="button"
              onClick={() => setFiltroEstado(est)}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                filtroEstado === est
                  ? "bg-[#182920] text-[#f1ecdd] border-[#182920]"
                  : "bg-[#f8f5eb] text-[#4a5c4e] border-[#ded7c4] hover:bg-[#e7dfcb]"
              }`}
            >
              {est === "TODOS" ? "Todos" : est}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {puedeEliminar && seleccionadosPartes.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setParteAEliminar(null);
                setModalEliminarMasivo(true);
              }}
              className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 animate-fade-in"
            >
              <i className="fa-solid fa-trash-can"></i>
              <span>Eliminar Marcados ({seleccionadosPartes.length})</span>
            </button>
          )}
          {puedeEliminar && (
            <span className="text-xs text-[#6b7c6d]">
              Marcados: <strong className="text-[#182920]">{seleccionadosPartes.length}</strong>
            </span>
          )}
          <span className="text-xs text-[#6b7c6d]">
            Total: <strong className="text-[#182920]">{partesFiltrados.length}</strong> partes en bandeja
          </span>
        </div>
      </div>

      {/* Cola Offline de Partes Diarios (Modo Rural) */}
      {partesOffline.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="text-xs text-amber-950">
            <p className="font-bold flex items-center gap-1.5">
              <i className="fa-solid fa-wifi text-amber-700"></i>
              <span>{partesOffline.length} parte(s) en cola offline (Modo Rural)</span>
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Se enviarán automáticamente al recuperar señal o al pulsar Sincronizar.
            </p>
          </div>
          <button
            type="button"
            disabled={sincronizandoOffline}
            onClick={intentarSincronizarOffline}
            className="bg-[#182920] hover:bg-[#33512f] text-[#f1ecdd] text-xs font-bold px-3.5 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            {sincronizandoOffline ? "Sincronizando..." : "Sincronizar ahora"}
          </button>
        </div>
      )}

      {/* Lista de Partes */}
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm space-y-4">
        {partesFiltrados.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
            <i className="fa-solid fa-clipboard-list text-3xl text-[#8fb56b]/50 mb-1"></i>
            <p className="text-sm font-semibold text-[#182920]">No hay partes diarios registrados en este establecimiento.</p>
            <p className="text-xs text-[#526354]">Los operarios de campo podrán cargar partes diarios o podés pulsar "+ Cargar Parte Diario".</p>
          </div>
        ) : (
          partesFiltrados.map((p) => {
            const estadoMayus = String(p.estado).toUpperCase();
            const esPendiente = estadoMayus === "PENDIENTE";
            const esAprobado = estadoMayus === "APROBADO";
            const isChecked = seleccionadosPartes.includes(p.id);

            return (
              <div
                key={p.id}
                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                  isChecked
                    ? "border-[#182920] ring-2 ring-[#8fb56b]/50 bg-[#f8f5eb]"
                    : esPendiente
                    ? "bg-[#f8f5eb] border-amber-200"
                    : "bg-white border-[#ded7c4]"
                }`}
              >
                <div className="flex items-start gap-3 max-w-3xl">
                  {puedeEliminar && (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSeleccionParte(p.id)}
                      className="rounded cursor-pointer w-4 h-4 mt-1 accent-[#182920] flex-shrink-0"
                      aria-label={`Marcar parte ${p.potreroNombre || p.potrero || p.id}`}
                      title="Marcar este parte diario para eliminar"
                    />
                  )}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#182920] bg-[#f8f5eb] px-2.5 py-0.5 rounded-md border border-[#ded7c4]">
                        📍 {p.potreroNombre || p.potrero || "Potrero"}
                      </span>
                      <span className="text-xs font-semibold text-[#33512f]">
                        👤 {p.peonNombre || "Operario"}
                      </span>
                      <span className="text-xs text-[#6b7c6d]">· 📅 {p.fecha}</span>
                      <span className="text-xs text-[#6b7c6d]">
                        · {p.animalesRevisados} cabezas inspeccionadas
                      </span>
                      {p.revisadoPorNombre && (
                        <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                          Revisado por {p.revisadoPorNombre}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#182920] font-medium leading-relaxed">
                      {p.novedades}
                    </p>

                    {p.solicitudInsumos && (
                      <div className="text-xs text-amber-900 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 inline-block font-medium">
                        📦 Solicitud: {p.solicitudInsumos}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                  <span
                    className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase border ${
                      esAprobado
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : estadoMayus === "RECHAZADO"
                        ? "bg-red-100 text-red-800 border-red-300"
                        : "bg-amber-100 text-amber-800 border-amber-300"
                    }`}
                  >
                    {esAprobado ? "✓ Aprobado" : estadoMayus === "RECHAZADO" ? "✕ Rechazado" : "⏳ Pendiente"}
                  </span>

                  {puedeAprobar && esPendiente && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={procesandoId === p.id}
                        onClick={() => cambiarEstado(p.id, "APROBADO")}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={procesandoId === p.id}
                        onClick={() => cambiarEstado(p.id, "RECHAZADO")}
                        className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}

                  {puedeEliminar && (
                    <button
                      type="button"
                      disabled={procesandoId === p.id}
                      onClick={() => setParteAEliminar(p)}
                      className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                      title="Eliminar parte diario"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                      <span>Eliminar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Carga Parte */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-md w-full animate-fade-in text-xs">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#ded7c4]">
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Cargar Parte Diario de Campo
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={manejarCrearParte} className="space-y-3">
              <div>
                <label className="block font-bold text-[#182920] mb-1">Potrero Inspeccionado</label>
                <select
                  value={nuevoParte.potreroId}
                  onChange={(e) => setNuevoParte({ ...nuevoParte, potreroId: e.target.value })}
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  required
                >
                  {potreros.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#182920] mb-1">Animales Inspeccionados</label>
                <input
                  type="number"
                  min="1"
                  value={nuevoParte.animalesRevisados}
                  onChange={(e) => setNuevoParte({ ...nuevoParte, animalesRevisados: e.target.value })}
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#182920] mb-1">Novedades y Observaciones</label>
                <textarea
                  rows="3"
                  value={nuevoParte.novedades}
                  onChange={(e) => setNuevoParte({ ...nuevoParte, novedades: e.target.value })}
                  placeholder="Detalla lo visto en la recorrida de campo..."
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl p-2.5 text-[#182920] outline-none"
                  required
                ></textarea>
              </div>

              <div>
                <label className="block font-bold text-[#182920] mb-1">Solicitud de Insumos (Opcional)</label>
                <input
                  type="text"
                  value={nuevoParte.solicitudInsumos}
                  onChange={(e) => setNuevoParte({ ...nuevoParte, solicitudInsumos: e.target.value })}
                  placeholder="Ej: 10 metros de alambre, varillas, sal..."
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                />
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
                  {guardando ? "Guardando..." : "Enviar Parte Diario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación de Parte Diario (Individual o Marcados) */}
      {(parteAEliminar || modalEliminarMasivo) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-red-200 shadow-2xl max-w-sm w-full animate-fade-in text-xs space-y-3">
            <h3 className="text-base font-bold text-red-800 font-['Fraunces',serif] flex items-center gap-2">
              <i className="fa-solid fa-trash-can"></i>
              {parteAEliminar
                ? "Eliminar Parte Diario"
                : `Eliminar ${seleccionadosPartes.length} Partes Marcados`}
            </h3>
            <p className="text-[#555] leading-relaxed">
              {parteAEliminar ? (
                <>
                  ¿Confirmás que deseás eliminar el parte diario de{" "}
                  <strong>{parteAEliminar.potreroNombre || parteAEliminar.potrero || "Potrero"}</strong>{" "}
                  ({parteAEliminar.fecha} · {parteAEliminar.peonNombre || "Operario"})?
                </>
              ) : (
                <>
                  ¿Confirmás que deseás eliminar los <strong>{seleccionadosPartes.length}</strong> partes diarios seleccionados?
                </>
              )}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setParteAEliminar(null);
                  setModalEliminarMasivo(false);
                }}
                className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  parteAEliminar
                    ? procesandoId === parteAEliminar.id
                    : procesandoId === "__MASIVO__"
                }
                onClick={manejarEliminarParte}
                className="px-5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold"
              >
                {procesandoId ? "Eliminando..." : "Confirmar Eliminación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
