"""
Autenticación interoperable mediante JWT para Vakera.
Permite validar en Django los tokens generados por el backend de Express.js.
"""
import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed


class AuthUser:
    """Representación en memoria del usuario autenticado a partir del payload del JWT."""
    
    def __init__(self, user_id, email, rol, establecimiento_id=None, nombre=None):
        self.id = user_id
        self.pk = user_id
        self.email = email
        self.rol = (rol or "").lower()  # Normalización estricta según AGENTS.md Regla 3.2
        self.establecimiento_id = establecimiento_id
        self.nombre = nombre or email
        self.is_authenticated = True
        self.is_anonymous = False

    def __str__(self):
        return f"{self.email} ({self.rol})"

    def tiene_rol(self, *roles_permitidos):
        """Verifica si el rol del usuario coincide con alguno de los roles permitidos."""
        roles_normalizados = [r.lower() for r in roles_permitidos]
        return self.rol in roles_normalizados


class UnifiedJWTAuthentication(BaseAuthentication):
    """
    Middleware de autenticación para DRF.
    Decodifica el Bearer Token emitido por Express.js usando JWT_SECRET compartido.
    """

    def authenticate(self, request):
        auth_header = get_authorization_header(request).split()

        if not auth_header:
            return None

        if auth_header[0].lower() != b"bearer":
            return None

        if len(auth_header) == 1:
            raise AuthenticationFailed("Encabezado de autorización inválido: falta el token.")
        elif len(auth_header) > 2:
            raise AuthenticationFailed("Encabezado de autorización inválido: formato no soportado.")

        token = auth_header[1].decode("utf-8")
        return self.validar_token(token)

    def validar_token(self, token):
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("La sesión ha expirado. Por favor, volvé a iniciar sesión.")
        except jwt.InvalidTokenError as e:
            raise AuthenticationFailed(f"Token de sesión inválido: {e!s}")

        user_id = payload.get("id")
        email = payload.get("email", "")
        rol = payload.get("rol", "")
        establecimiento_id = payload.get("establecimientoId")

        if not user_id:
            raise AuthenticationFailed("El token no contiene un identificador de usuario válido.")

        user = AuthUser(user_id=user_id, email=email, rol=rol, establecimiento_id=establecimiento_id)
        return (user, token)
