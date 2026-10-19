import { useState } from "react";
import { solicitarRecuperacion, restablecerPassword } from "../../api/auth.api";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";

export default function RecuperarPasswordView({
  tokenInicial = "",
  emailInicial = "",
  alIrALogin,
  alIrALanding,
  alRestablecerExito,
}) {
  const [email, setEmail] = useState(emailInicial || "");
  const [token, setToken] = useState(tokenInicial || "");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [paso, setPaso] = useState(tokenInicial ? "restablecer" : "solicitar");
  const [cargando, setCargando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [error, setError] = useState("");

  async function manejarSolicitud(e) {
    e.preventDefault();
    if (!email) {
      setError("Por favor ingresá tu correo electrónico.");
      return;
    }

    setError("");
    setCargando(true);
    try {
      const res = await solicitarRecuperacion(email.trim());
      setMensajeExito(
        res?.mensaje || "Hemos enviado un código de 6 dígitos a tu correo electrónico. Por favor revisá tu bandeja de entrada o spam."
      );
      // No autocompletamos el token en pantalla: el usuario debe obtenerlo de su correo
      setToken("");
      setPaso("restablecer");
    } catch (err) {
      setError(err.message || "Error al procesar la solicitud.");
    } finally {
      setCargando(false);
    }
  }

  async function manejarRestablecer(e) {
    e.preventDefault();
    if (!token) {
      setError("Por favor ingresá el código de 6 dígitos que te enviamos a tu correo.");
      return;
    }
    if (nuevaPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setError("");
    setCargando(true);
    try {
      await restablecerPassword(token.trim(), nuevaPassword);
      setPaso("completado");
    } catch (err) {
      setError(err.message || "Error al restablecer la contraseña.");
    } finally {
      setCargando(false);
    }
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
            {paso === "solicitar" && "Ingresá tu correo para recibir el código de restablecimiento."}
            {paso === "restablecer" && "Ingresá el código de 6 dígitos enviado a tu correo y tu nueva contraseña."}
            {paso === "completado" && "¡Contraseña actualizada con éxito!"}
          </p>
        </div>

        {error && (
          <Alert tipo="error" alCerrar={() => setError("")}>
            {error}
          </Alert>
        )}

        {mensajeExito && paso === "restablecer" && (
          <Alert tipo="exito" alCerrar={() => setMensajeExito("")}>
            {mensajeExito}
          </Alert>
        )}

        {paso === "solicitar" && (
          <form onSubmit={manejarSolicitud} className="auth-form">
            <Input
              label="Correo electrónico registrado"
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
              Enviar Código a Mi Correo
            </Button>

            <div style={{ textAlign: "center", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => setPaso("restablecer")}
                className="auth-link"
                style={{ fontSize: "13px" }}
              >
                ¿Ya recibiste tu código en el correo? Hacé clic aquí
              </button>
            </div>
          </form>
        )}

        {paso === "restablecer" && (
          <form onSubmit={manejarRestablecer} className="auth-form">
            <Input
              label="Código de 6 dígitos del correo"
              nombre="token"
              valor={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Ej. 582914"
              requerido
            />

            <Input
              label="Nueva Contraseña"
              tipo="password"
              nombre="nuevaPassword"
              valor={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              requerido
            />

            <Input
              label="Confirmar Nueva Contraseña"
              tipo="password"
              nombre="confirmarPassword"
              valor={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              placeholder="Repetí la contraseña"
              requerido
            />

            <Button
              tipo="submit"
              variante="relleno"
              cargando={cargando}
              className="boton--bloque"
            >
              Restablecer y Acceder
            </Button>

            <div style={{ textAlign: "center", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => setPaso("solicitar")}
                className="auth-link"
                style={{ fontSize: "13px" }}
              >
                ← Volver a solicitar código
              </button>
            </div>
          </form>
        )}

        {paso === "completado" && (
          <div className="recuperar-exito">
            <Alert tipo="exito" titulo="¡Contraseña Restablecida!">
              Tu contraseña ha sido actualizada correctamente. Ya podés acceder a Vakera con tu nueva clave.
            </Alert>
            <Button
              variante="relleno"
              className="boton--bloque"
              style={{ marginTop: "16px" }}
              onClick={alRestablecerExito || alIrALogin}
            >
              Iniciar Sesión
            </Button>
          </div>
        )}

        <div className="auth-caja__pie">
          <button
            type="button"
            onClick={alIrALogin}
            className="auth-link"
          >
            ← Volver al login
          </button>
        </div>
      </div>
    </div>
  );
}
