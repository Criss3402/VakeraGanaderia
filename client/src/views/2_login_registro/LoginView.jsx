import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";

export default function LoginView({
  alIrARegistro,
  alIrARecuperar,
  alIrAVerificar,
  alIrALanding,
  alIniciarExito,
}) {
  const { iniciarSesion } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [necesitaVerificacion, setNecesitaVerificacion] = useState(false);

  async function manejarSubmit(e) {
    e.preventDefault();
    setError("");
    setNecesitaVerificacion(false);
    setCargando(true);

    try {
      await iniciarSesion(email, password);
      if (alIniciarExito) alIniciarExito();
    } catch (err) {
      const msg = err.message || "Error al iniciar sesión.";
      setError(msg);
      if (msg.toLowerCase().includes("activada") || msg.toLowerCase().includes("verific")) {
        setNecesitaVerificacion(true);
      }
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
          <h2 className="auth-caja__titulo">Ingresar al Sistema</h2>
          <p className="auth-caja__subtitulo">
            Accedé a tu establecimiento ganadero con tus credenciales seguras.
          </p>
        </div>

        {error && (
          <Alert tipo="error" alCerrar={() => setError("")}>
            {error}
          </Alert>
        )}

        {necesitaVerificacion && (
          <div style={{ marginBottom: "16px", textAlign: "center" }}>
            <Button
              variante="borde"
              className="boton--bloque"
              onClick={() => (alIrAVerificar ? alIrAVerificar("", email) : null)}
            >
              ✉ Activar mi cuenta o reenviar correo
            </Button>
          </div>
        )}

        <form onSubmit={manejarSubmit} className="auth-form">
          <Input
            label="Correo electrónico"
            tipo="email"
            nombre="email"
            valor={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ejemplo@vakera.com"
            requerido
          />

          <Input
            label="Contraseña"
            tipo="password"
            nombre="password"
            valor={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            requerido
          />

          <div className="auth-form__acciones-aux">
            <button
              type="button"
              onClick={alIrARecuperar}
              className="auth-link"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <Button
            tipo="submit"
            variante="relleno"
            cargando={cargando}
            className="boton--bloque"
          >
            Iniciar Sesión
          </Button>
        </form>

        <div className="auth-caja__pie">
          <p>
            ¿No tenés una cuenta aún?{" "}
            <button
              type="button"
              onClick={alIrARegistro}
              className="auth-link auth-link--destacado"
            >
              Registrar nuevo establecimiento
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
