const prisma = require("../config/prisma");
const db = require("../config/db");

class SanidadModel {
  static async listarAlertasYEventos(establecimientoId) {
    try {
      const whereClause = establecimientoId ? { establecimientoId } : {};
      const eventos = await prisma.sanidadEvento.findMany({
        where: whereClause,
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
      const fuente = Array.isArray(db.sanidad) ? db.sanidad : [];
      const filtrados = establecimientoId
        ? fuente.filter((s) => s.establecimientoId === establecimientoId)
        : fuente;
      return filtrados.map((ev) => ({
        ...ev,
        fecha: ev.fechaProgramada || ev.fecha || null,
        fechaProgramada: ev.fechaProgramada || ev.fecha || null,
        responsableNombre: ev.responsable || "Sin asignar",
        caravanaAnimal: ev.caravanaAnimal || null,
      }));
    }
  }

  static async obtenerAlertasActivas(establecimientoId) {
    try {
      const todos = await this.listarAlertasYEventos(establecimientoId);
      return todos.filter((item) => item.estado !== "Completado" && item.estado !== "Hecho");
    } catch {
      const fuente = Array.isArray(db.sanidad) ? db.sanidad : [];
      const filtrados = establecimientoId
        ? fuente.filter((s) => s.establecimientoId === establecimientoId)
        : fuente;
      return filtrados.filter((item) => item.estado !== "Completado" && item.estado !== "Hecho");
    }
  }

  static async registrarEvento(evento, establecimientoId, establecimiento) {
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
          establecimientoId: establecimientoId || null,
          establecimiento: establecimiento || null,
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
        establecimientoId: establecimientoId || "est-el-rancho",
        establecimiento: establecimiento || "Mi Establecimiento",
        fechaRegistro: new Date().toISOString(),
      };
      if (!db.sanidad) db.sanidad = [];
      db.sanidad.push(nuevo);
      return nuevo;
    }
  }

  static async actualizarEstado(id, nuevoEstado, establecimientoId = null) {
    try {
      if (establecimientoId) {
        const existe = await prisma.sanidadEvento.findFirst({
          where: { id, establecimientoId },
          select: { id: true },
        });
        if (!existe) {
          const err = new Error("Evento sanitario no encontrado en este establecimiento.");
          err.status = 404;
          throw err;
        }
      }
      const act = await prisma.sanidadEvento.update({
        where: { id },
        data: { estado: nuevoEstado },
      });
      return {
        ...act,
        fechaProgramada: act.fechaProgramada ? act.fechaProgramada.toISOString().split("T")[0] : null,
      };
    } catch (e) {
      if (e.status === 404) throw e;
      const ev = (db.sanidad || []).find((s) => {
        if (s.id !== id) return false;
        return establecimientoId ? s.establecimientoId === establecimientoId : true;
      });
      if (ev) {
        ev.estado = nuevoEstado;
        return ev;
      }
      const err = new Error("Evento sanitario no encontrado en este establecimiento.");
      err.status = 404;
      throw err;
    }
  }

  static async eliminarEvento(id, establecimientoId) {
    if (!id) throw new Error("ID de evento sanitario requerido.");

    let existente = null;
    try {
      existente = await prisma.sanidadEvento.findUnique({ where: { id } });
    } catch (err) {
      console.warn("[SanidadModel] Fallo al consultar Prisma en eliminarEvento, usando fallback en memoria:", err.message);
      existente = null;
    }

    if (existente) {
      if (
        establecimientoId &&
        existente.establecimientoId &&
        existente.establecimientoId !== establecimientoId
      ) {
        throw new Error("No tenés permisos para eliminar un evento sanitario de otro establecimiento.");
      }

      const eliminado = await prisma.sanidadEvento.delete({ where: { id } });
      if (Array.isArray(db.sanidad)) {
        db.sanidad = db.sanidad.filter((s) => s.id !== id);
      }
      return eliminado;
    }

    if (Array.isArray(db.sanidad)) {
      const idx = db.sanidad.findIndex((s) => s.id === id);
      if (idx !== -1) {
        const candidato = db.sanidad[idx];
        if (
          establecimientoId &&
          candidato.establecimientoId &&
          candidato.establecimientoId !== establecimientoId
        ) {
          throw new Error("No tenés permisos para eliminar un evento sanitario de otro establecimiento.");
        }
        const [eliminadoMem] = db.sanidad.splice(idx, 1);
        return eliminadoMem;
      }
    }

    throw new Error("Evento sanitario no encontrado o ya eliminado.");
  }

  static async eliminarMasivo(ids = [], establecimientoId) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("Debe seleccionar al menos un evento sanitario para eliminar.");
    }
    try {
      const whereClause = { id: { in: ids } };
      if (establecimientoId) whereClause.establecimientoId = establecimientoId;
      const res = await prisma.sanidadEvento.deleteMany({
        where: whereClause,
      });
      if (Array.isArray(db.sanidad)) {
        db.sanidad = db.sanidad.filter(
          (s) =>
            !ids.includes(s.id) ||
            (establecimientoId && s.establecimientoId && s.establecimientoId !== establecimientoId)
        );
      }
      return { count: res.count, ids };
    } catch (err) {
      console.warn("[SanidadModel] Fallo en eliminarMasivo Prisma, usando memoria:", err.message);
      if (Array.isArray(db.sanidad)) {
        const antes = db.sanidad.length;
        db.sanidad = db.sanidad.filter(
          (s) =>
            !ids.includes(s.id) ||
            (establecimientoId && s.establecimientoId && s.establecimientoId !== establecimientoId)
        );
        return { count: antes - db.sanidad.length, ids };
      }
      return { count: 0, ids };
    }
  }
}

module.exports = SanidadModel;
