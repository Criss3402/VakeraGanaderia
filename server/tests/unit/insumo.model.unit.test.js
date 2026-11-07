/**
 * Tests Unitarios — InsumoModel (Lógica de Inventario, Stock y Solicitudes)
 *
 * Fase 3C del Implementation Plan:
 * - Normalización de locaciones y determinación de sectores de custodia en listados.
 * - Registro y cálculo automático de criticidad (requiereReposicion).
 * - Actualización de stock (I4 / R14): sumar, restar, conteo, cota inferior 0 (no negativo).
 * - Eliminación unitaria y masiva con validación de arreglos.
 * - Gestión de locaciones (renombrado y reasignación por eliminación).
 * - Ciclo de vida de solicitudes de insumos y cambio de estados.
 * - Fallback en memoria ante desconexión de Prisma con emisión de console.warn (F2).
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// Aísla entorno de test
require("../helpers/tokens");
require("../helpers/rutas"); // Asegura stubs de Prisma para forzar fallback en memoria

const { resetearMemoria } = require("../helpers/memoria");
const InsumoModel = require("../../src/models/insumo.model");
const db = require("../../src/config/db");

const ESTABLECIMIENTO_ID = "est-insumo-test";
const ESTABLECIMIENTO_NOMBRE = "Establecimiento Test Insumos";

describe("Unitario — InsumoModel (Inventario, Stock y Gestión)", () => {
  beforeEach(() => {
    resetearMemoria();
    if (!Array.isArray(db.insumos)) db.insumos = [];
  });

  describe("1. Normalización de insumos y sectores de custodia", () => {
    it("divide campo y ubicación en el listado cuando contiene el separador ' - '", async () => {
      db.insumos.push({
        id: "ins-loc-custom-1",
        nombre: "Alambre Alta Resistencia",
        campo: null,
        ubicacion: "Campo Norte - Galpón de Herramientas",
        stockActual: 10,
        stockMinimo: 5,
        establecimientoId: ESTABLECIMIENTO_ID,
      });

      const lista = await InsumoModel.listarTodos(ESTABLECIMIENTO_ID);
      const normalizado = lista.find((i) => i.id === "ins-loc-custom-1");

      assert.ok(normalizado);
      assert.equal(normalizado.campo, "Campo Norte");
      assert.equal(normalizado.ubicacion, "Galpón de Herramientas");
    });

    it("asigna sectorCustodia adecuado según el nombre de la ubicación en listados", async () => {
      db.insumos.push(
        {
          id: "ins-cust-peon",
          nombre: "Machete",
          ubicacion: "Pertenencias de Peón",
          establecimientoId: ESTABLECIMIENTO_ID,
        },
        {
          id: "ins-cust-cap",
          nombre: "Pinza",
          ubicacion: "Taller Capataz",
          establecimientoId: ESTABLECIMIENTO_ID,
        },
        {
          id: "ins-cust-vet",
          nombre: "Jeringa",
          ubicacion: "Botiquín Veterinario",
          establecimientoId: ESTABLECIMIENTO_ID,
        },
        {
          id: "ins-cust-ofi",
          nombre: "Papel",
          ubicacion: "Depósito Central",
          establecimientoId: ESTABLECIMIENTO_ID,
        }
      );

      const lista = await InsumoModel.listarTodos(ESTABLECIMIENTO_ID);
      const peon = lista.find((i) => i.id === "ins-cust-peon");
      const cap = lista.find((i) => i.id === "ins-cust-cap");
      const vet = lista.find((i) => i.id === "ins-cust-vet");
      const ofi = lista.find((i) => i.id === "ins-cust-ofi");

      assert.equal(peon.sectorCustodia, "peon");
      assert.equal(cap.sectorCustodia, "capataz");
      assert.equal(vet.sectorCustodia, "veterinario");
      assert.equal(ofi.sectorCustodia, "oficina");
    });
  });

  describe("2. Registro de Insumos y Criticidad", () => {
    it("registra un insumo con stock adecuado y requiereReposicion en false", async () => {
      const nuevo = await InsumoModel.registrar(
        {
          nombre: "Ivermectina 1%",
          stockActual: 50,
          stockMinimo: 10,
          unidad: "Frascos",
          ubicacion: "Depósito Central",
        },
        ESTABLECIMIENTO_ID,
        ESTABLECIMIENTO_NOMBRE
      );

      assert.ok(nuevo.id.startsWith("ins-"));
      assert.equal(nuevo.stockActual, 50);
      assert.equal(nuevo.requiereReposicion, false);
      assert.equal(nuevo.estado, "OK");
      assert.equal(nuevo.establecimientoId, ESTABLECIMIENTO_ID);
    });

    it("detecta automáticamente criticidad si stockActual <= stockMinimo", async () => {
      const critico = await InsumoModel.registrar(
        {
          nombre: "Gasas estériles",
          stockActual: 5,
          stockMinimo: 10,
          unidad: "Paquetes",
        },
        ESTABLECIMIENTO_ID
      );

      assert.equal(critico.requiereReposicion, true);
      assert.ok(["Crítico", "Bajo Stock"].includes(critico.estado));
    });
  });

  describe("3. Actualización de Stock (I4 / R14 — Reglas e Invariantes)", () => {
    let insumoBase;

    beforeEach(async () => {
      insumoBase = {
        id: "ins-base-stock-test",
        nombre: "Caravana Visual Amarilla",
        stockActual: 100,
        stockMinimo: 20,
        unidad: "Unidades",
        estado: "OK",
        requiereReposicion: false,
        establecimientoId: ESTABLECIMIENTO_ID,
      };
      db.insumos.push(insumoBase);
    });

    it("operación 'sumar': incrementa el stock actual", async () => {
      const act = await InsumoModel.actualizarStock(insumoBase.id, 25, "sumar");
      assert.equal(act.stockActual, 125);
      assert.equal(act.requiereReposicion, false);
    });

    it("operación 'restar': decrementa el stock actual", async () => {
      const act = await InsumoModel.actualizarStock(insumoBase.id, 40, "restar");
      assert.equal(act.stockActual, 60);
      assert.equal(act.requiereReposicion, false);
    });

    it("I4/R14: restar mayor al stock disponible nunca produce stock negativo (cota inferior 0)", async () => {
      const act = await InsumoModel.actualizarStock(insumoBase.id, 999, "restar");
      assert.equal(act.stockActual, 0);
      assert.equal(act.requiereReposicion, true);
      assert.equal(act.estado, "Bajo Stock");
    });

    it("operación 'conteo': fija el stock directamente al valor físico ingresado", async () => {
      const act = await InsumoModel.actualizarStock(insumoBase.id, 15, "conteo");
      assert.equal(act.stockActual, 15);
      assert.equal(act.requiereReposicion, true);
      assert.equal(act.estado, "Bajo Stock");
    });

    it("I4: conteo negativo se ajusta a 0", async () => {
      const act = await InsumoModel.actualizarStock(insumoBase.id, -10, "conteo");
      assert.equal(act.stockActual, 0);
      assert.equal(act.requiereReposicion, true);
    });

    it("evalúa límite exacto: stockActual == stockMinimo activa requiereReposicion", async () => {
      const act = await InsumoModel.actualizarStock(insumoBase.id, 20, "conteo");
      assert.equal(act.stockActual, 20);
      assert.equal(act.requiereReposicion, true);
    });

    it("lanza error al intentar actualizar stock de un insumo inexistente", async () => {
      await assert.rejects(
        async () => {
          await InsumoModel.actualizarStock("ins-no-existe-999", 10, "sumar");
        },
        { name: "Error" }
      );
    });
  });

  describe("4. Eliminación unitaria y masiva", () => {
    beforeEach(() => {
      db.insumos.push(
        { id: "ins-del-1", nombre: "Item 1", stockActual: 10, establecimientoId: ESTABLECIMIENTO_ID },
        { id: "ins-del-2", nombre: "Item 2", stockActual: 20, establecimientoId: ESTABLECIMIENTO_ID }
      );
    });

    it("elimina un insumo existente y lo quita del almacenamiento", async () => {
      const del = await InsumoModel.eliminar("ins-del-1", ESTABLECIMIENTO_ID);
      assert.equal(del.id, "ins-del-1");

      const restante = (db.insumos || []).find((i) => i.id === "ins-del-1");
      assert.equal(restante, undefined);
    });

    it("eliminar sin ID lanza error de validación", async () => {
      await assert.rejects(async () => {
        await InsumoModel.eliminar(null, ESTABLECIMIENTO_ID);
      }, /ID de insumo requerido/i);
    });

    it("eliminarMasivo con arreglo de IDs borra todos los indicados", async () => {
      const res = await InsumoModel.eliminarMasivo(["ins-del-1", "ins-del-2"], ESTABLECIMIENTO_ID);
      assert.equal(res.count, 2);
      assert.deepEqual(res.ids, ["ins-del-1", "ins-del-2"]);

      const enDb = (db.insumos || []).filter((i) => ["ins-del-1", "ins-del-2"].includes(i.id));
      assert.equal(enDb.length, 0);
    });

    it("eliminarMasivo rechaza lista vacía con error explicativo", async () => {
      await assert.rejects(async () => {
        await InsumoModel.eliminarMasivo([], ESTABLECIMIENTO_ID);
      }, /Debe seleccionar al menos un insumo/i);
    });

    it("eliminarMasivo rechaza parámetro no array", async () => {
      await assert.rejects(async () => {
        await InsumoModel.eliminarMasivo("no-es-array", ESTABLECIMIENTO_ID);
      }, /Debe seleccionar al menos un insumo/i);
    });
  });

  describe("5. Gestión de Locaciones (Renombrado y Reasignación)", () => {
    beforeEach(() => {
      db.insumos.push({
        id: "ins-loc-item-1",
        nombre: "Pala ancha",
        campo: "Campo Viejo",
        ubicacion: "Campo Viejo - Galpón 1",
        stockActual: 2,
        establecimientoId: ESTABLECIMIENTO_ID,
      });
    });

    it("renombra una locación existente actualizando los insumos asociados", async () => {
      const res = await InsumoModel.gestionarLocacion({
        nombreAnterior: "Campo Viejo",
        nuevoNombre: "Campo Principal",
        accion: "editar",
        establecimientoId: ESTABLECIMIENTO_ID,
      });

      assert.equal(res.nuevoNombre, "Campo Principal");
      assert.ok(res.actualizados >= 1);

      const insumo = db.insumos.find((i) => i.id === "ins-loc-item-1");
      assert.equal(insumo.campo, "Campo Principal");
      assert.match(insumo.ubicacion, /Campo Principal/);
    });

    it("rechaza renombrado si el nuevoNombre está vacío en acción editar", async () => {
      await assert.rejects(async () => {
        await InsumoModel.gestionarLocacion({
          nombreAnterior: "Campo Viejo",
          nuevoNombre: "",
          accion: "editar",
          establecimientoId: ESTABLECIMIENTO_ID,
        });
      }, /El nuevo nombre de la locación no puede estar vacío/i);
    });

    it("eliminar locación reasigna insumos a 'Depósito General'", async () => {
      const res = await InsumoModel.gestionarLocacion({
        nombreAnterior: "Campo Viejo",
        accion: "eliminar",
        establecimientoId: ESTABLECIMIENTO_ID,
      });

      assert.equal(res.accion, "eliminar");
      const insumo = db.insumos.find((i) => i.id === "ins-loc-item-1");
      assert.equal(insumo.campo, "Depósito General");
    });
  });

  describe("6. Solicitudes de Insumos y Estados", () => {
    it("crea una solicitud en estado Pendiente y registra metadata del solicitante", () => {
      const sol = InsumoModel.registrarSolicitud({
        insumoNombre: "Alambre 1000m",
        cantidad: 3,
        unidad: "Rollos",
        solicitanteNombre: "Lucas Peón",
        solicitanteRol: "peon",
        sector: "Pertenencias de Peón",
        establecimientoId: ESTABLECIMIENTO_ID,
      });

      assert.ok(sol.id.startsWith("sol-"));
      assert.equal(sol.estado, "Pendiente");
      assert.equal(sol.cantidad, 3);
      assert.equal(sol.sector, "Pertenencias de Peón");
    });

    it("actualiza estado de solicitud a Aprobado con firma de supervisor", async () => {
      const sol = InsumoModel.registrarSolicitud({
        insumoNombre: "Vacuna",
        cantidad: 10,
        solicitanteNombre: "Lucas",
        establecimientoId: ESTABLECIMIENTO_ID,
      });

      const act = await InsumoModel.actualizarEstadoSolicitud(
        sol.id,
        "Aprobado",
        "Martín Capataz (capataz)"
      );

      assert.equal(act.estado, "Aprobado");
      assert.equal(act.revisadoPor, "Martín Capataz (capataz)");
    });
  });

  describe("7. Fallback en Memoria y Observabilidad F2", () => {
    it("emite console.warn con contexto al usar el fallback en memoria", async () => {
      const advertencias = [];
      const warnOriginal = console.warn;
      console.warn = (...args) => {
        advertencias.push(args.join(" "));
      };

      try {
        await InsumoModel.listarTodos(ESTABLECIMIENTO_ID);
        assert.ok(
          advertencias.some((msg) => msg.includes("[InsumoModel]")),
          "Debe emitir advertencia con prefijo [InsumoModel] ante desconexión de Prisma"
        );
      } finally {
        console.warn = warnOriginal;
      }
    });
  });
});
