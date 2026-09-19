import { useAuth } from "../../context/AuthContext";
import Badge from "../ui/Badge";

export default function Sidebar({
  vistaActiva,
  alCambiarVista,
  menuAbierto,
  alCerrarMenu,
}) {
  const { usuario, rol, cerrarSesion } = useAuth();

  const esDueno = rol === "dueno";
  const esCapataz = rol === "capataz";
  const esPeon = rol === "peon";

  const enlaces = [
    {
      id: "metricas",
      etiqueta: "Panel General",
      icono: "📊",
      visible: true,
    },
    {
      id: "partes",
      etiqueta: esPeon ? "Mis Partes Diarios" : "Partes de Campo",
      icono: "📋",
      visible: true,
    },
    {
      id: "sanidad",
      etiqueta: "Sanidad y Vacunas",
      icono: "💉",
      visible: true,
    },
    {
      id: "insumos",
      etiqueta: "Insumos y Stock",
      icono: "📦",
      visible: true,
    },
    {
      id: "permisos",
      etiqueta: "Roles y Permisos",
      icono: "🛡️",
      visible: esDueno,
      badge: "Dueño",
    },
  ];

  return (
    <aside className={`sidebar-privada ${menuAbierto ? "sidebar-privada--abierta" : ""}`}>
      <div className="sidebar-privada__header">
        <div className="sidebar-privada__marca">
          <img src="/logo-vakera.png" alt="Vakera" className="sidebar-privada__logo" />
          <div>
            <span className="sidebar-privada__titulo">Vakera</span>
            <span className="sidebar-privada__subtitulo">Gestión Ganadera</span>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-privada__cerrar-movil"
          onClick={alCerrarMenu}
          aria-label="Cerrar menú"
        >
          ×
        </button>
      </div>

      <div className="sidebar-privada__usuario">
        <div className="sidebar-privada__avatar">
          {usuario?.nombre ? usuario.nombre[0].toUpperCase() : "U"}
        </div>
        <div className="sidebar-privada__usuario-info">
          <p className="sidebar-privada__usuario-nombre">{usuario?.nombre || "Usuario"}</p>
          <div className="sidebar-privada__usuario-rol">
            <Badge variante="rol" tamano="sm">
              {rol ? rol.toUpperCase() : "INVITADO"}
            </Badge>
          </div>
        </div>
      </div>

      <nav className="sidebar-privada__nav">
        <p className="sidebar-privada__seccion-titulo">MÓDULOS DEL SISTEMA</p>
        <ul>
          {enlaces
            .filter((e) => e.visible)
            .map((enlace) => {
              const activo = vistaActiva === enlace.id;
              return (
                <li key={enlace.id}>
                  <button
                    type="button"
                    onClick={() => {
                      alCambiarVista(enlace.id);
                      if (alCerrarMenu) alCerrarMenu();
                    }}
                    className={`sidebar-privada__boton ${
                      activo ? "sidebar-privada__boton--activo" : ""
                    }`}
                  >
                    <span className="sidebar-privada__icono">{enlace.icono}</span>
                    <span className="sidebar-privada__texto">{enlace.etiqueta}</span>
                    {enlace.badge && (
                      <Badge variante="alerta" tamano="sm">
                        {enlace.badge}
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
        </ul>
      </nav>

      <div className="sidebar-privada__footer">
        <button
          type="button"
          onClick={cerrarSesion}
          className="sidebar-privada__boton-logout"
        >
          <span>🚪</span>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
