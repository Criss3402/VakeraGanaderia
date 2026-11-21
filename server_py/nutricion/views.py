"""
Vistas para el módulo de nutrición y proyecciones biométricas.
"""
from core.responses import api_error, api_success
from legacy_models.models import Ganado
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from nutricion.services.racion_calculator import calcular_racion_bovina


class CalcularRacionView(APIView):
    """
    POST /api/py/nutricion/calcular-racion
    Calcula requerimientos nutricionales y fórmula de ración según categoría y peso.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}
        categoria = data.get("categoria", "Novillo")
        peso_kg = data.get("peso_kg", 320)
        ganancia = data.get("ganancia_deseada_kg_dia", 0.75)
        tipo_forraje = data.get("tipo_forraje", "Pastura Cultivada / Alfalfa")

        try:
            peso_kg = float(peso_kg)
            ganancia = float(ganancia)
        except (ValueError, TypeError):
            return api_error(
                mensaje="Los campos 'peso_kg' y 'ganancia_deseada_kg_dia' deben ser valores numéricos válidos.",
                status_code=400
            )

        if peso_kg <= 0 or ganancia <= 0:
            return api_error(
                mensaje="El peso y la ganancia esperada deben ser mayores a cero.",
                status_code=400
            )

        calculo = calcular_racion_bovina(
            categoria=categoria,
            peso_kg=peso_kg,
            ganancia_deseada_kg_dia=ganancia,
            tipo_forraje=tipo_forraje,
        )

        return api_success(
            data=calculo,
            mensaje="Ración nutricional calculada exitosamente por el motor bio-estadístico de Vakera."
        )


class ProyeccionPesoView(APIView):
    """
    GET /api/py/nutricion/proyeccion-peso?caravana=VAK-001&gdp=0.8
    Proyecta la ganancia de peso a 30, 60, 90 y 120 días para un animal o lote general.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        caravana = request.query_params.get("caravana")
        gdp_param = request.query_params.get("gdp", "0.75")

        try:
            gdp = float(gdp_param)
        except ValueError:
            gdp = 0.75

        peso_inicial = 300.0
        animal_info = None

        if caravana:
            try:
                est_id = getattr(request.user, "establecimiento_id", None)
                qs = Ganado.objects.filter(caravana__iexact=caravana.strip())
                if est_id:
                    qs = qs.filter(establecimiento_id=est_id)
                animal = qs.first()
                if animal:
                    peso_inicial = float(animal.peso_kg)
                    animal_info = {
                        "caravana": animal.caravana,
                        "categoria": animal.categoria,
                        "raza": animal.raza,
                        "peso_actual_kg": peso_inicial,
                    }
            except Exception:
                pass

        # Proyección lineal y amortiguada
        dias = [30, 60, 90, 120]
        proyeccion = []
        for d in dias:
            peso_proyectado = round(peso_inicial + (d * gdp), 1)
            ganancia_total = round(d * gdp, 1)
            proyeccion.append({
                "dias": d,
                "peso_estimado_kg": peso_proyectado,
                "ganancia_acumulada_kg": ganancia_total,
            })

        resultado = {
            "animal": animal_info or {"descripcion": "Rodeo promedio general", "peso_base_kg": peso_inicial},
            "ganancia_diaria_asumida_kg": gdp,
            "curva_crecimiento": proyeccion,
        }

        return api_success(data=resultado, mensaje="Curva de proyección biométrica calculada.")
