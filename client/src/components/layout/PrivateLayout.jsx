import { useState } from "react";
import Sidebar from "./Sidebar";
import PrivateHeader from "./PrivateHeader";

export default function PrivateLayout({
  children,
  vistaActiva,
  alCambiarVista,
  tituloVista,
  alIrALanding,
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="layout-privado">
      <Sidebar
        vistaActiva={vistaActiva}
        alCambiarVista={alCambiarVista}
        menuAbierto={menuAbierto}
        alCerrarMenu={() => setMenuAbierto(false)}
      />

      {menuAbierto && (
        <div
          className="layout-privado__overlay"
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />
      )}

      <div className="layout-privado__principal">
        <PrivateHeader
          tituloVista={tituloVista}
          alAbrirMenu={() => setMenuAbierto(true)}
          alIrALanding={alIrALanding}
        />
        <main className="layout-privado__contenido">{children}</main>
      </div>
    </div>
  );
}
