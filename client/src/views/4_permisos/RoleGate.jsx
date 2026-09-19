import { useAuth } from "../../context/AuthContext";
import { tienePermiso } from "./permisos.config";

export default function RoleGate({
  children,
  rolesPermitidos = [],
  permiso = null,
  fallback = null,
}) {
  const { rol } = useAuth();

  if (!rol) return fallback;

  if (permiso && !tienePermiso(rol, permiso)) {
    return fallback;
  }

  if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(rol)) {
    return fallback;
  }

  return children;
}
