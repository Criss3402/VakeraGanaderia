const express = require("express");
const servicios = require("../data/servicios");

const router = express.Router();

// GET /api/servicios -> lista completa de servicios
router.get("/", (req, res) => {
  res.json(servicios);
});

// GET /api/servicios/:id -> un servicio puntual
router.get("/:id", (req, res) => {
  const servicio = servicios.find((s) => s.id === req.params.id);
  if (!servicio) {
    return res.status(404).json({ error: "Servicio no encontrado" });
  }
  res.json(servicio);
});

module.exports = router;
