"""
URL configuration for vakera_backend project.
Prefijo canónico para todo el subsistema Python: /api/py/
"""
from django.urls import path, include
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from core.responses import api_success
from datetime import datetime


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


urlpatterns = [
    # Verificación de salud pública
    path("api/py/health", HealthCheckView.as_view(), name="health-check"),

    # Módulos analíticos
    path("api/py/reportes/", include("reportes.urls")),
    path("api/py/nutricion/", include("nutricion.urls")),
]
