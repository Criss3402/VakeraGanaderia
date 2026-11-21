import { useState, useEffect, useMemo } from "react";
import { obtenerOrdenies, registrarOrdenie, eliminarOrdenie } from "../../../api/dashboard.api";

function obtenerHoyLocal() {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function VacasOrdenadasView({
  vacasLecheras = [],
  precioLitro = 550.25,
  formatearMonto,
  alVolver,
}) {
  const hoyLocal = obtenerHoyLocal();
  const [fecha, setFecha] = useState(hoyLocal);
  const [parcelaFiltro, setParcelaFiltro] = useState("TODAS");
  const [animalId, setAnimalId] = useState(vacasLecheras[0]?.id || "");
  const [litrosSacados, setLitrosSacados] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [registros, setRegistros] = useState([]);
  const [filtroFecha, setFiltroFecha] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [exitoMsg, setExitoMsg] = useState("");

  const parcelasDisponibles = useMemo(() => {
    const mapa = new Map();
    for (const v of vacasLecheras) {
      const clave = v.potreroId || v.potreroNombre || "SIN_PARCELA";
      const nombre = v.potreroNombre || "Sin parcela";
      if (!mapa.has(clave)) mapa.set(clave, { clave, nombre });
    }
    return Array.from(mapa.values());
  }, [vacasLecheras]);

  const vacasFiltradas = useMemo(() => {
    return vacasLecheras.filter((v) => {
      const claveParcela = v.potreroId || v.potreroNombre || "SIN_PARCELA";
      return parcelaFiltro === "TODAS" || claveParcela === parcelaFiltro;
    });
  }, [vacasLecheras, parcelaFiltro]);

  useEffect(() => {
    if (vacasFiltradas.length === 0) {
      setAnimalId("");
    } else if (!vacasFiltradas.some((v) => v.id === animalId)) {
      setAnimalId(vacasFiltradas[0].id);
    }
  }, [vacasFiltradas, animalId]);

  const cargarRegistros = async (fechaFiltro = filtroFecha) => {
    setCargando(true);
    try {
      const res = await obtenerOrdenies(fechaFiltro ? { fecha: fechaFiltro } : {});
      if (Array.isArray(res?.data)) setRegistros(res.data);
    } catch (e) {
      console.error("Error al cargar ordeñes:", e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarRegistros(filtroFecha);
  }, [filtroFecha]);

  const manejarGuardar = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setExitoMsg("");

    if (!fecha || fecha > hoyLocal) {
      setErrorMsg("La fecha no puede ser un día futuro.");
      return;
    }
    if (!animalId) {
      setErrorMsg("Seleccioná una Vaca Lechera.");
      return;
    }
    const litrosNum = Number(litrosSacados);
    if (!Number.isFinite(litrosNum) || litrosNum <= 0) {
      setErrorMsg("Ingresá una cantidad válida de litros sacados (mayor a 0).");
      return;
    }

    setGuardando(true);
    try {
      await registrarOrdenie({
        fecha,
        animalId,
        litrosSacados: litrosNum,
        observaciones,
      });
      setLitrosSacados("");
      setObservaciones("");
      setExitoMsg("Ordeñe guardado correctamente.");
      setTimeout(() => setExitoMsg(""), 3000);
      await cargarRegistros(filtroFecha);
    } catch (err) {
      setErrorMsg(err?.message || "No se pudo guardar el registro de ordeñe.");
    } finally {
      setGuardando(false);
    }
  };

  const manejarEliminar = async (id) => {
    try {
      await eliminarOrdenie(id);
      await cargarRegistros(filtroFecha);
    } catch (err) {
      setErrorMsg(err?.message || "No se pudo eliminar el registro.");
    }
  };

  const totalLitrosMostrados = useMemo(
    () => registros.reduce((acc, r) => acc + (Number(r.litrosSacados) || 0), 0),
    [registros]
  );

  const litrosHoy = useMemo(
    () =>
      registros
        .filter((r) => r.fecha === hoyLocal)
        .reduce((acc, r) => acc + (Number(r.litrosSacados) || 0), 0),
    [registros, hoyLocal]
  );

  return (
    <div className="space-y-6">
      {/* Banner con flecha atrás al costado */}
      <div className="flex items-stretch gap-3">
        <button
          type="button"
          onClick={alVolver}
          title="Volver a Tambo y Leche"
          aria-label="Volver a Tambo y Leche"
          className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] rounded-2xl px-4 flex items-center justify-center shadow-sm transition-all shrink-0"
        >
          <i className="fa-solid fa-arrow-left text-lg"></i>
        </button>

        <div className="flex-1 bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                Sub-módulo de Ordeñe Diario
              </span>
              <span className="text-xs text-[#ded7c4]">
                {vacasLecheras.length} vacas lecheras disponibles
              </span>
            </div>
            <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
              Vacas Ordeñadas
            </h2>
            <p className="text-xs text-[#ded7c4] mt-1">
              Registrá los litros sacados por fecha e ID de cada vaca lechera (no se permiten fechas futuras).
            </p>
          </div>

          <div className="bg-[#122018] border border-[#33512f] rounded-xl px-4 py-3 text-right">
            <span className="text-[10px] font-bold uppercase text-[#8fb56b] block">
              Ordeñado Hoy ({hoyLocal})
            </span>
            <span className="text-xl font-extrabold text-[#f1ecdd]">
              {litrosHoy.toLocaleString("es-AR")} L
            </span>
            <span className="text-[11px] text-[#ded7c4] block">
              {formatearMonto(litrosHoy * precioLitro, 2)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Formulario de Carga */}
        <form
          onSubmit={manejarGuardar}
          className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm space-y-4 self-start"
        >
          <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
            Registrar Ordeñe
          </h3>

          {vacasLecheras.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              No tenés animales registrados en categoría <strong>Vacas Lecheras</strong> en el módulo Ganado.
            </div>
          ) : (
            <>
              <label className="block text-xs">
                <span className="font-bold text-[#182920] block mb-1">
                  Fecha del día (máx. hoy)
                </span>
                <input
                  type="date"
                  required
                  max={hoyLocal}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] font-bold text-[#182920]"
                />
              </label>

              <label className="block text-xs">
                <span className="font-bold text-[#182920] block mb-1">
                  Parcela
                </span>
                <select
                  value={parcelaFiltro}
                  onChange={(e) => setParcelaFiltro(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] font-bold text-[#182920]"
                >
                  <option value="TODAS">Todas las parcelas</option>
                  {parcelasDisponibles.map((p) => (
                    <option key={p.clave} value={p.clave}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs">
                <span className="font-bold text-[#182920] block mb-1">
                  Vaca Lechera (Caravana)
                </span>
                <select
                  required
                  value={animalId}
                  onChange={(e) => setAnimalId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] font-bold text-[#182920]"
                >
                  {vacasFiltradas.length === 0 ? (
                    <option value="">No hay vacas lecheras que coincidan</option>
                  ) : (
                    vacasFiltradas.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.caravana} · {v.raza} ({v.pesoKg} kg) — {v.potreroNombre || "Sin parcela"}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className="block text-xs">
                <span className="font-bold text-[#182920] block mb-1">
                  Litros Sacados
                </span>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  placeholder="Ej: 24.5"
                  value={litrosSacados}
                  onChange={(e) => setLitrosSacados(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] font-bold text-[#182920]"
                />
              </label>

              <label className="block text-xs">
                <span className="font-bold text-[#182920] block mb-1">
                  Observaciones (opcional)
                </span>
                <input
                  type="text"
                  placeholder="Ej: Ordeñe mañana, buena calidad"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920]"
                />
              </label>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold">
                  {errorMsg}
                </div>
              )}

              {exitoMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
                  {exitoMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={guardando}
                className="w-full bg-[#182920] hover:bg-[#233a2d] text-[#f1ecdd] font-bold text-xs uppercase px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-floppy-disk text-[#8fb56b]"></i>
                {guardando ? "Guardando..." : "Guardar Ordeñe"}
              </button>
            </>
          )}
        </form>

        {/* Historial de Ordeñes */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Historial de Vacas Ordeñadas
              </h3>
              <p className="text-[11px] text-[#6b7c6d]">
                Total listado: <strong>{totalLitrosMostrados.toLocaleString("es-AR")} L</strong> (
                {formatearMonto(totalLitrosMostrados * precioLitro, 2)})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                max={hoyLocal}
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                aria-label="Filtrar por fecha"
                className="text-xs px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] font-semibold text-[#182920]"
              />
              {filtroFecha && (
                <button
                  type="button"
                  onClick={() => setFiltroFecha("")}
                  className="text-xs font-bold text-[#33512f] hover:underline"
                >
                  Ver todos
                </button>
              )}
            </div>
          </div>

          {cargando ? (
            <p className="text-xs text-[#6b7c6d] italic p-4">Cargando registros...</p>
          ) : registros.length === 0 ? (
            <p className="text-xs text-[#6b7c6d] italic p-4 bg-[#f8f5eb] rounded-xl border border-[#ded7c4]">
              No hay registros de ordeñe cargados aún.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#ded7c4] text-[11px] uppercase text-[#6b7c6d]">
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Vaca (Caravana)</th>
                    <th className="py-2.5 px-3 text-right">Litros</th>
                    <th className="py-2.5 px-3 text-right">Valor Est.</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee8d8]">
                  {registros.map((r) => (
                    <tr key={r.id} className="hover:bg-[#f8f5eb] transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-[#182920]">{r.fecha}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-[#33512f] block">{r.caravana}</span>
                        {r.observaciones && (
                          <span className="text-[10px] text-[#6b7c6d]">{r.observaciones}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-[#182920]">
                        {Number(r.litrosSacados).toLocaleString("es-AR")} L
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#33512f]">
                        {formatearMonto(Number(r.litrosSacados) * precioLitro, 2)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => manejarEliminar(r.id)}
                          title="Eliminar registro"
                          className="text-red-600 hover:text-red-800 px-2 py-1 rounded"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
