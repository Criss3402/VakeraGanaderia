import { request, getToken } from "./client.js";

/**
 * Módulo de consumo HTTP para el backend analítico de Python (Django).
 * Todos los endpoints se prefijan automáticamente con /py/ gracias a BASE_URL="/api".
 */

// 1. Verificación de salud del microservicio Python
export async function obtenerSaludPy() {
  return request("/py/health");
}

// 2. Reportes Analíticos y Resumen Ejecutivo
export async function obtenerResumenEjecutivoPy() {
  return request("/py/reportes/resumen-ejecutivo");
}

// 3. Nutrición y Balance de Raciones (Motor bio-estadístico)
export async function calcularRacionNutricionalPy(datos) {
  return request("/py/nutricion/calcular-racion", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export async function obtenerProyeccionPesoPy(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/py/nutricion/proyeccion-peso${query ? `?${query}` : ""}`);
}

// 4. Descarga binaria de Reportes (PDF y Excel)
export async function descargarPdfHaciendaPy() {
  const token = getToken();
  const res = await fetch("/api/py/reportes/exportar-pdf", {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Error al descargar PDF (${res.status})`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vakera_informe_hacienda.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  return true;
}

export async function descargarExcelStockPy() {
  const token = getToken();
  const res = await fetch("/api/py/reportes/exportar-excel", {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Error al descargar Excel (${res.status})`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vakera_inventario_general.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  return true;
}

export async function descargarPdfMargenBrutoPy(payload) {
  const token = getToken();
  const res = await fetch("/api/py/reportes/exportar-margen-bruto", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload || {}),
  });

  if (!res.ok) {
    throw new Error(`Error al generar Margen Bruto PDF (${res.status})`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vakera_margen_bruto.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  return true;
}
