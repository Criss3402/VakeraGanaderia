const db = require("../config/db");

class ParteDiarioModel {
  static listarTodos() {
    return db.partesDiarios;
  }

  static obtenerPendientes() {
    return db.partesDiarios.filter((p) => p.estado === "Pendiente");
  }

  static registrar({ peonNombre, potrero, novedades, animalesRevisados, solicitudInsumos }) {
    const nuevo = {
      id: `pd-${Date.now()}`,
      fecha: new Date().toISOString().split("T")[0],
      peonNombre,
      potrero,
      novedades,
      animalesRevisados: Number(animalesRevisados) || 0,
      solicitudInsumos: solicitudInsumos || null,
      estado: "Pendiente",
      fechaCarga: new Date().toISOString(),
    };
    db.partesDiarios.unshift(nuevo);
    return nuevo;
  }

  static cambiarEstado(id, nuevoEstado, revisadoPor = "Supervisor") {
    const parte = db.partesDiarios.find((p) => p.id === id);
    if (!parte) {
      throw new Error("Parte diario no encontrado.");
    }
    parte.estado = nuevoEstado;
    parte.revisadoPor = revisadoPor;
    parte.fechaRevision = new Date().toISOString();
    return parte;
  }
}

module.exports = ParteDiarioModel;
