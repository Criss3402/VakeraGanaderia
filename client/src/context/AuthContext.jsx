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

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [token, setTokenState] = useState(getToken());
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Verificar si hay sesión activa
    const tokenGuardado = getToken();
    if (tokenGuardado) {
      obtenerUsuarioActual()
        .then((res) => {
          if (res?.data?.usuario) {
            setUsuario(res.data.usuario);
            setTokenState(tokenGuardado);
          } else {
            apiLogout();
            setUsuario(null);
            setTokenState(null);
          }
        })
        .catch(() => {
          apiLogout();
          setUsuario(null);
          setTokenState(null);
        })
        .finally(() => {
          setCargando(false);
        });
    } else {
      setCargando(false);
    }
  }, []);

  async function iniciarSesion(email, password) {
    const res = await apiLogin(email, password);
    if (res?.data?.usuario) {
      setUsuario(res.data.usuario);
      setTokenState(res.data.token);
      return res.data.usuario;
    }
    throw new Error("Respuesta inválida del servidor");
  }

  async function registrarse(datos) {
    const res = await apiRegistro(datos);
    // Si viene token inmediato
    if (res?.data?.token && res?.data?.usuario) {
      setUsuario(res.data.usuario);
      setTokenState(res.data.token);
      return res.data.usuario;
    }
    return res?.data;
  }

  async function verificarEmailConToken(tokenVerif) {
    const res = await apiVerificarEmail(tokenVerif);
    if (res?.data?.usuario && res?.data?.token) {
      setUsuario(res.data.usuario);
      setTokenState(res.data.token);
      return res.data.usuario;
    }
    return res?.data;
  }

  function cerrarSesion() {
    apiLogout();
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

