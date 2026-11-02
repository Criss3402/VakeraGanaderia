import { http, HttpResponse } from "msw";

/**
 * Handlers base con la forma real del backend: { ok, data?, mensaje?, error? }.
 * Cada test agrega o sobrescribe handlers con `server.use(...)`.
 */
export const handlers = [
  http.get("*/api/health", () =>
    HttpResponse.json({ status: "ok", servicio: "Vakera Ganadería API" })
  ),
];

