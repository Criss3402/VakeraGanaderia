import { useState, useEffect } from "react";
import {
  obtenerReproduccion,
  registrarReproduccion,
  eliminarReproduccion,
} from "../../../api/dashboard.api";

export default function ReproduccionSubModulo({ ganado = [], puedeGestionar = false }) {
  const [eventos, setEventos] = useState([]);
  const [resumen, setResumen] = useState({
    evaluadas: 0,
    prenadas: 0,
    vacias: 0,
    prenezPct: 0,
    destetes: 0,
    destetePct: 0,
    edadPrimerServicioMeses: null,
  });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const hembras = ganado.filter(
    (g) => String(g.sexo || "").toLowerCase().includes("hembra") ||
      /vaca|vaquill|ternera/i.test(String(g.categoria || ""))
  );

  const [form, setForm] = useState({
    animalId: "",
    tipo: "TACTO",
    resultado: "PRENADA",
    fecha: new Date().toISOString().split("T")[0],
    edadPrimerServicioMeses: "",
    notas: "",
  });

  async function cargar() {
    try {
      const res = await obtenerReproduccion();
      if (res?.data) {
        setEventos(res.data.eventos || []);
        if (res.data.resumen) setResumen(res.data.resumen);
      }
    } catch (err) {
      setErrorMsg(err.message || "Error al cargar datos reproductivos.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (!form.animalId && hembras.length > 0) {
      setForm((prev) => ({ ...prev, animalId: hembras[0].id }));
    }
  }, [hembras.length]);

  const manejarGuardar = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setMensaje("");
    const animalSel = hembras.find((h) => h.id === form.animalId) || ganado.find((g) => g.id === form.animalId);
    if (!animalSel) {
      setErrorMsg("Seleccioná una hembra del rodeo.");
      return;
    }
    try {
      setGuardando(true);
      await registrarReproduccion({
        animalId: animalSel.id,
        caravana: animalSel.caravana,
        tipo: form.tipo,
        resultado: form.resultado,
        fecha: form.fecha,
        edadPrimerServicioMeses: form.edadPrimerServicioMeses || null,
        notas: form.notas,
      });
      setForm((prev) => ({ ...prev, notas: "", edadPrimerServicioMeses: "" }));
      setMensaje("Evento reproductivo registrado.");
      await cargar();
    } catch (err) {
      setErrorMsg(err.message || "No se pudo registrar el evento.");
    } finally {
      setGuardando(false);
    }
  };

  const manejarEliminar = async (id) => {
    setErrorMsg("");
    try {
      await eliminarReproduccion(id);
      setMensaje("Evento eliminado.");
      await cargar();
    } catch (err) {
      setErrorMsg(err.message || "No se pudo eliminar.");
    }
  };

  if (cargando) {
    return <div className="p-6 text-xs text-[#6b7c6d]">Cargando módulo de Reproducción y Preñez...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs Reproductivos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
          <p className="text-[10px] font-bold text-[#6b7c6d] uppercase">% Preñez</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-0.5">{resumen.prenezPct ?? 0}%</p>
          <span className="text-[11px] text-[#33512f]">{resumen.prenadas ?? 0} preñadas / {resumen.evaluadas ?? 0} eval.</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
          <p className="text-[10px] font-bold text-[#6b7c6d] uppercase">% Destete</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-0.5">{resumen.destetePct ?? 0}%</p>
          <span className="text-[11px] text-[#33512f]">{resumen.destetes ?? 0} destetes logrados</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
          <p className="text-[10px] font-bold text-[#6b7c6d] uppercase">Vacas Vacías</p>
          <p className="text-2xl font-extrabold text-amber-700 mt-0.5">{resumen.vacias ?? 0}</p>
          <span className="text-[11px] text-[#6b7c6d]">Último tacto registrado</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
          <p className="text-[10px] font-bold text-[#6b7c6d] uppercase">1er Servicio Prom.</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-0.5">
            {resumen.edadPrimerServicioMeses ? `${resumen.edadPrimerServicioMeses} m` : "-"}
          </p>
          <span className="text-[11px] text-[#6b7c6d]">Hembras en rodeo: {hembras.length}</span>
        </div>
      </div>

      {mensaje && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
          {mensaje}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {puedeGestionar && (
          <form onSubmit={manejarGuardar} className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm space-y-3">
            <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
              Registrar Tacto / Servicio / Destete
            </h3>

            <label className="block text-xs">
              <span className="font-semibold text-[#182920] block mb-1">Hembra (Caravana)</span>
              <select
                value={form.animalId}
                onChange={(e) => setForm({ ...form, animalId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920]"
              >
                {hembras.length === 0 ? (
                  <option value="">Sin hembras registradas</option>
                ) : (
                  hembras.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.caravana} · {h.categoria} ({h.raza})
                    </option>
                  ))
                )}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="block">
                <span className="font-semibold text-[#182920] block mb-1">Evento</span>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920]"
                >
                  <option value="TACTO">Tacto / Diagnóstico</option>
                  <option value="SERVICIO">Servicio / Entore</option>
                  <option value="PARTO">Parto</option>
                  <option value="DESTETE">Destete</option>
                </select>
              </label>

              <label className="block">
                <span className="font-semibold text-[#182920] block mb-1">Resultado</span>
                <select
                  value={form.resultado}
                  onChange={(e) => setForm({ ...form, resultado: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920]"
                >
                  <option value="PRENADA">Preñada</option>
                  <option value="VACIA">Vacía</option>
                  <option value="LOGRADO">Logrado (Parto/Destete)</option>
                  <option value="PENDIENTE">Pendiente</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="block">
                <span className="font-semibold text-[#182920] block mb-1">Fecha</span>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920]"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-[#182920] block mb-1">Edad 1er serv. (meses)</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Opcional (ej: 24)"
                  value={form.edadPrimerServicioMeses}
                  onChange={(e) => setForm({ ...form, edadPrimerServicioMeses: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920]"
                />
              </label>
            </div>

            <label className="block text-xs">
              <span className="font-semibold text-[#182920] block mb-1">Observaciones</span>
              <input
                type="text"
                placeholder="Ej: Tacto 4 meses, buen estado corporal"
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920]"
              />
            </label>

            <button
              type="submit"
              disabled={guardando || hembras.length === 0}
              className="w-full bg-[#182920] hover:bg-[#264030] text-[#f1ecdd] font-bold text-xs uppercase py-2.5 rounded-xl transition-all"
            >
              {guardando ? "Guardando..." : "+ Registrar Evento Reproductivo"}
            </button>
          </form>
        )}

        <div className={`${puedeGestionar ? "lg:col-span-2" : "lg:col-span-3"} bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm`}>
          <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif] mb-3">
            Historial Reproductivo del Rodeo
          </h3>
          {eventos.length === 0 ? (
            <p className="text-xs text-[#6b7c6d] italic p-4 bg-[#f8f5eb] rounded-xl border border-[#ded7c4]">
              Aún no hay tactos, servicios ni destetes registrados. Los datos que cargues aquí actualizarán automáticamente el % de Preñez y Destete en Reportes.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1 text-xs">
              {eventos.map((ev) => (
                <div key={ev.id} className="p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-[#182920] block">
                      {ev.caravana} · {ev.tipo} — <span className={ev.resultado === "PRENADA" || ev.resultado === "LOGRADO" ? "text-emerald-700" : "text-amber-700"}>{ev.resultado}</span>
                    </span>
                    <span className="text-[11px] text-[#6b7c6d]">
                      {ev.fecha}{ev.notas ? ` · ${ev.notas}` : ""}
                    </span>
                  </div>
                  {puedeGestionar && (
                    <button
                      type="button"
                      onClick={() => manejarEliminar(ev.id)}
                      className="text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50"
                      title="Eliminar"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
