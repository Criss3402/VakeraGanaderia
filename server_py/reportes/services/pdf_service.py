"""
Servicio para la generación de reportes oficiales en formato PDF con ReportLab.
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


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
