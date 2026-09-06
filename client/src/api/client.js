const BASE_URL = "/api";

async function manejarRespuesta(res) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const mensaje = data?.error || "Ocurrió un error al contactar al servidor.";
    throw new Error(mensaje);
  }
  return data;
}

export async function obtenerServicios() {
  const res = await fetch(`${BASE_URL}/servicios`);
  return manejarRespuesta(res);
}

export async function enviarContacto(payload) {
  const res = await fetch(`${BASE_URL}/contacto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return manejarRespuesta(res);
}
