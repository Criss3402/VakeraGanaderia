export default function FooterLanding({ alIniciarSesion }) {
  return (
    <footer className="footer">
      <div className="contenedor footer__grid">
        <div className="footer__marca">
          <img
            src="/logo-vakera.png"
            alt="Vakera"
            className="footer__logo-img"
          />
          <p>Plataforma de gestión ganadera inteligente y colaborativa.</p>
        </div>

        <div>
          <h4>Navegación</h4>
          <a href="#inicio">Inicio</a>
          <a href="#nosotros">Nosotros</a>
          <a href="#servicios">Servicios</a>
          <a href="#faq">Preguntas</a>
        </div>

        <div>
          <h4>Acceso</h4>
          {alIniciarSesion ? (
            <button
              type="button"
              onClick={alIniciarSesion}
              style={{
                background: "none",
                border: "none",
                color: "var(--texto-suave)",
                padding: 0,
                textAlign: "left",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              Iniciar Sesión / Panel
            </button>
          ) : (
            <a href="#inicio">Portal Web</a>
          )}
          <a href="mailto:contacto@vakera.com">contacto@vakera.com</a>
        </div>
      </div>

      <p className="footer__copy">
        © {new Date().getFullYear()} Vakera Ganadería. Todos los derechos reservados.
      </p>
    </footer>
  );
}
