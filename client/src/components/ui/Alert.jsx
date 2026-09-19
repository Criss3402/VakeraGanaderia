export default function Alert({
  children,
  tipo = "info", // info | exito | advertencia | error
  titulo = null,
  alCerrar = null,
  className = "",
}) {
  return (
    <div
      role="alert"
      className={`alerta-ui alerta-ui--${tipo} ${className}`.trim()}
    >
      <div className="alerta-ui__icono">
        {tipo === "exito" && "✓"}
        {tipo === "advertencia" && "⚠"}
        {tipo === "error" && "✕"}
        {tipo === "info" && "ℹ"}
      </div>
      <div className="alerta-ui__contenido">
        {titulo && <h4 className="alerta-ui__titulo">{titulo}</h4>}
        <div className="alerta-ui__texto">{children}</div>
      </div>
      {alCerrar && (
        <button
          type="button"
          onClick={alCerrar}
          className="alerta-ui__cerrar"
          aria-label="Cerrar alerta"
        >
          ×
        </button>
      )}
    </div>
  );
}
