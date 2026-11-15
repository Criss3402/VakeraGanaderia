import { useState, useEffect } from "react";
import {
  obtenerInsumos,
  obtenerPotreros,
  registrarInsumo,
  actualizarStockInsumo,
  eliminarInsumo,
  eliminarInsumosMasivo,
  gestionarLocacionInsumos,
  obtenerSolicitudesInsumos,
  crearSolicitudInsumo,
  actualizarEstadoSolicitudInsumo,
  registrarConteoPertenencias,
} from "../../../api/dashboard.api";
import { useAuth } from "../../../context/AuthContext";

const POTREROS_PREDETERMINADOS_EXCLUIDOS = new Set([
  "pot-1",
  "pot-2",
  "pot-3",
  "pot-4",
  "pot-5",
]);

function leerRenombresCuentaLocal(cuentaScope) {
  try {
    const raw = localStorage.getItem(`vakera_parcelas_renombres_${cuentaScope}`);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn("No se pudieron leer renombres de parcelas en Insumos:", err);
    return {};
  }
}

function leerParcelasCuentaLocal(storageKeyParcelas, cuentaScope = "default") {
  if (!storageKeyParcelas) return [];
  try {
    const raw = localStorage.getItem(storageKeyParcelas);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const renombres = leerRenombresCuentaLocal(cuentaScope);
    return Array.isArray(parsed)
      ? parsed
          .filter((p) => !POTREROS_PREDETERMINADOS_EXCLUIDOS.has(p?.id))
          .map((p) => {
            const nombreLimpio = (p?.nombre || "").trim();
            const nombreRenombrado =
              renombres[p?.id] ||
              renombres[nombreLimpio.toLowerCase()] ||
              p?.nombrePersonalizado ||
              p?.nombre;
            return { ...p, nombre: nombreRenombrado };
          })
      : [];
  } catch (err) {
    console.warn("No se pudieron leer parcelas locales en Insumos:", err);
    return [];
  }
}

