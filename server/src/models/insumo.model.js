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

class InsumoModel {
  static async listarTodos(establecimientoId) {
    try {
      const whereClause = establecimientoId ? { establecimientoId } : {};
      const lista = await prisma.insumo.findMany({
        where: whereClause,
        orderBy: { nombre: "asc" },
      });
      return lista.map((item) => ({
        ...item,
        sectorCustodia: (item.ubicacion || "").includes("Peón")
          ? "peon"
          : (item.ubicacion || "").includes("Capataz")
          ? "capataz"
          : (item.ubicacion || "").includes("Veterin")
          ? "veterinario"
          : "oficina",
      }));
    } catch (err) {
      console.warn("[InsumoModel] Fallo al consultar Prisma, usando fallback en memoria:", err.message);
      const fuente = Array.isArray(db.insumos) ? db.insumos : [];
      const filtrados = establecimientoId
        ? fuente.filter((i) => i.establecimientoId === establecimientoId)
        : fuente;
      return filtrados.map((item) => ({
        ...item,
        sectorCustodia: (item.ubicacion || "").includes("Peón")
          ? "peon"
          : (item.ubicacion || "").includes("Capataz")
          ? "capataz"
          : (item.ubicacion || "").includes("Veterin")
          ? "veterinario"
          : "oficina",
      }));
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

    try {
      const nuevo = await prisma.insumo.create({
        data: {
          nombre: insumo.nombre.trim(),
          categoria: insumo.categoria || "Fármaco",
          stockActual,
          stockMinimo,
          unidad: insumo.unidad || "Unidades",
          ubicacion: insumo.ubicacion || "Depósito Central",
          estado,
          requiereReposicion: esCritico,
          icono: insumo.icono || "fa-box-archive",
          establecimientoId: establecimientoId || null,
          establecimiento: establecimiento || null,
        },
      });
      return nuevo;
    } catch (err) {
      console.warn("[InsumoModel] Fallo al guardar en Prisma, usando fallback:", err.message);
      const nuevo = {
        id: `ins-${Date.now()}`,
        ...insumo,
        stockActual,
        stockMinimo,
        estado,
        requiereReposicion: esCritico,
        establecimientoId: establecimientoId || "est-el-rancho",
        establecimiento: establecimiento || "Mi Establecimiento",
      };
      if (!db.insumos) db.insumos = [];
      db.insumos.push(nuevo);
      return nuevo;
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

    sol.estado = nuevoEstado;
    sol.revisadoPor = revisadoPor;
    sol.fechaRevision = new Date().toISOString().split("T")[0];

    // Si se entrega, y tiene un insumoId asociado, sumar al stock de pertenencias
    if (nuevoEstado === "Entregado" && sol.insumoId) {
      try {
        await this.actualizarStock(sol.insumoId, sol.cantidad, "sumar");
      } catch (e) {
        console.warn("No se pudo auto-sumar stock:", e.message);
      }
    }

    return sol;
  }
}

module.exports = InsumoModel;
