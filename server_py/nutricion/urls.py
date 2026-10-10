"""
Rutas para el subsistema de Nutrición.
"""
from django.urls import path
from nutricion.views import CalcularRacionView, ProyeccionPesoView

urlpatterns = [
    path("calcular-racion", CalcularRacionView.as_view(), name="nutricion-calcular-racion"),
    path("proyeccion-peso", ProyeccionPesoView.as_view(), name="nutricion-proyeccion-peso"),
]
