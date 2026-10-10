const prisma = require("../config/prisma");
const db = require("../config/db");

class ParteDiarioModel {
  static async listarTodos() {
    try {
      const partes = await prisma.parteDiario.findMany({
        include: { peon: true, potrero: true, revisadoPor: true },
        orderBy: { fecha: "desc" },
      });
      return partes.map((p) => ({
        ...p,
        fecha: p.fecha.toISOString().split("T")[0],
        peonNombre: p.peon ? p.peon.nombre : "Operario",
        potreroNombre: p.potrero ? p.potrero.nombre : "Campo General",
        revisadoPorNombre: p.revisadoPor ? p.revisadoPor.nombre : null,
      }));
    } catch (e) {
      console.warn("Fallback memoria para listar partes:", e.message);
      return db.partesDiarios;
    }
  }

  static async obtenerPendientes() {
    try {
      const pendientes = await prisma.parteDiario.findMany({
        where: { estado: "PENDIENTE" },
      });
      return pendientes;
    } catch {
      return db.partesDiarios.filter((p) => p.estado === "Pendiente" || p.estado === "PENDIENTE");
    }
  }

  static async registrar({ peonId, peonNombre, potreroId, potreroNombre, novedades, animalesRevisados, solicitudInsumos }) {
    try {
      // Si no tenemos peonId, buscar un usuario peon por defecto
      let usuarioPeonId = peonId;
      if (!usuarioPeonId) {
        const peonUser = await prisma.usuario.findFirst({ where: { rol: "PEON" } });
        usuarioPeonId = peonUser ? peonUser.id : (await prisma.usuario.findFirst()).id;
      }

      // Si no tenemos potreroId, buscar el primer potrero
      let targetPotreroId = potreroId;
      if (!targetPotreroId) {
        const pot = await prisma.potrero.findFirst();
        targetPotreroId = pot ? pot.id : null;
      }

      const nuevo = await prisma.parteDiario.create({
        data: {
          peonId: usuarioPeonId,
          potreroId: targetPotreroId,
          novedades,
          animalesRevisados: Number(animalesRevisados) || 0,
          solicitudInsumos: solicitudInsumos || null,
          estado: "PENDIENTE",
        },
        include: { peon: true, potrero: true },
      });

      return {
        ...nuevo,
        fecha: nuevo.fecha.toISOString().split("T")[0],
        peonNombre: nuevo.peon ? nuevo.peon.nombre : peonNombre,
        potreroNombre: nuevo.potrero ? nuevo.potrero.nombre : (potreroNombre || "Potrero"),
      };
    } catch (e) {
      console.warn("Fallback memoria para registrar parte:", e.message);
      const nuevo = {
        id: `pd-${Date.now()}`,
        fecha: new Date().toISOString().split("T")[0],
        peonNombre: peonNombre || "Operario",
        potrero: potreroNombre || "Potrero",
        novedades,
        animalesRevisados: Number(animalesRevisados) || 0,
        solicitudInsumos: solicitudInsumos || null,
        estado: "Pendiente",
        fechaCarga: new Date().toISOString(),
      };
      db.partesDiarios.unshift(nuevo);
      return nuevo;
    }
  }

  static async cambiarEstado(id, nuevoEstado, revisadoPorId = null) {
    const estadoEnum = nuevoEstado.toUpperCase(); // "APROBADO", "RECHAZADO", "PENDIENTE"
    try {
      const parte = await prisma.parteDiario.update({
        where: { id },
        data: {
          estado: estadoEnum,
          revisadoPorId: revisadoPorId || undefined,
          fechaRevision: new Date(),
        },
        include: { peon: true, revisadoPor: true, potrero: true },
      });
      return {
        ...parte,
        fecha: parte.fecha.toISOString().split("T")[0],
        peonNombre: parte.peon ? parte.peon.nombre : "Operario",
        revisadoPorNombre: parte.revisadoPor ? parte.revisadoPor.nombre : "Supervisor",
      };
    } catch (e) {
      const parte = db.partesDiarios.find((p) => p.id === id);
      if (!parte) {
        throw new Error("Parte diario no encontrado.");
      }
      parte.estado = nuevoEstado;
      parte.revisadoPor = revisadoPorId ? `Usuario ${revisadoPorId}` : "Supervisor";
      parte.fechaRevision = new Date().toISOString();
      return parte;
    }
  }
}

module.exports = ParteDiarioModel;
