import { useState, useEffect } from "react";

// Ubicación por defecto (se usa si el navegador no da permiso de geolocalización)
const UBICACION_DEFECTO = { latitude: -27.47, longitude: -58.83 };

const ESTADOS = {
  0: ["Despejado", "fa-sun"],
  1: ["Mayormente despejado", "fa-cloud-sun"],
  2: ["Parcialmente nublado", "fa-cloud-sun"],
  3: ["Nublado", "fa-cloud"],
  45: ["Niebla", "fa-smog"],
  48: ["Niebla", "fa-smog"],
  51: ["Llovizna", "fa-cloud-rain"],
  53: ["Llovizna", "fa-cloud-rain"],
  55: ["Llovizna", "fa-cloud-rain"],
  61: ["Lluvia", "fa-cloud-showers-heavy"],
  63: ["Lluvia", "fa-cloud-showers-heavy"],
  65: ["Lluvia fuerte", "fa-cloud-showers-heavy"],
  80: ["Chubascos", "fa-cloud-showers-heavy"],
  81: ["Chubascos", "fa-cloud-showers-heavy"],
  82: ["Chubascos fuertes", "fa-cloud-showers-heavy"],
  95: ["Tormenta", "fa-bolt"],
  96: ["Tormenta con granizo", "fa-bolt"],
  99: ["Tormenta con granizo", "fa-bolt"],
};

async function pedirClima({ latitude, longitude }) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code",
    hourly: "temperature_2m",
    forecast_days: 1,
    timezone: "auto",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error("No se pudo obtener el clima");
  return res.json();
}

// Acepta "lat, lon" (ej: -27.47, -58.83) o el nombre de una ciudad
async function resolverUbicacion(texto) {
  const m = texto.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (m) {
    const latitude = parseFloat(m[1].replace(",", "."));
    const longitude = parseFloat(m[2].replace(",", "."));
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new Error("Coordenadas fuera de rango");
    }
    return { latitude, longitude, nombre: `${latitude}, ${longitude}` };
  }
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(texto.trim())}&count=1&language=es`
  );
  const data = await res.json();
  const r = data.results?.[0];
  if (!r) throw new Error(`No se encontró la ciudad "${texto}"`);
  return {
    latitude: r.latitude,
    longitude: r.longitude,
    nombre: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
  };
}

const CLAVE_UBICACION = "clima_ubicacion";

export default function WidgetClima() {
  const [clima, setClima] = useState(null);
  const [error, setError] = useState("");
  const [nombre, setNombre] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  async function cargar(ubic) {
    setCargando(true);
    setError("");
    try {
      setClima(await pedirClima(ubic));
      setNombre(ubic.nombre || "Ubicación actual");
      if (ubic.nombre) localStorage.setItem(CLAVE_UBICACION, JSON.stringify(ubic));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function buscar(e) {
    e.preventDefault();
    if (!busqueda.trim()) return;
    setCargando(true);
    try {
      await cargar(await resolverUbicacion(busqueda));
      setBusqueda("");
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  }

  useEffect(() => {
    const guardada = localStorage.getItem(CLAVE_UBICACION);
    if (guardada) {
      cargar(JSON.parse(guardada));
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => cargar({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => cargar(UBICACION_DEFECTO),
        { timeout: 5000 }
      );
    } else {
      cargar(UBICACION_DEFECTO);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formulario = (
    <form onSubmit={buscar} className="flex gap-2 w-full">
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Ciudad o coordenadas (ej: -27.47, -58.83)"
        className="flex-1 text-xs px-3 py-2 rounded-xl border border-[#ded7c4] bg-[#f8f5eb] focus:outline-none focus:border-[#8fb56b]"
      />
      <button
        type="submit"
        disabled={cargando}
        className="bg-[#182920] hover:bg-[#284835] text-[#f1ecdd] text-xs font-bold px-4 py-2 rounded-xl"
      >
        <i className="fa-solid fa-magnifying-glass"></i> Buscar
      </button>
    </form>
  );

  if (!clima) {
    return (
      <div className="bg-white rounded-2xl p-4 border border-[#ded7c4] space-y-2">
        <p className={`text-xs ${error ? "text-red-700" : "text-[#6b7c6d]"}`}>
          {error ? `Clima no disponible: ${error}` : "Cargando clima..."}
        </p>
        {formulario}
      </div>
    );
  }

  const c = clima.current;
  const [descripcion, icono] = ESTADOS[c.weather_code] || ["—", "fa-cloud"];
  const temps = clima.hourly.temperature_2m;
  const max = Math.max(...temps);
  const min = Math.min(...temps);

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#ded7c4] shadow-sm space-y-3">
    {formulario}
    {error && <p className="text-xs text-red-700">{error}</p>}
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#8fb56b]/20 text-[#33512f] flex items-center justify-center text-2xl">
          <i className={`fa-solid ${icono}`}></i>
        </div>
        <div>
          <p className="text-[10px] uppercase font-semibold text-[#6b7c6d]">
            {nombre} · {clima.latitude.toFixed(2)}, {clima.longitude.toFixed(2)}
          </p>
          <p className="text-3xl font-extrabold text-[#182920] leading-none">
            {Math.round(c.temperature_2m)}°C
          </p>
          <p className="text-xs text-[#4a5c4e]">{descripcion}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        {[
          ["Máx / Mín", `${Math.round(max)}° / ${Math.round(min)}°`],
          ["Humedad", `${c.relative_humidity_2m}%`],
          ["Viento", `${c.wind_speed_10m} km/h`],
          ["Lluvia", `${c.precipitation} mm`],
        ].map(([t, v]) => (
          <div key={t} className="bg-[#f8f5eb] border border-[#ded7c4] rounded-xl px-3 py-2">
            <p className="text-[10px] text-[#6b7c6d] uppercase font-semibold">{t}</p>
            <p className="text-sm font-bold text-[#182920]">{v}</p>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
