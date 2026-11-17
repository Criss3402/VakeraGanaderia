const STORAGE_KEY_PARTES_OFFLINE = "vakera_partes_offline_queue_v1";

export function leerColaPartesOffline() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PARTES_OFFLINE);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("[offlineQueue] No se pudo leer cola offline:", err.message);
    return [];
  }
}

function guardarColaPartesOffline(lista) {
  try {
    localStorage.setItem(STORAGE_KEY_PARTES_OFFLINE, JSON.stringify(lista || []));
  } catch (err) {
    console.warn("[offlineQueue] No se pudo guardar cola offline:", err.message);
  }
}

export function encolarParteOffline(datosParte) {
  const actual = leerColaPartesOffline();
  const item = {
    id: `offline-pd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    payload: datosParte,
    fecha: new Date().toISOString().split("T")[0],
    fechaCarga: new Date().toISOString(),
    potrero: datosParte.potrero || "Potrero General",
    novedades: datosParte.novedades || "",
    animalesRevisados: Number(datosParte.animalesRevisados) || 0,
    solicitudInsumos: datosParte.solicitudInsumos || null,
    estado: "PENDIENTE_OFFLINE",
    esOffline: true,
  };
  guardarColaPartesOffline([item, ...actual]);
  return item;
}

export function eliminarParteOffline(offlineId) {
  const actual = leerColaPartesOffline();
  guardarColaPartesOffline(actual.filter((item) => item.id !== offlineId));
}

export async function sincronizarPartesOffline(enviarFn) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { sincronizados: 0, pendientes: leerColaPartesOffline().length };
  }
  const cola = leerColaPartesOffline();
  if (cola.length === 0) {
    return { sincronizados: 0, pendientes: 0 };
  }

  let sincronizados = 0;
  const restantes = [];
  for (const item of cola) {
    try {
      await enviarFn(item.payload);
      sincronizados += 1;
    } catch (err) {
      console.warn("[offlineQueue] Falló sincronización de parte offline:", err.message);
      restantes.push(item);
    }
  }
  guardarColaPartesOffline(restantes);
  return { sincronizados, pendientes: restantes.length };
}
