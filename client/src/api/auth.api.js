import { request, setToken } from "./client.js";

export async function login(email, password) {
  const res = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (res?.data?.token) {
    setToken(res.data.token);
  }

  return res;
}

export async function registro(datosUsuario) {
  const res = await request("/auth/registro", {
    method: "POST",
    body: JSON.stringify(datosUsuario),
  });

  if (res?.data?.token) {
    setToken(res.data.token);
  }

  return res;
}

export async function obtenerUsuarioActual() {
  return request("/auth/me");
}

export async function obtenerUsuariosDemo() {
  return request("/auth/usuarios-demo");
}

export function logout() {
  setToken(null);
}
