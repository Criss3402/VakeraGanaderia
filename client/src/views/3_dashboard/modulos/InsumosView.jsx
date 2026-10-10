import { useState, useEffect } from "react";
import {
  obtenerInsumos,
  registrarInsumo,
  actualizarStockInsumo,
} from "../../../api/dashboard.api";
import { useAuth } from "../../../context/AuthContext";

export default function InsumosView() {
  const { rol } = useAuth();
  const [insumos, setInsumos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState("TODOS");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const [nuevoInsumo, setNuevoInsumo] = useState({
    nombre: "",
    categoria: "Fármaco",
    stockActual: 20,
    stockMinimo: 10,
    unidad: "Dosis",
    ubicacion: "Depósito Central",
  });
  const [guardando, setGuardando] = useState(false);

  const puedeModificar = rol === "dueno" || rol === "oficina" || rol === "capataz";
  const puedeCrear = rol === "dueno" || rol === "oficina";

  async function cargarDatos() {
    try {
      const res = await obtenerInsumos();
      if (res?.data) setInsumos(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  async function manejarReponer(id, delta, operacion = "sumar") {
    try {
      await actualizarStockInsumo(id, delta, operacion);
      setMensaje("Stock de insumo actualizado en la base de datos.");
      await cargarDatos();
      setTimeout(() => setMensaje(""), 4000);
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  async function manejarCrearInsumo(e) {
    e.preventDefault();
    if (!nuevoInsumo.nombre) return;
    setGuardando(true);
    try {
      await registrarInsumo(nuevoInsumo);
      setMensaje("Nuevo insumo registrado en el inventario.");
      setModalAbierto(false);
      setNuevoInsumo({
        nombre: "",
        categoria: "Fármaco",
        stockActual: 20,
        stockMinimo: 10,
        unidad: "Dosis",
        ubicacion: "Depósito Central",
      });
      await cargarDatos();
      setTimeout(() => setMensaje(""), 4000);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setGuardando(false);
    }
  }

  const insumosFiltrados = insumos.filter((i) => {
    if (filtroCategoria === "TODOS") return true;
    return i.categoria === filtroCategoria;
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              Módulo de Insumos y Stock
            </span>
            <span className="text-xs text-[#8fb56b]">Control de Botiquín & Depósito</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Inventario Ganadero y Herramientas
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-xl">
            Control de medicamentos veterinarios, sales minerales, raciones y herramientas con semáforo automático de stock mínimo.
          </p>
        </div>

        {puedeCrear && (
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <i className="fa-solid fa-cart-plus"></i> + Registrar Insumo / Compra
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
          <span className="text-xs font-bold text-[#182920] uppercase">Categoría:</span>
          {["TODOS", "Fármaco", "Nutrición", "Herramientas"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFiltroCategoria(cat)}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                filtroCategoria === cat
                  ? "bg-[#182920] text-[#f1ecdd] border-[#182920]"
                  : "bg-[#f8f5eb] text-[#4a5c4e] border-[#ded7c4] hover:bg-[#e7dfcb]"
              }`}
            >
              {cat === "TODOS" ? "Todos" : cat}
            </button>
          ))}
        </div>

        <span className="text-xs text-[#6b7c6d]">
          Total: <strong className="text-[#182920]">{insumosFiltrados.length}</strong> productos
        </span>
      </div>

      {/* Grid de Insumos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {insumosFiltrados.map((i) => {
          const esCritico = i.requiereReposicion || i.stockActual <= i.stockMinimo;
          return (
            <div
              key={i.id}
              className={`bg-white rounded-2xl p-5 border shadow-sm transition-all flex flex-col justify-between ${
                esCritico ? "border-red-300 bg-red-50/20" : "border-[#ded7c4]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7c6d] bg-[#f8f5eb] px-2 py-0.5 rounded border border-[#ded7c4]">
                    {i.categoria}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                      esCritico
                        ? "bg-red-100 text-red-800 border-red-300"
                        : "bg-emerald-100 text-emerald-800 border-emerald-300"
                    }`}
                  >
                    {esCritico ? "Bajo Stock" : "OK"}
                  </span>
                </div>

                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#e7dfcb] text-[#182920] flex items-center justify-center text-base flex-shrink-0">
                    <i className={`fa-solid ${i.icono || "fa-box"}`}></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#182920] leading-snug">{i.nombre}</h3>
                    <p className="text-[11px] text-[#6b7c6d]">{i.ubicacion || "Depósito"}</p>
                  </div>
                </div>

                <div className="bg-[#f8f5eb] p-3 rounded-xl border border-[#ded7c4] flex justify-between items-center mb-3 text-xs">
                  <div>
                    <span className="text-[#6b7c6d] block text-[10px] uppercase">Stock Disponible</span>
                    <span className="text-xl font-extrabold text-[#182920]">
                      {i.stockActual} <span className="text-xs font-semibold">{i.unidad}</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#6b7c6d] block text-[10px] uppercase">Punto de Alerta</span>
                    <span className="font-bold text-[#6b4a32]">{i.stockMinimo} {i.unidad}</span>
                  </div>
                </div>
              </div>

              {puedeModificar && (
                <div className="flex items-center justify-between pt-2 border-t border-[#ded7c4]">
                  <span className="text-[10px] font-bold text-[#4a5c4e] uppercase">Ajustar:</span>
                  <div className="space-x-1.5">
                    <button
                      type="button"
                      onClick={() => manejarReponer(i.id, 1, "restar")}
                      className="bg-[#f8f5eb] hover:bg-[#e7dfcb] text-[#182920] border border-[#ded7c4] font-bold text-xs px-2.5 py-1 rounded-lg"
                      title="Registrar consumo"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => manejarReponer(i.id, 5, "sumar")}
                      className="bg-[#f8f5eb] hover:bg-[#e7dfcb] text-[#182920] border border-[#ded7c4] font-bold text-xs px-2.5 py-1 rounded-lg"
                      title="Reponer 5 unidades"
                    >
                      +5
                    </button>
                    <button
                      type="button"
                      onClick={() => manejarReponer(i.id, 20, "sumar")}
                      className="bg-[#182920] hover:bg-[#284835] text-[#f1ecdd] font-bold text-xs px-2.5 py-1 rounded-lg"
                      title="Reponer lote de 20"
                    >
                      +20
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Registrar Insumo */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-md w-full animate-fade-in text-xs">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#ded7c4]">
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Registrar Nuevo Insumo Ganadero
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={manejarCrearInsumo} className="space-y-3">
              <div>
                <label className="block font-bold text-[#182920] mb-1">Nombre del Insumo</label>
                <input
                  type="text"
                  value={nuevoInsumo.nombre}
                  onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, nombre: e.target.value })}
                  placeholder="Ej: Suplemento Mineral / Dectomax"
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Categoría</label>
                  <select
                    value={nuevoInsumo.categoria}
                    onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, categoria: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  >
                    <option value="Fármaco">Fármaco</option>
                    <option value="Nutrición">Nutrición</option>
                    <option value="Herramientas">Herramientas</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Unidad</label>
                  <select
                    value={nuevoInsumo.unidad}
                    onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, unidad: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  >
                    <option value="Dosis">Dosis</option>
                    <option value="Frascos">Frascos</option>
                    <option value="Kg">Kg</option>
                    <option value="Bolsas">Bolsas</option>
                    <option value="Unidades">Unidades</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    min="1"
                    value={nuevoInsumo.stockActual}
                    onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, stockActual: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Alerta Mínimo</label>
                  <input
                    type="number"
                    min="1"
                    value={nuevoInsumo.stockMinimo}
                    onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, stockMinimo: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                    required
                  />
                </div>
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
                  {guardando ? "Guardando..." : "Guardar Insumo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
