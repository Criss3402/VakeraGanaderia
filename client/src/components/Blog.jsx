const ENTRADAS = [
  {
    fecha: "12 ago 2026",
    titulo: "Cómo la rotación de pasturas mejora el rinde por hectárea",
  },
  {
    fecha: "3 jul 2026",
    titulo: "Trazabilidad digital: qué exigen hoy los mercados internacionales",
  },
  {
    fecha: "19 jun 2026",
    titulo: "Bienestar animal: prácticas simples con gran impacto",
  },
];

export default function Blog() {
  return (
    <section id="blog" className="blog">
      <div className="contenedor">
        <p className="etiqueta">Blog</p>
        <h2 className="titulo-seccion">Novedades del campo</h2>

        <div className="blog__lista">
          {ENTRADAS.map((entrada) => (
            <article key={entrada.titulo} className="blog__entrada">
              <time>{entrada.fecha}</time>
              <h3>{entrada.titulo}</h3>
              <span className="blog__leer">Leer más →</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
