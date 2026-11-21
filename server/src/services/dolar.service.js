/**
 * Servicio de Cotización del Dólar en Argentina
 * Fuente: DolarApi (https://dolarapi.com/docs/argentina/)
 * Endpoint: https://dolarapi.com/v1/dolares
 *
 * Incluye caché en memoria (15 minutos) y valores de contingencia ante caídas de red.
 */

const DOLAR_API_URL = "https://dolarapi.com/v1/dolares";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

const DOLAR_CONTINGENCIA = {
  oficial: { casa: "oficial", nombre: "Oficial", compra: 1550, venta: 1600, fechaActualizacion: null },
  blue: { casa: "blue", nombre: "Blue", compra: 1655, venta: 1675, fechaActualizacion: null },
  bolsa: { casa: "bolsa", nombre: "Bolsa", compra: 1682.6, venta: 1743.1, fechaActualizacion: null },
  contadoconliqui: { casa: "contadoconliqui", nombre: "Contado con liquidación", compra: 1801.4, venta: 1806.2, fechaActualizacion: null },
  mayorista: { casa: "mayorista", nombre: "Mayorista", compra: 1571, venta: 1580, fechaActualizacion: null },
  cripto: { casa: "cripto", nombre: "Cripto", compra: 1700, venta: 1730, fechaActualizacion: null },
};

let cacheDolar = {
  data: null,
  expiraEn: 0,
};

class DolarService {
  /**
   * Obtiene las cotizaciones actuales del dólar en Argentina desde DolarApi.
   */
  static async obtenerCotizaciones({ forzar = false } = {}) {
    const ahora = Date.now();

    if (!forzar && cacheDolar.data && cacheDolar.expiraEn > ahora) {
      return {
        ...cacheDolar.data,
        fuente: cacheDolar.data.esEnVivo ? "dolarapi_cache" : "contingencia_cache",
      };
    }

    try {
      const response = await fetch(DOLAR_API_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        throw new Error(`DolarApi respondió HTTP ${response.status}`);
      }

      const lista = await response.json();
      const cotizaciones = DolarService.normalizarLista(lista);

      if (!cotizaciones.oficial && !cotizaciones.blue) {
        throw new Error("Respuesta de DolarApi sin cotizaciones válidas.");
      }

      const fechaActualizacion =
        cotizaciones.oficial?.fechaActualizacion ||
        cotizaciones.blue?.fechaActualizacion ||
        new Date().toISOString();

      const resultado = {
        proveedor: "DolarApi Argentina",
        monedaBase: "USD",
        monedaDestino: "ARS",
        fechaActualizacion,
        actualizadoEn: new Date().toISOString(),
        esEnVivo: true,
        fuente: "dolarapi_live",
        cotizaciones,
      };

      cacheDolar = {
        data: resultado,
        expiraEn: ahora + CACHE_TTL_MS,
      };

      return resultado;
    } catch (err) {
      console.warn("[DolarService] Fallback a cotización de contingencia:", err.message);

      const fallback = {
        proveedor: "DolarApi Argentina (Referencia)",
        monedaBase: "USD",
        monedaDestino: "ARS",
        fechaActualizacion: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
        esEnVivo: false,
        fuente: "contingencia_dolar",
        aviso: "No se pudo consultar DolarApi temporalmente. Usando valores de referencia.",
        cotizaciones: DOLAR_CONTINGENCIA,
      };

      cacheDolar = {
        data: fallback,
        expiraEn: ahora + 5 * 60 * 1000,
      };

      return fallback;
    }
  }

  /**
   * Convierte el arreglo de DolarApi en un mapa indexado por `casa`.
   */
  static normalizarLista(lista) {
    const mapa = {};
    if (!Array.isArray(lista)) return mapa;

    for (const item of lista) {
      if (!item || !item.casa) continue;
      const clave = String(item.casa).toLowerCase();
      mapa[clave] = {
        casa: clave,
        nombre: item.nombre || clave,
        compra: Number(item.compra) || 0,
        venta: Number(item.venta) || 0,
        fechaActualizacion: item.fechaActualizacion || null,
      };
    }

    return mapa;
  }

  static limpiarCache() {
    cacheDolar = { data: null, expiraEn: 0 };
  }
}

module.exports = DolarService;
