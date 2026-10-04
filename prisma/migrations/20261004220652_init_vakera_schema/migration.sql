-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DUENO', 'CAPATAZ', 'PEON', 'OFICINA', 'VETERINARIO');

-- CreateEnum
CREATE TYPE "EstadoSanitario" AS ENUM ('SALUDABLE', 'OBSERVACION', 'EN_TRATAMIENTO');

-- CreateEnum
CREATE TYPE "EstadoParte" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'PEON',
    "cargo" TEXT,
    "telefono" TEXT,
    "establecimiento" TEXT DEFAULT 'El Rancho, Goya, Corrientes',
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "potreros" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "superficieHas" DOUBLE PRECISION,
    "capacidad" INTEGER,

    CONSTRAINT "potreros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ganado" (
    "id" TEXT NOT NULL,
    "caravana" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "raza" TEXT NOT NULL,
    "sexo" TEXT NOT NULL,
    "pesoKg" DOUBLE PRECISION NOT NULL,
    "estadoSanitario" "EstadoSanitario" NOT NULL DEFAULT 'SALUDABLE',
    "fechaNacimiento" TIMESTAMP(3),
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "potreroId" TEXT,

    CONSTRAINT "ganado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sanidad_eventos" (
    "id" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "lote" TEXT,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',
    "prioridad" TEXT NOT NULL DEFAULT 'Normal',
    "icono" TEXT DEFAULT 'fa-syringe',
    "notas" TEXT,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ganadoId" TEXT,
    "responsableId" TEXT,

    CONSTRAINT "sanidad_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "stockActual" DOUBLE PRECISION NOT NULL,
    "stockMinimo" DOUBLE PRECISION NOT NULL,
    "unidad" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'OK',
    "requiereReposicion" BOOLEAN NOT NULL DEFAULT false,
    "icono" TEXT DEFAULT 'fa-box-archive',
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partes_diarios" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "novedades" TEXT NOT NULL,
    "animalesRevisados" INTEGER NOT NULL DEFAULT 0,
    "solicitudInsumos" TEXT,
    "estado" "EstadoParte" NOT NULL DEFAULT 'PENDIENTE',
    "fechaCarga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaRevision" TIMESTAMP(3),
    "peonId" TEXT NOT NULL,
    "revisadoPorId" TEXT,
    "potreroId" TEXT,

    CONSTRAINT "partes_diarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes_contacto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "mensaje" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_contacto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "potreros_nombre_key" ON "potreros"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ganado_caravana_key" ON "ganado"("caravana");

-- AddForeignKey
ALTER TABLE "ganado" ADD CONSTRAINT "ganado_potreroId_fkey" FOREIGN KEY ("potreroId") REFERENCES "potreros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanidad_eventos" ADD CONSTRAINT "sanidad_eventos_ganadoId_fkey" FOREIGN KEY ("ganadoId") REFERENCES "ganado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanidad_eventos" ADD CONSTRAINT "sanidad_eventos_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partes_diarios" ADD CONSTRAINT "partes_diarios_peonId_fkey" FOREIGN KEY ("peonId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partes_diarios" ADD CONSTRAINT "partes_diarios_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partes_diarios" ADD CONSTRAINT "partes_diarios_potreroId_fkey" FOREIGN KEY ("potreroId") REFERENCES "potreros"("id") ON DELETE SET NULL ON UPDATE CASCADE;
