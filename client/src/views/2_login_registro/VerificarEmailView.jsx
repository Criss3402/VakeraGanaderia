import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { reenviarVerificacion } from "../../api/auth.api";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";

export default function VerificarEmailView({
  tokenInicial = "",
  emailInicial = "",
  alIrALogin,
  alIrALanding,
  alVerificacionExitosa,
}) {
  const { verificarEmailConToken } = useAuth();
  const [token, setToken] = useState(tokenInicial || "");
  const [email, setEmail] = useState(emailInicial || "");
  const [cargando, setCargando] = useState(false);
  const [verificado, setVerificado] = useState(false);
  const [error, setError] = useState("");
  const [mensajeReenvio, setMensajeReenvio] = useState("");
  const [cargandoReenvio, setCargandoReenvio] = useState(false);

  // Si se pasa un token por URL, intentar verificar automáticamente
  useEffect(() => {
    if (tokenInicial && !verificado) {
      ejecutarVerificacion(tokenInicial);
    }
  }, [tokenInicial]);

  async function ejecutarVerificacion(tokenAValidar) {
    const t = tokenAValidar || token;
    if (!t) {
      setError("Por favor ingresá el código de activación.");
      return;
    }

    setError("");
    setMensajeReenvio("");
    setCargando(true);

    try {
      await verificarEmailConToken(t.trim());
      setVerificado(true);
      if (alVerificacionExitosa) {
        setTimeout(() => {
          alVerificacionExitosa();
        }, 1200);
      }
    } catch (err) {
      setError(err.message || "Error al verificar la cuenta.");
    } finally {
      setCargando(false);
    }
  }

  async function manejarReenvio(e) {
    e.preventDefault();
    if (!email) {
      setError("Ingresá tu correo para reenviar la activación.");
      return;
    }

    setError("");
    setCargandoReenvio(true);
    try {
      const res = await reenviarVerificacion(email.trim());
      setMensajeReenvio(
        res?.mensaje || "Se ha enviado un nuevo código de activación a tu casilla de correo."
      );
      setToken("");
    } catch (err) {
      setError(err.message || "No se pudo reenviar la activación.");
    } finally {
      setCargandoReenvio(false);
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
          <h2 className="auth-caja__titulo">Validación de Cuenta</h2>
          <p className="auth-caja__subtitulo">
            Confirmá tu correo para asegurar tu establecimiento en la plataforma.
          </p>
        </div>

        {verificado ? (
          <div className="recuperar-exito">
            <Alert tipo="exito" titulo="¡Cuenta Verificada!">
              Tu correo electrónico ha sido confirmado con éxito. Tu cuenta ya se encuentra 100% activa.
            </Alert>
            <Button
              variante="relleno"
              className="boton--bloque"
              style={{ marginTop: "18px" }}
              onClick={alVerificacionExitosa || alIrALogin}
            >
              Acceder al Sistema
            </Button>
          </div>
        ) : (
          <div>
            {error && (
              <Alert tipo="error" alCerrar={() => setError("")}>
                {error}
              </Alert>
            )}

            {mensajeReenvio && (
              <Alert tipo="exito" alCerrar={() => setMensajeReenvio("")}>
                {mensajeReenvio}
              </Alert>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ejecutarVerificacion();
              }}
              className="auth-form"
            >
              <Input
                label="Código de 6 dígitos del correo"
                nombre="token"
                valor={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Ej. 582914"
                requerido
              />

              <Button
                tipo="submit"
                variante="relleno"
                cargando={cargando}
                className="boton--bloque"
              >
                Activar Mi Cuenta
              </Button>
            </form>

            <div style={{ margin: "24px 0 16px", borderTop: "1px solid var(--borde, #e5e7eb)", paddingTop: "16px" }}>
              <p style={{ fontSize: "13px", color: "var(--texto-secundario, #6b7280)", textAlign: "center", marginBottom: "12px" }}>
                ¿No recibiste el correo o venció tu enlace?
              </p>

              <form onSubmit={manejarReenvio} style={{ display: "flex", gap: "8px" }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="input-base"
                  style={{ flex: 1, padding: "8px 12px", fontSize: "14px", borderRadius: "6px", border: "1px solid var(--borde, #d1d5db)" }}
                />
                <Button
                  type="submit"
                  variante="borde"
                  cargando={cargandoReenvio}
                  style={{ whiteSpace: "nowrap" }}
                >
                  Reenviar
                </Button>
              </form>
            </div>

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
        )}
      </div>
    </div>
  );
}
