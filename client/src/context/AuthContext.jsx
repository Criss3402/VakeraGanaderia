import { createContext, useContext, useEffect, useState } from "react";
import {
  login as apiLogin,
  registro as apiRegistro,
  verificarEmail as apiVerificarEmail,
  obtenerUsuarioActual,
  logout as apiLogout,
} from "../api/auth.api.js";
import { getToken } from "../api/client.js";

const AuthContext = createContext(null);
const USER_CACHE_KEY = "vakera_usuario_cache";

function leerUsuarioCache() {
  try {
    if (!getToken()) return null;
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
  const [token, setTokenState] = useState(() => getToken());
  // Si ya hay usuario cacheado con token, evitamos bloquear la UI (Stale-While-Revalidate)
  const [cargando, setCargando] = useState(() => Boolean(getToken() && !leerUsuarioCache()));

  useEffect(() => {
    const tokenGuardado = getToken();
    if (tokenGuardado) {
      obtenerUsuarioActual()
        .then((res) => {
          if (res?.data?.usuario) {
            setUsuario(res.data.usuario);
            guardarUsuarioCache(res.data.usuario);
            setTokenState(tokenGuardado);
          } else {
            apiLogout();
            guardarUsuarioCache(null);
            setUsuario(null);
            setTokenState(null);
          }
        })
        .catch(() => {
          apiLogout();
          guardarUsuarioCache(null);
          setUsuario(null);
          setTokenState(null);
        })
        .finally(() => {
          setCargando(false);
        });
    } else {
      guardarUsuarioCache(null);
      setCargando(false);
    }
  }, []);

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

  function cerrarSesion() {
    apiLogout();
    guardarUsuarioCache(null);
    setUsuario(null);
    setTokenState(null);
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
