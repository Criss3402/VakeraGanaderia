const db = require("../config/db");

const RUBROS_VALIDOS = [
  "Compra de toros",
  "Comercialización",
  "Personal",
  "Sanidad",
  "Alimentación",
  "Amortizaciones",
];

const PARAMETROS_DEFAULT = {
  reposicionHembrasPct: 0,
  reposicionTorosPct: 0,
  mortandadPct: 0,
  edadPrimerServicioMeses: 0,
  duracionCorralDias: 0,
  gananciaNovillosKgDia: 0,
  gananciaVaquillonasKgDia: 0,
  relacionNovilloMaiz: 0,
};

class FinanzasModel {
  static _asegurarCostos() {
    if (!Array.isArray(db.costosFinanzas)) db.costosFinanzas = [];
    return db.costosFinanzas;
  }

  static _asegurarParametros() {
    if (!Array.isArray(db.parametrosModelo)) db.parametrosModelo = [];
    return db.parametrosModelo;
  }

  static listarCostos(establecimientoId) {
    const lista = this._asegurarCostos();
    const filtrados = establecimientoId
      ? lista.filter((c) => c.establecimientoId === establecimientoId)
      : lista;
    return [...filtrados].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

  static obtenerParametros(establecimientoId) {
    const lista = this._asegurarParametros();
    const found = lista.find((p) => p.establecimientoId === establecimientoId);
    return found ? { ...PARAMETROS_DEFAULT, ...found } : { ...PARAMETROS_DEFAULT };
  }

  static guardarParametros(establecimientoId, datos = {}) {
    const lista = this._asegurarParametros();
    const limpio = {
      establecimientoId: establecimientoId || "est-el-rancho",
      reposicionHembrasPct: Number(datos.reposicionHembrasPct) || 0,
      reposicionTorosPct: Number(datos.reposicionTorosPct) || 0,
      mortandadPct: Number(datos.mortandadPct) || 0,
      edadPrimerServicioMeses: Number(datos.edadPrimerServicioMeses) || 0,
      duracionCorralDias: Number(datos.duracionCorralDias) || 0,
      gananciaNovillosKgDia: Number(datos.gananciaNovillosKgDia) || 0,
      gananciaVaquillonasKgDia: Number(datos.gananciaVaquillonasKgDia) || 0,
      relacionNovilloMaiz: Number(datos.relacionNovilloMaiz) || 0,
      actualizadoEn: new Date().toISOString(),
    };
    const idx = lista.findIndex((p) => p.establecimientoId === limpio.establecimientoId);
    if (idx !== -1) {
      lista[idx] = limpio;
    } else {
      lista.push(limpio);
    }
    return limpio;
  }

  static obtenerResumen(establecimientoId) {
    const costos = this.listarCostos(establecimientoId);
    const porRubroUsd = {
      compraTorosUsd: 0,
      comercializacionUsd: 0,
      personalUsd: 0,
      sanidadUsd: 0,
      alimentacionUsd: 0,
      amortizacionesUsd: 0,
    };

    for (const c of costos) {
      const monto = Number(c.montoUsd) || 0;
      if (c.rubro === "Compra de toros") porRubroUsd.compraTorosUsd += monto;
      else if (c.rubro === "Comercialización") porRubroUsd.comercializacionUsd += monto;
      else if (c.rubro === "Personal") porRubroUsd.personalUsd += monto;
      else if (c.rubro === "Sanidad") porRubroUsd.sanidadUsd += monto;
      else if (c.rubro === "Alimentación") porRubroUsd.alimentacionUsd += monto;
      else if (c.rubro === "Amortizaciones") porRubroUsd.amortizacionesUsd += monto;
    }

    const totalUsd = Object.values(porRubroUsd).reduce((a, b) => a + b, 0);
    return {
      costos,
      porRubroUsd,
      totalUsd,
      parametros: this.obtenerParametros(establecimientoId),
    };
  }

  static registrarCosto(establecimientoId, datos = {}) {
    const { rubro, descripcion, montoUsd, montoArs, fecha, detalles } = datos;
    if (!RUBROS_VALIDOS.includes(rubro)) {
      const err = new Error(`Rubro inválido. Permitidos: ${RUBROS_VALIDOS.join(", ")}`);
      err.status = 400;
      throw err;
    }
    const usd = Number(montoUsd) || 0;
    const ars = Number(montoArs) || 0;
    if (usd <= 0 && ars <= 0) {
      const err = new Error("El monto debe ser mayor a cero.");
      err.status = 400;
      throw err;
    }

    const lista = this._asegurarCostos();
    const nuevo = {
      id: `cos-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      rubro,
      descripcion: String(descripcion || "").trim() || rubro,
      detalles: detalles && typeof detalles === "object" ? detalles : null,
      montoUsd: usd,
      montoArs: ars,
      fecha: fecha || new Date().toISOString().split("T")[0],
      establecimientoId: establecimientoId || "est-el-rancho",
      creadoEn: new Date().toISOString(),
    };
    lista.unshift(nuevo);
    return nuevo;
  }

  static eliminarCosto(id, establecimientoId) {
    const lista = this._asegurarCostos();
    const idx = lista.findIndex((c) => c.id === id);
    if (idx === -1) {
      const err = new Error("Costo no encontrado.");
      err.status = 404;
      throw err;
    }
    if (establecimientoId && lista[idx].establecimientoId && lista[idx].establecimientoId !== establecimientoId) {
      const err = new Error("No tenés permisos para eliminar costos de otro establecimiento.");
      err.status = 404;
      throw err;
    }
    const [eliminado] = lista.splice(idx, 1);
    return eliminado;
  }
}

module.exports = FinanzasModel;
