const express = require("express");
const cors = require("cors");

const path = require("path");
const fs = require("fs");

// Carga nativa de archivos .env (Node.js 20.6+)
if (typeof process.loadEnvFile === "function") {
  const envPaths = [
    path.resolve(__dirname, "../../.env"), // Root .env
    path.resolve(__dirname, "../.env"),    // server/.env
    path.resolve(process.cwd(), ".env"),
  ];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      try {
        process.loadEnvFile(p);
      } catch (_) {}
    }
  }
}

// Enrutadores modulares por cada parte del sistema
const presentacionRoutes = require("./routes/presentacion.routes");
const authRoutes = require("./routes/auth.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const permisosRoutes = require("./routes/permisos.routes");

const app = express();
const PORT = process.env.PORT || 4000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// --- CORS: restringir orígenes en producción ---
const origenesPermitidos = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:5174", "http://localhost:4000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origin (ej: Postman, curl, SSR) y orígenes conocidos
      if (!origin || origenesPermitidos.includes(origin)) {
        callback(null, true);
      } else if (!IS_PRODUCTION) {
        // En desarrollo, permitir cualquier origen con una advertencia
        callback(null, true);
      } else {
        callback(new Error(`Origen no permitido por política CORS: ${origin}`));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

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

// Manejador global de errores — no expone detalles internos en producción
app.use((err, req, res, next) => {
  console.error("Error no controlado:", err);
  res.status(err.status || 500).json({
    ok: false,
    error: IS_PRODUCTION ? "Error interno del servidor." : (err.message || "Error interno del servidor"),
    ...(IS_PRODUCTION ? {} : { detalle: err.stack }),
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
