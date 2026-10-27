export default function Hero({ alIniciarSesion }) {
  return (
    <section id="inicio" className="hero">
      <picture>
        <source srcSet="/hero-bg.webp" type="image/webp" />
        <img
          src="/hero-bg.jpg"
          alt="Entorno ganadero Vakera"
          className="hero__fondo-img"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      <div className="hero__velo" aria-hidden="true" />

      <div className="hero__contenido contenedor">
        <p className="hero__eyebrow">Plataforma de gestión ganadera</p>
        <h1 className="hero__titulo">
          Control inteligente
          <br />de tu entorno ganadero
        </h1>
        <p className="hero__subtitulo">
          Gestiona tu ganado, registros sanitarios, pesajes y a tu equipo de trabajo
          mediante cuentas seguras y colaborativas desde cualquier lugar.
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "8px" }}>
          <a href="#nosotros" className="boton boton--relleno boton--grande">
            Descubre la plataforma
          </a>
          {alIniciarSesion && (
            <button
              type="button"
              onClick={alIniciarSesion}
              className="boton boton--fantasma boton--grande"
              style={{ color: "#fff", borderColor: "rgba(255,255,255,0.4)" }}
            >
              Acceder al Sistema
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
