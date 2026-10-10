const prisma = require("../config/prisma");
const db = require("../config/db");

class InsumoModel {
  static async listarTodos() {
    try {
      const lista = await prisma.insumo.findMany({
        orderBy: { nombre: "asc" },
      });
      return lista;
    } catch (e) {
      console.warn("Fallback memoria para listar insumos:", e.message);
      return db.insumos;
    }
  }

  static async obtenerCriticos() {
    try {
      const lista = await prisma.insumo.findMany({
        where: {
          OR: [
            { requiereReposicion: true },
            { estado: "Bajo Stock" },
            { estado: "Crítico" },
          ],
        },
      });
      return lista;
    } catch {
      return db.insumos.filter(
        (item) => item.requiereReposicion || item.stockActual <= item.stockMinimo
      );
    }
  }

  static async registrar(insumo) {
    const stockActual = parseFloat(insumo.stockActual) || 0;
    const stockMinimo = parseFloat(insumo.stockMinimo) || 10;
    const requiereReposicion = stockActual <= stockMinimo;
    const estado = requiereReposicion ? "Bajo Stock" : "OK";

    try {
      const nuevo = await prisma.insumo.create({
        data: {
          nombre: insumo.nombre,
          categoria: insumo.categoria || "Fármaco",
          stockActual,
          stockMinimo,
          unidad: insumo.unidad || "Unidades",
          ubicacion: insumo.ubicacion || "Depósito Central",
          estado,
          requiereReposicion,
          icono: insumo.icono || "fa-box-archive",
        },
      });
      return nuevo;
    } catch (e) {
      console.warn("Fallback memoria para registrar insumo:", e.message);
      const nuevo = {
        id: `ins-${Date.now()}`,
        ...insumo,
        stockActual,
        stockMinimo,
        estado,
        requiereReposicion,
      };
      db.insumos.push(nuevo);
      return nuevo;
    }
  }

  static async actualizarStock(id, cantidadCambio, operacion = "sumar") {
    try {
      const actual = await prisma.insumo.findUnique({ where: { id } });
      if (!actual) throw new Error("Insumo no encontrado");

      const delta = parseFloat(cantidadCambio) || 0;
      const nuevoStock = operacion === "sumar"
        ? actual.stockActual + delta
        : Math.max(0, actual.stockActual - delta);

      const requiereReposicion = nuevoStock <= actual.stockMinimo;
      const estado = requiereReposicion ? "Bajo Stock" : "OK";

      return await prisma.insumo.update({
        where: { id },
        data: {
          stockActual: nuevoStock,
          requiereReposicion,
          estado,
        },
      });
    } catch (e) {
      const insumo = db.insumos.find((i) => i.id === id);
      if (insumo) {
        const delta = parseFloat(cantidadCambio) || 0;
        insumo.stockActual = operacion === "sumar"
          ? insumo.stockActual + delta
          : Math.max(0, insumo.stockActual - delta);
        insumo.requiereReposicion = insumo.stockActual <= insumo.stockMinimo;
        insumo.estado = insumo.requiereReposicion ? "Bajo Stock" : "OK";
        return insumo;
      }
      throw e;
    }
  }
}

module.exports = InsumoModel;
