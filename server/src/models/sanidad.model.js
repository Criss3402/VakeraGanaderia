const prisma = require("../config/prisma");
const db = require("../config/db");

class SanidadModel {
  static async listarAlertasYEventos() {
    try {
      const eventos = await prisma.sanidadEvento.findMany({
        include: { responsable: true, ganado: true },
        orderBy: { fechaProgramada: "asc" },
      });
      return eventos.map((ev) => ({
        ...ev,
        fecha: ev.fechaProgramada.toISOString().split("T")[0],
        responsableNombre: ev.responsable ? ev.responsable.nombre : "Sin asignar",
        caravanaAnimal: ev.ganado ? ev.ganado.caravana : null,
      }));
    } catch (e) {
      console.warn("Fallback memoria para sanidad:", e.message);
      return db.sanidad;
    }
  }

  static async obtenerAlertasActivas() {
    try {
      const activas = await prisma.sanidadEvento.findMany({
        where: { estado: { not: "Completado" } },
      });
      return activas;
    } catch {
      return db.sanidad.filter((item) => item.estado !== "Completado");
    }
  }

  static async registrarEvento(evento) {
    try {
      const nuevo = await prisma.sanidadEvento.create({
        data: {
          evento: evento.evento,
          tipo: evento.tipo || "Vacunación",
          lote: evento.lote || "Rodeo General",
          fechaProgramada: new Date(evento.fechaProgramada || Date.now()),
          estado: evento.estado || "Pendiente",
          prioridad: evento.prioridad || "Normal",
          icono: evento.icono || "fa-syringe",
          notas: evento.notas || null,
          responsableId: evento.responsableId || null,
          ganadoId: evento.ganadoId || null,
        },
      });
      return nuevo;
    } catch (e) {
      console.warn("Fallback memoria para registrar evento sanitario:", e.message);
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

  static async actualizarEstado(id, nuevoEstado) {
    try {
      return await prisma.sanidadEvento.update({
        where: { id },
        data: { estado: nuevoEstado },
      });
    } catch (e) {
      const ev = db.sanidad.find((s) => s.id === id);
      if (ev) {
        ev.estado = nuevoEstado;
        return ev;
      }
      throw e;
    }
  }
}

module.exports = SanidadModel;
