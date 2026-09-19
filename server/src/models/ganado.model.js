const db = require("../config/db");

class GanadoModel {
  static listarTodos() {
    return db.ganado;
  }

  static buscarPorId(id) {
    return db.ganado.find((g) => g.id === id);
  }

  static buscarPorCaravana(caravana) {
    return db.ganado.find((g) => g.caravana.toLowerCase() === caravana.toLowerCase());
  }

  static obtenerMetricas() {
    const total = db.ganado.length;
    const porCategoria = db.ganado.reduce((acc, curr) => {
      acc[curr.categoria] = (acc[curr.categoria] || 0) + 1;
      return acc;
    }, {});

    const porEstadoSanitario = db.ganado.reduce((acc, curr) => {
      acc[curr.estadoSanitario] = (acc[curr.estadoSanitario] || 0) + 1;
      return acc;
    }, {});

    const pesoPromedio = total > 0
      ? Math.round(db.ganado.reduce((acc, curr) => acc + (curr.pesoKg || 0), 0) / total)
      : 0;

    return {
      totalCabezas: total,
      porCategoria,
      porEstadoSanitario,
      pesoPromedioKg: pesoPromedio,
      tasaMortalidadMensual: "0.8%",
    };
  }

  static registrar(animal) {
    const nuevo = {
      id: `gan-${Date.now()}`,
      ...animal,
      fechaRegistro: new Date().toISOString(),
    };
    db.ganado.push(nuevo);
    return nuevo;
  }
}

module.exports = GanadoModel;
