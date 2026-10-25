"""
Controladores / Vistas para la generación y consulta de reportes analíticos.
"""
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework import status
from django.db.models import Avg, Sum, Count
from core.permissions import CanAccessReports
from core.responses import api_success, api_error
from legacy_models.models import Ganado, Insumo, SanidadEvento, ParteDiario
from reportes.services.pdf_service import generar_pdf_hacienda
from reportes.services.excel_service import generar_excel_inventario


def _obtener_datos_hacienda():
    """Consulta la base de datos o retorna una muestra calculada si no hay registros aún."""
    try:
        qs = Ganado.objects.all()
        total = qs.count()
        if total > 0:
            agg = qs.aggregate(
                peso_promedio=Avg("peso_kg"),
                peso_total=Sum("peso_kg"),
            )
            saludables = qs.filter(estado_sanitario="SALUDABLE").count()
            porcentaje_saludable = (saludables / total) * 100 if total else 100
            
            # Categorización
            por_categoria = {}
            for c in qs.values("categoria").annotate(cant=Count("id")):
                por_categoria[c["categoria"]] = c["cant"]

            animales_lista = list(qs.values("caravana", "categoria", "raza", "sexo", "peso_kg", "estado_sanitario", "fecha_registro"))

            metricas = {
                "total_cabezas": total,
                "peso_promedio_kg": round(agg["peso_promedio"] or 0, 1),
                "peso_total_kg": round(agg["peso_total"] or 0, 1),
                "porcentaje_saludable": round(porcentaje_saludable, 1),
                "por_categoria": por_categoria,
            }
            return animales_lista, metricas
    except Exception as e:
        # Fallback si las tablas unmanaged aún no existen en el entorno de pruebas
        pass

    return [], {
        "total_cabezas": 0,
        "peso_promedio_kg": 0,
        "peso_total_kg": 0,
        "porcentaje_saludable": 100,
        "por_categoria": {},
    }


def _obtener_datos_insumos():
    try:
        qs = Insumo.objects.all()
        if qs.exists():
            return list(qs.values("nombre", "categoria", "stock_actual", "stock_minimo", "unidad", "ubicacion", "estado", "requiere_reposicion"))
    except Exception:
        pass
    return []


class ResumenEjecutivoView(APIView):
    """

    Retorna métricas cuantitativas consolidadas para Dueño y Oficina.
    """
    permission_classes = [CanAccessReports]

    def get(self, request):
        try:
            animales, metricas_ganado = _obtener_datos_hacienda()
            
            # Sanidad defensiva
            try:
                eventos_pendientes = SanidadEvento.objects.filter(estado__iexact="Pendiente").count()
            except Exception:
                eventos_pendientes = 0
            
            # Insumos defensivos
            try:
                insumos_criticos = Insumo.objects.filter(requiere_reposicion=True).count()
            except Exception:
                insumos_criticos = 0

            # Partes defensivos
            try:
                partes_pendientes = ParteDiario.objects.filter(estado="PENDIENTE").count()
            except Exception:
                partes_pendientes = 0

            resumen = {
                "hacienda": metricas_ganado,
                "sanidad": {
                    "eventos_pendientes": eventos_pendientes,
                },
                "inventario": {
                    "insumos_en_alerta": insumos_criticos,
                },
                "operaciones": {
                    "partes_sin_revisar": partes_pendientes,
                },
                "generado_por": {
                    "usuario_id": request.user.id,
                    "email": request.user.email,
                    "rol": request.user.rol,
                }
            }
            return api_success(data=resumen, mensaje="Resumen ejecutivo calculado exitosamente.")
        except Exception as e:
            return api_error(mensaje=f"Error al calcular resumen: {str(e)}", status_code=500)


class ExportarPdfHaciendaView(APIView):
    """
    GET /api/py/reportes/exportar-pdf
    Genera y descarga un informe formal de hacienda en formato PDF.
    """
    permission_classes = [CanAccessReports]

    def get(self, request):
        try:
            animales, metricas = _obtener_datos_hacienda()
            pdf_buffer = generar_pdf_hacienda(animales, metricas)
            
            response = HttpResponse(pdf_buffer.getvalue(), content_type="application/pdf")
            response["Content-Disposition"] = 'attachment; filename="vakera_informe_hacienda.pdf"'
            return response
        except Exception as e:
            return api_error(mensaje=f"Error al generar PDF: {str(e)}", status_code=500)


class ExportarExcelStockView(APIView):
    """
    Genera y descarga una planilla Excel (.xlsx) con el inventario completo.
    """
    permission_classes = [CanAccessReports]

    def get(self, request):
        try:
            animales, _ = _obtener_datos_hacienda()
            insumos = _obtener_datos_insumos()
            excel_buffer = generar_excel_inventario(animales, insumos)

            response = HttpResponse(
                excel_buffer.getvalue(),
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            response["Content-Disposition"] = 'attachment; filename="vakera_inventario_general.xlsx"'
            return response
        except Exception as e:
            return api_error(mensaje=f"Error al generar Excel: {str(e)}", status_code=500)
