import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";
import Badge from "../../components/ui/Badge";

export default function LoginView({ alIrARegistro, alIrARecuperar, alIrALanding, alIniciarExito }) {
  const { iniciarSesion, loginRapido, usuariosDemo } = useAuth();
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
      if (alIniciarExito) alIniciarExito();
    } catch (err) {
      setError(err.message || "Error al iniciar sesión.");
    } finally {
      setCargando(false);
    }
  }

  async function manejarLoginRapido(rol) {
    setError("");
    setCargando(true);
    try {
      await loginRapido(rol);
      if (alIniciarExito) alIniciarExito();
    } catch (err) {
      setError(err.message || "Error con el acceso rápido.");
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

        {/* Acceso rápido por rol para demostraciones y pruebas fluidas */}
        <div className="auth-demo-roles">
          <div className="auth-demo-roles__divisor">
            <span>O ingresá con 1-clic de prueba</span>
          </div>

          <p className="auth-demo-roles__nota">
            Haz clic en cualquiera de los 5 roles del sistema para probar la experiencia correspondiente:
          </p>

          <div className="auth-demo-roles__grid">
            <button
              type="button"
              onClick={() => manejarLoginRapido("dueno")}
              className="auth-demo-card"
            >
              <span className="auth-demo-card__icono">👑</span>
              <div>
                <strong>Dueño</strong>
                <small>Visión total & auditoría</small>
              </div>
            </button>

            <button
              type="button"
              onClick={() => manejarLoginRapido("capataz")}
              className="auth-demo-card"
            >
              <span className="auth-demo-card__icono">🤠</span>
              <div>
                <strong>Capataz</strong>
                <small>Aprobación & campo</small>
              </div>
            </button>

            <button
              type="button"
              onClick={() => manejarLoginRapido("peon")}
              className="auth-demo-card"
            >
              <span className="auth-demo-card__icono">🚜</span>
              <div>
                <strong>Peón</strong>
                <small>Carga de novedades</small>
              </div>
            </button>

            <button
              type="button"
              onClick={() => manejarLoginRapido("oficina")}
              className="auth-demo-card"
            >
              <span className="auth-demo-card__icono">💼</span>
              <div>
                <strong>Oficina</strong>
                <small>Compras & insumos</small>
              </div>
            </button>

            <button
              type="button"
              onClick={() => manejarLoginRapido("veterinario")}
              className="auth-demo-card"
            >
              <span className="auth-demo-card__icono">🩺</span>
              <div>
                <strong>Veterinario</strong>
                <small>Sanidad & vacunas</small>
              </div>
            </button>
          </div>
        </div>

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
