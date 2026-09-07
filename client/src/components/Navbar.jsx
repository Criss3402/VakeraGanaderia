import { useEffect, useState } from "react";

const ENLACES = [
  { href: "#inicio", label: "Inicio" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#servicios", label: "Servicios" },
  { href: "#faq", label: "Preguntas" },
  { href: "#contacto", label: "Contacto" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          <button type="button" className="boton boton--fantasma">
            Iniciar sesión
          </button>
          <button type="button" className="boton boton--relleno">
            Registrarse
          </button>
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
