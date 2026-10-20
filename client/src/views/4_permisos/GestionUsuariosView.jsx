import { useEffect, useState } from "react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";
import Modal from "../../components/ui/Modal";
import {
  obtenerRolesYPermisos,
  obtenerUsuariosRegistrados,
  actualizarRolUsuario,
  solicitarAnadirEmpleado,
  desvincularEmpleado,
} from "../../api/permisos.api";
import { useAuth } from "../../context/AuthContext";

const OPCIONES_ROL = [
  {
    id: "veterinario",
    icono: "fa-user-doctor",
    titulo: "Veterinario",
    cargoSugerido: "Médico Veterinario",
    desc: "Sanidad animal, planes de vacunación, recetas médicas y botiquín",
  },
  {
    id: "capataz",
    icono: "fa-clipboard-check",
    titulo: "Capataz",
    cargoSugerido: "Capataz General de Campo",
    desc: "Supervisión operativa, aprobación de partes diarios y control de hacienda",
  },
  {
    id: "peon",
    icono: "fa-tractor",
    titulo: "Peón de Campo",
    cargoSugerido: "Operario de Potrero",
    desc: "Carga de partes operativos, novedades de potrero y tareas diarias",
  },
  {
    id: "oficina",
    icono: "fa-briefcase",
    titulo: "Oficina / Admin",
    cargoSugerido: "Administración y Compras",
    desc: "Gestión de compras, control de stock y facturación de insumos",
  },
];

