import { IconoCheck } from "./Icons.jsx";

const PILARES = [
  {
    titulo: "Cuentas y roles para tu equipo",
    texto: "Permisos personalizados para administradores, veterinarios y personal de campo.",
  },
  {
    titulo: "Control centralizado del ganado",
    texto: "Registra pesajes, historial sanitario, movimientos y lotes en tiempo real.",
  },
  {
    titulo: "Accesible desde cualquier dispositivo",
    texto: "Gestiona tu campo desde el celular, tablet o computadora, sin complicaciones.",
  },
  {
    titulo: "Decisiones con respaldo",
    texto: "Información organizada y al día para maximizar la eficiencia y rentabilidad.",
  },
];

export default function QuienesSomos() {
  return (
    <section id="nosotros" className="nosotros">
      <div className="contenedor nosotros__grid">
        <div>
          <p className="etiqueta">Quiénes somos</p>
          <h2 className="titulo-seccion">
            Gestión inteligente de tu entorno ganadero
          </h2>
          <p className="nosotros__texto">
            En Vakera digitalizamos y simplificamos el día a día en el campo. 
            Nuestra plataforma te permite administrar cada aspecto productivo 
            mediante cuentas de usuario seguras y colaborativas, conectando a 
            todo tu equipo en un único entorno de trabajo.
          </p>

          <ul className="nosotros__lista">
            {PILARES.map((pilar) => (
              <li key={pilar.titulo}>
                <IconoCheck className="nosotros__check" aria-hidden="true" />
                <span>
                  <strong>{pilar.titulo}</strong>: {pilar.texto}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="nosotros__cuentas-card">
          <div className="cuentas-card__badge">Plataforma Vakera</div>
          <h3 className="cuentas-card__titulo">Gestión por Cuentas</h3>
          <p className="cuentas-card__desc">
            Cada integrante de tu establecimiento accede con su propio perfil y herramientas adaptadas a su labor:
          </p>

          <div className="cuentas-card__roles">
            <div className="cuentas-card__rol">
              <span className="cuentas-card__rol-tag">Administrador</span>
              <p>Visión integral del establecimiento, balance del ganado y asignación de permisos.</p>
            </div>
            <div className="cuentas-card__rol">
              <span className="cuentas-card__rol-tag">Veterinario</span>
              <p>Carga de planes sanitarios, vacunaciones, tratamientos y seguimiento reproductivo.</p>
            </div>
            <div className="cuentas-card__rol">
              <span className="cuentas-card__rol-tag">Personal de Campo</span>
              <p>Registro ágil de pesajes, rotación entre potreros y novedades operativas directas.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
