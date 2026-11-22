const db = require("../config/db");

const TIPOS_VALIDOS = ["SERVICIO", "TACTO", "PARTO", "DESTETE"];
const RESULTADOS_VALIDOS = ["PRENADA", "VACIA", "LOGRADO", "PENDIENTE"];

class ReproduccionModel {
  static _asegurarLista() {
    if (!Array.isArray(db.eventosReproductivos)) {
      db.eventosReproductivos = [];
    }
    return db.eventosReproductivos;
  }

  static listar(establecimientoId) {
    const lista = this._asegurarLista();
    const filtrados = establecimientoId
      ? lista.filter((e) => e.establecimientoId === establecimientoId)
      : lista;
    return [...filtrados].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

  static obtenerResumen(establecimientoId, totalVientresRodeo = 0) {
    const eventos = this.listar(establecimientoId);
    const ultimoPorAnimal = new Map();
    for (const ev of [...eventos].reverse()) {
      if (ev.animalId && (ev.tipo === "TACTO" || ev.tipo === "SERVICIO" || ev.tipo === "PARTO")) {
        ultimoPorAnimal.set(ev.animalId, ev);
      }
    }

    const evaluadas = Array.from(ultimoPorAnimal.values());
    const prenadas = evaluadas.filter((e) => e.resultado === "PRENADA").length;
    const vacias = evaluadas.filter((e) => e.resultado === "VACIA").length;
    const basePrenez = evaluadas.length || totalVientresRodeo || 0;
    const prenezPct = basePrenez > 0 ? Math.round((prenadas / basePrenez) * 1000) / 10 : 0;

    const destetes = eventos.filter((e) => e.tipo === "DESTETE" && e.resultado === "LOGRADO").length;
    const baseDestete = totalVientresRodeo || evaluadas.length || 0;
    const destetePct = baseDestete > 0 ? Math.round((destetes / baseDestete) * 1000) / 10 : 0;

    const edades = eventos
      .map((e) => Number(e.edadPrimerServicioMeses))
      .filter((n) => Number.isFinite(n) && n > 0);
    const edadPrimerServicioMeses = edades.length
      ? Math.round(edades.reduce((a, b) => a + b, 0) / edades.length)
      : null;

    return {
      totalEventos: eventos.length,
      evaluadas: evaluadas.length,
      prenadas,
      vacias,
      prenezPct,
      destetes,
      destetePct,
      edadPrimerServicioMeses,
    };
  }

  static registrar(establecimientoId, datos = {}) {
    const { animalId, caravana, tipo, resultado, fecha, edadPrimerServicioMeses, notas } = datos;
    const tipoMayus = String(tipo || "TACTO").trim().toUpperCase();
    const resMayus = String(resultado || "PRENADA").trim().toUpperCase();

    if (!TIPOS_VALIDOS.includes(tipoMayus)) {
      const err = new Error(`Tipo reproductivo inválido. Permitidos: ${TIPOS_VALIDOS.join(", ")}`);
      err.status = 400;
      throw err;
    }
    if (!RESULTADOS_VALIDOS.includes(resMayus)) {
      const err = new Error(`Resultado inválido. Permitidos: ${RESULTADOS_VALIDOS.join(", ")}`);
      err.status = 400;
      throw err;
    }
    if (!caravana && !animalId) {
      const err = new Error("Debe seleccionar un animal del rodeo.");
      err.status = 400;
      throw err;
    }

    const lista = this._asegurarLista();
    const nuevo = {
      id: `rep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      animalId: animalId || null,
      caravana: String(caravana || "").trim().toUpperCase(),
      tipo: tipoMayus,
      resultado: resMayus,
      fecha: fecha || new Date().toISOString().split("T")[0],
      edadPrimerServicioMeses: edadPrimerServicioMeses ? Number(edadPrimerServicioMeses) : null,
      notas: String(notas || "").trim(),
      establecimientoId: establecimientoId || "est-el-rancho",
      creadoEn: new Date().toISOString(),
    };
    lista.unshift(nuevo);
    return nuevo;
  }

  static eliminar(id, establecimientoId) {
    const lista = this._asegurarLista();
    const idx = lista.findIndex((e) => e.id === id);
    if (idx === -1) {
      const err = new Error("Evento reproductivo no encontrado.");
      err.status = 404;
      throw err;
    }
    if (establecimientoId && lista[idx].establecimientoId && lista[idx].establecimientoId !== establecimientoId) {
      const err = new Error("No tenés permisos para eliminar eventos de otro establecimiento.");
      err.status = 404;
      throw err;
    }
    const [eliminado] = lista.splice(idx, 1);
    return eliminado;
  }
}

module.exports = ReproduccionModel;
