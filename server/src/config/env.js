/**
 * Configuración centralizada de secretos y entorno para el backend Node.js.
 * En producción (NODE_ENV=production) exige JWT_SECRET explícito.
 */
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const JWT_SECRET =
  process.env.JWT_SECRET ||
  (IS_PRODUCTION ? "" : "vakera_super_secret_jwt_key_2026");

if (IS_PRODUCTION && !JWT_SECRET) {
  throw new Error(
    "[Config] JWT_SECRET es obligatorio en producción. Configúralo en las variables de entorno."
  );
}

module.exports = {
  IS_PRODUCTION,
  JWT_SECRET,
  INTERNAL_WS_SECRET: process.env.INTERNAL_WS_SECRET || JWT_SECRET,
};
