const prisma = require("../config/prisma");
const db = require("../config/db");

class GanadoModel {
  static async listarTodos(establecimientoId) {
    try {
      const whereClause = establecimientoId ? { establecimientoId } : {};
      const lista = await prisma.ganado.findMany({
        where: whereClause,
        include: {
          potrero: true,
          eventosSanitarios: {
            orderBy: { fechaProgramada: "desc" },
            take: 3,
          },
        },
        orderBy: { caravana: "asc" },
      });
      return lista.map((g) => ({
        ...g,
        potrero: g.potrero ? g.potrero.nombre : "Sin potrero asignado",
        potreroNombre: g.potrero ? g.potrero.nombre : "Sin potrero asignado",
        potreroId: g.potreroId || null,
        historialSanitario: g.eventosSanitarios || [],
      }));
    } catch (err) {
      console.warn("[GanadoModel] Fallo al consultar Prisma, usando fallback en memoria:", err.message);
      const fuente = Array.isArray(db.ganado) ? db.ganado : [];
      const filtrados = establecimientoId
        ? fuente.filter((g) => g.establecimientoId === establecimientoId)
        : fuente;
      return filtrados.map((g) => ({
        ...g,
        potrero: g.potreroNombre || g.potrero || "Sin potrero asignado",
        potreroNombre: g.potreroNombre || g.potrero || "Sin potrero asignado",
        historialSanitario: g.historialSanitario || [],
      }));
    }
  }

  static async listarPotreros(establecimientoId) {
    function extraerMetaGeo(potrero) {
      let metaGeo = {};
      try {
        if (potrero.descripcion && typeof potrero.descripcion === "string" && potrero.descripcion.startsWith("{")) {
          metaGeo = JSON.parse(potrero.descripcion);
        }
      } catch (_) {}
      return {
        ...potrero,
        coordinates: potrero.coordinates || metaGeo.coordinates || [],
        color: potrero.color || metaGeo.color || "#2e7d32",
        pastura: potrero.pastura || metaGeo.pastura || "Campo Natural",
        aguada: potrero.aguada || metaGeo.aguada || "Aguada no especificada",
        estadoPastura: potrero.estadoPastura || metaGeo.estadoPastura || "Óptimo",
        descripcion: metaGeo.nota !== undefined ? metaGeo.nota : potrero.descripcion,
      };
    }

    try {
      const whereClause = establecimientoId ? { establecimientoId } : {};
      const potreros = await prisma.potrero.findMany({
        where: whereClause,
        include: { animales: true },
        orderBy: { nombre: "asc" },
      });
      return potreros.map((p) => {
        const item = extraerMetaGeo(p);
        const total = p.animales ? p.animales.length : 0;
        return {
          ...item,
          totalAnimales: total,
          porcentajeCarga: item.capacidad ? Math.min(100, Math.round((total / item.capacidad) * 100)) : 0,
        };
      });
    } catch (e) {
      console.warn("Fallback memoria para potreros:", e.message);
      const fuente = Array.isArray(db.potreros) ? db.potreros : [];
      const filtrados = establecimientoId
        ? fuente.filter((p) => p.establecimientoId === establecimientoId)
        : fuente;

      // Calcular cantidad de animales en memoria
      const ganadoFuente = Array.isArray(db.ganado) ? db.ganado : [];
      return filtrados.map((p) => {
        const item = extraerMetaGeo(p);
        const count = ganadoFuente.filter((g) => (g.potreroId === p.id || g.potrero === p.nombre || g.potreroNombre === p.nombre)).length;
        return {
          ...item,
          totalAnimales: count,
          porcentajeCarga: item.capacidad ? Math.min(100, Math.round((count / item.capacidad) * 100)) : 0,
        };
      });
    }
  }

  static async buscarPorId(id) {
    if (!id) return null;
    try {
      const g = await prisma.ganado.findUnique({
        where: { id },
        include: {
          potrero: true,
          eventosSanitarios: {
            include: { responsable: true },
            orderBy: { fechaProgramada: "desc" },
          },
        },
      });
      if (!g) return null;
      return {
        ...g,
        potrero: g.potrero ? g.potrero.nombre : "Sin potrero asignado",
        potreroNombre: g.potrero ? g.potrero.nombre : "Sin potrero asignado",
      };
    } catch {
      return (db.ganado || []).find((g) => g.id === id) || null;
    }
  }

  static async buscarPorCaravana(caravana, establecimientoId) {
    if (!caravana) return null;
    try {
      const whereClause = {
        caravana: { equals: caravana, mode: "insensitive" },
      };
      if (establecimientoId) whereClause.establecimientoId = establecimientoId;

      const g = await prisma.ganado.findFirst({
        where: whereClause,
        include: { potrero: true },
      });
      if (!g) return null;
      return {
        ...g,
        potrero: g.potrero ? g.potrero.nombre : "Sin potrero asignado",
        potreroNombre: g.potrero ? g.potrero.nombre : "Sin potrero asignado",
      };
    } catch {
      return (db.ganado || []).find((g) => {
        const matchCaravana = (g.caravana || "").toLowerCase() === caravana.toLowerCase();
        return establecimientoId ? matchCaravana && g.establecimientoId === establecimientoId : matchCaravana;
      }) || null;
    }
  }

