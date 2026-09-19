import { useAuth } from "../../context/AuthContext";
import Alert from "../../components/ui/Alert";
import Button from "../../components/ui/Button";

export default function ProtectedRoute({
  children,
  rolesPermitidos = [],
  alIrALogin,
}) {
  const { estaAutenticado, rol, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="protegida-cargando">
        <p>Verificando credenciales de acceso...</p>
      </div>
    );
  }

  if (!estaAutenticado) {
    return (
      <div className="protegida-denegado">
        <Alert tipo="error" titulo="Acceso Restringido">
          Debes iniciar sesión para acceder a este módulo del sistema.
        </Alert>
        <Button
          variante="relleno"
          onClick={alIrALogin}
          style={{ marginTop: "16px" }}
        >
          Ir al Inicio de Sesión
        </Button>
      </div>
    );
  }

  if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(rol)) {
    return (
      <div className="protegida-denegado">
        <Alert tipo="advertencia" titulo="Permiso Insuficiente (RBAC)">
          Tu rol actual (<strong>{rol?.toUpperCase()}</strong>) no tiene autorización
          para acceder a esta sección. Roles permitidos: [
          {rolesPermitidos.join(", ")}].
        </Alert>
      </div>
    );
  }

  return children;
}
