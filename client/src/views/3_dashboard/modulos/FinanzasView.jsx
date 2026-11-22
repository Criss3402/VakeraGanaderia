import { useState, useEffect } from "react";
import {
  obtenerFinanzas,
  obtenerDolar,
  registrarCostoFinanzas,
  eliminarCostoFinanzas,
  guardarParametrosFinanzas,
} from "../../../api/dashboard.api";
import { obtenerUsuariosRegistrados } from "../../../api/permisos.api";
import { useAuth } from "../../../context/AuthContext";

const RUBROS = [
  "Compra de toros",
  "Comercialización",
  "Personal",
  "Sanidad",
  "Alimentación",
  "Amortizaciones",
];

const ROLES_PERSONAL = [
  { value: "peon", label: "Peón" },
  { value: "capataz", label: "Capataz" },
  { value: "oficina", label: "Administración" },
  { value: "veterinario", label: "Veterinario" },
];

const DETALLES_INICIALES = {
  // Compra de toros (animales)
  cabezas: "1",
  identificador: "",
  pesoKg: "",
  edadValor: "",
  edadUnidad: "Años",
  // Personal
  rolPersonal: "peon",
  empleadoId: "",
  // Sanidad
  productoSanidad: "",
  dosisCantidad: "",
  loteCategoria: "",
  // Alimentación
  tipoAlimento: "",
  cantidadAlimento: "",
  unidadAlimento: "Kg",
  // Comercialización
  tipoOperacion: "Venta en feria / consignataria",
  cabezasComerc: "",
  // Amortizaciones
  bienAmortizacion: "Maquinaria / Equipos",
  periodoAmortizacion: "Anual",
};

