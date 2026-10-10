const prisma = require("../config/prisma");
const db = require("../config/db");

class ParteDiarioModel {
  static formatearParte(p) {
    return {
      id: p.id,
      fecha: p.fecha instanceof Date ? p.fecha.toISOString().split("T")[0] : (p.fecha || new Date().toISOString().split("T")[0]),
      peonNombre: p.peon ? p.peon.nombre : (p.peonNombre || "Operario de Campo"),
      potrero: p.potrero ? (typeof p.potrero === "string" ? p.potrero : p.potrero.nombre) : (p.potreroNombre || "Potrero General"),
      potreroNombre: p.potrero ? (typeof p.potrero === "string" ? p.potrero : p.potrero.nombre) : (p.potreroNombre || "Potrero General"),
      novedades: p.novedades,
      animalesRevisados: Number(p.animalesRevisados) || 0,
      solicitudInsumos: p.solicitudInsumos || null,
      estado: (p.estado || "PENDIENTE").toUpperCase(),
      revisadoPor: p.revisadoPor
        ? (typeof p.revisadoPor === "string" ? p.revisadoPor : `${p.revisadoPor.nombre} (${p.revisadoPor.rol || "Supervisor"})`)
        : null,
      revisadoPorNombre: p.revisadoPor ? (typeof p.revisadoPor === "string" ? p.revisadoPor : p.revisadoPor.nombre) : null,
      fechaCarga: p.fechaCarga || new Date().toISOString(),
      fechaRevision: p.fechaRevision || null,
    };
  }

  static async listarTodos() {
    try {
      const lista = await prisma.parteDiario.findMany({
        include: {
          peon: true,
          revisadoPor: true,
          potrero: true,
        },
        orderBy: { fechaCarga: "desc" },
      });
      return lista.map((p) => this.formatearParte(p));
    } catch (err) {
      console.warn("[ParteDiarioModel] Fallo al consultar Prisma, usando fallback en memoria:", err.message);
      return db.partesDiarios.map((p) => this.formatearParte(p));
    }
  }

  static async obtenerPendientes() {
    const todos = await this.listarTodos();
    return todos.filter((p) => p.estado === "PENDIENTE");
  }

  static async registrar({ peonId, peonNombre, potreroId, potrero, potreroNombre, novedades, animalesRevisados, solicitudInsumos }) {
    try {
      let resolvedPeonId = peonId;
      if (!resolvedPeonId) {
        const peonEncontrado = await prisma.usuario.findFirst({
          where: peonNombre ? { nombre: { contains: peonNombre, mode: "insensitive" } } : { rol: "PEON" },
        });
        resolvedPeonId = peonEncontrado ? peonEncontrado.id : "usr-3";
      }

      let resolvedPotreroId = potreroId;
      if (!resolvedPotreroId && (potrero || potreroNombre)) {
        const nombreBuscado = potrero || potreroNombre;
        const potEncontrado = await prisma.potrero.findFirst({
          where: { nombre: { contains: nombreBuscado, mode: "insensitive" } },
        });
        if (potEncontrado) resolvedPotreroId = potEncontrado.id;
      }

      const nuevo = await prisma.parteDiario.create({
        data: {
          novedades,
          animalesRevisados: Number(animalesRevisados) || 0,
          solicitudInsumos: solicitudInsumos || null,
          estado: "PENDIENTE",
          peonId: resolvedPeonId,
          potreroId: resolvedPotreroId,
        },
        include: {
          peon: true,
          revisadoPor: true,
          potrero: true,
        },
      });

      return this.formatearParte(nuevo);
    } catch (err) {
      console.warn("[ParteDiarioModel] Fallo al guardar en Prisma, usando fallback:", err.message);
      const nuevo = {
        id: `pd-${Date.now()}`,
        fecha: new Date().toISOString().split("T")[0],
        peonNombre: peonNombre || "Operario de Campo",
        potrero: potrero || potreroNombre || "Potrero 1 - Los Eucaliptos",
        novedades,
        animalesRevisados: Number(animalesRevisados) || 0,
        solicitudInsumos: solicitudInsumos || null,
        estado: "PENDIENTE",
        fechaCarga: new Date().toISOString(),
      };
      db.partesDiarios.unshift(nuevo);
      return this.formatearParte(nuevo);
    }
  }

  static async cambiarEstado(id, nuevoEstado, revisorUsuario = null) {
    const estadoMayus = (nuevoEstado || "").toUpperCase();
    const ESTADOS = ["PENDIENTE", "APROBADO", "RECHAZADO"];
    if (!ESTADOS.includes(estadoMayus)) {
      throw new Error(`Estado inválido: ${nuevoEstado}. Debe ser uno de: ${ESTADOS.join(", ")}`);
    }

    const revisadoPorId = typeof revisorUsuario === "string" ? revisorUsuario : revisorUsuario?.id;

    try {
      const parteExistente = await prisma.parteDiario.findUnique({ where: { id } });
      if (parteExistente) {
        const dataUpdate = {
          estado: estadoMayus,
          fechaRevision: new Date(),
        };
        if (revisadoPorId) {
          dataUpdate.revisadoPorId = revisadoPorId;
        }

        const actualizado = await prisma.parteDiario.update({
          where: { id },
          data: dataUpdate,
          include: {
            peon: true,
            revisadoPor: true,
            potrero: true,
          },
        });
        return this.formatearParte(actualizado);
      }
    } catch (err) {
      console.warn("[ParteDiarioModel] Fallo al actualizar en Prisma, probando fallback:", err.message);
    }

    // Fallback en memoria
    const parte = db.partesDiarios.find((p) => p.id === id);
    if (!parte) {
      throw new Error("Parte diario no encontrado.");
    }
    parte.estado = estadoMayus;
    parte.revisadoPor = typeof revisorUsuario === "object" && revisorUsuario ? `${revisorUsuario.nombre} (${revisorUsuario.rol})` : "Supervisor";
    parte.fechaRevision = new Date().toISOString();
    return this.formatearParte(parte);
  }
}

module.exports = ParteDiarioModel;
