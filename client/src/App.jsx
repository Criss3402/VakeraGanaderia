import { useState, useEffect, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./views/4_permisos/ProtectedRoute.jsx";
import LandingView from "./views/1_inicio_presentacion/LandingView.jsx";

// Layout privado diferido para no penalizar el bundle público inicial
const PrivateLayout = lazy(() => import("./components/layout/PrivateLayout.jsx"));

// Vistas Secundarias Públicas diferidas (Code Splitting)
const LoginView = lazy(() => import("./views/2_login_registro/LoginView.jsx"));
const RegistroView = lazy(() => import("./views/2_login_registro/RegistroView.jsx"));
const RecuperarPasswordView = lazy(() => import("./views/2_login_registro/RecuperarPasswordView.jsx"));
const VerificarEmailView = lazy(() => import("./views/2_login_registro/VerificarEmailView.jsx"));

// Módulos Privados diferidos (aislando MapLibre y componentes pesados)
const DashboardView = lazy(() => import("./views/3_dashboard/DashboardView.jsx"));
const GanadoView = lazy(() => import("./views/3_dashboard/modulos/GanadoView.jsx"));
const PartesView = lazy(() => import("./views/3_dashboard/modulos/PartesView.jsx"));
const SanidadView = lazy(() => import("./views/3_dashboard/modulos/SanidadView.jsx"));
const InsumosView = lazy(() => import("./views/3_dashboard/modulos/InsumosView.jsx"));
const ReportesView = lazy(() => import("./views/3_dashboard/modulos/ReportesView.jsx"));
const TamboLecheView = lazy(() => import("./views/3_dashboard/modulos/TamboLecheView.jsx"));
const ParcelasView = lazy(() => import("./views/3_dashboard/modulos/ParcelasView.jsx"));
const FinanzasView = lazy(() => import("./views/3_dashboard/modulos/FinanzasView.jsx"));
const GestionUsuariosView = lazy(() => import("./views/4_permisos/GestionUsuariosView.jsx"));

function VistaCargando() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px", color: "#8fb56b" }}>
      <div style={{ width: "40px", height: "40px", border: "3px solid rgba(143,181,107,0.25)", borderTopColor: "#8fb56b", borderRadius: "50%", animation: "vakeraSpin 0.75s linear infinite" }} />
      <span style={{ fontSize: "13px", fontWeight: "600", color: "#6b7c6d", letterSpacing: "0.4px" }}>Cargando espacio...</span>
      <style>{`@keyframes vakeraSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const PATH_A_APP = {
  "/dashboard": "metricas",
  "/ganado": "ganado",
  "/ganado/lotes": "ganado-lotes",
  "/ganado/zonificacion": "ganado-potreros",
  "/ganado/reproduccion": "ganado-reproduccion",
  "/parcelas": "parcelas",
  "/partes": "partes",
  "/sanidad": "sanidad",
  "/insumos": "insumos",
  "/finanzas": "finanzas",
  "/finanzas/parametros": "finanzas-parametros",
  "/reportes": "reportes",
  "/tambo": "tambo",
  "/tambo/vacas-ordenadas": "tambo-vacas-ordenadas",
  "/permisos": "permisos",
};

const APP_A_PATH = Object.fromEntries(
  Object.entries(PATH_A_APP).map(([path, vista]) => [vista, path])
);

const PATH_A_PUBLICA = {
  "/": "landing",
  "/login": "login",
  "/registro": "registro",
  "/verificar": "verificar",
  "/recuperar": "recuperar",
};

function resolverEstadoDesdeUrl() {
  const params = new URLSearchParams(window.location.search);
  const rQuery = params.get("ruta");
  const googleNoReg = params.get("googleNoRegistrado") === "1";

  if (rQuery === "login" && googleNoReg) {
    return { ruta: "landing", subVista: "metricas" };
  }
  if (rQuery === "verificar" || rQuery === "recuperar" || rQuery === "login" || rQuery === "registro") {
    return { ruta: rQuery, subVista: "metricas" };
  }

  const pathNorm = window.location.pathname.replace(/\/+$/, "") || "/";
  if (PATH_A_APP[pathNorm]) {
    return { ruta: "app", subVista: PATH_A_APP[pathNorm] };
  }
  if (PATH_A_PUBLICA[pathNorm]) {
    return { ruta: PATH_A_PUBLICA[pathNorm], subVista: "metricas" };
  }
  return { ruta: "landing", subVista: "metricas" };
}

function obtenerPathParaEstado(ruta, subVista = "metricas") {
  if (ruta === "app") {
    return APP_A_PATH[subVista] || "/dashboard";
  }
  const entrada = Object.entries(PATH_A_PUBLICA).find(([, val]) => val === ruta);
  return entrada ? entrada[0] : "/";
}

function AppContenido() {
  const { estaAutenticado, cargando, iniciarSesionConToken } = useAuth();
  const [estadoInicialUrl] = useState(() => resolverEstadoDesdeUrl());
  // Vistas principales: 'landing' | 'login' | 'registro' | 'recuperar' | 'verificar' | 'app'
  const [ruta, setRuta] = useState(estadoInicialUrl.ruta);
  // Sub-vista dentro de la app privada: 'metricas' | 'ganado' | 'parcelas' | 'partes' | 'sanidad' | 'insumos' | 'reportes' | 'tambo' | 'permisos'
  const [subVistaApp, setSubVistaApp] = useState(estadoInicialUrl.subVista);

  const navegarA = (nuevaRuta, nuevaSubVista = subVistaApp, { reemplazar = false } = {}) => {
    const subFinal = nuevaRuta === "app" ? (nuevaSubVista || "metricas") : "metricas";
    setRuta(nuevaRuta);
    if (nuevaRuta === "app") {
      setSubVistaApp(subFinal);
    }
    const destino = obtenerPathParaEstado(nuevaRuta, subFinal);
    if (window.location.pathname !== destino) {
      if (reemplazar) {
        window.history.replaceState({ ruta: nuevaRuta, subVista: subFinal }, "", destino);
      } else {
        window.history.pushState({ ruta: nuevaRuta, subVista: subFinal }, "", destino);
      }
    }
  };

  // Escuchar botones Atrás / Adelante del navegador
  useEffect(() => {
    const alCambiarHistorial = () => {
      const { ruta: r, subVista } = resolverEstadoDesdeUrl();
      setRuta(r);
      setSubVistaApp(subVista);
    };
    window.addEventListener("popstate", alCambiarHistorial);
    return () => window.removeEventListener("popstate", alCambiarHistorial);
  }, []);

  const [paramsUrl, setParamsUrl] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      token: params.get("token") || "",
      email: params.get("email") || "",
      googleError: params.get("googleError") || "",
      googleNoRegistrado: params.get("googleNoRegistrado") === "1",
      googleEmail: params.get("googleEmail") || "",
    };
  });

  const [googleSetup, setGoogleSetup] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const rutaUrl = params.get("ruta");
    const setupToken = params.get("setupToken");
    if (rutaUrl === "google-completar" && setupToken) {
      try {
        const base64 = setupToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const decoded = JSON.parse(atob(base64));
        return {
          setupToken,
          email: decoded?.email || "",
          nombre: decoded?.nombre || "",
        };
      } catch {
        return { setupToken, email: "", nombre: "" };
      }
    }
    return null;
  });

  // Procesar retorno desde Google OAuth 2.0 (?ruta=google-callback&token=... o ?ruta=google-completar&setupToken=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rutaUrl = params.get("ruta");
    const tokenUrl = params.get("token");
    const setupToken = params.get("setupToken");
    const googleError = params.get("googleError");

    if (rutaUrl === "google-callback" && tokenUrl) {
      iniciarSesionConToken(tokenUrl)
        .then(() => {
          navegarA("app", "metricas", { reemplazar: true });
        })
        .catch((err) => {
          navegarA("login", "metricas", { reemplazar: true });
          setParamsUrl((prev) => ({
            ...prev,
            googleError: err.message || "No se pudo completar el acceso con Google.",
          }));
        });
    } else if (rutaUrl === "google-completar" && setupToken) {
      window.history.replaceState({}, "", "/");
    } else if (googleError) {
      window.history.replaceState({}, "", "/");
    }
  }, [iniciarSesionConToken]);

  // Si el usuario se autentica mientras está en login/registro, enviarlo al dashboard.
  // Si cierra sesión mientras está en la app privada, volver automáticamente a la portada.
  useEffect(() => {
    if (estaAutenticado) {
      setParamsUrl((prev) =>
        prev.googleNoRegistrado || prev.googleError
          ? { ...prev, googleNoRegistrado: false, googleError: "" }
          : prev
      );
      if (ruta === "login" || ruta === "registro" || ruta === "verificar") {
        navegarA("app", "metricas", { reemplazar: true });
      }
    } else if (!cargando && ruta === "app") {
      navegarA("landing", "metricas", { reemplazar: true });
    }
  }, [estaAutenticado, cargando, ruta]);

  const titulosVistas = {
    metricas: "Panel de Control Ganadero",
    ganado: "Gestión de Rodeo y Ganado",
    "ganado-lotes": "Manejo por Lotes y Traslados",
    "ganado-potreros": "Zonificación de Ganado",
    "ganado-reproduccion": "Reproducción, Tacto y Preñez",
    parcelas: "Mapeo Geoespacial de Parcelas y Ganado",
    partes: "Partes Diarios de Novedades de Campo",
    finanzas: "Costos Operativos y Finanzas",
    "finanzas-parametros": "Parámetros Productivos del Modelo",
    sanidad: "Calendario y Tratamientos Sanitarios",
    insumos: "Control de Insumos y Stock Crítico",
    reportes: "Reportes Contables y Auditoría",
    tambo: "Tambo y Precio de la Leche (OCLA)",
    "tambo-vacas-ordenadas": "Vacas Ordeñadas — Registro Diario",
    permisos: "Administración de Roles y Permisos (RBAC)",
  };

  // Renderizar Portada Principal sin cascada lazy (FCP / LCP inmediato)
  if (ruta === "landing") {
    return (
      <LandingView
        googleSetup={googleSetup}
        googleNoRegistrado={paramsUrl.googleNoRegistrado}
        googleError={paramsUrl.googleError}
        alIniciarSesion={() => navegarA("login")}
        alRegistrarse={() => navegarA("registro")}
        alIrARecuperar={() => navegarA("recuperar")}
        alIrAVerificar={(tok, em) => {
          setParamsUrl({ token: tok || "", email: em || "" });
          navegarA("verificar");
        }}
        alIrAlDashboard={() => navegarA("app", "metricas")}
      />
    );
  }

  if (ruta === "login") {
    return (
      <Suspense fallback={<VistaCargando />}>
        <LoginView
          errorInicial={paramsUrl.googleError}
          googleNoRegistrado={paramsUrl.googleNoRegistrado}
          alIrARegistro={() => navegarA("registro")}
          alIrARecuperar={() => navegarA("recuperar")}
          alIrAVerificar={(tok, em) => {
            setParamsUrl({ token: tok || "", email: em || "", googleError: "", googleNoRegistrado: false });
            navegarA("verificar");
          }}
          alIrALanding={() => navegarA("landing")}
          alIniciarExito={() => navegarA("app", "metricas", { reemplazar: true })}
        />
      </Suspense>
    );
  }

  if (ruta === "registro") {
    return (
      <Suspense fallback={<VistaCargando />}>
        <RegistroView
          errorInicial={paramsUrl.googleError}
          alIrALogin={() => navegarA("login")}
          alIrAVerificar={(tok, em) => {
            setParamsUrl({ token: tok || "", email: em || "", googleError: "" });
            navegarA("verificar");
          }}
          alIrALanding={() => navegarA("landing")}
          alRegistroExito={() => navegarA("app", "metricas", { reemplazar: true })}
        />
      </Suspense>
    );
  }

  if (ruta === "verificar") {
    return (
      <Suspense fallback={<VistaCargando />}>
        <VerificarEmailView
          tokenInicial={paramsUrl.token}
          emailInicial={paramsUrl.email}
          alIrALogin={() => navegarA("login")}
          alIrALanding={() => navegarA("landing")}
          alVerificacionExitosa={() => navegarA("app", "metricas", { reemplazar: true })}
        />
      </Suspense>
    );
  }

  if (ruta === "recuperar") {
    return (
      <Suspense fallback={<VistaCargando />}>
        <RecuperarPasswordView
          tokenInicial={paramsUrl.token}
          emailInicial={paramsUrl.email}
          alIrALogin={() => navegarA("login")}
          alIrALanding={() => navegarA("landing")}
          alRestablecerExito={() => navegarA("login")}
        />
      </Suspense>
    );
  }

  // Renderizar Aplicación Privada Protegida
  return (
    <ProtectedRoute alIrALogin={() => navegarA("login")}>
      <Suspense fallback={<VistaCargando />}>
        <PrivateLayout
          vistaActiva={subVistaApp}
          alCambiarVista={(nuevaSubVista) => navegarA("app", nuevaSubVista)}
          tituloVista={titulosVistas[subVistaApp] || "Panel General"}
          alIrALanding={() => navegarA("landing")}
        >
          <Suspense fallback={<VistaCargando />}>
            {subVistaApp === "permisos" && (
              <ProtectedRoute rolesPermitidos={["dueno"]} alIrALogin={() => navegarA("login")}>
                <GestionUsuariosView />
              </ProtectedRoute>
            )}

            {subVistaApp === "ganado" && <GanadoView subModuloInicial="rodeo" alVolverGanado={() => navegarA("app", "ganado")} />}
            {subVistaApp === "ganado-lotes" && <GanadoView subModuloInicial="lotes" alVolverGanado={() => navegarA("app", "ganado")} />}
            {subVistaApp === "ganado-potreros" && <GanadoView subModuloInicial="potreros" alVolverGanado={() => navegarA("app", "ganado")} />}
            {subVistaApp === "ganado-reproduccion" && <GanadoView subModuloInicial="reproduccion" alVolverGanado={() => navegarA("app", "ganado")} />}
            {subVistaApp === "parcelas" && <ParcelasView />}
            {subVistaApp === "partes" && <PartesView />}
            {subVistaApp === "sanidad" && <SanidadView />}
            {subVistaApp === "insumos" && <InsumosView />}
            {subVistaApp === "finanzas" && (
              <ProtectedRoute rolesPermitidos={["dueno", "oficina"]} alIrALogin={() => navegarA("login")}>
                <FinanzasView
                  vistaSubModulo="costos"
                  alCambiarSubModulo={(tab) => navegarA("app", tab === "parametros" ? "finanzas-parametros" : "finanzas")}
                />
              </ProtectedRoute>
            )}
            {subVistaApp === "finanzas-parametros" && (
              <ProtectedRoute rolesPermitidos={["dueno", "oficina"]} alIrALogin={() => navegarA("login")}>
                <FinanzasView
                  vistaSubModulo="parametros"
                  alCambiarSubModulo={(tab) => navegarA("app", tab === "parametros" ? "finanzas-parametros" : "finanzas")}
                />
              </ProtectedRoute>
            )}
            {subVistaApp === "reportes" && (
              <ProtectedRoute rolesPermitidos={["dueno", "oficina"]} alIrALogin={() => navegarA("login")}>
                <ReportesView />
              </ProtectedRoute>
            )}
            {subVistaApp === "tambo" && (
              <TamboLecheView
                vistaSubModulo="resumen"
                alIrAVacasOrdenadas={() => navegarA("app", "tambo-vacas-ordenadas")}
                alVolverTambo={() => navegarA("app", "tambo")}
              />
            )}
            {subVistaApp === "tambo-vacas-ordenadas" && (
              <TamboLecheView
                vistaSubModulo="vacas-ordenadas"
                alIrAVacasOrdenadas={() => navegarA("app", "tambo-vacas-ordenadas")}
                alVolverTambo={() => navegarA("app", "tambo")}
              />
            )}

            {subVistaApp === "metricas" && (
              <DashboardView
                alCambiarVista={(nuevaSubVista) => navegarA("app", nuevaSubVista)}
              />
            )}
          </Suspense>
        </PrivateLayout>
      </Suspense>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContenido />
    </AuthProvider>
  );
}
