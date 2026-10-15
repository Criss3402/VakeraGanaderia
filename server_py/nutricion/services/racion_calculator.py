"""
Servicio para cálculo de balances nutricionales y formulación de raciones ganaderas.
Basado en modelos bio-matemáticos simplificados de nutrición bovina (NRC / INTA).
"""

# Requerimientos base aproximados según categoría y peso vivo (PV)
COEFICIENTES_CATEGORIA = {
    "ternero": {"cms_pct": 2.8, "pb_min": 15.0, "em_mcal": 2.6},
    "ternera": {"cms_pct": 2.8, "pb_min": 15.0, "em_mcal": 2.6},
    "novillo": {"cms_pct": 2.4, "pb_min": 12.0, "em_mcal": 2.4},
    "vaquillona": {"cms_pct": 2.3, "pb_min": 12.0, "em_mcal": 2.4},
    "vaca": {"cms_pct": 2.1, "pb_min": 10.5, "em_mcal": 2.2},
    "toro": {"cms_pct": 2.0, "pb_min": 11.0, "em_mcal": 2.3},
}


def calcular_racion_bovina(categoria, peso_kg, ganancia_deseada_kg_dia=0.75, tipo_forraje="Pastura Natural"):
    """
    Calcula el requerimiento diario de Materia Seca (MS), Proteína Bruta (PB)
    y propone una ración equilibrada entre forraje base y suplementación.
    """
    categoria_clean = (categoria or "novillo").lower().strip()
    coef = COEFICIENTES_CATEGORIA.get(categoria_clean, COEFICIENTES_CATEGORIA["novillo"])

    peso = max(float(peso_kg or 300), 50.0)
    gdp = max(float(ganancia_deseada_kg_dia or 0.75), 0.1)

    # 1. Consumo de Materia Seca (CMS) estimado en kg MS/día
    # Si la ganancia deseada es alta, el consumo relativo aumenta ligeramente
    cms_pct = coef["cms_pct"] + (0.15 if gdp > 0.8 else 0.0)
    cms_total_kg = round((peso * cms_pct) / 100.0, 2)

    # 2. Requerimientos de Proteína Bruta (PB)
    pb_objetivo_pct = coef["pb_min"] + (gdp * 1.5)
    pb_total_gr = round((cms_total_kg * (pb_objetivo_pct / 100.0)) * 1000.0, 1)

    # 3. Reparto de la Ración (Forraje vs Suplemento Concentrado)
    # Raciones pastoriles con suplementación estratégica:
    if gdp <= 0.5:
        # Mayoritariamente pastoril
        pct_forraje = 0.85
        pct_concentrado = 0.15
    elif gdp <= 0.9:
        # Mixto
        pct_forraje = 0.70
        pct_concentrado = 0.30
    else:
        # Intensivo / Engorde a corral
        pct_forraje = 0.50
        pct_concentrado = 0.50

    ms_forraje_kg = round(cms_total_kg * pct_forraje, 2)
    ms_concentrado_kg = round(cms_total_kg * pct_concentrado, 2)

    # Asumiendo 25% de MS en forraje fresco verde, kg tal cual = MS / 0.25
    tal_cual_forraje_fresco_kg = round(ms_forraje_kg / 0.25, 1)
    # Concentrado con 88% de MS
    tal_cual_concentrado_kg = round(ms_concentrado_kg / 0.88, 1)
    sal_mineral_gr = 70.0  # 70 gramos de sales minerales por animal/día

    return {
        "categoria": categoria,
        "peso_vivo_kg": peso,
        "ganancia_diaria_estimada_kg": gdp,
        "tipo_forraje_base": tipo_forraje,
        "requerimientos": {
            "consumo_materia_seca_kg_dia": cms_total_kg,
            "porcentaje_peso_vivo": round(cms_pct, 2),
            "proteina_bruta_objetivo_pct": round(pb_objetivo_pct, 1),
            "proteina_bruta_gr_dia": pb_total_gr,
        },
        "racion_recomendada_diaria": {
            "forraje_verde_fresco_kg": tal_cual_forraje_fresco_kg,
            "materia_seca_forraje_kg": ms_forraje_kg,
            "concentrado_o_grano_kg": tal_cual_concentrado_kg,
            "materia_seca_concentrado_kg": ms_concentrado_kg,
            "suplemento_mineral_gr": sal_mineral_gr,
        },
        "indicaciones_manejo": [
            f"Asegurar acceso irrestricto a agua limpia fresca (aprox. {round(peso * 0.10, 0)} litros/día).",
            "Suministrar el concentrado fraccionado en 2 tomas diarias si supera los 3 kg.",
            "Aclimatar el rodeo durante 7 a 10 días para evitar acidosis ruminal en dietas de alta ganancia.",
        ]
    }
