"""
Tests para generación de PDFs, planillas Excel y endpoints de reportes.
"""
import time

import jwt
from django.conf import settings
from django.test import TestCase
from rest_framework.test import APIClient

from reportes.services.excel_service import generar_excel_inventario
from reportes.services.pdf_service import generar_pdf_hacienda


class ReportesTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.token_dueno = jwt.encode(
            {"id": "usr-1", "email": "dueno@vakera.com", "rol": "dueno", "exp": int(time.time()) + 3600},
            settings.JWT_SECRET,
            algorithm="HS256"
        )
        self.token_peon = jwt.encode(
            {"id": "usr-2", "email": "peon@vakera.com", "rol": "peon", "exp": int(time.time()) + 3600},
            settings.JWT_SECRET,
            algorithm="HS256"
        )

    def test_servicio_generar_pdf(self):
        animales = [
            {"caravana": "TEST-01", "categoria": "Vaca", "raza": "Brangus", "sexo": "Hembra", "peso_kg": 420, "estado_sanitario": "SALUDABLE"}
        ]
        metricas = {"total_cabezas": 1, "peso_total_kg": 420, "peso_promedio_kg": 420, "porcentaje_saludable": 100}
        
        pdf_buffer = generar_pdf_hacienda(animales, metricas)
        pdf_bytes = pdf_buffer.getvalue()
        
        # Validar que comience con la cabecera estándar de PDF (%PDF)
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))
        self.assertGreater(len(pdf_bytes), 500)

    def test_servicio_generar_excel(self):
        animales = [
            {"caravana": "TEST-01", "categoria": "Toro", "raza": "Braford", "sexo": "Macho", "peso_kg": 750, "estado_sanitario": "SALUDABLE"}
        ]
        insumos = [
            {"nombre": "Ivermectina", "categoria": "Fármaco", "stock_actual": 10, "stock_minimo": 5, "unidad": "Frascos", "ubicacion": "Botiquín", "estado": "OK", "requiere_reposicion": False}
        ]

        excel_buffer = generar_excel_inventario(animales, insumos)
        excel_bytes = excel_buffer.getvalue()

        # Validar cabecera PK de archivo ZIP / XLSX
        self.assertTrue(excel_bytes.startswith(b"PK"))
        self.assertGreater(len(excel_bytes), 500)

    def test_endpoint_peon_no_puede_exportar_pdf(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_peon}")
        response = self.client.get("/api/py/reportes/exportar-pdf")
        self.assertEqual(response.status_code, 403)
        data = response.json()
        self.assertFalse(data["ok"])

    def test_endpoint_dueno_puede_exportar_pdf(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_dueno}")
        response = self.client.get("/api/py/reportes/exportar-pdf")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")

    def test_endpoint_dueno_puede_exportar_excel(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_dueno}")
        response = self.client.get("/api/py/reportes/exportar-excel")
        self.assertEqual(response.status_code, 200)
        self.assertIn("spreadsheetml", response["Content-Type"])

    def test_endpoint_resumen_ejecutivo(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_dueno}")
        response = self.client.get("/api/py/reportes/resumen-ejecutivo")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["ok"])
        self.assertIn("hacienda", data["data"])
