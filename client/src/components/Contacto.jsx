import { useState } from "react";
import { enviarContacto } from "../api/client.js";

const VALORES_INICIALES = { nombre: "", email: "", mensaje: "" };

export default function Contacto() {
  const [form, setForm] = useState(VALORES_INICIALES);
  const [estado, setEstado] = useState("inactivo"); // inactivo | enviando | enviado | error
  const [error, setError] = useState("");

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function manejarEnvio(e) {
    e.preventDefault();
    setEstado("enviando");
    setError("");

    try {
      await enviarContacto(form);
      setEstado("enviado");
      setForm(VALORES_INICIALES);
    } catch (err) {
      setEstado("error");
      setError(err.message);
    }
  }

  return (
    <section id="contacto" className="contacto">
      <div className="contenedor contacto__grid">
        <div>
          <p className="etiqueta">Contacto</p>
          <h2 className="titulo-seccion">Hablemos de tu próximo lote</h2>
          <p className="contacto__texto">
            Contanos qué necesitás y te respondemos a la brevedad. Este
            formulario envía los datos a nuestra API de Node.js.
          </p>
        </div>

        <form className="contacto__form" onSubmit={manejarEnvio}>
          <label>
            Nombre
            <input
              type="text"
              required
              value={form.nombre}
              onChange={(e) => actualizarCampo("nombre", e.target.value)}
            />
          </label>

          <label>
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => actualizarCampo("email", e.target.value)}
            />
          </label>

          <label>
            Mensaje
            <textarea
              required
              rows={4}
              value={form.mensaje}
              onChange={(e) => actualizarCampo("mensaje", e.target.value)}
            />
          </label>

          <button type="submit" className="boton boton--relleno" disabled={estado === "enviando"}>
            {estado === "enviando" ? "Enviando..." : "Enviar mensaje"}
          </button>

          {estado === "enviado" && (
            <p className="contacto__aviso contacto__aviso--ok">
              ¡Gracias! Recibimos tu mensaje.
            </p>
          )}
          {estado === "error" && (
            <p className="contacto__aviso contacto__aviso--error">{error}</p>
          )}
        </form>
      </div>
    </section>
  );
}
