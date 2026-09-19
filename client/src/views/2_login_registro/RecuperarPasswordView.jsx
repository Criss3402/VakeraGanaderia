import { useState } from "react";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";

export default function RecuperarPasswordView({ alIrALogin, alIrALanding }) {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);

  function manejarSubmit(e) {
    e.preventDefault();
    setCargando(true);
    setTimeout(() => {
      setCargando(false);
      setEnviado(true);
    }, 600);
  }

  return (
    <div className="auth-pagina">
      <div className="auth-caja">
        <div className="auth-caja__cabecera">
          <button
            type="button"
            onClick={alIrALanding}
            className="auth-caja__volver"
            aria-label="Volver a la web"
          >
            ← Volver a la web
          </button>
          <img src="/logo-vakera.png" alt="Vakera" className="auth-caja__logo" />
          <h2 className="auth-caja__titulo">Recuperar Contraseña</h2>
          <p className="auth-caja__subtitulo">
            Ingresá tu correo registrado para recibir las instrucciones de restablecimiento.
          </p>
        </div>

        {enviado ? (
          <div className="recuperar-exito">
            <Alert tipo="exito" titulo="Enlace enviado">
              Hemos enviado un enlace de recuperación seguro al correo <strong>{email}</strong>.
              Revisá tu bandeja de entrada o carpeta de spam.
            </Alert>
            <Button
              variante="relleno"
              className="boton--bloque"
              style={{ marginTop: "16px" }}
              onClick={alIrALogin}
            >
              Volver al Inicio de Sesión
            </Button>
          </div>
        ) : (
          <form onSubmit={manejarSubmit} className="auth-form">
            <Input
              label="Correo electrónico"
              tipo="email"
              nombre="email"
              valor={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              requerido
            />

            <Button
              tipo="submit"
              variante="relleno"
              cargando={cargando}
              className="boton--bloque"
            >
              Enviar Instrucciones
            </Button>

            <div className="auth-caja__pie">
              <button
                type="button"
                onClick={alIrALogin}
                className="auth-link"
              >
                ← Volver al login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
