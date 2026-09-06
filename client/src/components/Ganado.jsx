const RAZAS = [
  {
    nombre: "Angus",
    origen: "Escocia",
    detalle: "Carne marmolada de alta calidad, buena adaptación al pastoreo.",
  },
  {
    nombre: "Hereford",
    origen: "Inglaterra",
    detalle: "Rusticidad y fertilidad, ideal para sistemas a campo abierto.",
  },
  {
    nombre: "Brangus",
    origen: "Cruza Angus x Brahman",
    detalle: "Resistencia al calor combinada con buena terminación.",
  },
];

export default function Ganado() {
  return (
    <section id="ganado" className="ganado">
      <div className="contenedor">
        <p className="etiqueta">Nuestro ganado</p>
        <h2 className="titulo-seccion">Razas que elegimos y por qué</h2>
        <p className="ganado__intro">
          Seleccionamos genética en función del clima, el pasto disponible y
          el destino final de cada animal, priorizando siempre su bienestar.
        </p>

        <div className="ganado__grid">
          {RAZAS.map((raza) => (
            <article key={raza.nombre} className="ganado__tarjeta">
              <h3>{raza.nombre}</h3>
              <span className="ganado__origen">{raza.origen}</span>
              <p>{raza.detalle}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
