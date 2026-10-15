"""
Servicio para la exportación de planillas de cálculo Excel (.xlsx) con openpyxl.
"""
import io
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side


def generar_excel_inventario(animales_data, insumos_data):
    """
    Genera un libro de trabajo Excel con hojas separadas para Ganado e Insumos.
    Retorna un buffer BytesIO.
    """
    wb = openpyxl.Workbook()
    
    # -------------------------------------------------------------
    # Hoja 1: Ganado y Hacienda
    # -------------------------------------------------------------
    ws_ganado = wb.active
    ws_ganado.title = "Inventario de Hacienda"

    # Estilos
    header_fill = PatternFill(start_color="1E3A1E", end_color="1E3A1E", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=14, bold=True, color="1E3A1E")
    thin_border = Border(
        left=Side(style="thin", color="CCCCCC"),
        right=Side(style="thin", color="CCCCCC"),
        top=Side(style="thin", color="CCCCCC"),
        bottom=Side(style="thin", color="CCCCCC")
    )

    ws_ganado["A1"] = "VAKERA GANADERÍA — INFORME CONSOLIDADO DE HACIENDA"
    ws_ganado["A1"].font = title_font
    ws_ganado["A2"] = f"Fecha de emisión: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
    ws_ganado["A2"].font = Font(italic=True, color="555555")

    headers_ganado = ["Caravana", "Categoría", "Raza", "Sexo", "Peso (Kg)", "Estado Sanitario", "Fecha Registro"]
    for col_idx, header in enumerate(headers_ganado, 1):
        cell = ws_ganado.cell(row=4, column=col_idx, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for row_idx, animal in enumerate(animales_data, 5):
        ws_ganado.cell(row=row_idx, column=1, value=animal.get("caravana", "")).alignment = Alignment(horizontal="center")
        ws_ganado.cell(row=row_idx, column=2, value=animal.get("categoria", ""))
        ws_ganado.cell(row=row_idx, column=3, value=animal.get("raza", ""))
        ws_ganado.cell(row=row_idx, column=4, value=animal.get("sexo", "")).alignment = Alignment(horizontal="center")
        ws_ganado.cell(row=row_idx, column=5, value=animal.get("peso_kg", 0)).alignment = Alignment(horizontal="right")
        ws_ganado.cell(row=row_idx, column=6, value=animal.get("estado_sanitario", "SALUDABLE")).alignment = Alignment(horizontal="center")
        ws_ganado.cell(row=row_idx, column=7, value=str(animal.get("fecha_registro", ""))[:10]).alignment = Alignment(horizontal="center")

        for col in range(1, 8):
            ws_ganado.cell(row=row_idx, column=col).border = thin_border

    # Autoajustar anchos
    for col in ws_ganado.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws_ganado.column_dimensions[col_letter].width = max(max_len + 3, 12)

    # -------------------------------------------------------------
    # Hoja 2: Insumos de Campo
    # -------------------------------------------------------------
    ws_insumos = wb.create_sheet(title="Insumos y Stock")
    ws_insumos["A1"] = "CONTROL DE INVENTARIO Y STOCK DE INSUMOS"
    ws_insumos["A1"].font = title_font

    headers_insumos = ["Nombre Insumo", "Categoría", "Stock Actual", "Stock Mínimo", "Unidad", "Ubicación", "Estado", "Requiere Reposición"]
    insumo_fill = PatternFill(start_color="2B6CB0", end_color="2B6CB0", fill_type="solid")

    for col_idx, header in enumerate(headers_insumos, 1):
        cell = ws_insumos.cell(row=3, column=col_idx, value=header)
        cell.fill = insumo_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for row_idx, insumo in enumerate(insumos_data, 4):
        ws_insumos.cell(row=row_idx, column=1, value=insumo.get("nombre", ""))
        ws_insumos.cell(row=row_idx, column=2, value=insumo.get("categoria", ""))
        ws_insumos.cell(row=row_idx, column=3, value=insumo.get("stock_actual", 0)).alignment = Alignment(horizontal="right")
        ws_insumos.cell(row=row_idx, column=4, value=insumo.get("stock_minimo", 0)).alignment = Alignment(horizontal="right")
        ws_insumos.cell(row=row_idx, column=5, value=insumo.get("unidad", "")).alignment = Alignment(horizontal="center")
        ws_insumos.cell(row=row_idx, column=6, value=insumo.get("ubicacion", ""))
        ws_insumos.cell(row=row_idx, column=7, value=insumo.get("estado", "")).alignment = Alignment(horizontal="center")
        ws_insumos.cell(row=row_idx, column=8, value="SÍ" if insumo.get("requiere_reposicion") else "NO").alignment = Alignment(horizontal="center")

        for col in range(1, 9):
            ws_insumos.cell(row=row_idx, column=col).border = thin_border

    for col in ws_insumos.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws_insumos.column_dimensions[col_letter].width = max(max_len + 3, 14)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
