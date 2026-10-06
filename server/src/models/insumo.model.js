const prisma = require("../config/prisma");
const db = require("../config/db");

class InsumoModel {
  static async listarTodos() {
    try {
      const insumos = await prisma.insumo.findMany({
        orderBy: { nombre: "asc" },
      });
      return insumos;
    } catch (err) {
      console.warn("[InsumoModel] Fallo al consultar Prisma, usando fallback en memoria:", err.message);
      return db.insumos;
    }
  }

  static async obtenerCriticos() {
    try {
      const todos = await this.listarTodos();
      return todos.filter(
        (item) => item.requiereReposicion || Number(item.stockActual) <= Number(item.stockMinimo)
      );
    } catch {
      return db.insumos.filter(
        (item) => item.requiereReposicion || item.stockActual <= item.stockMinimo
      );
    }
  }

  static async registrar(insumo) {
    const esCritico = Number(insumo.stockActual) <= Number(insumo.stockMinimo);
    try {
      const nuevo = await prisma.insumo.create({
        data: {
          nombre: insumo.nombre,
          categoria: insumo.categoria || "Herramientas",
          stockActual: Number(insumo.stockActual) || 0,
          stockMinimo: Number(insumo.stockMinimo) || 5,
          unidad: insumo.unidad || "Unidades",
          ubicacion: insumo.ubicacion || "Depósito Central",
          estado: esCritico ? "Crítico" : "OK",
          requiereReposicion: esCritico,
          icono: insumo.icono || "fa-box-archive",
        },
      });
      return nuevo;
    } catch (err) {
      console.warn("[InsumoModel] Fallo al guardar en Prisma, usando fallback:", err.message);
      const nuevo = {
        id: `ins-${Date.now()}`,
        ...insumo,
        estado: esCritico ? "Crítico" : "Normal",
        requiereReposicion: esCritico,
      };
      db.insumos.push(nuevo);
      return nuevo;
    }
  }
}

module.exports = InsumoModel;
