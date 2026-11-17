const prisma = require("../config/prisma");
const db = require("../config/db");

// Solicitudes en memoria sincronizadas con la sesión
let solicitudesInsumos = [
  {
    id: "sol-1",
    insumoId: "ins-9",
    insumoNombre: "Rollo de Alambre Alta Resistencia 1000m",
    cantidad: 2,
    unidad: "Rollos",
    motivo: "Reparación de alambrado perimetral este en Potrero 2 tras vientos",
    urgencia: "Alta",
    solicitanteNombre: "Lucas Giménez",
    solicitanteRol: "peon",
    sector: "Pertenencias de Peón",
    estado: "Pendiente",
    fecha: "2026-10-09",
    establecimientoId: "est-el-rancho",
    establecimiento: "El Rancho, Goya, Corrientes",
  },
  {
    id: "sol-2",
    insumoId: "ins-1",
    insumoNombre: "Vacuna Antiaftosa Bivalente",
    cantidad: 50,
    unidad: "Dosis",
    motivo: "Inicio de Campaña de Vacunación Oficial de Primavera SENASA",
    urgencia: "Urgente",
    solicitanteNombre: "Dra. Sofía Navarro",
    solicitanteRol: "veterinario",
    sector: "Botiquín Veterinario",
    estado: "Aprobado",
    fecha: "2026-10-08",
    establecimientoId: "est-el-rancho",
    establecimiento: "El Rancho, Goya, Corrientes",
  },
  {
    id: "sol-3",
    insumoId: "ins-8",
    insumoNombre: "Electrificador Solar Boyero 12V",
    cantidad: 1,
    unidad: "Unidades",
    motivo: "Instalación de boyero para rotación de pasturas en Potrero 5",
    urgencia: "Normal",
    solicitanteNombre: "Martín Benítez",
    solicitanteRol: "capataz",
    sector: "Campo y Taller (Capataz)",
    estado: "Entregado",
    fecha: "2026-10-07",
    establecimientoId: "est-el-rancho",
    establecimiento: "El Rancho, Goya, Corrientes",
  },
];

function normalizarInsumo(item) {
  let campo = item.campo;
  let ubicacion = item.ubicacion || "Depósito Central";

  if (!campo) {
    if (ubicacion.includes(" - ")) {
      const partes = ubicacion.split(" - ");
      campo = partes[0].trim();
      ubicacion = partes.slice(1).join(" - ").trim();
    } else if (item.id === "ins-3" || item.id === "ins-4" || ubicacion.toLowerCase().includes("moraleja")) {
      campo = "Campo 2 - La Moraleja";
    } else {
      campo = "Campo 1 - El Rancho";
    }
  }

  return {
    ...item,
    campo,
    ubicacion,
    sectorCustodia: (ubicacion || "").includes("Peón")
      ? "peon"
      : (ubicacion || "").includes("Capataz")
      ? "capataz"
      : (ubicacion || "").includes("Veterin")
      ? "veterinario"
      : "oficina",
  };
}

class InsumoModel {
  static async listarTodos(establecimientoId) {
    try {
      const whereClause = establecimientoId ? { establecimientoId } : {};
      const lista = await prisma.insumo.findMany({
        where: whereClause,
        orderBy: { nombre: "asc" },
      });
      return lista.map(normalizarInsumo);
    } catch (err) {
      console.warn("[InsumoModel] Fallo al consultar Prisma, usando fallback en memoria:", err.message);
      const fuente = Array.isArray(db.insumos) ? db.insumos : [];
      const filtrados = establecimientoId
        ? fuente.filter((i) => i.establecimientoId === establecimientoId)
        : fuente;
      return filtrados.map(normalizarInsumo);
    }
  }

  static async obtenerCriticos(establecimientoId) {
    try {
      const whereClause = {
        OR: [
          { requiereReposicion: true },
          { estado: "Bajo Stock" },
          { estado: "Crítico" },
        ],
      };
      if (establecimientoId) whereClause.establecimientoId = establecimientoId;

      const lista = await prisma.insumo.findMany({
        where: whereClause,
      });
      return lista;
    } catch {
      const fuente = Array.isArray(db.insumos) ? db.insumos : [];
      const filtrados = establecimientoId
        ? fuente.filter((i) => i.establecimientoId === establecimientoId)
        : fuente;
      return filtrados.filter(
        (item) => item.requiereReposicion || Number(item.stockActual) <= Number(item.stockMinimo)
      );
    }
  }