export default function GestionUsuariosView() {
  const { rol } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [rolesInfo, setRolesInfo] = useState({});
  const [matriz, setMatriz] = useState({});
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [actualizandoId, setActualizandoId] = useState(null);

  // Estados del Modal Flotante para Añadir Empleado
  const [modalAbierto, setModalAbierto] = useState(false);
  const [formulario, setFormulario] = useState({
    email: "",
    rol: "veterinario",
    cargo: "",
    mensaje: "",
  });
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [errorModal, setErrorModal] = useState(null);
  const [desvinculandoId, setDesvinculandoId] = useState(null);

  async function cargarDatos() {
    setCargando(true);
    setError(null);
    try {
      const [resRoles, resUsuarios] = await Promise.all([
        obtenerRolesYPermisos(),
        obtenerUsuariosRegistrados(),
      ]);

      if (resRoles?.data) {
        setRolesInfo(resRoles.data.roles || {});
        setMatriz(resRoles.data.matrizPermisos || {});
      }
      if (resUsuarios?.data) {
        setUsuarios(resUsuarios.data);
      }
    } catch (err) {
      setError(err.message || "Error al cargar usuarios y roles");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  async function manejarCambioRol(idUsuario, nuevoRol) {
    setActualizandoId(idUsuario);
    setMensaje(null);
    setError(null);

    try {
      const res = await actualizarRolUsuario(idUsuario, nuevoRol);
      setMensaje(res.mensaje || "Rol actualizado exitosamente");
      await cargarDatos();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el rol");
    } finally {
      setActualizandoId(null);
    }
  }

  async function manejarEnviarSolicitud(e) {
    e.preventDefault();
    setErrorModal(null);

    if (!formulario.email.trim()) {
      setErrorModal("Debe ingresar el correo electrónico del empleado.");
      return;
    }

    setEnviandoSolicitud(true);
    try {
      const rolSeleccionado = OPCIONES_ROL.find((r) => r.id === formulario.rol);
      const res = await solicitarAnadirEmpleado({
        email: formulario.email.trim(),
        rol: formulario.rol,
        cargo: formulario.cargo.trim() || rolSeleccionado?.cargoSugerido,
        mensaje: formulario.mensaje.trim() || undefined,
      });

      setMensaje(res.mensaje || "Empleado/Veterinario vinculado correctamente al establecimiento.");
      setModalAbierto(false);
      setFormulario({ email: "", rol: "veterinario", cargo: "", mensaje: "" });
      await cargarDatos();
    } catch (err) {
      setErrorModal(
        err.message ||
          "No se pudo completar la solicitud. Verifique que el correo esté previamente registrado en Vakera."
      );
    } finally {
      setEnviandoSolicitud(false);
    }
  }

  async function manejarDesvincular(idUsuario, nombre) {
    const confirmado = window.confirm(
      `¿Está seguro de que desea desvincular a ${nombre} de este establecimiento? Pasará a estado sin asignar.`
    );
    if (!confirmado) return;

    setDesvinculandoId(idUsuario);
    setMensaje(null);
    setError(null);

    try {
      const res = await desvincularEmpleado(idUsuario);
      setMensaje(res.mensaje || `${nombre} ha sido desvinculado del establecimiento.`);
      await cargarDatos();
    } catch (err) {
      setError(err.message || "No se pudo desvincular al usuario.");
    } finally {
      setDesvinculandoId(null);
    }
  }

  const esDueno = rol === "dueno";

  return (
    <div className="gestion-usuarios-contenedor">
      {mensaje && (
        <Alert tipo="exito" alCerrar={() => setMensaje(null)}>
          {mensaje}
        </Alert>
      )}
      {error && (
        <Alert tipo="error" alCerrar={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card
        titulo="Gestión de Usuarios y Asignación de Roles (RBAC)"
        subtitulo="Control de accesos para el personal de campo, oficina y profesionales del establecimiento"
        destacada
        accion={
          esDueno && (
            <button
              type="button"
              onClick={() => {
                setErrorModal(null);
                setFormulario({ email: "", rol: "veterinario", cargo: "", mensaje: "" });
                setModalAbierto(true);
              }}
              className="boton-anadir-empleado"
              id="btn-anadir-empleado"
            >
              <i className="fa-solid fa-user-plus"></i> Añadir Empleado / Veterinario
            </button>
          )
        }
      >
        {!esDueno && (
          <Alert tipo="info" style={{ marginBottom: "16px" }}>
            Estás visualizando la nómina en modo lectura. Solo el rol <strong>DUEÑO</strong> puede modificar roles y enviar solicitudes para incorporar personal.
          </Alert>
        )}

        {cargando ? (
          <p className="texto-muted">Cargando nómina de usuarios...</p>
        ) : (
          <div className="tabla-responsive">
            <table className="tabla-vakera">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Contacto / Establecimiento</th>
                  <th>Rol Asignado</th>
                  {esDueno && <th style={{ textAlign: "right" }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.nombre}</strong>
                      <span className="tabla-subtexto">{u.cargo || "Personal de Establecimiento"}</span>
                    </td>
                    <td>
                      <div>{u.email}</div>
                      <span className="tabla-subtexto">{u.establecimiento || "Sin asignar"}</span>
                    </td>
                    <td>
                      <Badge variante="rol" tamano="md">
                        {u.rol?.toUpperCase()}
                      </Badge>
                    </td>
                    {esDueno && (
                      <td style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            justifyContent: "flex-end",
                          }}
                        >
                          {u.rol?.toLowerCase() === "dueno" ? (
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#182920", background: "#f1ecdd", padding: "5px 10px", borderRadius: "6px", border: "1px solid #ded7c4" }}>
                              Propietario Titular
                            </span>
                          ) : (
                            <select
                              value={u.rol?.toLowerCase() || "peon"}
                              disabled={actualizandoId === u.id || desvinculandoId === u.id}
                              onChange={(e) => manejarCambioRol(u.id, e.target.value)}
                              className="campo-formulario__input campo-formulario__input--sm"
                              title="Cambiar rol"
                            >
                              <option value="capataz">Capataz</option>
                              <option value="peon">Peón</option>
                              <option value="oficina">Oficina</option>
                              <option value="veterinario">Veterinario</option>
                            </select>
                          )}

                          {u.rol?.toLowerCase() !== "dueno" && (
                            <button
                              type="button"
                              disabled={desvinculandoId === u.id}
                              onClick={() => manejarDesvincular(u.id, u.nombre)}
                              className="boton-desvincular"
                              title={`Desvincular a ${u.nombre} del establecimiento`}
                            >
                              <i className="fa-solid fa-user-minus"></i> Desvincular
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {usuarios.length <= 1 && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  background: "#fcfbf8",
                  border: "1px dashed #d5ccba",
                  borderRadius: "12px",
                  textAlign: "center",
                }}
              >
                <i
                  className="fa-solid fa-users"
                  style={{ fontSize: "1.75rem", color: "#8fb56b", marginBottom: "8px", display: "block" }}
                ></i>
                <p
                  style={{
                    fontWeight: 700,
                    color: "#182920",
                    fontSize: "0.95rem",
                    marginBottom: "4px",
                  }}
                >
                  No hay empleados ni veterinarios asignados a este establecimiento
                </p>
                <p
                  style={{
                    fontSize: "0.82rem",
                    color: "#6a7d6e",
                    maxWidth: "520px",
                    margin: "0 auto 14px auto",
                    lineHeight: "1.4",
                  }}
                >
                  Cada empleado o veterinario debe registrarse primero con su correo en Vakera. Luego podés agregarlo enviando una solicitud para vincularlo a tu campo.
                </p>
                {esDueno && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorModal(null);
                      setFormulario({ email: "", rol: "veterinario", cargo: "", mensaje: "" });
                      setModalAbierto(true);
                    }}
                    className="boton-anadir-empleado"
                  >
                    <i className="fa-solid fa-user-plus"></i> Añadir Empleado / Veterinario
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Modal Flotante: Añadir Empleado / Mandar Solicitud */}
      <Modal
        abierto={modalAbierto}
        alCerrar={() => !enviandoSolicitud && setModalAbierto(false)}
        titulo="Añadir Personal / Profesional al Establecimiento"
        anchoMaximo="600px"
      >
        <form onSubmit={manejarEnviarSolicitud} className="formulario-solicitud-grid">
          {/* Mensaje de requisito de registro */}
          <div
            style={{
              background: "#eef4e8",
              border: "1px solid #c3dbc0",
              padding: "12px 16px",
              borderRadius: "10px",
              fontSize: "0.82rem",
              color: "#223d24",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <i
              className="fa-solid fa-circle-check"
              style={{ color: "#33512f", fontSize: "1.1rem", marginTop: "2px" }}
            ></i>
            <div>
              <strong>Requisito previo obligatorio:</strong> Cada empleado o veterinario debe
              haberse <u>registrado previamente</u> en Vakera con su correo. Si aún no tiene cuenta,
              solicítale que se registre antes de vincularlo.
            </div>
          </div>

          {errorModal && (
            <div
              style={{
                background: "#fdf2f0",
                border: "1px solid #eecbc7",
                color: "#96281b",
                padding: "12px 16px",
                borderRadius: "10px",
                fontSize: "0.84rem",
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
              }}
            >
              <i
                className="fa-solid fa-triangle-exclamation"
                style={{ marginTop: "2px", fontSize: "1rem" }}
              ></i>
              <div>{errorModal}</div>
            </div>
          )}

          {/* Campo Email */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.84rem",
                fontWeight: "700",
                color: "#182920",
                marginBottom: "6px",
              }}
            >
              Correo Electrónico del Usuario Registrado <span style={{ color: "#c0392b" }}>*</span>
            </label>
            <input
              type="email"
              required
              value={formulario.email}
              onChange={(e) => setFormulario({ ...formulario, email: e.target.value })}
              placeholder="ejemplo: veterinario@vakera.com o capataz@vakera.com"
              className="campo-formulario__input"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #ded7c4",
                fontSize: "0.9rem",
              }}
              autoFocus
            />
            <span style={{ fontSize: "0.75rem", color: "#6a7d6e", marginTop: "4px", display: "block" }}>
              El sistema verificará que este correo pertenezca a un usuario registrado.
            </span>
          </div>

          {/* Selector de Rol */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.84rem",
                fontWeight: "700",
                color: "#182920",
                marginBottom: "6px",
              }}
            >
              Rol a Desempeñar en el Establecimiento <span style={{ color: "#c0392b" }}>*</span>
            </label>
            <div className="roles-selector-grid">
              {OPCIONES_ROL.map((r) => {
                const activo = formulario.rol === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() =>
                      setFormulario({
                        ...formulario,
                        rol: r.id,
                        cargo: formulario.cargo || r.cargoSugerido,
                      })
                    }
                    className={`rol-card-option ${activo ? "rol-card-option--activo" : ""}`}
                  >
                    <div className="rol-card-option__titulo">
                      <i className={`fa-solid ${r.icono}`} style={{ color: activo ? "#33512f" : "#6a7d6e" }}></i>
                      <span>{r.titulo}</span>
                    </div>
                    <p className="rol-card-option__desc">{r.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cargo específico */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.84rem",
                fontWeight: "700",
                color: "#182920",
                marginBottom: "6px",
              }}
            >
              Puesto o Denominación del Cargo (Opcional)
            </label>
            <input
              type="text"
              value={formulario.cargo}
              onChange={(e) => setFormulario({ ...formulario, cargo: e.target.value })}
              placeholder={
                formulario.rol === "veterinario"
                  ? "Ej: Médico Veterinario de Cabecera"
                  : formulario.rol === "capataz"
                  ? "Ej: Capataz General de Manga"
                  : formulario.rol === "oficina"
                  ? "Ej: Administración & Liquidaciones"
                  : "Ej: Operario de Potrero Norte"
              }
              className="campo-formulario__input"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #ded7c4",
                fontSize: "0.9rem",
              }}
            />
          </div>

          {/* Mensaje de Solicitud */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.84rem",
                fontWeight: "700",
                color: "#182920",
                marginBottom: "6px",
              }}
            >
              Mensaje o Instrucciones de Incorporación (Opcional)
            </label>
            <textarea
              rows={2}
              value={formulario.mensaje}
              onChange={(e) => setFormulario({ ...formulario, mensaje: e.target.value })}
              placeholder="Instrucciones iniciales o bienvenida para el empleado o profesional..."
              className="campo-formulario__input"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #ded7c4",
                fontSize: "0.88rem",
                resize: "none",
              }}
            />
          </div>

          {/* Botones de acción del Modal */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "10px",
              paddingTop: "14px",
              borderTop: "1px solid #ded7c4",
            }}
          >
            <button
              type="button"
              disabled={enviandoSolicitud}
              onClick={() => setModalAbierto(false)}
              className="boton"
              style={{
                background: "#f1ecdd",
                color: "#182920",
                padding: "10px 18px",
                borderRadius: "8px",
                fontWeight: 600,
                border: "1px solid #ded7c4",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviandoSolicitud}
              className="boton-anadir-empleado"
              style={{ padding: "10px 22px" }}
            >
              {enviandoSolicitud ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Vinculando...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i> Enviar Solicitud y Asignar
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Matriz interactiva de Permisos */}
      <div style={{ marginTop: "24px" }}>
        <Card
          titulo="Matriz de Permisos por Rol en Vakera"
          subtitulo="Capacidades operativas habilitadas para cada perfil"
        >
          <div className="matriz-roles-grid">
            {Object.entries(rolesInfo).map(([clave, info]) => {
              const permisosRol = matriz[clave]?.modulos || {};
              return (
                <div key={clave} className="matriz-rol-card">
                  <div className="matriz-rol-card__header">
                    <h4>{info.nombre}</h4>
                    <Badge variante="neutral" tamano="sm">
                      Nivel {info.nivel}
                    </Badge>
                  </div>
                  <p className="matriz-rol-card__desc">{info.descripcion}</p>

                  <div className="matriz-rol-card__lista">
                    <p className="matriz-rol-card__sub">Capacidades:</p>
                    <ul>
                      {Object.entries(permisosRol).map(([mod, habilitado]) => (
                        <li
                          key={mod}
                          className={habilitado ? "permiso--si" : "permiso--no"}
                        >
                          <span>{habilitado ? "✓" : "✕"}</span>
                          <span>{mod.replace(/([A-Z])/g, " $1").toLowerCase()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
