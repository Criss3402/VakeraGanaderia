"""
Rutas para el subsistema de Reportes.
"""
from django.urls import path

from reportes.views import (
    ExportarExcelStockView,
    ExportarPdfHaciendaView,
    ExportarPdfMargenBrutoView,
    ResumenEjecutivoView,
)

urlpatterns = [
    path("resumen-ejecutivo", ResumenEjecutivoView.as_view(), name="reportes-resumen"),
    path("exportar-pdf", ExportarPdfHaciendaView.as_view(), name="reportes-exportar-pdf"),
    path("exportar-margen-bruto", ExportarPdfMargenBrutoView.as_view(), name="reportes-exportar-margen-bruto"),
    path("exportar-excel", ExportarExcelStockView.as_view(), name="reportes-exportar-excel"),
]
