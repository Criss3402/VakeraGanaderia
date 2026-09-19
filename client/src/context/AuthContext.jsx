import { createContext, useContext, useEffect, useState } from "react";
import {
  login as apiLogin,
  registro as apiRegistro,
  obtenerUsuarioActual,
  logout as apiLogout,
  obtenerUsuariosDemo,
} from "../api/auth.api.js";
import { getToken } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [token, setTokenState] = useState(getToken());
  const [cargando, setCargando] = useState(true);
  const [usuariosDemo, setUsuariosDemo] = useState([]);

  useEffect(() => {
    // Cargar usuarios de prueba para selector rápido
    obtenerUsuariosDemo()
      .then((res) => {
        if (res?.data) setUsuariosDemo(res.data);
      })
      .catch(() => {});

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

  async function loginRapido(rolDeseado) {
    const usuarioEncontrado = usuariosDemo.find((u) => u.rol === rolDeseado);
    if (!usuarioEncontrado) {
      // Fallback a credenciales conocidas
      const correosPorRol = {
        dueno: "dueno@vakera.com",
        capataz: "capataz@vakera.com",
        peon: "peon@vakera.com",
        oficina: "oficina@vakera.com",
        veterinario: "veterinario@vakera.com",
      };
      const email = correosPorRol[rolDeseado] || "dueno@vakera.com";
      return iniciarSesion(email, "password123");
    }
    return iniciarSesion(usuarioEncontrado.email, usuarioEncontrado.passwordDemo);
  }

  async function registrarse(datos) {
    const res = await apiRegistro(datos);
    if (res?.data?.usuario) {
      setUsuario(res.data.usuario);
      setTokenState(res.data.token);
      return res.data.usuario;
    }
    throw new Error("Respuesta inválida al registrar");
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
        usuariosDemo,
        iniciarSesion,
        loginRapido,
        registrarse,
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
