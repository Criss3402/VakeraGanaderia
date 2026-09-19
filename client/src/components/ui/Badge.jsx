export default function Badge({
  children,
  variante = "neutral", // exito | alerta | peligro | info | neutral | rol
  tamano = "md", // sm | md
  className = "",
}) {
  return (
    <span
      className={`badge-ui badge-ui--${variante} badge-ui--${tamano} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
