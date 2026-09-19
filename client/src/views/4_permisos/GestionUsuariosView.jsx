import { useEffect, useState } from "react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";
import {
  obtenerRolesYPermisos,
  obtenerUsuariosRegistrados,
  actualizarRolUsuario,
} from "../../api/permisos.api";
import { useAuth } from "../../context/AuthContext";

export default function GestionUsuariosView() {
  const { rol } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [rolesInfo, setRolesInfo] = useState({});
  const [matriz, setMatriz] = useState({});
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [actualizandoId, setActualizandoId] = useState(null);

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
        subtitulo="Control de accesos para el personal de campo, oficina y profesionales"
        destacada
      >
        {!esDueno && (
          <Alert tipo="info" style={{ marginBottom: "16px" }}>
            Estás visualizando la nómina en modo lectura. Solo el rol <strong>DUEÑO</strong> puede modificar roles y permisos.
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
                  {esDueno && <th>Cambiar Rol</th>}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.nombre}</strong>
                      <span className="tabla-subtexto">{u.cargo || "Personal"}</span>
                    </td>
                    <td>
                      <div>{u.email}</div>
                      <span className="tabla-subtexto">{u.establecimiento}</span>
                    </td>
                    <td>
                      <Badge variante="rol" tamano="md">
                        {u.rol?.toUpperCase()}
                      </Badge>
                    </td>
                    {esDueno && (
                      <td>
                        <select
                          value={u.rol}
                          disabled={actualizandoId === u.id}
                          onChange={(e) => manejarCambioRol(u.id, e.target.value)}
                          className="campo-formulario__input campo-formulario__input--sm"
                        >
                          <option value="dueno">Dueño</option>
                          <option value="capataz">Capataz</option>
                          <option value="peon">Peón</option>
                          <option value="oficina">Oficina</option>
                          <option value="veterinario">Veterinario</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
