const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const LecheService = require("../../src/services/leche.service");

const HTML_OCLA_MOCK = `
<li><a href="javascript:;">SIGLeA (oct/2026):</a></li>
<li>
  <a href="javascript:;">
    <i class="bold">$</i>
    <span class="badge badge-primary"> 550,25 </span>
    <i class="bold">/litro</i>
  </a>
</li>
<li>
  <a href="javascript:;">
    <i class="bold">$</i>
    <span class="badge badge-primary"> 7.550,57 </span>
    <i class="bold">/kg SU</i>
  </a>
</li>
<p>Precio de la LPE (USD/ton): 4.081 (+2,7%)</p>
`;

describe("LecheService", () => {
  beforeEach(() => {
    LecheService.limpiarCache();
  });

  it("parsea correctamente SIGLeA periodo, $/litro, $/kg SU y LPE de OCLA", () => {
    const parsed = LecheService.parsearHtmlOcla(HTML_OCLA_MOCK);
    assert.equal(parsed.periodo, "oct/2026");
    assert.equal(parsed.precioLitro, 550.25);
    assert.equal(parsed.precioKgSu, 7550.57);
    assert.equal(parsed.lpeUsdTon, 4081);
  });
});
