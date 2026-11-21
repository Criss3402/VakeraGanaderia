"""
Estandarización de respuestas HTTP para el backend Python en Vakera.
Espejo exacto de la convención de server/src/utils/apiResponse.js.
"""
from rest_framework import status
from rest_framework.response import Response


def api_success(data=None, mensaje=None, status_code=status.HTTP_200_OK):
    """Retorna una respuesta exitosa estandarizada: { ok: True, mensaje?, data? }"""
    payload = {"ok": True}
    if mensaje is not None:
        payload["mensaje"] = mensaje
    if data is not None:
        payload["data"] = data
    return Response(payload, status=status_code)


def api_error(mensaje="Ocurrió un error inesperado", status_code=status.HTTP_400_BAD_REQUEST, detalles=None):
    """Retorna una respuesta de error estandarizada: { ok: False, error, detalles? }"""
    payload = {
        "ok": False,
        "error": mensaje,
    }
    if detalles is not None:
        payload["detalles"] = detalles
    return Response(payload, status=status_code)
