const db = require("../config/db");

class SanidadModel {
  static listarAlertasYEventos() {
    return db.sanidad;
  }

  static obtenerAlertasActivas() {
    return db.sanidad.filter((item) => item.estado !== "Completado");
  }

  static registrarEvento(evento) {
    const nuevo = {
      id: `san-${Date.now()}`,
      ...evento,
      estado: evento.estado || "Pendiente",
      fechaRegistro: new Date().toISOString(),
    };
    db.sanidad.push(nuevo);
    return nuevo;
  }
}

module.exports = SanidadModel;
