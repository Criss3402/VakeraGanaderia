/**
 * Servicio para consumir la API de Clima de Google Maps Platform
 * Documentación oficial: https://developers.google.com/maps/documentation/weather/current-conditions?hl=es-419
 * Endpoint: https://weather.googleapis.com/v1/currentConditions:lookup
 */

// Coordenadas por defecto: El Rancho, Goya, Corrientes, Argentina
const UBICACION_DEFAULT = {
  lat: -29.1442,
  lon: -59.2638,
  nombre: "El Rancho, Goya, Corrientes",
};

// Caché en memoria para optimizar cuota de Google API (15 minutos)
let cacheClima = {
  data: null,
  expiraEn: 0,
};

class WeatherService {
  /**
   * Obtiene las condiciones actuales desde la Google Weather API o datos de contingencia
   */
  static async obtenerCondicionesActuales({ lat, lon } = {}) {
    const latitude = Number(lat) || UBICACION_DEFAULT.lat;
    const longitude = Number(lon) || UBICACION_DEFAULT.lon;
    const ahora = Date.now();

    // Si tenemos datos en caché válidos (menos de 15 minutos), retornarlos
    if (cacheClima.data && cacheClima.expiraEn > ahora) {
      return {
        ...cacheClima.data,
        fuente: cacheClima.data.esEnVivo ? "google_weather_cache" : "simulado_cache",
      };
    }

    const apiKey = process.env.GOOGLE_WEATHER_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

    if (apiKey) {
      try {
        const url = new URL("https://weather.googleapis.com/v1/currentConditions:lookup");
        url.searchParams.set("key", apiKey);
        url.searchParams.set("location.latitude", latitude);
        url.searchParams.set("location.longitude", longitude);
        url.searchParams.set("unitsSystem", "METRIC");
        url.searchParams.set("languageCode", "es");

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          const resultado = WeatherService.formatearRespuestaGoogle(data, { latitude, longitude });
          
          // Guardar en caché 15 minutos
          cacheClima = {
            data: { ...resultado, esEnVivo: true },
            expiraEn: ahora + 15 * 60 * 1000,
          };

          return { ...resultado, esEnVivo: true, fuente: "google_weather_live" };
        } else {
          const errorTexto = await response.text();
          console.warn("[WeatherService] Error en respuesta de Google Weather API:", response.status, errorTexto);
        }
      } catch (err) {
        console.error("[WeatherService] Error al conectar con Google Weather API:", err.message);
      }
    }

    // Fallback inteligente cuando aún no se ha configurado la API Key o en desarrollo
    const fallback = WeatherService.generarDatosFallback({ latitude, longitude });
    cacheClima = {
      data: { ...fallback, esEnVivo: false },
      expiraEn: ahora + 10 * 60 * 1000,
    };

    return {
      ...fallback,
      esEnVivo: false,
      fuente: "contingencia_regional",
      aviso: apiKey
        ? "No se pudo conectar a Google Weather API temporalmente. Usando datos regionales."
        : "Para datos 100% en vivo, configura GOOGLE_WEATHER_API_KEY o GOOGLE_MAPS_API_KEY en server/.env",
    };
  }

  /**
   * Normaliza la respuesta JSON de Google Weather API
   */
  static formatearRespuestaGoogle(data, { latitude, longitude }) {
    const temp = Math.round(data?.temperature?.degrees ?? 20);
    const st = Math.round(data?.feelsLikeTemperature?.degrees ?? temp);
    const descripcion = data?.weatherCondition?.description?.text || "Cielo despejado";
    const tipo = data?.weatherCondition?.type || "CLEAR";
    const humedad = data?.relativeHumidity ?? 60;
    const viento = Math.round(data?.wind?.speed ?? 12);
    const direccionViento = data?.wind?.direction ?? 90;
    const lluviaProb = data?.precipitation?.probability ?? 0;
    const iconoUri = data?.weatherCondition?.iconBaseUri || null;

    return {
      ubicacion: UBICACION_DEFAULT.nombre,
      coordenadas: { lat: latitude, lon: longitude },
      temperatura: temp,
      sensacionTermica: st,
      descripcion: descripcion.charAt(0).toUpperCase() + descripcion.slice(1),
      tipoClima: tipo,
      iconoUrl: iconoUri ? `${iconoUri}.png` : null,
      iconoFontAwesome: WeatherService.mapearIconoFA(tipo),
      humedad,
      vientoKmH: viento,
      direccionViento,
      probabilidadLluvia: lluviaProb,
      horaActualizacion: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    };
  }

  /**
   * Genera datos realistas para el litoral ganadero argentino (Goya, Corrientes)
   */
  static generarDatosFallback({ latitude, longitude }) {
    const hora = new Date().getHours();
    const esDeNoche = hora < 6 || hora > 20;

    return {
      ubicacion: UBICACION_DEFAULT.nombre,
      coordenadas: { lat: latitude, lon: longitude },
      temperatura: 21,
      sensacionTermica: 22,
      descripcion: esDeNoche ? "Noche despejada" : "Cielo despejado",
      tipoClima: esDeNoche ? "CLEAR_NIGHT" : "CLEAR",
      iconoFontAwesome: esDeNoche ? "fa-solid fa-moon" : "fa-solid fa-sun",
      humedad: 62,
      vientoKmH: 14,
      direccionViento: 110,
      probabilidadLluvia: 5,
      horaActualizacion: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    };
  }

  /**
   * Mapea tipos de Google Weather a íconos FontAwesome modernos
   */
  static mapearIconoFA(tipo) {
    const mapa = {
      CLEAR: "fa-solid fa-sun text-amber-500",
      CLEAR_NIGHT: "fa-solid fa-moon text-amber-200",
      PARTLY_CLOUDY: "fa-solid fa-cloud-sun text-amber-400",
      CLOUDY: "fa-solid fa-cloud text-gray-400",
      MOSTLY_CLOUDY: "fa-solid fa-cloud text-gray-400",
      RAIN: "fa-solid fa-cloud-rain text-blue-400",
      HEAVY_RAIN: "fa-solid fa-cloud-showers-heavy text-blue-500",
      THUNDERSTORM: "fa-solid fa-bolt text-yellow-400",
      WINDY: "fa-solid fa-wind text-teal-400",
    };
    return mapa[tipo] || "fa-solid fa-sun text-amber-400";
  }
}

module.exports = WeatherService;
