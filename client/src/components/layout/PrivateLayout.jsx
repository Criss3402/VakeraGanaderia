import { useState } from "react";
import Sidebar from "./Sidebar";
import PrivateHeader from "./PrivateHeader";

export default function PrivateLayout({
  children,
  vistaActiva,
  alCambiarVista,
  alIrALanding,
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="bg-gray-50 flex h-screen overflow-hidden text-gray-800 antialiased font-sans w-full">
      {/* Sidebar */}
      <Sidebar
        vistaActiva={vistaActiva}
        alCambiarVista={alCambiarVista}
        menuAbierto={menuAbierto}
        alCerrarMenu={() => setMenuAbierto(false)}
        alIrALanding={alIrALanding}
      />

      {/* Mobile Overlay */}
      {menuAbierto && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        <PrivateHeader
          alAbrirMenu={() => setMenuAbierto(true)}
          alIrALanding={alIrALanding}
        />
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
