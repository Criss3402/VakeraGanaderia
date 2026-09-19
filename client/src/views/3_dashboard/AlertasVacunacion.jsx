import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";

export default function AlertasVacunacion({ alertas = [], cargando = false }) {
  return (
    <Card
      titulo="Calendario Sanitario y Vacunaciones"
      subtitulo="Monitoreo de tratamientos y campañas sanitarias oficiales"
      destacada
    >
      {cargando ? (
        <p className="texto-muted">Cargando calendario sanitario...</p>
      ) : alertas.length === 0 ? (
        <p className="texto-muted">No hay eventos sanitarios programados.</p>
      ) : (
        <div className="lista-sanitaria">
          {alertas.map((item) => {
            const esUrgente = item.prioridad === "Urgente";
            const esAlta = item.prioridad === "Alta";

            return (
              <div
                key={item.id}
                className={`item-sanitario ${
                  esUrgente
                    ? "item-sanitario--urgente"
                    : esAlta
                    ? "item-sanitario--alta"
                    : ""
                }`}
              >
                <div className="item-sanitario__icono">
                  {esUrgente ? "🚨" : esAlta ? "⚠️" : "🩺"}
                </div>
                <div className="item-sanitario__info">
                  <div className="item-sanitario__cabecera">
                    <h4 className="item-sanitario__evento">{item.evento}</h4>
                    <Badge
                      variante={
                        item.estado === "Completado"
                          ? "exito"
                          : esUrgente
                          ? "peligro"
                          : "alerta"
                      }
                      tamano="sm"
                    >
                      {item.estado}
                    </Badge>
                  </div>
                  <p className="item-sanitario__detalle">
                    <span>Lote: <strong>{item.lote}</strong></span> •{" "}
                    <span>Fecha: <strong>{item.fechaProgramada}</strong></span> •{" "}
                    <span>Responsable: <strong>{item.responsable}</strong></span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
