/**
 * Tests Unitarios — ParteDiarioModel (Partes Operativos de Campo y Transición de Estados)
 *
 * Fase 3C del Implementation Plan:
 * - I5: normalización de estados a mayúsculas, formateo de fechas ISO y defaults.
 * - Listado de partes por tenant y filtrado de pendientes de revisión.
 * - Registro de partes diarios con validaciones de novedades y animales revisados.
 * - Transición de estados (APROBADO, RECHAZADO, PENDIENTE) y asignación de supervisor.
 * - Rechazo de estados no permitidos (ej: CANCELADO) y partes inexistentes.
 * - Fallback en memoria ante fallos de Prisma con console.warn (F2).
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// Aísla entorno de test
require("../helpers/tokens");
require("../helpers/rutas");

const { resetearMemoria } = require("../helpers/memoria");
const ParteDiarioModel = require("../../src/models/parteDiario.model");
const db = require("../../src/config/db");

const ESTABLECIMIENTO_ID = "est-partes-test";
const ESTABLECIMIENTO_NOMBRE = "Establecimiento Partes Test";

describe("Unitario — ParteDiarioModel (Novedades de Campo y Estados I5)", () => {
  beforeEach(() => {
    resetearMemoria();
    if (!Array.isArray(db.partesDiarios)) db.partesDiarios = [];
  });

  describe("1. Formateo y Normalización I5", () => {
    it("normaliza estado a mayúsculas y formatea fecha a ISO YYYY-MM-DD", () => {
      const parteCrudo = {
        id: "pd-raw-1",
        fecha: new Date("2026-10-15T14:30:00Z"),
        estado: "aprobado",
        novedades: "Revisión general",
        animalesRevisados: "45",
      };

      const formateado = ParteDiarioModel.formatearParte(parteCrudo);

      assert.equal(formateado.estado, "APROBADO");
      assert.equal(formateado.fecha, "2026-10-15");
      assert.equal(formateado.animalesRevisados, 45);
      assert.equal(formateado.peonNombre, "Operario de Campo");
      assert.equal(formateado.potreroNombre, "Potrero General");
    });

    it("formatea revisadoPor extrayendo nombre y rol si se pasa como objeto", () => {
      const parteConObj = {
        id: "pd-rev-1",
        novedades: "OK",
        revisadoPor: { nombre: "Martín Benítez", rol: "capataz" },
      };

      const formateado = ParteDiarioModel.formatearParte(parteConObj);
      assert.equal(formateado.revisadoPor, "Martín Benítez (capataz)");
    });
  });

  describe("2. Registro y Consulta de Partes", () => {
    it("registra un parte nuevo con estado inicial PENDIENTE e identificador pd-", async () => {
      const nuevo = await ParteDiarioModel.registrar({
        peonNombre: "Lucas Giménez",
        potreroNombre: "Potrero 2 Norte",
        novedades: "Alambre perimetral reparado y animales tranquilos.",
        animalesRevisados: 80,
        establecimientoId: ESTABLECIMIENTO_ID,
        establecimiento: ESTABLECIMIENTO_NOMBRE,
      });

      assert.ok(nuevo.id.startsWith("pd-"));
      assert.equal(nuevo.estado, "PENDIENTE");
      assert.equal(nuevo.animalesRevisados, 80);
      assert.equal(nuevo.establecimientoId, ESTABLECIMIENTO_ID);
    });

    it("listarTodos y obtenerPendientes filtran correctamente", async () => {
      db.partesDiarios.push(
        {
          id: "pd-f-1",
          novedades: "Parte 1",
          estado: "PENDIENTE",
          establecimientoId: ESTABLECIMIENTO_ID,
        },
        {
          id: "pd-f-2",
          novedades: "Parte 2",
          estado: "APROBADO",
          establecimientoId: ESTABLECIMIENTO_ID,
        },
        {
          id: "pd-f-3",
          novedades: "Parte Ajeno",
          estado: "PENDIENTE",
          establecimientoId: "otro-est",
        }
      );

      const todos = await ParteDiarioModel.listarTodos(ESTABLECIMIENTO_ID);
      assert.equal(todos.length, 2);

      const pendientes = await ParteDiarioModel.obtenerPendientes(ESTABLECIMIENTO_ID);
      assert.equal(pendientes.length, 1);
      assert.equal(pendientes[0].id, "pd-f-1");
    });
  });

  describe("3. Transición de Estados (I5)", () => {
    beforeEach(() => {
      db.partesDiarios.push({
        id: "pd-estado-test",
        novedades: "Novedades para evaluar",
        estado: "PENDIENTE",
        establecimientoId: ESTABLECIMIENTO_ID,
      });
    });

    it("permite cambiar estado a APROBADO e inyecta revisor", async () => {
      const supervisor = { id: "usr-cap-1", nombre: "Martín Benítez", rol: "capataz" };
      const act = await ParteDiarioModel.cambiarEstado("pd-estado-test", "aprobado", supervisor);

      assert.equal(act.estado, "APROBADO");
      assert.equal(act.revisadoPor, "Martín Benítez (capataz)");
      assert.ok(act.fechaRevision);
    });

    it("permite cambiar estado a RECHAZADO", async () => {
      const act = await ParteDiarioModel.cambiarEstado("pd-estado-test", "RECHAZADO");
      assert.equal(act.estado, "RECHAZADO");
    });

    it("rechaza transiciones a estados inválidos como CANCELADO", async () => {
      await assert.rejects(async () => {
        await ParteDiarioModel.cambiarEstado("pd-estado-test", "CANCELADO");
      }, /Estado inválido: CANCELADO/i);
    });

    it("lanza error al intentar cambiar estado de un parte que no existe", async () => {
      await assert.rejects(async () => {
        await ParteDiarioModel.cambiarEstado("pd-no-existe-999", "APROBADO");
      }, /Parte diario no encontrado/i);
    });
  });

  describe("4. Fallback en Memoria F2", () => {
    it("emite console.warn con prefijo [ParteDiarioModel] ante error de Prisma", async () => {
      const advertencias = [];
      const warnOriginal = console.warn;
      console.warn = (...args) => {
        advertencias.push(args.join(" "));
      };

      try {
        await ParteDiarioModel.listarTodos(ESTABLECIMIENTO_ID);
        assert.ok(
          advertencias.some((msg) => msg.includes("[ParteDiarioModel]")),
          "Debe emitir advertencia con prefijo [ParteDiarioModel]"
        );
      } finally {
        console.warn = warnOriginal;
      }
    });
  });
});

