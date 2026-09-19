import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";

export default function MetricCards({ metricas, cargando }) {
  if (cargando) {
    return (
      <div className="kpi-grid">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="kpi-card kpi-card--placeholder" />
        ))}
      </div>
    );
  }

  const resumen = metricas?.resumenGanado || {};
  const categorias = resumen.porCategoria || {};

  return (
    <div className="kpi-grid">
      <div className="kpi-card kpi-card--principal">
        <div className="kpi-card__icono">🐂</div>
        <div className="kpi-card__info">
          <p className="kpi-card__etiqueta">Total Cabezas Registradas</p>
          <p className="kpi-card__valor">{resumen.totalCabezas || 0}</p>
          <div className="kpi-card__chips">
            {Object.entries(categorias).map(([cat, cant]) => (
              <span key={cat} className="kpi-chip">
                {cat}: <strong>{cant}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-card__icono">⚖️</div>
        <div className="kpi-card__info">
          <p className="kpi-card__etiqueta">Peso Promedio del Rodeo</p>
          <p className="kpi-card__valor">
            {resumen.pesoPromedioKg || 0} <span className="kpi-card__unidad">kg</span>
          </p>
          <p className="kpi-card__detalle">Mortalidad mensual: <strong>{resumen.tasaMortalidadMensual || "0%"}</strong></p>
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-card__icono">💉</div>
        <div className="kpi-card__info">
          <p className="kpi-card__etiqueta">Alertas Sanitarias</p>
          <p className="kpi-card__valor">{metricas?.alertasSanitariasCount || 0}</p>
          <Badge variante={metricas?.alertasSanitariasCount > 0 ? "alerta" : "exito"} tamano="sm">
            {metricas?.alertasSanitariasCount > 0 ? "Requiere atención médica" : "Al día"}
          </Badge>
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-card__icono">📦</div>
        <div className="kpi-card__info">
          <p className="kpi-card__etiqueta">Insumos Críticos</p>
          <p className="kpi-card__valor">{metricas?.insumosCriticosCount || 0}</p>
          <Badge variante={metricas?.insumosCriticosCount > 0 ? "peligro" : "exito"} tamano="sm">
            {metricas?.insumosCriticosCount > 0 ? "Bajo stock mínimo" : "Stock óptimo"}
          </Badge>
        </div>
      </div>
    </div>
  );
}
