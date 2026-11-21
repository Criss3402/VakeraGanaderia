const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const DolarService = require("../../src/services/dolar.service");

describe("DolarService", () => {
  beforeEach(() => {
    DolarService.limpiarCache();
  });

  it("normaliza la lista de cotizaciones de DolarApi por casa", () => {
    const mock = [
      { moneda: "USD", casa: "oficial", nombre: "Oficial", compra: 1550, venta: 1600, fechaActualizacion: "2026-11-20T18:00:00.000Z" },
      { moneda: "USD", casa: "blue", nombre: "Blue", compra: 1655, venta: 1675, fechaActualizacion: "2026-11-20T20:56:00.000Z" },
      { moneda: "USD", casa: "bolsa", nombre: "Bolsa", compra: 1682.6, venta: 1743.1, fechaActualizacion: "2026-11-20T20:56:00.000Z" },
    ];

    const res = DolarService.normalizarLista(mock);
    assert.equal(res.oficial.venta, 1600);
    assert.equal(res.blue.compra, 1655);
    assert.equal(res.bolsa.venta, 1743.1);
  });
});
