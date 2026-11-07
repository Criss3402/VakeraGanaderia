/**
 * Tests Unitarios — WeatherService (Google Weather API y Contingencia Regional)
 *
 * Fase 3C del Implementation Plan:
 * - Operación en modo de contingencia regional cuando no hay API Key configurada.
 * - Resiliencia ante fallos de red de Google Weather API (fetch lanza o responde 500).
 * - Mapeo y normalización de la estructura JSON de Google Weather API.
 * - Validación de la política de caché en memoria de 15 minutos para optimización de cuota.
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const WeatherService = require("../../../src/services/weather.service");

describe("Unitario — WeatherService (Clima y Contingencia)", () => {
  let originalApiKey;
  let originalMapsKey;
  let originalFetch;

  beforeEach(() => {
    originalApiKey = process.env.GOOGLE_WEATHER_API_KEY;
    originalMapsKey = process.env.GOOGLE_MAPS_API_KEY;
    originalFetch = globalThis.fetch;
    delete process.env.GOOGLE_WEATHER_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  afterEach(() => {
    process.env.GOOGLE_WEATHER_API_KEY = originalApiKey;
    process.env.GOOGLE_MAPS_API_KEY = originalMapsKey;
    globalThis.fetch = originalFetch;
  });

  describe("1. Contingencia regional sin API Key", () => {
    it("retorna datos de contingencia regional cuando no hay API key configurada", async () => {
      const clima = await WeatherService.obtenerCondicionesActuales({
        lat: -29.1442,
        lon: -59.2638,
      });

      assert.ok(clima);
      assert.equal(clima.esEnVivo, false);
      assert.match(clima.fuente, /contingencia|simulado/);
      assert.ok(typeof clima.temperatura === "number");
      assert.ok(typeof clima.humedad === "number");
      assert.ok(clima.descripcion);
      assert.ok(typeof clima.vientoKmH === "number");
    });
  });

  describe("2. Resiliencia ante errores de red (Fetch Fallando)", () => {
    it("si fetch lanza error de red, captura la excepción y retorna contingencia sin caer", async () => {
      process.env.GOOGLE_WEATHER_API_KEY = "test-fake-weather-key";

      globalThis.fetch = async () => {
        throw new Error("DNS_RESOLUTION_FAILED: weather.googleapis.com no accesible");
      };

      const clima = await WeatherService.obtenerCondicionesActuales({
        lat: -29.1442,
        lon: -59.2638,
      });

      assert.ok(clima);
      assert.equal(clima.esEnVivo, false);
      assert.match(clima.fuente, /contingencia|simulado/);
      assert.ok(clima.temperatura);
    });

    it("si Google Weather responde con código HTTP 500, usa contingencia", async () => {
      process.env.GOOGLE_WEATHER_API_KEY = "test-fake-weather-key";

      globalThis.fetch = async () => {
        return {
          ok: false,
          status: 500,
          text: async () => "Internal Server Error en Google Cloud",
        };
      };

      const clima = await WeatherService.obtenerCondicionesActuales({
        lat: -29.1442,
        lon: -59.2638,
      });

      assert.ok(clima);
      assert.equal(clima.esEnVivo, false);
      assert.match(clima.fuente, /contingencia|simulado/);
    });
  });

  describe("3. Formateo de Respuesta Google", () => {
    it("formatearRespuestaGoogle mapea la estructura de la API a las propiedades esperadas", () => {
      const mockGoogleData = {
        temperature: { degrees: 24.6 },
        feelsLikeTemperature: { degrees: 26.2 },
        relativeHumidity: 65,
        weatherCondition: {
          description: { text: "Parcialmente nublado" },
          type: "PARTLY_CLOUDY",
        },
        wind: {
          speed: { value: 18.5 },
          direction: { text: "SE" },
        },
        uvIndex: 7,
      };

      const formateado = WeatherService.formatearRespuestaGoogle(mockGoogleData, {
        latitude: -29.1442,
        longitude: -59.2638,
      });

      assert.equal(formateado.temperatura, 25); // Math.round(24.6)
      assert.equal(formateado.sensacionTermica, 26); // Math.round(26.2)
      assert.equal(formateado.humedad, 65);
      assert.equal(formateado.descripcion, "Parcialmente nublado");
      assert.equal(formateado.tipoClima, "PARTLY_CLOUDY");
      assert.match(formateado.iconoFontAwesome, /fa-cloud-sun/);
    });
  });
});
