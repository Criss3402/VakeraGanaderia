"""
Servicio para la generación de reportes oficiales en formato PDF con ReportLab.
"""
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def generar_pdf_hacienda(animales_data, metricas):
    """
    Genera un informe PDF oficial de estado de rodeo y trazabilidad ganadera.
    Retorna un buffer BytesIO listo para ser retornado como HTTP FileResponse.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()
    titulo_style = ParagraphStyle(
        "TituloVakera",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1e3a1e"),
    )
    subtitulo_style = ParagraphStyle(
        "SubtituloVakera",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#4a5568"),
    )
    h2_style = ParagraphStyle(
        "H2Vakera",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#2d3748"),
        spaceBefore=12,
        spaceAfter=6,
    )

    elements = []

    # Encabezado
    elements.append(Paragraph("VAKERA GANADERÍA — INFORME DE HACIENDA Y RODEOS", titulo_style))
    elements.append(Paragraph(f"Generado el: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')} | Establecimiento El Rancho, Corrientes", subtitulo_style))
    elements.append(Spacer(1, 15))

    # Métricas clave en tabla
    metricas_data = [
        ["Total Cabezas", "Peso Total Estimado", "Peso Promedio", "Estado Sanitario Normal"],
        [
            str(metricas.get("total_cabezas", 0)),
            f"{metricas.get('peso_total_kg', 0):,.0f} kg",
            f"{metricas.get('peso_promedio_kg', 0):.1f} kg",
            f"{metricas.get('porcentaje_saludable', 100):.1f}%",
        ],
    ]
    t_metricas = Table(metricas_data, colWidths=[130, 140, 130, 130])
    t_metricas.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2f855a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#f0fff4")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e0")),
    ]))
    elements.append(t_metricas)
    elements.append(Spacer(1, 20))

    # Detalle de Animales
    elements.append(Paragraph("Inventario Detallado de Hacienda por Caravana", h2_style))
    
    tabla_animales = [
        ["Caravana", "Categoría", "Raza", "Sexo", "Peso (Kg)", "Estado Sanitario"]
    ]

    for a in animales_data[:50]:  # Limitar a los primeros 50 para el documento
        tabla_animales.append([
            str(a.get("caravana", "-")),
            str(a.get("categoria", "-")),
            str(a.get("raza", "-")),
            str(a.get("sexo", "-")),
            f"{a.get('peso_kg', 0)} kg",
            str(a.get("estado_sanitario", "SALUDABLE")),
        ])

    if len(tabla_animales) == 1:
        tabla_animales.append(["Sin registros", "-", "-", "-", "-", "-"])

    t_animales = Table(tabla_animales, colWidths=[90, 95, 95, 70, 85, 95])
    t_animales.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2b6cb0")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("ALIGN", (4, 0), (4, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    elements.append(t_animales)

    # Pie de página
    elements.append(Spacer(1, 25))
    elements.append(Paragraph("Documento oficial emitido por el subsistema analítico de Vakera Ganadería. Confidencial para uso interno.", subtitulo_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def _fmt_num(val, dec=2):
    """Formatea número al estilo argentino/latino (coma decimal, punto de miles)."""
    try:
        n = float(val or 0)
    except (TypeError, ValueError):
        n = 0.0
    if dec == 0:
        return f"{round(n):,.0f}".replace(",", ".")
    s = f"{n:,.{dec}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def generar_pdf_margen_bruto(datos):
    """
    Genera una planilla PDF de Margen Bruto Ganadero (estilo ciclo completo)
    combinando datos reales del establecimiento (potreros, ganado, MAG, dólar)
    con indicadores productivos y costos operativos.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=28,
        leftMargin=28,
        topMargin=24,
        bottomMargin=24,
    )

    bordo = colors.HexColor("#8B1E1E")
    gris_texto = colors.HexColor("#1f2937")
    gris_suave = colors.HexColor("#4b5563")
    fondo_suave = colors.HexColor("#f9fafb")

    fecha_elab = datos.get("fechaElaboracion") or datetime.now().strftime("%B-%Y")
    titulo_modelo = datos.get("titulo") or "Ganadería bovina de ciclo completo"
    establecimiento = datos.get("establecimiento") or "Establecimiento Vakera"
    generado_por = datos.get("generadoPor") or "Usuario Vakera"
    fecha_hora_emision = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    dolar = float(datos.get("dolar") or 1) or 1.0
    novillo_usd_kg = float(datos.get("novilloUsdKg") or 0)

    styles = getSampleStyleSheet()
    meta_style = ParagraphStyle(
        "MetaMargenVakera",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8.5,
        leading=12,
        textColor=gris_suave,
    )

    elementos = []

    # Metadatos de auditoría (fecha/hora exacta, establecimiento y autor)
    elementos.append(
        Paragraph(
            f"Generado el: {fecha_hora_emision} | {establecimiento} | Emitido por: {generado_por}",
            meta_style,
        )
    )
    elementos.append(Spacer(1, 4))

    # 1. Encabezado principal
    encabezado_data = [
        [titulo_modelo, "", "Novillo", _fmt_num(novillo_usd_kg, 2), "U$S/Kg"],
        [f"Fecha de elaboración · {establecimiento}", fecha_elab, "Dólar", _fmt_num(dolar, 2), "$/U$S"],
    ]
    t_head = Table(encabezado_data, colWidths=[230, 120, 65, 70, 55])
    t_head.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 0), (0, 0), "Helvetica-Bold"),
        ("FONTNAME", (1, 1), (4, 1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (4, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), gris_texto),
        ("ALIGN", (1, 1), (1, 1), "CENTER"),
        ("ALIGN", (2, 0), (3, -1), "RIGHT"),
        ("ALIGN", (4, 0), (4, -1), "LEFT"),
        ("LINEBELOW", (0, 1), (-1, 1), 1.2, bordo),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elementos.append(t_head)
    elementos.append(Spacer(1, 8))

    # 2. Indicadores Productivos reales del Establecimiento
    ind = datos.get("indicadores") or {}
    ind_rows = [
        ["INDICADORES DEL RODEO Y PRODUCCIÓN (DATOS REALES)", "", ""],
        ["Total de cabezas registradas", _fmt_num(ind.get("totalCabezas", 0), 0), ""],
        ["Vientres / Vacas registradas", _fmt_num(ind.get("vientres", 0), 0), ""],
        ["Porcentaje de toros en rodeo", f"{_fmt_num(ind.get('torosPct', 0), 1)}%", ""],
        ["Peso total del rodeo (Kg)", _fmt_num(ind.get("pesoTotalKg", 0), 0), ""],
        ["Peso promedio por cabeza (Kg)", _fmt_num(ind.get("pesoPromedioKg", 0), 1), ""],
        ["Carga / Producción en pie (Kg/ha)", _fmt_num(ind.get("produccionCarneKgHa", 0), 1), ""],
        ["Tasa de sanidad saludable", f"{_fmt_num(ind.get('tasaSanitariaPct', 100), 1)}%", ""],
        ["Tasa de mortalidad registrada", f"{_fmt_num(ind.get('mortandadPct', 0), 1)}%", ""],
    ]
    if ind.get("evaluadas", 0) > 0:
        ind_rows.append(["Porcentaje de preñez (real)", f"{_fmt_num(ind.get('prenezPct', 0), 1)}%", ""])
    if ind.get("destetes", 0) > 0:
        ind_rows.append(["Porcentaje de destete (real)", f"{_fmt_num(ind.get('destetePct', 0), 1)}%", ""])
    if ind.get("edadPrimerServicioMeses"):
        ind_rows.append(["Edad primer servicio (meses)", _fmt_num(ind.get("edadPrimerServicioMeses", 0), 0), ""])
    if ind.get("reposicionHembrasPct", 0) > 0:
        ind_rows.append(["Reposición de hembras", f"{_fmt_num(ind.get('reposicionHembrasPct', 0), 1)}%", ""])
    if ind.get("vacasLecheras", 0) > 0:
        ind_rows.append(["Vacas lecheras registradas", _fmt_num(ind.get("vacasLecheras", 0), 0), ""])
        ind_rows.append(["Precio leche OCLA (U$S/L)", _fmt_num(ind.get("precioLecheUsdL", 0), 2), ""])

    t_ind = Table(ind_rows, colWidths=[260, 100, 180])
    t_ind.setStyle(TableStyle([
        ("SPAN", (0, 0), (2, 0)),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 0), (0, 0), "Helvetica-Bold"),
        ("FONTNAME", (1, 1), (1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.2),
        ("TEXTCOLOR", (0, 0), (-1, -1), gris_texto),
        ("ALIGN", (1, 1), (1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, bordo),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elementos.append(t_ind)
    elementos.append(Spacer(1, 8))

    # 3. Superficies y Recursos Forrajeros
    superficies = datos.get("superficies") or []
    sup_total = sum(float(s.get("ha") or 0) for s in superficies)
    sup_rows = [["SUPERFICIES Y RECURSOS FORRAJEROS", "ha", "%uso", "%sup"]]
    if not superficies:
        sup_rows.append(["Sin parcelas registradas", "0", "0%", "0%"])
    else:
        for s in superficies:
            ha = float(s.get("ha") or 0)
            uso = float(s.get("usoPct") if s.get("usoPct") is not None else 100)
            pct_sup = (ha / sup_total * 100) if sup_total > 0 else 0
            sup_rows.append([
                str(s.get("nombre") or "Parcela"),
                _fmt_num(ha, 1 if ha % 1 else 0),
                f"{_fmt_num(uso, 0)}%",
                f"{_fmt_num(pct_sup, 0)}%",
            ])
    sup_rows.append(["Superficie ganadera", _fmt_num(sup_total, 1 if sup_total % 1 else 0), "", ""])

    t_sup = Table(sup_rows, colWidths=[260, 90, 95, 95])
    t_sup.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.2),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, bordo),
        ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elementos.append(t_sup)
    elementos.append(Spacer(1, 8))

    # 4. Ingreso Bruto (Ventas / Valuación por Categoría)
    categorias = datos.get("categoriasIngreso") or []
    ingreso_bruto_usd = 0.0
    total_cabezas = 0
    ing_rows = [
        ["INGRESO BRUTO", "cabezas", "peso", "precio", "ingreso"],
        ["Ventas / Valuación por categoría", "cab", "Kg/cab", "u$s/Kg", "u$s"],
    ]
    if not categorias:
        ing_rows.append(["Sin categorías registradas", "0", "0", "0,00", "0"])
    else:
        for c in categorias:
            cab = int(float(c.get("cabezas") or 0))
            peso = float(c.get("pesoKgCab") or 0)
            precio_usd_kg = float(c.get("precioUsdKg") or 0)
            ingreso_usd = float(c.get("ingresoUsd") or (cab * peso * precio_usd_kg))
            total_cabezas += cab
            ingreso_bruto_usd += ingreso_usd
            ing_rows.append([
                str(c.get("categoria") or "Categoría"),
                _fmt_num(cab, 0),
                _fmt_num(peso, 0),
                _fmt_num(precio_usd_kg, 2),
                _fmt_num(ingreso_usd, 0),
            ])
    ing_rows.append(["Ingreso Bruto", "", "", "", _fmt_num(ingreso_bruto_usd, 0)])

    t_ing = Table(ing_rows, colWidths=[220, 75, 80, 80, 85])
    t_ing.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 0), (-1, 1), "Helvetica-Bold"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.2),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, bordo),
        ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elementos.append(t_ing)
    elementos.append(Spacer(1, 8))

    # 5. Costos
    costos = datos.get("costos") or {}
    vientres_ref = float(ind.get("vientres") or total_cabezas or 1) or 1.0
    cab_ref = float(total_cabezas or vientres_ref or 1) or 1.0
    ha_ref = float(sup_total or 1) or 1.0

    rubros_costo = [
        ("Compra de toros", float(costos.get("compraTorosUsd") or 0)),
        ("Comercialización", float(costos.get("comercializacionUsd") or 0)),
        ("Personal", float(costos.get("personalUsd") or 0)),
        ("Sanidad", float(costos.get("sanidadUsd") or 0)),
        ("Alimentación", float(costos.get("alimentacionUsd") or 0)),
        ("Amortizaciones", float(costos.get("amortizacionesUsd") or 0)),
    ]
    costo_total_usd = sum(v for _, v in rubros_costo)

    cost_rows = [["COSTOS", "u$s/vientre", "u$s/cab", "u$s/ha", "u$s"]]
    for nombre_rubro, monto_usd in rubros_costo:
        cost_rows.append([
            nombre_rubro,
            _fmt_num(monto_usd / vientres_ref, 2),
            _fmt_num(monto_usd / cab_ref, 2),
            _fmt_num(monto_usd / ha_ref, 2),
            _fmt_num(monto_usd, 0),
        ])
    cost_rows.append([
        "Costo Total",
        _fmt_num(costo_total_usd / vientres_ref, 2),
        _fmt_num(costo_total_usd / cab_ref, 2),
        _fmt_num(costo_total_usd / ha_ref, 2),
        _fmt_num(costo_total_usd, 0),
    ])

    t_cost = Table(cost_rows, colWidths=[220, 80, 80, 80, 80])
    t_cost.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.2),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, bordo),
        ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elementos.append(t_cost)
    elementos.append(Spacer(1, 8))

    # 6. Margen Bruto Final (U$S y ARS)
    mb_usd = ingreso_bruto_usd - costo_total_usd
    mb_ars = mb_usd * dolar

    mb_rows = [
        ["MARGEN BRUTO", "u$s/vientre", "u$s/cab", "u$s/ha", "u$s"],
        [
            "",
            _fmt_num(mb_usd / vientres_ref, 2),
            _fmt_num(mb_usd / cab_ref, 2),
            _fmt_num(mb_usd / ha_ref, 2),
            _fmt_num(mb_usd, 0),
        ],
        ["", "$/vientre", "$/cab", "$/ha", "$"],
        [
            "",
            _fmt_num(mb_ars / vientres_ref, 2),
            _fmt_num(mb_ars / cab_ref, 2),
            _fmt_num(mb_ars / ha_ref, 2),
            _fmt_num(mb_ars, 0),
        ],
    ]
    t_mb = Table(mb_rows, colWidths=[220, 80, 80, 80, 80])
    t_mb.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("BACKGROUND", (0, 1), (-1, 1), fondo_suave),
        ("BACKGROUND", (0, 3), (-1, 3), fondo_suave),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, bordo),
        ("LINEBELOW", (0, 3), (-1, 3), 1.2, bordo),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]))
    elementos.append(t_mb)

    doc.build(elementos)
    buffer.seek(0)
    return buffer
