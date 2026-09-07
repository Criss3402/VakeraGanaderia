export default function Footer() {
  return (
    <footer className="footer">
      <div className="contenedor footer__grid">
        <div className="footer__marca">
          <img
            src="/logo-vakera.png"
            alt="Vakera"
            className="footer__logo-img"
          />
          <p>Plataforma de gestión ganadera inteligente.</p>
        </div>

        <div>
          <h4>Navegación</h4>
          <a href="#inicio">Inicio</a>
          <a href="#nosotros">Nosotros</a>
          <a href="#servicios">Servicios</a>
          <a href="#faq">Preguntas</a>
        </div>

        <div>
          <h4>Contacto</h4>
          <a href="mailto:contacto@vakera.com">
            contacto@vakera.com
          </a>
          <a href="tel:+5490000000">+54 9 000 000 000</a>
        </div>
      </div>

      <p className="footer__copy">
        © {new Date().getFullYear()} Vakera. Todos los derechos reservados.
      </p>
    </footer>
  );
}
