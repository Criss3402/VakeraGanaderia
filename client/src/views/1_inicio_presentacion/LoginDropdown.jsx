import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";

export default function LoginDropdown({ alIrARegistro, alIrARecuperar, alIniciarExito, alCerrar }) {
  const { iniciarSesion } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function manejarSubmit(e) {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      await iniciarSesion(email, password);
      if (alCerrar) alCerrar();
      if (alIniciarExito) alIniciarExito();
    } catch (err) {
      setError(err.message || "Credenciales incorrectas.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login-dropdown" role="dialog" aria-label="Iniciar sesión">
      <div className="login-dropdown__cabecera">
        <h3 className="login-dropdown__titulo">Ingresar al Sistema</h3>
        <p className="login-dropdown__subtitulo">
          Accedé a tu establecimiento ganadero con tus credenciales seguras.
        </p>
      </div>

      {error && (
        <Alert tipo="error" alCerrar={() => setError("")}>
          {error}
        </Alert>
      )}

      <form onSubmit={manejarSubmit} className="login-dropdown__form">
        <Input
          label="Correo electrónico"
          tipo="email"
          nombre="dropdown-email"
          valor={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ejemplo@vakera.com"
          requerido
        />

        <Input
          label="Contraseña"
          tipo="password"
          nombre="dropdown-password"
          valor={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          requerido
        />

        <div className="login-dropdown__olvido">
          {alIrARecuperar && (
            <button
              type="button"
              onClick={() => {
                if (alCerrar) alCerrar();
                alIrARecuperar();
              }}
              className="auth-link"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </div>

        <Button
          tipo="submit"
          variante="relleno"
          cargando={cargando}
          className="boton--bloque"
        >
          {cargando ? "Iniciando..." : "Iniciar Sesión"}
        </Button>
      </form>

      <div className="login-dropdown__pie">
        <p>
          ¿No tenés una cuenta aún?{" "}
          <button
            type="button"
            onClick={() => {
              if (alCerrar) alCerrar();
              if (alIrARegistro) alIrARegistro();
            }}
            className="auth-link auth-link--destacado"
          >
            Registrar nuevo establecimiento
          </button>
        </p>
      </div>
    </div>
  );
}
