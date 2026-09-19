const BASE_URL = "/api";

export function getToken() {
  return localStorage.getItem("vakera_token") || null;
}

export function setToken(token) {
  if (token) {
    localStorage.setItem("vakera_token", token);
  } else {
    localStorage.removeItem("vakera_token");
  }
}

export async function request(endpoint, options = {}) {
  const token = getToken();
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
