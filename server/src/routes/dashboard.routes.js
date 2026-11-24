const express = require("express");
const DashboardController = require("../controllers/dashboard.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const rbacMiddleware = require("../middlewares/rbac.middleware");
const { ROLES } = require("../utils/roles.constants");

const router = express.Router();

// Todas las rutas del dashboard requieren autenticación
router.use(authMiddleware);

// 1. Métricas generales y KPIs (Todos los roles autenticados)
router.get("/metricas", DashboardController.obtenerMetricas);
router.get("/notificaciones", DashboardController.obtenerNotificaciones);

// 2. Condiciones climáticas (Google Weather API / Contingencia)
router.get("/clima", DashboardController.obtenerClima);

// 2b. Cotizaciones ganaderas en tiempo real (MAG / Contingencia)
router.get("/cotizaciones", DashboardController.obtenerCotizaciones);

// 2c. Cotización del dólar en Argentina (DolarApi / Contingencia)
router.get("/dolar", DashboardController.obtenerDolar);

// 2d. Precio del tambo de leche al productor (OCLA / SIGLeA)
router.get("/leche", DashboardController.obtenerLeche);
router.put("/leche/configuracion", DashboardController.guardarConfiguracionTambo);
router.get("/leche/ordenes", DashboardController.listarOrdenies);
router.post("/leche/ordenes", DashboardController.registrarOrdenie);
router.delete("/leche/ordenes/:id", DashboardController.eliminarOrdenie);

// 3. Módulo de Ganado y Potreros
router.get("/ganado", DashboardController.obtenerGanado);
router.get("/ganado/:id", DashboardController.obtenerFichaAnimal);
router.get("/potreros", DashboardController.obtenerPotreros);
router.get(
  "/potreros/permisos",
  rbacMiddleware(ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ, ROLES.PEON),
  DashboardController.obtenerPermisosParcelas
);
router.post(
  "/potreros/permisos/solicitar",
  rbacMiddleware(ROLES.OFICINA, ROLES.CAPATAZ, ROLES.PEON),
  DashboardController.solicitarPermisoParcelas
);
router.patch(
  "/potreros/permisos/:solicitudId",
  rbacMiddleware(ROLES.DUENO, ROLES.OFICINA),
  DashboardController.responderPermisoParcelas
);
router.post(
  "/potreros",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ, ROLES.OFICINA, ROLES.PEON),
  DashboardController.registrarPotrero
);
router.patch(
  "/potreros/:id",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ, ROLES.OFICINA, ROLES.PEON),
  DashboardController.actualizarPotrero
);
router.delete(
  "/potreros/:id",
  rbacMiddleware(ROLES.DUENO),
  DashboardController.eliminarPotrero
);
router.post(
  "/ganado",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ),
  DashboardController.registrarGanado
);
router.patch(
  "/ganado/:id",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ, ROLES.VETERINARIO),
  DashboardController.actualizarGanado
);
router.delete(
  "/ganado/:id",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ),
  DashboardController.darDeBajaAnimal
);
router.post(
  "/ganado/baja-masiva",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ),
  DashboardController.darDeBajaMasivoGanado
);
router.post(
  "/ganado/traslado-masivo",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ),
  DashboardController.trasladoMasivoGanado
);

// 4. Módulo Sanitario y Vacunaciones
router.get("/alertas", DashboardController.obtenerAlertas);
router.get("/sanidad", DashboardController.obtenerAlertas);
router.post(
  "/sanidad",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ, ROLES.VETERINARIO),
  DashboardController.registrarEventoSanitario
);
router.patch(
  "/sanidad/:id/estado",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ, ROLES.VETERINARIO),
  DashboardController.actualizarEstadoSanitario
);
router.post(
  "/sanidad/eliminar-masivo",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ, ROLES.VETERINARIO),
  DashboardController.eliminarEventosSanitariosMasivo
);
router.delete(
  "/sanidad/:id",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ, ROLES.VETERINARIO),
  DashboardController.eliminarEventoSanitario
);

