const { PrismaClient } = require("@prisma/client");

// Instancia singleton de Prisma Client para evitar múltiples conexiones en desarrollo
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

module.exports = prisma;