export default function InsumosView() {
  const { rol, usuario } = useAuth();
  const [insumos, setInsumos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Vistas internas: 'inventario' | 'solicitudes'
  const [pestaña, setPestaña] = useState("inventario");

  // Modo de visualización en Stock: 'tarjetas' | 'lista'
  const [vistaStock, setVistaStock] = useState("tarjetas");

  // Clave aislada por cuenta para locaciones y parcelas
  const cuentaScope =
    usuario?.establecimientoId ||
    usuario?.id ||
    usuario?.email ||
    "default";
  const storageKeyLocaciones = `vakera_locaciones_${cuentaScope}`;
  const storageKeyEliminadas = `vakera_locaciones_excluidas_${cuentaScope}`;
  const parcelScope = usuario?.establecimientoId || usuario?.id;
  const storageKeyParcelas = parcelScope ? `vakera_parcelas_cuenta_${parcelScope}` : null;

  const [parcelasCampo, setParcelasCampo] = useState(() =>
    leerParcelasCuentaLocal(storageKeyParcelas, cuentaScope)
  );

  const locacionesPorDefecto =
    cuentaScope === "est-el-rancho" || usuario?.email === "dueno@vakera.com"
      ? ["Campo 1 - El Rancho", "Campo 2 - La Moraleja"]
      : [usuario?.establecimiento || "Campo Principal"];

  const [camposGuardados, setCamposGuardados] = useState(() => {
    try {
      const guardados = localStorage.getItem(storageKeyLocaciones);
      if (guardados) {
        const parsed = JSON.parse(guardados);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn("No se pudieron leer locaciones locales:", err);
    }
    return locacionesPorDefecto;
  });

  const [camposExcluidos, setCamposExcluidos] = useState(() => {
    try {
      const guardados = localStorage.getItem(storageKeyEliminadas);
      return guardados ? JSON.parse(guardados) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const guardados = localStorage.getItem(storageKeyLocaciones);
      if (guardados) {
        setCamposGuardados(JSON.parse(guardados));
      } else {
        setCamposGuardados(locacionesPorDefecto);
      }
      const excluidos = localStorage.getItem(storageKeyEliminadas);
      setCamposExcluidos(excluidos ? JSON.parse(excluidos) : []);
      setParcelasCampo(leerParcelasCuentaLocal(storageKeyParcelas, cuentaScope));
    } catch (err) {
      console.warn("Error sincronizando locaciones por cuenta:", err);
    }
  }, [storageKeyLocaciones, storageKeyEliminadas, storageKeyParcelas]);

  function persistirLocaciones(nuevosCampos, nuevosExcluidos = camposExcluidos) {
    setCamposGuardados(nuevosCampos);
    setCamposExcluidos(nuevosExcluidos);
    try {
      localStorage.setItem(storageKeyLocaciones, JSON.stringify(nuevosCampos));
      localStorage.setItem(storageKeyEliminadas, JSON.stringify(nuevosExcluidos));
    } catch (err) {
      console.warn("No se pudo guardar locaciones en localStorage:", err);
    }
  }

  // Nombres de parcelas delimitadas activas en el campo
  const nombresParcelasActivas = parcelasCampo
    .map((p) => (p?.nombre || "").trim())
    .filter((c) => Boolean(c) && !camposExcluidos.includes(c));

  // Campos consolidados: parcelas sincronizadas + locaciones manuales guardadas + extraídos de insumos activos
  const camposDisponibles = Array.from(
    new Set([
      ...nombresParcelasActivas,
      ...camposGuardados.filter((c) => Boolean(c) && !camposExcluidos.includes(c)),
      ...insumos
        .map((i) => i.campo)
        .filter((c) => Boolean(c) && !camposExcluidos.includes(c)),
    ])
  );

  // Filtros
  const [filtroLocacion, setFiltroLocacion] = useState("TODOS");
  const [filtroCategoria, setFiltroCategoria] = useState("TODOS");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtroSolicitudes, setFiltroSolicitudes] = useState("TODAS");
  const [busqueda, setBusqueda] = useState("");

  // Selección múltiple para eliminar insumos en Stock y Conteo
  const [seleccionadosInsumos, setSeleccionadosInsumos] = useState([]);

  // Modales de Stock e Insumos
  const [modalNuevoProducto, setModalNuevoProducto] = useState(false);
  const [modalReponer, setModalReponer] = useState(false);
  const [modalConteo, setModalConteo] = useState(false);
  const [modalSolicitar, setModalSolicitar] = useState(false);
  const [modalEliminarInsumos, setModalEliminarInsumos] = useState(false);
  const [insumoAEliminar, setInsumoAEliminar] = useState(null); // null = usa seleccionadosInsumos

  // Modales de Locaciones (Agregar, Editar y Eliminar como pantalla emergente)
  const [modalGestionLocaciones, setModalGestionLocaciones] = useState(false);
  const [nombreNuevoCampo, setNombreNuevoCampo] = useState("");
  const [locacionEditando, setLocacionEditando] = useState(null);
  const [nuevoNombreLocacion, setNuevoNombreLocacion] = useState("");
  const [locacionConfirmarEliminar, setLocacionConfirmarEliminar] = useState(null);

  // Elemento activo
  const [insumoActivo, setInsumoActivo] = useState(null);
  const [cantidadConteo, setCantidadConteo] = useState(0);
  const [cantidadReponer, setCantidadReponer] = useState(10);

  // Formulario nuevo producto
  const [nuevoProducto, setNuevoProducto] = useState({
    nombre: "",
    categoria: "Herramientas",
    stockActual: 10,
    stockMinimo: 3,
    unidad: "Unidades",
    campo: camposDisponibles[0] || "Campo Principal",
    ubicacion: "Galpón 1",
    icono: "fa-gavel",
  });

  // Formulario de solicitud de insumos
  const [nuevaSolicitud, setNuevaSolicitud] = useState({
    insumoId: "",
    insumoNombre: "",
    cantidad: 1,
    unidad: "Unidades",
    motivo: "",
    urgencia: "Normal",
    sector: "Campo",
  });

  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);

  const puedeAprobarSolicitud = rol === "capataz" || rol === "oficina" || rol === "dueno";
  const puedeCrearProducto = rol === "oficina" || rol === "dueno" || rol === "capataz";

  async function cargarDatos() {
    try {
      const [resIns, resSol, resPot] = await Promise.all([
        obtenerInsumos(),
        obtenerSolicitudesInsumos(),
        obtenerPotreros().catch(() => ({ data: [] })),
      ]);
      if (resIns?.data) setInsumos(resIns.data);
      if (resSol?.data) setSolicitudes(resSol.data);

      const listaApiParcelas = (Array.isArray(resPot?.data) ? resPot.data : []).filter(
        (p) => !POTREROS_PREDETERMINADOS_EXCLUIDOS.has(p?.id)
      );
      const listaLocalParcelas = leerParcelasCuentaLocal(storageKeyParcelas, cuentaScope);
      const renombres = leerRenombresCuentaLocal(cuentaScope);
      const mapaCombinado = new Map();
      listaLocalParcelas.forEach((p) => {
        if (p?.id) mapaCombinado.set(p.id, p);
      });
      listaApiParcelas.forEach((p) => {
        if (p?.id) {
          const prev = mapaCombinado.get(p.id) || {};
          const nombreApiLimpio = (p.nombre || "").trim();
          const nombreRenombrado =
            renombres[p.id] ||
            renombres[nombreApiLimpio.toLowerCase()] ||
            prev.nombrePersonalizado ||
            p.nombre;
          mapaCombinado.set(p.id, {
            ...prev,
            ...p,
            nombre: nombreRenombrado,
            nombrePersonalizado:
              renombres[p.id] ||
              renombres[nombreApiLimpio.toLowerCase()] ||
              prev.nombrePersonalizado ||
              undefined,
          });
        }
      });
      const parcelasConsolidadas = Array.from(mapaCombinado.values());
      setParcelasCampo(parcelasConsolidadas);
      if (storageKeyParcelas && parcelasConsolidadas.length > 0) {
        try {
          localStorage.setItem(storageKeyParcelas, JSON.stringify(parcelasConsolidadas));
        } catch (err) {
          console.warn("Aviso al persistir parcelas consolidadas:", err);
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
  }, [storageKeyParcelas]);

  useEffect(() => {
    if (camposDisponibles.length > 0 && !camposDisponibles.includes(nuevoProducto.campo)) {
      setNuevoProducto((prev) => ({ ...prev, campo: camposDisponibles[0] }));
    }
  }, [camposDisponibles]);

  function mostrarNotificacion(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(""), 4500);
  }

  // --- GESTIÓN DE LOCACIONES (AGREGAR, EDITAR, ELIMINAR EN MODAL EMERGENTE) ---
  function agregarNuevoCampo(nombre) {
    const limpio = (nombre || "").trim();
    if (!limpio) return;
    const nuevosExcluidos = camposExcluidos.filter((c) => c !== limpio);
    const actualizados = camposGuardados.includes(limpio)
      ? camposGuardados
      : [...camposGuardados, limpio];
    persistirLocaciones(actualizados, nuevosExcluidos);
    setFiltroLocacion(limpio);
    setNuevoProducto((prev) => ({ ...prev, campo: limpio }));
    setNombreNuevoCampo("");
    mostrarNotificacion(`Locación "${limpio}" agregada correctamente.`);
  }

  async function guardarEdicionLocacion(nombreAnterior) {
    const limpio = (nuevoNombreLocacion || "").trim();
    if (!limpio || limpio === nombreAnterior) {
      setLocacionEditando(null);
      return;
    }
    setProcesando(true);
    try {
      await gestionarLocacionInsumos({
        nombreAnterior,
        nuevoNombre: limpio,
        accion: "editar",
      });
      const actualizados = camposDisponibles.map((c) =>
        c === nombreAnterior ? limpio : c
      );
      const nuevosExcluidos = Array.from(new Set([...camposExcluidos, nombreAnterior])).filter(
        (c) => c !== limpio
      );
      persistirLocaciones(actualizados, nuevosExcluidos);

      // Persistir el renombre para que ParcelasView y el mapa reflejen el nuevo nombre inmediatamente
      try {
        const renombres = leerRenombresCuentaLocal(cuentaScope);
        const keyAnteriorLower = nombreAnterior.trim().toLowerCase();
        renombres[keyAnteriorLower] = limpio;
        Object.keys(renombres).forEach((k) => {
          if (String(renombres[k] || "").trim().toLowerCase() === keyAnteriorLower) {
            renombres[k] = limpio;
          }
        });
        delete renombres[limpio.toLowerCase()];

        const parcelasRenombradas = parcelasCampo.map((p) => {
          if ((p?.nombre || "").trim().toLowerCase() === keyAnteriorLower) {
            if (p?.id) renombres[p.id] = limpio;
            return { ...p, nombre: limpio, nombrePersonalizado: limpio };
          }
          return p;
        });

        localStorage.setItem(
          `vakera_parcelas_renombres_${cuentaScope}`,
          JSON.stringify(renombres)
        );

        setParcelasCampo(parcelasRenombradas);
        if (storageKeyParcelas) {
          localStorage.setItem(storageKeyParcelas, JSON.stringify(parcelasRenombradas));
        }
      } catch (err) {
        console.warn("Aviso al sincronizar renombre de parcela local:", err);
      }

      if (filtroLocacion === nombreAnterior) setFiltroLocacion(limpio);
      if (nuevoProducto.campo === nombreAnterior) {
        setNuevoProducto((prev) => ({ ...prev, campo: limpio }));
      }
      setLocacionEditando(null);
      setNuevoNombreLocacion("");
      await cargarDatos();
      mostrarNotificacion(`Locación "${nombreAnterior}" renombrada a "${limpio}".`);
    } catch (err) {
      alert("Error al editar la locación: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  async function confirmarEliminarLocacion(nombreLocacion) {
    if (!nombreLocacion) return;
    setProcesando(true);
    try {
      const restantes = camposDisponibles.filter((c) => c !== nombreLocacion);
      const destinoReasignacion = restantes[0] || "Depósito General";
      await gestionarLocacionInsumos({
        nombreAnterior: nombreLocacion,
        nuevoNombre: destinoReasignacion,
        accion: "eliminar",
      });
      const nuevosExcluidos = Array.from(new Set([...camposExcluidos, nombreLocacion]));
      persistirLocaciones(restantes, nuevosExcluidos);
      if (filtroLocacion === nombreLocacion) setFiltroLocacion("TODOS");
      if (nuevoProducto.campo === nombreLocacion) {
        setNuevoProducto((prev) => ({ ...prev, campo: destinoReasignacion }));
      }
      setLocacionConfirmarEliminar(null);
      await cargarDatos();
      mostrarNotificacion(`Locación "${nombreLocacion}" eliminada correctamente.`);
    } catch (err) {
      alert("Error al eliminar la locación: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  // --- 1. AÑADIR NUEVO PRODUCTO AL STOCK ---
  async function manejarCrearProducto(e) {
    e.preventDefault();
    if (!nuevoProducto.nombre.trim()) return;
    setProcesando(true);
    try {
      await registrarInsumo(nuevoProducto);
      mostrarNotificacion(`Producto "${nuevoProducto.nombre}" añadido en ${nuevoProducto.campo || "campo"}.`);
      setModalNuevoProducto(false);
      setNuevoProducto({
        nombre: "",
        categoria: "Herramientas",
        stockActual: 10,
        stockMinimo: 3,
        unidad: "Unidades",
        campo: camposDisponibles[0] || "Campo Principal",
        ubicacion: "Galpón 1",
        icono: "fa-gavel",
      });
      await cargarDatos();
    } catch (err) {
      alert("Error al añadir producto: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  // --- 2. SUMAR UNIDADES AL STOCK EXISTENTE ---
  async function manejarSumarStock(e) {
    e.preventDefault();
    if (!insumoActivo || cantidadReponer <= 0) return;
    setProcesando(true);
    try {
      await actualizarStockInsumo(insumoActivo.id, cantidadReponer, "sumar");
      mostrarNotificacion(`Se añadieron +${cantidadReponer} ${insumoActivo.unidad} al stock de ${insumoActivo.nombre}.`);
      setModalReponer(false);
      setInsumoActivo(null);
      await cargarDatos();
    } catch (err) {
      alert("Error al añadir stock: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  // --- 3. CONTEO FÍSICO DE PERTENENCIAS ---
  async function manejarConteoFisico(e) {
    e.preventDefault();
    if (!insumoActivo) return;
    setProcesando(true);
    try {
      await registrarConteoPertenencias(insumoActivo.id, cantidadConteo);
      mostrarNotificacion(`Conteo de pertenencias verificado: ${insumoActivo.nombre} actualizado a ${cantidadConteo} ${insumoActivo.unidad}.`);
      setModalConteo(false);
      setInsumoActivo(null);
      await cargarDatos();
    } catch (err) {
      alert("Error al registrar conteo: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  // --- 3B. ELIMINAR INSUMOS (INDIVIDUAL O MARCADOS EN LOTE) ---
  async function manejarConfirmarEliminarInsumos() {
    setProcesando(true);
    try {
      if (insumoAEliminar) {
        await eliminarInsumo(insumoAEliminar.id);
        setSeleccionadosInsumos((prev) => prev.filter((id) => id !== insumoAEliminar.id));
        mostrarNotificacion(`Insumo "${insumoAEliminar.nombre}" eliminado del inventario.`);
      } else if (seleccionadosInsumos.length > 0) {
        await eliminarInsumosMasivo(seleccionadosInsumos);
        mostrarNotificacion(`Se eliminaron ${seleccionadosInsumos.length} insumos seleccionados del stock.`);
        setSeleccionadosInsumos([]);
      }
      setModalEliminarInsumos(false);
      setInsumoAEliminar(null);
      await cargarDatos();
    } catch (err) {
      alert("Error al eliminar insumos: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  // --- 4. SOLICITAR PRODUCTO / INSUMO (PEÓN, CAPATAZ, VETERINARIO) ---
  async function manejarEnviarSolicitud(e) {
    e.preventDefault();
    if (!nuevaSolicitud.insumoNombre.trim()) return;
    setProcesando(true);
    try {
      await crearSolicitudInsumo({
        ...nuevaSolicitud,
        sector: rol === "veterinario" ? "Botiquín Veterinario" : rol === "capataz" ? "Campo y Taller" : "Pertenencias de Peón",
      });
      mostrarNotificacion(`Solicitud de ${nuevaSolicitud.cantidad} ${nuevaSolicitud.unidad} de ${nuevaSolicitud.insumoNombre} enviada para reposición.`);
      setModalSolicitar(false);
      setNuevaSolicitud({
        insumoId: "",
        insumoNombre: "",
        cantidad: 1,
        unidad: "Unidades",
        motivo: "",
        urgencia: "Normal",
        sector: "Campo",
      });
      await cargarDatos();
    } catch (err) {
      alert("Error al enviar solicitud: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  // --- 5. APROBAR / ENTREGAR SOLICITUD ---
  async function cambiarEstadoSolicitud(id, nuevoEstado) {
    setProcesando(true);
    try {
      await actualizarEstadoSolicitudInsumo(id, nuevoEstado);
      mostrarNotificacion(`Solicitud marcada como ${nuevoEstado}.`);
      await cargarDatos();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  // Filtrado de Inventario por Locación / Campo
  const insumosFiltrados = insumos.filter((item) => {
    const itemCampo = item.campo || "Campo Principal";
    const itemUbicacion = item.ubicacion || "";

    const matchBusqueda =
      item.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      itemCampo.toLowerCase().includes(busqueda.toLowerCase()) ||
      itemUbicacion.toLowerCase().includes(busqueda.toLowerCase());

    const matchLocacion =
      filtroLocacion === "TODOS" ||
      itemCampo.toLowerCase() === filtroLocacion.toLowerCase() ||
      itemUbicacion.toLowerCase().includes(filtroLocacion.toLowerCase());

    const matchCat = filtroCategoria === "TODOS" || item.categoria === filtroCategoria;
    const matchEst =
      filtroEstado === "TODOS" ||
      (filtroEstado === "BAJO_STOCK" && (item.requiereReposicion || item.stockActual <= item.stockMinimo)) ||
      (filtroEstado === "OK" && (!item.requiereReposicion && item.stockActual > item.stockMinimo));

    return matchBusqueda && matchLocacion && matchCat && matchEst;
  });

  // Selección de insumos en Stock y Conteo
  function toggleSeleccionInsumo(id) {
    setSeleccionadosInsumos((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function seleccionarTodosInsumos() {
    if (
      seleccionadosInsumos.length === insumosFiltrados.length &&
      insumosFiltrados.length > 0
    ) {
      setSeleccionadosInsumos([]);
    } else {
      setSeleccionadosInsumos(insumosFiltrados.map((i) => i.id));
    }
  }

  // Filtrado de Solicitudes
  const solicitudesFiltradas = solicitudes.filter((sol) => {
    if (filtroSolicitudes === "MIS_SOLICITUDES") return sol.solicitanteRol === rol;
    if (filtroSolicitudes === "PENDIENTES") return sol.estado === "Pendiente";
    if (filtroSolicitudes === "ENTREGADAS") return sol.estado === "Entregado";
    return true;
  });

  const solicitudesPendientesCount = solicitudes.filter((s) => s.estado === "Pendiente").length;

  return (
    <div className="space-y-6 text-[#182920]">
      {/* Banner Principal */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              Inventario, Stock & Conteo de Pertenencias
            </span>
            <span className="text-xs text-[#8fb56b]">Sincronizado con PostgreSQL</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Control de Insumos, Herramientas y Botiquín
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-xl">
            Añade productos al stock general, realiza el conteo físico de tus pertenencias y gestiona las solicitudes de reposición para peones, capataz y veterinaria.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Botón Solicitar Insumo */}
          <button
            type="button"
            onClick={() => setModalSolicitar(true)}
            className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <i className="fa-solid fa-hand-holding-hand"></i> Solicitar Insumos
          </button>

          {/* Botón Añadir Producto al Stock General */}
          {puedeCrearProducto && (
            <button
              type="button"
              onClick={() => setModalNuevoProducto(true)}
              className="bg-[#1f3729] hover:bg-[#284835] text-[#f1ecdd] border border-[#8fb56b]/40 font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2"
            >
              <i className="fa-solid fa-box-open text-[#8fb56b]"></i> + Añadir Producto
            </button>
          )}
        </div>
      </div>

      {mensaje && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm animate-fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600 text-lg"></i>
          <span>{mensaje}</span>
        </div>
      )}

      {/* Pestañas: Inventario y Conteo vs Solicitudes de Reposición */}
      <div className="flex items-center gap-2 border-b border-[#ded7c4] pb-2">
        <button
          type="button"
          onClick={() => setPestaña("inventario")}
          className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all ${
            pestaña === "inventario"
              ? "bg-[#182920] text-[#f1ecdd] shadow-sm"
              : "bg-white text-[#4a5c4e] border border-[#ded7c4] hover:bg-[#e7dfcb]"
          }`}
        >
          <i className="fa-solid fa-boxes-stacked"></i>
          <span>Inventario & Conteo de Pertenencias ({insumos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setPestaña("solicitudes")}
          className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all ${
            pestaña === "solicitudes"
              ? "bg-[#182920] text-[#f1ecdd] shadow-sm"
              : "bg-white text-[#4a5c4e] border border-[#ded7c4] hover:bg-[#e7dfcb]"
          }`}
        >
          <i className="fa-solid fa-clipboard-list"></i>
          <span>Solicitudes de Reposición ({solicitudes.length})</span>
          {solicitudesPendientesCount > 0 && (
            <span className="bg-amber-400 text-[#182920] px-1.5 py-0.2 rounded-full text-[10px] font-extrabold">
              {solicitudesPendientesCount}
            </span>
          )}
        </button>
      </div>

      {/* KPI Cards Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold text-[#6b7c6d] uppercase">Locaciones / Campos</p>
            <p className="text-2xl font-extrabold text-[#33512f] mt-0.5">{camposDisponibles.length} Campos</p>
            <span className="text-[11px] text-[#6b7c6d]">
              {filtroLocacion === "TODOS" ? "Visualizando todas las locaciones" : `Filtrando: ${filtroLocacion}`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setModalGestionLocaciones(true)}
            className="text-[11px] font-bold text-[#33512f] bg-[#f8f5eb] hover:bg-[#e7dfcb] px-2.5 py-1.5 rounded-xl border border-[#ded7c4] flex items-center gap-1"
            title="Editar o eliminar locaciones"
          >
            <i className="fa-solid fa-pen-to-square"></i> Gestionar
          </button>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
          <p className="text-[10px] font-bold text-[#6b7c6d] uppercase">Total Insumos en Campo</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-0.5">{insumos.length} Productos</p>
          <span className="text-[11px] text-[#6b7c6d]">Depósito, botiquín y herramientas</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
          <p className="text-[10px] font-bold text-red-700 uppercase">Alertas de Bajo Stock</p>
          <p className="text-2xl font-extrabold text-red-800 mt-0.5">
            {insumos.filter((i) => i.requiereReposicion || i.stockActual <= i.stockMinimo).length} Artículos
          </p>
          <span className="text-[11px] text-red-600">Requieren reposición</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
          <p className="text-[10px] font-bold text-[#33512f] uppercase">Artículos Marcados</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-0.5">{seleccionadosInsumos.length} Seleccionados</p>
          <span className="text-[11px] text-[#6b7c6d]">Para eliminación rápida</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA 1: INVENTARIO, FILTROS Y CONTEO DE PERTENENCIAS   */}
      {/* ========================================================= */}
      {pestaña === "inventario" && (
        <div className="space-y-4">
          {/* Barra de Filtros, Locación (con Editar/Eliminar), Vista Lista/Tarjetas y Marcado */}
          <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
            <div className="flex items-center gap-2.5 flex-wrap flex-1">
              {/* Checkbox Seleccionar Todos */}
              {insumosFiltrados.length > 0 && (
                <label
                  className="flex items-center gap-1.5 text-xs font-bold text-[#182920] bg-[#f8f5eb] px-3 py-2 rounded-xl border border-[#ded7c4] cursor-pointer select-none hover:bg-[#e7dfcb] transition-colors"
                  title="Marcar o desmarcar todos los insumos visibles"
                >
                  <input
                    type="checkbox"
                    checked={
                      seleccionadosInsumos.length === insumosFiltrados.length &&
                      insumosFiltrados.length > 0
                    }
                    onChange={seleccionarTodosInsumos}
                    className="rounded cursor-pointer"
                  />
                  <span>Marcar todos</span>
                </label>
              )}

              {/* Buscador */}
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7c6d] text-xs"></i>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar insumo o herramienta..."
                  className="text-xs pl-8 pr-3 py-2 bg-[#f8f5eb] border border-[#ded7c4] rounded-xl text-[#182920] outline-none w-48"
                />
              </div>

              {/* FILTRO Y GESTIÓN DE LOCACIÓN POR CAMPO */}
              <div className="flex items-center gap-1.5 bg-[#f8f5eb] p-1 rounded-xl border border-[#ded7c4]">
                <span className="text-[10px] font-extrabold text-[#182920] uppercase px-2 flex items-center gap-1">
                  <i className="fa-solid fa-location-dot text-[#33512f]"></i> Locación:
                </span>
                <select
                  value={filtroLocacion}
                  onChange={(e) => {
                    if (e.target.value === "__GESTIONAR__") {
                      setModalGestionLocaciones(true);
                    } else {
                      setFiltroLocacion(e.target.value);
                    }
                  }}
                  className="text-xs font-bold bg-white border border-[#ded7c4] rounded-lg px-2.5 py-1 text-[#182920] outline-none cursor-pointer"
                >
                  <option value="TODOS">Todos los Campos</option>
                  {camposDisponibles.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__GESTIONAR__" className="text-[#33512f] font-bold">
                    ⚙ Gestionar locaciones (Agregar / Editar / Eliminar)...
                  </option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setLocacionEditando(null);
                    setLocacionConfirmarEliminar(null);
                    setModalGestionLocaciones(true);
                  }}
                  className="px-2.5 h-7 flex items-center justify-center gap-1 rounded-lg bg-white border border-[#ded7c4] hover:bg-[#e7dfcb] text-[#182920] text-[11px] font-bold transition-colors"
                  title="Abrir pantalla emergente para agregar, editar o eliminar locaciones"
                >
                  <i className="fa-solid fa-pen-to-square text-[#33512f]"></i>
                  <span className="hidden sm:inline">Editar / Eliminar</span>
                </button>
              </div>

              {/* Filtro Categoría */}
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="text-xs font-semibold bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-2.5 py-2 text-[#182920] outline-none"
              >
                <option value="TODOS">Todas las Categorías</option>
                <option value="Herramientas">Herramientas</option>
                <option value="Fármaco">Fármacos y Vacunas</option>
                <option value="Nutrición">Nutrición y Sales</option>
              </select>

              {/* Filtro Estado Stock */}
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="text-xs font-semibold bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-2.5 py-2 text-[#182920] outline-none"
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="OK">Stock Normal</option>
                <option value="BAJO_STOCK">Bajo Stock — Crítico</option>
              </select>
            </div>

            {/* Controles derechos: Botón Eliminar Marcados + Selector Vista Tarjetas / Lista */}
            <div className="flex items-center gap-2.5 self-end xl:self-center flex-wrap">
              {seleccionadosInsumos.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setInsumoAEliminar(null);
                    setModalEliminarInsumos(true);
                  }}
                  className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs uppercase px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-trash-can"></i>
                  <span>Eliminar Marcados ({seleccionadosInsumos.length})</span>
                </button>
              )}

              {/* Selector de Vista: Tarjetas vs Lista */}
              <div className="flex items-center bg-[#f8f5eb] p-1 rounded-xl border border-[#ded7c4]">
                <button
                  type="button"
                  onClick={() => setVistaStock("tarjetas")}
                  className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all ${
                    vistaStock === "tarjetas"
                      ? "bg-[#182920] text-[#f1ecdd] shadow-sm"
                      : "text-[#4a5c4e] hover:text-[#182920]"
                  }`}
                  title="Vista en Cuadrícula / Tarjetas"
                >
                  <i className="fa-solid fa-grip"></i>
                  <span>Tarjetas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVistaStock("lista")}
                  className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all ${
                    vistaStock === "lista"
                      ? "bg-[#182920] text-[#f1ecdd] shadow-sm"
                      : "text-[#4a5c4e] hover:text-[#182920]"
                  }`}
                  title="Vista de Lista / Tabla"
                >
                  <i className="fa-solid fa-list"></i>
                  <span>Lista</span>
                </button>
              </div>

              <div className="text-xs text-[#6b7c6d]">
                Mostrando: <strong className="text-[#182920]">{insumosFiltrados.length}</strong>
              </div>
            </div>
          </div>

          {/* ===================================================== */}
          {/* MODO 1: VISTA DE TARJETAS / CUADRÍCULA                */}
          {/* ===================================================== */}
          {vistaStock === "tarjetas" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {insumosFiltrados.length === 0 && (
                <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-[#ded7c4] p-8">
                  <i className="fa-solid fa-boxes-stacked text-3xl text-[#8fb56b]/50 mb-2"></i>
                  <p className="text-sm font-semibold text-[#182920]">
                    No hay insumos registrados con este filtro.
                  </p>
                  <p className="text-xs text-[#526354]">
                    Hacé clic en "+ Añadir Producto" para dar de alta productos, fármacos o herramientas.
                  </p>
                </div>
              )}

              {insumosFiltrados.map((item) => {
                const esBajo = item.requiereReposicion || item.stockActual <= item.stockMinimo;
                const isChecked = seleccionadosInsumos.includes(item.id);

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${
                      isChecked
                        ? "border-[#182920] ring-2 ring-[#8fb56b]/50 bg-[#f8f5eb]/40"
                        : "border-[#ded7c4] hover:border-[#8fb56b]/60"
                    }`}
                  >
                    <div>
                      {/* Header Card con Checkbox de Marcado */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSeleccionInsumo(item.id)}
                            className="rounded cursor-pointer w-4 h-4 accent-[#182920]"
                            title="Marcar este insumo"
                          />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#4a5c4e] bg-[#f8f5eb] px-2 py-0.5 rounded border border-[#ded7c4]">
                            {item.categoria}
                          </span>
                          {item.campo && (
                            <span className="text-[9px] bg-[#182920] text-[#8fb56b] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <i className="fa-solid fa-location-dot text-[8px]"></i>
                              {item.campo}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                              esBajo
                                ? "bg-red-100 text-red-800 border-red-300"
                                : "bg-emerald-100 text-emerald-800 border-emerald-300"
                            }`}
                          >
                            {esBajo ? "Bajo Stock" : "OK"}
                          </span>

                          {puedeCrearProducto && (
                            <button
                              type="button"
                              onClick={() => {
                                setInsumoAEliminar(item);
                                setModalEliminarInsumos(true);
                              }}
                              className="w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 flex items-center justify-center text-[10px] transition-colors"
                              title="Eliminar este insumo"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Nombre y Ubicación */}
                      <div
                        className="flex items-start gap-3 mb-3 cursor-pointer"
                        onClick={() => toggleSeleccionInsumo(item.id)}
                      >
                        <div className="w-10 h-10 rounded-xl bg-[#e7dfcb] text-[#182920] flex items-center justify-center text-lg flex-shrink-0">
                          <i className={`fa-solid ${item.icono || "fa-box-archive"}`}></i>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[#182920] leading-snug truncate">
                            {item.nombre}
                          </h4>
                          <p className="text-[11px] text-[#6b7c6d] flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <i className="fa-solid fa-warehouse text-[#8fb56b]"></i>
                            <span>{item.ubicacion}</span>
                            <span className="text-[#a1b0a3]">&bull;</span>
                            <span className="font-semibold text-[#182920]">{item.campo || "Campo Principal"}</span>
                          </p>
                        </div>
                      </div>

                      {/* Caja de Stock y Punto de Alerta */}
                      <div className="bg-[#f8f5eb] p-3 rounded-xl border border-[#ded7c4] flex justify-between items-center mb-3">
                        <div>
                          <span className="text-[10px] font-bold text-[#6b7c6d] uppercase block">
                            Stock Disponible
                          </span>
                          <span className="text-2xl font-extrabold text-[#182920]">
                            {item.stockActual}{" "}
                            <span className="text-xs font-semibold text-[#4a5c4e]">{item.unidad}</span>
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-[#6b7c6d] uppercase block">
                            Stock Mínimo
                          </span>
                          <span className="text-xs font-bold text-[#6b4a32]">
                            {item.stockMinimo} {item.unidad}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Acciones: Conteo Físico + Añadir Stock */}
                    <div className="pt-2 border-t border-[#ded7c4] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setInsumoActivo(item);
                          setCantidadConteo(item.stockActual);
                          setModalConteo(true);
                        }}
                        className="flex-1 bg-[#f8f5eb] hover:bg-[#e7dfcb] text-[#182920] border border-[#ded7c4] font-bold text-[11px] py-1.5 px-2 rounded-xl transition-colors flex items-center justify-center gap-1"
                        title="Realizar conteo físico de pertenencias y actualizar stock en mano"
                      >
                        <i className="fa-solid fa-calculator text-[#33512f]"></i>
                        <span>Conteo Físico</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setInsumoActivo(item);
                          setCantidadReponer(10);
                          setModalReponer(true);
                        }}
                        className="bg-[#182920] hover:bg-[#284835] text-[#f1ecdd] font-bold text-[11px] py-1.5 px-3 rounded-xl transition-colors flex items-center gap-1 shadow-sm"
                        title="Añadir unidades al stock existente"
                      >
                        <i className="fa-solid fa-plus text-[#8fb56b]"></i>
                        <span>Añadir Stock</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ===================================================== */}
          {/* MODO 2: VISTA DE LISTA / TABLA COMPACTA               */}
          {/* ===================================================== */}
          {vistaStock === "lista" && (
            <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#ded7c4] text-[#4a5c4e] uppercase font-bold text-[10px]">
                      <th className="py-2.5 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={
                            seleccionadosInsumos.length === insumosFiltrados.length &&
                            insumosFiltrados.length > 0
                          }
                          onChange={seleccionarTodosInsumos}
                          className="rounded cursor-pointer"
                          title="Seleccionar todos"
                        />
                      </th>
                      <th className="py-2.5 px-3">Producto / Herramienta</th>
                      <th className="py-2.5 px-3">Categoría</th>
                      <th className="py-2.5 px-3">Locación & Sector</th>
                      <th className="py-2.5 px-3">Stock Disponible</th>
                      <th className="py-2.5 px-3">Stock Mínimo</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Acciones de Stock y Conteo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ded7c4]">
                    {insumosFiltrados.map((item) => {
                      const esBajo = item.requiereReposicion || item.stockActual <= item.stockMinimo;
                      const isChecked = seleccionadosInsumos.includes(item.id);

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-[#f8f5eb] transition-colors ${
                            isChecked ? "bg-[#f8f5eb]/80" : ""
                          }`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSeleccionInsumo(item.id)}
                              className="rounded cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-3 font-bold text-[#182920]">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-lg bg-[#e7dfcb] flex items-center justify-center text-xs text-[#182920] flex-shrink-0">
                                <i className={`fa-solid ${item.icono || "fa-box-archive"}`}></i>
                              </span>
                              <span>{item.nombre}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[10px] font-bold uppercase text-[#4a5c4e] bg-[#f8f5eb] px-2 py-0.5 rounded border border-[#ded7c4]">
                              {item.categoria}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-[#182920]">{item.campo || "Campo Principal"}</div>
                            <div className="text-[11px] text-[#6b7c6d]">{item.ubicacion}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-sm font-extrabold text-[#182920]">
                              {item.stockActual}
                            </span>{" "}
                            <span className="text-[11px] text-[#4a5c4e]">{item.unidad}</span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-[#6b4a32]">
                            {item.stockMinimo} {item.unidad}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                                esBajo
                                  ? "bg-red-100 text-red-800 border-red-300"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
                              }`}
                            >
                              {esBajo ? "Bajo Stock" : "OK"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setInsumoActivo(item);
                                setCantidadConteo(item.stockActual);
                                setModalConteo(true);
                              }}
                              className="bg-[#f8f5eb] hover:bg-[#e7dfcb] text-[#182920] border border-[#ded7c4] font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-colors"
                              title="Realizar conteo físico"
                            >
                              <i className="fa-solid fa-calculator text-[#33512f]"></i> Conteo
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setInsumoActivo(item);
                                setCantidadReponer(10);
                                setModalReponer(true);
                              }}
                              className="bg-[#182920] hover:bg-[#284835] text-[#f1ecdd] font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-colors"
                              title="Añadir unidades al stock"
                            >
                              <i className="fa-solid fa-plus text-[#8fb56b]"></i> + Stock
                            </button>

                            {puedeCrearProducto && (
                              <button
                                type="button"
                                onClick={() => {
                                  setInsumoAEliminar(item);
                                  setModalEliminarInsumos(true);
                                }}
                                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-colors"
                                title="Eliminar insumo"
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {insumosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan="8" className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <i className="fa-solid fa-boxes-stacked text-3xl text-[#8fb56b]/50"></i>
                            <p className="text-sm font-semibold text-[#182920]">
                              No hay insumos registrados con este filtro.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: BANDEJA DE SOLICITUDES DE REPOSICIÓN           */}
      {/* ========================================================= */}
      {pestaña === "solicitudes" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-3 border-b border-[#ded7c4]">
              <div>
                <h3 className="text-lg font-bold text-[#182920] font-['Fraunces',serif]">
                  Solicitudes de Reposición e Insumos
                </h3>
                <p className="text-xs text-[#6b7c6d]">
                  Pedidos realizados por peones, capataz y médica veterinaria para reposición de herramientas o fármacos.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalSolicitar(true)}
                  className="bg-[#182920] hover:bg-[#284835] text-[#f1ecdd] font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-paper-plane text-[#8fb56b]"></i> Nueva Solicitud
                </button>
              </div>
            </div>

            {/* Filtros de Solicitudes */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs font-bold text-[#182920] uppercase">Filtrar:</span>
              {["TODAS", "MIS_SOLICITUDES", "PENDIENTES", "ENTREGADAS"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltroSolicitudes(f)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                    filtroSolicitudes === f
                      ? "bg-[#182920] text-[#f1ecdd] border-[#182920]"
                      : "bg-[#f8f5eb] text-[#4a5c4e] border-[#ded7c4] hover:bg-[#e7dfcb]"
                  }`}
                >
                  {f === "TODAS"
                    ? "Todas"
                    : f === "MIS_SOLICITUDES"
                    ? "Mis Solicitudes"
                    : f === "PENDIENTES"
                    ? "Pendientes"
                    : "Entregadas"}
                </button>
              ))}
            </div>

            {/* Lista de Solicitudes */}
            <div className="space-y-3">
              {solicitudesFiltradas.length === 0 ? (
                <p className="text-xs text-[#6b7c6d] py-8 text-center">No hay solicitudes registradas con ese filtro.</p>
              ) : (
                solicitudesFiltradas.map((s) => {
                  const esPendiente = s.estado === "Pendiente";
                  const esEntregado = s.estado === "Entregado";

                  return (
                    <div
                      key={s.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                        esPendiente ? "bg-[#f8f5eb] border-amber-300" : "bg-white border-[#ded7c4]"
                      }`}
                    >
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#182920]">
                            {s.insumoNombre}
                          </span>
                          <span className="text-xs font-extrabold text-[#33512f] bg-white px-2 py-0.5 rounded border border-[#ded7c4]">
                            Cant: {s.cantidad} {s.unidad}
                          </span>
                          <span className="text-xs text-[#6b7c6d]">
                            · Solicitado por: <strong>{s.solicitanteNombre}</strong> ({s.solicitanteRol})
                          </span>
                          <span className="text-xs text-[#6b7c6d]">· 📅 {s.fecha}</span>
                          <span className="text-[10px] bg-[#f8f5eb] text-[#6b4a32] font-bold px-2 py-0.5 rounded border border-[#ded7c4]">
                            Sector: {s.sector}
                          </span>
                        </div>

                        <p className="text-xs text-[#333] leading-relaxed">
                          <strong>Motivo:</strong> {s.motivo}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${
                            esEntregado
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : s.estado === "Aprobado"
                              ? "bg-blue-100 text-blue-800 border-blue-300"
                              : "bg-amber-100 text-amber-800 border-amber-300"
                          }`}
                        >
                          {esEntregado ? "✓ Entregado" : s.estado === "Aprobado" ? "✓ Aprobado" : "⏳ Pendiente"}
                        </span>

                        {puedeAprobarSolicitud && (
                          <div className="flex items-center gap-1.5">
                            {esPendiente && (
                              <button
                                type="button"
                                disabled={procesando}
                                onClick={() => cambiarEstadoSolicitud(s.id, "Aprobado")}
                                className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg"
                              >
                                Aprobar
                              </button>
                            )}
                            {s.estado !== "Entregado" && (
                              <button
                                type="button"
                                disabled={procesando}
                                onClick={() => cambiarEstadoSolicitud(s.id, "Entregado")}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
                                title="Entregar insumo y sumar al stock de pertenencias"
                              >
                                <i className="fa-solid fa-box"></i> Entregar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: CONTEO FÍSICO DE PERTENENCIAS                   */}
      {/* ========================================================= */}
      {modalConteo && insumoActivo && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-sm w-full animate-fade-in text-xs space-y-3">
            <div className="flex justify-between items-start border-b border-[#ded7c4] pb-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#33512f] bg-[#f8f5eb] px-2 py-0.5 rounded">
                  Auditoría de Pertenencias
                </span>
                <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif] mt-1">
                  Conteo Físico: {insumoActivo.nombre}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalConteo(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <p className="text-[#555] leading-relaxed">
              Ingresa la cantidad física exacta que tienes en mano / en tu sector (<strong>{insumoActivo.ubicacion}</strong>). Se actualizará el registro en PostgreSQL:
            </p>

            <form onSubmit={manejarConteoFisico} className="space-y-3">
              <div className="bg-[#f8f5eb] p-3 rounded-xl border border-[#ded7c4] flex justify-between items-center">
                <span className="font-medium text-[#6b7c6d]">Stock Registrado en Sistema:</span>
                <span className="font-extrabold text-[#182920]">{insumoActivo.stockActual} {insumoActivo.unidad}</span>
              </div>

              <div>
                <label className="block font-bold text-[#182920] mb-1">
                  Cantidad Física Contada en Mano ({insumoActivo.unidad}):
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={cantidadConteo}
                  onChange={(e) => setCantidadConteo(e.target.value)}
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-base font-extrabold text-[#182920] outline-none"
                  required
                />
              </div>

              {Number(cantidadConteo) !== Number(insumoActivo.stockActual) && (
                <div className="text-[11px] p-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                  Diferencia detectada: <strong>{Number(cantidadConteo) - Number(insumoActivo.stockActual)} {insumoActivo.unidad}</strong> respecto al valor anterior.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalConteo(false)}
                  className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  className="px-5 py-2 rounded-xl bg-[#182920] text-[#f1ecdd] font-bold hover:bg-[#284835]"
                >
                  {procesando ? "Guardando..." : "Confirmar Conteo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: AÑADIR UNIDADES AL STOCK EXISTENTE              */}
      {/* ========================================================= */}
      {modalReponer && insumoActivo && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-sm w-full animate-fade-in text-xs space-y-3">
            <div className="flex justify-between items-start border-b border-[#ded7c4] pb-2">
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Añadir Unidades al Stock: {insumoActivo.nombre}
              </h3>
              <button
                type="button"
                onClick={() => setModalReponer(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={manejarSumarStock} className="space-y-3">
              <div className="bg-[#f8f5eb] p-3 rounded-xl border border-[#ded7c4] flex justify-between items-center">
                <span className="font-medium text-[#6b7c6d]">Stock Actual:</span>
                <span className="font-extrabold text-[#182920]">{insumoActivo.stockActual} {insumoActivo.unidad}</span>
              </div>

              <div>
                <label className="block font-bold text-[#182920] mb-1">
                  Cantidad a Añadir ({insumoActivo.unidad}):
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={cantidadReponer}
                  onChange={(e) => setCantidadReponer(e.target.value)}
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-base font-extrabold text-[#182920] outline-none"
                  required
                />
              </div>

              <div className="flex gap-1.5">
                {[5, 10, 25, 50].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCantidadReponer(v)}
                    className="flex-1 py-1 text-[11px] font-bold bg-[#f8f5eb] border border-[#ded7c4] rounded-lg hover:bg-[#e7dfcb]"
                  >
                    +{v}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalReponer(false)}
                  className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  className="px-5 py-2 rounded-xl bg-[#182920] text-[#f1ecdd] font-bold hover:bg-[#284835]"
                >
                  {procesando ? "Añadiendo..." : "Sumar al Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: SOLICITAR INSUMOS / HERRAMIENTAS                */}
      {/* ========================================================= */}
      {modalSolicitar && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-md w-full animate-fade-in text-xs space-y-3">
            <div className="flex justify-between items-start border-b border-[#ded7c4] pb-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#8fb56b] bg-[#182920] px-2 py-0.5 rounded-full">
                  Pedido Operativo
                </span>
                <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif] mt-1">
                  Solicitar Insumo o Herramienta
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalSolicitar(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={manejarEnviarSolicitud} className="space-y-3">
              <div>
                <label className="block font-bold text-[#182920] mb-1">
                  Seleccionar Producto del Catálogo (Opcional):
                </label>
                <select
                  value={nuevaSolicitud.insumoId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const encontrado = insumos.find((i) => i.id === selId);
                    if (encontrado) {
                      setNuevaSolicitud({
                        ...nuevaSolicitud,
                        insumoId: encontrado.id,
                        insumoNombre: encontrado.nombre,
                        unidad: encontrado.unidad,
                      });
                    } else {
                      setNuevaSolicitud({ ...nuevaSolicitud, insumoId: "" });
                    }
                  }}
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                >
                  <option value="">-- O escribir nombre manual abajo --</option>
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} ({i.ubicacion})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#182920] mb-1">
                  Nombre del Insumo / Herramienta a Solicitar:
                </label>
                <input
                  type="text"
                  value={nuevaSolicitud.insumoNombre}
                  onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, insumoNombre: e.target.value })}
                  placeholder="Ej: Machetes nuevos, Alambre 17/15, Jeringas..."
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Cantidad Requerida:</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={nuevaSolicitud.cantidad}
                    onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, cantidad: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Unidad:</label>
                  <input
                    type="text"
                    value={nuevaSolicitud.unidad}
                    onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, unidad: e.target.value })}
                    placeholder="Unidades, Dosis, Rollos..."
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#182920] mb-1">Urgencia:</label>
                <select
                  value={nuevaSolicitud.urgencia}
                  onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, urgencia: e.target.value })}
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none font-semibold"
                >
                  <option value="Normal">Normal</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#182920] mb-1">Motivo / Tarea de Destino:</label>
                <textarea
                  rows="2"
                  value={nuevaSolicitud.motivo}
                  onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, motivo: e.target.value })}
                  placeholder="Detalla para qué labor o reparación se precisan..."
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl p-2.5 text-[#182920] outline-none"
                  required
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalSolicitar(false)}
                  className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  className="px-5 py-2 rounded-xl bg-[#182920] text-[#f1ecdd] font-bold hover:bg-[#284835]"
                >
                  {procesando ? "Enviando..." : "Enviar Solicitud"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: AÑADIR NUEVO PRODUCTO AL INVENTARIO            */}
      {/* ========================================================= */}
      {modalNuevoProducto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-md w-full animate-fade-in text-xs space-y-3">
            <div className="flex justify-between items-start border-b border-[#ded7c4] pb-2">
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Añadir Nuevo Producto al Inventario
              </h3>
              <button
                type="button"
                onClick={() => setModalNuevoProducto(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={manejarCrearProducto} className="space-y-3">
              <div>
                <label className="block font-bold text-[#182920] mb-1">Nombre del Producto</label>
                <input
                  type="text"
                  value={nuevoProducto.nombre}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })}
                  placeholder="Ej: Lazo Criollo / Botiquín Sanitario"
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Categoría</label>
                  <select
                    value={nuevoProducto.categoria}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, categoria: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  >
                    <option value="Herramientas">Herramientas</option>
                    <option value="Fármaco">Fármaco</option>
                    <option value="Nutrición">Nutrición</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Unidad de Medida</label>
                  <select
                    value={nuevoProducto.unidad}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, unidad: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  >
                    <option value="Unidades">Unidades</option>
                    <option value="Dosis">Dosis</option>
                    <option value="Frascos">Frascos</option>
                    <option value="Rollos">Rollos</option>
                    <option value="Kg">Kg</option>
                    <option value="Bolsas">Bolsas</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#182920] mb-1">
                    Locación / Campo:
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={nuevoProducto.campo}
                      onChange={(e) => {
                        if (e.target.value === "__GESTIONAR__") {
                          setModalGestionLocaciones(true);
                        } else {
                          setNuevoProducto({ ...nuevoProducto, campo: e.target.value });
                        }
                      }}
                      className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none font-semibold text-xs"
                    >
                      {camposDisponibles.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__GESTIONAR__">⚙ Gestionar locaciones...</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setModalGestionLocaciones(true)}
                      className="px-2.5 rounded-xl bg-[#e7dfcb] hover:bg-[#d8cfb7] text-[#182920] border border-[#ded7c4] text-xs font-bold"
                      title="Agregar, editar o eliminar locaciones"
                    >
                      <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#182920] mb-1">
                    Sector / Depósito en Campo:
                  </label>
                  <input
                    type="text"
                    value={nuevoProducto.ubicacion}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, ubicacion: e.target.value })}
                    placeholder="Ej. Galpón 1, Botiquín, Taller..."
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={nuevoProducto.stockActual}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, stockActual: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Stock Mínimo (Alerta)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={nuevoProducto.stockMinimo}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, stockMinimo: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNuevoProducto(false)}
                  className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  className="px-5 py-2 rounded-xl bg-[#182920] text-[#f1ecdd] font-bold hover:bg-[#284835]"
                >
                  {procesando ? "Guardando..." : "Guardar Producto en PostgreSQL"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: CONFIRMAR ELIMINACIÓN DE INSUMOS (MARCADOS/INDIV) */}
      {/* ========================================================= */}
      {modalEliminarInsumos && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-red-200 shadow-2xl max-w-sm w-full animate-fade-in text-xs space-y-3">
            <h3 className="text-base font-bold text-red-800 font-['Fraunces',serif] flex items-center gap-2">
              <i className="fa-solid fa-trash-can"></i>
              {insumoAEliminar
                ? `Eliminar "${insumoAEliminar.nombre}"`
                : `Eliminar ${seleccionadosInsumos.length} Artículos Marcados`}
            </h3>
            <p className="text-[#555] leading-relaxed">
              {insumoAEliminar
                ? `¿Confirmás que deseás eliminar el insumo "${insumoAEliminar.nombre}" (${insumoAEliminar.stockActual} ${insumoAEliminar.unidad}) del stock?`
                : `¿Confirmás que deseás eliminar del inventario los ${seleccionadosInsumos.length} artículos seleccionados? Esta acción actualizará PostgreSQL inmediatamente.`}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setModalEliminarInsumos(false);
                  setInsumoAEliminar(null);
                }}
                className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={procesando}
                onClick={manejarConfirmarEliminarInsumos}
                className="px-5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold"
              >
                {procesando ? "Eliminando..." : "Confirmar Eliminación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6 (PANTALLA EMERGENTE): GESTIONAR LOCACIONES        */}
      {/* (AGREGAR, EDITAR Y ELIMINAR LOCACIONES / CAMPOS)          */}
      {/* ========================================================= */}
      {modalGestionLocaciones && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-[#ded7c4] shadow-2xl max-w-lg w-full space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#ded7c4]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#182920] text-[#8fb56b] flex items-center justify-center text-lg shadow-sm">
                  <i className="fa-solid fa-location-dot"></i>
                </div>
                <div>
                  <h3 className="font-bold text-[#182920] text-base font-['Fraunces',serif]">
                    Gestionar Locaciones / Campos
                  </h3>
                  <p className="text-xs text-[#6b7c6d]">
                    Sincronizado con las Parcelas del campo. También podés agregar locaciones manualmente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalGestionLocaciones(false);
                  setLocacionEditando(null);
                  setLocacionConfirmarEliminar(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Formulario para agregar nueva locación */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                agregarNuevoCampo(nombreNuevoCampo);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={nombreNuevoCampo}
                onChange={(e) => setNombreNuevoCampo(e.target.value)}
                placeholder="Nueva locación (ej: Campo 3 - Santa María)..."
                className="flex-1 bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] text-xs outline-none font-semibold focus:border-[#33512f] focus:bg-white"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#182920] text-[#f1ecdd] font-bold text-xs hover:bg-[#284835] transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap"
              >
                <i className="fa-solid fa-plus text-[#8fb56b]"></i> Agregar
              </button>
            </form>

            {/* Lista de locaciones actuales con Editar y Eliminar */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <span className="text-[10px] font-bold uppercase text-[#6b7c6d] block">
                Locaciones Registradas ({camposDisponibles.length}):
              </span>

              {camposDisponibles.length === 0 ? (
                <p className="text-xs text-[#6b7c6d] italic py-4 text-center bg-[#f8f5eb] rounded-xl">
                  No hay locaciones cargadas. Agregá una arriba.
                </p>
              ) : (
                camposDisponibles.map((loc) => {
                  const cantInsumos = insumos.filter(
                    (i) => (i.campo || "").toLowerCase() === loc.toLowerCase()
                  ).length;
                  const esParcelaSincronizada = parcelasCampo.some(
                    (p) => (p?.nombre || "").trim().toLowerCase() === loc.toLowerCase()
                  );
                  const estaEditando = locacionEditando === loc;
                  const confirmandoEliminar = locacionConfirmarEliminar === loc;

                  return (
                    <div
                      key={loc}
                      className="p-3 rounded-xl bg-[#f8f5eb] border border-[#ded7c4] flex flex-col gap-2"
                    >
                      {estaEditando ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={nuevoNombreLocacion}
                            onChange={(e) => setNuevoNombreLocacion(e.target.value)}
                            className="flex-1 bg-white border border-[#33512f] rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#182920] outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={procesando}
                            onClick={() => guardarEdicionLocacion(loc)}
                            className="px-3 py-1.5 rounded-lg bg-[#182920] text-[#f1ecdd] text-xs font-bold hover:bg-[#284835]"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setLocacionEditando(null)}
                            className="px-2.5 py-1.5 rounded-lg border border-[#ded7c4] bg-white text-[#182920] text-xs font-bold"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : confirmandoEliminar ? (
                        <div className="flex items-center justify-between gap-2 bg-red-50 p-2 rounded-lg border border-red-200">
                          <span className="text-[11px] text-red-800 font-semibold">
                            ¿Eliminar locación <strong>"{loc}"</strong>?
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={procesando}
                              onClick={() => confirmarEliminarLocacion(loc)}
                              className="px-2.5 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold"
                            >
                              Sí, eliminar
                            </button>
                            <button
                              type="button"
                              onClick={() => setLocacionConfirmarEliminar(null)}
                              className="px-2.5 py-1 rounded-lg bg-white border border-[#ded7c4] text-[#182920] text-[11px] font-bold"
                            >
                              No
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#182920] truncate flex items-center gap-1.5 flex-wrap">
                              <i className="fa-solid fa-location-dot text-[#33512f]"></i>
                              <span>{loc}</span>
                              {esParcelaSincronizada && (
                                <span className="text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-full">
                                  Parcela sincronizada
                                </span>
                              )}
                            </p>
                            <span className="text-[10px] text-[#6b7c6d]">
                              {cantInsumos} {cantInsumos === 1 ? "artículo asignado" : "artículos asignados"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setLocacionConfirmarEliminar(null);
                                setLocacionEditando(loc);
                                setNuevoNombreLocacion(loc);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#e7dfcb] text-[#182920] border border-[#ded7c4] text-[11px] font-bold flex items-center gap-1 transition-colors"
                              title="Editar nombre de locación"
                            >
                              <i className="fa-solid fa-pen text-amber-700"></i> Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setLocacionEditando(null);
                                setLocacionConfirmarEliminar(loc);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold flex items-center gap-1 transition-colors"
                              title="Eliminar locación"
                            >
                              <i className="fa-solid fa-trash-can"></i> Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#ded7c4]">
              <button
                type="button"
                onClick={() => {
                  setModalGestionLocaciones(false);
                  setLocacionEditando(null);
                  setLocacionConfirmarEliminar(null);
                }}
                className="px-5 py-2 rounded-xl bg-[#182920] text-[#f1ecdd] font-bold text-xs hover:bg-[#284835]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
