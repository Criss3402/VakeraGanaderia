/**
 * Servicio de Precios del Tambo y Leche al Productor
 * Fuente: OCLA — Observatorio de la Cadena Láctea Argentina (https://www.ocla.org.ar/)
 * Indicadores oficiales SIGLeA ($/litro y $/kg Sólidos Útiles)
 *
 * Incluye caché en memoria (1 hora) y valores de contingencia ante caídas de red.
 */

const OCLA_URL = "https://www.ocla.org.ar/";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

const LECHE_CONTINGENCIA = {
  fuenteNombre: "OCLA / SIGLeA (Referencia)",
  periodo: "oct/2026",
  precioLitro: 550.25,
  precioKgSu: 7550.57,
  lpeUsdTon: 4081,
  moneda: "ARS",
};

let cacheLeche = {
  data: null,
  expiraEn: 0,
};

function parsearNumeroAR(texto) {
  if (!texto) return null;
  const limpio = String(texto)
    .replace(/\$/g, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const val = Number(limpio);
  return Number.isFinite(val) ? val : null;
}

class LecheService {
  /**
   * Obtiene el precio promedio nacional del litro de leche (SIGLeA) desde OCLA.
   */
  static async obtenerPreciosLeche({ forzar = false } = {}) {
    const ahora = Date.now();

    if (!forzar && cacheLeche.data && cacheLeche.expiraEn > ahora) {
      return {
        ...cacheLeche.data,
        fuente: cacheLeche.data.esEnVivo ? "ocla_cache" : "contingencia_cache",
      };
    }

    try {
      const response = await fetch(OCLA_URL, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; VakeraGanaderia/2.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error(`OCLA respondió HTTP ${response.status}`);
      }

      const html = await response.text();
      const parsed = LecheService.parsearHtmlOcla(html);

      if (!parsed.precioLitro) {
        throw new Error("No se pudo extraer el precio SIGLeA $/litro desde OCLA.");
      }

      const resultado = {
        fuenteNombre: "OCLA / SIGLeA",
        urlFuente: OCLA_URL,
        periodo: parsed.periodo || LECHE_CONTINGENCIA.periodo,
        precioLitro: parsed.precioLitro,
        precioKgSu: parsed.precioKgSu || LECHE_CONTINGENCIA.precioKgSu,
        lpeUsdTon: parsed.lpeUsdTon || null,
        moneda: "ARS",
        actualizadoEn: new Date().toISOString(),
        esEnVivo: true,
        fuente: "ocla_live",
      };

      cacheLeche = {
        data: resultado,
        expiraEn: ahora + CACHE_TTL_MS,
      };

      return resultado;
    } catch (err) {
      console.warn("[LecheService] Fallback a precios de contingencia:", err.message);

      const fallback = {
        ...LECHE_CONTINGENCIA,
        urlFuente: OCLA_URL,
        actualizadoEn: new Date().toISOString(),
        esEnVivo: false,
        fuente: "contingencia_ocla",
        aviso: "No se pudo consultar OCLA en vivo temporalmente. Usando último valor de referencia SIGLeA.",
      };

      cacheLeche = {
        data: fallback,
        expiraEn: ahora + 10 * 60 * 1000,
      };

      return fallback;
    }
  }

  /**
   * Extrae período SIGLeA, $/litro, $/kg SU y LPE USD/ton del HTML de ocla.org.ar.
   */
  static parsearHtmlOcla(html) {
    const texto = String(html || "");

    const periodoMatch = texto.match(/SIGLeA\s*\(([^)]+)\)/i);
    const litroMatch = texto.match(
      /<span[^>]*class="[^"]*badge[^"]*"[^>]*>\s*([\d.,]+)\s*<\/span>\s*<i[^>]*>\s*\/litro\s*<\/i>/i
    );
    const suMatch = texto.match(
      /<span[^>]*class="[^"]*badge[^"]*"[^>]*>\s*([\d.,]+)\s*<\/span>\s*<i[^>]*>\s*\/kg\s*SU\s*<\/i>/i
    );
    const lpeMatch = texto.match(/Precio de la LPE\s*\(USD\/ton\):\s*([\d.,]+)/i);

    return {
      periodo: periodoMatch ? periodoMatch[1].trim() : null,
      precioLitro: litroMatch ? parsearNumeroAR(litroMatch[1]) : null,
      precioKgSu: suMatch ? parsearNumeroAR(suMatch[1]) : null,
      lpeUsdTon: lpeMatch ? parsearNumeroAR(lpeMatch[1]) : null,
    };
  }

  static limpiarCache() {
    cacheLeche = { data: null, expiraEn: 0 };
  }
}

module.exports = LecheService;