  static async obtenerMetricas(establecimientoId) {
    try {
      const lista = await this.listarTodos(establecimientoId);
      const total = lista.length;

      const porCategoria = lista.reduce((acc, curr) => {
        acc[curr.categoria] = (acc[curr.categoria] || 0) + 1;
        return acc;
      }, {});

      const porEstadoSanitario = lista.reduce((acc, curr) => {
        acc[curr.estadoSanitario] = (acc[curr.estadoSanitario] || 0) + 1;
        return acc;
      }, {});

      const pesoPromedio = total > 0
        ? Math.round(lista.reduce((acc, curr) => acc + (Number(curr.pesoKg) || 0), 0) / total)
        : 0;

      return {
        totalCabezas: total,
        porCategoria,
        porEstadoSanitario,
        pesoPromedioKg: pesoPromedio,
        tasaMortalidadMensual: total > 0 ? "0.8%" : "0.0%",
      };
    } catch (e) {
      console.warn("[GanadoModel.obtenerMetricas] Fallback:", e.message);
      return {
        totalCabezas: 0,
        porCategoria: {},
        porEstadoSanitario: {},
        pesoPromedioKg: 0,
        tasaMortalidadMensual: "0.0%",
      };
    }
  }

  static async registrar(animal, establecimientoId, establecimiento) {
    try {
      let potreroId = animal.potreroId;
      if (!potreroId && animal.potrero) {
        const pEncontrado = await prisma.potrero.findFirst({
          where: {
            nombre: { contains: animal.potrero, mode: "insensitive" },
            ...(establecimientoId ? { establecimientoId } : {}),
          },
        });
        if (pEncontrado) potreroId = pEncontrado.id;
      }

      const nuevo = await prisma.ganado.create({
        data: {
          caravana: animal.caravana.trim().toUpperCase(),
          categoria: animal.categoria || "Vacas",
          raza: animal.raza || "Angus",
          sexo: animal.sexo || "Hembra",
          pesoKg: Number(animal.pesoKg) || 400,
          estadoSanitario: (animal.estadoSanitario || "SALUDABLE").toUpperCase(),
          potreroId: potreroId || null,
          fechaNacimiento: animal.fechaNacimiento ? new Date(animal.fechaNacimiento) : null,
          establecimientoId: establecimientoId || null,
          establecimiento: establecimiento || null,
        },
        include: { potrero: true },
      });

      return {
        ...nuevo,
        potrero: nuevo.potrero ? nuevo.potrero.nombre : "Sin potrero asignado",
        potreroNombre: nuevo.potrero ? nuevo.potrero.nombre : "Sin potrero asignado",
      };
    } catch (err) {
      console.warn("[GanadoModel] Fallo al guardar en Prisma, usando fallback:", err.message);
      const nuevo = {
        id: `gan-${Date.now()}`,
        ...animal,
        caravana: animal.caravana ? animal.caravana.trim().toUpperCase() : `AR-${Date.now()}`,
        pesoKg: Number(animal.pesoKg) || 400,
        estadoSanitario: (animal.estadoSanitario || "SALUDABLE").toUpperCase(),
        establecimientoId: establecimientoId || animal.establecimientoId || "est-el-rancho",
        establecimiento: establecimiento || animal.establecimiento || "Mi Establecimiento",
        fechaRegistro: new Date().toISOString(),
      };
      if (!db.ganado) db.ganado = [];
      db.ganado.push(nuevo);
      return nuevo;
    }
  }

  static async actualizar(id, datos) {
    try {
      const dataUpdate = {};
      if (datos.caravana) dataUpdate.caravana = datos.caravana.trim().toUpperCase();
      if (datos.categoria) dataUpdate.categoria = datos.categoria;
      if (datos.raza) dataUpdate.raza = datos.raza;
      if (datos.sexo) dataUpdate.sexo = datos.sexo;
      if (datos.pesoKg !== undefined) dataUpdate.pesoKg = parseFloat(datos.pesoKg);
      if (datos.estadoSanitario) dataUpdate.estadoSanitario = datos.estadoSanitario;
      if (datos.potreroId !== undefined) dataUpdate.potreroId = datos.potreroId;
      if (datos.fechaNacimiento) dataUpdate.fechaNacimiento = new Date(datos.fechaNacimiento);

      const actualizado = await prisma.ganado.update({
        where: { id },
        data: dataUpdate,
        include: { potrero: true },
      });
      return {
        ...actualizado,
        potrero: actualizado.potrero ? actualizado.potrero.nombre : "Sin potrero asignado",
        potreroNombre: actualizado.potrero ? actualizado.potrero.nombre : "Sin potrero asignado",
      };
    } catch (e) {
      const index = (db.ganado || []).findIndex((g) => g.id === id);
      if (index !== -1) {
        db.ganado[index] = { ...db.ganado[index], ...datos };
        return db.ganado[index];
      }
      throw e;
    }
  }

