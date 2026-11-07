/**
 * Tests Unitarios — GanadoModel (Rodeo, Potreros y Trazabilidad)
 *
 * Fase 3C del Implementation Plan:
 * - I6: normalización de caravanas (mayúsculas, trim) y validación de atributos.
 * - Paginación y listado de rodeo por tenant.
 * - Búsqueda por ID y por caravana (case-insensitive).
 * - Actualización de ficha animal y peso corporal.
 * - Baja individual y masiva con validación de arreglos.
 * - Traslado masivo de animales entre potreros.
 * - Gestión completa de potreros (crear, listar con carga, eliminar y desasignar).
 * - Cálculo de métricas del rodeo (distribución por categoría y estado).
 * - Fallback en memoria ante fallos de Prisma con console.warn (F2).
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// Aísla entorno de test
require("../helpers/tokens");
require("../helpers/rutas");

const { resetearMemoria } = require("../helpers/memoria");
const GanadoModel = require("../../src/models/ganado.model");
const db = require("../../src/config/db");

const ESTABLECIMIENTO_ID = "est-ganado-test";
const ESTABLECIMIENTO_NOMBRE = "Establecimiento Ganadero Test";

describe("Unitario — GanadoModel (Rodeo, Potreros y Métricas)", () => {
  beforeEach(() => {
    resetearMemoria();
    if (!Array.isArray(db.ganado)) db.ganado = [];
    if (!Array.isArray(db.potreros)) db.potreros = [];
  });

  describe("1. Registro de Animales e I6 (Normalización de Caravana)", () => {
    it("I6: normaliza la caravana eliminando espacios y convirtiendo a mayúsculas", async () => {
      const animal = await GanadoModel.registrar(
        {
          caravana: "  ar-88421  ",
          categoria: "Novillos",
          raza: "Angus Colorado",
          pesoKg: 430,
        },
        ESTABLECIMIENTO_ID,
        ESTABLECIMIENTO_NOMBRE
      );

      assert.equal(animal.caravana, "AR-88421");
      assert.equal(animal.pesoKg, 430);
      assert.equal(animal.estadoSanitario, "SALUDABLE");
      assert.ok(animal.id.startsWith("gan-"));
      assert.equal(animal.establecimientoId, ESTABLECIMIENTO_ID);
    });

    it("asigna valores por defecto de peso y estado cuando no son informados", async () => {
      const animal = await GanadoModel.registrar(
        { caravana: "AR-DEF-01" },
        ESTABLECIMIENTO_ID
      );

      assert.equal(animal.pesoKg, 400);
      assert.equal(animal.estadoSanitario, "SALUDABLE");
      assert.equal(animal.caravana, "AR-DEF-01");
    });
  });

  describe("2. Listado, Búsqueda y Paginación", () => {
    beforeEach(() => {
      db.ganado.push(
        { id: "gan-t-1", caravana: "AR-101", pesoKg: 350, establecimientoId: ESTABLECIMIENTO_ID },
        { id: "gan-t-2", caravana: "AR-102", pesoKg: 420, establecimientoId: ESTABLECIMIENTO_ID },
        { id: "gan-t-3", caravana: "AR-103", pesoKg: 510, establecimientoId: ESTABLECIMIENTO_ID }
      );
    });

    it("listarTodos retorna únicamente animales del establecimiento", async () => {
      const lista = await GanadoModel.listarTodos(ESTABLECIMIENTO_ID);
      assert.equal(lista.length, 3);
      for (const item of lista) {
        assert.equal(item.establecimientoId, ESTABLECIMIENTO_ID);
      }
    });

    it("soporta paginación en memoria con take y skip", async () => {
      const paginada = await GanadoModel.listarTodos(ESTABLECIMIENTO_ID, { take: 2, skip: 1 });
      assert.equal(paginada.length, 2);
      assert.equal(paginada[0].id, "gan-t-2");
      assert.equal(paginada[1].id, "gan-t-3");
    });

    it("buscarPorId retorna el animal existente", async () => {
      const animal = await GanadoModel.buscarPorId("gan-t-2");
      assert.ok(animal);
      assert.equal(animal.caravana, "AR-102");
    });

    it("buscarPorId retorna null para identificadores inexistentes", async () => {
      const res = await GanadoModel.buscarPorId("gan-inexistente");
      assert.equal(res, null);
    });

    it("buscarPorCaravana es insensible a mayúsculas y minúsculas", async () => {
      const animal = await GanadoModel.buscarPorCaravana("ar-103", ESTABLECIMIENTO_ID);
      assert.ok(animal);
      assert.equal(animal.id, "gan-t-3");
    });
  });

  describe("3. Actualización de Ficha Animal", () => {
    beforeEach(() => {
      db.ganado.push({
        id: "gan-act-1",
        caravana: "AR-MOD-01",
        pesoKg: 380,
        estadoSanitario: "SALUDABLE",
        establecimientoId: ESTABLECIMIENTO_ID,
      });
    });

    it("actualiza pesoKg y estadoSanitario en memoria", async () => {
      const act = await GanadoModel.actualizar("gan-act-1", {
        pesoKg: 410,
        estadoSanitario: "EN_TRATAMIENTO",
      });

      assert.equal(act.pesoKg, 410);
      assert.equal(act.estadoSanitario, "EN_TRATAMIENTO");
    });

    it("lanza error al intentar actualizar un animal inexistente", async () => {
      await assert.rejects(async () => {
        await GanadoModel.actualizar("gan-no-existe", { pesoKg: 500 });
      });
    });
  });

  describe("4. Bajas Individuales y Masivas", () => {
    beforeEach(() => {
      db.ganado.push(
        { id: "gan-baja-1", caravana: "AR-B1", establecimientoId: ESTABLECIMIENTO_ID },
        { id: "gan-baja-2", caravana: "AR-B2", establecimientoId: ESTABLECIMIENTO_ID }
      );
    });

    it("darDeBaja individual elimina el animal de memoria y añade motivoBaja", async () => {
      const res = await GanadoModel.darDeBaja("gan-baja-1", "Faena");
      assert.equal(res.id, "gan-baja-1");
      assert.equal(res.motivoBaja, "Faena");

      const existe = db.ganado.some((g) => g.id === "gan-baja-1");
      assert.equal(existe, false);
    });

    it("darDeBajaMasivo elimina múltiples animales del tenant indicado", async () => {
      const res = await GanadoModel.darDeBajaMasivo(
        ["gan-baja-1", "gan-baja-2"],
        "Venta Lote",
        ESTABLECIMIENTO_ID
      );

      assert.equal(res.count, 2);
      assert.equal(res.motivoBaja, "Venta Lote");
    });

    it("darDeBajaMasivo rechaza lista vacía", async () => {
      await assert.rejects(async () => {
        await GanadoModel.darDeBajaMasivo([], "Venta", ESTABLECIMIENTO_ID);
      }, /Debe seleccionar al menos un animal/i);
    });

    it("darDeBajaMasivo rechaza parámetro que no sea array", async () => {
      await assert.rejects(async () => {
        await GanadoModel.darDeBajaMasivo(null, "Venta", ESTABLECIMIENTO_ID);
      }, /Debe seleccionar al menos un animal/i);
    });
  });

  describe("5. Traslado Masivo entre Potreros", () => {
    beforeEach(() => {
      db.ganado.push(
        { id: "gan-tras-1", potreroId: "pot-origen", establecimientoId: ESTABLECIMIENTO_ID },
        { id: "gan-tras-2", potreroId: "pot-origen", establecimientoId: ESTABLECIMIENTO_ID }
      );
    });

    it("traslada animales asignándoles el nuevo potreroDestinoId", async () => {
      const res = await GanadoModel.trasladoMasivo(["gan-tras-1", "gan-tras-2"], "pot-destino");
      assert.equal(res.count, 2);

      const a1 = db.ganado.find((g) => g.id === "gan-tras-1");
      const a2 = db.ganado.find((g) => g.id === "gan-tras-2");
      assert.equal(a1.potreroId, "pot-destino");
      assert.equal(a2.potreroId, "pot-destino");
    });

    it("trasladoMasivo sin animales lanza error de validación", async () => {
      await assert.rejects(async () => {
        await GanadoModel.trasladoMasivo([], "pot-destino");
      }, /Debe seleccionar al menos un animal/i);
    });
  });

  describe("6. Gestión de Potreros (Creación, Listado y Eliminación)", () => {
    it("crearPotrero registra un nuevo potrero con identificador pot- y metadata", async () => {
      const nuevo = await GanadoModel.crearPotrero(
        {
          nombre: "Potrero El Ombú",
          superficieHas: 75,
          capacidad: 80,
          color: "#1b5e20",
        },
        ESTABLECIMIENTO_ID,
        ESTABLECIMIENTO_NOMBRE
      );

      assert.ok(nuevo.id.startsWith("pot-"));
      assert.equal(nuevo.nombre, "Potrero El Ombú");
      assert.equal(nuevo.establecimientoId, ESTABLECIMIENTO_ID);
    });

    it("listarPotreros calcula porcentaje de carga en base al ganado asignado", async () => {
      db.potreros.push({
        id: "pot-carga-1",
        nombre: "Potrero La Vega",
        capacidad: 10,
        establecimientoId: ESTABLECIMIENTO_ID,
      });

      db.ganado.push(
        { id: "gan-c-1", potreroId: "pot-carga-1", establecimientoId: ESTABLECIMIENTO_ID },
        { id: "gan-c-2", potreroId: "pot-carga-1", establecimientoId: ESTABLECIMIENTO_ID }
      );

      const potreros = await GanadoModel.listarPotreros(ESTABLECIMIENTO_ID);
      const p = potreros.find((item) => item.id === "pot-carga-1");

      assert.ok(p);
      assert.equal(p.totalAnimales, 2);
      assert.equal(p.porcentajeCarga, 20); // 2 de 10 = 20%
    });

    it("eliminarPotrero desasigna el potrero de los animales que lo tenían", async () => {
      db.potreros.push({
        id: "pot-elim-1",
        nombre: "Potrero Temporario",
        establecimientoId: ESTABLECIMIENTO_ID,
      });
      db.ganado.push({
        id: "gan-elim-asig",
        potreroId: "pot-elim-1",
        potrero: "Potrero Temporario",
        establecimientoId: ESTABLECIMIENTO_ID,
      });

      const res = await GanadoModel.eliminarPotrero("pot-elim-1", ESTABLECIMIENTO_ID);
      assert.equal(res.id, "pot-elim-1");

      const animal = db.ganado.find((g) => g.id === "gan-elim-asig");
      assert.equal(animal.potreroId, null);
      assert.equal(animal.potrero, "Sin potrero asignado");
    });
  });

  describe("7. Métricas del Rodeo", () => {
    it("obtenerMetricas calcula totalCabezas, peso promedio y distribuciones", async () => {
      db.ganado.push(
        { id: "g-m-1", categoria: "Novillos", estadoSanitario: "SALUDABLE", pesoKg: 400, establecimientoId: ESTABLECIMIENTO_ID },
        { id: "g-m-2", categoria: "Novillos", estadoSanitario: "EN_TRATAMIENTO", pesoKg: 500, establecimientoId: ESTABLECIMIENTO_ID },
        { id: "g-m-3", categoria: "Toros", estadoSanitario: "SALUDABLE", pesoKg: 600, establecimientoId: ESTABLECIMIENTO_ID }
      );

      const metricas = await GanadoModel.obtenerMetricas(ESTABLECIMIENTO_ID);

      assert.equal(metricas.totalCabezas, 3);
      assert.equal(metricas.pesoPromedioKg, 500); // (400+500+600)/3 = 500
      assert.equal(metricas.porCategoria["Novillos"], 2);
      assert.equal(metricas.porCategoria["Toros"], 1);
      assert.equal(metricas.porEstadoSanitario["SALUDABLE"], 2);
      assert.equal(metricas.porEstadoSanitario["EN_TRATAMIENTO"], 1);
    });
  });

  describe("8. Fallback en Memoria F2", () => {
    it("emite console.warn con prefijo de modelo ante fallo de Prisma", async () => {
      const advertencias = [];
      const warnOriginal = console.warn;
      console.warn = (...args) => {
        advertencias.push(args.join(" "));
      };

      try {
        await GanadoModel.listarTodos(ESTABLECIMIENTO_ID);
        assert.ok(
          advertencias.some((msg) => msg.includes("[GanadoModel]")),
          "Debe emitir advertencia [GanadoModel] al consultar Prisma desconectado"
        );
      } finally {
        console.warn = warnOriginal;
      }
    });
  });
});
