import { useEffect } from "react";

export default function Modal({
  abierto = false,
  alCerrar,
  titulo,
  children,
  anchoMaximo = "540px",
}) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape" && abierto) {
        alCerrar();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto, alCerrar]);

  if (!abierto) return null;

  return (
    <div className="modal-overlay" onClick={alCerrar}>
      <div
        className="modal-contenedor"
        style={{ maxWidth: anchoMaximo }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3 className="modal-titulo">{titulo}</h3>
          <button
            type="button"
            className="modal-cerrar"
            onClick={alCerrar}
            aria-label="Cerrar modal"
          >
            ×
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  );
}
