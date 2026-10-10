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

// 2. Condiciones climáticas (Google Weather API / Contingencia)
router.get("/clima", DashboardController.obtenerClima);

// 3. Módulo de Ganado y Potreros
router.get("/ganado", DashboardController.obtenerGanado);
router.get("/ganado/:id", DashboardController.obtenerFichaAnimal);
router.get("/potreros", DashboardController.obtenerPotreros);
router.post(
  "/potreros",
  rbacMiddleware(ROLES.DUENO, ROLES.CAPATAZ),
  DashboardController.registrarPotrero
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

// 5. Módulo de Insumos y Stock
router.get("/insumos", DashboardController.obtenerInsumosCriticos);
router.get("/insumos-criticos", DashboardController.obtenerInsumosCriticos);
router.post(
  "/insumos",
  rbacMiddleware(ROLES.DUENO, ROLES.OFICINA),
  DashboardController.registrarInsumo
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

// 7. Reportes y Balances (Dueño y Oficina, Capataz y Veterinario en lectura)
router.get(
  "/reportes",
  rbacMiddleware(ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ, ROLES.VETERINARIO),
  DashboardController.obtenerReportes
);

module.exports = router;