  static async darDeBaja(id, motivo = "Venta") {
    try {
      const eliminado = await prisma.ganado.delete({
        where: { id },
      });
      return { ...eliminado, motivoBaja: motivo };
    } catch (e) {
      const index = (db.ganado || []).findIndex((g) => g.id === id);
      if (index !== -1) {
        const [del] = db.ganado.splice(index, 1);
        return { ...del, motivoBaja: motivo };
      }
      throw e;
    }
  }

  static async trasladoMasivo(animalIds = [], potreroDestinoId) {
    if (!animalIds || animalIds.length === 0) {
      throw new Error("Debe seleccionar al menos un animal para trasladar.");
    }

    try {
      const res = await prisma.ganado.updateMany({
        where: { id: { in: animalIds } },
        data: { potreroId: potreroDestinoId },
      });
      return res;
    } catch (e) {
      animalIds.forEach((id) => {
        const animal = (db.ganado || []).find((g) => g.id === id);
        if (animal) animal.potreroId = potreroDestinoId;
      });
      return { count: animalIds.length };
    }
  }

  static async crearPotrero(datos, establecimientoId, establecimiento) {
    const {
      nombre,
      descripcion,
      superficieHas,
      capacidad,
      coordinates,
      color,
      pastura,
      aguada,
      estadoPastura,
    } = datos;

    const metaGeo = {
      nota: typeof descripcion === "string" ? descripcion : "",
      coordinates: Array.isArray(coordinates) ? coordinates : [],
      color: color || "#2e7d32",
      pastura: pastura || "Campo Natural",
      aguada: aguada || "Aguada no especificada",
      estadoPastura: estadoPastura || "Óptimo",
    };
    const descSerializada = JSON.stringify(metaGeo);

    try {
      const creado = await prisma.potrero.create({
        data: {
          nombre: (nombre || "Nueva Parcela").trim(),
          descripcion: descSerializada,
          superficieHas: superficieHas ? parseFloat(superficieHas) : null,
          capacidad: capacidad ? parseInt(capacidad, 10) : 100,
          establecimientoId: establecimientoId || null,
          establecimiento: establecimiento || null,
        },
      });
      return {
        ...creado,
        coordinates: metaGeo.coordinates,
        color: metaGeo.color,
        pastura: metaGeo.pastura,
        aguada: metaGeo.aguada,
        estadoPastura: metaGeo.estadoPastura,
        descripcion: metaGeo.nota,
        totalAnimales: 0,
        porcentajeCarga: 0,
      };
    } catch (e) {
      const nuevo = {
        id: `pot-${Date.now()}`,
        nombre: (nombre || "Nueva Parcela").trim(),
        descripcion: metaGeo.nota,
        coordinates: metaGeo.coordinates,
        color: metaGeo.color,
        pastura: metaGeo.pastura,
        aguada: metaGeo.aguada,
        estadoPastura: metaGeo.estadoPastura,
        superficieHas: parseFloat(superficieHas) || 0,
        capacidad: parseInt(capacidad, 10) || 100,
        establecimientoId: establecimientoId || "est-el-rancho",
        establecimiento: establecimiento || "Mi Establecimiento",
        animales: [],
      };
      if (!db.potreros) db.potreros = [];
      db.potreros.push(nuevo);
      return {
        ...nuevo,
        totalAnimales: 0,
        porcentajeCarga: 0,
      };
    }
  }

  static async eliminarPotrero(id, establecimientoId) {
    if (!id) throw new Error("ID de potrero requerido");
    try {
      await prisma.ganado.updateMany({
        where: { potreroId: id },
        data: { potreroId: null },
      });
      return await prisma.potrero.delete({
        where: { id },
      });
    } catch (e) {
      if (Array.isArray(db.potreros)) {
        const idx = db.potreros.findIndex((p) => p.id === id);
        if (idx !== -1) {
          const eliminado = db.potreros.splice(idx, 1)[0];
          if (Array.isArray(db.ganado)) {
            db.ganado.forEach((g) => {
              if (g.potreroId === id || g.potrero === eliminado.nombre) {
                g.potreroId = null;
                g.potrero = "Sin potrero asignado";
                g.potreroNombre = "Sin potrero asignado";
              }
            });
          }
          return eliminado;
        }
      }
      return { id, eliminado: true };
    }
  }
}

module.exports = GanadoModel;
