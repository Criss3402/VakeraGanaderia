/**
 * Servicio de Cotizaciones Ganaderas en Tiempo Real
 * Fuente principal: Mercado Agroganadero de Cañuelas (MAG)
 *   - Tabla por categorías: https://www.mercadoagroganadero.com.ar/dll/hacienda1.dll/haciinfo000002
 *   - Índices generales (INMAG / IGMAG): https://www.mercadoagroganadero.com.ar/dll/inicio.dll
 *
 * Incluye caché en memoria (1 hora) y valores de contingencia ante caídas de red.
 */

const MAG_PRECIOS_URL = "https://www.mercadoagroganadero.com.ar/dll/hacienda1.dll/haciinfo000002";
const MAG_INICIO_URL = "https://www.mercadoagroganadero.com.ar/dll/inicio.dll";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora
const DIFERENCIAL_CORRIENTES = Number(process.env.DIFERENCIAL_CORRIENTES) || 0.88; // -12% flete/origen

const PRECIOS_CONTINGENCIA = {
  NOVILLOS: { categoria: "Novillos", precioPromedioKg: 3949, minimoKg: 2600, maximoKg: 4500, cabezas: 0 },
  NOVILLITOS: { categoria: "Novillitos", precioPromedioKg: 4108, minimoKg: 1800, maximoKg: 4900, cabezas: 0 },
  VAQUILLONAS: { categoria: "Vaquillonas", precioPromedioKg: 3944, minimoKg: 2200, maximoKg: 5000, cabezas: 0 },
  VACAS: { categoria: "Vacas", precioPromedioKg: 2709, minimoKg: 1800, maximoKg: 3300, cabezas: 0 },
  TOROS: { categoria: "Toros", precioPromedioKg: 3311, minimoKg: 1500, maximoKg: 4000, cabezas: 0 },
  MEJ: { categoria: "MEJ", precioPromedioKg: 4007, minimoKg: 2000, maximoKg: 4800, cabezas: 0 },
  TERNEROS_CORRIENTES: {
    categoria: "Terneros (Corrientes est.)",
    precioPromedioKg: 3475,
    minimoKg: 3475,
    maximoKg: 3475,
    cabezas: 0,
    nota: "Estimación regional (-12% sobre INMAG)",
  },
};

let cacheCotizaciones = {
  data: null,
  expiraEn: 0,
};

/**
 * Convierte un número en formato argentino ("3.948,606" o "$350.024.500,00") a Number.
 */
