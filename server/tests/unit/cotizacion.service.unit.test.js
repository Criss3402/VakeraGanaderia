const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const CotizacionService = require("../../src/services/cotizacion.service");

const HTML_MOCK_PRECIOS = `
<Table>
<TR><TD><BR>NOVILLOS Mest.EyB 431/460</TD><TD>4000,000</TD><TD>4500,000</TD><TD>4276,153</TD><TD>4300,000</TD><TD>183</TD></TR>
<TR><TD>NOVILLOS Mest.EyB 461/490</TD><TD>3100,000</TD><TD>4500,000</TD><TD>4177,122</TD><TD>4200,000</TD><TD>153</TD></TR>
<TR><TD></TD><TD></TD><TD></TD><TD>-------</TD><TD></TD><TD>--------</TD></TR>
<TR><TD></TD><TD></TD><TD></TD><TD>3.948,606</TD><TD></TD><TD>787</TD></TR>
<TR><TD><BR>VAQUILLONAS EyB M.270/390</TD><TD>2450,000</TD><TD>5000,000</TD><TD>4228,484</TD><TD>4200,000</TD><TD>500</TD></TR>
<TR><TD></TD><TD></TD><TD></TD><TD>-------</TD><TD></TD><TD>--------</TD></TR>
<TR><TD></TD><TD></TD><TD></TD><TD>3.944,454</TD><TD></TD><TD>912</TD></TR>
<TR><TD><BR>TOROS Buenos</TD><TD>3300,000</TD><TD>4000,000</TD><TD>3460,177</TD><TD>3400,000</TD><TD>221</TD></TR>
<TR><TD></TD><TD></TD><TD></TD><TD>-------</TD><TD></TD><TD>--------</TD></TR>
<TR><TD></TD><TD></TD><TD></TD><TD>3.311,055</TD><TD></TD><TD>314</TD></TR>
<TR><TD><B>&nbsp;&nbsp;Totales</B></TD><TD></TD><TD></TD><TD><B>3.476,286</B></TD><TD></TD><TD><B>4.695</B></TD></TR>
</Table>`;

const HTML_MOCK_INICIO = `
<li class="ticker__item">INMAG 3.949,32 </li>
<li class="ticker__item">IGMAG 3.476,63 </li>
<li class="ticker__item">Indice Arrend. 3.981,76 </li>
<div class="home-subtitle"> 20/11/2026 </div>`;

describe("CotizacionService", () => {
  beforeEach(() => {
    CotizacionService.limpiarCache();
  });

  it("parsea correctamente la tabla HTML de precios del MAG", () => {
    const res = CotizacionService.parsearTablaPreciosMAG(HTML_MOCK_PRECIOS);
    assert.equal(res.categorias.NOVILLOS.precioPromedioKg, 3949);
    assert.equal(res.categorias.NOVILLOS.minimoKg, 3100);
    assert.equal(res.categorias.NOVILLOS.maximoKg, 4500);
    assert.equal(res.categorias.NOVILLOS.cabezas, 787);
    assert.equal(res.categorias.VAQUILLONAS.precioPromedioKg, 3944);
    assert.equal(res.categorias.TOROS.precioPromedioKg, 3311);
    assert.equal(Math.round(res.promedioGeneral), 3476);
  });

  it("parsea correctamente INMAG, IGMAG y fecha de inicio.dll", () => {
    const idx = CotizacionService.parsearIndicesInicioMAG(HTML_MOCK_INICIO);
    assert.equal(idx.inmag, 3949.32);
    assert.equal(idx.igmag, 3476.63);
    assert.equal(idx.indiceArrendamiento, 3981.76);
    assert.equal(idx.fechaRueda, "20/11/2026");
  });

  it("resuelve precios por categoría de rodeo (Novillos, Vaquillas, Terneras, Toros)", () => {
    const cotMock = {
      indices: { inmag: 3949.32 },
      categorias: {
        NOVILLOS: { categoria: "Novillos", precioPromedioKg: 3949 },
        VAQUILLONAS: { categoria: "Vaquillonas", precioPromedioKg: 3944 },
        TOROS: { categoria: "Toros", precioPromedioKg: 3311 },
        TERNEROS_CORRIENTES: { categoria: "Terneros (Corrientes est.)", precioPromedioKg: 3475 },
      },
    };

    assert.equal(CotizacionService.obtenerPrecioPorCategoria("Novillos", cotMock).precioKgVivo, 3949);
    assert.equal(CotizacionService.obtenerPrecioPorCategoria("Vaquilla", cotMock).precioKgVivo, 3944);
    assert.equal(CotizacionService.obtenerPrecioPorCategoria("Terneras", cotMock).precioKgVivo, 3475);
    assert.equal(CotizacionService.obtenerPrecioPorCategoria("Toros", cotMock).precioKgVivo, 3311);
  });
});
