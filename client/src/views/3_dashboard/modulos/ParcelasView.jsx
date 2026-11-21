import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  obtenerPotreros,
  obtenerGanado,
  registrarPotrero,
  actualizarPotrero,
  eliminarPotrero,
  trasladoMasivoGanado,
  obtenerPermisosParcelas,
  solicitarPermisoParcelas,
  responderPermisoParcelas,
} from "../../../api/dashboard.api";
import { useAuth } from "../../../context/AuthContext";

// Coordenadas base iniciales (Goya, Corrientes - Establecimiento)
const CENTRO_BASE_DEFECTO = [-59.2550, -29.1420];

// Clave de almacenamiento local para persistencia resiliente de geometrías
const STORAGE_KEY_PARCELAS = "vakera_potreros_geometrias_v2";

// Unidades de superficie soportadas (por defecto m²)
const UNIDADES_SUPERFICIE = {
  m2: {
    clave: "m2",
    etiqueta: "Metros cuadrados",
    sufijo: "m²",
    factorDesdeHas: 10000,
    decimales: 0,
  },
  has: {
    clave: "has",
    etiqueta: "Hectáreas",
    sufijo: "Has",
    factorDesdeHas: 1,
    decimales: 1,
  },
  km2: {
    clave: "km2",
    etiqueta: "Kilómetros cuadrados",
    sufijo: "km²",
    factorDesdeHas: 0.01,
    decimales: 3,
  },
  acres: {
    clave: "acres",
    etiqueta: "Acres",
    sufijo: "Acres",
    factorDesdeHas: 2.47105,
    decimales: 2,
  },
};

function convertirDesdeHas(superficieHas, unidad = "m2") {
  const meta = UNIDADES_SUPERFICIE[unidad] || UNIDADES_SUPERFICIE.m2;
  const base = Number(superficieHas) || 0;
  return base * meta.factorDesdeHas;
}

function formatearSuperficie(superficieHas, unidad = "m2") {
  const meta = UNIDADES_SUPERFICIE[unidad] || UNIDADES_SUPERFICIE.m2;
  const valor = convertirDesdeHas(superficieHas, unidad);
  const textoNum = valor.toLocaleString("es-AR", {
    minimumFractionDigits: meta.decimales > 0 && valor > 0 && valor < 1 ? 1 : 0,
    maximumFractionDigits: meta.decimales,
  });
  return `${textoNum} ${meta.sufijo}`;
}

// Paleta de colores predefinida con alto contraste y visibilidad agronómica sobre satélite
const PALETA_COLORES = [
  { nombre: "Naranja Fuego", hex: "#ea580c" },
  { nombre: "Azul Zafiro", hex: "#0284c7" },
  { nombre: "Esmeralda Neón", hex: "#10b981" },
  { nombre: "Ámbar Dorado", hex: "#f59e0b" },
  { nombre: "Violeta Eléctrico", hex: "#8b5cf6" },
  { nombre: "Rojo Carmín", hex: "#ef4444" },
  { nombre: "Cian Turquesa", hex: "#06b6d4" },
  { nombre: "Rosa Fucsia", hex: "#ec4899" },
];

// URL de glifos de fuentes tipográficas para MapLibre
const GLYPHS_URL = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";

