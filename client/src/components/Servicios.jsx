import { useEffect, useState } from "react";
import { obtenerServicios } from "../api/client.js";
import { ICONOS_SERVICIOS } from "./Icons.jsx";

export default function Servicios() {
  const [servicios, setServicios] = useState([]);
  const [estado, setEstado] = useState("cargando"); // cargando | listo | error

  useEffect(() => {
    let activo = true;

    obtenerServicios()
      .then((data) => {
        if (!activo) return;
        setServicios(data);
        setEstado("listo");
      })
      .catch(() => {
        if (!activo) return;
        setEstado("error");
      });

    return () => {
      activo = false;
    };
  }, []);

  return (
    <section id="servicios" className="servicios">
      <div className="contenedor">
        <p className="etiqueta etiqueta--clara">Servicios</p>
        <h2 className="titulo-seccion titulo-seccion--claro">
          Todo lo que el ganado necesita, en un mismo lugar
        </h2>

        {estado === "error" && (
          <p className="servicios__aviso">
            No pudimos cargar los servicios en este momento. Verificá que el
            servidor de la API esté en ejecución (ver README).
          </p>
        )}

        <div className="servicios__grid">
          {(estado === "cargando" ? Array.from({ length: 4 }) : servicios).map(
            (servicio, i) => {
              if (!servicio) {
                return <div key={i} className="servicios__item servicios__item--placeholder" />;
              }
              const Icono = ICONOS_SERVICIOS[servicio.icono];
              return (
                <div key={servicio.id} className="servicios__item">
                  <div className="servicios__icono">
                    {Icono && <Icono aria-hidden="true" />}
                  </div>
                  <h3>{servicio.titulo}</h3>
                  <p>{servicio.descripcion}</p>
                </div>
              );
            }
          )}
        </div>
      </div>
    </section>
  );
}