  static async registrar(insumo, establecimientoId, establecimiento) {
    const stockActual = parseFloat(insumo.stockActual) || 0;
    const stockMinimo = parseFloat(insumo.stockMinimo) || 5;
    const esCritico = stockActual <= stockMinimo;
    const estado = esCritico ? "Crítico" : "OK";
    const campo = insumo.campo || "Campo 1 - El Rancho";
    const detalleUbicacion = insumo.ubicacion || "Depósito Central";
    const ubicacionCompuesta = insumo.campo
      ? (insumo.ubicacion ? `${campo} - ${detalleUbicacion}` : campo)
      : detalleUbicacion;

    try {
      const nuevo = await prisma.insumo.create({
        data: {
          nombre: insumo.nombre.trim(),
          categoria: insumo.categoria || "Fármaco",
          stockActual,
          stockMinimo,
          unidad: insumo.unidad || "Unidades",
          ubicacion: ubicacionCompuesta,
          estado,
          requiereReposicion: esCritico,
          icono: insumo.icono || "fa-box-archive",
          establecimientoId: establecimientoId || null,
          establecimiento: establecimiento || null,
        },
      });
      return normalizarInsumo(nuevo);
    } catch (err) {
      console.warn("[InsumoModel] Fallo al guardar en Prisma, usando fallback:", err.message);
      const nuevo = {
        id: `ins-${Date.now()}`,
        ...insumo,
        campo,
        ubicacion: detalleUbicacion,
        stockActual,
        stockMinimo,
        estado,
        requiereReposicion: esCritico,
        establecimientoId: establecimientoId || "est-el-rancho",
        establecimiento: establecimiento || "Mi Establecimiento",
      };
      if (!db.insumos) db.insumos = [];
      db.insumos.push(nuevo);
      return normalizarInsumo(nuevo);
    }
  }

  static async actualizarStock(id, cantidadCambio, operacion = "sumar") {
    try {
      const actual = await prisma.insumo.findUnique({ where: { id } });
      if (!actual) throw new Error("Insumo no encontrado");

      const delta = parseFloat(cantidadCambio) || 0;
      let nuevoStock = actual.stockActual;

      if (operacion === "conteo") {
        nuevoStock = Math.max(0, delta);
      } else if (operacion === "sumar") {
        nuevoStock = actual.stockActual + delta;
      } else if (operacion === "restar") {
        nuevoStock = Math.max(0, actual.stockActual - delta);
      }

      const requiereReposicion = nuevoStock <= actual.stockMinimo;
      const estado = requiereReposicion ? "Bajo Stock" : "OK";

      return await prisma.insumo.update({
        where: { id },
        data: {
          stockActual: nuevoStock,
          requiereReposicion,
          estado,
        },
      });
    } catch (e) {
      const insumo = (db.insumos || []).find((i) => i.id === id);
      if (insumo) {
        const delta = parseFloat(cantidadCambio) || 0;
        if (operacion === "conteo") {
          insumo.stockActual = Math.max(0, delta);
        } else if (operacion === "sumar") {
          insumo.stockActual = insumo.stockActual + delta;
        } else if (operacion === "restar") {
          insumo.stockActual = Math.max(0, insumo.stockActual - delta);
        }
        insumo.requiereReposicion = insumo.stockActual <= insumo.stockMinimo;
        insumo.estado = insumo.requiereReposicion ? "Bajo Stock" : "OK";
        return insumo;
      }
      throw e;
    }
  }

  static async eliminar(id, establecimientoId) {
    if (!id) throw new Error("ID de insumo requerido.");
    try {
      const eliminado = await prisma.insumo.delete({
        where: { id },
      });
      return eliminado;
    } catch (e) {
      console.warn("[InsumoModel] Fallo al eliminar en Prisma, usando fallback:", e.message);
      if (Array.isArray(db.insumos)) {
        const idx = db.insumos.findIndex(
          (i) => i.id === id && (!establecimientoId || !i.establecimientoId || i.establecimientoId === establecimientoId)
        );
        if (idx !== -1) {
          const [del] = db.insumos.splice(idx, 1);
          return del;
        }
      }
      throw new Error("Insumo no encontrado o ya eliminado.");
    }
  }

