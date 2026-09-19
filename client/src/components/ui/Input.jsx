export default function Input({
  label,
  tipo = "text",
  nombre,
  valor,
  onChange,
  placeholder = "",
  requerido = false,
  error = "",
  ayuda = "",
  disabled = false,
  className = "",
  ...props
}) {
  return (
    <div className={`campo-formulario ${error ? "campo-formulario--error" : ""} ${className}`.trim()}>
      {label && (
        <label className="campo-formulario__label" htmlFor={nombre}>
          {label} {requerido && <span className="campo-formulario__requerido">*</span>}
        </label>
      )}
      <input
        id={nombre}
        name={nombre}
        type={tipo}
        value={valor}
        onChange={onChange}
        placeholder={placeholder}
        required={requerido}
        disabled={disabled}
        className="campo-formulario__input"
        {...props}
      />
      {error && <p className="campo-formulario__error">{error}</p>}
      {ayuda && !error && <p className="campo-formulario__ayuda">{ayuda}</p>}
    </div>
  );
}
