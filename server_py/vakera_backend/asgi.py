"""
ASGI config for vakera_backend project (HTTP + WebSocket via Django Channels).
"""
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vakera_backend.settings")
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
import core.routing
from core.ws_auth import JWTAuthMiddleware

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(
            URLRouter(core.routing.websocket_urlpatterns)
        ),
    }
)
