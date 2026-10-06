const prisma = require("../config/prisma");
const db = require("../config/db");

class GanadoModel {
  static async listarTodos() {
    try {
      const lista = await prisma.ganado.findMany({
        include: { potrero: true },
        orderBy: { fechaRegistro: "desc" },
      });
      return lista.map((g) => ({
        ...g,
        potrero: g.potrero ? g.potrero.nombre : "Sin potrero asignado",
        potreroId: g.potreroId || null,
      }));
    } catch (err) {
      console.warn("[GanadoModel] Fallo al consultar Prisma, usando fallback en memoria:", err.message);
      return db.ganado;
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
      };
    } catch {
      return db.ganado.find((g) => g.caravana.toLowerCase() === caravana.toLowerCase()) || null;
    }
  }

  static async obtenerMetricas() {
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
}

module.exports = GanadoModel;
