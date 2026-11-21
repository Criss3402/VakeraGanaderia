"""
Tests para el motor de formulación nutricional y proyecciones.
"""
import time

import jwt
from django.conf import settings
from django.test import TestCase
from rest_framework.test import APIClient

from nutricion.services.racion_calculator import calcular_racion_bovina


class NutricionTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        token = jwt.encode(
            {"id": "usr-test", "email": "test@vakera.com", "rol": "dueno", "exp": int(time.time()) + 3600},
            settings.JWT_SECRET,
            algorithm="HS256"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_calculo_racion_servicio(self):
        resultado = calcular_racion_bovina(
            categoria="Novillo",
            peso_kg=350,
            ganancia_deseada_kg_dia=0.8,
            tipo_forraje="Pastura Verde",
        )

        self.assertIn("requerimientos", resultado)
        self.assertIn("racion_recomendada_diaria", resultado)
        self.assertGreater(resultado["requerimientos"]["consumo_materia_seca_kg_dia"], 0)
        self.assertGreater(resultado["racion_recomendada_diaria"]["forraje_verde_fresco_kg"], 0)
        self.assertGreater(resultado["racion_recomendada_diaria"]["concentrado_o_grano_kg"], 0)

    def test_endpoint_calcular_racion(self):
        response = self.client.post("/api/py/nutricion/calcular-racion", {
            "categoria": "Vaquillona",
            "peso_kg": 280,
            "ganancia_deseada_kg_dia": 0.7,
        }, format="json")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["ok"])
        self.assertIn("requerimientos", data["data"])

    def test_endpoint_proyeccion_peso(self):
        response = self.client.get("/api/py/nutricion/proyeccion-peso?gdp=0.8")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["ok"])
        self.assertEqual(len(data["data"]["curva_crecimiento"]), 4)