function parsearNumeroAR(texto) {
  if (!texto) return null;
  const limpio = String(texto)
    .replace(/\$/g, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}

function limpiarHtml(texto) {
  return String(texto || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/\s+/g, " ")
    .trim();
}

function detectarGrupoCategoria(nombreSubcategoria) {
  const upper = String(nombreSubcategoria || "").toUpperCase();
  if (upper.startsWith("NOVILLITOS")) return "NOVILLITOS";
  if (upper.startsWith("NOVILLOS")) return "NOVILLOS";
  if (upper.startsWith("VAQUILLONAS")) return "VAQUILLONAS";
  if (upper.startsWith("VACAS")) return "VACAS";
  if (upper.startsWith("TOROS")) return "TOROS";
  if (upper.startsWith("MEJ")) return "MEJ";
  return null;
}

class CotizacionService {
  /**
   * Obtiene las cotizaciones actuales del MAG (o caché / contingencia).
   */
  static async obtenerCotizaciones({ forzar = false } = {}) {
    const ahora = Date.now();

    if (!forzar && cacheCotizaciones.data && cacheCotizaciones.expiraEn > ahora) {
      return {
        ...cacheCotizaciones.data,
        fuente: cacheCotizaciones.data.esEnVivo ? "mag_cache" : "contingencia_cache",
      };
    }

    try {
      const headers = {
        "User-Agent": "Mozilla/5.0 (compatible; VakeraGanaderia/2.0)",
        Accept: "text/html,application/xhtml+xml",
      };

      const [resPrecios, resInicio] = await Promise.all([
        fetch(MAG_PRECIOS_URL, { headers, signal: AbortSignal.timeout(8000) }),
        fetch(MAG_INICIO_URL, { headers, signal: AbortSignal.timeout(8000) }),
      ]);

      if (!resPrecios.ok) {
        throw new Error(`MAG precios respondió HTTP ${resPrecios.status}`);
      }

      const htmlPrecios = await resPrecios.text();
      const htmlInicio = resInicio.ok ? await resInicio.text() : "";

      const parsedPrecios = CotizacionService.parsearTablaPreciosMAG(htmlPrecios);
      const parsedIndices = CotizacionService.parsearIndicesInicioMAG(htmlInicio);

      if (Object.keys(parsedPrecios.categorias).length === 0) {
        throw new Error("No se pudieron extraer categorías de la tabla del MAG.");
      }

      const inmag = parsedIndices.inmag || parsedPrecios.promedioGeneral || 3949;
      const ternerosEstimado = Math.round(inmag * DIFERENCIAL_CORRIENTES);

      const categorias = {
        ...parsedPrecios.categorias,
        TERNEROS_CORRIENTES: {
          categoria: "Terneros (Corrientes est.)",
          precioPromedioKg: ternerosEstimado,
          minimoKg: ternerosEstimado,
          maximoKg: ternerosEstimado,
          cabezas: 0,
          referenciaNacionalInmag: Math.round(inmag),
          diferencialAplicado: "-12%",
          nota: "Estimación origen Corrientes (-12% sobre INMAG)",
        },
      };

      const resultado = {
        mercado: "Mercado Agroganadero de Cañuelas (MAG)",
        moneda: "ARS",
        unidad: "$/kg vivo",
        fechaRueda: parsedIndices.fechaRueda || new Date().toLocaleDateString("es-AR"),
        actualizadoEn: new Date().toISOString(),
        esEnVivo: true,
        fuente: "mag_live",
        indices: {
          inmag: parsedIndices.inmag,
          igmag: parsedIndices.igmag,
          indiceArrendamiento: parsedIndices.indiceArrendamiento,
          promedioGeneralMag: parsedPrecios.promedioGeneral,
        },
        categorias,
        detalleSubcategorias: parsedPrecios.subcategorias,
      };

      cacheCotizaciones = {
        data: resultado,
        expiraEn: ahora + CACHE_TTL_MS,
      };

      return resultado;
    } catch (err) {
      console.warn("[CotizacionService] Fallback a precios de contingencia:", err.message);

      const fallback = {
        mercado: "Mercado Agroganadero de Cañuelas (Referencia)",
        moneda: "ARS",
        unidad: "$/kg vivo",
        fechaRueda: new Date().toLocaleDateString("es-AR"),
        actualizadoEn: new Date().toISOString(),
        esEnVivo: false,
        fuente: "contingencia_mag",
        aviso: "No se pudo consultar el MAG en vivo temporalmente. Usando valores de referencia.",
        indices: {
          inmag: 3949.32,
          igmag: 3476.63,
          indiceArrendamiento: 3981.76,
          promedioGeneralMag: 3476.29,
        },
        categorias: PRECIOS_CONTINGENCIA,
        detalleSubcategorias: [],
      };

      cacheCotizaciones = {
        data: fallback,
        expiraEn: ahora + 10 * 60 * 1000, // Reintentar en 10 min si falló
      };

      return fallback;
    }
  }

  /**
   * Parsea la tabla HTML de haciinfo000002 del MAG.
   */
  static parsearTablaPreciosMAG(html) {
    const categorias = {};
    const subcategorias = [];
    let promedioGeneral = null;
    let grupoActual = null;
    let minGrupo = Infinity;
    let maxGrupo = 0;

    const filas = String(html || "").match(/<TR[^>]*>[\s\S]*?<\/TR>/gi) || [];

    for (const fila of filas) {
      const celdas = (fila.match(/<TD[^>]*>[\s\S]*?<\/TD>/gi) || []).map(limpiarHtml);
      if (celdas.length === 0) continue;

      const primera = celdas[0];

      // Fila de totales generales del MAG
      if (/^Totales$/i.test(primera) && celdas.length >= 4) {
        promedioGeneral = parsearNumeroAR(celdas[3]);
        continue;
      }

      // Fila de resumen de grupo (primera celda vacía, 4ta celda con promedio numérico)
      if (primera === "" && celdas.length >= 6) {
        const prom = parsearNumeroAR(celdas[3]);
        const cabezas = parsearNumeroAR(celdas[5]);
        if (prom && grupoActual && !String(celdas[3]).includes("---")) {
          categorias[grupoActual] = {
            categoria:
              grupoActual.charAt(0) + grupoActual.slice(1).toLowerCase(),
            precioPromedioKg: Math.round(prom),
            minimoKg: Number.isFinite(minGrupo) ? Math.round(minGrupo) : Math.round(prom),
            maximoKg: maxGrupo > 0 ? Math.round(maxGrupo) : Math.round(prom),
            cabezas: cabezas || 0,
          };
          grupoActual = null;
          minGrupo = Infinity;
          maxGrupo = 0;
        }
        continue;
      }

      // Fila de subcategoría (ej: "NOVILLOS Mest.EyB 431/460")
      const grupo = detectarGrupoCategoria(primera);
      if (grupo && celdas.length >= 6) {
        if (grupoActual && grupoActual !== grupo) {
          minGrupo = Infinity;
          maxGrupo = 0;
        }
        grupoActual = grupo;

        const min = parsearNumeroAR(celdas[1]);
        const max = parsearNumeroAR(celdas[2]);
        const prom = parsearNumeroAR(celdas[3]);
        const mediana = parsearNumeroAR(celdas[4]);
        const cabezas = parsearNumeroAR(celdas[5]);

        if (min && min < minGrupo) minGrupo = min;
        if (max && max > maxGrupo) maxGrupo = max;

        subcategorias.push({
          grupo,
          nombre: primera,
          minimoKg: min ? Math.round(min) : null,
          maximoKg: max ? Math.round(max) : null,
          promedioKg: prom ? Math.round(prom) : null,
          medianaKg: mediana ? Math.round(mediana) : null,
          cabezas: cabezas || 0,
        });
      }
    }

    return { categorias, subcategorias, promedioGeneral };
  }

  /**
   * Parsea los índices INMAG, IGMAG y fecha de rueda desde inicio.dll del MAG.
   */
  static parsearIndicesInicioMAG(html) {
    const texto = String(html || "");
    const inmagMatch = texto.match(/INMAG\s+([\d.,]+)/i);
    const igmagMatch = texto.match(/IGMAG\s+([\d.,]+)/i);
    const arrendMatch = texto.match(/Indice\s+Arrend\.\s+([\d.,]+)/i);
    const fechaMatch = texto.match(/class="home-subtitle">\s*(\d{2}\/\d{2}\/\d{4})/i);

    return {
      inmag: inmagMatch ? parsearNumeroAR(inmagMatch[1]) : null,
      igmag: igmagMatch ? parsearNumeroAR(igmagMatch[1]) : null,
      indiceArrendamiento: arrendMatch ? parsearNumeroAR(arrendMatch[1]) : null,
      fechaRueda: fechaMatch ? fechaMatch[1] : null,
    };
  }

  /**
   * Resuelve el precio $/kg vivo para una categoría de rodeo de Vakera.
   */
  static obtenerPrecioPorCategoria(categoriaNombre, cotizaciones) {
    const cats = cotizaciones?.categorias || PRECIOS_CONTINGENCIA;
    const norm = String(categoriaNombre || "")
      .trim()
      .toLowerCase();

    let clave = null;
    if (norm.includes("novillito")) clave = "NOVILLITOS";
    else if (norm.includes("novillo")) clave = "NOVILLOS";
    else if (norm.includes("vaquill")) clave = "VAQUILLONAS";
    else if (norm.includes("terner")) clave = "TERNEROS_CORRIENTES";
    else if (norm.includes("vaca")) clave = "VACAS";
    else if (norm.includes("toro")) clave = "TOROS";
    else if (norm.includes("mej")) clave = "MEJ";

    if (clave && cats[clave]?.precioPromedioKg) {
      return {
        precioKgVivo: cats[clave].precioPromedioKg,
        categoriaReferencia: cats[clave].categoria || clave,
      };
    }

    const fallbackGeneral = Math.round(
      cotizaciones?.indices?.inmag ||
      cotizaciones?.indices?.promedioGeneralMag ||
      3476
    );
    return {
      precioKgVivo: fallbackGeneral,
      categoriaReferencia: "INMAG (Referencia General)",
    };
  }

  static limpiarCache() {
    cacheCotizaciones = { data: null, expiraEn: 0 };
  }
}

module.exports = CotizacionService;
