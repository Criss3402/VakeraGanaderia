import { useEffect, useState } from "react";
import { obtenerServicios } from "../../api/presentacion.api.js";
import { ICONOS_SERVICIOS } from "../../components/Icons.jsx";

export default function Servicios() {
  const [servicios, setServicios] = useState([]);
  const [estado, setEstado] = useState("cargando"); // cargando | listo | error

  useEffect(() => {
    let activo = true;

    obtenerServicios()
      .then((res) => {
        if (!activo) return;
        const lista = Array.isArray(res) ? res : (res?.data || []);
        setServicios(lista);
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

  const listaServicios = Array.isArray(servicios) ? servicios : (servicios?.data || []);

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
            servidor de la API esté en ejecución.
          </p>
        )}

        <div className="servicios__grid">
          {(estado === "cargando" ? Array.from({ length: 4 }) : listaServicios).map(
            (servicio, i) => {
              if (!servicio) {
                return <div key={i} className="servicios__item servicios__item--placeholder" />;
              }
              const Icono = ICONOS_SERVICIOS[servicio.icono];
              return (
                <div key={servicio.id || i} className="servicios__item">
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
