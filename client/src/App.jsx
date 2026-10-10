import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import LandingView from "./views/1_inicio_presentacion/LandingView.jsx";
import LoginView from "./views/2_login_registro/LoginView.jsx";
import RegistroView from "./views/2_login_registro/RegistroView.jsx";
import RecuperarPasswordView from "./views/2_login_registro/RecuperarPasswordView.jsx";
import DashboardView from "./views/3_dashboard/DashboardView.jsx";
import GanadoView from "./views/3_dashboard/modulos/GanadoView.jsx";
import PartesView from "./views/3_dashboard/modulos/PartesView.jsx";
import SanidadView from "./views/3_dashboard/modulos/SanidadView.jsx";
import InsumosView from "./views/3_dashboard/modulos/InsumosView.jsx";
import ReportesView from "./views/3_dashboard/modulos/ReportesView.jsx";
import GestionUsuariosView from "./views/4_permisos/GestionUsuariosView.jsx";
import ProtectedRoute from "./views/4_permisos/ProtectedRoute.jsx";
import PrivateLayout from "./components/layout/PrivateLayout.jsx";

function AppContenido() {
  const { estaAutenticado, rol } = useAuth();
  // Vistas principales: 'landing' | 'login' | 'registro' | 'recuperar' | 'app'
  const [ruta, setRuta] = useState("landing");
  // Sub-vista dentro de la app privada: 'metricas' | 'ganado' | 'partes' | 'sanidad' | 'insumos' | 'reportes' | 'permisos'
  const [subVistaApp, setSubVistaApp] = useState("metricas");

  // Si el usuario se autentica mientras está en login/registro, enviarlo al dashboard
  useEffect(() => {
    if (estaAutenticado && (ruta === "login" || ruta === "registro")) {
      setRuta("app");
    }
  }, [estaAutenticado, ruta]);

  const titulosVistas = {
    metricas: "Panel de Control Ganadero",
    ganado: "Gestión de Rodeo y Potreros",
    partes: "Partes Diarios de Novedades de Campo",
    sanidad: "Calendario y Tratamientos Sanitarios",
    insumos: "Control de Insumos y Stock Crítico",
    reportes: "Reportes Contables y Auditoría",
    permisos: "Administración de Roles y Permisos (RBAC)",
  };

  // Renderizar Vistas Públicas
  if (ruta === "landing") {
    return (
      <LandingView
        alIniciarSesion={() => setRuta("login")}
        alRegistrarse={() => setRuta("registro")}
        alIrAlDashboard={() => setRuta("app")}
      />
    );
  }

  if (ruta === "login") {
    return (
      <LoginView
        alIrARegistro={() => setRuta("registro")}
        alIrARecuperar={() => setRuta("recuperar")}
        alIrALanding={() => setRuta("landing")}
        alIniciarExito={() => setRuta("app")}
      />
    );
  }

  if (ruta === "registro") {
    return (
      <RegistroView
        alIrALogin={() => setRuta("login")}
        alIrALanding={() => setRuta("landing")}
        alRegistroExito={() => setRuta("app")}
      />
    );
  }

  if (ruta === "recuperar") {
    return (
      <RecuperarPasswordView
        alIrALogin={() => setRuta("login")}
        alIrALanding={() => setRuta("landing")}
      />
    );
  }

  // Renderizar Aplicación Privada Protegida
  return (
    <ProtectedRoute alIrALogin={() => setRuta("login")}>
      <PrivateLayout
        vistaActiva={subVistaApp}
        alCambiarVista={(nuevaSubVista) => setSubVistaApp(nuevaSubVista)}
        tituloVista={titulosVistas[subVistaApp] || "Panel General"}
        alIrALanding={() => setRuta("landing")}
      >
        {subVistaApp === "permisos" && (
          <ProtectedRoute rolesPermitidos={["dueno"]} alIrALogin={() => setRuta("login")}>
            <GestionUsuariosView />
          </ProtectedRoute>
        )}

        {subVistaApp === "ganado" && <GanadoView />}
        {subVistaApp === "partes" && <PartesView />}
        {subVistaApp === "sanidad" && <SanidadView />}
        {subVistaApp === "insumos" && <InsumosView />}
        {subVistaApp === "reportes" && <ReportesView />}

        {subVistaApp === "metricas" && (
          <DashboardView
            alCambiarVista={(nuevaSubVista) => setSubVistaApp(nuevaSubVista)}
          />
        )}
      </PrivateLayout>
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
