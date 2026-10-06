const prisma = require("../config/prisma");
const db = require("../config/db");

class SanidadModel {
  static async listarAlertasYEventos() {
    try {
      const eventos = await prisma.sanidadEvento.findMany({
        orderBy: { fechaProgramada: "asc" },
      });
      return eventos.map((e) => ({
        ...e,
        fechaProgramada: e.fechaProgramada ? e.fechaProgramada.toISOString().split("T")[0] : null,
      }));
    } catch (err) {
      console.warn("[SanidadModel] Fallo al consultar Prisma, usando fallback en memoria:", err.message);
      return db.sanidad;
    }
  }

  static async obtenerAlertasActivas() {
    try {
      const todos = await this.listarAlertasYEventos();
      return todos.filter((item) => item.estado !== "Completado" && item.estado !== "Hecho");
    } catch {
      return db.sanidad.filter((item) => item.estado !== "Completado");
    }
  }

  static async registrarEvento(evento) {
    try {
      const nuevo = await prisma.sanidadEvento.create({
        data: {
          evento: evento.evento,
          tipo: evento.tipo || "Tratamiento",
          lote: evento.lote || "Rodeo General",
          fechaProgramada: evento.fechaProgramada ? new Date(evento.fechaProgramada) : new Date(),
          estado: evento.estado || "Pendiente",
          prioridad: evento.prioridad || "Normal",
          icono: evento.icono || "fa-syringe",
          notas: evento.notas || null,
        },
      });
      return {
        ...nuevo,
        fechaProgramada: nuevo.fechaProgramada ? nuevo.fechaProgramada.toISOString().split("T")[0] : null,
      };
    } catch (err) {
      console.warn("[SanidadModel] Fallo al guardar en Prisma, usando fallback:", err.message);
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
}

module.exports = SanidadModel;
