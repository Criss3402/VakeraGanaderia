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
        fecha: ev.fechaProgramada ? ev.fechaProgramada.toISOString().split("T")[0] : null,
        fechaProgramada: ev.fechaProgramada ? ev.fechaProgramada.toISOString().split("T")[0] : null,
        responsableNombre: ev.responsable ? ev.responsable.nombre : "Sin asignar",
        caravanaAnimal: ev.ganado ? ev.ganado.caravana : null,
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
      return db.sanidad.filter((item) => item.estado !== "Completado" && item.estado !== "Hecho");
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
          responsableId: evento.responsableId || null,
          ganadoId: evento.ganadoId || null,
        },
      });
      return {
        ...nuevo,
        fecha: nuevo.fechaProgramada ? nuevo.fechaProgramada.toISOString().split("T")[0] : null,
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

  static async actualizarEstado(id, nuevoEstado) {
    try {
      const act = await prisma.sanidadEvento.update({
        where: { id },
        data: { estado: nuevoEstado },
      });
      return {
        ...act,
        fechaProgramada: act.fechaProgramada ? act.fechaProgramada.toISOString().split("T")[0] : null,
      };
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
