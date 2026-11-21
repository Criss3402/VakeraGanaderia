import { useState } from "react";
import NavbarLanding from "./NavbarLanding";
import Hero from "./Hero";
import QuienesSomos from "./QuienesSomos";
import Servicios from "./Servicios";
import Faq from "./Faq";
import Contacto from "./Contacto";
import FooterLanding from "./FooterLanding";
import AuthModal from "./AuthModal";

export default function LandingView({
  alIniciarSesion,
  alRegistrarse,
  alIrARecuperar,
  alIrAVerificar,
  alIrAlDashboard,
  googleSetup = null,
  googleNoRegistrado = false,
  googleError = "",
}) {
  const [modalAuth, setModalAuth] = useState(() =>
    googleSetup?.setupToken
      ? { abierto: true, modo: "google-completar" }
      : googleNoRegistrado
      ? { abierto: true, modo: "google-no-registrado" }
      : { abierto: false, modo: "login" }
  );

  function abrirModal(modo = "login") {
    setModalAuth({ abierto: true, modo });
  }

  return (
    <div className="landing-view">
      <NavbarLanding
        alIniciarSesion={() => abrirModal("login")}
        alRegistrarse={() => abrirModal("registro")}
        alIrARecuperar={alIrARecuperar}
        alIrAVerificar={alIrAVerificar}
        alIrAlDashboard={alIrAlDashboard}
      />
      <main>
        <Hero alIniciarSesion={() => abrirModal("login")} />
        <QuienesSomos />
        <Servicios />
        <Faq />
        <Contacto />
      </main>
      <FooterLanding alIniciarSesion={() => abrirModal("login")} />

      <AuthModal
        abierto={modalAuth.abierto}
        modoInicial={modalAuth.modo}
        googleSetup={googleSetup}
        errorInicial={modalAuth.modo === "google-no-registrado" ? googleError : ""}
        alCerrar={() => setModalAuth((prev) => ({ ...prev, abierto: false }))}
        alIrARecuperar={alIrARecuperar}
        alIrAVerificar={alIrAVerificar}
        alExito={alIrAlDashboard}
      />
    </div>
  );
}
