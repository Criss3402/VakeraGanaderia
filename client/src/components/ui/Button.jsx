export default function Button({
  children,
  tipo = "button",
  variante = "relleno", // relleno | contorno | fantasma | peligro | exito
  tamano = "md", // sm | md | lg
  deshabilitado = false,
  cargando = false,
  icono: Icono = null,
  onClick,
  className = "",
  ...props
}) {
  const claseVariante = `boton--${variante}`;
  const claseTamano = tamano !== "md" ? `boton--${tamano}` : "";

  return (
    <button
      type={tipo}
      disabled={deshabilitado || cargando}
      onClick={onClick}
      className={`boton ${claseVariante} ${claseTamano} ${className}`.trim()}
      {...props}
    >
      {cargando ? (
        <span className="spinner-icono" aria-hidden="true" />
      ) : Icono ? (
        <Icono className="boton__icono" aria-hidden="true" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
