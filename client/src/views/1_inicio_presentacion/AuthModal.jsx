import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";
import GoogleAuthButton from "../../components/ui/GoogleAuthButton";

const CARGOS_POR_ROL = {
  dueno: "Propietario / Director",
  capataz: "Capataz de Campo",
  peon: "Operario de Campo",
  oficina: "Administrador / Compras",
  veterinario: "Médico Veterinario",
};

export default function AuthModal({
  abierto,
  modoInicial = "login",
  googleSetup = null,
  errorInicial = "",
  alCerrar,
  alIrARecuperar,
  alIrAVerificar,
  alExito,
}) {
  const { iniciarSesion, registrarse, completarRegistroConGoogle } = useAuth();
  const [modo, setModo] = useState(modoInicial);
  const [pasoRegistro, setPasoRegistro] = useState(1);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  // Estado Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [mostrarLoginPass, setMostrarLoginPass] = useState(false);
  const [necesitaVerificacion, setNecesitaVerificacion] = useState(false);

  // Estado Registro (2 pasos)
  const [regForm, setRegForm] = useState({
    email: "",
    password: "",
    confirmarPassword: "",
    nombre: "",
    establecimiento: "",
    rol: "peon",
    cargo: "Operario de Campo",
  });
  const [mostrarRegPass, setMostrarRegPass] = useState(false);
  const [registroCompletado, setRegistroCompletado] = useState(null);
  const [cerrando, setCerrando] = useState(false);
  const timerCierreRef = useRef(null);

  const cerrarConAnimacion = useCallback(() => {
    if (!abierto || cerrando) return;
    setCerrando(true);
    timerCierreRef.current = setTimeout(() => {
      setCerrando(false);
      timerCierreRef.current = null;
      if (alCerrar) alCerrar();
    }, 280);
  }, [abierto, cerrando, alCerrar]);

  useEffect(() => {
    async function manejarSubmitGoogleCompletar(e) {
    e.preventDefault();
    setError("");
    if (!(regForm.nombre || "").trim() || !(regForm.establecimiento || "").trim()) {
      setError("Completá tu nombre y el nombre de tu establecimiento.");
      return;
    }
    setCargando(true);
    try {
      await completarRegistroConGoogle({
        setupToken: googleSetup?.setupToken,
        nombre: regForm.nombre.trim(),
        establecimiento: regForm.establecimiento.trim(),
        rol: regForm.rol,
        cargo: regForm.cargo,
      });
      if (alCerrar) alCerrar();
      if (alExito) alExito();
    } catch (err) {
      setError(err.message || "No se pudo completar el registro con Google.");
    } finally {
      setCargando(false);
    }
  }

  return () => {
      if (timerCierreRef.current) clearTimeout(timerCierreRef.current);
    };
  }, []);

  useEffect(() => {
    if (abierto) {
      if (timerCierreRef.current) {
        clearTimeout(timerCierreRef.current);
        timerCierreRef.current = null;
      }
      setCerrando(false);
      setModo(modoInicial);
      setPasoRegistro(1);
      setError(
        modoInicial === "google-no-registrado"
          ? errorInicial ||
              "No se encontró ninguna cuenta vinculada a esta plataforma con este correo. Por favor registrá una cuenta válida."
          : ""
      );
      setNecesitaVerificacion(false);
      setRegistroCompletado(null);
      if (modoInicial === "google-completar" && googleSetup) {
        setRegForm((prev) => ({
          ...prev,
          email: googleSetup.email || prev.email,
          nombre: googleSetup.nombre || prev.nombre,
        }));
      }
    }
  }, [abierto, modoInicial, googleSetup, errorInicial]);

  useEffect(() => {
    if (!abierto || cerrando) return;
    function manejarEscape(e) {
      if (e.key === "Escape") cerrarConAnimacion();
    }
    window.addEventListener("keydown", manejarEscape);
    async function manejarSubmitGoogleCompletar(e) {
    e.preventDefault();
    setError("");
    if (!(regForm.nombre || "").trim() || !(regForm.establecimiento || "").trim()) {
      setError("Completá tu nombre y el nombre de tu establecimiento.");
      return;
    }
    setCargando(true);
    try {
      await completarRegistroConGoogle({
        setupToken: googleSetup?.setupToken,
        nombre: regForm.nombre.trim(),
        establecimiento: regForm.establecimiento.trim(),
        rol: regForm.rol,
        cargo: regForm.cargo,
      });
      if (alCerrar) alCerrar();
      if (alExito) alExito();
    } catch (err) {
      setError(err.message || "No se pudo completar el registro con Google.");
    } finally {
      setCargando(false);
    }
  }

  return () => window.removeEventListener("keydown", manejarEscape);
  }, [abierto, cerrando, cerrarConAnimacion]);

  if (!abierto && !cerrando) return null;

  function cambiarModo(nuevoModo) {
    setModo(nuevoModo);
    setPasoRegistro(1);
    setError("");
    setNecesitaVerificacion(false);
    setRegistroCompletado(null);
  }

  function actualizarReg(campo, valor) {
    setRegForm((prev) => ({ ...prev, [campo]: valor }));
  }

  async function manejarSubmitLogin(e) {
    e.preventDefault();
    setError("");
    setNecesitaVerificacion(false);
    setCargando(true);
    try {
      await iniciarSesion(loginEmail, loginPassword);
      if (alCerrar) alCerrar();
      if (alExito) alExito();
    } catch (err) {
      const msg = err.message || "Credenciales incorrectas.";
      setError(msg);
      if (msg.toLowerCase().includes("activada") || msg.toLowerCase().includes("verific")) {
        setNecesitaVerificacion(true);
      }
    } finally {
      setCargando(false);
    }
  }

  function manejarContinuarRegistro(e) {
    e.preventDefault();
    setError("");
    const emailLimpio = (regForm.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
      setError("Ingresá un correo electrónico válido.");
      return;
    }
    if ((regForm.password || "").length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (regForm.password !== regForm.confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setPasoRegistro(2);
  }

  async function manejarSubmitRegistro(e) {
    e.preventDefault();
    setError("");
    if (!(regForm.nombre || "").trim()) {
      setError("Ingresá tu nombre y apellido completo.");
      return;
    }
    setCargando(true);
    try {
      const res = await registrarse({
        nombre: regForm.nombre.trim(),
        email: regForm.email.trim(),
        password: regForm.password,
        establecimiento: regForm.establecimiento.trim() || "Establecimiento Ganadero",
        rol: regForm.rol,
        cargo: regForm.cargo,
      });

      if (res?.requiereVerificacion) {
        setRegistroCompletado(res);
      } else {
        if (alCerrar) alCerrar();
        if (alExito) alExito();
      }
    } catch (err) {
      setError(err.message || "Error al registrarse.");
    } finally {
      setCargando(false);
    }
  }

  async function manejarSubmitGoogleCompletar(e) {
    e.preventDefault();
    setError("");
    if (!(regForm.nombre || "").trim() || !(regForm.establecimiento || "").trim()) {
      setError("Completá tu nombre y el nombre de tu establecimiento.");
      return;
    }
    setCargando(true);
    try {
      await completarRegistroConGoogle({
        setupToken: googleSetup?.setupToken,
        nombre: regForm.nombre.trim(),
        establecimiento: regForm.establecimiento.trim(),
        rol: regForm.rol,
        cargo: regForm.cargo,
      });
      if (alCerrar) alCerrar();
      if (alExito) alExito();
    } catch (err) {
      setError(err.message || "No se pudo completar el registro con Google.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div
      className={`auth-modal-backdrop ${cerrando ? "auth-modal-backdrop--cerrando" : ""}`}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) cerrarConAnimacion();
      }}
    >
      <div
        className={`auth-modal-card ${cerrando ? "auth-modal-card--cerrando" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={modo === "login" ? "Iniciar sesión" : "Regístrate en Vakera"}
      >
        {/* Barra superior del modal: Atrás (en paso 2) y Cerrar (X) */}
        <div className="auth-modal-topbar">
          {modo === "registro" && pasoRegistro === 2 && !registroCompletado ? (
            <button
              type="button"
              onClick={() => {
                setError("");
                setPasoRegistro(1);
              }}
              className="auth-modal-icon-btn"
              aria-label="Volver al paso anterior"
              title="Volver"
            >
              <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={cerrarConAnimacion}
            className="auth-modal-icon-btn"
            aria-label="Cerrar ventana"
            title="Cerrar (Esc)"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="auth-modal-cabecera">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            role="img"
            aria-label="Vakera"
            className="auth-caja__logo"
            style={{ width: "88px", height: "88px", margin: "4px auto 8px", display: "block" }}
          >
            <path
              fill="#182920"
              fillRule="evenodd"
              d="M 124.192 99.446 C 115.803 107.025, 110.816 124.589, 112.875 139.308 C 114.906 153.821, 121.403 166.263, 133.047 177.935 C 141.651 186.559, 150.481 192.140, 160.250 195.129 C 163.963 196.265, 167 197.313, 167 197.457 C 167 197.601, 165.425 201.126, 163.501 205.292 L 160.002 212.866 151.405 207.469 C 142.039 201.588, 130.777 196.859, 120.237 194.381 C 109.743 191.914, 90.074 192.920, 79 196.492 C 69.599 199.524, 62.679 202.775, 56.255 207.179 L 52.010 210.089 53.543 213.794 C 58.010 224.590, 71.817 240.990, 84 249.972 C 95.761 258.642, 109.118 263.946, 119.292 263.985 C 126.040 264.012, 138.281 260.948, 147.502 256.927 C 152.453 254.767, 156.776 253, 157.108 253 C 157.441 253, 157.967 257.613, 158.278 263.250 C 159.148 279.036, 162.511 287.073, 176.376 306.500 C 186.186 320.244, 191.198 329.704, 193.596 339 C 195.042 344.605, 195.162 348.253, 194.471 365.500 C 193.477 390.292, 193.657 396.775, 195.482 401.950 C 198.788 411.319, 208.954 422.393, 218.500 427.023 C 227.980 431.621, 234.378 432.215, 269.652 431.767 C 299.066 431.394, 301.938 431.200, 307.233 429.241 C 321.541 423.946, 333.297 411.221, 336.729 397.316 C 338.168 391.485, 338.205 388.687, 337.072 371.636 C 334.948 339.685, 337.195 331.552, 354.763 307.581 C 362.408 297.149, 369.165 284.766, 371.448 277 C 372.337 273.975, 373.345 267.303, 373.688 262.174 C 374.401 251.507, 373.270 251.968, 385.500 257.365 C 397.130 262.498, 409.353 264.689, 418.044 263.199 C 427.477 261.582, 434.679 258.695, 443.265 253.090 C 456.883 244.200, 469.787 230.328, 477.010 216.813 L 480.050 211.127 477.275 208.542 C 475.749 207.120, 470.450 203.955, 465.500 201.508 C 438.361 188.094, 410.487 189.638, 382.155 206.124 C 376.465 209.434, 371.676 211.998, 371.513 211.821 C 371.350 211.645, 369.809 208.382, 368.090 204.571 C 364.875 197.447, 365.048 196.053, 369.148 196.015 C 370.055 196.007, 375.005 193.897, 380.148 191.327 C 387.923 187.442, 391.023 185.122, 398.532 177.577 C 415.649 160.375, 422.122 140.394, 417.557 118.856 C 415.814 110.630, 413.143 105.286, 408.157 100.045 C 402.610 94.213, 401.004 94.595, 400.985 101.750 C 400.947 116.439, 395.430 128.690, 383.534 140.500 C 374.279 149.688, 364.002 155.674, 352 158.866 C 336.086 163.098, 328.905 162.560, 319.295 156.412 C 297.018 142.162, 276.768 136.357, 257.743 138.769 C 242.965 140.642, 231.186 145.275, 213.058 156.345 L 204.615 161.500 195.558 161.387 C 184.772 161.252, 174.562 158.262, 163 151.853 C 154.051 146.893, 140.792 134.020, 136.705 126.325 C 133.322 119.954, 130 107.329, 130 100.840 C 130 98.178, 129.551 96, 129.003 96 C 128.454 96, 126.289 97.551, 124.192 99.446 M 318.764 186.944 C 313.440 188.647, 308.999 192.208, 302.538 199.954 C 289.808 215.217, 283.299 219.002, 268.446 219.778 C 260.836 220.177, 257.944 219.874, 251.947 218.053 C 245.317 216.039, 244.008 215.167, 237.088 208.153 C 232.915 203.922, 227.396 198.175, 224.826 195.380 C 219.106 189.164, 214.777 187, 208.059 187 C 201.544 187, 196.602 189.485, 190.217 195.971 C 182.875 203.430, 176.924 215.961, 175.805 226.319 C 175.514 229.007, 175.896 229.287, 184.047 232.355 C 188.748 234.125, 194.647 236.775, 197.156 238.246 C 223.694 253.798, 239.480 285.942, 237.743 320.887 C 237.059 334.629, 234.634 341.346, 228.227 347.234 C 209.069 364.845, 206.764 368.599, 206.169 383.164 C 205.815 391.843, 206.030 393.387, 208.289 398.319 C 213.141 408.919, 222.348 415.021, 233.428 414.982 C 236.218 414.972, 243.225 413.855, 249 412.500 C 254.775 411.145, 262.425 410.036, 266 410.036 C 269.575 410.036, 277.225 411.145, 283 412.500 C 288.775 413.855, 295.750 414.952, 298.500 414.938 C 322.004 414.816, 333.967 385.362, 319.417 363.440 C 317.446 360.471, 312.342 355.153, 308.074 351.623 C 296.539 342.079, 293.718 334.839, 293.772 314.911 C 293.840 289.418, 301.565 268.922, 317.397 252.230 C 326.011 243.148, 335.703 236.643, 346.864 232.453 C 356.838 228.708, 357.269 227.905, 354.479 218.238 C 350.990 206.152, 341.474 192.882, 333.243 188.626 C 329.280 186.576, 322.409 185.778, 318.764 186.944 M 174.379 255.454 C 173.179 258.582, 174.700 270.474, 176.976 275.742 C 180.753 284.489, 190.014 291.218, 200.198 292.614 C 206.028 293.413, 207.503 291.721, 206.632 285.236 C 205.116 273.945, 196.736 262.905, 185.621 257.557 C 178.200 253.986, 175.161 253.417, 174.379 255.454 M 350.844 255.381 C 345.888 257.168, 338.652 261.489, 334.481 265.151 C 327.761 271.051, 321.836 287.688, 325.068 291.582 C 327.927 295.026, 341.789 290.171, 348.457 283.389 C 354.218 277.530, 357.212 270.237, 357.369 261.680 C 357.517 253.650, 357.008 253.159, 350.844 255.381 M 220.667 373.667 C 219.295 375.039, 220.097 380.665, 222.353 385.500 C 225.281 391.775, 231.592 397.544, 237.173 399.046 C 242.545 400.493, 244.401 399.447, 244.805 394.747 C 245.425 387.516, 239.715 379.173, 231.541 375.367 C 226.598 373.065, 221.989 372.345, 220.667 373.667 M 299.168 375.603 C 293.629 378.364, 290.037 382.274, 287.531 388.272 C 284.299 396.007, 286.264 400.797, 292.184 399.613 C 300.749 397.900, 308.166 390.343, 310.639 380.812 C 312.809 372.444, 308.990 370.709, 299.168 375.603"
            />
          </svg>
          <h3 className="auth-modal-titulo">
            {modo === "login" || modo === "google-no-registrado"
              ? "Iniciar sesión"
              : modo === "google-completar"
              ? "Configurá tu establecimiento"
              : registroCompletado
              ? "¡Casi listo!"
              : pasoRegistro === 1
              ? "Regístrate"
              : "Configurá tu establecimiento"}
          </h3>
          <p className="auth-modal-subtitulo">
            {modo === "login" || modo === "google-no-registrado"
              ? "Accedé a tu establecimiento ganadero con tus credenciales o con Google."
              : modo === "google-completar"
              ? `Cuenta verificada con Google (${googleSetup?.email || regForm.email}). Completá los datos de tu campo.`
              : registroCompletado
              ? "Confirmá tu cuenta para comenzar a operar."
              : pasoRegistro === 1
              ? "Creá tu cuenta con Google o con tu correo y contraseña."
              : "Completá los datos de tu campo y rol inicial para finalizar."}
          </p>
        </div>

        {error && (
          <Alert tipo="error" alCerrar={() => setError("")}>
            {error}
          </Alert>
        )}

        {modo === "google-no-registrado" ? (
          <Button
            tipo="button"
            variante="relleno"
            className="boton--bloque"
            onClick={() => cambiarModo("registro")}
          >
            Registrarse
          </Button>
        ) : modo === "google-completar" ? (
          <form onSubmit={manejarSubmitGoogleCompletar} className="auth-form">
            <Input
              label="Nombre y apellido completo"
              nombre="modal-google-nombre"
              valor={regForm.nombre}
              onChange={(e) => actualizarReg("nombre", e.target.value)}
              placeholder="Ej. Juan Manuel Pérez"
              requerido
            />

            <Input
              label="Nombre del establecimiento / Estancia"
              nombre="modal-google-establecimiento"
              valor={regForm.establecimiento}
              onChange={(e) => actualizarReg("establecimiento", e.target.value)}
              placeholder="Ej. Estancia Las Acacias"
              requerido
            />

            <div className="campo-formulario">
              <label className="campo-formulario__label" htmlFor="modal-google-rol">
                Rol inicial de la cuenta <span className="campo-formulario__requerido">*</span>
              </label>
              <select
                id="modal-google-rol"
                value={regForm.rol}
                onChange={(e) => {
                  const rolVal = e.target.value;
                  actualizarReg("rol", rolVal);
                  actualizarReg("cargo", CARGOS_POR_ROL[rolVal] || "Colaborador");
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

            <Button
              tipo="submit"
              variante="relleno"
              cargando={cargando}
              className="boton--bloque"
            >
              Finalizar Registro con Google
            </Button>
          </form>
        ) : modo === "login" ? (
          <>
            <GoogleAuthButton
              modo="login"
              etiqueta="Continuar con Google"
              conSeparador={false}
              alError={(msg) => setError(msg)}
            />

            <div className="auth-separador" aria-hidden="true">
              <span>o</span>
            </div>

            {necesitaVerificacion && (
              <div style={{ marginBottom: "12px", textAlign: "center" }}>
                <Button
                  variante="borde"
                  className="boton--bloque"
                  onClick={() => {
                    if (alCerrar) alCerrar();
                    if (alIrAVerificar) alIrAVerificar("", loginEmail);
                  }}
                >
                  ✉ Activar cuenta o reenviar correo
                </Button>
              </div>
            )}

            <form onSubmit={manejarSubmitLogin} className="auth-form">
              <Input
                label="Correo electrónico"
                tipo="email"
                nombre="modal-login-email"
                valor={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="ejemplo@vakera.com"
                requerido
              />

              <div className="campo-formulario">
                <label className="campo-formulario__label" htmlFor="modal-login-password">
                  Contraseña <span className="campo-formulario__requerido">*</span>
                </label>
                <div className="auth-input-password-wrap">
                  <input
                    id="modal-login-password"
                    type={mostrarLoginPass ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="campo-formulario__input"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarLoginPass((v) => !v)}
                    className="auth-input-eye-btn"
                    aria-label={mostrarLoginPass ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    <i
                      className={`fa-regular ${mostrarLoginPass ? "fa-eye-slash" : "fa-eye"}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              <div className="login-dropdown__olvido">
                <button
                  type="button"
                  onClick={() => {
                    if (alCerrar) alCerrar();
                    if (alIrARecuperar) alIrARecuperar();
                  }}
                  className="auth-link"
                >
                  ¿Has olvidado tu contraseña?
                </button>
              </div>

              <Button
                tipo="submit"
                variante="relleno"
                cargando={cargando}
                className="boton--bloque"
              >
                {cargando ? "Iniciando..." : "Iniciar sesión"}
              </Button>
            </form>

            <div className="auth-modal-pie">
              <p>
                ¿Primera vez en Vakera?{" "}
                <button
                  type="button"
                  onClick={() => cambiarModo("registro")}
                  className="auth-link auth-link--destacado"
                >
                  Regístrate
                </button>
              </p>
            </div>
          </>
        ) : registroCompletado ? (
          <div className="recuperar-exito" style={{ marginTop: "8px" }}>
            <Alert tipo="exito" titulo="¡Correo de activación enviado!">
              Te enviamos un correo a <strong>{registroCompletado.email}</strong> con tu código de
              activación de 6 dígitos. Revisá tu bandeja de entrada o spam.
            </Alert>

            <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <Button
                variante="relleno"
                className="boton--bloque"
                onClick={() => {
                  if (alCerrar) alCerrar();
                  if (alIrAVerificar) alIrAVerificar("", registroCompletado.email);
                }}
              >
                Ingresar Código de Activación
              </Button>

              <Button
                variante="borde"
                className="boton--bloque"
                onClick={() => cambiarModo("login")}
              >
                Volver a Iniciar sesión
              </Button>
            </div>
          </div>
        ) : pasoRegistro === 1 ? (
          <>
            <GoogleAuthButton
              modo="registro"
              etiqueta="Registrarse con Google"
              rol={regForm.rol}
              establecimiento={regForm.establecimiento}
              conSeparador={false}
              alError={(msg) => setError(msg)}
            />

            <div className="auth-separador" aria-hidden="true">
              <span>o</span>
            </div>

            <form onSubmit={manejarContinuarRegistro} className="auth-form">
              <Input
                label="Correo electrónico"
                tipo="email"
                nombre="modal-reg-email"
                valor={regForm.email}
                onChange={(e) => actualizarReg("email", e.target.value)}
                placeholder="juan@estancia.com"
                requerido
              />

              <div className="campo-formulario">
                <label className="campo-formulario__label" htmlFor="modal-reg-password">
                  Contraseña <span className="campo-formulario__requerido">*</span>
                </label>
                <div className="auth-input-password-wrap">
                  <input
                    id="modal-reg-password"
                    type={mostrarRegPass ? "text" : "password"}
                    value={regForm.password}
                    onChange={(e) => actualizarReg("password", e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    className="campo-formulario__input"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarRegPass((v) => !v)}
                    className="auth-input-eye-btn"
                    aria-label={mostrarRegPass ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    <i
                      className={`fa-regular ${mostrarRegPass ? "fa-eye-slash" : "fa-eye"}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              <Input
                label="Confirmar contraseña"
                tipo={mostrarRegPass ? "text" : "password"}
                nombre="modal-reg-confirmar"
                valor={regForm.confirmarPassword}
                onChange={(e) => actualizarReg("confirmarPassword", e.target.value)}
                placeholder="Repita la contraseña"
                requerido
              />

              <Button tipo="submit" variante="relleno" className="boton--bloque">
                Continuar
              </Button>
            </form>

            <div className="auth-modal-pie">
              <p>
                ¿Ya tenés una cuenta?{" "}
                <button
                  type="button"
                  onClick={() => cambiarModo("login")}
                  className="auth-link auth-link--destacado"
                >
                  Inicia sesión
                </button>
              </p>
            </div>
          </>
        ) : (
          <form onSubmit={manejarSubmitRegistro} className="auth-form">
            <Input
              label="Nombre y apellido completo"
              nombre="modal-reg-nombre"
              valor={regForm.nombre}
              onChange={(e) => actualizarReg("nombre", e.target.value)}
              placeholder="Ej. Juan Manuel Pérez"
              requerido
            />

            <Input
              label="Nombre del establecimiento / Estancia"
              nombre="modal-reg-establecimiento"
              valor={regForm.establecimiento}
              onChange={(e) => actualizarReg("establecimiento", e.target.value)}
              placeholder="Ej. Estancia Las Acacias"
              requerido
            />

            <div className="campo-formulario">
              <label className="campo-formulario__label" htmlFor="modal-reg-rol">
                Rol inicial de la cuenta <span className="campo-formulario__requerido">*</span>
              </label>
              <select
                id="modal-reg-rol"
                value={regForm.rol}
                onChange={(e) => {
                  const rolVal = e.target.value;
                  actualizarReg("rol", rolVal);
                  actualizarReg("cargo", CARGOS_POR_ROL[rolVal] || "Colaborador");
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
      </div>
    </div>
  );
}
