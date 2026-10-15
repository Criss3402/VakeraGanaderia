const path = require("path");
const fs = require("fs");

// Cargar variables de entorno si aún no están cargadas
if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  const envPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../../../.env"),
  ];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      try {
        process.loadEnvFile(p);
        break;
      } catch (_) {}
    }
  }
}

const { PrismaClient } = require("@prisma/client");

// Instancia singleton de Prisma Client para evitar múltiples conexiones en desarrollo
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

module.exports = prisma;