// 5. Módulo de Insumos y Stock
router.get("/insumos", DashboardController.obtenerInsumosCriticos);
router.get("/insumos-criticos", DashboardController.obtenerInsumosCriticos);
router.post(
  "/insumos",
  rbacMiddleware(ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ),
  DashboardController.registrarInsumo
);
router.post(
  "/insumos/eliminar-masivo",
  rbacMiddleware(ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ),
  DashboardController.eliminarInsumosMasivo
);
router.patch(
  "/insumos/locaciones",
  rbacMiddleware(ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ),
  DashboardController.gestionarLocacionInsumos
);
router.delete(
  "/insumos/:id",
  rbacMiddleware(ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ),
  DashboardController.eliminarInsumo
);
router.patch(
  "/insumos/:id/stock",
  rbacMiddleware(ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ),
  DashboardController.actualizarStockInsumo
);

// Solicitudes de Insumos (Peón, Capataz y Veterinario solicitan; Oficina, Capataz y Dueño aprueban/entregan)
router.get("/insumos/solicitudes", DashboardController.obtenerSolicitudesInsumos);
router.post(
  "/insumos/solicitudes",
  rbacMiddleware(ROLES.PEON, ROLES.CAPATAZ, ROLES.VETERINARIO, ROLES.DUENO),
  DashboardController.crearSolicitudInsumo
);
router.patch(
  "/insumos/solicitudes/:id/estado",
  rbacMiddleware(ROLES.OFICINA, ROLES.CAPATAZ, ROLES.DUENO),
  DashboardController.actualizarEstadoSolicitudInsumo
);
router.post(
  "/insumos/solicitudes/eliminar-masivo",
  rbacMiddleware(ROLES.OFICINA, ROLES.CAPATAZ, ROLES.DUENO),
  DashboardController.eliminarSolicitudesInsumoMasivo
);
router.delete(
  "/insumos/solicitudes/:id",
  rbacMiddleware(ROLES.OFICINA, ROLES.CAPATAZ, ROLES.DUENO),
  DashboardController.eliminarSolicitudInsumo
);

// Conteo físico de pertenencias y herramientas asignadas
router.patch(
  "/insumos/:id/conteo",
  rbacMiddleware(ROLES.PEON, ROLES.CAPATAZ, ROLES.VETERINARIO, ROLES.OFICINA, ROLES.DUENO),
  DashboardController.conteoPertenencias
);

// 6. Partes diarios de novedades de campo
router.get("/partes", DashboardController.obtenerPartes);
router.post(
  "/partes",
  rbacMiddleware(ROLES.PEON, ROLES.CAPATAZ, ROLES.DUENO),
  DashboardController.registrarParteDiario
);
router.patch(
  "/partes/:id/estado",
  rbacMiddleware(ROLES.CAPATAZ, ROLES.DUENO),
  DashboardController.actualizarEstadoParte
);
router.post(
  "/partes/eliminar-masivo",
  rbacMiddleware(ROLES.CAPATAZ, ROLES.DUENO),
  DashboardController.eliminarPartesDiariosMasivo
);
router.delete(
  "/partes/:id",
  rbacMiddleware(ROLES.CAPATAZ, ROLES.DUENO),
  DashboardController.eliminarParteDiario
);

// 7. Reportes y Balances (Solo Dueño y Oficina)
router.get(
  "/reportes",
  rbacMiddleware(ROLES.DUENO, ROLES.OFICINA),
  DashboardController.obtenerReportes
);

// 8. Reproducción y Preñez (Sub-módulo de Ganado)
router.get("/reproduccion", DashboardController.obtenerReproduccion);
router.post(
  "/reproduccion",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ, ROLES.VETERINARIO),
  DashboardController.registrarReproduccion
);
router.delete(
  "/reproduccion/:id",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ, ROLES.VETERINARIO),
  DashboardController.eliminarReproduccion
);

// 9. Costos y Finanzas (Solo Dueño y Oficina)
router.get(
  "/finanzas",
  rbacMiddleware(ROLES.DUENO, ROLES.OFICINA),
  DashboardController.obtenerFinanzas
);
router.post(
  "/finanzas/costos",
  rbacMiddleware(ROLES.DUENO, ROLES.OFICINA),
  DashboardController.registrarCostoFinanzas
);
router.delete(
  "/finanzas/costos/:id",
  rbacMiddleware(ROLES.DUENO, ROLES.OFICINA),
  DashboardController.eliminarCostoFinanzas
);
router.put(
  "/finanzas/parametros",
  rbacMiddleware(ROLES.DUENO, ROLES.OFICINA),
  DashboardController.guardarParametrosFinanzas
);

module.exports = router;
