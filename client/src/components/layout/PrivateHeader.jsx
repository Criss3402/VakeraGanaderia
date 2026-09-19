import { useAuth } from "../../context/AuthContext";
import Badge from "../ui/Badge";
import Button from "../ui/Button";

export default function PrivateHeader({
  tituloVista = "Tablero Principal",
  alAbrirMenu,
  alIrALanding,
}) {
  const { usuario, rol, loginRapido, cerrarSesion } = useAuth();

  return (
    <header className="header-privado">
      <div className="header-privado__izquierda">
        <button
          type="button"
          className="header-privado__hamburguesa"
          onClick={alAbrirMenu}
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <div>
          <h1 className="header-privado__titulo">{tituloVista}</h1>
          <p className="header-privado__subtitulo">
            {usuario?.establecimiento || "Estancia La Esperanza"} • Conectado como{" "}
            <strong>{usuario?.nombre}</strong>
          </p>
        </div>
      </div>

      <div className="header-privado__derecha">
        {/* Selector rápido de rol para facilitar pruebas en vivo */}
        <div className="header-privado__switcher-rol" title="Cambiar rol activo para pruebas">
          <span className="switcher-rol__label">Simular Rol:</span>
          <select
            value={rol || "dueno"}
            onChange={(e) => loginRapido(e.target.value)}
            className="switcher-rol__select"
          >
            <option value="dueno">Dueño / Director</option>
            <option value="capataz">Capataz (Campo)</option>
            <option value="peon">Peón (Operario)</option>
            <option value="oficina">Oficina (Compras)</option>
            <option value="veterinario">Veterinario</option>
          </select>
        </div>

        <button
          type="button"
          onClick={alIrALanding}
          className="boton boton--fantasma boton--sm"
          title="Ver Landing Page pública"
        >
          🌐 Ver Web
        </button>

        <Button
          variante="peligro"
          tamano="sm"
          onClick={cerrarSesion}
          title="Cerrar sesión"
        >
          Salir
        </Button>
      </div>
    </header>
  );
}
