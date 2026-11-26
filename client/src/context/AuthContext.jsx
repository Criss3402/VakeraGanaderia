import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  login as apiLogin,
  registro as apiRegistro,
  verificarEmail as apiVerificarEmail,
  completarRegistroGoogle as apiCompletarRegistroGoogle,
  obtenerUsuarioActual,
  logout as apiLogout,
} from "../api/auth.api.js";
import {
  getToken,
  setToken,
  LAST_ACTIVITY_KEY,
  registrarActividad,
  sesionExpiradaPorInactividad,
  tokenJwtExpirado,
} from "../api/client.js";

const AuthContext = createContext(null);
const USER_CACHE_KEY = "vakera_usuario_cache";
const THROTTLE_ACTIVIDAD_MS = 10_000;
const INTERVALO_CONTROL_MS = 15_000;

function obtenerTokenActivo() {
  const token = getToken();
  if (!token) return null;
  if (sesionExpiradaPorInactividad() || tokenJwtExpirado(token)) {
    apiLogout();
    guardarUsuarioCache(null);
    return null;
  }
  return token;
}

function leerUsuarioCache() {
  try {
    if (!obtenerTokenActivo()) return null;
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function guardarUsuarioCache(usr) {
  try {
    if (usr) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(usr));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    // Ignorar cuota de almacenamiento excedida
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => leerUsuarioCache());
  const [token, setTokenState] = useState(() => obtenerTokenActivo());
  // Si ya hay usuario cacheado con token, evitamos bloquear la UI (Stale-While-Revalidate)
  const [cargando, setCargando] = useState(() => Boolean(obtenerTokenActivo() && !leerUsuarioCache()));

  const cerrarSesion = useCallback(() => {
    apiLogout();
    guardarUsuarioCache(null);
    setUsuario(null);
    setTokenState(null);
  }, []);

  useEffect(() => {
    const tokenGuardado = obtenerTokenActivo();
    if (tokenGuardado) {
      if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
        registrarActividad();
      }
      obtenerUsuarioActual()
        .then((res) => {
          if (res?.data?.usuario) {
            setUsuario(res.data.usuario);
            guardarUsuarioCache(res.data.usuario);
            setTokenState(tokenGuardado);
          } else {
            cerrarSesion();
          }
        })
        .catch(() => {
          cerrarSesion();
        })
        .finally(() => {
          setCargando(false);
        });
    } else {
      guardarUsuarioCache(null);
      setCargando(false);
    }
  }, [cerrarSesion]);

  // Cierre automático de sesión tras 30 minutos en reposo (inactividad o JWT vencido)
  useEffect(() => {
    if (!token) return undefined;

    let ultimoRegistro = Date.now();
    const marcarActividad = () => {
      const ahora = Date.now();
      if (ahora - ultimoRegistro >= THROTTLE_ACTIVIDAD_MS) {
        ultimoRegistro = ahora;
        registrarActividad(ahora);
      }
    };

    const verificarExpiracion = () => {
      if (sesionExpiradaPorInactividad() || tokenJwtExpirado(token)) {
        cerrarSesion();
      }
    };

    const eventos = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    eventos.forEach((ev) => window.addEventListener(ev, marcarActividad, { passive: true }));

    const manejarVisibilidad = () => {
      if (document.visibilityState === "visible") {
        verificarExpiracion();
      }
    };
    const manejarStorage = (e) => {
      if (e.key === "vakera_token" && !e.newValue) {
        cerrarSesion();
      }
    };

    document.addEventListener("visibilitychange", manejarVisibilidad);
    window.addEventListener("storage", manejarStorage);
    const timer = window.setInterval(verificarExpiracion, INTERVALO_CONTROL_MS);

    return () => {
      eventos.forEach((ev) => window.removeEventListener(ev, marcarActividad));
      document.removeEventListener("visibilitychange", manejarVisibilidad);
      window.removeEventListener("storage", manejarStorage);
      window.clearInterval(timer);
    };
  }, [token, cerrarSesion]);

  async function iniciarSesion(email, password) {
    const res = await apiLogin(email, password);
    if (res?.data?.usuario) {
      setUsuario(res.data.usuario);
      guardarUsuarioCache(res.data.usuario);
      setTokenState(res.data.token);
      return res.data.usuario;
    }
    throw new Error("Respuesta inválida del servidor");
  }

  async function registrarse(datos) {
    const res = await apiRegistro(datos);
    if (res?.data?.token && res?.data?.usuario) {
      setUsuario(res.data.usuario);
      guardarUsuarioCache(res.data.usuario);
      setTokenState(res.data.token);
      return res.data.usuario;
    }
    return res?.data;
  }

  async function verificarEmailConToken(tokenVerif) {
    const res = await apiVerificarEmail(tokenVerif);
    if (res?.data?.usuario && res?.data?.token) {
      setUsuario(res.data.usuario);
      guardarUsuarioCache(res.data.usuario);
      setTokenState(res.data.token);
      return res.data.usuario;
    }
    return res?.data;
  }

  async function iniciarSesionConToken(jwtToken) {
    if (!jwtToken) {
      throw new Error("Token de Google OAuth inválido.");
    }
    setToken(jwtToken);
    const res = await obtenerUsuarioActual();
    if (res?.data?.usuario) {
      setUsuario(res.data.usuario);
      guardarUsuarioCache(res.data.usuario);
      setTokenState(jwtToken);
      return res.data.usuario;
    }
    apiLogout();
    guardarUsuarioCache(null);
    throw new Error("No se pudo validar la sesión de Google.");
  }

  async function completarRegistroConGoogle(datos) {
    const res = await apiCompletarRegistroGoogle(datos);
    if (res?.data?.usuario && res?.data?.token) {
      setUsuario(res.data.usuario);
      guardarUsuarioCache(res.data.usuario);
      setTokenState(res.data.token);
      return res.data.usuario;
    }
    throw new Error("No se pudo completar el registro con Google.");
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        token,
        rol: usuario?.rol || null,
        estaAutenticado: Boolean(usuario),
        cargando,
        iniciarSesion,
        iniciarSesionConToken,
        completarRegistroConGoogle,
        registrarse,
        verificarEmailConToken,
        cerrarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser utilizado dentro de un AuthProvider");
  }
  return context;
}
