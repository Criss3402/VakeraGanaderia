import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";

export default function RegistroView({ alIrALogin, alIrALanding, alRegistroExito }) {
  const { registrarse } = useAuth();
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    confirmarPassword: "",
    establecimiento: "",
    rol: "dueno",
    cargo: "Propietario",
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
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
      await registrarse({
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        establecimiento: form.establecimiento || "Establecimiento Ganadero",
        rol: form.rol,
        cargo: form.cargo,
      });

      if (alRegistroExito) alRegistroExito();
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
          <button
            type="button"
            onClick={alIrALanding}
            className="auth-caja__volver"
            aria-label="Volver a la web"
          >
            ← Volver a la web
          </button>
          <img src="/logo-vakera.png" alt="Vakera" className="auth-caja__logo" />
          <h2 className="auth-caja__titulo">Crear Cuenta en Vakera</h2>
          <p className="auth-caja__subtitulo">
            Registrá tu establecimiento ganadero y comenzá a digitalizar tu campo.
          </p>
        </div>

        {error && (
          <Alert tipo="error" alCerrar={() => setError("")}>
            {error}
          </Alert>
        )}

        <form onSubmit={manejarSubmit} className="auth-form">
          <div className="form-grid-dos">
            <Input
              label="Nombre y apellido completo"
              nombre="nombre"
              valor={form.nombre}
              onChange={(e) => actualizarCampo("nombre", e.target.value)}
              placeholder="Ej. Juan Manuel Pérez"
              requerido
            />

            <Input
              label="Correo electrónico corporativo"
              tipo="email"
              nombre="email"
              valor={form.email}
              onChange={(e) => actualizarCampo("email", e.target.value)}
              placeholder="juan@estancia.com"
              requerido
            />
          </div>

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
            cargando={cargando}
            className="boton--bloque"
          >
            Registrarme y Acceder
          </Button>
        </form>

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
