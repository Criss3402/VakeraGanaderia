"""
Middleware de autenticación JWT para conexiones WebSocket (Django Channels).
Valida ?token=<jwt> usando el mismo JWT_SECRET compartido con Express.js.
"""
from urllib.parse import parse_qs

from channels.middleware import BaseMiddleware
from rest_framework.exceptions import AuthenticationFailed

from core.authentication import UnifiedJWTAuthentication


class AnonUser:
    """Usuario anónimo para conexiones WebSocket sin token válido."""
    is_authenticated = False
    is_anonymous = True


class JWTAuthMiddleware(BaseMiddleware):
    """Lee ?token=<jwt> de la URL del WebSocket y completa scope['user']."""

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode("utf-8", errors="ignore"))
        token = query.get("token", [None])[0]

        if token:
            try:
                user, _ = UnifiedJWTAuthentication().validar_token(token)
                scope["user"] = user
            except AuthenticationFailed:
                scope["user"] = AnonUser()
        else:
            scope["user"] = AnonUser()

        return await super().__call__(scope, receive, send)
