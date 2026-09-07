import { useState } from "react";

const PREGUNTAS_FRECUENTES = [
  {
    id: 1,
    categoria: "Conectividad",
    pregunta: "¿Puedo utilizar Vakera en el campo si no tengo señal de celular ni internet?",
    respuesta:
      "Sí, totalmente. La aplicación cuenta con modo offline automático. Puedes cargar pesajes, caravanas, tratamientos sanitarios y movimientos de lote directamente en la manga o en el potrero. En cuanto el dispositivo recupera señal de red o Wi-Fi, todos los datos se sincronizan automáticamente con la nube sin pérdida de información.",
  },
  {
    id: 2,
    categoria: "Migración de datos",
    pregunta: "¿Cómo migro la información que hoy tengo en planillas de Excel o cuadernos?",
    respuesta:
      "Vakera dispone de un asistente inteligente de importación. Puedes subir tus planillas de Excel (.xlsx o .csv) con tu listado de existencias, pesos anteriores y fechas de nacimiento. El sistema mapea automáticamente las columnas y te permite revisar los datos antes de guardarlos definitivamente.",
  },
  {
    id: 3,
    categoria: "Dispositivos y Chips",
    pregunta: "¿Es compatible con caravanas electrónicas (RFID) y balanzas digitales?",
    respuesta:
      "Sí. El sistema es compatible con lectores de caravanas electrónicas Bluetooth/USB (bastones lectores de las principales marcas del mercado) e integración con cabezales de balanza para capturar el peso de forma instantánea al pasar el animal por la manga.",
  },
  {
    id: 4,
    categoria: "Usuarios y Equipos",
    pregunta: "¿Cuántas personas de mi equipo pueden acceder a la misma cuenta?",
    respuesta:
      "Puedes crear cuentas individuales para todo tu equipo de trabajo: administradores, veterinarios, ingenieros agrónomos y personal de campo. Cada usuario tiene permisos a medida para que solo vea y edite lo correspondiente a su labor, protegiendo la seguridad y trazabilidad de los cambios.",
  },
  {
    id: 5,
    categoria: "Reportes Oficiales",
    pregunta: "¿Puedo generar informes oficiales para SENASA o declaraciones de existencias?",
    respuesta:
      "Sí. Podrás exportar resúmenes de existencias por categoría, balance de ingresos/egresos, historial de vacunaciones y libros sanitarios en formatos PDF y Excel listos para presentar ante auditorías, entidades bancarias o autoridades sanitarias.",
  },
  {
    id: 6,
    categoria: "Soporte",
    pregunta: "¿Ofrecen capacitación o ayuda técnica durante la puesta en marcha?",
    respuesta:
      "Por supuesto. Nuestro equipo de soporte especializado en el sector ganadero te acompaña desde el primer día: te ayudamos a configurar tu campo, cargar tus lotes iniciales y capacitar a tu personal de campo de forma remota o presencial según el plan.",
  },
];

export default function Faq() {
  const [abierta, setAbierta] = useState(1);

  const togglePregunta = (id) => {
    setAbierta((actual) => (actual === id ? null : id));
  };

  return (
    <section id="faq" className="faq">
      <div className="contenedor">
        <div className="faq__cabecera">
          <p className="etiqueta">Preguntas Frecuentes</p>
          <h2 className="titulo-seccion">Respuestas claras para tu campo</h2>
          <p className="faq__intro">
            Resolvemos las dudas más habituales sobre el funcionamiento, conectividad,
            compatibilidad y seguridad de Vakera.
          </p>
        </div>

        <div className="faq__lista">
          {PREGUNTAS_FRECUENTES.map((item) => {
            const estaAbierta = abierta === item.id;
            return (
              <article
                key={item.id}
                className={`faq-item ${estaAbierta ? "faq-item--abierto" : ""}`}
              >
                <button
                  type="button"
                  className="faq-item__boton"
                  onClick={() => togglePregunta(item.id)}
                  aria-expanded={estaAbierta}
                  aria-controls={`faq-resp-${item.id}`}
                >
                  <div className="faq-item__titulo-grupo">
                    <span className="faq-item__categoria">{item.categoria}</span>
                    <h3 className="faq-item__pregunta">{item.pregunta}</h3>
                  </div>
                  <span className="faq-item__icono" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>

                <div
                  id={`faq-resp-${item.id}`}
                  className="faq-item__contenido"
                  hidden={!estaAbierta}
                >
                  <p className="faq-item__respuesta">{item.respuesta}</p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="faq__contacto-cta">
          <div className="faq__contacto-texto">
            <h4>¿Tenés alguna otra consulta sobre tu establecimiento?</h4>
            <p>
              Escribinos directamente a través del formulario o por nuestros canales de
              atención y te asesoramos sin compromiso.
            </p>
          </div>
          <a href="#contacto" className="boton boton--relleno">
            Contactar al equipo
          </a>
        </div>
      </div>
    </section>
  );
}
