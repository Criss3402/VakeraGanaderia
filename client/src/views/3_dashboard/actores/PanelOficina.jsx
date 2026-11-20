import { useState, useEffect } from "react";
import {
  obtenerInsumos,
  actualizarStockInsumo,
  registrarInsumo,
  obtenerReportes,
} from "../../../api/dashboard.api";

export default function PanelOficina({ alCambiarVista }) {
  const [insumos, setInsumos] = useState([]);
  const [reportes, setReportes] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [modalCompraAbierto, setModalCompraAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // Nuevo insumo / compra
  const [nuevoInsumo, setNuevoInsumo] = useState({
    nombre: "",
    categoria: "Fármaco",
    stockActual: 20,
    stockMinimo: 10,
    unidad: "Dosis",
    ubicacion: "Depósito Central",
  });
  const [guardando, setGuardando] = useState(false);

  async function cargarDatos() {
    try {
      const [resInsumos, resRep] = await Promise.all([
        obtenerInsumos(),
        obtenerReportes(),
      ]);
      if (resInsumos?.data) setInsumos(resInsumos.data);
      if (resRep?.data) setReportes(resRep.data);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  async function manejarReponerStock(id, cantidad) {
    try {
      await actualizarStockInsumo(id, cantidad, "sumar");
      setMensaje("Stock repuesto y registrado en la base de datos.");
      await cargarDatos();
      setTimeout(() => setMensaje(""), 4000);
    } catch (e) {
      alert("Error al reponer stock: " + e.message);
    }
  }

  async function manejarCrearInsumo(e) {
    e.preventDefault();
    if (!nuevoInsumo.nombre) return;
    setGuardando(true);
    try {
      await registrarInsumo(nuevoInsumo);
      setMensaje("Nuevo insumo registrado en el inventario.");
      setModalCompraAbierto(false);
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
      alert("Error al registrar insumo: " + err.message);
    } finally {
      setGuardando(false);
    }
  }

  const bajoStockCount = insumos.filter(
    (i) => i.requiereReposicion || i.stockActual <= i.stockMinimo
  ).length;

  return (
    <div className="space-y-6">
      {/* Banner Oficina */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              Rol: Oficina & Administración
            </span>
            <span className="text-xs text-[#8fb56b]">Compras & Finanzas Ganaderas</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Gestión Administrativa y Documental
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-xl">
            Control de inventario, compras de vacunas y raciones, balance operativo y seguimiento de comprobantes oficiales.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalCompraAbierto(true)}
          className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
        >
          <i className="fa-solid fa-cart-plus"></i> Registrar Compra / Factura
        </button>
      </div>

      {mensaje && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm animate-fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600 text-lg"></i>
          <span>{mensaje}</span>
        </div>
      )}

      {/* KPI Cards Administrativos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Insumos Registrados</p>
          <p className="text-3xl font-extrabold text-[#182920] mt-1">{insumos.length}</p>
          <span className="text-[11px] text-[#33512f]">Artículos en depósito</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-red-700 uppercase">Alertas de Reposición</p>
          <p className="text-3xl font-extrabold text-red-800 mt-1">{bajoStockCount}</p>
          <span className="text-[11px] text-red-600">Por debajo del stock mínimo</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Valuación Hacienda Ref.</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-1">
            ${reportes?.resumenGeneral?.valorHaciendaEstimado?.toLocaleString("es-AR") || "5.028.000"}
          </p>
          <span className="text-[11px] text-[#33512f]">ARS (precio kg vivo de referencia)</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm">
          <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Partes Procesados</p>
          <p className="text-3xl font-extrabold text-[#182920] mt-1">
            {reportes?.resumenGeneral?.partesAprobados ?? 1} / {reportes?.resumenGeneral?.partesProcesados ?? 2}
          </p>
          <span className="text-[11px] text-[#33512f]">Aprobados por el capataz</span>
        </div>
      </div>

      {/* Tabla de Insumos con Acción Rápida de Compra/Reposición */}
      <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ded7c4]">
          <div>
            <h3 className="text-lg font-bold text-[#182920] font-['Fraunces',serif]">
              Stock de Insumos & Reposición Directa
            </h3>
            <p className="text-xs text-[#6b7c6d]">
              Sincronización en tiempo real: reponé o sumá stock al instante
            </p>
          </div>
          <button
            type="button"
            onClick={() => alCambiarVista && alCambiarVista("insumos")}
            className="text-xs text-[#33512f] font-bold hover:underline"
          >
            Ver catálogo completo →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#ded7c4] text-[#4a5c4e] uppercase font-bold text-[10px]">
                <th className="py-2.5 px-3">Insumo</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3">Stock Actual</th>
                <th className="py-2.5 px-3">Mínimo</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3 text-right">Reponer Rápido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ded7c4]">
              {insumos.map((i) => {
                const esBajo = i.requiereReposicion || i.stockActual <= i.stockMinimo;
                return (
                  <tr key={i.id} className="hover:bg-[#f8f5eb] transition-colors">
                    <td className="py-3 px-3 font-bold text-[#182920] flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-[#e7dfcb] flex items-center justify-center text-[10px]">
                        <i className={`fa-solid ${i.icono || "fa-box"}`}></i>
                      </div>
                      {i.nombre}
                    </td>
                    <td className="py-3 px-3 text-[#6b7c6d]">{i.categoria}</td>
                    <td className="py-3 px-3 font-bold text-[#182920]">
                      {i.stockActual} {i.unidad}
                    </td>
                    <td className="py-3 px-3 text-[#6b7c6d]">
                      {i.stockMinimo} {i.unidad}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                          esBajo
                            ? "bg-red-100 text-red-800 border-red-300"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                        }`}
                      >
                        {esBajo ? "Bajo Stock" : "OK"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => manejarReponerStock(i.id, 10)}
                        className="bg-[#f8f5eb] hover:bg-[#e7dfcb] text-[#182920] border border-[#ded7c4] font-bold text-[10px] px-2 py-1 rounded-md transition-colors"
                      >
                        +10 {i.unidad}
                      </button>
                      <button
                        type="button"
                        onClick={() => manejarReponerStock(i.id, 50)}
                        className="bg-[#182920] hover:bg-[#284835] text-[#f1ecdd] font-bold text-[10px] px-2 py-1 rounded-md transition-colors"
                      >
                        +50 {i.unidad}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Carga de Insumo / Factura */}
      {modalCompraAbierto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-md w-full animate-fade-in">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#ded7c4]">
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Registrar Ingreso de Insumo / Factura
              </h3>
              <button
                type="button"
                onClick={() => setModalCompraAbierto(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={manejarCrearInsumo} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#182920] mb-1">Nombre del Insumo / Fármaco</label>
                <input
                  type="text"
                  value={nuevoInsumo.nombre}
                  onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, nombre: e.target.value })}
                  placeholder="Ej: Vacuna Carbunclo 100ml"
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
                    <option value="Nutrición">Nutrición / Sales</option>
                    <option value="Herramientas">Herramientas</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Unidad de Medida</label>
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
                  <label className="block font-bold text-[#182920] mb-1">Cantidad Comprada</label>
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
                  <label className="block font-bold text-[#182920] mb-1">Stock Mínimo Alerta</label>
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
                  onClick={() => setModalCompraAbierto(false)}
                  className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2 rounded-xl bg-[#182920] text-[#f1ecdd] font-bold hover:bg-[#284835]"
                >
                  {guardando ? "Guardando..." : "Guardar en Inventario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
