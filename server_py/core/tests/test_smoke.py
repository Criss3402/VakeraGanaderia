"""
Smoke tests de la infraestructura de testing de Django (Fase 1).
No requieren base de datos.
"""
from rest_framework.test import APIRequestFactory

from core.authentication import AuthUser, UnifiedJWTAuthentication


def test_health_es_publico_y_responde_200(api_client):
    response = api_client.get("/api/py/health")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert "reportes" in body["data"]["modulos_activos"]


def test_make_token_genera_token_aceptado_por_la_autenticacion_unificada(make_token):
    token = make_token(rol="DUENO", user_id="usr-smoke")
    request = APIRequestFactory().get("/api/py/health", HTTP_AUTHORIZATION=f"Bearer {token}")

    user, returned_token = UnifiedJWTAuthentication().authenticate(request)

    assert isinstance(user, AuthUser)
    assert user.id == "usr-smoke"
    assert user.rol == "dueno"  # normalizado a minúsculas
    assert returned_token == token

