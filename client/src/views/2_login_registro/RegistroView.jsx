import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";
import GoogleAuthButton from "../../components/ui/GoogleAuthButton";

export default function RegistroView({
  errorInicial = "",
  alIrALogin,
  alIrALanding,
  alIrAVerificar,
  alRegistroExito,
}) {
  const { registrarse } = useAuth();
  const [paso, setPaso] = useState(1);
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    confirmarPassword: "",
    establecimiento: "",
    rol: "peon",
    cargo: "Operario de Campo",
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(errorInicial || "");
  const [registroCompletado, setRegistroCompletado] = useState(null);

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function manejarContinuar(e) {
    e.preventDefault();
    setError("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((form.email || "").trim())) {
      setError("El formato del correo electrónico no es válido.");
      return;
    }

    if (form.password !== form.confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setPaso(2);
  }

  async function manejarSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setCargando(true);
    try {
      const res = await registrarse({
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        establecimiento: form.establecimiento || "Establecimiento Ganadero",
        rol: form.rol,
        cargo: form.cargo,
      });

      // Si el backend requirió activación por email
      if (res?.requiereVerificacion) {
        setRegistroCompletado(res);
      } else if (alRegistroExito) {
        alRegistroExito();
      }
    } catch (err) {
      setError(err.message || "Error al registrarse.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="auth-pagina">
      <div className="auth-caja auth-caja--amplia">
        <div className="auth-caja__cabecera">
          {paso === 2 && !registroCompletado ? (
            <button
              type="button"
              onClick={() => {
                setError("");
                setPaso(1);
              }}
              className="auth-caja__volver"
              aria-label="Volver al paso anterior"
            >
              ← Volver atrás
            </button>
          ) : (
            <button
              type="button"
              onClick={alIrALanding}
              className="auth-caja__volver"
              aria-label="Volver a la web"
            >
              ← Volver a la web
            </button>
          )}
          <img src="/logo-vakera.png" alt="Vakera" className="auth-caja__logo" />
          <h2 className="auth-caja__titulo">
            {registroCompletado
              ? "¡Casi listo!"
              : paso === 1
              ? "Crear Cuenta en Vakera"
              : "Configurá tu establecimiento"}
          </h2>
          <p className="auth-caja__subtitulo">
            {registroCompletado
              ? "Confirmá tu cuenta para comenzar a operar."
              : paso === 1
              ? "Registrate con Google o con tu correo y contraseña."
              : "Completá los datos de tu campo y rol inicial."}
          </p>
        </div>

        {error && (
          <Alert tipo="error" alCerrar={() => setError("")}>
            {error}
          </Alert>
        )}

        {registroCompletado ? (
          <div className="recuperar-exito" style={{ marginTop: "12px" }}>
            <Alert tipo="exito" titulo="¡Correo de activación enviado!">
              Te enviamos un correo a <strong>{registroCompletado.email}</strong> con tu código de activación de 6 dígitos.
              Por favor revisá tu bandeja de entrada o la carpeta de spam.
            </Alert>

            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <Button
                variante="relleno"
                className="boton--bloque"
                onClick={() =>
                  alIrAVerificar
                    ? alIrAVerificar("", registroCompletado.email)
                    : alIrALogin()
                }
              >
                Ingresar Código de Activación
              </Button>

              <Button
                variante="borde"
                className="boton--bloque"
                onClick={alIrALogin}
              >
                Volver al Inicio de Sesión
              </Button>
            </div>
          </div>
        ) : paso === 1 ? (
          <>
            <GoogleAuthButton
              modo="registro"
              etiqueta="Registrarse con Google"
              rol={form.rol}
              establecimiento={form.establecimiento}
              conSeparador={false}
              alError={(msg) => setError(msg)}
            />

            <div className="auth-separador" aria-hidden="true">
              <span>o</span>
            </div>

            <form onSubmit={manejarContinuar} className="auth-form">
              <Input
                label="Correo electrónico"
                tipo="email"
                nombre="email"
                valor={form.email}
                onChange={(e) => actualizarCampo("email", e.target.value)}
                placeholder="juan@estancia.com"
                requerido
              />

              <div className="form-grid-dos">
                <Input
                  label="Contraseña"
                  tipo="password"
                  nombre="password"
                  valor={form.password}
                  onChange={(e) => actualizarCampo("password", e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  requerido
                />

                <Input
                  label="Confirmar contraseña"
                  tipo="password"
                  nombre="confirmarPassword"
                  valor={form.confirmarPassword}
                  onChange={(e) => actualizarCampo("confirmarPassword", e.target.value)}
                  placeholder="Repita la contraseña"
                  requerido
                />
              </div>

              <Button
                tipo="submit"
                variante="relleno"
                className="boton--bloque"
              >
                Continuar
              </Button>
            </form>
          </>
        ) : (
          <form onSubmit={manejarSubmit} className="auth-form">
            <Input
              label="Nombre y apellido completo"
              nombre="nombre"
              valor={form.nombre}
              onChange={(e) => actualizarCampo("nombre", e.target.value)}
              placeholder="Ej. Juan Manuel Pérez"
              requerido
            />

            <div className="form-grid-dos">
              <Input
                label="Nombre del establecimiento / Estancia"
                nombre="establecimiento"
                valor={form.establecimiento}
                onChange={(e) => actualizarCampo("establecimiento", e.target.value)}
                placeholder="Ej. Estancia Las Acacias"
                requerido
              />

              <div className="campo-formulario">
                <label className="campo-formulario__label" htmlFor="rol">
                  Rol inicial de la cuenta <span className="campo-formulario__requerido">*</span>
                </label>
                <select
                  id="rol"
                  value={form.rol}
                  onChange={(e) => {
                    const rolVal = e.target.value;
                    const cargos = {
                      dueno: "Propietario / Director",
                      capataz: "Capataz de Campo",
                      peon: "Operario de Campo",
                      oficina: "Administrador / Compras",
                      veterinario: "Médico Veterinario",
                    };
                    actualizarCampo("rol", rolVal);
                    actualizarCampo("cargo", cargos[rolVal] || "Colaborador");
                  }}
                  className="campo-formulario__input"
                >
                  <option value="dueno">Dueño / Dirección Ejecutiva</option>
                  <option value="capataz">Capataz (Supervisor de Campo)</option>
                  <option value="peon">Peón (Operario de Campo)</option>
                  <option value="oficina">Oficina (Administración)</option>
                  <option value="veterinario">Médico Veterinario</option>
                </select>
              </div>
            </div>

            <Button
              tipo="submit"
              variante="relleno"
              cargando={cargando}
              className="boton--bloque"
            >
              Registrar Establecimiento
            </Button>
          </form>
        )}

        <div className="auth-caja__pie">
          <p>
            ¿Ya tenés una cuenta registrada?{" "}
            <button
              type="button"
              onClick={alIrALogin}
              className="auth-link auth-link--destacado"
            >
              Iniciar sesión aquí
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
