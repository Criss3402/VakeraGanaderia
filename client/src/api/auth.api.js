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

  // Si el backend entrega token inmediato (cuenta preactivada) se guarda
  if (res?.data?.token) {
    setToken(res.data.token);
  }

  return res;
}

export async function verificarEmail(token) {
  const res = await request("/auth/verificar-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

  if (res?.data?.token) {
    setToken(res.data.token);
  }

  return res;
}

export async function reenviarVerificacion(email) {
  return request("/auth/reenviar-verificacion", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function solicitarRecuperacion(email) {
  return request("/auth/solicitar-recuperacion", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function restablecerPassword(token, nuevaPassword) {
  const res = await request("/auth/restablecer-password", {
    method: "POST",
    body: JSON.stringify({ token, nuevaPassword }),
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
