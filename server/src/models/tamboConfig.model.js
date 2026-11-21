const prisma = require("../config/prisma");
const db = require("../config/db");

const DEFAULTS_TAMBO = {
  modoEntrada: "vacas",
  vacasOrdenie: 0,
  litrosPorVaca: 22,
  litrosDiariosManual: 0,
  diasPeriodo: 30,
  diferencialPorc: 0,
};

class TamboConfigModel {
  static async obtenerPorEstablecimiento(establecimientoId) {
    const estId = establecimientoId || "est-el-rancho";
    try {
      if (!prisma.configuracionTambo) {
        throw new Error("Modelo ConfiguracionTambo no inicializado en Prisma");
      }
      const row = await prisma.configuracionTambo.findUnique({
        where: { establecimientoId: estId },
      });
      if (!row) {
        return { establecimientoId: estId, ...DEFAULTS_TAMBO };
      }
      return {
        id: row.id,
        establecimientoId: row.establecimientoId,
        modoEntrada: row.modoEntrada,
        vacasOrdenie: row.vacasOrdenie,
        litrosPorVaca: row.litrosPorVaca,
        litrosDiariosManual: row.litrosDiariosManual,
        diasPeriodo: row.diasPeriodo,
        diferencialPorc: row.diferencialPorc,
        actualizadoEn: row.actualizadoEn,
      };
    } catch (err) {
      console.warn("[TamboConfigModel.obtenerPorEstablecimiento] Fallback a memoria:", err.message);
      const lista = Array.isArray(db.configuracionesTambo) ? db.configuracionesTambo : [];
      const encontrado = lista.find((c) => c.establecimientoId === estId);
      return encontrado ? { ...encontrado } : { establecimientoId: estId, ...DEFAULTS_TAMBO };
    }
  }

  static async guardar(establecimientoId, datos = {}) {
    const estId = establecimientoId || "est-el-rancho";
    const payload = {
      modoEntrada: datos.modoEntrada === "litros" ? "litros" : "vacas",
      vacasOrdenie: Math.max(0, Math.round(Number(datos.vacasOrdenie) || 0)),
      litrosPorVaca: Math.max(0, Number(datos.litrosPorVaca) || 0),
      litrosDiariosManual: Math.max(0, Number(datos.litrosDiariosManual) || 0),
      diasPeriodo: Math.max(1, Math.round(Number(datos.diasPeriodo) || 30)),
      diferencialPorc: Number(datos.diferencialPorc) || 0,
    };

    try {
      if (!prisma.configuracionTambo) {
        throw new Error("Modelo ConfiguracionTambo no inicializado en Prisma");
      }
      const row = await prisma.configuracionTambo.upsert({
        where: { establecimientoId: estId },
        update: payload,
        create: { establecimientoId: estId, ...payload },
      });
      return row;
    } catch (err) {
      console.warn("[TamboConfigModel.guardar] Fallback a memoria:", err.message);
      if (!Array.isArray(db.configuracionesTambo)) {
        db.configuracionesTambo = [];
      }
      const idx = db.configuracionesTambo.findIndex((c) => c.establecimientoId === estId);
      const registro = {
        id: idx >= 0 ? db.configuracionesTambo[idx].id : `tmb-${Date.now()}`,
        establecimientoId: estId,
        ...payload,
        actualizadoEn: new Date().toISOString(),
      };
      if (idx >= 0) db.configuracionesTambo[idx] = registro;
      else db.configuracionesTambo.push(registro);
      return registro;
    }
  }
}

module.exports = TamboConfigModel;
