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
  const { estaAutenticado } = useAuth();
  // Vistas principales: 'landing' | 'login' | 'registro' | 'recuperar' | 'verificar' | 'app'
  const [ruta, setRuta] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("ruta");
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
    };
  });

  // Sub-vista dentro de la app privada: 'metricas' | 'ganado' | 'partes' | 'sanidad' | 'insumos' | 'reportes' | 'permisos'
  const [subVistaApp, setSubVistaApp] = useState("metricas");

  // Si el usuario se autentica mientras está en login/registro, enviarlo al dashboard
  useEffect(() => {
    if (estaAutenticado && (ruta === "login" || ruta === "registro" || ruta === "verificar")) {
      setRuta("app");
    }
  }, [estaAutenticado, ruta]);

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
          alIrARegistro={() => setRuta("registro")}
          alIrARecuperar={() => setRuta("recuperar")}
          alIrAVerificar={(tok, em) => {
            setParamsUrl({ token: tok || "", email: em || "" });
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
          alIrALogin={() => setRuta("login")}
          alIrAVerificar={(tok, em) => {
            setParamsUrl({ token: tok || "", email: em || "" });
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
