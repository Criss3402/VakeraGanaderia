"""
Fixtures globales de pytest para el backend Python de Vakera.

Los tokens se firman con el mismo JWT_SECRET y algoritmo que usa
`core.authentication.UnifiedJWTAuthentication`, con la misma forma que el
payload emitido por `generarToken` de Node (id, email, rol, establecimientoId).
"""
import time

import jwt
import pytest
from django.conf import settings
from rest_framework.test import APIClient


@pytest.fixture
def make_token():
    """Fábrica de JWT reales para tests."""

    def _make_token(
        rol="dueno",
        establecimiento_id="est-A",
        user_id="usr-test-1",
        email="test@example.test",
        exp_delta=3600,
        secret=None,
        extra=None,
    ):
        payload = {
            "id": user_id,
            "email": email,
            "rol": rol,
            "establecimientoId": establecimiento_id,
            "exp": int(time.time()) + exp_delta,
        }
        if extra:
            payload.update(extra)
        return jwt.encode(payload, secret or settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    return _make_token


@pytest.fixture
def api_client():
    """APIClient sin credenciales."""
    return APIClient()


@pytest.fixture
def auth_client(make_token):
    """Fábrica de APIClient autenticados con el rol indicado."""

    def _auth_client(rol="dueno", **kwargs):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {make_token(rol=rol, **kwargs)}")
        return client

    return _auth_client

