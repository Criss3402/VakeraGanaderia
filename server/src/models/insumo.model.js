const db = require("../config/db");

class InsumoModel {
  static listarTodos() {
    return db.insumos;
  }

  static obtenerCriticos() {
    return db.insumos.filter(
      (item) => item.requiereReposicion || item.stockActual <= item.stockMinimo
    );
  }

  static registrar(insumo) {
    const nuevo = {
      id: `ins-${Date.now()}`,
      ...insumo,
      estado: insumo.stockActual <= insumo.stockMinimo ? "Crítico" : "Normal",
      requiereReposicion: insumo.stockActual <= insumo.stockMinimo,
    };
    db.insumos.push(nuevo);
    return nuevo;
  }
}

module.exports = InsumoModel;
