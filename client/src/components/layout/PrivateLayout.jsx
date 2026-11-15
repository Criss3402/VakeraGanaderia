import { useState } from "react";
import Sidebar from "./Sidebar";
import PrivateHeader from "./PrivateHeader";
import ChatView from "../../views/3_dashboard/modulos/ChatView";

export default function PrivateLayout({
  children,
  vistaActiva,
  alCambiarVista,
  alIrALanding,
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [colapsado, setColapsado] = useState(false);

  return (
    <div className="bg-[#f8f5eb] flex h-screen overflow-hidden text-[#182920] antialiased font-sans w-full selection:bg-[#8fb56b] selection:text-[#182920]">
      {/* Sidebar (Verde Profundo del inicio) */}
      <Sidebar
        vistaActiva={vistaActiva}
        alCambiarVista={alCambiarVista}
        menuAbierto={menuAbierto}
        alCerrarMenu={() => setMenuAbierto(false)}
        alIrALanding={alIrALanding}
        colapsado={colapsado}
        alToggleColapso={() => setColapsado((prev) => !prev)}
      />

      {/* Mobile Overlay */}
      {menuAbierto && (
        <div
          className="fixed inset-0 bg-[#182920]/60 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content Area (Color Crema Suave del inicio #f8f5eb) */}
      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0 bg-[#f8f5eb]">
        <PrivateHeader
          alAbrirMenu={() => setMenuAbierto(true)}
          alIrALanding={alIrALanding}
          colapsado={colapsado}
          alToggleColapso={() => setColapsado((prev) => !prev)}
        />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          {children}
        </div>

        {/* Interfaz Flotante de Chat Compartimentado (Esquina Inferior Derecha) */}
        <ChatView />
      </main>
    </div>
  );
}
