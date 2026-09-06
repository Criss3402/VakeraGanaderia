import Navbar from "./components/Navbar.jsx";
import Hero from "./components/Hero.jsx";
import QuienesSomos from "./components/QuienesSomos.jsx";
import Servicios from "./components/Servicios.jsx";
import Ganado from "./components/Ganado.jsx";
import Contacto from "./components/Contacto.jsx";
import Footer from "./components/Footer.jsx";

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <QuienesSomos />
        <Servicios />
        <Ganado />
        <Contacto />
      </main>
      <Footer />
    </>
  );
}