  static async eliminarMasivo(ids = [], establecimientoId) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("Debe seleccionar al menos un insumo para eliminar.");
    }
    try {
      const whereClause = { id: { in: ids } };
      if (establecimientoId) whereClause.establecimientoId = establecimientoId;
      const res = await prisma.insumo.deleteMany({
        where: whereClause,
      });
      if (Array.isArray(db.insumos)) {
        db.insumos = db.insumos.filter((i) => !ids.includes(i.id));
      }
      return { count: res.count, ids };
    } catch (e) {
      console.warn("[InsumoModel] Fallo en eliminarMasivo Prisma, usando memoria:", e.message);
      if (Array.isArray(db.insumos)) {
        const antes = db.insumos.length;
        db.insumos = db.insumos.filter((i) => !ids.includes(i.id));
        return { count: antes - db.insumos.length, ids };
      }
      return { count: 0, ids };
    }
  }

  static async gestionarLocacion({ nombreAnterior, nuevoNombre, accion = "editar", establecimientoId }) {
    if (!nombreAnterior) {
      throw new Error("Debe indicar la locación a modificar.");
    }
    const destino = accion === "eliminar"
      ? (nuevoNombre ? nuevoNombre.trim() : "Depósito General")
      : (nuevoNombre || "").trim();

    if (accion === "editar" && !destino) {
      throw new Error("El nuevo nombre de la locación no puede estar vacío.");
    }

    let actualizados = 0;
    try {
      const whereClause = establecimientoId ? { establecimientoId } : {};
      const lista = await prisma.insumo.findMany({ where: whereClause });
      for (const item of lista) {
        const norm = normalizarInsumo(item);
        if (norm.campo === nombreAnterior) {
          const detalle = norm.ubicacion || "Depósito Central";
          const nuevaUbicacion = `${destino} - ${detalle}`;
          await prisma.insumo.update({
            where: { id: item.id },
            data: { ubicacion: nuevaUbicacion },
          });
          actualizados++;
        }
      }
    } catch (e) {
      console.warn("[InsumoModel] Fallo al actualizar locación en Prisma, usando memoria:", e.message);
    }

    if (Array.isArray(db.insumos)) {
      db.insumos.forEach((item) => {
        if (establecimientoId && item.establecimientoId && item.establecimientoId !== establecimientoId) return;
        const norm = normalizarInsumo(item);
        if (norm.campo === nombreAnterior) {
          item.campo = destino;
          item.ubicacion = `${destino} - ${norm.ubicacion || "Depósito Central"}`;
          actualizados++;
        }
      });
    }

    // Sincronizar también el nombre de la Parcela (Potrero) si corresponde a una edición de locación
    if (accion === "editar" && destino) {
      const buscadoLimpio = nombreAnterior.trim();
      try {
        const wherePotrero = {
          nombre: { equals: buscadoLimpio, mode: "insensitive" },
        };
        if (establecimientoId) wherePotrero.establecimientoId = establecimientoId;
        const resUpdate = await prisma.potrero.updateMany({
          where: wherePotrero,
          data: { nombre: destino },
        });
        if (!resUpdate || resUpdate.count === 0) {
          await prisma.potrero.updateMany({
            where: { nombre: { equals: buscadoLimpio, mode: "insensitive" } },
            data: { nombre: destino },
          });
        }
      } catch (e) {
        console.warn("[InsumoModel] Fallo al sincronizar potrero en Prisma:", e.message);
      }

      if (Array.isArray(db.potreros)) {
        db.potreros.forEach((p) => {
          if (establecimientoId && p.establecimientoId && p.establecimientoId !== establecimientoId) return;
          if ((p.nombre || "").trim().toLowerCase() === buscadoLimpio.toLowerCase()) {
            p.nombre = destino;
          }
        });
      }

      if (Array.isArray(db.ganado)) {
        db.ganado.forEach((g) => {
          if (establecimientoId && g.establecimientoId && g.establecimientoId !== establecimientoId) return;
          if ((g.potrero || "").trim().toLowerCase() === buscadoLimpio.toLowerCase()) {
            g.potrero = destino;
          }
          if ((g.potreroNombre || "").trim().toLowerCase() === buscadoLimpio.toLowerCase()) {
            g.potreroNombre = destino;
          }
        });
      }
    }

    return { nombreAnterior, nuevoNombre: destino, accion, actualizados };
  }

  // --- SOLICITUDES DE INSUMOS (PEÓN, CAPATAZ, VETERINARIO) ---
  static listarSolicitudes(establecimientoId) {
    if (!establecimientoId) return solicitudesInsumos;
    return solicitudesInsumos.filter((s) => s.establecimientoId === establecimientoId);
  }

  static registrarSolicitud({
    insumoId,
    insumoNombre,
    cantidad,
    unidad = "Unidades",
    motivo,
    urgencia = "Normal",
    solicitanteNombre = "Operario",
    solicitanteRol = "peon",
    sector = "Campo",
    establecimientoId,
    establecimiento,
  }) {
    const nueva = {
      id: `sol-${Date.now()}`,
      insumoId: insumoId || null,
      insumoNombre,
      cantidad: parseFloat(cantidad) || 1,
      unidad,
      motivo: motivo || "Reposición de herramientas de trabajo",
      urgencia,
      solicitanteNombre,
      solicitanteRol,
      sector,
      estado: "Pendiente",
      fecha: new Date().toISOString().split("T")[0],
      establecimientoId: establecimientoId || "est-el-rancho",
      establecimiento: establecimiento || "Mi Establecimiento",
    };
    solicitudesInsumos.unshift(nueva);
    return nueva;
  }

  static async actualizarEstadoSolicitud(id, nuevoEstado, revisadoPor = "Administración") {
    const sol = solicitudesInsumos.find((s) => s.id === id);
    if (!sol) throw new Error("Solicitud no encontrada.");

    const ESTADOS_SOLICITUD = {
      pendiente: "Pendiente",
      aprobado: "Aprobado",
      entregado: "Entregado",
      denegado: "Denegado",
      rechazado: "Denegado",
    };
    const estadoNormalizado = ESTADOS_SOLICITUD[String(nuevoEstado || "").trim().toLowerCase()];
    if (!estadoNormalizado) {
      throw new Error("Estado de solicitud inválido. Debe ser Pendiente, Aprobado, Entregado o Denegado.");
    }

    sol.estado = estadoNormalizado;
    sol.revisadoPor = revisadoPor;
    sol.fechaRevision = new Date().toISOString().split("T")[0];

    // Si se entrega, y tiene un insumoId asociado, sumar al stock de pertenencias
    if (estadoNormalizado === "Entregado" && sol.insumoId) {
      try {
        await this.actualizarStock(sol.insumoId, sol.cantidad, "sumar");
      } catch (e) {
        console.warn("No se pudo auto-sumar stock:", e.message);
      }
    }

    return sol;
  }

  static eliminarSolicitud(id, establecimientoId) {
    if (!id) throw new Error("ID de solicitud requerido.");
    const idx = solicitudesInsumos.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw new Error("Solicitud no encontrada o ya eliminada.");
    }
    const candidata = solicitudesInsumos[idx];
    if (
      establecimientoId &&
      candidata.establecimientoId &&
      candidata.establecimientoId !== establecimientoId
    ) {
      throw new Error("No tenés permisos para eliminar una solicitud de otro establecimiento.");
    }
    const [eliminada] = solicitudesInsumos.splice(idx, 1);
    return eliminada;
  }

  static eliminarSolicitudesMasivo(ids = [], establecimientoId) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("Debe seleccionar al menos una solicitud para eliminar.");
    }
    let count = 0;
    for (let i = solicitudesInsumos.length - 1; i >= 0; i--) {
      const s = solicitudesInsumos[i];
      if (!ids.includes(s.id)) continue;
      if (establecimientoId && s.establecimientoId && s.establecimientoId !== establecimientoId) {
        continue;
      }
      solicitudesInsumos.splice(i, 1);
      count++;
    }
    return { count, ids };
  }
}

module.exports = InsumoModel;
