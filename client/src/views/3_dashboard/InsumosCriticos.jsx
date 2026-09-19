import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";

export default function InsumosCriticos({ insumos = [], cargando = false }) {
  return (
    <Card
      titulo="Inventario e Insumos Críticos"
      subtitulo="Control de stock en botiquín y galpón con alertas de reposición"
    >
      {cargando ? (
        <p className="texto-muted">Cargando inventario...</p>
      ) : insumos.length === 0 ? (
        <p className="texto-muted">No hay insumos registrados.</p>
      ) : (
        <div className="tabla-responsive">
          <table className="tabla-vakera">
            <thead>
              <tr>
                <th>Insumo / Fármaco</th>
                <th>Categoría</th>
                <th>Stock Actual</th>
                <th>Mínimo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {insumos.map((ins) => {
                const esCritico = ins.requiereReposicion || ins.stockActual <= ins.stockMinimo;
                return (
                  <tr key={ins.id} className={esCritico ? "fila--critica" : ""}>
                    <td>
                      <strong>{ins.nombre}</strong>
                      <span className="tabla-subtexto">{ins.ubicacion}</span>
                    </td>
                    <td>{ins.categoria}</td>
                    <td>
                      <span className={`stock-valor ${esCritico ? "stock-valor--bajo" : ""}`}>
                        {ins.stockActual} {ins.unidad}
                      </span>
                    </td>
                    <td>
                      {ins.stockMinimo} {ins.unidad}
                    </td>
                    <td>
                      <Badge variante={esCritico ? "peligro" : "exito"} tamano="sm">
                        {esCritico ? "Reponer Urgente" : "Abastecido"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
