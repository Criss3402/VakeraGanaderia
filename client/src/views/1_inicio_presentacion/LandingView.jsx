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
  alIrAlDashboard,
}) {
  return (
    <div className="landing-view">
      <NavbarLanding
        alIniciarSesion={alIniciarSesion}
        alRegistrarse={alRegistrarse}
        alIrAlDashboard={alIrAlDashboard}
      />
      <main>
        <Hero alIniciarSesion={alIniciarSesion} />
        <QuienesSomos />
        <Servicios />
        <Faq />
        <Contacto />
      </main>
      <FooterLanding alIniciarSesion={alIniciarSesion} />
    </div>
  );
}
