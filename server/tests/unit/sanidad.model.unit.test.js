/**
 * Tests Unitarios — SanidadModel (Eventos Sanitarios, Vacunaciones y Alertas)
 *
 * Fase 3C del Implementation Plan:
 * - Listado de eventos y alertas sanitarias por tenant.
 * - Filtrado de alertas sanitarias activas (excluye Completado y Hecho).
 * - Registro de eventos sanitarios con identificador san- y defaults.
 * - Actualización de estado de eventos.
 * - Fallback en memoria ante fallos de Prisma con console.warn (F2).
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// Aísla entorno de test
require("../helpers/tokens");
require("../helpers/rutas");

const { resetearMemoria } = require("../helpers/memoria");
const SanidadModel = require("../../src/models/sanidad.model");
const db = require("../../src/config/db");

const ESTABLECIMIENTO_ID = "est-sanidad-test";
const ESTABLECIMIENTO_NOMBRE = "Establecimiento Sanidad Test";

describe("Unitario — SanidadModel (Alertas y Calendario Sanitario)", () => {
  beforeEach(() => {
    resetearMemoria();
    if (!Array.isArray(db.sanidad)) db.sanidad = [];
  });

  describe("1. Registro de Eventos Sanitarios", () => {
    it("registra un evento con id prefijado san- y estado inicial Pendiente", async () => {
      const nuevo = await SanidadModel.registrarEvento(
        {
          evento: "Vacunación Antiaftosa Primavera",
          tipo: "Vacunación Oficial",
          lote: "Terneros 2026",
          prioridad: "Alta",
        },
        ESTABLECIMIENTO_ID,
        ESTABLECIMIENTO_NOMBRE
      );

      assert.ok(nuevo.id.startsWith("san-"));
      assert.equal(nuevo.evento, "Vacunación Antiaftosa Primavera");
      assert.equal(nuevo.estado, "Pendiente");
      assert.equal(nuevo.establecimientoId, ESTABLECIMIENTO_ID);
    });
  });

  describe("2. Listado y Filtrado de Alertas Activas", () => {
    beforeEach(() => {
      db.sanidad.push(
        {
          id: "san-act-1",
          evento: "Tratamiento Coccidiosis",
          estado: "Pendiente",
          establecimientoId: ESTABLECIMIENTO_ID,
        },
        {
          id: "san-act-2",
          evento: "Vacuna Carbunclo",
          estado: "En Curso",
          establecimientoId: ESTABLECIMIENTO_ID,
        },
        {
          id: "san-fin-1",
          evento: "Desparasitación",
          estado: "Completado",
          establecimientoId: ESTABLECIMIENTO_ID,
        },
        {
          id: "san-fin-2",
          evento: "Revisión Odontológica",
          estado: "Hecho",
          establecimientoId: ESTABLECIMIENTO_ID,
        },
        {
          id: "san-ajeno",
          evento: "Evento Ajeno",
          estado: "Pendiente",
          establecimientoId: "otro-est",
        }
      );
    });

    it("listarAlertasYEventos solo retorna los eventos del establecimiento", async () => {
      const eventos = await SanidadModel.listarAlertasYEventos(ESTABLECIMIENTO_ID);
      assert.equal(eventos.length, 4);
      for (const ev of eventos) {
        assert.equal(ev.establecimientoId, ESTABLECIMIENTO_ID);
      }
    });

    it("obtenerAlertasActivas excluye los eventos con estado 'Completado' y 'Hecho'", async () => {
      const activas = await SanidadModel.obtenerAlertasActivas(ESTABLECIMIENTO_ID);
      assert.equal(activas.length, 2);

      const estados = activas.map((a) => a.estado);
      assert.ok(estados.includes("Pendiente"));
      assert.ok(estados.includes("En Curso"));
      assert.ok(!estados.includes("Completado"));
      assert.ok(!estados.includes("Hecho"));
    });
  });

  describe("3. Actualización de Estados Sanitarios", () => {
    beforeEach(() => {
      db.sanidad.push({
        id: "san-upd-1",
        evento: "Tratamiento Antibiótico",
        estado: "Pendiente",
        establecimientoId: ESTABLECIMIENTO_ID,
      });
    });

    it("actualiza el estado de un evento existente a Completado", async () => {
      const act = await SanidadModel.actualizarEstado("san-upd-1", "Completado");
      assert.equal(act.estado, "Completado");

      const enDb = db.sanidad.find((s) => s.id === "san-upd-1");
      assert.equal(enDb.estado, "Completado");
    });

    it("lanza error al intentar actualizar un evento inexistente", async () => {
      await assert.rejects(async () => {
        await SanidadModel.actualizarEstado("san-no-existe-999", "Completado");
      });
    });
  });

  describe("4. Fallback en Memoria F2", () => {
    it("emite console.warn con prefijo [SanidadModel] ante fallo de Prisma", async () => {
      const advertencias = [];
      const warnOriginal = console.warn;
      console.warn = (...args) => {
        advertencias.push(args.join(" "));
      };

      try {
        await SanidadModel.listarAlertasYEventos(ESTABLECIMIENTO_ID);
        assert.ok(
          advertencias.some((msg) => msg.includes("[SanidadModel]")),
          "Debe emitir advertencia con prefijo [SanidadModel]"
        );
      } finally {
        console.warn = warnOriginal;
      }
    });
  });
});

