"""
Control de Acceso Basado en Roles (RBAC) para el backend Python en Vakera.
Compatible con los 5 roles canónicos del sistema: dueno, capataz, peon, oficina, veterinario.
"""
from rest_framework.permissions import BasePermission

ROLES = {
    "DUENO": "dueno",
    "CAPATAZ": "capataz",
    "PEON": "peon",
    "OFICINA": "oficina",
    "VETERINARIO": "veterinario",
}


def require_roles(*roles_permitidos):
    """Fábrica de permisos dinámicos según lista de roles permitidos."""
    class DynamicRolePermission(BasePermission):
        message = "Acceso denegado: rol no autorizado para esta operación."

        def has_permission(self, request, view):
            if not request.user or not getattr(request.user, "is_authenticated", False):
                return False
            user_rol = getattr(request.user, "rol", "").lower()
            return user_rol in [r.lower() for r in roles_permitidos]

    return DynamicRolePermission


class IsDueno(BasePermission):
    message = "Acceso denegado: se requiere rol de Dueño."

    def has_permission(self, request, view):
        return bool(request.user and getattr(request.user, "rol", "").lower() == ROLES["DUENO"])


class IsCapataz(BasePermission):
    message = "Acceso denegado: se requiere rol de Capataz."

    def has_permission(self, request, view):
        return bool(request.user and getattr(request.user, "rol", "").lower() == ROLES["CAPATAZ"])


class IsOficina(BasePermission):
    message = "Acceso denegado: se requiere rol de Oficina."

    def has_permission(self, request, view):
        return bool(request.user and getattr(request.user, "rol", "").lower() == ROLES["OFICINA"])


class IsPeon(BasePermission):
    message = "Acceso denegado: se requiere rol de Peón."

    def has_permission(self, request, view):
        return bool(request.user and getattr(request.user, "rol", "").lower() == ROLES["PEON"])


class IsVeterinario(BasePermission):
    message = "Acceso denegado: se requiere rol de Veterinario."

    def has_permission(self, request, view):
        return bool(request.user and getattr(request.user, "rol", "").lower() == ROLES["VETERINARIO"])


class CanAccessReports(BasePermission):
    """Permiso para reportes y balances: Dueño, Oficina, Capataz y Veterinario."""
    message = "Acceso denegado: rol no autorizado para consultar reportes."

    def has_permission(self, request, view):
        if not request.user or not getattr(request.user, "is_authenticated", False):
            return False
        user_rol = getattr(request.user, "rol", "").lower()
        return user_rol in [ROLES["DUENO"], ROLES["OFICINA"], ROLES["CAPATAZ"], ROLES["VETERINARIO"]]
