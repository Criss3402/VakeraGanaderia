import { useState, useEffect } from "react";
import {
  obtenerGanado,
  obtenerPotreros,
  registrarGanado,
  actualizarGanado,
} from "../../../api/dashboard.api";
import { useAuth } from "../../../context/AuthContext";

export default function GanadoView() {
  const { rol } = useAuth();
  const [ganado, setGanado] = useState([]);
  const [potreros, setPotreros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroPotrero, setFiltroPotrero] = useState("todos");
  const [modalAltaAbierto, setModalAltaAbierto] = useState(false);
  const [modalMoverAbierto, setModalMoverAbierto] = useState(false);
  const [animalAMover, setAnimalAMover] = useState(null);
  const [nuevoPotreroId, setNuevoPotreroId] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [nuevoAnimal, setNuevoAnimal] = useState({
    caravana: "",
    categoria: "Vacas",
    raza: "Angus Negro",
    sexo: "Hembra",
    pesoKg: 420,
    estadoSanitario: "SALUDABLE",
    potreroId: "",
  });
  const [guardando, setGuardando] = useState(false);

  const puedeRegistrar = rol === "dueno" || rol === "capataz";
  const puedeMover = rol === "dueno" || rol === "capataz";

  async function cargarDatos() {
    try {
      const [resGan, resPot] = await Promise.all([
        obtenerGanado(),
        obtenerPotreros(),
      ]);
      if (resGan?.data) setGanado(resGan.data);
      if (resPot?.data) {
        setPotreros(resPot.data);
        if (resPot.data.length > 0 && !nuevoPotreroId) {
          setNuevoPotreroId(resPot.data[0].id);
        }
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

  async function manejarAltaAnimal(e) {
    e.preventDefault();
    if (!nuevoAnimal.caravana) return;
    setGuardando(true);
    try {
      await registrarGanado(nuevoAnimal);
      setMensaje(`Animal ${nuevoAnimal.caravana} registrado en la base de datos.`);
      setModalAltaAbierto(false);
      setNuevoAnimal({
        caravana: "",
        categoria: "Vacas",
        raza: "Angus Negro",
        sexo: "Hembra",
        pesoKg: 420,
        estadoSanitario: "SALUDABLE",
        potreroId: potreros[0]?.id || "",
      });
      await cargarDatos();
      setTimeout(() => setMensaje(""), 4000);
    } catch (err) {
      alert("Error al registrar animal: " + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function manejarTraslado() {
    if (!animalAMover || !nuevoPotreroId) return;
    try {
      await actualizarGanado(animalAMover.id, { potreroId: nuevoPotreroId });
      setMensaje(`Animal ${animalAMover.caravana} trasladado al nuevo potrero.`);
      setModalMoverAbierto(false);
      setAnimalAMover(null);
      await cargarDatos();
      setTimeout(() => setMensaje(""), 4000);
    } catch (err) {
      alert("Error al trasladar animal: " + err.message);
    }
  }

  const ganadoFiltrado = filtroPotrero === "todos"
    ? ganado
    : ganado.filter((g) => g.potreroId === filtroPotrero);

  return (
    <div className="space-y-6">
      {/* Encabezado Módulo Ganado */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              Módulo de Ganado & Potreros
            </span>
            <span className="text-xs text-[#8fb56b]">Sincronizado con PostgreSQL</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Ficha de Rodeo y Trazabilidad Individual
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-xl">
            Registro por caravana, raza, categoría, peso vivo, estado sanitario y potrero asignado.
          </p>
        </div>

        {puedeRegistrar && (
          <button
            type="button"
            onClick={() => {
              if (potreros.length > 0 && !nuevoAnimal.potreroId) {
                setNuevoAnimal((v) => ({ ...v, potreroId: potreros[0].id }));
              }
              setModalAltaAbierto(true);
            }}
            className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <i className="fa-solid fa-plus-circle"></i> + Alta de Animal
          </button>
        )}
      </div>

      {mensaje && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm animate-fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600 text-lg"></i>
          <span>{mensaje}</span>
        </div>
      )}

      {/* Filtros por Potrero y Métricas rápidas */}
      <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-[#182920] uppercase">Filtrar Potrero:</label>
          <select
            value={filtroPotrero}
            onChange={(e) => setFiltroPotrero(e.target.value)}
            className="text-xs font-semibold bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-1.5 text-[#182920] outline-none"
          >
            <option value="todos">Todos los Potreros ({ganado.length} cabezas)</option>
            {potreros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.totalAnimales ?? 0} cabezas)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#6b7c6d]">
          <span>Mostrando: <strong className="text-[#182920]">{ganadoFiltrado.length}</strong> cabezas</span>
          <span>·</span>
          <span>Potreros activos: <strong className="text-[#182920]">{potreros.length}</strong></span>
        </div>
      </div>

      {/* Tabla de Ganado */}
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#ded7c4] text-[#4a5c4e] uppercase font-bold text-[10px]">
                <th className="py-2.5 px-3">Caravana</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3">Raza & Sexo</th>
                <th className="py-2.5 px-3">Peso Vivo</th>
                <th className="py-2.5 px-3">Potrero Actual</th>
                <th className="py-2.5 px-3">Estado Clínico</th>
                {puedeMover && <th className="py-2.5 px-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ded7c4]">
              {ganadoFiltrado.map((g) => {
                const esSaludable = g.estadoSanitario === "SALUDABLE";
                return (
                  <tr key={g.id} className="hover:bg-[#f8f5eb] transition-colors">
                    <td className="py-3 px-3 font-bold text-[#182920]">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-[#e7dfcb] flex items-center justify-center text-[10px] text-[#182920]">
                          <i className="fa-solid fa-tag"></i>
                        </span>
                        {g.caravana}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#182920]">{g.categoria}</td>
                    <td className="py-3 px-3 text-[#555]">{g.raza} ({g.sexo})</td>
                    <td className="py-3 px-3 font-bold text-[#182920]">{g.pesoKg} kg</td>
                    <td className="py-3 px-3 font-medium text-[#33512f]">
                      {g.potreroNombre || g.potrero?.nombre || "Sin asignar"}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                          esSaludable
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : g.estadoSanitario === "EN_TRATAMIENTO"
                            ? "bg-red-100 text-red-800 border-red-300"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                        }`}
                      >
                        {g.estadoSanitario}
                      </span>
                    </td>
                    {puedeMover && (
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setAnimalAMover(g);
                            setNuevoPotreroId(g.potreroId || potreros[0]?.id || "");
                            setModalMoverAbierto(true);
                          }}
                          className="bg-[#f8f5eb] hover:bg-[#e7dfcb] text-[#182920] border border-[#ded7c4] font-bold text-[10px] px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <i className="fa-solid fa-right-left text-[#33512f]"></i> Trasladar
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Alta de Animal */}
      {modalAltaAbierto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-md w-full animate-fade-in">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#ded7c4]">
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Registrar Nuevo Animal en el Rodeo
              </h3>
              <button
                type="button"
                onClick={() => setModalAltaAbierto(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={manejarAltaAnimal} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#182920] mb-1">Número de Caravana (Único)</label>
                <input
                  type="text"
                  value={nuevoAnimal.caravana}
                  onChange={(e) => setNuevoAnimal({ ...nuevoAnimal, caravana: e.target.value })}
                  placeholder="Ej: AR-84930"
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Categoría</label>
                  <select
                    value={nuevoAnimal.categoria}
                    onChange={(e) => setNuevoAnimal({ ...nuevoAnimal, categoria: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  >
                    <option value="Vacas">Vacas</option>
                    <option value="Toros">Toros</option>
                    <option value="Novillos">Novillos</option>
                    <option value="Terneras">Terneras</option>
                    <option value="Vaquillonas">Vaquillonas</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Sexo</label>
                  <select
                    value={nuevoAnimal.sexo}
                    onChange={(e) => setNuevoAnimal({ ...nuevoAnimal, sexo: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  >
                    <option value="Hembra">Hembra</option>
                    <option value="Macho">Macho</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Raza</label>
                  <input
                    type="text"
                    value={nuevoAnimal.raza}
                    onChange={(e) => setNuevoAnimal({ ...nuevoAnimal, raza: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Peso en Balanza (kg)</label>
                  <input
                    type="number"
                    min="20"
                    max="1500"
                    value={nuevoAnimal.pesoKg}
                    onChange={(e) => setNuevoAnimal({ ...nuevoAnimal, pesoKg: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#182920] mb-1">Potrero Asignado</label>
                <select
                  value={nuevoAnimal.potreroId}
                  onChange={(e) => setNuevoAnimal({ ...nuevoAnimal, potreroId: e.target.value })}
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

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalAltaAbierto(false)}
                  className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2 rounded-xl bg-[#182920] text-[#f1ecdd] font-bold hover:bg-[#284835]"
                >
                  {guardando ? "Guardando..." : "Registrar en Base de Datos"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Trasladar Animal */}
      {modalMoverAbierto && animalAMover && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-sm w-full animate-fade-in text-xs">
            <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif] mb-2">
              Trasladar Animal {animalAMover.caravana}
            </h3>
            <p className="text-[#6b7c6d] mb-4">
              Selecciona el potrero de destino para registrar el movimiento de hacienda:
            </p>

            <label className="block font-bold text-[#182920] mb-1">Nuevo Potrero:</label>
            <select
              value={nuevoPotreroId}
              onChange={(e) => setNuevoPotreroId(e.target.value)}
              className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none mb-4"
            >
              {potreros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.totalAnimales ?? 0} cabezas)
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalMoverAbierto(false)}
                className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={manejarTraslado}
                className="px-5 py-2 rounded-xl bg-[#182920] text-[#f1ecdd] font-bold hover:bg-[#284835]"
              >
                Confirmar Traslado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
