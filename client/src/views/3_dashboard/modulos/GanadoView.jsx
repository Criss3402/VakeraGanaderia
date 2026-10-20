import { useState, useEffect } from "react";
import {
  obtenerGanado,
  obtenerPotreros,
  registrarGanado,
  actualizarGanado,
  eliminarGanado,
  trasladoMasivoGanado,
  registrarPotrero,
  obtenerFichaAnimal,
} from "../../../api/dashboard.api";
import { useAuth } from "../../../context/AuthContext";

export default function GanadoView() {
  const { rol } = useAuth();
  const [ganado, setGanado] = useState([]);
  const [potreros, setPotreros] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Vistas internas del módulo
  const [pestaña, setPestaña] = useState("rodeo"); // 'rodeo' | 'lotes' | 'potreros'

  // Filtros y Búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [filtroPotrero, setFiltroPotrero] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroSanidad, setFiltroSanidad] = useState("todos");

  // Selección múltiple para lotes
  const [seleccionados, setSeleccionados] = useState([]);

  // Modales
  const [modalAlta, setModalAlta] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalFicha, setModalFicha] = useState(false);
  const [modalBaja, setModalBaja] = useState(false);
  const [modalTrasladoLote, setModalTrasladoLote] = useState(false);
  const [modalCrearPotrero, setModalCrearPotrero] = useState(false);

  // Animal seleccionado para acción
  const [animalActivo, setAnimalActivo] = useState(null);
  const [fichaDetalle, setFichaDetalle] = useState(null);
  const [motivoBaja, setMotivoBaja] = useState("Venta a Frigorífico");
  const [potreroDestinoLote, setPotreroDestinoLote] = useState("");

  // Formularios
  const [nuevoAnimal, setNuevoAnimal] = useState({
    caravana: "",
    categoria: "Vacas",
    raza: "Angus Negro",
    sexo: "Hembra",
    pesoKg: 420,
    estadoSanitario: "SALUDABLE",
    potreroId: "",
    fechaNacimiento: new Date().toISOString().split("T")[0],
    tipoAlta: "Nacimiento",
  });

  const [nuevoPotrero, setNuevoPotrero] = useState({
    nombre: "",
    descripcion: "",
    superficieHas: 100,
    capacidad: 120,
  });

  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);

  const puedeGestionar = rol === "dueno" || rol === "capataz";

  async function cargarDatos() {
    try {
      const [resGan, resPot] = await Promise.all([
        obtenerGanado(),
        obtenerPotreros(),
      ]);
      if (resGan?.data) setGanado(resGan.data);
      if (resPot?.data) {
        setPotreros(resPot.data);
        if (resPot.data.length > 0 && !potreroDestinoLote) {
          setPotreroDestinoLote(resPot.data[0].id);
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

  function mostrarNotificacion(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(""), 4500);
  }

  // --- 1. ALTA DE ANIMAL ---
  async function manejarAltaAnimal(e) {
    e.preventDefault();
    if (!nuevoAnimal.caravana.trim()) return;
    setProcesando(true);
    try {
      await registrarGanado(nuevoAnimal);
      mostrarNotificacion(`¡Animal caravana ${nuevoAnimal.caravana.toUpperCase()} registrado con éxito en PostgreSQL!`);
      setModalAlta(false);
      setNuevoAnimal({
        caravana: "",
        categoria: "Vacas",
        raza: "Angus Negro",
        sexo: "Hembra",
        pesoKg: 420,
        estadoSanitario: "SALUDABLE",
        potreroId: potreros[0]?.id || "",
        fechaNacimiento: new Date().toISOString().split("T")[0],
        tipoAlta: "Nacimiento",
      });
      await cargarDatos();
    } catch (err) {
      alert("Error al dar de alta el animal: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  // --- 2. VER FICHA DETALLADA ---
  async function abrirFicha(animal) {
    setAnimalActivo(animal);
    try {
      const res = await obtenerFichaAnimal(animal.id);
      setFichaDetalle(res?.data || animal);
    } catch {
      setFichaDetalle(animal);
    }
    setModalFicha(true);
  }

  // --- 3. EDITAR / REGISTRAR PESAJE ---
  async function manejarEdicion(e) {
    e.preventDefault();
    if (!animalActivo) return;
    setProcesando(true);
    try {
      await actualizarGanado(animalActivo.id, {
        pesoKg: animalActivo.pesoKg,
        potreroId: animalActivo.potreroId,
        estadoSanitario: animalActivo.estadoSanitario,
        categoria: animalActivo.categoria,
      });
      mostrarNotificacion(`Ficha y pesaje del animal ${animalActivo.caravana} actualizados.`);
      setModalEditar(false);
      setAnimalActivo(null);
      await cargarDatos();
    } catch (err) {
      alert("Error al actualizar animal: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  // --- 4. DAR DE BAJA ---
  async function manejarBaja() {
    if (!animalActivo) return;
    setProcesando(true);
    try {
      await eliminarGanado(animalActivo.id, motivoBaja);
      mostrarNotificacion(`Baja del animal ${animalActivo.caravana} procesada (${motivoBaja}).`);
      setModalBaja(false);
      setAnimalActivo(null);
      await cargarDatos();
    } catch (err) {
      alert("Error al registrar baja: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  // --- 5. TRASLADO MASIVO DE LOTE ---
  async function manejarTrasladoLote() {
    if (seleccionados.length === 0 || !potreroDestinoLote) return;
    setProcesando(true);
    try {
      await trasladoMasivoGanado({
        animalIds: seleccionados,
        potreroDestinoId: potreroDestinoLote,
      });
      const dest = potreros.find((p) => p.id === potreroDestinoLote);
      mostrarNotificacion(`Lote de ${seleccionados.length} cabezas trasladado con éxito a ${dest ? dest.nombre : "nuevo potrero"}.`);
      setModalTrasladoLote(false);
      setSeleccionados([]);
      await cargarDatos();
    } catch (err) {
      alert("Error en traslado masivo: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  // --- 6. CREAR NUEVO POTRERO ---
  async function manejarCrearPotrero(e) {
    e.preventDefault();
    if (!nuevoPotrero.nombre.trim()) return;
    setProcesando(true);
    try {
      await registrarPotrero(nuevoPotrero);
      mostrarNotificacion(`Potrero "${nuevoPotrero.nombre}" creado exitosamente.`);
      setModalCrearPotrero(false);
      setNuevoPotrero({
        nombre: "",
        descripcion: "",
        superficieHas: 100,
        capacidad: 120,
      });
      await cargarDatos();
    } catch (err) {
      alert("Error al crear potrero: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  // Toggle de selección
  function toggleSeleccion(id) {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function seleccionarTodos() {
    if (seleccionados.length === ganadoFiltrado.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(ganadoFiltrado.map((g) => g.id));
    }
  }

  // Filtrado de Animales
  const ganadoFiltrado = ganado.filter((g) => {
    const matchBusqueda =
      g.caravana.toLowerCase().includes(busqueda.toLowerCase()) ||
      g.raza.toLowerCase().includes(busqueda.toLowerCase()) ||
      g.categoria.toLowerCase().includes(busqueda.toLowerCase());

    const matchPotrero = filtroPotrero === "todos" || g.potreroId === filtroPotrero;
    const matchCat = filtroCategoria === "todas" || g.categoria === filtroCategoria;
    const matchSanidad = filtroSanidad === "todos" || g.estadoSanitario === filtroSanidad;

    return matchBusqueda && matchPotrero && matchCat && matchSanidad;
  });

  const pesoPromedio = ganado.length > 0
    ? Math.round(ganado.reduce((acc, g) => acc + (g.pesoKg || 0), 0) / ganado.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Banner Principal */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              Fase 4: Gestión Integral de Ganado y Potreros
            </span>
            <span className="text-xs text-[#8fb56b]">PostgreSQL & Prisma Sincronizados</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Control de Rodeo, Potreros y Trazabilidad
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-xl">
            Fichas clínicas individuales, altas por nacimiento/compra, bajas por venta o faena, y movimientos de lotes entre potreros.
          </p>
        </div>

        {puedeGestionar && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (potreros.length > 0 && !nuevoAnimal.potreroId) {
                  setNuevoAnimal((v) => ({ ...v, potreroId: potreros[0].id }));
                }
                setModalAlta(true);
              }}
              className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2"
            >
              <i className="fa-solid fa-plus-circle"></i> + Alta de Animal
            </button>
            <button
              type="button"
              onClick={() => setModalCrearPotrero(true)}
              className="bg-[#1f3729] hover:bg-[#284835] text-[#f1ecdd] border border-[#8fb56b]/40 font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2"
            >
              <i className="fa-solid fa-map-location-dot text-[#8fb56b]"></i> + Nuevo Potrero
            </button>
          </div>
        )}
      </div>

      {mensaje && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm animate-fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600 text-lg"></i>
          <span>{mensaje}</span>
        </div>
      )}

      {/* Pestañas de Navegación del Módulo */}
      <div className="flex items-center gap-2 border-b border-[#ded7c4] pb-2">
        <button
          type="button"
          onClick={() => setPestaña("rodeo")}
          className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all ${
            pestaña === "rodeo"
              ? "bg-[#182920] text-[#f1ecdd] shadow-sm"
              : "bg-white text-[#4a5c4e] border border-[#ded7c4] hover:bg-[#e7dfcb]"
          }`}
        >
          <i className="fa-solid fa-cow"></i>
          <span>Rodeo General ({ganado.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setPestaña("lotes")}
          className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all ${
            pestaña === "lotes"
              ? "bg-[#182920] text-[#f1ecdd] shadow-sm"
              : "bg-white text-[#4a5c4e] border border-[#ded7c4] hover:bg-[#e7dfcb]"
          }`}
        >
          <i className="fa-solid fa-layer-group"></i>
          <span>Manejo por Lotes & Traslados</span>
          {seleccionados.length > 0 && (
            <span className="bg-[#8fb56b] text-[#182920] px-1.5 py-0.2 rounded-full text-[10px]">
              {seleccionados.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setPestaña("potreros")}
          className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all ${
            pestaña === "potreros"
              ? "bg-[#182920] text-[#f1ecdd] shadow-sm"
              : "bg-white text-[#4a5c4e] border border-[#ded7c4] hover:bg-[#e7dfcb]"
          }`}
        >
          <i className="fa-solid fa-map"></i>
          <span>Zonificación de Potreros ({potreros.length})</span>
        </button>
      </div>

      {/* KPI Cards Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
          <p className="text-[10px] font-bold text-[#6b7c6d] uppercase">Total Rodeo</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-0.5">{ganado.length} Cabezas</p>
          <span className="text-[11px] text-[#33512f] font-medium">Distribuido en {potreros.length} potreros</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
          <p className="text-[10px] font-bold text-[#6b7c6d] uppercase">Peso Promedio en Balanza</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-0.5">{pesoPromedio} kg</p>
          <span className="text-[11px] text-[#6b7c6d]">Actualizado en tiempo real</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
          <p className="text-[10px] font-bold text-amber-700 uppercase">En Tratamiento / Cuidado</p>
          <p className="text-2xl font-extrabold text-amber-800 mt-0.5">
            {ganado.filter((g) => g.estadoSanitario !== "SALUDABLE").length} Cabezas
          </p>
          <span className="text-[11px] text-amber-700">Seguimiento clínico veterinario</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm">
          <p className="text-[10px] font-bold text-[#6b7c6d] uppercase">Animales Seleccionados</p>
          <p className="text-2xl font-extrabold text-[#33512f] mt-0.5">{seleccionados.length} Cabezas</p>
          <span className="text-[11px] text-[#33512f]">Listos para acción en lote</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA 1: RODEO GENERAL & FICHAS INDIVIDUALES           */}
      {/* ========================================================= */}
      {pestaña === "rodeo" && (
        <div className="space-y-4">
          {/* Barra de Filtros y Búsqueda */}
          <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
              {/* Buscador */}
              <div className="relative flex-1 max-w-xs">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7c6d] text-xs"></i>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar caravana, raza..."
                  className="w-full text-xs pl-8 pr-3 py-2 bg-[#f8f5eb] border border-[#ded7c4] rounded-xl text-[#182920] outline-none"
                />
              </div>

              {/* Filtro Potrero */}
              <select
                value={filtroPotrero}
                onChange={(e) => setFiltroPotrero(e.target.value)}
                className="text-xs font-semibold bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-2.5 py-2 text-[#182920] outline-none"
              >
                <option value="todos">Todos los Potreros</option>
                {potreros.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>

              {/* Filtro Categoría */}
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="text-xs font-semibold bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-2.5 py-2 text-[#182920] outline-none"
              >
                <option value="todas">Todas las Categorías</option>
                <option value="Vacas">Vacas</option>
                <option value="Toros">Toros</option>
                <option value="Novillos">Novillos</option>
                <option value="Terneras">Terneras</option>
                <option value="Vaquillonas">Vaquillonas</option>
              </select>

              {/* Filtro Sanidad */}
              <select
                value={filtroSanidad}
                onChange={(e) => setFiltroSanidad(e.target.value)}
                className="text-xs font-semibold bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-2.5 py-2 text-[#182920] outline-none"
              >
                <option value="todos">Toda Sanidad</option>
                <option value="SALUDABLE">Saludable</option>
                <option value="OBSERVACION">Observación</option>
                <option value="EN_TRATAMIENTO">En Tratamiento</option>
              </select>
            </div>

            {seleccionados.length > 0 && (
              <button
                type="button"
                onClick={() => setModalTrasladoLote(true)}
                className="bg-[#182920] hover:bg-[#284835] text-[#f1ecdd] font-bold text-xs uppercase px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <i className="fa-solid fa-right-left text-[#8fb56b]"></i> Trasladar Lote ({seleccionados.length})
              </button>
            )}
          </div>

          {/* Tabla de Hacienda */}
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#ded7c4] text-[#4a5c4e] uppercase font-bold text-[10px]">
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={seleccionados.length === ganadoFiltrado.length && ganadoFiltrado.length > 0}
                        onChange={seleccionarTodos}
                        className="rounded cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3">Caravana</th>
                    <th className="py-2.5 px-3">Categoría & Raza</th>
                    <th className="py-2.5 px-3">Sexo</th>
                    <th className="py-2.5 px-3">Peso Vivo</th>
                    <th className="py-2.5 px-3">Potrero Actual</th>
                    <th className="py-2.5 px-3">Estado Clínico</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ded7c4]">
                  {ganadoFiltrado.map((g) => {
                    const esSaludable = g.estadoSanitario === "SALUDABLE";
                    const isChecked = seleccionados.includes(g.id);

                    return (
                      <tr key={g.id} className={`hover:bg-[#f8f5eb] transition-colors ${isChecked ? "bg-[#f8f5eb]/80" : ""}`}>
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSeleccion(g.id)}
                            className="rounded cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3 font-bold text-[#182920]">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-[#e7dfcb] flex items-center justify-center text-[10px] text-[#182920]">
                              <i className="fa-solid fa-tag"></i>
                            </span>
                            <span className="cursor-pointer hover:underline" onClick={() => abrirFicha(g)}>
                              {g.caravana}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#182920]">
                          {g.categoria} <span className="text-[#6b7c6d] font-normal">({g.raza})</span>
                        </td>
                        <td className="py-3 px-3 text-[#555]">{g.sexo}</td>
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
                        <td className="py-3 px-3 text-right space-x-1.5">
                          <button
                            type="button"
                            onClick={() => abrirFicha(g)}
                            className="bg-[#f8f5eb] hover:bg-[#e7dfcb] text-[#182920] border border-[#ded7c4] font-bold text-[10px] px-2 py-1 rounded-lg transition-colors"
                            title="Ver ficha completa"
                          >
                            <i className="fa-solid fa-file-waveform text-[#33512f]"></i> Ficha
                          </button>

                          {puedeGestionar && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setAnimalActivo({ ...g });
                                  setModalEditar(true);
                                }}
                                className="bg-[#f8f5eb] hover:bg-[#e7dfcb] text-[#182920] border border-[#ded7c4] font-bold text-[10px] px-2 py-1 rounded-lg transition-colors"
                                title="Editar pesaje o potrero"
                              >
                                <i className="fa-solid fa-pen text-amber-700"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAnimalActivo(g);
                                  setModalBaja(true);
                                }}
                                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-[10px] px-2 py-1 rounded-lg transition-colors"
                                title="Dar de baja (Venta o Muerte)"
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {ganadoFiltrado.length === 0 && (
                    <tr>
                      <td colSpan="8" className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <i className="fa-solid fa-cow text-3xl text-[#8fb56b]/50"></i>
                          <p className="text-sm font-semibold text-[#182920]">
                            No hay animales registrados en este rodeo.
                          </p>
                          <p className="text-xs text-[#526354]">
                            Hacé clic en "+ Nuevo Animal" para dar de alta la primera cabeza de ganado.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: MANEJO POR LOTES Y TRASLADOS                   */}
      {/* ========================================================= */}
      {pestaña === "lotes" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-3 border-b border-[#ded7c4]">
              <div>
                <h3 className="text-lg font-bold text-[#182920] font-['Fraunces',serif]">
                  Manejo Masivo de Rodeo por Lotes
                </h3>
                <p className="text-xs text-[#6b7c6d]">
                  Traslada grupos enteros de animales de un potrero a otro en un solo movimiento registrado en PostgreSQL.
                </p>
              </div>

              {seleccionados.length > 0 && (
                <button
                  type="button"
                  onClick={() => setModalTrasladoLote(true)}
                  className="bg-[#182920] hover:bg-[#284835] text-[#f1ecdd] font-bold text-xs uppercase px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2"
                >
                  <i className="fa-solid fa-right-left text-[#8fb56b]"></i> Trasladar {seleccionados.length} Animales Seleccionados
                </button>
              )}
            </div>

            <p className="text-xs text-[#182920] font-semibold mb-3">
              Selecciona los animales del rodeo para conformar el lote:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ganado.map((g) => {
                const isChecked = seleccionados.includes(g.id);
                return (
                  <div
                    key={g.id}
                    onClick={() => toggleSeleccion(g.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isChecked
                        ? "bg-[#182920] text-white border-[#182920] shadow-sm"
                        : "bg-[#f8f5eb] text-[#182920] border-[#ded7c4] hover:bg-[#f1ecdd]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // controlado por el div
                        className="rounded"
                      />
                      <div>
                        <p className={`text-xs font-bold ${isChecked ? "text-white" : "text-[#182920]"}`}>
                          {g.caravana} · {g.categoria}
                        </p>
                        <p className={`text-[10px] ${isChecked ? "text-gray-300" : "text-[#6b7c6d]"}`}>
                          {g.raza} • {g.pesoKg} kg • {g.potreroNombre || "Potrero"}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        isChecked
                          ? "bg-[#8fb56b] text-[#182920]"
                          : "bg-white text-[#4a5c4e] border border-[#ded7c4]"
                      }`}
                    >
                      {g.estadoSanitario}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 3: ZONIFICACIÓN DE POTREROS                       */}
      {/* ========================================================= */}
      {pestaña === "potreros" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {potreros.map((p) => {
              const animalesEnPotrero = ganado.filter((g) => g.potreroId === p.id);
              const totalAnimales = animalesEnPotrero.length;
              const porcentajeCarga = p.capacidad
                ? Math.min(100, Math.round((totalAnimales / p.capacidad) * 100))
                : 0;

              return (
                <div key={p.id} className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-[#182920] font-['Fraunces',serif]">{p.nombre}</h4>
                        <p className="text-[11px] text-[#6b7c6d]">{p.superficieHas ? `${p.superficieHas} Has` : "Superficie de campo"}</p>
                      </div>
                      <span className="text-[10px] bg-[#f8f5eb] text-[#33512f] font-bold px-2 py-0.5 rounded border border-[#ded7c4]">
                        Capacidad: {p.capacidad || 100}
                      </span>
                    </div>

                    {/* Barra de Carga */}
                    <div className="space-y-1 mb-4">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[#4a5c4e]">Carga Actual:</span>
                        <span className={porcentajeCarga > 90 ? "text-red-700" : "text-[#33512f]"}>
                          {totalAnimales} cabezas ({porcentajeCarga}%)
                        </span>
                      </div>
                      <div className="w-full bg-[#ded7c4] h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            porcentajeCarga > 90 ? "bg-red-500" : porcentajeCarga > 75 ? "bg-amber-500" : "bg-[#33512f]"
                          }`}
                          style={{ width: `${porcentajeCarga}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Lista rápida de animales en este potrero */}
                    <div className="space-y-1 text-xs max-h-36 overflow-y-auto pr-1">
                      <span className="text-[10px] font-bold uppercase text-[#6b7c6d] block mb-1">Animales en pastoreo:</span>
                      {animalesEnPotrero.length === 0 ? (
                        <p className="text-[11px] text-[#888] italic">Potrero vacío / En descanso de pastura.</p>
                      ) : (
                        animalesEnPotrero.map((an) => (
                          <div key={an.id} className="p-1.5 rounded-lg bg-[#f8f5eb] flex justify-between items-center text-[11px]">
                            <span className="font-bold text-[#182920]">{an.caravana} ({an.categoria})</span>
                            <span className="text-[#6b7c6d]">{an.pesoKg} kg</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#ded7c4] flex justify-between items-center text-xs">
                    <span className="text-[10px] text-[#6b7c6d]">Estado de Pastura: Óptimo</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroPotrero(p.id);
                        setPestaña("rodeo");
                      }}
                      className="text-xs text-[#33512f] font-bold hover:underline"
                    >
                      Filtrar rodeo →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: FICHA CLÍNICA DETALLADA INDIVIDUAL                */}
      {/* ========================================================= */}
      {modalFicha && fichaDetalle && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-lg w-full animate-fade-in text-xs space-y-4">
            <div className="flex justify-between items-start border-b border-[#ded7c4] pb-3">
              <div>
                <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                  Ficha Oficial de Rodeo
                </span>
                <h3 className="text-xl font-bold text-[#182920] font-['Fraunces',serif] mt-1">
                  Caravana: {fichaDetalle.caravana}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalFicha(false)}
                className="text-gray-400 hover:text-gray-700 text-base"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-[#f8f5eb] p-3.5 rounded-xl border border-[#ded7c4]">
              <div>
                <span className="text-[10px] font-bold text-[#6b7c6d] uppercase">Categoría</span>
                <p className="font-bold text-[#182920] text-sm">{fichaDetalle.categoria}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#6b7c6d] uppercase">Raza</span>
                <p className="font-bold text-[#182920] text-sm">{fichaDetalle.raza}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#6b7c6d] uppercase">Sexo</span>
                <p className="font-bold text-[#182920] text-sm">{fichaDetalle.sexo}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#6b7c6d] uppercase">Peso en Balanza</span>
                <p className="font-bold text-[#33512f] text-sm">{fichaDetalle.pesoKg} kg</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#6b7c6d] uppercase">Potrero Asignado</span>
                <p className="font-bold text-[#182920] text-sm">{fichaDetalle.potreroNombre || fichaDetalle.potrero?.nombre || "Sin asignar"}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#6b7c6d] uppercase">Estado Sanitario</span>
                <p className="font-bold text-emerald-800 text-sm">{fichaDetalle.estadoSanitario}</p>
              </div>
            </div>

            {/* Historial Sanitario Vinculado */}
            <div>
              <h4 className="font-bold text-[#182920] mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-syringe text-[#33512f]"></i> Historial Sanitario y Tratamientos
              </h4>
              {fichaDetalle.eventosSanitarios && fichaDetalle.eventosSanitarios.length > 0 ? (
                <div className="space-y-1.5">
                  {fichaDetalle.eventosSanitarios.map((ev) => (
                    <div key={ev.id} className="p-2 rounded-lg bg-[#f8f5eb] border border-[#ded7c4] flex justify-between items-center text-[11px]">
                      <div>
                        <span className="font-bold text-[#182920]">{ev.evento} ({ev.tipo})</span>
                        <span className="text-[#6b7c6d] block">{new Date(ev.fechaProgramada).toLocaleDateString()}</span>
                      </div>
                      <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        {ev.estado}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[#6b7c6d] italic p-2 bg-[#f8f5eb] rounded-lg">
                  Sin intervenciones médicas recientes. Animal en condición saludable.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#ded7c4]">
              <button
                type="button"
                onClick={() => setModalFicha(false)}
                className="px-4 py-2 bg-[#182920] text-[#f1ecdd] rounded-xl font-bold"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ALTA DE ANIMAL (NACIMIENTO O COMPRA)              */}
      {/* ========================================================= */}
      {modalAlta && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-md w-full animate-fade-in text-xs">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#ded7c4]">
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Registrar Alta de Animal en el Rodeo
              </h3>
              <button
                type="button"
                onClick={() => setModalAlta(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={manejarAltaAnimal} className="space-y-3">
              <div>
                <label className="block font-bold text-[#182920] mb-1">Tipo de Alta</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Nacimiento", "Compra"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNuevoAnimal({ ...nuevoAnimal, tipoAlta: t })}
                      className={`py-2 rounded-xl border font-bold text-center transition-colors ${
                        nuevoAnimal.tipoAlta === t
                          ? "bg-[#182920] text-[#f1ecdd] border-[#182920]"
                          : "bg-[#f8f5eb] text-[#4a5c4e] border-[#ded7c4]"
                      }`}
                    >
                      {t === "Nacimiento" ? "🌱 Nacimiento (Parición)" : "💰 Compra de Hacienda"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#182920] mb-1">Número de Caravana (Identificador Único)</label>
                <input
                  type="text"
                  value={nuevoAnimal.caravana}
                  onChange={(e) => setNuevoAnimal({ ...nuevoAnimal, caravana: e.target.value })}
                  placeholder="Ej: AR-84935"
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none font-bold"
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
                <label className="block font-bold text-[#182920] mb-1">Potrero de Destino</label>
                <select
                  value={nuevoAnimal.potreroId}
                  onChange={(e) => setNuevoAnimal({ ...nuevoAnimal, potreroId: e.target.value })}
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                  required
                >
                  {potreros.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.totalAnimales ?? 0} cabezas)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalAlta(false)}
                  className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  className="px-5 py-2 rounded-xl bg-[#182920] text-[#f1ecdd] font-bold hover:bg-[#284835]"
                >
                  {procesando ? "Guardando..." : "Registrar Alta en PostgreSQL"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDITAR / REGISTRAR PESAJE                          */}
      {/* ========================================================= */}
      {modalEditar && animalActivo && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-sm w-full animate-fade-in text-xs">
            <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif] mb-3">
              Editar Animal {animalActivo.caravana}
            </h3>

            <form onSubmit={manejarEdicion} className="space-y-3">
              <div>
                <label className="block font-bold text-[#182920] mb-1">Nuevo Peso en Balanza (kg)</label>
                <input
                  type="number"
                  min="20"
                  max="1500"
                  value={animalActivo.pesoKg}
                  onChange={(e) => setAnimalActivo({ ...animalActivo, pesoKg: e.target.value })}
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#182920] mb-1">Potrero Actual</label>
                <select
                  value={animalActivo.potreroId || ""}
                  onChange={(e) => setAnimalActivo({ ...animalActivo, potreroId: e.target.value })}
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                >
                  {potreros.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#182920] mb-1">Estado Clínico</label>
                <select
                  value={animalActivo.estadoSanitario}
                  onChange={(e) => setAnimalActivo({ ...animalActivo, estadoSanitario: e.target.value })}
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                >
                  <option value="SALUDABLE">Saludable</option>
                  <option value="OBSERVACION">Observación</option>
                  <option value="EN_TRATAMIENTO">En Tratamiento</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalEditar(false)}
                  className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  className="px-5 py-2 rounded-xl bg-[#182920] text-[#f1ecdd] font-bold hover:bg-[#284835]"
                >
                  {procesando ? "Guardando..." : "Actualizar Datos"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: BAJA DE ANIMAL (VENTA, FAENA O MUERTE)             */}
      {/* ========================================================= */}
      {modalBaja && animalActivo && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-red-200 shadow-2xl max-w-sm w-full animate-fade-in text-xs space-y-3">
            <h3 className="text-base font-bold text-red-800 font-['Fraunces',serif]">
              Confirmar Baja de Animal {animalActivo.caravana}
            </h3>
            <p className="text-[#555]">
              Esta acción registrará la salida del animal del rodeo y lo removerá de la hacienda activa en PostgreSQL:
            </p>

            <div>
              <label className="block font-bold text-[#182920] mb-1">Motivo de Baja</label>
              <select
                value={motivoBaja}
                onChange={(e) => setMotivoBaja(e.target.value)}
                className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
              >
                <option value="Venta a Frigorífico">Venta a Frigorífico</option>
                <option value="Venta como Reproductor">Venta como Reproductor</option>
                <option value="Faena para Consumo">Faena para Consumo</option>
                <option value="Mortandad con Causa">Mortandad con Causa</option>
                <option value="Traslado a Otra Estancia">Traslado a Otra Estancia</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalBaja(false)}
                className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={procesando}
                onClick={manejarBaja}
                className="px-5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold"
              >
                {procesando ? "Procesando..." : "Confirmar Baja"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: TRASLADO MASIVO DE LOTE SELECCIONADO              */}
      {/* ========================================================= */}
      {modalTrasladoLote && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-sm w-full animate-fade-in text-xs space-y-3">
            <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
              Traslado de Lote ({seleccionados.length} Animales)
            </h3>
            <p className="text-[#555]">
              Selecciona el potrero al cual deseas mover el lote completo de animales seleccionados:
            </p>

            <div>
              <label className="block font-bold text-[#182920] mb-1">Potrero Destino</label>
              <select
                value={potreroDestinoLote}
                onChange={(e) => setPotreroDestinoLote(e.target.value)}
                className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none font-bold"
              >
                {potreros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (Capacidad: {p.capacidad})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalTrasladoLote(false)}
                className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={procesando}
                onClick={manejarTrasladoLote}
                className="px-5 py-2 rounded-xl bg-[#182920] text-[#f1ecdd] font-bold hover:bg-[#284835]"
              >
                {procesando ? "Trasladando..." : "Confirmar Traslado de Lote"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREAR NUEVO POTRERO                                */}
      {/* ========================================================= */}
      {modalCrearPotrero && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-[#ded7c4] shadow-2xl max-w-md w-full animate-fade-in text-xs">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#ded7c4]">
              <h3 className="text-base font-bold text-[#182920] font-['Fraunces',serif]">
                Crear Nueva División / Potrero
              </h3>
              <button
                type="button"
                onClick={() => setModalCrearPotrero(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={manejarCrearPotrero} className="space-y-3">
              <div>
                <label className="block font-bold text-[#182920] mb-1">Nombre del Potrero</label>
                <input
                  type="text"
                  value={nuevoPotrero.nombre}
                  onChange={(e) => setNuevoPotrero({ ...nuevoPotrero, nombre: e.target.value })}
                  placeholder="Ej: Potrero 6 - Los Sauces"
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Superficie (Has)</label>
                  <input
                    type="number"
                    min="1"
                    value={nuevoPotrero.superficieHas}
                    onChange={(e) => setNuevoPotrero({ ...nuevoPotrero, superficieHas: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#182920] mb-1">Capacidad Máxima (Cabezas)</label>
                  <input
                    type="number"
                    min="1"
                    value={nuevoPotrero.capacidad}
                    onChange={(e) => setNuevoPotrero({ ...nuevoPotrero, capacidad: e.target.value })}
                    className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2 text-[#182920] outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#182920] mb-1">Descripción / Tipo de Pastura</label>
                <textarea
                  rows="2"
                  value={nuevoPotrero.descripcion}
                  onChange={(e) => setNuevoPotrero({ ...nuevoPotrero, descripcion: e.target.value })}
                  placeholder="Ej: Campo natural con aguada central y sombra de eucaliptos..."
                  className="w-full bg-[#f8f5eb] border border-[#ded7c4] rounded-xl p-2.5 text-[#182920] outline-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalCrearPotrero(false)}
                  className="px-4 py-2 rounded-xl border border-[#ded7c4] text-[#182920] font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  className="px-5 py-2 rounded-xl bg-[#182920] text-[#f1ecdd] font-bold hover:bg-[#284835]"
                >
                  {procesando ? "Creando..." : "Crear Potrero en PostgreSQL"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
