/**
 * Helper de tokens JWT reales para tests (nunca se mockea jsonwebtoken).
 *
 * IMPORTANTE: este módulo debe requerirse ANTES que `src/index.js` o cualquier
 * middleware, porque fija el secreto de test y aísla la base de datos:
 *  - JWT_SECRET: secreto ficticio de test (si no viene del entorno).
 *  - DATABASE_URL: host inexistente, para que ningún test toque la BD de desarrollo.
 * `process.loadEnvFile` de src/index.js NO sobrescribe variables ya definidas.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "vakera_test_secret_solo_para_tests_0123456789";
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST || "postgresql://test:test@127.0.0.1:1/vakera_test_inexistente?schema=public";

const jwt = require("jsonwebtoken");
const prisma = require("../../src/config/prisma");

// En tests sin base de datos real montada, Prisma debe fallar inmediatamente
// para que los modelos ejecuten de forma instantánea el patrón de fallback en memoria
// sin incurrir en esperas de timeout de red TCP (de 2 a 4 segundos por consulta).
const fallarPrismaInmediato = async () => {
  throw new Error("Simulación DB desconectada para tests (fallback en memoria inmediato)");
};

if (prisma && prisma.usuario) {
  prisma.usuario.findUnique = fallarPrismaInmediato;
  prisma.usuario.findFirst = fallarPrismaInmediato;
  prisma.usuario.findMany = fallarPrismaInmediato;
  prisma.usuario.create = fallarPrismaInmediato;
  prisma.usuario.update = fallarPrismaInmediato;
}

/**
 * Firma un JWT con la misma forma que `generarToken` de auth.controller.js.
 * @param {object} [datos]
 * @param {string} [datos.id]
 * @param {string} [datos.email]
 * @param {string} [datos.rol]
 * @param {string} [datos.establecimientoId]
 * @param {string} [datos.establecimiento]
 * @param {string|number} [datos.expiresIn] - Ej: "1h" o -10 (ya vencido).
 * @param {string} [datos.secret] - Para simular firmas inválidas.
 */
function firmarToken({
  id = "usr-test-1",
  email = "test@example.test",
  rol = "dueno",
  establecimientoId = "est-A",
  establecimiento = "Establecimiento A",
  expiresIn = "1h",
  secret = process.env.JWT_SECRET,
} = {}) {
  return jwt.sign({ id, email, rol, establecimientoId, establecimiento }, secret, { expiresIn });
}

function encabezadoBearer(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { firmarToken, encabezadoBearer };
