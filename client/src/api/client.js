const BASE_URL = "/api";
export const LAST_ACTIVITY_KEY = "vakera_ultima_actividad";
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export function registrarActividad(ahora = Date.now()) {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(ahora));
  } catch {
    // Ignorar cuota de almacenamiento excedida
  }
}

export function sesionExpiradaPorInactividad(ahora = Date.now()) {
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!raw) return false;
    const ultima = Number(raw);
    if (!Number.isFinite(ultima)) return false;
    return ahora - ultima >= INACTIVITY_TIMEOUT_MS;
  } catch {
    return false;
  }
}

export function tokenJwtExpirado(token, ahora = Date.now()) {
  if (!token || typeof token !== "string") return false;
  const partes = token.split(".");
  if (partes.length !== 3) return false;
  try {
    const base64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join("")
    );
    const payload = JSON.parse(json);
    return typeof payload?.exp === "number" && payload.exp * 1000 <= ahora;
  } catch {
    return false;
  }
}

export function getToken() {
  return localStorage.getItem("vakera_token") || null;
}

// Caché en memoria para optimizar navegación instantánea y reducir peticiones redundantes
const cachePeticiones = new Map();

export function limpiarCacheApi(prefijo = "") {
  if (!prefijo) {
    cachePeticiones.clear();
    return;
  }
  for (const clave of cachePeticiones.keys()) {
    if (clave.startsWith(prefijo)) {
      cachePeticiones.delete(clave);
    }
  }
}

export function setToken(token) {
  limpiarCacheApi();
  if (token) {
    localStorage.setItem("vakera_token", token);
    registrarActividad();
  } else {
    localStorage.removeItem("vakera_token");
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  }
}

export async function request(endpoint, options = {}) {
  const metodo = (options.method || "GET").toUpperCase();
  const esLectura = metodo === "GET";
  const ttlMs = options.ttlMs !== undefined ? options.ttlMs : (esLectura ? 30000 : 0);

  // Si es una mutación (POST, PATCH, DELETE), invalidamos el caché relacionado
  if (!esLectura) {
    const raiz = endpoint.split("?")[0].split("/").filter(Boolean)[0] || "";
    if (raiz) limpiarCacheApi(`/${raiz}`);
  } else if (ttlMs > 0 && !options.noCache) {
    const cached = cachePeticiones.get(endpoint);
    if (cached && cached.expira > Date.now()) {
      return cached.data;
    }
  }

  const token = getToken();
  if (token) {
    registrarActividad();
  }
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, config);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.error || data?.mensaje || `Error HTTP ${res.status}`;
    const err = new Error(errorMsg);
    err.status = res.status;
    err.detalles = data?.detalles;
    throw err;
  }

  // Guardar en caché si es consulta de lectura exitosa
  if (esLectura && ttlMs > 0) {
    cachePeticiones.set(endpoint, {
      data,
      expira: Date.now() + ttlMs,
    });
  }

  return data;
}

// Retrocompatibilidad con la landing page existente
export async function obtenerServicios() {
  return request("/servicios");
}

export async function enviarContacto(payload) {
  return request("/contacto", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