// Estilos de mapa satelital y cartográfico con capas de referencia geográfica
const ESTILOS_MAPA = {
  satelite: {
    nombre: "Satélite Híbrido",
    icono: "fa-satellite",
    spec: {
      version: 8,
      glyphs: GLYPHS_URL,
      sources: {
        "esri-sat": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          maxzoom: 18,
          attribution: "Esri World Imagery",
        },
        "esri-roads": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          maxzoom: 18,
        },
        "esri-places": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          maxzoom: 18,
        },
      },
      layers: [
        {
          id: "sat-layer",
          type: "raster",
          source: "esri-sat",
          minzoom: 0,
          maxzoom: 22,
        },
        {
          id: "roads-ref-layer",
          type: "raster",
          source: "esri-roads",
          minzoom: 0,
          maxzoom: 22,
        },
        {
          id: "places-ref-layer",
          type: "raster",
          source: "esri-places",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },
  calles: {
    nombre: "Cartográfico OSM",
    icono: "fa-map",
    spec: {
      version: 8,
      glyphs: GLYPHS_URL,
      sources: {
        "osm": {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          maxzoom: 19,
          attribution: "OpenStreetMap contributors",
        },
      },
      layers: [
        {
          id: "osm-layer",
          type: "raster",
          source: "osm",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },
  topografico: {
    nombre: "Relieve / Topo",
    icono: "fa-mountain-sun",
    spec: {
      version: 8,
      glyphs: GLYPHS_URL,
      sources: {
        "opentopo": {
          type: "raster",
          tiles: ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          maxzoom: 17,
          attribution: "OpenTopoMap",
        },
      },
      layers: [
        {
          id: "topo-layer",
          type: "raster",
          source: "opentopo",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },
};

/**
 * Cálculo geodésico de área en Hectáreas mediante el exceso esférico
 */
function calcularAreaHectareas(coordenadas) {
  if (!coordenadas || coordenadas.length < 3) return 0;
  const R = 6378137; // Radio medio de la Tierra en metros (WGS84)
  let areaM2 = 0;
  const aRadianes = (deg) => (deg * Math.PI) / 180;

  const puntos = coordenadas.slice();
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  if (primero[0] !== ultimo[0] || primero[1] !== ultimo[1]) {
    puntos.push(primero);
  }

  for (let i = 0; i < puntos.length - 1; i++) {
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    areaM2 += (aRadianes(p2[0]) - aRadianes(p1[0])) * (2 + Math.sin(aRadianes(p1[1])) + Math.sin(aRadianes(p2[1])));
  }
  areaM2 = Math.abs((areaM2 * R * R) / 2.0);
  const has = areaM2 / 10000;
  return Number(has.toFixed(1));
}

function calcularCentroide(coordenadas) {
  if (!coordenadas || coordenadas.length === 0) return CENTRO_BASE_DEFECTO;
  let sumLng = 0;
  let sumLat = 0;
  for (const c of coordenadas) {
    sumLng += c[0];
    sumLat += c[1];
  }
  return [sumLng / coordenadas.length, sumLat / coordenadas.length];
}

const POTREROS_PREDETERMINADOS_EXCLUIDOS = new Set(["pot-1", "pot-2", "pot-3", "pot-4", "pot-5"]);

function obtenerStorageKeyCuenta(usuario) {
  const scope = usuario?.establecimientoId || usuario?.id;
  return scope ? `vakera_parcelas_cuenta_${scope}` : null;
}

function leerParcelasLocales(storageKey) {
  try {
    // Limpiar clave global antigua que mezclaba parcelas entre cuentas
    localStorage.removeItem("vakera_potreros_geometrias_v2");
    if (!storageKey) return [];
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((p) => !POTREROS_PREDETERMINADOS_EXCLUIDOS.has(p?.id))
      : [];
  } catch (_) {
    return [];
  }
}

function obtenerCuentaScope(usuario) {
  return (
    usuario?.establecimientoId ||
    usuario?.id ||
    usuario?.email ||
    "default"
  );
}

function leerRenombresParcelas(usuario) {
  try {
    const cuentaScope = obtenerCuentaScope(usuario);
    const raw = localStorage.getItem(`vakera_parcelas_renombres_${cuentaScope}`);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn("Aviso al leer renombres de parcelas:", err.message);
    return {};
  }
}

function guardarParcelasLocales(storageKey, lista, usuario, { desbloquearNombre = null } = {}) {
  try {
    localStorage.removeItem("vakera_potreros_geometrias_v2");
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(lista));

    // Sincronizar automáticamente las parcelas delimitadas con las Locaciones / Campos de Insumos
    const cuentaScope = obtenerCuentaScope(usuario);
    const storageKeyLocaciones = `vakera_locaciones_${cuentaScope}`;
    const storageKeyEliminadas = `vakera_locaciones_excluidas_${cuentaScope}`;
    const renombres = leerRenombresParcelas(usuario);

    let excluidasActuales = [];
    try {
      const rawExcl = localStorage.getItem(storageKeyEliminadas);
      if (rawExcl) {
        const parsedExcl = JSON.parse(rawExcl);
        if (Array.isArray(parsedExcl)) excluidasActuales = parsedExcl;
      }
    } catch (err) {
      console.warn("Aviso al leer locaciones excluidas:", err.message);
    }

    if (desbloquearNombre) {
      const desbloqLower = desbloquearNombre.trim().toLowerCase();
      excluidasActuales = excluidasActuales.filter(
        (loc) => String(loc).trim().toLowerCase() !== desbloqLower
      );
      localStorage.setItem(storageKeyEliminadas, JSON.stringify(excluidasActuales));
    }

    const nombresParcelas = (Array.isArray(lista) ? lista : [])
      .map((p) => (p?.nombre || "").trim())
      .filter(
        (nombre) =>
          Boolean(nombre) &&
          !excluidasActuales.some(
            (ex) => String(ex).trim().toLowerCase() === nombre.toLowerCase()
          )
      );

    if (nombresParcelas.length > 0) {
      let locacionesActuales = [];
      try {
        const rawLoc = localStorage.getItem(storageKeyLocaciones);
        if (rawLoc) {
          const parsedLoc = JSON.parse(rawLoc);
          if (Array.isArray(parsedLoc)) locacionesActuales = parsedLoc;
        }
      } catch (err) {
        console.warn("Aviso al leer locaciones sincronizadas:", err.message);
      }

      // Reemplazar nombres antiguos si fueron renombrados en Insumos y quitar excluidos
      const locacionesNormalizadas = locacionesActuales
        .map((loc) => {
          const keyLower = String(loc || "").trim().toLowerCase();
          return renombres[keyLower] || loc;
        })
        .filter(
          (loc) =>
            Boolean(loc) &&
            !excluidasActuales.some(
              (ex) => String(ex).trim().toLowerCase() === String(loc).trim().toLowerCase()
            )
        );

      const locacionesCombinadas = Array.from(
        new Set([...nombresParcelas, ...locacionesNormalizadas])
      );
      localStorage.setItem(storageKeyLocaciones, JSON.stringify(locacionesCombinadas));
    }
  } catch (err) {
    console.warn("No se pudieron persistir parcelas locales:", err.message);
  }
}

function eliminarParcelaDeLocacionesLocales(usuario, nombreParcela) {
  const limpio = (nombreParcela || "").trim();
  if (!limpio) return;
  try {
    const cuentaScope =
      usuario?.establecimientoId ||
      usuario?.id ||
      usuario?.email ||
      "default";
    const storageKeyLocaciones = `vakera_locaciones_${cuentaScope}`;
    const rawLoc = localStorage.getItem(storageKeyLocaciones);
    if (rawLoc) {
      const parsedLoc = JSON.parse(rawLoc);
      if (Array.isArray(parsedLoc)) {
        const filtradas = parsedLoc.filter(
          (loc) => String(loc).trim().toLowerCase() !== limpio.toLowerCase()
        );
        localStorage.setItem(storageKeyLocaciones, JSON.stringify(filtradas));
      }
    }
  } catch (err) {
    console.warn("No se pudo desvincular parcela de locaciones:", err.message);
  }
}

export default function ParcelasView() {
  const { rol, usuario } = useAuth();
  const storageKeyCuenta = useMemo(() => obtenerStorageKeyCuenta(usuario), [usuario?.establecimientoId, usuario?.id]);
  const mapaContainerRef = useRef(null);
  const mapaInstanciaRef = useRef(null);
  const marcadoresVerticesRef = useRef([]);

  // Estados de datos
  const [potreros, setPotreros] = useState([]);
  const [ganado, setGanado] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [estiloActivo, setEstiloActivo] = useState("satelite");
  const [parcelaSeleccionada, setParcelaSeleccionada] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [unidadSuperficie, setUnidadSuperficie] = useState(() => {
    try {
      const saved = localStorage.getItem("vakera_unidad_superficie");
      return saved && UNIDADES_SUPERFICIE[saved] ? saved : "m2";
    } catch {
      return "m2";
    }
  });
  const [menuMetricaAbierto, setMenuMetricaAbierto] = useState(false);
  const [menuAccionesAbierto, setMenuAccionesAbierto] = useState(false);

  // Estados del Modo Trazado
  const [modoTrazado, setModoTrazado] = useState(false);
  const [puntosTrazado, setPuntosTrazado] = useState([]);

  // Coordenadas proyectadas en píxeles para el renderizado SVG sobre el mapa
  const [svgPuntos, setSvgPuntos] = useState([]);
  const [svgPotreros, setSvgPotreros] = useState([]);
  const [svgMouse, setSvgMouse] = useState(null);

  // Modal para guardar o editar zona delimitada
  const [modalGuardarZona, setModalGuardarZona] = useState(false);
  const [parcelaEditandoId, setParcelaEditandoId] = useState(null);
  const [nombreOriginalEditando, setNombreOriginalEditando] = useState("");
  const [formularioZona, setFormularioZona] = useState({
    nombre: "",
    superficieHas: 0,
    capacidad: "",
    pastura: "Campo Natural y Gramíneas",
    estadoPastura: "Óptimo",
    aguada: "Bebedero / Tanque",
    color: "#ea580c",
    descripcion: "",
    coordinates: [],
  });

  // Modal para traslado masivo de hacienda
  const [modalTraslado, setModalTraslado] = useState(false);
  const [trasladoAnimalesIds, setTrasladoAnimalesIds] = useState([]);

  // Permisos de parcelas (Administrador -> Dueño)
  const [permisoParcelas, setPermisoParcelas] = useState(null);
  const [modalSolicitarPermiso, setModalSolicitarPermiso] = useState(null); // { accion, parcelaId, parcelaNombre }
  const [motivoPermiso, setMotivoPermiso] = useState("");
  const [procesandoPermiso, setProcesandoPermiso] = useState(false);

  // Sincronizar refs para eventos de MapLibre sin stale closures
  const modoTrazadoRef = useRef(false);
  modoTrazadoRef.current = modoTrazado;

  const puntosTrazadoRef = useRef([]);
  puntosTrazadoRef.current = puntosTrazado;

  const potrerosRef = useRef([]);
  potrerosRef.current = potreros;

  const rolNorm = String(rol || "").toLowerCase();
  const esDueno = rolNorm === "dueno";
  const esCapataz = rolNorm === "capataz";
  const esOficina = rolNorm === "oficina";
  const puedeGestionar = esDueno || esCapataz;
  const permisoAgregarEstado = permisoParcelas?.permisoAgregarEstado || "NINGUNA";
  const permisoAgregarAprobado = !esOficina || permisoAgregarEstado === "APROBADA";
  const permisosEditarPorParcela = permisoParcelas?.permisosEditarPorParcela || {};
  const obtenerEstadoPermisoEditar = (parcelaId) =>
    permisosEditarPorParcela[parcelaId] || "NINGUNA";
  const puedeCrearOEditar = puedeGestionar || esOficina;

  // Actualizar coordenadas de proyección SVG en pantalla (parcelas guardadas + trazado activo)
  const actualizarSvgOverlay = useCallback(() => {
    const mapa = mapaInstanciaRef.current;
    if (!mapa) return;

    // 1. Proyectar únicamente las parcelas de la cuenta activa
    const listaPot = potrerosRef.current;
    const potrerosProyectados = listaPot
      .filter((p) => Array.isArray(p.coordinates) && p.coordinates.length >= 3)
      .map((p) => {
        const coords = p.coordinates.slice();
        const primero = coords[0];
        const ultimo = coords[coords.length - 1];
        if (primero[0] !== ultimo[0] || primero[1] !== ultimo[1]) {
          coords.push(primero);
        }
        const pts = coords
          .map((pt) => {
            const pix = mapa.project(pt);
            return `${Math.round(pix.x)},${Math.round(pix.y)}`;
          })
          .join(" ");

        const centroCoord = calcularCentroide(p.coordinates);
        const centroPix = mapa.project(centroCoord);

        return {
          id: p.id,
          nombre: p.nombre,
          color: p.color || "#ea580c",
          superficieHas: p.superficieHas || 0,
          pointsStr: pts,
          centro: { x: Math.round(centroPix.x), y: Math.round(centroPix.y) },
        };
      });
    setSvgPotreros(potrerosProyectados);

    // 2. Proyectar puntos de trazado activo
    const puntos = puntosTrazadoRef.current;
    if (!puntos || puntos.length === 0) {
      setSvgPuntos([]);
      return;
    }
    const proyectados = puntos.map((pt) => {
      const pix = mapa.project(pt);
      return { x: Math.round(pix.x), y: Math.round(pix.y) };
    });
    setSvgPuntos(proyectados);
  }, []);

  // Generar GeoJSON de las parcelas guardadas de la cuenta activa
  const construirGeoJSONParcelas = useCallback((lista) => {
    const fuente = lista !== undefined ? lista : potrerosRef.current;
    const features = (fuente || [])
      .filter((p) => Array.isArray(p.coordinates) && p.coordinates.length >= 3)
      .map((p) => {
        const animalesEnPotrero = (ganado || []).filter(
          (g) => g.potreroId === p.id || g.potrero === p.nombre || g.potreroNombre === p.nombre
        );
        const totalAnimales = p.totalAnimales ?? animalesEnPotrero.length;
        const capacidad = p.capacidad || 100;
        const cargaPct = Math.min(100, Math.round((totalAnimales / (capacidad || 1)) * 100));

        const coords = p.coordinates.slice();
        const primero = coords[0];
        const ultimo = coords[coords.length - 1];
        if (primero[0] !== ultimo[0] || primero[1] !== ultimo[1]) {
          coords.push([primero[0], primero[1]]);
        }

        const colorParcela = p.color || "#ea580c";

        return {
          type: "Feature",
          id: p.id,
          properties: {
            id: p.id,
            nombre: p.nombre,
            superficieHas: p.superficieHas || 0,
            capacidad: capacidad,
            totalAnimales: totalAnimales,
            cargaPct: cargaPct,
            pastura: p.pastura || "Campo Natural",
            estadoPastura: p.estadoPastura || "Óptimo",
            aguada: p.aguada || "Aguada no especificada",
            color: colorParcela,
            descripcion: p.descripcion || "",
          },
          geometry: {
            type: "Polygon",
            coordinates: [coords],
          },
        };
      });

    return {
      type: "FeatureCollection",
      features,
    };
  }, [ganado]);

  // Sincronizar fuente MapLibre en tiempo real
  const actualizarFuenteParcelas = useCallback((lista) => {
    const mapa = mapaInstanciaRef.current;
    if (!mapa) return;
    try {
      const src = mapa.getSource("parcelas-source");
      if (src) {
        const geojson = construirGeoJSONParcelas(lista);
        src.setData(geojson);
      }
    } catch (e) {
      console.warn("Aviso al actualizar parcelas-source:", e.message);
    }
  }, [construirGeoJSONParcelas]);

  // Cargar datos reales aislados por cuenta/establecimiento
  async function cargarDatos() {
    setCargando(true);
    try {
      const [resPot, resGan] = await Promise.all([
        obtenerPotreros(),
        obtenerGanado(),
      ]);

      const listaApi = (Array.isArray(resPot?.data) ? resPot.data : []).filter(
        (p) => !POTREROS_PREDETERMINADOS_EXCLUIDOS.has(p?.id)
      );
      const listaLocal = leerParcelasLocales(storageKeyCuenta);
      const mapaLocal = new Map(listaLocal.map((p) => [p.id, p]));
      const renombres = leerRenombresParcelas(usuario);

      // Solo conservamos las parcelas que pertenecen a esta cuenta según el servidor, respetando renombres hechos en Insumos
      const listaFinal = listaApi.map((p) => {
        const previo = mapaLocal.get(p.id);
        const nombreApiLimpio = (p.nombre || "").trim();
        const nombreRenombrado =
          renombres[p.id] ||
          renombres[nombreApiLimpio.toLowerCase()] ||
          previo?.nombrePersonalizado ||
          p.nombre;

        return {
          ...previo,
          ...p,
          nombre: nombreRenombrado,
          nombrePersonalizado:
            renombres[p.id] ||
            renombres[nombreApiLimpio.toLowerCase()] ||
            previo?.nombrePersonalizado ||
            undefined,
          coordinates:
            Array.isArray(p.coordinates) && p.coordinates.length > 2
              ? p.coordinates
              : previo?.coordinates || [],
          color: p.color || previo?.color || "#ea580c",
          pastura: p.pastura || previo?.pastura || "Campo Natural",
          aguada: p.aguada || previo?.aguada || "Aguada no especificada",
          estadoPastura: p.estadoPastura || previo?.estadoPastura || "Óptimo",
        };
      });

      potrerosRef.current = listaFinal;
      setPotreros(listaFinal);
      guardarParcelasLocales(storageKeyCuenta, listaFinal, usuario);

      if (Array.isArray(resGan?.data)) setGanado(resGan.data);
      actualizarFuenteParcelas(listaFinal);
      actualizarSvgOverlay();
    } catch (err) {
      console.warn("Fallo al consultar potreros/ganado:", err.message);
      const renombres = leerRenombresParcelas(usuario);
      const listaLocal = leerParcelasLocales(storageKeyCuenta).map((p) => {
        const nombreLimpio = (p?.nombre || "").trim();
        const nombreRenombrado =
          renombres[p?.id] ||
          renombres[nombreLimpio.toLowerCase()] ||
          p?.nombrePersonalizado ||
          p?.nombre;
        return { ...p, nombre: nombreRenombrado };
      });
      potrerosRef.current = listaLocal;
      setPotreros(listaLocal);
      guardarParcelasLocales(storageKeyCuenta, listaLocal, usuario);
      actualizarFuenteParcelas(listaLocal);
      actualizarSvgOverlay();
    } finally {
      setCargando(false);
    }
  }

  const cargarPermisosParcelas = useCallback(async () => {
    if (!esDueno && !esOficina) return;
    try {
      const res = await obtenerPermisosParcelas();
      if (res?.data) {
        setPermisoParcelas(res.data);
      }
    } catch (err) {
      console.warn("[ParcelasView] No se pudieron cargar permisos de parcelas:", err.message);
    }
  }, [esDueno, esOficina]);

  useEffect(() => {
    setParcelaSeleccionada(null);
    cargarDatos();
    cargarPermisosParcelas();
  }, [storageKeyCuenta, cargarPermisosParcelas]);

  useEffect(() => {
    function manejarActualizacionExterna() {
      cargarPermisosParcelas();
    }
    window.addEventListener("vakera:permisos-parcelas-actualizados", manejarActualizacionExterna);
    return () => {
      window.removeEventListener(
        "vakera:permisos-parcelas-actualizados",
        manejarActualizacionExterna
      );
    };
  }, [cargarPermisosParcelas]);

  function mostrarNotificacion(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(""), 4500);
  }

  // Renderizar marcadores HTML visibles inmediatamente para cada vértice colocado
  function sincronizarMarcadoresDom(puntos) {
    const mapa = mapaInstanciaRef.current;
    if (!mapa) return;

    // Remover marcadores anteriores
    marcadoresVerticesRef.current.forEach((m) => m.remove());
    marcadoresVerticesRef.current = [];

    puntos.forEach((pt, idx) => {
      const esPrimero = idx === 0;
      const el = document.createElement("div");
      el.className = esPrimero
        ? "flex flex-col items-center cursor-pointer select-none -translate-y-1/2 -translate-x-1/2 z-20"
        : "flex flex-col items-center pointer-events-none select-none -translate-y-1/2 -translate-x-1/2 z-10";

      if (esPrimero) {
        if (puntos.length >= 3) {
          // Si hay 3 o más puntos, el primer punto es el botón para cerrar la zona
          el.innerHTML = `
            <div class="animate-bounce bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] px-3 py-1 rounded-full shadow-2xl border-2 border-white flex items-center gap-1.5 transition-transform transform hover:scale-110 mb-1 z-30">
              <i class="fa-solid fa-check text-xs"></i>
              <span>Cerrar Zona</span>
            </div>
            <div class="w-7 h-7 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-white font-black text-xs">
              1
            </div>
          `;
          el.onclick = (e) => {
            e.stopPropagation();
            finalizarTrazado();
          };
        } else {
          // Vértice 1 inicial con badge visible
          el.innerHTML = `
            <div class="bg-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-xl border border-white mb-1 z-20">
              Vértice 1 (Inicio)
            </div>
            <div class="w-7 h-7 rounded-full bg-red-600 border-2 border-white shadow-2xl flex items-center justify-center text-white font-black text-xs animate-pulse">
              1
            </div>
          `;
        }
      } else {
        // Vértices subsiguientes (2, 3, etc.)
        el.innerHTML = `
          <div class="w-6 h-6 rounded-full bg-[#facc15] border-2 border-black shadow-xl flex items-center justify-center text-black font-black text-xs z-10">
            ${idx + 1}
          </div>
        `;
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(pt)
        .addTo(mapa);

      marcadoresVerticesRef.current.push(marker);
    });

    actualizarSvgOverlay();
  }

  // Inicializar mapa de MapLibre GL
  useEffect(() => {
    if (!mapaContainerRef.current) return;

    if (mapaInstanciaRef.current) {
      mapaInstanciaRef.current.remove();
      mapaInstanciaRef.current = null;
    }

    let centroInicial = CENTRO_BASE_DEFECTO;
    const datosCentro = potrerosRef.current;
    if (datosCentro.length > 0 && Array.isArray(datosCentro[0].coordinates) && datosCentro[0].coordinates.length > 0) {
      centroInicial = calcularCentroide(datosCentro[0].coordinates);
    }

    const mapa = new maplibregl.Map({
      container: mapaContainerRef.current,
      style: ESTILOS_MAPA[estiloActivo].spec,
      center: centroInicial,
      zoom: 13.5,
      maxZoom: 21,
      pitch: 20,
      bearing: 0,
      attributionControl: false,
    });

    mapa.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    mapa.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    mapa.addControl(new maplibregl.FullscreenControl(), "top-right");

    mapa.on("load", () => {
      // 1. CAPAS DE PARCELAS GUARDADAS EN MAPLIBRE
      const datosIniciales = potrerosRef.current;
      mapa.addSource("parcelas-source", {
        type: "geojson",
        data: construirGeoJSONParcelas(datosIniciales),
      });

      // Relleno de las parcelas con el color asignado y alta visibilidad
      mapa.addLayer({
        id: "parcelas-fill",
        type: "fill",
        source: "parcelas-source",
        paint: {
          "fill-color": [
            "case",
            ["has", "color"],
            ["to-color", ["get", "color"]],
            ["to-color", "#ea580c"]
          ],
          "fill-opacity": 0.65,
        },
      });

      // Borde exterior blanco grueso para máximo contraste
      mapa.addLayer({
        id: "parcelas-borders-halo",
        type: "line",
        source: "parcelas-source",
        paint: {
          "line-color": "#ffffff",
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });

      // Borde interior con el color elegido
      mapa.addLayer({
        id: "parcelas-borders-core",
        type: "line",
        source: "parcelas-source",
        paint: {
          "line-color": [
            "case",
            ["has", "color"],
            ["to-color", ["get", "color"]],
            ["to-color", "#ea580c"]
          ],
          "line-width": 3.8,
          "line-opacity": 1.0,
        },
      });

      // Etiquetas con Nombre y Hectáreas
      mapa.addLayer({
        id: "parcelas-labels",
        type: "symbol",
        source: "parcelas-source",
        layout: {
          "text-field": [
            "concat",
            ["get", "nombre"],
            "\n",
            ["get", "superficieHas"],
            " Has • ",
            ["get", "totalAnimales"],
            " Cab."
          ],
          "text-size": 12,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-anchor": "center",
          "text-justify": "center",
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#000000",
          "text-halo-width": 3,
        },
      });

      // Sincronizar marcadores y SVG si ya habían puntos
      if (puntosTrazadoRef.current.length > 0) {
        sincronizarMarcadoresDom(puntosTrazadoRef.current);
      }

      // 2. LISTENERS DE RATÓN DEL MAPA
      mapa.on("click", (e) => {
        // A) MODO TRAZADO (sin límite de vértices; solo cierra por cercanía en píxeles al Vértice 1)
        if (modoTrazadoRef.current) {
          const pt = [Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))];
          const puntosActuales = puntosTrazadoRef.current;

          // Solo cerrar automáticamente si el clic cae exactamente sobre el Vértice 1 (< 10px en pantalla)
          if (puntosActuales.length >= 3 && e.point) {
            const pixPrimero = mapa.project(puntosActuales[0]);
            const distPx = Math.hypot(e.point.x - pixPrimero.x, e.point.y - pixPrimero.y);
            if (distPx < 10) {
              finalizarTrazado();
              return;
            }
          }

          const nuevosPuntos = [...puntosActuales, pt];
          puntosTrazadoRef.current = nuevosPuntos;
          setPuntosTrazado(nuevosPuntos);
          sincronizarMarcadoresDom(nuevosPuntos);
          return;
        }

        // B) MODO INSPECCIÓN NORMAL
        const features = mapa.queryRenderedFeatures(e.point, { layers: ["parcelas-fill"] });
        if (features.length > 0) {
          const props = features[0].properties;
          const completa = potrerosRef.current.find((item) => item.id === props.id) || props;
          setParcelaSeleccionada(completa);
          setMenuMetricaAbierto(false);
          setMenuAccionesAbierto(false);
        } else {
          setParcelaSeleccionada(null);
          setMenuMetricaAbierto(false);
          setMenuAccionesAbierto(false);
        }
      });

      // Seguimiento del mouse para la línea elástica entre el último pin y el cursor
      mapa.on("mousemove", (e) => {
        if (!modoTrazadoRef.current) {
          const features = mapa.queryRenderedFeatures(e.point, { layers: ["parcelas-fill"] });
          mapa.getCanvas().style.cursor = features.length > 0 ? "pointer" : "";
          setSvgMouse(null);
          return;
        }

        mapa.getCanvas().style.cursor = "crosshair";
        setSvgMouse({ x: Math.round(e.point.x), y: Math.round(e.point.y) });
      });

      // Actualizar SVG al mover o hacer zoom en el mapa
      mapa.on("move", actualizarSvgOverlay);
      mapa.on("zoom", actualizarSvgOverlay);
      mapa.on("rotate", actualizarSvgOverlay);
      mapa.on("pitch", actualizarSvgOverlay);

      // Renderizar inmediatamente las parcelas en SVG
      actualizarSvgOverlay();
    });

    mapaInstanciaRef.current = mapa;

    return () => {
      marcadoresVerticesRef.current.forEach((m) => m.remove());
      marcadoresVerticesRef.current = [];
      mapa.remove();
      mapaInstanciaRef.current = null;
    };
  }, [estiloActivo, actualizarSvgOverlay]);

  // Sincronizar fuentes de parcelas guardadas cuando cambia la lista de potreros
  useEffect(() => {
    actualizarFuenteParcelas(potreros);
    actualizarSvgOverlay();
  }, [potreros, ganado, actualizarFuenteParcelas, actualizarSvgOverlay]);

  // Manejar activación / desactivación del modo trazado
  useEffect(() => {
    const mapa = mapaInstanciaRef.current;
    if (!mapa) return;
    if (modoTrazado) {
      mapa.getCanvas().style.cursor = "crosshair";
      mapa.doubleClickZoom.disable();
    } else {
      mapa.getCanvas().style.cursor = "";
      mapa.doubleClickZoom.enable();
      setSvgMouse(null);
      if (!modalGuardarZona) {
        setSvgPuntos([]);
        marcadoresVerticesRef.current.forEach((m) => m.remove());
        marcadoresVerticesRef.current = [];
      }
    }
  }, [modoTrazado, modalGuardarZona]);

  // Cambiar métrica de superficie (m², Has, km², Acres)
  function cambiarUnidadSuperficie(nuevaUnidad) {
    if (!UNIDADES_SUPERFICIE[nuevaUnidad]) return;
    setUnidadSuperficie(nuevaUnidad);
    setMenuMetricaAbierto(false);
    try {
      localStorage.setItem("vakera_unidad_superficie", nuevaUnidad);
    } catch (err) {
      console.warn("No se pudo guardar preferencia de unidad:", err);
    }
  }

  // Activar modo delimitación de zona en el mapa (nueva parcela)
  function activarModoTrazado() {
    if (esOficina && !permisoAgregarAprobado) {
      setMenuMetricaAbierto(false);
      setMenuAccionesAbierto(false);
      if (permisoAgregarEstado === "PENDIENTE") {
        mostrarNotificacion(
          "Ya enviaste una solicitud para agregar una parcela. Esperando aprobación del Dueño."
        );
        return;
      }
      setModalSolicitarPermiso({ accion: "AGREGAR", parcelaId: null, parcelaNombre: null });
      return;
    }
    setParcelaEditandoId(null);
    setNombreOriginalEditando("");
    puntosTrazadoRef.current = [];
    setPuntosTrazado([]);
    setSvgPuntos([]);
    setSvgMouse(null);
    setModoTrazado(true);
    setParcelaSeleccionada(null);
    marcadoresVerticesRef.current.forEach((m) => m.remove());
    marcadoresVerticesRef.current = [];
    mostrarNotificacion("Modo Delimitación activado: Haz clic en el mapa para marcar los vértices de la zona.");
  }

  // Abrir modal para editar una parcela existente
  function abrirModalEditarParcela(parcela) {
    if (!parcela) return;
    setMenuMetricaAbierto(false);
    setMenuAccionesAbierto(false);
    if (esOficina) {
      const estadoEdit = obtenerEstadoPermisoEditar(parcela.id);
      if (estadoEdit !== "APROBADA") {
        if (estadoEdit === "PENDIENTE") {
          mostrarNotificacion(
            `Ya enviaste una solicitud para editar "${parcela.nombre}". Esperando aprobación del Dueño.`
          );
          return;
        }
        setModalSolicitarPermiso({
          accion: "EDITAR",
          parcelaId: parcela.id,
          parcelaNombre: parcela.nombre,
        });
        return;
      }
    }
    setParcelaEditandoId(parcela.id);
    setNombreOriginalEditando(parcela.nombre || "");
    setFormularioZona({
      nombre: parcela.nombre || "",
      superficieHas: parseFloat(parcela.superficieHas) || 0,
      capacidad: parcela.capacidad ? String(parcela.capacidad) : "",
      pastura: parcela.pastura || "Campo Natural y Gramíneas",
      estadoPastura: parcela.estadoPastura || "Óptimo",
      aguada: parcela.aguada || "Bebedero / Tanque",
      color: parcela.color || "#ea580c",
      descripcion: parcela.descripcion || "",
      coordinates: Array.isArray(parcela.coordinates) ? parcela.coordinates : [],
    });
    setModalGuardarZona(true);
  }

  // Permitir re-trazar los vértices de una parcela en edición
  function iniciarRetrazadoParcela() {
    setModalGuardarZona(false);
    puntosTrazadoRef.current = [];
    setPuntosTrazado([]);
    setSvgPuntos([]);
    setSvgMouse(null);
    setModoTrazado(true);
    marcadoresVerticesRef.current.forEach((m) => m.remove());
    marcadoresVerticesRef.current = [];
    mostrarNotificacion(`Re-trazando límites de "${formularioZona.nombre}": marca los nuevos vértices en el mapa.`);
  }

  async function manejarEnviarSolicitudPermiso(e) {
    if (e) e.preventDefault();
    if (procesandoPermiso) return;
    setProcesandoPermiso(true);
    try {
      const res = await solicitarPermisoParcelas({
        accion: modalSolicitarPermiso?.accion || "GESTIONAR",
        parcelaId: modalSolicitarPermiso?.parcelaId || null,
        parcelaNombre: modalSolicitarPermiso?.parcelaNombre || null,
        motivo: motivoPermiso,
      });
      setModalSolicitarPermiso(null);
      setMotivoPermiso("");
      await cargarPermisosParcelas();
      window.dispatchEvent(new CustomEvent("vakera:notificaciones-actualizar"));
      mostrarNotificacion(
        res?.mensaje || "Solicitud enviada al Dueño. Te avisaremos cuando la apruebe."
      );
    } catch (err) {
      alert(err.message || "No se pudo enviar la solicitud de permiso.");
    } finally {
      setProcesandoPermiso(false);
    }
  }

  async function manejarResponderPermisoDueno(solicitudId, estado) {
    if (!solicitudId || procesandoPermiso) return;
    setProcesandoPermiso(true);
    try {
      const res = await responderPermisoParcelas(solicitudId, estado);
      await cargarPermisosParcelas();
      window.dispatchEvent(new CustomEvent("vakera:notificaciones-actualizar"));
      mostrarNotificacion(
        res?.mensaje ||
          (estado === "APROBADA"
            ? "Permiso aprobado para el Administrador."
            : "Solicitud rechazada.")
      );
    } catch (err) {
      alert(err.message || "No se pudo responder la solicitud.");
    } finally {
      setProcesandoPermiso(false);
    }
  }

  // Cancelar trazado
  function cancelarTrazado() {
    setModoTrazado(false);
    setParcelaEditandoId(null);
    setNombreOriginalEditando("");
    puntosTrazadoRef.current = [];
    setPuntosTrazado([]);
    setSvgPuntos([]);
    setSvgMouse(null);
    marcadoresVerticesRef.current.forEach((m) => m.remove());
    marcadoresVerticesRef.current = [];
  }

  // Deshacer último punto marcado
  function deshacerUltimoPunto() {
    const actualizados = puntosTrazadoRef.current.slice(0, -1);
    puntosTrazadoRef.current = actualizados;
    setPuntosTrazado(actualizados);
    sincronizarMarcadoresDom(actualizados);
  }

  // Finalizar trazado y abrir formulario para guardar o actualizar la parcela
  function finalizarTrazado() {
    const puntos = puntosTrazadoRef.current;
    if (puntos.length < 3) {
      alert("Debes marcar al menos 3 vértices para delimitar una parcela cerrada.");
      return;
    }

    const superficieCalculada = calcularAreaHectareas(puntos);

    const coordenadasCerradas = [...puntos];
    const primero = coordenadasCerradas[0];
    const ultimo = coordenadasCerradas[coordenadasCerradas.length - 1];
    if (primero[0] !== ultimo[0] || primero[1] !== ultimo[1]) {
      coordenadasCerradas.push(primero);
    }

    if (parcelaEditandoId) {
      setFormularioZona((prev) => ({
        ...prev,
        superficieHas: superficieCalculada,
        coordinates: coordenadasCerradas,
      }));
    } else {
      const colorSugerido = PALETA_COLORES[potreros.length % PALETA_COLORES.length].hex;
      setFormularioZona({
        nombre: `Parcela ${potreros.length + 1}`,
        superficieHas: superficieCalculada,
        capacidad: "",
        pastura: "Campo Natural y Gramíneas",
        estadoPastura: "Óptimo",
        aguada: "Bebedero / Tanque",
        color: colorSugerido,
        descripcion: "",
        coordinates: coordenadasCerradas,
      });
    }

    setModoTrazado(false);
    setSvgMouse(null);
    setModalGuardarZona(true);
  }

  // Guardar la parcela delimitada (nueva o edición existente)
  async function manejarGuardarZona(e) {
    e.preventDefault();
    if (!formularioZona.nombre.trim()) {
      alert("Por favor ingresa un nombre para la parcela.");
      return;
    }

    const nombreLimpio = formularioZona.nombre.trim();
    setProcesando(true);
    try {
      if (parcelaEditandoId) {
        const capacidadNormalizada =
          formularioZona.capacidad !== "" &&
          formularioZona.capacidad !== null &&
          parseInt(formularioZona.capacidad, 10) > 0
            ? parseInt(formularioZona.capacidad, 10)
            : null;
        const res = await actualizarPotrero(parcelaEditandoId, {
          nombre: nombreLimpio,
          nombreAnterior: nombreOriginalEditando,
          superficieHas: parseFloat(formularioZona.superficieHas) || 0,
          capacidad: capacidadNormalizada,
          coordinates: formularioZona.coordinates,
          color: formularioZona.color,
          pastura: formularioZona.pastura,
          aguada: formularioZona.aguada,
          estadoPastura: formularioZona.estadoPastura,
          descripcion: formularioZona.descripcion,
        });

        const previoEnLista = potreros.find((p) => p.id === parcelaEditandoId) || {};
        const parcelaActualizada = {
          ...previoEnLista,
          ...(res?.data || {}),
          id: parcelaEditandoId,
          nombre: nombreLimpio,
          nombrePersonalizado: nombreLimpio,
          superficieHas: parseFloat(formularioZona.superficieHas) || 0,
          coordinates:
            Array.isArray(formularioZona.coordinates) && formularioZona.coordinates.length >= 3
              ? formularioZona.coordinates
              : previoEnLista.coordinates || [],
          color: formularioZona.color,
          pastura: formularioZona.pastura,
          aguada: formularioZona.aguada,
          estadoPastura: formularioZona.estadoPastura,
          descripcion: formularioZona.descripcion,
        };

        const listaActualizada = potreros.map((p) =>
          p.id === parcelaEditandoId ? parcelaActualizada : p
        );
        potrerosRef.current = listaActualizada;
        setPotreros(listaActualizada);

        // Sincronizar renombre con locaciones de Insumos sin dejar el nombre anterior duplicado
        try {
          const cuentaScope = obtenerCuentaScope(usuario);
          const renombres = leerRenombresParcelas(usuario);
          if (
            nombreOriginalEditando &&
            nombreOriginalEditando.trim().toLowerCase() !== nombreLimpio.toLowerCase()
          ) {
            renombres[nombreOriginalEditando.trim().toLowerCase()] = nombreLimpio;
            renombres[parcelaEditandoId] = nombreLimpio;
            localStorage.setItem(`vakera_parcelas_renombres_${cuentaScope}`, JSON.stringify(renombres));
            eliminarParcelaDeLocacionesLocales(usuario, nombreOriginalEditando);
          }
        } catch (err) {
          console.warn("Aviso al sincronizar renombre editado:", err.message);
        }

        guardarParcelasLocales(storageKeyCuenta, listaActualizada, usuario, {
          desbloquearNombre: nombreLimpio,
        });
        actualizarFuenteParcelas(listaActualizada);
        actualizarSvgOverlay();

        setModalGuardarZona(false);
        setParcelaEditandoId(null);
        setNombreOriginalEditando("");
        puntosTrazadoRef.current = [];
        setPuntosTrazado([]);
        setSvgPuntos([]);
        setSvgMouse(null);
        marcadoresVerticesRef.current.forEach((m) => m.remove());
        marcadoresVerticesRef.current = [];

        setParcelaSeleccionada(parcelaActualizada);
        if (esOficina) {
          await cargarPermisosParcelas();
          window.dispatchEvent(new CustomEvent("vakera:notificaciones-actualizar"));
        }
        mostrarNotificacion(`¡Parcela "${nombreLimpio}" actualizada correctamente!`);
        return;
      }

      const capacidadNormalizada =
        formularioZona.capacidad !== "" &&
        formularioZona.capacidad !== null &&
        parseInt(formularioZona.capacidad, 10) > 0
          ? parseInt(formularioZona.capacidad, 10)
          : null;

      const res = await registrarPotrero({
        nombre: nombreLimpio,
        superficieHas: parseFloat(formularioZona.superficieHas) || 0,
        capacidad: capacidadNormalizada,
        coordinates: formularioZona.coordinates,
        color: formularioZona.color,
        pastura: formularioZona.pastura,
        aguada: formularioZona.aguada,
        estadoPastura: formularioZona.estadoPastura,
        descripcion: formularioZona.descripcion,
      });

      const nuevaParcelaGuardada = res?.data || {
        id: `pot-${Date.now()}`,
        nombre: nombreLimpio,
        superficieHas: parseFloat(formularioZona.superficieHas) || 0,
        capacidad: capacidadNormalizada,
        coordinates: formularioZona.coordinates,
        color: formularioZona.color,
        pastura: formularioZona.pastura,
        aguada: formularioZona.aguada,
        estadoPastura: formularioZona.estadoPastura,
        descripcion: formularioZona.descripcion,
        totalAnimales: 0,
        porcentajeCarga: 0,
      };

      const listaActualizada = [
        ...potreros.filter((p) => p.id !== nuevaParcelaGuardada.id),
        nuevaParcelaGuardada,
      ];
      potrerosRef.current = listaActualizada;
      setPotreros(listaActualizada);

      try {
        const cuentaScope = obtenerCuentaScope(usuario);
        const renombres = leerRenombresParcelas(usuario);
        const keyLower = (nuevaParcelaGuardada.nombre || "").trim().toLowerCase();
        if (renombres[keyLower]) {
          delete renombres[keyLower];
          localStorage.setItem(`vakera_parcelas_renombres_${cuentaScope}`, JSON.stringify(renombres));
        }
      } catch (err) {
        console.warn("Aviso limpiando renombre previo:", err.message);
      }

      guardarParcelasLocales(storageKeyCuenta, listaActualizada, usuario, {
        desbloquearNombre: nuevaParcelaGuardada.nombre,
      });

      // Actualizar inmediatamente la capa en MapLibre y SVG con el color elegido
      actualizarFuenteParcelas(listaActualizada);
      actualizarSvgOverlay();

      // Limpiar trazado y cerrar modal
      setModalGuardarZona(false);
      puntosTrazadoRef.current = [];
      setPuntosTrazado([]);
      setSvgPuntos([]);
      setSvgMouse(null);
      marcadoresVerticesRef.current.forEach((m) => m.remove());
      marcadoresVerticesRef.current = [];

      if (esOficina) {
        await cargarPermisosParcelas();
        window.dispatchEvent(new CustomEvent("vakera:notificaciones-actualizar"));
      }
      mostrarNotificacion(`¡Parcela "${nombreLimpio}" delimitada y sincronizada con las locaciones del campo!`);

      // Seleccionar y enfocar en la nueva parcela
      setParcelaSeleccionada(nuevaParcelaGuardada);
      const mapa = mapaInstanciaRef.current;
      if (mapa && formularioZona.coordinates.length > 0) {
        const centro = calcularCentroide(formularioZona.coordinates);
        mapa.flyTo({
          center: centro,
          zoom: 14.5,
          pitch: 25,
          duration: 1200,
        });
      }
    } catch (err) {
      alert("Error al guardar la parcela: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  // Eliminar parcela delimitada
  async function manejarEliminarParcela(id, nombre) {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la parcela "${nombre}"? Se liberará la delimitación en el mapa.`)) {
      return;
    }

    setProcesando(true);
    try {
      await eliminarPotrero(id);
      const actualizados = potreros.filter((p) => p.id !== id);
      potrerosRef.current = actualizados;
      setPotreros(actualizados);
      eliminarParcelaDeLocacionesLocales(usuario, nombre);
      guardarParcelasLocales(storageKeyCuenta, actualizados, usuario);
      actualizarFuenteParcelas(actualizados);
      setParcelaSeleccionada(null);
      mostrarNotificacion(`Parcela "${nombre}" eliminada correctamente.`);
    } catch (err) {
      const actualizados = potreros.filter((p) => p.id !== id);
      potrerosRef.current = actualizados;
      setPotreros(actualizados);
      eliminarParcelaDeLocacionesLocales(usuario, nombre);
      guardarParcelasLocales(storageKeyCuenta, actualizados, usuario);
      actualizarFuenteParcelas(actualizados);
      setParcelaSeleccionada(null);
      mostrarNotificacion(`Parcela "${nombre}" eliminada del mapa.`);
    } finally {
      setProcesando(false);
    }
  }

  // Centrar mapa de nuevo en el establecimiento o las parcelas
  function enfocarCampoCompleto() {
    if (!mapaInstanciaRef.current) return;
    let centro = CENTRO_BASE_DEFECTO;
    const listaActual = potrerosRef.current;
    if (listaActual.length > 0 && Array.isArray(listaActual[0].coordinates) && listaActual[0].coordinates.length > 0) {
      centro = calcularCentroide(listaActual[0].coordinates);
    }
    mapaInstanciaRef.current.flyTo({
      center: centro,
      zoom: 14.2,
      pitch: 20,
      bearing: 0,
      duration: 1400,
    });
    setParcelaSeleccionada(null);
  }

  // Enfocar una parcela específica desde la lista lateral
  function enfocarParcela(p) {
    setParcelaSeleccionada(p);
    if (p.coordinates && p.coordinates.length > 0 && mapaInstanciaRef.current) {
      const centro = calcularCentroide(p.coordinates);
      mapaInstanciaRef.current.flyTo({
        center: centro,
        zoom: 14.8,
        pitch: 30,
        duration: 1300,
      });
    }
  }

  // Ejecutar traslado masivo de hacienda a la parcela activa
  async function manejarTrasladoLote(e) {
    e.preventDefault();
    if (!parcelaSeleccionada || trasladoAnimalesIds.length === 0) return;
    setProcesando(true);
    try {
      await trasladoMasivoGanado({
        animalIds: trasladoAnimalesIds,
        potreroDestinoId: parcelaSeleccionada.id,
      });
      mostrarNotificacion(`Se trasladaron ${trasladoAnimalesIds.length} cabezas a ${parcelaSeleccionada.nombre}.`);
      setModalTraslado(false);
      setTrasladoAnimalesIds([]);
      await cargarDatos();
    } catch (err) {
      alert("Error en el traslado: " + err.message);
    } finally {
      setProcesando(false);
    }
  }

  // Métricas calculadas basadas estrictamente en datos reales
  const superficieTotal = useMemo(
    () => potreros.reduce((acc, p) => acc + (parseFloat(p.superficieHas) || 0), 0),
    [potreros]
  );
  const capacidadTotal = useMemo(
    () => potreros.reduce((acc, p) => acc + (parseInt(p.capacidad, 10) || 0), 0),
    [potreros]
  );
  const totalAnimalesCampo = useMemo(
    () => ganado.filter((g) => g.potreroId || g.potrero).length,
    [ganado]
  );
  const cargaMediaEvHa = useMemo(() => {
    if (superficieTotal <= 0) return "0.00";
    return (totalAnimalesCampo / superficieTotal).toFixed(2);
  }, [totalAnimalesCampo, superficieTotal]);

  const superficieTrazadoEnVivo = useMemo(
    () => (puntosTrazado.length >= 3 ? calcularAreaHectareas(puntosTrazado) : 0),
    [puntosTrazado]
  );

  return (
    <div className="space-y-5 text-[#182920]">
      {/* Banner Principal */}
      <div className="bg-[#182920] rounded-2xl p-6 text-white border border-[#33512f] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#8fb56b] text-[#182920] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <i className="fa-solid fa-earth-americas text-xs"></i> MapLibre GL Cartografía
            </span>
            <span className="text-xs text-[#8fb56b]">Delimitación y Receptividad Satelital</span>
          </div>
          <h2 className="text-2xl font-bold font-['Fraunces',serif] text-[#f1ecdd]">
            Mapeo de Parcelas & Ganado
          </h2>
          <p className="text-xs text-[#ded7c4] mt-1 max-w-xl">
            Traza directamente sobre el mapa satelital los límites de tus parcelas de ganado para calcular superficies exactas, asignar hacienda y monitorear el balance forrajero.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={enfocarCampoCompleto}
            className="bg-[#2a4533] hover:bg-[#345740] text-[#f1ecdd] border border-[#8fb56b]/30 font-bold text-xs uppercase px-3.5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            title="Centrar vista en el campo"
          >
            <i className="fa-solid fa-crosshairs text-[#8fb56b]"></i> Centrar
          </button>

          {puedeCrearOEditar && !modoTrazado && (
            <button
              type="button"
              onClick={activarModoTrazado}
              className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-extrabold text-xs uppercase px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-draw-polygon text-sm"></i> Trazar Parcela en Mapa
            </button>
          )}
        </div>
      </div>

      {/* Banner de Permiso de Parcelas para Administrador */}
      {esOficina && (
        <div className="px-4 py-3 rounded-2xl border text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm bg-stone-50 border-[#ded7c4] text-[#182920]">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-user-shield text-amber-700 text-base"></i>
            <span>
              Cada vez que necesites <strong>agregar una parcela</strong> o{" "}
              <strong>editar una parcela</strong>, debés solicitar permiso al Dueño (un permiso por modificación).
              {permisoAgregarAprobado && (
                <strong className="ml-1.5 text-emerald-700">
                  • Autorizado para agregar 1 nueva parcela.
                </strong>
              )}
              {Object.values(permisosEditarPorParcela).includes("APROBADA") && (
                <strong className="ml-1.5 text-emerald-700">
                  • Tenés una edición de parcela aprobada lista para usar.
                </strong>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Banner de Solicitudes Pendientes de Administrador para el Dueño */}
      {esDueno && (permisoParcelas?.solicitudesPendientes || []).length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-2.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-amber-900">
            <i className="fa-solid fa-user-shield text-amber-700"></i>
            <span>
              Solicitudes de permiso para Parcelas ({permisoParcelas.solicitudesPendientes.length})
            </span>
          </div>
          <div className="space-y-2">
            {permisoParcelas.solicitudesPendientes.map((sol) => (
              <div
                key={sol.id}
                className="bg-white rounded-xl p-3 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="text-xs text-[#182920]">
                  <p className="font-bold">
                    {sol.solicitanteNombre} solicita permiso para{" "}
                    {sol.accion === "EDITAR"
                      ? `editar${sol.parcelaNombre ? ` "${sol.parcelaNombre}"` : " parcelas"}`
                      : sol.accion === "AGREGAR"
                      ? "agregar parcelas"
                      : "agregar y editar parcelas"}
                  </p>
                  {sol.motivo && (
                    <p className="text-[11px] text-[#526354] mt-0.5">Motivo: {sol.motivo}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={procesandoPermiso}
                    onClick={() => manejarResponderPermisoDueno(sol.id, "APROBADA")}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    disabled={procesandoPermiso}
                    onClick={() => manejarResponderPermisoDueno(sol.id, "RECHAZADA")}
                    className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mensaje && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm animate-fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600 text-lg"></i>
          <span>{mensaje}</span>
        </div>
      )}

      {/* KPI Principal de Superficie Mapeada */}
      <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] shadow-sm flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-bold text-[#6b7c6d] uppercase">Superficie Total Mapeada</p>
          <p className="text-2xl font-extrabold text-[#182920] mt-0.5">
            {formatearSuperficie(superficieTotal, unidadSuperficie)}
          </p>
        </div>
        <span className="text-xs text-[#33512f] font-bold bg-[#f6f4ee] px-3 py-1.5 rounded-xl border border-[#ded7c4]">
          {potreros.length} {potreros.length === 1 ? "Parcela delimitada" : "Parcelas delimitadas"}
        </span>
      </div>

      {/* Visor Principal del Mapa y Panel Lateral de Parcela */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Mapa Interactivo con MapLibre GL */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-3 border border-[#ded7c4] shadow-sm relative overflow-hidden flex flex-col">
          {/* Selector de Capas MapLibre */}
          <div className="absolute top-6 left-6 z-10 flex items-center gap-1.5 bg-[#182920]/90 backdrop-blur-md p-1.5 rounded-2xl border border-[#8fb56b]/30 shadow-xl">
            {Object.keys(ESTILOS_MAPA).map((k) => {
              const activo = estiloActivo === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setEstiloActivo(k)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    activo
                      ? "bg-[#8fb56b] text-[#182920] shadow-sm"
                      : "text-[#ded7c4] hover:text-white hover:bg-white/10"
                  }`}
                >
                  <i className={`fa-solid ${ESTILOS_MAPA[k].icono}`}></i>
                  <span>{ESTILOS_MAPA[k].nombre}</span>
                </button>
              );
            })}
          </div>

          {/* Barra Flotante de Modo Trazado */}
          {modoTrazado && (
            <div className="absolute top-6 right-6 left-6 md:left-auto md:right-6 z-30 bg-[#182920]/95 backdrop-blur-md p-3.5 rounded-2xl border-2 border-[#facc15] shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <span className="flex h-3.5 w-3.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#facc15] opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#facc15]"></span>
                </span>
                <div>
                  <p className="text-xs font-extrabold text-[#f1ecdd] uppercase tracking-wider flex items-center gap-1.5">
                    <span>Modo Delimitación Activo</span>
                    <span className="bg-[#facc15] text-[#182920] px-1.5 py-0.2 rounded font-black text-[10px]">Trazando</span>
                  </p>
                  <p className="text-[11px] text-[#ded7c4]">
                    {puntosTrazado.length === 0
                      ? "Haz clic en el mapa para fijar el primer punto"
                      : `${puntosTrazado.length} vértices colocados (sin límite) • ${formatearSuperficie(superficieTrazadoEnVivo, unidadSuperficie)} calculados`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {puntosTrazado.length > 0 && (
                  <button
                    type="button"
                    onClick={deshacerUltimoPunto}
                    className="bg-[#2a4533] hover:bg-[#345740] text-[#f1ecdd] text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-white/20 transition-all cursor-pointer"
                    title="Deshacer último punto marcado"
                  >
                    <i className="fa-solid fa-rotate-left"></i> Deshacer
                  </button>
                )}

                <button
                  type="button"
                  onClick={cancelarTrazado}
                  className="bg-red-950/70 hover:bg-red-900 text-red-200 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-red-500/30 transition-all cursor-pointer"
                >
                  <i className="fa-solid fa-xmark"></i> Cancelar
                </button>

                <button
                  type="button"
                  disabled={puntosTrazado.length < 3}
                  onClick={finalizarTrazado}
                  className={`text-xs font-extrabold px-3 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 ${
                    puntosTrazado.length >= 3
                      ? "bg-[#facc15] hover:bg-yellow-400 text-[#182920] cursor-pointer ring-2 ring-white"
                      : "bg-white/10 text-white/40 cursor-not-allowed"
                  }`}
                  title={puntosTrazado.length < 3 ? "Necesitas al menos 3 vértices para cerrar la zona" : "Guardar delimitación"}
                >
                  <i className="fa-solid fa-check"></i> Finalizar y Guardar
                </button>
              </div>
            </div>
          )}

          {/* Contenedor del Mapa con Overlay SVG para líneas de alta precisión */}
          <div
            className="w-full h-[540px] rounded-2xl bg-[#1e2a22] overflow-hidden relative"
            onMouseLeave={() => setSvgMouse(null)}
          >
            {/* Contenedor MapLibre GL */}
            <div ref={mapaContainerRef} className="w-full h-full" />

            {/* OVERLAY SVG DE PARCELAS Y TRAZADO: Siempre activo para garantizar máxima visibilidad de color */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
              {/* 1. PARCELAS GUARDADAS: Renderizado directo vectorial con color permanente de alto contraste */}
              {svgPotreros.map((p) => {
                const esSeleccionada = parcelaSeleccionada?.id === p.id;
                return (
                  <g
                    key={p.id}
                    className="cursor-pointer transition-all"
                    style={{ pointerEvents: modoTrazado ? "none" : "auto" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const original = potreros.find((item) => item.id === p.id);
                      if (original) enfocarParcela(original);
                    }}
                  >
                    {/* Borde exterior blanco grueso para recortar sobre el satélite */}
                    <polygon
                      points={p.pointsStr}
                      fill={p.color}
                      fillOpacity={esSeleccionada ? 0.82 : 0.65}
                      stroke="#ffffff"
                      strokeWidth={esSeleccionada ? 6.5 : 4.5}
                      strokeLinejoin="round"
                    />
                    {/* Borde interior del color exacto de la parcela */}
                    <polygon
                      points={p.pointsStr}
                      fill="none"
                      stroke={p.color}
                      strokeWidth={esSeleccionada ? 4 : 2.5}
                      strokeLinejoin="round"
                    />
                    {/* Badge central con Nombre y Superficie */}
                    {(() => {
                      const textoBadge = `${p.nombre} (${formatearSuperficie(p.superficieHas, unidadSuperficie)})`;
                      const rectW = Math.max(130, textoBadge.length * 6.8 + 24);
                      return (
                        <g transform={`translate(${p.centro.x}, ${p.centro.y})`}>
                          <rect
                            x={-rectW / 2}
                            y="-13"
                            width={rectW}
                            height="26"
                            rx="13"
                            fill="#182920"
                            fillOpacity="0.94"
                            stroke={p.color}
                            strokeWidth="2.5"
                          />
                          <text
                            x="0"
                            y="4"
                            fill="#ffffff"
                            fontSize="11"
                            fontWeight="bold"
                            textAnchor="middle"
                            fontFamily="system-ui, sans-serif"
                          >
                            {textoBadge}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })}

              {/* 2. POLÍGONO DE TRAZADO ACTIVO (MODO TRAZADO O MODAL DE GUARDAR) */}
              {(modoTrazado || modalGuardarZona) && svgPuntos.length >= 3 && (
                <g>
                  <polygon
                    points={svgPuntos.map((pt) => `${pt.x},${pt.y}`).join(" ")}
                    fill={modalGuardarZona ? formularioZona.color : "#facc15"}
                    fillOpacity={modalGuardarZona ? 0.70 : 0.40}
                    stroke="#ffffff"
                    strokeWidth="6"
                    strokeLinejoin="round"
                  />
                  <polygon
                    points={svgPuntos.map((pt) => `${pt.x},${pt.y}`).join(" ")}
                    fill="none"
                    stroke={modalGuardarZona ? formularioZona.color : "#facc15"}
                    strokeWidth="3.8"
                    strokeLinejoin="round"
                  />
                </g>
              )}

              {/* 3. HALO NEGRO ENTRE PINES DE TRAZADO ACTIVO */}
              {modoTrazado && svgPuntos.length >= 2 && (
                <polyline
                  points={svgPuntos.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#000000"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity="0.85"
                />
              )}

              {/* 4. LÍNEA AMARILLA NEÓN BRILLANTE CONTINUA ENTRE PINES */}
              {modoTrazado && svgPuntos.length >= 2 && (
                <polyline
                  points={svgPuntos.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#facc15"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* 5. LÍNEA ELÁSTICA HACIA EL CURSOR DEL MOUSE */}
              {modoTrazado && svgPuntos.length >= 1 && svgMouse && (
                <>
                  <line
                    x1={svgPuntos[svgPuntos.length - 1].x}
                    y1={svgPuntos[svgPuntos.length - 1].y}
                    x2={svgMouse.x}
                    y2={svgMouse.y}
                    stroke="#000000"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  <line
                    x1={svgPuntos[svgPuntos.length - 1].x}
                    y1={svgPuntos[svgPuntos.length - 1].y}
                    x2={svgMouse.x}
                    y2={svgMouse.y}
                    stroke="#facc15"
                    strokeWidth="3.5"
                    strokeDasharray="6,4"
                    strokeLinecap="round"
                  />
                </>
              )}

              {/* 6. LÍNEA DE CIERRE HACIA EL VÉRTICE 1 */}
              {modoTrazado && svgPuntos.length >= 3 && (
                <line
                  x1={svgPuntos[svgPuntos.length - 1].x}
                  y1={svgPuntos[svgPuntos.length - 1].y}
                  x2={svgPuntos[0].x}
                  y2={svgPuntos[0].y}
                  stroke="#10b981"
                  strokeWidth="3.5"
                  strokeDasharray="4,4"
                  strokeOpacity="0.9"
                />
              )}
            </svg>
          </div>

          {/* Leyenda y Atajos Inferiores */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-[#6b7c6d] px-2 flex-wrap gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-[#facc15] border-2 border-black inline-block"></span>
                Línea de Trazado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-[#2e7d32] border-2 border-white inline-block"></span>
                Parcelas Guardadas Coloreadas
              </span>
              <span className="flex items-center gap-1.5">
                <i className="fa-solid fa-route text-amber-500"></i>
                Rutas y caminos rurales
              </span>
            </div>
            <span>MapLibre GL JS • Esri Satélite + Referencias</span>
          </div>
        </div>

        {/* Panel Lateral: Inspector de Parcela o Estado Vacío */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-[#ded7c4] shadow-sm space-y-4">
          {parcelaSeleccionada ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-start justify-between border-b border-[#ded7c4] pb-3">
                <div>
                  <span
                    className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white inline-block mb-1"
                    style={{ backgroundColor: parcelaSeleccionada.color || "#2e7d32" }}
                  >
                    Parcela Georreferenciada
                  </span>
                  <h3 className="text-xl font-bold font-['Fraunces',serif] text-[#182920]">
                    {parcelaSeleccionada.nombre}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 relative">
                  {puedeCrearOEditar && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuMetricaAbierto(false);
                          setMenuAccionesAbierto((prev) => !prev);
                        }}
                        className="w-7 h-7 rounded-lg bg-[#f6f4ee] hover:bg-[#e7dfcb] border border-[#ded7c4] text-[#182920] flex items-center justify-center transition-colors cursor-pointer"
                        aria-label="Opciones de parcela"
                        title="Opciones de parcela"
                      >
                        <i className="fa-solid fa-bars text-xs"></i>
                      </button>

                      {menuAccionesAbierto && (
                        <div className="absolute right-0 top-8 z-30 w-44 bg-white rounded-xl border border-[#ded7c4] shadow-xl p-1.5 space-y-1 animate-fade-in">
                          <span className="block px-2 py-1 text-[10px] font-bold uppercase text-[#6b7c6d]">
                            Acciones de Parcela
                          </span>
                          <button
                            type="button"
                            onClick={() => abrirModalEditarParcela(parcelaSeleccionada)}
                            disabled={procesando}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#182920] hover:bg-[#f6f4ee] flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <i className="fa-solid fa-pen text-amber-700 w-3.5 text-center"></i>
                            <span>Editar Parcela</span>
                          </button>
                          {puedeGestionar && (
                            <button
                              type="button"
                              onClick={() => {
                                setMenuAccionesAbierto(false);
                                manejarEliminarParcela(parcelaSeleccionada.id, parcelaSeleccionada.nombre);
                              }}
                              disabled={procesando}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <i className="fa-solid fa-trash-can w-3.5 text-center"></i>
                              <span>Eliminar Parcela</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setMenuAccionesAbierto(false);
                      setMenuMetricaAbierto(false);
                      setParcelaSeleccionada(null);
                    }}
                    className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
                    title="Cerrar ficha"
                  >
                    <i className="fa-solid fa-xmark text-sm"></i>
                  </button>
                </div>
              </div>

              {/* Indicador Clave de Superficie con Selector de Métrica (3 rayitas) */}
              <div className="grid grid-cols-1">
                <div className="bg-[#f6f4ee] p-3.5 rounded-2xl border border-[#ded7c4] relative">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] font-bold text-[#6b7c6d] uppercase">
                      Superficie ({UNIDADES_SUPERFICIE[unidadSuperficie].etiqueta})
                    </p>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMenuMetricaAbierto((prev) => !prev)}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-[#e7dfcb] border border-[#ded7c4] text-[#182920] flex items-center justify-center transition-colors cursor-pointer"
                        aria-label="Cambiar métrica de superficie"
                        title="Cambiar unidad de medida"
                      >
                        <i className="fa-solid fa-bars text-xs"></i>
                      </button>

                      {menuMetricaAbierto && (
                        <div className="absolute right-0 top-8 z-30 w-48 bg-white rounded-xl border border-[#ded7c4] shadow-xl p-1.5 space-y-1 animate-fade-in">
                          <span className="block px-2 py-1 text-[10px] font-bold uppercase text-[#6b7c6d]">
                            Métrica de Superficie
                          </span>
                          {Object.values(UNIDADES_SUPERFICIE).map((u) => {
                            const activa = unidadSuperficie === u.clave;
                            return (
                              <button
                                key={u.clave}
                                type="button"
                                onClick={() => cambiarUnidadSuperficie(u.clave)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                                  activa
                                    ? "bg-[#182920] text-[#f1ecdd]"
                                    : "text-[#182920] hover:bg-[#f6f4ee]"
                                }`}
                              >
                                <span>
                                  {u.sufijo} — {u.etiqueta}
                                </span>
                                {activa && <i className="fa-solid fa-check text-[#8fb56b] text-[10px]"></i>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xl font-black text-[#182920] mt-0.5">
                    {formatearSuperficie(parcelaSeleccionada.superficieHas, unidadSuperficie)}
                  </p>
                </div>
              </div>

              {/* Característica y Observaciones */}
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-[#f9f8f5] border border-[#ded7c4] space-y-1">
                  <p className="text-[10px] font-bold uppercase text-[#6b7c6d] flex items-center gap-1.5">
                    <i className="fa-solid fa-list-check text-emerald-700"></i> Característica
                  </p>
                  <p className="font-semibold text-[#182920]">
                    {parcelaSeleccionada.aguada || "Sin característica especificada"}
                  </p>
                </div>

                {parcelaSeleccionada.descripcion && (
                  <div className="p-3 rounded-2xl bg-[#f9f8f5] border border-[#ded7c4] text-xs text-[#4a584c]">
                    <p className="text-[10px] font-bold uppercase text-[#6b7c6d] mb-0.5">Observaciones</p>
                    <p>{parcelaSeleccionada.descripcion}</p>
                  </div>
                )}
              </div>

              {/* Hacienda actualmente en la parcela */}
              <div className="border-t border-[#ded7c4] pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#182920] uppercase">
                    Rodeo Asignado ({parcelaSeleccionada.totalAnimales || 0})
                  </span>
                  {puedeGestionar && (
                    <button
                      type="button"
                      onClick={() => setModalTraslado(true)}
                      className="text-xs text-[#2e7d32] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <i className="fa-solid fa-arrow-right-arrow-left"></i> Trasladar Hacienda
                    </button>
                  )}
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {ganado
                    .filter(
                      (g) =>
                        g.potreroId === parcelaSeleccionada.id ||
                        g.potrero === parcelaSeleccionada.nombre ||
                        g.potreroNombre === parcelaSeleccionada.nombre
                    )
                    .map((animal) => (
                      <div
                        key={animal.id}
                        className="bg-[#f6f4ee] p-2 rounded-xl flex items-center justify-between text-xs border border-[#ded7c4]"
                      >
                        <div>
                          <p className="font-bold text-[#182920]">{animal.caravana}</p>
                          <p className="text-[10px] text-[#6b7c6d]">
                            {animal.categoria} • {animal.raza}
                          </p>
                        </div>
                        <span className="font-extrabold text-[#33512f]">{animal.pesoKg} kg</span>
                      </div>
                    ))}
                  {ganado.filter(
                    (g) =>
                      g.potreroId === parcelaSeleccionada.id ||
                      g.potrero === parcelaSeleccionada.nombre ||
                      g.potreroNombre === parcelaSeleccionada.nombre
                  ).length === 0 && (
                    <p className="text-xs text-[#6b7c6d] italic text-center py-2">
                      Sin animales pastando en esta parcela actualmente.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#ded7c4] pb-2">
                <h3 className="font-bold font-['Fraunces',serif] text-lg text-[#182920]">
                  Parcelas Delimitadas ({potreros.length})
                </h3>
                {puedeCrearOEditar && !modoTrazado && (
                  <button
                    type="button"
                    onClick={activarModoTrazado}
                    className="text-xs text-[#2e7d32] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <i className="fa-solid fa-plus"></i> Delimitar
                  </button>
                )}
              </div>

              {potreros.length > 0 ? (
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {potreros.map((p) => {
                    const animalesEnP = ganado.filter(
                      (g) => g.potreroId === p.id || g.potrero === p.nombre || g.potreroNombre === p.nombre
                    );
                    const totalAnimales = p.totalAnimales ?? animalesEnP.length;

                    return (
                      <div
                        key={p.id}
                        onClick={() => enfocarParcela(p)}
                        className="bg-[#f6f4ee] hover:bg-[#ede9de] p-3 rounded-2xl border border-[#ded7c4] transition-all cursor-pointer flex items-center justify-between group shadow-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-white shadow-xs"
                              style={{ backgroundColor: p.color || "#2e7d32" }}
                            ></span>
                            <p className="font-bold text-sm text-[#182920] group-hover:text-[#2e7d32] transition-colors">
                              {p.nombre}
                            </p>
                          </div>
                          <p className="text-[11px] text-[#6b7c6d]">
                            {formatearSuperficie(p.superficieHas, unidadSuperficie)}
                            {p.aguada ? ` • ${p.aguada}` : ""}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-extrabold text-[#182920]">
                            {totalAnimales} Cab.
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 px-4 space-y-3 bg-[#fbfaf8] rounded-2xl border border-dashed border-[#ded7c4]">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#8fb56b]/20 flex items-center justify-center text-[#2e7d32] text-xl">
                    <i className="fa-solid fa-map-location-dot"></i>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#182920]">Sin parcelas delimitadas</p>
                    <p className="text-xs text-[#6b7c6d] mt-1 max-w-xs mx-auto">
                      Aún no has delimitado zonas en el mapa. Haz clic en "Trazar Parcela en Mapa" para marcar tu primera parcela de ganado.
                    </p>
                  </div>
                  {puedeCrearOEditar && (
                    <button
                      type="button"
                      onClick={activarModoTrazado}
                      className="bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] font-bold text-xs uppercase px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      <i className="fa-solid fa-draw-polygon"></i> Trazar Primera Parcela
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Guardar Zona Delimitada */}
      {modalGuardarZona && (
        <div className="fixed inset-0 z-50 bg-[#182920]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#ded7c4] space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[#ded7c4] pb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold shadow-sm"
                  style={{ backgroundColor: formularioZona.color }}
                >
                  <i className="fa-solid fa-draw-polygon"></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold font-['Fraunces',serif] text-[#182920]">
                    {parcelaEditandoId ? "Editar Parcela Delimitada" : "Guardar Parcela Delimitada"}
                  </h3>
                  <p className="text-xs text-[#6b7c6d]">
                    {parcelaEditandoId
                      ? "Modificá nombre, color, superficie, pastura, aguada o re-trazá sus límites."
                      : "Asigna un nombre y elige el color con el que quedará pintada en el mapa."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalGuardarZona(false);
                  setParcelaEditandoId(null);
                  setNombreOriginalEditando("");
                }}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={manejarGuardarZona} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#182920] uppercase mb-1">
                  Nombre de la Parcela / Ganado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Lote 1 - Los Eucaliptos, Ganado Norte..."
                  value={formularioZona.nombre}
                  onChange={(e) => setFormularioZona({ ...formularioZona, nombre: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#ded7c4] text-sm focus:outline-none focus:ring-2 focus:ring-[#8fb56b]"
                  autoFocus
                />
              </div>

              {/* Selector de Color con previsualización en vivo */}
              <div>
                <label className="block text-xs font-bold text-[#182920] uppercase mb-1.5 flex items-center justify-between">
                  <span>Color de la Parcela en el Mapa *</span>
                  <span
                    className="text-[11px] font-extrabold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: formularioZona.color }}
                  >
                    Color Activo
                  </span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {PALETA_COLORES.map((c) => {
                    const seleccionado = formularioZona.color === c.hex;
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => {
                          setFormularioZona({ ...formularioZona, color: c.hex });
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all cursor-pointer ${
                          seleccionado
                            ? "border-black ring-3 ring-black/30 shadow-md scale-105"
                            : "border-[#ded7c4] hover:border-black/50"
                        }`}
                        style={{ backgroundColor: `${c.hex}18` }}
                      >
                        <span
                          className="w-5 h-5 rounded-full border-2 border-white shadow-sm mb-1"
                          style={{ backgroundColor: c.hex }}
                        ></span>
                        <span className="text-[10px] font-bold text-center leading-tight truncate w-full" style={{ color: c.hex }}>
                          {c.nombre}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#182920] uppercase mb-1">
                  Superficie ({UNIDADES_SUPERFICIE[unidadSuperficie].sufijo})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step={unidadSuperficie === "m2" ? "1" : "0.01"}
                    min={unidadSuperficie === "m2" ? "1" : "0.01"}
                    required
                    value={Number(
                      convertirDesdeHas(formularioZona.superficieHas, unidadSuperficie).toFixed(
                        UNIDADES_SUPERFICIE[unidadSuperficie].decimales
                      )
                    )}
                    onChange={(e) => {
                      const valorIngresado = parseFloat(e.target.value) || 0;
                      const factor = UNIDADES_SUPERFICIE[unidadSuperficie].factorDesdeHas;
                      setFormularioZona({
                        ...formularioZona,
                        superficieHas: Number((valorIngresado / factor).toFixed(4)),
                      });
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border border-[#ded7c4] text-sm focus:outline-none focus:ring-2 focus:ring-[#8fb56b]"
                  />
                  {parcelaEditandoId && (
                    <button
                      type="button"
                      onClick={iniciarRetrazadoParcela}
                      className="px-3 py-2 rounded-xl bg-[#f6f4ee] hover:bg-[#e7dfcb] border border-[#ded7c4] text-xs font-bold text-[#182920] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      title="Volver al mapa para re-trazar los límites de esta parcela"
                    >
                      <i className="fa-solid fa-draw-polygon text-[#2e7d32]"></i> Re-trazar Límites
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-emerald-700 font-semibold mt-0.5 block">
                  Calculada geodésicamente ({formatearSuperficie(formularioZona.superficieHas, "m2")} / {formatearSuperficie(formularioZona.superficieHas, "has")})
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#182920] uppercase mb-1">
                  Límite de Cabezas <span className="text-[#6b7c6d] font-normal">(Opcional)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Sin límite"
                  value={formularioZona.capacidad}
                  onChange={(e) => setFormularioZona({ ...formularioZona, capacidad: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#ded7c4] text-sm focus:outline-none focus:ring-2 focus:ring-[#8fb56b]"
                />
                <span className="text-[10px] text-[#6b7c6d] mt-0.5 block">
                  Si lo dejás vacío, la parcela no tendrá límite de cabezas.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#182920] uppercase mb-1">
                  Característica
                </label>
                <input
                  type="text"
                  placeholder="Ej: Aguada central, sombra natural, acceso camino norte..."
                  value={formularioZona.aguada}
                  onChange={(e) => setFormularioZona({ ...formularioZona, aguada: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#ded7c4] text-sm focus:outline-none focus:ring-2 focus:ring-[#8fb56b]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#182920] uppercase mb-1">
                  Notas / Observaciones
                </label>
                <textarea
                  rows="2"
                  placeholder="Detalles sobre alambrados, acceso o topografía..."
                  value={formularioZona.descripcion}
                  onChange={(e) =>
                    setFormularioZona({ ...formularioZona, descripcion: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#ded7c4] text-xs focus:outline-none focus:ring-2 focus:ring-[#8fb56b]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#ded7c4]">
                <button
                  type="button"
                  onClick={() => {
                    setModalGuardarZona(false);
                    setParcelaEditandoId(null);
                    setNombreOriginalEditando("");
                  }}
                  className="px-4 py-2 rounded-xl border border-[#ded7c4] text-xs font-bold text-[#6b7c6d] hover:bg-stone-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  className="px-5 py-2.5 rounded-xl bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] text-xs font-black uppercase shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-floppy-disk"></i>{" "}
                  {parcelaEditandoId ? "Guardar Cambios" : "Guardar Parcela"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Traslado Masivo de Hacienda */}
      {modalTraslado && parcelaSeleccionada && (
        <div className="fixed inset-0 z-50 bg-[#182920]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#ded7c4] space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[#ded7c4] pb-3">
              <div>
                <h3 className="text-lg font-bold font-['Fraunces',serif] text-[#182920]">
                  Mover Hacienda
                </h3>
                <p className="text-xs text-[#6b7c6d]">
                  Destino: <strong className="text-[#2e7d32]">{parcelaSeleccionada.nombre}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalTraslado(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={manejarTrasladoLote} className="space-y-4">
              <p className="text-xs text-[#182920] font-medium">
                Selecciona los animales a trasladar a esta parcela:
              </p>

              <div className="max-h-52 overflow-y-auto space-y-2 border border-[#ded7c4] p-2.5 rounded-2xl bg-[#f9f8f5]">
                {ganado.map((g) => {
                  const seleccionado = trasladoAnimalesIds.includes(g.id);
                  return (
                    <label
                      key={g.id}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer text-xs transition-all ${
                        seleccionado
                          ? "bg-emerald-100 border border-emerald-400 font-bold"
                          : "hover:bg-white border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={seleccionado}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTrasladoAnimalesIds([...trasladoAnimalesIds, g.id]);
                            } else {
                              setTrasladoAnimalesIds(
                                trasladoAnimalesIds.filter((id) => id !== g.id)
                              );
                            }
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>
                          {g.caravana} • {g.categoria}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#6b7c6d]">
                        {g.potrero || "Sin asignar"}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-between items-center text-xs text-[#6b7c6d]">
                <span>{trasladoAnimalesIds.length} seleccionados</span>
                <button
                  type="button"
                  onClick={() => setTrasladoAnimalesIds(ganado.map((g) => g.id))}
                  className="text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Seleccionar todos
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#ded7c4]">
                <button
                  type="button"
                  onClick={() => setModalTraslado(false)}
                  className="px-4 py-2 rounded-xl border border-[#ded7c4] text-xs font-bold text-[#6b7c6d] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando || trasladoAnimalesIds.length === 0}
                  className="px-5 py-2 rounded-xl bg-[#8fb56b] hover:bg-[#a1c97c] text-[#182920] text-xs font-extrabold uppercase shadow-sm cursor-pointer"
                >
                  Confirmar Traslado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Solicitar Permiso al Dueño (Administrador) */}
      {modalSolicitarPermiso && (
        <div className="fixed inset-0 z-50 bg-[#182920]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#ded7c4] space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[#ded7c4] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <i className="fa-solid fa-user-shield"></i>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#182920]">
                    Solicitar permiso al Dueño
                  </h3>
                  <p className="text-[11px] text-[#6b7c6d]">
                    Autorización requerida para{" "}
                    {modalSolicitarPermiso.accion === "EDITAR"
                      ? `editar "${modalSolicitarPermiso.parcelaNombre || "la parcela"}"`
                      : modalSolicitarPermiso.accion === "AGREGAR"
                      ? "agregar parcelas"
                      : "agregar y editar parcelas"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalSolicitarPermiso(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
                aria-label="Cerrar modal de solicitud"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={manejarEnviarSolicitudPermiso} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#6b7c6d] mb-1">
                  Motivo de la modificación (opcional)
                </label>
                <textarea
                  rows={3}
                  value={motivoPermiso}
                  onChange={(e) => setMotivoPermiso(e.target.value)}
                  placeholder="Ej: Actualizar límites de parcela de ganado o agregar nueva subdivisión..."
                  maxLength={300}
                  aria-label="Motivo de permiso para parcelas"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#ded7c4] text-sm text-[#182920] bg-[#fcfbf7] focus:bg-white focus:border-[#182920] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#ded7c4]">
                <button
                  type="button"
                  onClick={() => setModalSolicitarPermiso(null)}
                  className="px-4 py-2 rounded-xl border border-[#ded7c4] text-xs font-bold text-[#6b7c6d] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoPermiso}
                  className="px-5 py-2 rounded-xl bg-[#182920] hover:bg-[#33512f] text-[#f1ecdd] text-xs font-extrabold uppercase shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {procesandoPermiso ? "Enviando..." : "Enviar Solicitud al Dueño"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
