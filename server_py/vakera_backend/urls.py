"""
URL configuration for vakera_backend project.
Prefijo canónico para todo el subsistema Python: /api/py/
"""
import hmac
from datetime import datetime

from core.responses import api_error, api_success
from core.ws_events import RealtimeNotificationService
from django.conf import settings
from django.urls import include, path
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView


class HealthCheckView(APIView):
    """
    GET /api/py/health
    Endpoint público para verificar la disponibilidad del microservicio Python/Django.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        return api_success(
            data={
                "servicio": "Vakera Ganadería - Python Backend",
                "framework": "Django 6.1 + Django REST Framework",
                "version": "1.0.0",
                "modulos_activos": ["reportes", "nutricion", "legacy_models (read-only)"],
                "prefijo_api": "/api/py/",
                "timestamp": datetime.now().isoformat(),
            },
            mensaje="Microservicio Python/Django operativo y listo para servir."
        )


class RealtimeEmitView(APIView):
    """
    POST /api/py/ws/emit
    Puente interno para que Node.js emita eventos en tiempo real vía Django Channels.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        secreto_recibido = request.headers.get("X-Internal-Secret", "")
        secreto_esperado = getattr(settings, "INTERNAL_WS_SECRET", "")
        if not secreto_esperado or not hmac.compare_digest(secreto_recibido, secreto_esperado):
            return api_error("No autorizado para emitir eventos WebSocket.", status_code=403)

        datos = request.data or {}
        payload = datos.get("payload")
        if not isinstance(payload, dict):
            return api_error("El campo payload debe ser un objeto JSON.", status_code=400)

        target_user_ids = datos.get("targetUserIds") or []
        broadcast = bool(datos.get("broadcast", False))

        if broadcast:
            RealtimeNotificationService.emit_broadcast(payload)
        if target_user_ids:
            RealtimeNotificationService.emit_to_users(target_user_ids, payload)

        return api_success(data={"emitido": True}, mensaje="Evento en tiempo real despachado.")


urlpatterns = [
    # Verificación de salud pública
    path("api/py/health", HealthCheckView.as_view(), name="health-check"),

    # Puente interno de WebSockets (Node.js -> Django Channels)
    path("api/py/ws/emit", RealtimeEmitView.as_view(), name="ws-emit"),

    # Módulos analíticos
    path("api/py/reportes/", include("reportes.urls")),
    path("api/py/nutricion/", include("nutricion.urls")),
]
