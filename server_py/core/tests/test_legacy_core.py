"""
Tests para autenticación unificada JWT y RBAC en Django.
"""
import time
import jwt
from django.test import TestCase
from django.conf import settings
from rest_framework.test import APIRequestFactory
from rest_framework.exceptions import AuthenticationFailed
from core.authentication import UnifiedJWTAuthentication, AuthUser
from core.permissions import IsDueno, IsPeon, CanAccessReports


class UnifiedJWTAuthenticationTestCase(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.auth = UnifiedJWTAuthentication()
        self.secret = settings.JWT_SECRET

    def _generar_token(self, payload, secret=None, expire_seconds=3600):
        data = {**payload}
        if "exp" not in data:
            data["exp"] = int(time.time()) + expire_seconds
        return jwt.encode(data, secret or self.secret, algorithm="HS256")

    def test_token_valido_autentica_correctamente(self):
        payload = {
            "id": "usr-test-123",
            "email": "dueno@vakera.com",
            "rol": "DUENO",  # En mayúsculas para comprobar normalización
        }
        token = self._generar_token(payload)

        request = self.factory.get("/api/py/health", HTTP_AUTHORIZATION=f"Bearer {token}")
        user, returned_token = self.auth.authenticate(request)

        self.assertIsNotNone(user)
        self.assertIsInstance(user, AuthUser)
        self.assertEqual(user.id, "usr-test-123")
        self.assertEqual(user.email, "dueno@vakera.com")
        self.assertEqual(user.rol, "dueno")  # Debe estar normalizado a minúsculas
        self.assertTrue(user.is_authenticated)

    def test_token_expirado_falla(self):
        payload = {
            "id": "usr-test-123",
            "email": "dueno@vakera.com",
            "rol": "dueno",
            "exp": int(time.time()) - 100,  # Ya expirado
        }
        token = self._generar_token(payload)

        request = self.factory.get("/api/py/health", HTTP_AUTHORIZATION=f"Bearer {token}")
        with self.assertRaises(AuthenticationFailed) as ctx:
            self.auth.authenticate(request)
        self.assertIn("expirado", str(ctx.exception).lower())

    def test_token_firma_invalida_falla(self):
        payload = {"id": "usr-test-123", "email": "dueno@vakera.com", "rol": "dueno"}
        token_falso = self._generar_token(payload, secret="clave_incorrecta")

        request = self.factory.get("/api/py/health", HTTP_AUTHORIZATION=f"Bearer {token_falso}")
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_sin_header_retorna_none(self):
        request = self.factory.get("/api/py/health")
        resultado = self.auth.authenticate(request)
        self.assertIsNone(resultado)


class RBACPermissionsTestCase(TestCase):
    def test_permisos_por_rol(self):
        user_dueno = AuthUser(user_id="1", email="d@v.com", rol="dueno")
        user_peon = AuthUser(user_id="2", email="p@v.com", rol="peon")

        perm_dueno = IsDueno()
        perm_peon = IsPeon()
        perm_reports = CanAccessReports()

        # Dummy request
        class MockRequest:
            def __init__(self, user):
                self.user = user

        # Dueño tiene permiso de dueño y de reportes
        self.assertTrue(perm_dueno.has_permission(MockRequest(user_dueno), None))
        self.assertTrue(perm_reports.has_permission(MockRequest(user_dueno), None))
        self.assertFalse(perm_peon.has_permission(MockRequest(user_dueno), None))

        # Peón no tiene permiso de dueño ni de reportes
        self.assertFalse(perm_dueno.has_permission(MockRequest(user_peon), None))
        self.assertFalse(perm_reports.has_permission(MockRequest(user_peon), None))
        self.assertTrue(perm_peon.has_permission(MockRequest(user_peon), None))
