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
      establecimientoId: p.establecimientoId || null,
      establecimiento: p.establecimiento || null,
    };
  }

  static async listarTodos(establecimientoId) {
    try {
      const whereClause = establecimientoId ? { establecimientoId } : {};
      const lista = await prisma.parteDiario.findMany({
        where: whereClause,
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
      const fuente = Array.isArray(db.partesDiarios) ? db.partesDiarios : [];
      const filtrados = establecimientoId
        ? fuente.filter((p) => p.establecimientoId === establecimientoId)
        : fuente;
      return filtrados.map((p) => this.formatearParte(p));
    }
  }

  static async obtenerPendientes(establecimientoId) {
    const todos = await this.listarTodos(establecimientoId);
    return todos.filter((p) => p.estado === "PENDIENTE");
  }

  /**
   * Calcula conteos consolidados de partes diarios directamente en PostgreSQL
   * mediante `count()` en paralelo, con respaldo en memoria.
   */
  static async obtenerResumen(establecimientoId) {
    try {
      const baseWhere = establecimientoId ? { establecimientoId } : {};
      const [totalPartes, partesAprobados, partesPendientes, tratamientosCompletados] = await Promise.all([
        prisma.parteDiario.count({ where: baseWhere }),
        prisma.parteDiario.count({ where: { ...baseWhere, estado: "APROBADO" } }),
        prisma.parteDiario.count({ where: { ...baseWhere, estado: "PENDIENTE" } }),
        prisma.parteDiario.count({
          where: {
            ...baseWhere,
            OR: [
              { novedades: { contains: "vacun", mode: "insensitive" } },
              { novedades: { contains: "curac", mode: "insensitive" } },
              { novedades: { contains: "sanit", mode: "insensitive" } },
            ],
          },
        }),
      ]);
      return { totalPartes, partesAprobados, partesPendientes, tratamientosCompletados };
    } catch (err) {
      console.warn("[ParteDiarioModel.obtenerResumen] Fallback a memoria:", err.message);
      const fuente = Array.isArray(db.partesDiarios) ? db.partesDiarios : [];
      const lista = establecimientoId
        ? fuente.filter((p) => p.establecimientoId === establecimientoId)
        : fuente;
      return {
        totalPartes: lista.length,
        partesAprobados: lista.filter((p) => (p.estado || "").toUpperCase() === "APROBADO").length,
        partesPendientes: lista.filter((p) => (p.estado || "").toUpperCase() === "PENDIENTE").length,
        tratamientosCompletados: lista.filter((p) => {
          const txt = (p.novedades || "").toLowerCase();
          return txt.includes("vacun") || txt.includes("curac") || txt.includes("sanit");
        }).length,
      };
    }
  }

  static async registrar({
    peonId,
    peonNombre,
    potreroId,
    potrero,
    potreroNombre,
    novedades,
    animalesRevisados,
    solicitudInsumos,
    establecimientoId,
    establecimiento,
  }) {
    try {
      let resolvedPeonId = peonId;
      if (!resolvedPeonId) {
        const peonEncontrado = await prisma.usuario.findFirst({
          where: {
            ...(peonNombre ? { nombre: { contains: peonNombre, mode: "insensitive" } } : { rol: "PEON" }),
            ...(establecimientoId ? { establecimientoId } : {}),
          },
        });
        resolvedPeonId = peonEncontrado ? peonEncontrado.id : "usr-3";
      }

      let resolvedPotreroId = potreroId;
      if (!resolvedPotreroId && (potrero || potreroNombre)) {
        const nombreBuscado = potrero || potreroNombre;
        const potEncontrado = await prisma.potrero.findFirst({
          where: {
            nombre: { contains: nombreBuscado, mode: "insensitive" },
            ...(establecimientoId ? { establecimientoId } : {}),
          },
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
          establecimientoId: establecimientoId || null,
          establecimiento: establecimiento || null,
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
        potrero: potrero || potreroNombre || "Potrero General",
        novedades,
        animalesRevisados: Number(animalesRevisados) || 0,
        solicitudInsumos: solicitudInsumos || null,
        estado: "PENDIENTE",
        fechaCarga: new Date().toISOString(),
        establecimientoId: establecimientoId || "est-el-rancho",
        establecimiento: establecimiento || "Mi Establecimiento",
      };
      if (!db.partesDiarios) db.partesDiarios = [];
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
    const parte = (db.partesDiarios || []).find((p) => p.id === id);
    if (!parte) {
      throw new Error("Parte diario no encontrado.");
    }
    parte.estado = estadoMayus;
    parte.revisadoPor = typeof revisorUsuario === "object" && revisorUsuario ? `${revisorUsuario.nombre} (${revisorUsuario.rol})` : "Supervisor";
    parte.fechaRevision = new Date().toISOString();
    return this.formatearParte(parte);
  }

  static async eliminar(id, establecimientoId) {
    if (!id) throw new Error("ID de parte diario requerido.");

    let existente = null;
    try {
      existente = await prisma.parteDiario.findUnique({ where: { id } });
    } catch (err) {
      console.warn("[ParteDiarioModel] Fallo al consultar Prisma en eliminar, usando fallback en memoria:", err.message);
      existente = null;
    }

    if (existente) {
      if (
        establecimientoId &&
        existente.establecimientoId &&
        existente.establecimientoId !== establecimientoId
      ) {
        throw new Error("No tenés permisos para eliminar un parte diario de otro establecimiento.");
      }

      const eliminado = await prisma.parteDiario.delete({ where: { id } });
      if (Array.isArray(db.partesDiarios)) {
        db.partesDiarios = db.partesDiarios.filter((p) => p.id !== id);
      }
      return eliminado;
    }

    if (Array.isArray(db.partesDiarios)) {
      const idx = db.partesDiarios.findIndex((p) => p.id === id);
      if (idx !== -1) {
        const candidato = db.partesDiarios[idx];
        if (
          establecimientoId &&
          candidato.establecimientoId &&
          candidato.establecimientoId !== establecimientoId
        ) {
          throw new Error("No tenés permisos para eliminar un parte diario de otro establecimiento.");
        }
        const [eliminadoMem] = db.partesDiarios.splice(idx, 1);
        return this.formatearParte(eliminadoMem);
      }
    }

    throw new Error("Parte diario no encontrado o ya eliminado.");
  }

  static async eliminarMasivo(ids = [], establecimientoId) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("Debe seleccionar al menos un parte diario para eliminar.");
    }
    try {
      const whereClause = { id: { in: ids } };
      if (establecimientoId) whereClause.establecimientoId = establecimientoId;
      const res = await prisma.parteDiario.deleteMany({
        where: whereClause,
      });
      if (Array.isArray(db.partesDiarios)) {
        db.partesDiarios = db.partesDiarios.filter(
          (p) =>
            !ids.includes(p.id) ||
            (establecimientoId && p.establecimientoId && p.establecimientoId !== establecimientoId)
        );
      }
      return { count: res.count, ids };
    } catch (err) {
      console.warn("[ParteDiarioModel] Fallo en eliminarMasivo Prisma, usando memoria:", err.message);
      if (Array.isArray(db.partesDiarios)) {
        const antes = db.partesDiarios.length;
        db.partesDiarios = db.partesDiarios.filter(
          (p) =>
            !ids.includes(p.id) ||
            (establecimientoId && p.establecimientoId && p.establecimientoId !== establecimientoId)
        );
        return { count: antes - db.partesDiarios.length, ids };
      }
      return { count: 0, ids };
    }
  }
}

module.exports = ParteDiarioModel;
