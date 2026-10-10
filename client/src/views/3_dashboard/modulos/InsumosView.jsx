import { useState, useEffect } from "react";
import {
  obtenerInsumos,
  registrarInsumo,
  actualizarStockInsumo,
  obtenerSolicitudesInsumos,
  crearSolicitudInsumo,
  actualizarEstadoSolicitudInsumo,
  registrarConteoPertenencias,
} from "../../../api/dashboard.api";
import { useAuth } from "../../../context/AuthContext";

export default function InsumosView() {
  const { rol, usuario } = useAuth();
  const [insumos, setInsumos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Vistas internas: 'inventario' | 'solicitudes'
  const [pestaña, setPestaña] = useState("inventario");

  // Filtros
  const [filtroSector, setFiltroSector] = useState("MIS_PERTENENCIAS");
  const [filtroCategoria, setFiltroCategoria] = useState("TODOS");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtroSolicitudes, setFiltroSolicitudes] = useState("TODAS");
  const [busqueda, setBusqueda] = useState("");

  // Modales
  const [modalNuevoProducto, setModalNuevoProducto] = useState(false);
  const [modalReponer, setModalReponer] = useState(false);
  const [modalConteo, setModalConteo] = useState(false);
  const [modalSolicitar, setModalSolicitar] = useState(false);

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
    ubicacion: "Pertenencias de Peón",
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
      const [resIns, resSol] = await Promise.all([
        obtenerInsumos(),
        obtenerSolicitudesInsumos(),
      ]);
      if (resIns?.data) setInsumos(resIns.data);
      if (resSol?.data) setSolicitudes(resSol.data);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function mostrarNotificacion(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(""), 4500);
  }

  // --- 1. AÑADIR NUEVO PRODUCTO AL STOCK ---
  async function manejarCrearProducto(e) {
    e.preventDefault();
    if (!nuevoProducto.nombre.trim()) return;
    setProcesando(true);
    try {
      await registrarInsumo(nuevoProducto);
      mostrarNotificacion(`Producto "${nuevoProducto.nombre}" añadido al inventario en PostgreSQL.`);
      setModalNuevoProducto(false);
      setNuevoProducto({
        nombre: "",
        categoria: "Herramientas",
        stockActual: 10,
        stockMinimo: 3,
        unidad: "Unidades",
        ubicacion: "Pertenencias de Peón",
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

  // Determinar coincidencia de sector de custodia para "MIS_PERTENENCIAS"
  function coincideConRol(item, rolUsuario) {
    const loc = (item.ubicacion || "").toLowerCase();
    if (rolUsuario === "peon") return loc.includes("peón") || loc.includes("peon");
    if (rolUsuario === "capataz") return loc.includes("capataz") || loc.includes("taller");
    if (rolUsuario === "veterinario") return loc.includes("veterin") || loc.includes("sanitario");
    return true; // Dueño y Oficina ven todo
  }

  // Filtrado de Inventario
  const insumosFiltrados = insumos.filter((item) => {
    const matchBusqueda = item.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      item.ubicacion.toLowerCase().includes(busqueda.toLowerCase());

    let matchSector = true;
    if (filtroSector === "MIS_PERTENENCIAS") {
      matchSector = coincideConRol(item, rol);
    } else if (filtroSector === "PEON") {
      matchSector = item.ubicacion.toLowerCase().includes("peón") || item.ubicacion.toLowerCase().includes("peon");
    } else if (filtroSector === "CAPATAZ") {
      matchSector = item.ubicacion.toLowerCase().includes("capataz") || item.ubicacion.toLowerCase().includes("taller");
    } else if (filtroSector === "VETERINARIO") {
      matchSector = item.ubicacion.toLowerCase().includes("veterin") || item.ubicacion.toLowerCase().includes("sanitario");
    } else if (filtroSector === "OFICINA") {
      matchSector = item.ubicacion.toLowerCase().includes("depósito") || item.ubicacion.toLowerCase().includes("galpón");
    }

    const matchCat = filtroCategoria === "TODOS" || item.categoria === filtroCategoria;
    const matchEst = filtroEstado === "TODOS" ||
      (filtroEstado === "BAJO_STOCK" && (item.requiereReposicion || item.stockActual <= item.stockMinimo)) ||
      (filtroEstado === "OK" && (!item.requiereReposicion && item.stockActual > item.stockMinimo));

    return matchBusqueda && matchSector && matchCat && matchEst;
  });

  // Filtrado de Solicitudes
  const solicitudesFiltradas = solicitudes.filter((sol) => {
    if (filtroSolicitudes === "MIS_SOLICITUDES") return sol.solicitanteRol === rol;
    if (filtroSolicitudes === "PENDIENTES") return sol.estado === "Pendiente";
    if (filtroSolicitudes === "ENTREGADAS") return sol.estado === "Entregado";
    return true;
  });

  const misPertenenciasCount = insumos.filter((i) => coincideConRol(i, rol)).length;
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
          {/* Botón Solicitar Insumo (Para Peón, Capataz y Veterinario) */}
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
          className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all ${pestaña === "inventario"
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
          className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all ${pestaña === "solicitudes"
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
        <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
          <p className="text-[10px] font-bold text-[#6b7c6d] uppercase">Mis Pertenencias Asignadas</p>
          <p className="text-2xl font-extrabold text-[#33512f] mt-0.5">{misPertenenciasCount} Artículos</p>
          <span className="text-[11px] text-[#6b7c6d]">Bajo tu custodia ({rol.toUpperCase()})</span>
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
          <p className="text-[10px] font-bold text-amber-800 uppercase">Solicitudes Pendientes</p>
          <p className="text-2xl font-extrabold text-amber-900 mt-0.5">{solicitudesPendientesCount}</p>
          <span className="text-[11px] text-amber-700">Por entregar / aprobar</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA 1: INVENTARIO, FILTROS Y CONTEO DE PERTENENCIAS   */}
      {/* ========================================================= */}
      {pestaña === "inventario" && (
        <div className="space-y-4">
          {/* Barra de Filtros con FILTRO DE PERTENENCIAS / SECTOR */}
          <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
            <div className="flex items-center gap-2.5 flex-wrap flex-1">
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

              {/* FILTRO DE CUSTODIA / SECTOR */}
              <div className="flex items-center gap-1.5 bg-[#f8f5eb] p-1 rounded-xl border border-[#ded7c4]">
                <span className="text-[10px] font-extrabold text-[#182920] uppercase px-2">
                  <i className="fa-solid fa-filter text-[#33512f]"></i> Custodia / Sector:
                </span>
                <select
                  value={filtroSector}
                  onChange={(e) => setFiltroSector(e.target.value)}
                  className="text-xs font-bold bg-white border border-[#ded7c4] rounded-lg px-2.5 py-1 text-[#182920] outline-none cursor-pointer"
                >
                  <option value="MIS_PERTENENCIAS">Mis Pertenencias — {rol.charAt(0).toUpperCase() + rol.slice(1)}</option>
                  <option value="TODOS">Inventario General</option>
                  <option value="PEON">Peón de Campo</option>
                  <option value="CAPATAZ">Capataz — Campo y Taller</option>
                  <option value="VETERINARIO">Médica Veterinaria — Botiquín</option>
                  <option value="OFICINA">Administración — Depósito Central</option>
                </select>
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

            <div className="text-xs text-[#6b7c6d] self-end lg:self-center">
              Mostrando: <strong className="text-[#182920]">{insumosFiltrados.length}</strong> artículos
            </div>
          </div>

          {/* Grid de Productos con Conteo de Pertenencias y Añadir Stock */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insumosFiltrados.map((item) => {
              const esBajo = item.requiereReposicion || item.stockActual <= item.stockMinimo;
              const esDeMiRol = coincideConRol(item, rol);

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${esDeMiRol ? "border-[#8fb56b] ring-1 ring-[#8fb56b]/30" : "border-[#ded7c4]"
                    }`}
                >
                  <div>
                    {/* Header Card */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#4a5c4e] bg-[#f8f5eb] px-2 py-0.5 rounded border border-[#ded7c4]">
                          {item.categoria}
                        </span>
                        {esDeMiRol && (
                          <span className="text-[9px] bg-[#182920] text-[#8fb56b] font-bold px-2 py-0.5 rounded-full">
                            Asignado a mí
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${esBajo
                            ? "bg-red-100 text-red-800 border-red-300"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                          }`}
                      >
                        {esBajo ? "Bajo Stock" : "OK"}
                      </span>
                    </div>

                    {/* Nombre y Ubicación */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[#e7dfcb] text-[#182920] flex items-center justify-center text-lg flex-shrink-0">
                        <i className={`fa-solid ${item.icono || "fa-box-archive"}`}></i>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-[#182920] leading-snug truncate">
                          {item.nombre}
                        </h4>
                        <p className="text-[11px] text-[#6b7c6d] flex items-center gap-1 mt-0.5">
                          <i className="fa-solid fa-location-dot text-[#8fb56b]"></i>
                          <span>{item.ubicacion}</span>
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
                    {/* Botón de CONTEO DE PERTENENCIAS (Peón, Capataz, Veterinario) */}
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

                    {/* Botón AÑADIR AL STOCK */}
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
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold text-[#182920] uppercase">Filtrar:</span>
              {["TODAS", "MIS_SOLICITUDES", "PENDIENTES", "ENTREGADAS"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltroSolicitudes(f)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${filtroSolicitudes === f
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
                      className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${esPendiente ? "bg-[#f8f5eb] border-amber-300" : "bg-white border-[#ded7c4]"
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
                          <span className="text-xs text-[#6b7c6d]">· Solicitado por: <strong>{s.solicitanteNombre}</strong> ({s.solicitanteRol})</span>
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
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${esEntregado
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : s.estado === "Aprobado"
                                ? "bg-blue-100 text-blue-800 border-blue-300"
                                : "bg-amber-100 text-amber-800 border-amber-300"
                            }`}
                        >
                          {esEntregado ? "✓ Entregado" : s.estado === "Aprobado" ? "✓ Aprobado" : "⏳ Pendiente"}
                        </span>

                        {/* Botones de acción para Capataz, Oficina o Dueño */}
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

              <div>
                <label className="block font-bold text-[#182920] mb-1">
                  Ubicación / Sector de Pertenencia
                </label>
                <select
                  value={nuevoProducto.ubicacion}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, ubicacion: e.target.value })}
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none font-semibold"
                >
                  <option value="Pertenencias de Peón">Pertenencias de Peón (Machetes, lazos)</option>
                  <option value="Campo y Taller (Capataz)">Campo y Taller (Capataz)</option>
                  <option value="Botiquín Veterinario">Botiquín Veterinario (Sanidad)</option>
                  <option value="Depósito Central">Depósito Central (Oficina)</option>
                </select>
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
    </div>
  );
}
