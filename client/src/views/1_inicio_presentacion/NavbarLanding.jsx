import { useEffect, useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import LoginDropdown from "./LoginDropdown";

const ENLACES = [
  { href: "#inicio", label: "Inicio" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#servicios", label: "Servicios" },
  { href: "#faq", label: "Preguntas" },
  { href: "#contacto", label: "Contacto" },
];

export default function NavbarLanding({
  alIniciarSesion,
  alRegistrarse,
  alIrAlDashboard,
  alIrARecuperar,
  alIrAVerificar,
  loginAbierto,
  setLoginAbierto,
}) {
  const { estaAutenticado, usuario, rol } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [loginAbiertoInterno, setLoginAbiertoInterno] = useState(false);
  const loginRef = useRef(null);

  const esLoginAbierto = loginAbierto !== undefined ? loginAbierto : loginAbiertoInterno;
  const cambiarLoginAbierto = setLoginAbierto || setLoginAbiertoInterno;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function handleClickAfuera(e) {
      if (loginRef.current && !loginRef.current.contains(e.target)) {
        cambiarLoginAbierto(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        cambiarLoginAbierto(false);
      }
    }
    if (esLoginAbierto) {
      document.addEventListener("mousedown", handleClickAfuera);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickAfuera);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [esLoginAbierto, cambiarLoginAbierto]);

  return (
    <header className={`navbar ${scrolled ? "navbar--scrolled" : ""}`}>
      <div className="navbar__contenido">
        <a href="#inicio" className="navbar__marca" aria-label="Vakera Inicio">
          <img
            src="/logo-vakera.png"
            alt="Vakera"
            className="navbar__logo-img"
          />
        </a>

        <nav className={`navbar__enlaces ${menuAbierto ? "navbar__enlaces--abierto" : ""}`}>
          {ENLACES.map((enlace) => (
            <a key={enlace.href} href={enlace.href} onClick={() => setMenuAbierto(false)}>
              {enlace.label}
            </a>
          ))}
        </nav>

        <div className="navbar__acciones">
          {estaAutenticado ? (
            <button
              type="button"
              className="boton boton--relleno"
              onClick={alIrAlDashboard}
            >
              Panel de Control ({usuario?.nombre || usuario?.email || rol?.toUpperCase()})
            </button>
          ) : (
            <>
              <div className="navbar__login-wrapper" ref={loginRef}>
                <button
                  type="button"
                  className={`boton ${esLoginAbierto ? "boton--relleno" : "boton--fantasma"}`}
                  onClick={() => cambiarLoginAbierto(!esLoginAbierto)}
                  aria-expanded={esLoginAbierto}
                  aria-haspopup="dialog"
                >
                  Iniciar sesión
                </button>

                {esLoginAbierto && (
                  <LoginDropdown
                    alIrARegistro={() => {
                      cambiarLoginAbierto(false);
                      alRegistrarse();
                    }}
                    alIrARecuperar={() => {
                      cambiarLoginAbierto(false);
                      if (alIrARecuperar) alIrARecuperar();
                    }}
                    alIrAVerificar={(t, em) => {
                      cambiarLoginAbierto(false);
                      if (alIrAVerificar) alIrAVerificar(t, em);
                    }}
                    alIniciarExito={alIrAlDashboard}
                    alCerrar={() => cambiarLoginAbierto(false)}
                  />
                )}
              </div>

              <button
                type="button"
                className="boton boton--relleno"
                onClick={() => {
                  cambiarLoginAbierto(false);
                  alRegistrarse();
                }}
              >
                Registrarse
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          className="navbar__hamburguesa"
          aria-label="Abrir menú"
          aria-expanded={menuAbierto}
          onClick={() => setMenuAbierto((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
