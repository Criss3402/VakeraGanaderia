/**
 * Reinicio del estado global en memoria (src/config/db.js) entre tests.
 * Evita que un test contamine a otro a través del fallback (trampa F3 del plan).
 *
 * Uso:
 *   const { resetearMemoria } = require("../helpers/memoria");
 *   beforeEach(() => resetearMemoria());
 */
const db = require("../../src/config/db");

// Copia profunda tomada al cargar el módulo, antes de que ningún test lo mute.
const SNAPSHOT_INICIAL = structuredClone(db);

function resetearMemoria() {
  for (const clave of Object.keys(db)) {
    if (!(clave in SNAPSHOT_INICIAL)) delete db[clave];
  }
  for (const [clave, valor] of Object.entries(SNAPSHOT_INICIAL)) {
    db[clave] = structuredClone(valor);
  }
}

module.exports = { resetearMemoria };

