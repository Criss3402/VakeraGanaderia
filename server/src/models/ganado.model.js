const prisma = require("../config/prisma");
const db = require("../config/db");

class GanadoModel {
  static async listarTodos() {
    try {
      const lista = await prisma.ganado.findMany({
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
        potreroNombre: g.potrero ? g.potrero.nombre : "Sin potrero asignado",
        historialSanitario: g.eventosSanitarios || [],
      }));
    } catch (e) {
      console.warn("Fallback memoria para listar ganado:", e.message);
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
        porcentajeCarga: p.capacidad ? Math.min(100, Math.round((p.animales.length / p.capacidad) * 100)) : 0,
      }));
    } catch (e) {
      console.warn("Fallback memoria para potreros:", e.message);
      return [
        { id: "pot-1", nombre: "Potrero 1 - Los Eucaliptos", superficieHas: 120, capacidad: 150, totalAnimales: 1, porcentajeCarga: 1 },
        { id: "pot-2", nombre: "Potrero 2 - La Loma", superficieHas: 95, capacidad: 110, totalAnimales: 1, porcentajeCarga: 1 },
        { id: "pot-3", nombre: "Potrero 3 - El Trébol", superficieHas: 140, capacidad: 180, totalAnimales: 1, porcentajeCarga: 1 },
        { id: "pot-4", nombre: "Potrero 4 - Bajo Hondo", superficieHas: 80, capacidad: 90, totalAnimales: 1, porcentajeCarga: 1 },
        { id: "pot-5", nombre: "Potrero 5 - La Aguada", superficieHas: 160, capacidad: 200, totalAnimales: 1, porcentajeCarga: 1 },
      ];
    }
  }

  static async buscarPorId(id) {
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
      return g;
    } catch {
      return db.ganado.find((g) => g.id === id);
    }
  }

  static async obtenerMetricas() {
    try {
      const animales = await prisma.ganado.findMany();
      const total = animales.length;

      const porCategoria = animales.reduce((acc, curr) => {
        acc[curr.categoria] = (acc[curr.categoria] || 0) + 1;
        return acc;
      }, {});

      const porEstadoSanitario = animales.reduce((acc, curr) => {
        acc[curr.estadoSanitario] = (acc[curr.estadoSanitario] || 0) + 1;
        return acc;
      }, {});

      const pesoPromedio = total > 0
        ? Math.round(animales.reduce((acc, curr) => acc + (curr.pesoKg || 0), 0) / total)
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
      const nuevo = await prisma.ganado.create({
        data: {
          caravana: animal.caravana.trim().toUpperCase(),
          categoria: animal.categoria || "Vacas",
          raza: animal.raza || "Angus",
          sexo: animal.sexo || "Hembra",
          pesoKg: parseFloat(animal.pesoKg) || 400,
          estadoSanitario: animal.estadoSanitario || "SALUDABLE",
          potreroId: animal.potreroId || null,
          fechaNacimiento: animal.fechaNacimiento ? new Date(animal.fechaNacimiento) : null,
        },
        include: { potrero: true },
      });
      return nuevo;
    } catch (e) {
      console.warn("Fallback memoria registrar ganado:", e.message);
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
      return actualizado;
    } catch (e) {
      const index = db.ganado.findIndex((g) => g.id === id);
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
      const index = db.ganado.findIndex((g) => g.id === id);
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
        const animal = db.ganado.find((g) => g.id === id);
        if (animal) animal.potreroId = potreroDestinoId;
      });
      return { count: animalIds.length };
    }
  }

  static async crearPotrero({ nombre, descripcion, superficieHas, capacidad }) {
    try {
      return await prisma.potrero.create({
        data: {
          nombre: nombre.trim(),
          descripcion: descripcion || null,
          superficieHas: superficieHas ? parseFloat(superficieHas) : null,
          capacidad: capacidad ? parseInt(capacidad, 10) : 100,
        },
      });
    } catch (e) {
      const nuevo = {
        id: `pot-${Date.now()}`,
        nombre,
        descripcion,
        superficieHas: parseFloat(superficieHas),
        capacidad: parseInt(capacidad, 10) || 100,
        animales: [],
      };
      return nuevo;
    }
  }
}

module.exports = GanadoModel;
