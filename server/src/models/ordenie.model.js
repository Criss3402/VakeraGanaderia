const prisma = require("../config/prisma");
const db = require("../config/db");

function obtenerFechaHoyLocal() {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

class OrdenieModel {
  static async listar(establecimientoId, { fecha } = {}) {
    const estId = establecimientoId || "est-el-rancho";
    try {
      if (!prisma.registroOrdenie) {
        throw new Error("Modelo RegistroOrdenie no inicializado en Prisma");
      }
      const where = {
        establecimientoId: estId,
        ...(fecha ? { fecha } : {}),
      };
      return await prisma.registroOrdenie.findMany({
        where,
        orderBy: [{ fecha: "desc" }, { creadoEn: "desc" }],
      });
    } catch (err) {
      console.warn("[OrdenieModel.listar] Fallback a memoria:", err.message);
      const fuente = Array.isArray(db.registrosOrdenie) ? db.registrosOrdenie : [];
      return fuente
        .filter((r) => r.establecimientoId === estId && (!fecha || r.fecha === fecha))
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    }
  }

  static async registrar(establecimientoId, datos = {}) {
    const estId = establecimientoId || "est-el-rancho";
    const fecha = String(datos.fecha || "").trim();
    const animalId = String(datos.animalId || "").trim();
    const litros = Number(datos.litrosSacados);
    const observaciones = datos.observaciones ? String(datos.observaciones).trim() : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      const e = new Error("La fecha debe tener el formato YYYY-MM-DD.");
      e.status = 400;
      throw e;
    }

    const hoy = obtenerFechaHoyLocal();
    if (fecha > hoy) {
      const e = new Error("La fecha no puede ser un día futuro.");
      e.status = 400;
      throw e;
    }

    if (!animalId) {
      const e = new Error("Debés seleccionar una Vaca Lechera.");
      e.status = 400;
      throw e;
    }

    if (!Number.isFinite(litros) || litros <= 0) {
      const e = new Error("Los litros sacados deben ser un número mayor a 0.");
      e.status = 400;
      throw e;
    }

    // Buscar el animal para validar que exista y sea Vaca Lechera
    let animal = null;
    try {
      animal = await prisma.ganado.findFirst({
        where: { id: animalId, establecimientoId: estId },
      });
    } catch (err) {
      console.warn("[OrdenieModel.registrar] Fallback búsqueda ganado en memoria:", err.message);
      animal = (db.ganado || []).find(
        (g) => g.id === animalId && g.establecimientoId === estId
      );
    }

    if (!animal) {
      const e = new Error("La vaca lechera seleccionada no existe en este establecimiento.");
      e.status = 404;
      throw e;
    }

    if (!String(animal.categoria || "").toLowerCase().includes("lecher")) {
      const e = new Error("El animal seleccionado no pertenece a la categoría Vacas Lecheras.");
      e.status = 400;
      throw e;
    }

    const payload = {
      establecimientoId: estId,
      fecha,
      animalId: animal.id,
      caravana: animal.caravana,
      litrosSacados: Math.round(litros * 100) / 100,
      observaciones,
    };

    try {
      if (!prisma.registroOrdenie) {
        throw new Error("Modelo RegistroOrdenie no inicializado en Prisma");
      }
      return await prisma.registroOrdenie.create({ data: payload });
    } catch (err) {
      console.warn("[OrdenieModel.registrar] Fallback a memoria:", err.message);
      if (!Array.isArray(db.registrosOrdenie)) db.registrosOrdenie = [];
      const nuevo = {
        id: `ord-${Date.now()}`,
        ...payload,
        creadoEn: new Date().toISOString(),
      };
      db.registrosOrdenie.unshift(nuevo);
      return nuevo;
    }
  }

  static async eliminar(id, establecimientoId) {
    const estId = establecimientoId || "est-el-rancho";
    try {
      if (!prisma.registroOrdenie) {
        throw new Error("Modelo RegistroOrdenie no inicializado en Prisma");
      }
      const res = await prisma.registroOrdenie.deleteMany({
        where: { id, establecimientoId: estId },
      });
      if (res.count === 0) {
        const e = new Error("Registro de ordeñe no encontrado.");
        e.status = 404;
        throw e;
      }
      return { eliminado: true, id };
    } catch (err) {
      if (err.status) throw err;
      console.warn("[OrdenieModel.eliminar] Fallback a memoria:", err.message);
      const fuente = Array.isArray(db.registrosOrdenie) ? db.registrosOrdenie : [];
      const idx = fuente.findIndex((r) => r.id === id && r.establecimientoId === estId);
      if (idx === -1) {
        const e = new Error("Registro de ordeñe no encontrado.");
        e.status = 404;
        throw e;
      }
      fuente.splice(idx, 1);
      return { eliminado: true, id };
    }
  }
}

module.exports = OrdenieModel;
