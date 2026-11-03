/**
 * Helper de seguridad para verificar recursivamente que un objeto o respuesta
 * no exponga campos sensibles ni secretos en ningún nivel (I3, R1, R6).
 */
const assert = require("node:assert/strict");

const CLAVES_PROHIBIDAS_DEFECTO = [
  "password",
  "tokenVerificacion",
  "tokenExpiracion",
  "tokenRecuperacion",
  "expiracionRecuperacion",
];

/**
 * Recorre recursivamente un objeto o array y detecta claves prohibidas.
 * @param {*} valor
 * @param {string[]} clavesProhibidas
 * @param {string} ruta
 * @returns {Array<{ ruta: string, clave: string, valor: * }>}
 */
function buscarClavesProhibidas(valor, clavesProhibidas = CLAVES_PROHIBIDAS_DEFECTO, ruta = "") {
  const encontradas = [];
  if (!valor || typeof valor !== "object") return encontradas;

  if (Array.isArray(valor)) {
    valor.forEach((item, index) => {
      encontradas.push(...buscarClavesProhibidas(item, clavesProhibidas, `${ruta}[${index}]`));
    });
    return encontradas;
  }

  for (const [clave, subValor] of Object.entries(valor)) {
    const rutaActual = ruta ? `${ruta}.${clave}` : clave;
    if (clavesProhibidas.includes(clave)) {
      encontradas.push({ ruta: rutaActual, clave, valor: subValor });
    }
    if (subValor && typeof subValor === "object") {
      encontradas.push(...buscarClavesProhibidas(subValor, clavesProhibidas, rutaActual));
    }
  }

  return encontradas;
}

/**
 * Aserción que falla si el objeto o cuerpo de respuesta contiene claves sensibles.
 * @param {*} objeto - Objeto, array o body de respuesta a inspeccionar.
 * @param {string[]} [clavesPersonalizadas] - Lista alternativa de claves prohibidas.
 */
function assertSinSecretos(objeto, clavesPersonalizadas = CLAVES_PROHIBIDAS_DEFECTO) {
  const encontradas = buscarClavesProhibidas(objeto, clavesPersonalizadas);
  if (encontradas.length > 0) {
    const detalle = encontradas
      .map((e) => `${e.ruta} (clave sensible: '${e.clave}')`)
      .join(", ");
    assert.fail(`Se encontraron claves sensibles en la respuesta: ${detalle}`);
  }
}

module.exports = {
  assertSinSecretos,
  buscarClavesProhibidas,
  CLAVES_PROHIBIDAS_DEFECTO,
};

