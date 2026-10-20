import { useState } from "react";
import NavbarLanding from "./NavbarLanding";
import Hero from "./Hero";
import QuienesSomos from "./QuienesSomos";
import Servicios from "./Servicios";
import Faq from "./Faq";
import Contacto from "./Contacto";
import FooterLanding from "./FooterLanding";

export default function LandingView({
  alIniciarSesion,
  alRegistrarse,
  alIrARecuperar,
  alIrAVerificar,
  alIrAlDashboard,
}) {
  const [loginAbierto, setLoginAbierto] = useState(false);

  function abrirLogin() {
    setLoginAbierto(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="landing-view">
      <NavbarLanding
        alIniciarSesion={abrirLogin}
        alRegistrarse={alRegistrarse}
        alIrARecuperar={alIrARecuperar}
        alIrAVerificar={alIrAVerificar}
        alIrAlDashboard={alIrAlDashboard}
        loginAbierto={loginAbierto}
        setLoginAbierto={setLoginAbierto}
      />
      <main>
        <Hero alIniciarSesion={abrirLogin} />
        <QuienesSomos />
        <Servicios />
        <Faq />
        <Contacto />
      </main>
      <FooterLanding alIniciarSesion={abrirLogin} />
    </div>
  );
}
