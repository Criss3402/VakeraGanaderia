const express = require("express");
const DashboardController = require("../controllers/dashboard.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const rbacMiddleware = require("../middlewares/rbac.middleware");
const { ROLES } = require("../utils/roles.constants");

const router = express.Router();

// Todas las rutas del dashboard requieren autenticación
router.use(authMiddleware);

// Métricas generales y KPIs
router.get("/metricas", DashboardController.obtenerMetricas);

// Alertas sanitarias y vacunaciones
router.get("/alertas", DashboardController.obtenerAlertas);

// Insumos críticos y alertas de stock
router.get("/insumos-criticos", DashboardController.obtenerInsumosCriticos);

// Partes diarios de novedades
router.get("/partes", DashboardController.obtenerPartes);

// Carga de partes diarios (Peón, Capataz, Dueño)
router.post(
  "/partes",
  rbacMiddleware(ROLES.PEON, ROLES.CAPATAZ, ROLES.DUENO),
  DashboardController.registrarParteDiario
);

// Aprobación de partes diarios (Capataz, Dueño)
router.patch(
  "/partes/:id/estado",
  rbacMiddleware(ROLES.CAPATAZ, ROLES.DUENO),
  DashboardController.actualizarEstadoParte
);

module.exports = router;
