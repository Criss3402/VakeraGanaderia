import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { server } from "./msw/server.js";
import { limpiarCacheApi } from "../api/client.js";

// Cualquier request sin handler explícito falla el test (nunca sale a la red real).
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

beforeEach(() => {
  // Trampa F7 del plan: la caché de 30 s de client.js y localStorage no deben filtrarse entre tests.
  limpiarCacheApi();
  if (typeof localStorage !== "undefined" && typeof localStorage.clear === "function") {
    localStorage.clear();
  }
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

