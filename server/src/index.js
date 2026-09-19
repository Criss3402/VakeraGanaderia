const express = require("express");
const cors = require("cors");

// Carga nativa de archivo .env si existe (Node.js 20.6+)
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch (_) {}
}

// Enrutadores modulares por cada parte del sistema
const presentacionRoutes = require("./routes/presentacion.routes");
const authRoutes = require("./routes/auth.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const permisosRoutes = require("./routes/permisos.routes");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Endpoint de verificación de salud del servidor
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    servicio: "Vakera Ganadería API",
    version: "2.0.0",
    modulos: ["presentacion", "auth", "dashboard", "permisos"],
    fecha: new Date().toISOString(),
  });
});

// [PARTE 1: INICIO / PRESENTACIÓN] -> /api/servicios, /api/contacto
app.use("/api", presentacionRoutes);

// [PARTE 2: LOGIN / REGISTRO] -> /api/auth/login, /api/auth/registro, /api/auth/me
app.use("/api/auth", authRoutes);

// [PARTE 3: DASHBOARD] -> /api/dashboard/metricas, /alertas, /insumos-criticos, /partes
app.use("/api/dashboard", dashboardRoutes);

// [PARTE 4: PERMISOS Y ROLES] -> /api/permisos/roles, /api/permisos/usuarios
app.use("/api/permisos", permisosRoutes);

// Manejo de rutas inexistentes
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error("Error no controlado:", err);
  res.status(500).json({
    ok: false,
    error: "Error interno del servidor",
    detalle: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`API de Vakera escuchando en http://localhost:${PORT}`);
  console.log(`- Módulo Presentación: http://localhost:${PORT}/api/servicios`);
  console.log(`- Módulo Auth:          http://localhost:${PORT}/api/auth/usuarios-demo`);
  console.log(`- Módulo Dashboard:     http://localhost:${PORT}/api/dashboard/metricas`);
  console.log(`- Módulo Permisos:      http://localhost:${PORT}/api/permisos/roles`);
});

module.exports = app;
