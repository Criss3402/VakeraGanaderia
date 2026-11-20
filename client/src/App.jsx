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
const ParcelasView = lazy(() => import("./views/3_dashboard/modulos/ParcelasView.jsx"));
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

function AppContenido() {
  const { estaAutenticado, cargando, iniciarSesionConToken } = useAuth();
  // Vistas principales: 'landing' | 'login' | 'registro' | 'recuperar' | 'verificar' | 'app'
  const [ruta, setRuta] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("ruta");
    const googleNoReg = params.get("googleNoRegistrado") === "1";
    if (r === "login" && googleNoReg) {
      return "landing";
    }
    if (r === "verificar" || r === "recuperar" || r === "login" || r === "registro") {
      return r;
    }
    return "landing";
  });

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
          window.history.replaceState({}, "", "/");
          setRuta("app");
        })
        .catch((err) => {
          window.history.replaceState({}, "", "/");
          setParamsUrl((prev) => ({
            ...prev,
            googleError: err.message || "No se pudo completar el acceso con Google.",
          }));
          setRuta("login");
        });
    } else if (rutaUrl === "google-completar" && setupToken) {
      window.history.replaceState({}, "", "/");
    } else if (googleError) {
      window.history.replaceState({}, "", "/");
    }
  }, [iniciarSesionConToken]);

  // Sub-vista dentro de la app privada: 'metricas' | 'ganado' | 'partes' | 'sanidad' | 'insumos' | 'reportes' | 'permisos'
  const [subVistaApp, setSubVistaApp] = useState("metricas");

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
        setRuta("app");
      }
    } else if (!cargando && ruta === "app") {
      setSubVistaApp("metricas");
      setRuta("landing");
    }
  }, [estaAutenticado, cargando, ruta]);

  const titulosVistas = {
    metricas: "Panel de Control Ganadero",
    ganado: "Gestión de Rodeo y Potreros",
    parcelas: "Mapeo Geoespacial de Parcelas y Potreros",
    partes: "Partes Diarios de Novedades de Campo",
    sanidad: "Calendario y Tratamientos Sanitarios",
    insumos: "Control de Insumos y Stock Crítico",
    reportes: "Reportes Contables y Auditoría",
    permisos: "Administración de Roles y Permisos (RBAC)",
  };

  // Renderizar Portada Principal sin cascada lazy (FCP / LCP inmediato)
  if (ruta === "landing") {
    return (
      <LandingView
        googleSetup={googleSetup}
        googleNoRegistrado={paramsUrl.googleNoRegistrado}
        googleError={paramsUrl.googleError}
        alIniciarSesion={() => setRuta("login")}
        alRegistrarse={() => setRuta("registro")}
        alIrARecuperar={() => setRuta("recuperar")}
        alIrAVerificar={(tok, em) => {
          setParamsUrl({ token: tok || "", email: em || "" });
          setRuta("verificar");
        }}
        alIrAlDashboard={() => setRuta("app")}
      />
    );
  }

  if (ruta === "login") {
    return (
      <Suspense fallback={<VistaCargando />}>
        <LoginView
          errorInicial={paramsUrl.googleError}
          googleNoRegistrado={paramsUrl.googleNoRegistrado}
          alIrARegistro={() => setRuta("registro")}
          alIrARecuperar={() => setRuta("recuperar")}
          alIrAVerificar={(tok, em) => {
            setParamsUrl({ token: tok || "", email: em || "", googleError: "", googleNoRegistrado: false });
            setRuta("verificar");
          }}
          alIrALanding={() => setRuta("landing")}
          alIniciarExito={() => setRuta("app")}
        />
      </Suspense>
    );
  }

  if (ruta === "registro") {
    return (
      <Suspense fallback={<VistaCargando />}>
        <RegistroView
          errorInicial={paramsUrl.googleError}
          alIrALogin={() => setRuta("login")}
          alIrAVerificar={(tok, em) => {
            setParamsUrl({ token: tok || "", email: em || "", googleError: "" });
            setRuta("verificar");
          }}
          alIrALanding={() => setRuta("landing")}
          alRegistroExito={() => setRuta("app")}
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
          alIrALogin={() => setRuta("login")}
          alIrALanding={() => setRuta("landing")}
          alVerificacionExitosa={() => setRuta("app")}
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
          alIrALogin={() => setRuta("login")}
          alIrALanding={() => setRuta("landing")}
          alRestablecerExito={() => setRuta("login")}
        />
      </Suspense>
    );
  }

  // Renderizar Aplicación Privada Protegida
  return (
    <ProtectedRoute alIrALogin={() => setRuta("login")}>
      <Suspense fallback={<VistaCargando />}>
        <PrivateLayout
          vistaActiva={subVistaApp}
          alCambiarVista={(nuevaSubVista) => setSubVistaApp(nuevaSubVista)}
          tituloVista={titulosVistas[subVistaApp] || "Panel General"}
          alIrALanding={() => setRuta("landing")}
        >
          <Suspense fallback={<VistaCargando />}>
            {subVistaApp === "permisos" && (
              <ProtectedRoute rolesPermitidos={["dueno"]} alIrALogin={() => setRuta("login")}>
                <GestionUsuariosView />
              </ProtectedRoute>
            )}

            {subVistaApp === "ganado" && <GanadoView />}
            {subVistaApp === "parcelas" && <ParcelasView />}
            {subVistaApp === "partes" && <PartesView />}
            {subVistaApp === "sanidad" && <SanidadView />}
            {subVistaApp === "insumos" && <InsumosView />}
            {subVistaApp === "reportes" && <ReportesView />}

            {subVistaApp === "metricas" && (
              <DashboardView
                alCambiarVista={(nuevaSubVista) => setSubVistaApp(nuevaSubVista)}
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
