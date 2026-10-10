const prisma = require("../config/prisma");
const db = require("../config/db");

class GanadoModel {
  static async listarTodos() {
    try {
      const lista = await prisma.ganado.findMany({
        include: { potrero: true },
        orderBy: { caravana: "asc" },
      });
      return lista.map((g) => ({
        ...g,
        potrero: g.potrero ? g.potrero.nombre : "Sin potrero asignado",
        potreroNombre: g.potrero ? g.potrero.nombre : "Sin potrero asignado",
        potreroId: g.potreroId || null,
      }));
    } catch (err) {
      console.warn("[GanadoModel] Fallo al consultar Prisma, usando fallback en memoria:", err.message);
      return db.ganado;
    }
  }

  static async listarPotreros() {
    try {
      const potreros = await prisma.potrero.findMany({
        include: { animales: true },
        orderBy: { nombre: "asc" },
      });
      return potreros.map((p) => ({
        ...p,
        totalAnimales: p.animales.length,
      }));
    } catch (e) {
      console.warn("Fallback memoria para potreros:", e.message);
      return [
        { id: "pot-1", nombre: "Potrero 1 - Los Eucaliptos", superficieHas: 120, capacidad: 150, totalAnimales: 1 },
        { id: "pot-2", nombre: "Potrero 2 - La Loma", superficieHas: 95, capacidad: 110, totalAnimales: 1 },
        { id: "pot-3", nombre: "Potrero 3 - El Trébol", superficieHas: 140, capacidad: 180, totalAnimales: 1 },
        { id: "pot-4", nombre: "Potrero 4 - Bajo Hondo", superficieHas: 80, capacidad: 90, totalAnimales: 1 },
        { id: "pot-5", nombre: "Potrero 5 - La Aguada", superficieHas: 160, capacidad: 200, totalAnimales: 1 },
      ];
    }
  }

  static async buscarPorId(id) {
    if (!id) return null;
    try {
      const g = await prisma.ganado.findUnique({
        where: { id },
        include: { potrero: true },
      });
      if (!g) return null;
      return {
        ...g,
        potrero: g.potrero ? g.potrero.nombre : "Sin potrero asignado",
        potreroNombre: g.potrero ? g.potrero.nombre : "Sin potrero asignado",
      };
    } catch {
      return db.ganado.find((g) => g.id === id) || null;
    }
  }

  static async buscarPorCaravana(caravana) {
    if (!caravana) return null;
    try {
      const g = await prisma.ganado.findFirst({
        where: { caravana: { equals: caravana, mode: "insensitive" } },
        include: { potrero: true },
      });
      if (!g) return null;
      return {
        ...g,
        potrero: g.potrero ? g.potrero.nombre : "Sin potrero asignado",
        potreroNombre: g.potrero ? g.potrero.nombre : "Sin potrero asignado",
      };
    } catch {
      return db.ganado.find((g) => g.caravana.toLowerCase() === caravana.toLowerCase()) || null;
    }
  }

  static async obtenerMetricas() {
    try {
      const lista = await this.listarTodos();
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
        tasaMortalidadMensual: "0.8%",
      };
    } catch {
      const total = db.ganado.length;
      const porCategoria = db.ganado.reduce((acc, curr) => {
        acc[curr.categoria] = (acc[curr.categoria] || 0) + 1;
        return acc;
      }, {});

      const porEstadoSanitario = db.ganado.reduce((acc, curr) => {
        acc[curr.estadoSanitario] = (acc[curr.estadoSanitario] || 0) + 1;
        return acc;
      }, {});

      const pesoPromedio = total > 0
        ? Math.round(db.ganado.reduce((acc, curr) => acc + (curr.pesoKg || 0), 0) / total)
        : 0;

      return {
        totalCabezas: total,
        porCategoria,
        porEstadoSanitario,
        pesoPromedioKg: pesoPromedio,
        tasaMortalidadMensual: "0.8%",
      };
    }
  }

  static async registrar(animal) {
    try {
      let potreroId = animal.potreroId;
      if (!potreroId && animal.potrero) {
        const pEncontrado = await prisma.potrero.findFirst({
          where: { nombre: { contains: animal.potrero, mode: "insensitive" } },
        });
        if (pEncontrado) potreroId = pEncontrado.id;
      }

      const nuevo = await prisma.ganado.create({
        data: {
          caravana: animal.caravana,
          categoria: animal.categoria || "Vacas",
          raza: animal.raza || "Angus",
          sexo: animal.sexo || "Hembra",
          pesoKg: Number(animal.pesoKg) || 400,
          estadoSanitario: (animal.estadoSanitario || "SALUDABLE").toUpperCase(),
          potreroId: potreroId || null,
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
        fechaRegistro: new Date().toISOString(),
      };
      db.ganado.push(nuevo);
      return nuevo;
    }
  }

  static async actualizar(id, datos) {
    try {
      const actualizado = await prisma.ganado.update({
        where: { id },
        data: {
          ...(datos.pesoKg && { pesoKg: parseFloat(datos.pesoKg) }),
          ...(datos.estadoSanitario && { estadoSanitario: datos.estadoSanitario }),
          ...(datos.potreroId && { potreroId: datos.potreroId }),
        },
        include: { potrero: true },
      });
      return {
        ...actualizado,
        potrero: actualizado.potrero ? actualizado.potrero.nombre : "Sin potrero asignado",
        potreroNombre: actualizado.potrero ? actualizado.potrero.nombre : "Sin potrero asignado",
      };
    } catch (e) {
      const index = db.ganado.findIndex((g) => g.id === id);
      if (index !== -1) {
        db.ganado[index] = { ...db.ganado[index], ...datos };
        return db.ganado[index];
      }
      throw e;
    }
  }
}

module.exports = GanadoModel;
