export default function Card({
  children,
  titulo = null,
  subtitulo = null,
  accion = null,
  className = "",
  destacada = false,
  ...props
}) {
  return (
    <div
      className={`tarjeta-ui ${destacada ? "tarjeta-ui--destacada" : ""} ${className}`.trim()}
      {...props}
    >
      {(titulo || subtitulo || accion) && (
        <div className="tarjeta-ui__header">
          <div>
            {titulo && <h3 className="tarjeta-ui__titulo">{titulo}</h3>}
            {subtitulo && <p className="tarjeta-ui__subtitulo">{subtitulo}</p>}
          </div>
          {accion && <div className="tarjeta-ui__accion">{accion}</div>}
        </div>
      )}
      <div className="tarjeta-ui__cuerpo">{children}</div>
    </div>
  );
}