export default function FinanzasView({
  vistaSubModulo = "costos",
  alCambiarSubModulo,
}) {
  const { rol } = useAuth();
  const puedeEditar = rol === "dueno" || rol === "oficina";

  const [subTab, setSubTab] = useState(vistaSubModulo === "parametros" ? "parametros" : "costos");
  const [costos, setCostos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [porRubroUsd, setPorRubroUsd] = useState({});
  const [totalUsd, setTotalUsd] = useState(0);
  const [dolarVenta, setDolarVenta] = useState(1600);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [nuevoCosto, setNuevoCosto] = useState({
    rubro: "Compra de toros",
    descripcion: "",
    moneda: "USD",
    monto: "",
    fecha: new Date().toISOString().split("T")[0],
  });
  const [detalles, setDetalles] = useState(DETALLES_INICIALES);

  const [parametros, setParametros] = useState({
    reposicionHembrasPct: 0,
    reposicionTorosPct: 0,
    mortandadPct: 0,
    edadPrimerServicioMeses: 0,
    duracionCorralDias: 0,
    gananciaNovillosKgDia: 0,
    gananciaVaquillonasKgDia: 0,
    relacionNovilloMaiz: 0,
  });

  useEffect(() => {
    setSubTab(vistaSubModulo === "parametros" ? "parametros" : "costos");
  }, [vistaSubModulo]);

  async function cargarDatos() {
    try {
      const [resFin, resDol, resUsr] = await Promise.all([
        obtenerFinanzas(),
        obtenerDolar().catch(() => null),
        obtenerUsuariosRegistrados().catch(() => null),
      ]);
      const d = Number(resDol?.data?.cotizaciones?.oficial?.venta) || 1600;
      setDolarVenta(d);
      if (resUsr?.data && Array.isArray(resUsr.data)) {
        setUsuarios(resUsr.data);
      }
      if (resFin?.data) {
        setCostos(resFin.data.costos || []);
        setPorRubroUsd(resFin.data.porRubroUsd || {});
        setTotalUsd(Number(resFin.data.totalUsd) || 0);
        if (resFin.data.parametros) {
          setParametros((prev) => ({ ...prev, ...resFin.data.parametros }));
        }
      }
    } catch (err) {
      setErrorMsg(err.message || "Error al cargar costos y finanzas.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  const usuariosDelRol = usuarios.filter(
    (u) => String(u.rol || "").toLowerCase() === detalles.rolPersonal
  );

  const cambiarPestana = (tab) => {
    setSubTab(tab);
    if (alCambiarSubModulo) alCambiarSubModulo(tab);
  };

  const construirResumenYDetalles = () => {
    const r = nuevoCosto.rubro;
    if (r === "Compra de toros") {
      const partes = [];
      if (detalles.cabezas) partes.push(`${detalles.cabezas} cab.`);
      if (detalles.identificador) partes.push(`ID ${detalles.identificador.toUpperCase()}`);
      if (detalles.pesoKg) partes.push(`${detalles.pesoKg} kg`);
      if (detalles.edadValor) partes.push(`${detalles.edadValor} ${detalles.edadUnidad}`);
      return {
        descripcionAuto: partes.join(" · "),
        detallesObj: {
          cabezas: Number(detalles.cabezas) || 1,
          identificador: detalles.identificador.trim().toUpperCase(),
          pesoKg: Number(detalles.pesoKg) || null,
          edad: detalles.edadValor ? `${detalles.edadValor} ${detalles.edadUnidad}` : null,
        },
      };
    }
    if (r === "Personal") {
      const rolLabel = ROLES_PERSONAL.find((rp) => rp.value === detalles.rolPersonal)?.label || detalles.rolPersonal;
      const emp = usuarios.find((u) => u.id === detalles.empleadoId);
      const partes = [rolLabel];
      if (emp) partes.push(emp.nombre);
      return {
        descripcionAuto: partes.join(" · "),
        detallesObj: {
          rolPersonal: detalles.rolPersonal,
          rolLabel,
          empleadoId: emp?.id || null,
          empleadoNombre: emp?.nombre || "General",
        },
      };
    }
    if (r === "Sanidad") {
      const partes = [detalles.productoSanidad, detalles.dosisCantidad, detalles.loteCategoria].filter(Boolean);
      return {
        descripcionAuto: partes.join(" · "),
        detallesObj: {
          producto: detalles.productoSanidad,
          dosis: detalles.dosisCantidad,
          lote: detalles.loteCategoria,
        },
      };
    }
    if (r === "Alimentación") {
      const partes = [
        detalles.tipoAlimento,
        detalles.cantidadAlimento ? `${detalles.cantidadAlimento} ${detalles.unidadAlimento}` : "",
      ].filter(Boolean);
      return {
        descripcionAuto: partes.join(" · "),
        detallesObj: {
          alimento: detalles.tipoAlimento,
          cantidad: Number(detalles.cantidadAlimento) || null,
          unidad: detalles.unidadAlimento,
        },
      };
    }
    if (r === "Comercialización") {
      const partes = [
        detalles.tipoOperacion,
        detalles.cabezasComerc ? `${detalles.cabezasComerc} cab.` : "",
      ].filter(Boolean);
      return {
        descripcionAuto: partes.join(" · "),
        detallesObj: {
          operacion: detalles.tipoOperacion,
          cabezas: Number(detalles.cabezasComerc) || null,
        },
      };
    }
    return {
      descripcionAuto: `${detalles.bienAmortizacion} (${detalles.periodoAmortizacion})`,
      detallesObj: {
        bien: detalles.bienAmortizacion,
        periodo: detalles.periodoAmortizacion,
      },
    };
  };

  const manejarRegistrarCosto = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setMensaje("");
    const valor = Number(nuevoCosto.monto) || 0;
    if (valor <= 0) {
      setErrorMsg("Ingresá un monto mayor a cero.");
      return;
    }
    const montoUsd = nuevoCosto.moneda === "USD" ? valor : valor / dolarVenta;
    const montoArs = nuevoCosto.moneda === "ARS" ? valor : valor * dolarVenta;
    const { descripcionAuto, detallesObj } = construirResumenYDetalles();
    const descripcionFinal = [descripcionAuto, nuevoCosto.descripcion.trim()].filter(Boolean).join(" — ") || nuevoCosto.rubro;

    try {
      setGuardando(true);
      await registrarCostoFinanzas({
        rubro: nuevoCosto.rubro,
        descripcion: descripcionFinal,
        detalles: detallesObj,
        montoUsd: Math.round(montoUsd * 100) / 100,
        montoArs: Math.round(montoArs),
        fecha: nuevoCosto.fecha,
      });
      setNuevoCosto((prev) => ({ ...prev, descripcion: "", monto: "" }));
      setDetalles((prev) => ({
        ...DETALLES_INICIALES,
        rolPersonal: prev.rolPersonal,
      }));
      setMensaje("Costo operativo registrado correctamente.");
      await cargarDatos();
    } catch (err) {
      setErrorMsg(err.message || "No se pudo registrar el costo.");
    } finally {
      setGuardando(false);
    }
  };

  const manejarEliminarCosto = async (id) => {
    setErrorMsg("");
    try {
      await eliminarCostoFinanzas(id);
      setMensaje("Registro de costo eliminado.");
      await cargarDatos();
    } catch (err) {
      setErrorMsg(err.message || "No se pudo eliminar el costo.");
    }
  };

  const manejarGuardarParametros = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setMensaje("");
    try {
      setGuardando(true);
      await guardarParametrosFinanzas(parametros);
      setMensaje("Parámetros productivos del establecimiento guardados.");
      await cargarDatos();
    } catch (err) {
      setErrorMsg(err.message || "No se pudieron guardar los parámetros.");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="p-8 text-center text-[#6b7c6d] text-sm">
        Cargando módulo de Costos y Finanzas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner (con flecha atrás cuando está en el sub-módulo Parámetros) */}
      <div className={subTab === "parametros" ? "flex items-stretch gap-3" : ""}>
        {subTab === "parametros" && (
          <button
            type="button"
            onClick={() => cambiarPestana("costos")}
            title="Volver a Costos y Finanzas"
            aria-label="Volver a Costos y Finanzas"
            className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] rounded-2xl px-4 flex items-center justify-center shadow-sm transition-all shrink-0"
          >
            <i className="fa-solid fa-arrow-left text-lg"></i>
          </button>
        )}
        <div className="flex-1 bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-[#8fb56b]">Integrado con Margen Bruto PDF</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Gestión de Costos Operativos y Parámetros
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1">
            Registrá los costos por rubro en U$S o ARS y los parámetros productivos del establecimiento. Dólar ref.: ${dolarVenta.toLocaleString("es-AR")}.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#203628] p-1.5 rounded-xl border border-[#33512f]">
          <button
            type="button"
            onClick={() => cambiarPestana("costos")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === "costos" ? "bg-[#8fb56b] text-[#182920]" : "text-[#ded7c4] hover:text-white"
            }`}
          >
            Costos Operativos
          </button>
          <button
            type="button"
            onClick={() => cambiarPestana("parametros")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === "parametros" ? "bg-[#8fb56b] text-[#182920]" : "text-[#ded7c4] hover:text-white"
            }`}
          >
            Parámetros Modelo
          </button>
        </div>
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

      {subTab === "costos" ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
              <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Costo Total (U$S)</p>
              <p className="text-2xl font-extrabold text-[#182920] mt-1">
                US$ {totalUsd.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
              <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Costo Total (ARS)</p>
              <p className="text-2xl font-extrabold text-[#182920] mt-1">
                ${Math.round(totalUsd * dolarVenta).toLocaleString("es-AR")}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
              <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Sanidad + Alim.</p>
              <p className="text-2xl font-extrabold text-[#33512f] mt-1">
                US$ {((porRubroUsd.sanidadUsd || 0) + (porRubroUsd.alimentacionUsd || 0)).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
              <p className="text-[11px] font-bold text-[#6b7c6d] uppercase">Registros</p>
              <p className="text-2xl font-extrabold text-[#182920] mt-1">{costos.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {puedeEditar && (
              <form
                onSubmit={manejarRegistrarCosto}
                className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm space-y-3"
              >
                <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                  Registrar Costo
                </h3>

                <label className="block text-xs">
                  <span className="font-semibold text-[#182920] block mb-1">Rubro</span>
                  <select
                    value={nuevoCosto.rubro}
                    onChange={(e) => setNuevoCosto({ ...nuevoCosto, rubro: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920]"
                  >
                    {RUBROS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>

                {/* Campos dinámicos por rubro */}
                {nuevoCosto.rubro === "Compra de toros" && (
                  <div className="p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] space-y-2.5 text-xs">
                    <p className="text-[10px] font-extrabold uppercase text-[#33512f]">Datos del Animal</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="font-semibold text-[#182920] block mb-1">Cabezas</span>
                        <input
                          type="number"
                          min="1"
                          value={detalles.cabezas}
                          onChange={(e) => setDetalles({ ...detalles, cabezas: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-[#182920] block mb-1">N° Identificador</span>
                        <input
                          type="text"
                          placeholder="Ej: AR-501"
                          value={detalles.identificador}
                          onChange={(e) => setDetalles({ ...detalles, identificador: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="block">
                        <span className="font-semibold text-[#182920] block mb-1">Peso (Kg)</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="520"
                          value={detalles.pesoKg}
                          onChange={(e) => setDetalles({ ...detalles, pesoKg: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-[#182920] block mb-1">Edad</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="2"
                          value={detalles.edadValor}
                          onChange={(e) => setDetalles({ ...detalles, edadValor: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-[#182920] block mb-1">Unidad</span>
                        <select
                          value={detalles.edadUnidad}
                          onChange={(e) => setDetalles({ ...detalles, edadUnidad: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                        >
                          <option value="Años">Años</option>
                          <option value="Meses">Meses</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                {nuevoCosto.rubro === "Personal" && (
                  <div className="p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] space-y-2.5 text-xs">
                    <p className="text-[10px] font-extrabold uppercase text-[#33512f]">Asignación de Personal</p>
                    <label className="block">
                      <span className="font-semibold text-[#182920] block mb-1">Área / Rol</span>
                      <select
                        value={detalles.rolPersonal}
                        onChange={(e) => setDetalles({ ...detalles, rolPersonal: e.target.value, empleadoId: "" })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                      >
                        {ROLES_PERSONAL.map((rp) => (
                          <option key={rp.value} value={rp.value}>{rp.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="font-semibold text-[#182920] block mb-1">Seleccionar Persona</span>
                      <select
                        value={detalles.empleadoId}
                        onChange={(e) => setDetalles({ ...detalles, empleadoId: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                      >
                        <option value="">General / Sin especificar</option>
                        {usuariosDelRol.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre} ({u.email})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {nuevoCosto.rubro === "Sanidad" && (
                  <div className="p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] space-y-2.5 text-xs">
                    <p className="text-[10px] font-extrabold uppercase text-[#33512f]">Detalle Sanitario</p>
                    <label className="block">
                      <span className="font-semibold text-[#182920] block mb-1">Producto / Vacuna</span>
                      <input
                        type="text"
                        placeholder="Ej: Antiaftosa / Ivermectina"
                        value={detalles.productoSanidad}
                        onChange={(e) => setDetalles({ ...detalles, productoSanidad: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="font-semibold text-[#182920] block mb-1">Dosis / Cant.</span>
                        <input
                          type="text"
                          placeholder="Ej: 100 dosis"
                          value={detalles.dosisCantidad}
                          onChange={(e) => setDetalles({ ...detalles, dosisCantidad: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-[#182920] block mb-1">Lote / Categoría</span>
                        <input
                          type="text"
                          placeholder="Ej: Terneras / Lote 2"
                          value={detalles.loteCategoria}
                          onChange={(e) => setDetalles({ ...detalles, loteCategoria: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {nuevoCosto.rubro === "Alimentación" && (
                  <div className="p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] space-y-2.5 text-xs">
                    <p className="text-[10px] font-extrabold uppercase text-[#33512f]">Detalle de Alimentación</p>
                    <label className="block">
                      <span className="font-semibold text-[#182920] block mb-1">Alimento / Suplemento</span>
                      <input
                        type="text"
                        placeholder="Ej: Maíz partido / Rollos alfalfa"
                        value={detalles.tipoAlimento}
                        onChange={(e) => setDetalles({ ...detalles, tipoAlimento: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="font-semibold text-[#182920] block mb-1">Cantidad</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="1500"
                          value={detalles.cantidadAlimento}
                          onChange={(e) => setDetalles({ ...detalles, cantidadAlimento: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-[#182920] block mb-1">Unidad</span>
                        <select
                          value={detalles.unidadAlimento}
                          onChange={(e) => setDetalles({ ...detalles, unidadAlimento: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                        >
                          <option value="Kg">Kg</option>
                          <option value="Tn">Toneladas</option>
                          <option value="Rollos">Rollos</option>
                          <option value="Bolsas">Bolsas</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                {nuevoCosto.rubro === "Comercialización" && (
                  <div className="p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] space-y-2.5 text-xs">
                    <p className="text-[10px] font-extrabold uppercase text-[#33512f]">Detalle de Comercialización</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="font-semibold text-[#182920] block mb-1">Operación</span>
                        <select
                          value={detalles.tipoOperacion}
                          onChange={(e) => setDetalles({ ...detalles, tipoOperacion: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                        >
                          <option value="Venta en feria / consignataria">Feria / Consignataria</option>
                          <option value="Venta a frigorífico">Frigorífico</option>
                          <option value="Flete / Transporte">Flete / Transporte</option>
                          <option value="Guías e impuestos">Guías e impuestos</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="font-semibold text-[#182920] block mb-1">Cabezas</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="Ej: 20"
                          value={detalles.cabezasComerc}
                          onChange={(e) => setDetalles({ ...detalles, cabezasComerc: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {nuevoCosto.rubro === "Amortizaciones" && (
                  <div className="p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] space-y-2.5 text-xs">
                    <p className="text-[10px] font-extrabold uppercase text-[#33512f]">Detalle de Amortización</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="font-semibold text-[#182920] block mb-1">Bien / Infraestructura</span>
                        <select
                          value={detalles.bienAmortizacion}
                          onChange={(e) => setDetalles({ ...detalles, bienAmortizacion: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                        >
                          <option value="Maquinaria / Equipos">Maquinaria / Equipos</option>
                          <option value="Alambrados">Alambrados</option>
                          <option value="Aguadas / Molinos">Aguadas / Molinos</option>
                          <option value="Manga / Corrales">Manga / Corrales</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="font-semibold text-[#182920] block mb-1">Período</span>
                        <select
                          value={detalles.periodoAmortizacion}
                          onChange={(e) => setDetalles({ ...detalles, periodoAmortizacion: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920]"
                        >
                          <option value="Anual">Anual</option>
                          <option value="Mensual">Mensual</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                <label className="block text-xs">
                  <span className="font-semibold text-[#182920] block mb-1">Notas adicionales (opcional)</span>
                  <input
                    type="text"
                    placeholder="Observación o comprobante..."
                    value={nuevoCosto.descripcion}
                    onChange={(e) => setNuevoCosto({ ...nuevoCosto, descripcion: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920]"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className="block">
                    <span className="font-semibold text-[#182920] block mb-1">Moneda</span>
                    <select
                      value={nuevoCosto.moneda}
                      onChange={(e) => setNuevoCosto({ ...nuevoCosto, moneda: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920]"
                    >
                      <option value="USD">Dólares (U$S)</option>
                      <option value="ARS">Pesos ($ ARS)</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="font-semibold text-[#182920] block mb-1">Monto</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      placeholder="0.00"
                      value={nuevoCosto.monto}
                      onChange={(e) => setNuevoCosto({ ...nuevoCosto, monto: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920]"
                    />
                  </label>
                </div>

                <label className="block text-xs">
                  <span className="font-semibold text-[#182920] block mb-1">Fecha</span>
                  <input
                    type="date"
                    value={nuevoCosto.fecha}
                    onChange={(e) => setNuevoCosto({ ...nuevoCosto, fecha: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920]"
                  />
                </label>

                <button
                  type="submit"
                  disabled={guardando}
                  className="w-full bg-[#182920] hover:bg-[#264030] text-[#f1ecdd] font-bold text-xs uppercase py-2.5 rounded-xl transition-all"
                >
                  {guardando ? "Guardando..." : "+ Agregar Costo"}
                </button>
              </form>
            )}

            <div className={`${puedeEditar ? "lg:col-span-2" : "lg:col-span-3"} bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm`}>
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif] mb-3">
                Historial de Costos por Rubro
              </h3>
              {costos.length === 0 ? (
                <p className="text-xs text-[#6b7c6d] italic p-4 bg-[#f8f5eb] rounded-xl border border-[#ded7c4]">
                  Todavía no hay costos cargados. Los costos que registres aquí se reflejarán automáticamente en el PDF de Margen Bruto.
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1 text-xs">
                  {costos.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] flex items-center justify-between gap-3"
                    >
                      <div>
                        <span className="font-bold text-[#182920] block">{c.rubro}</span>
                        <span className="text-[11px] text-[#6b7c6d]">
                          {c.descripcion} · {c.fecha}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="font-extrabold text-[#182920] block">
                            US$ {Number(c.montoUsd || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-[#6b7c6d]">
                            ${Math.round(Number(c.montoArs || 0)).toLocaleString("es-AR")}
                          </span>
                        </div>
                        {puedeEditar && (
                          <button
                            type="button"
                            onClick={() => manejarEliminarCosto(c.id)}
                            className="text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50"
                            title="Eliminar costo"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <form
          onSubmit={manejarGuardarParametros}
          className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm space-y-5"
        >
          <div>
            <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
              Parámetros Productivos del Establecimiento
            </h3>
            <p className="text-xs text-[#6b7c6d]">
              Estos valores complementan los cálculos automáticos de preñez/destete (de Ganado) en el reporte de Margen Bruto.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {[
              ["reposicionHembrasPct", "Reposición de Hembras (%)"],
              ["reposicionTorosPct", "Reposición Anual de Toros (%)"],
              ["mortandadPct", "Mortandad Estimada (%)"],
              ["edadPrimerServicioMeses", "Edad 1er Servicio (meses)"],
              ["duracionCorralDias", "Duración Corral (días)"],
              ["gananciaNovillosKgDia", "Ganancia Novillos (Kg/día)"],
              ["gananciaVaquillonasKgDia", "Ganancia Vaquillonas (Kg/día)"],
              ["relacionNovilloMaiz", "Relación Novillo / Maíz"],
            ].map(([campo, label]) => (
              <label key={campo} className="block">
                <span className="font-semibold text-[#182920] block mb-1">{label}</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  disabled={!puedeEditar}
                  value={parametros[campo]}
                  onChange={(e) => setParametros({ ...parametros, [campo]: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] text-[#182920]"
                />
              </label>
            ))}
          </div>

          {puedeEditar && (
            <div className="flex justify-end pt-3 border-t border-[#ded7c4]">
              <button
                type="submit"
                disabled={guardando}
                className="bg-[#182920] hover:bg-[#264030] text-[#f1ecdd] font-bold text-xs uppercase px-5 py-2.5 rounded-xl"
              >
                {guardando ? "Guardando..." : "Guardar Parámetros"}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
