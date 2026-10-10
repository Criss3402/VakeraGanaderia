"""
Manejador global de excepciones para Django REST Framework en Vakera.
Garantiza que cualquier error o fallo retorne el formato canónico:
{ "ok": False, "error": "...", "detalles": ... }
"""
from django.db import OperationalError, DatabaseError
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def vakera_exception_handler(exc, context):
    # Interceptar errores de conectividad con la base de datos PostgreSQL
    if isinstance(exc, (OperationalError, DatabaseError)):
        return Response(
            {
                "ok": False,
                "error": "Servicio de base de datos no disponible. Asegúrese de que PostgreSQL esté iniciado con 'npm run db:up'.",
                "detalles": str(exc),
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    response = exception_handler(exc, context)

    if response is not None:
        custom_data = {
            "ok": False,
            "error": "Error de solicitud",
        }

        # Extraer el mensaje legible
        if isinstance(response.data, dict):
            if "detail" in response.data:
                custom_data["error"] = str(response.data["detail"])
            elif "error" in response.data:
                custom_data["error"] = str(response.data["error"])
            else:
                custom_data["error"] = "Error en los datos provistos."
                custom_data["detalles"] = response.data
        elif isinstance(response.data, list):
            custom_data["error"] = ", ".join([str(item) for item in response.data])
        else:
            custom_data["error"] = str(response.data)

        response.data = custom_data

    return response
