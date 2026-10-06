const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

const SALT_ROUNDS = 10;
const PASSWORD_DEMO = "password123";

async function main() {
  console.log("Iniciando carga de semillas (Seed) para Vakera Ganadería...");

  // Hashear contraseña de demostración una sola vez
  const passwordHasheada = await bcrypt.hash(PASSWORD_DEMO, SALT_ROUNDS);
  console.log("- Contraseñas hasheadas con bcrypt.");

  // 1. Limpieza ordenada de tablas existentes (respetando claves foráneas)
  await prisma.mensajeContacto.deleteMany();
  await prisma.parteDiario.deleteMany();
  await prisma.sanidadEvento.deleteMany();
  await prisma.ganado.deleteMany();
  await prisma.insumo.deleteMany();
  await prisma.potrero.deleteMany();
  await prisma.usuario.deleteMany();

  console.log("- Tablas limpiadas con éxito.");

  // 2. Usuarios con roles RBAC (contraseñas hasheadas)
  const usuariosSeed = [
    {
      id: "usr-1",
      nombre: "Cristian Joaquín",
      email: "dueno@vakera.com",
      password: passwordHasheada,
      rol: "DUENO",
      cargo: "Propietario / Director",
      telefono: "+54 9 11 4567-8901",
      establecimiento: "El Rancho, Goya, Corrientes",
    },
    {
      id: "usr-2",
      nombre: "Martín Benítez",
      email: "capataz@vakera.com",
      password: passwordHasheada,
      rol: "CAPATAZ",
      cargo: "Capataz General",
      telefono: "+54 9 11 5678-1234",
      establecimiento: "El Rancho, Goya, Corrientes",
    },
    {
      id: "usr-3",
      nombre: "Lucas Giménez",
      email: "peon@vakera.com",
      password: passwordHasheada,
      rol: "PEON",
      cargo: "Peón de Campo",
      telefono: "+54 9 11 6789-2345",
      establecimiento: "El Rancho, Goya, Corrientes",
    },
    {
      id: "usr-4",
      nombre: "Valeria Rossi",
      email: "oficina@vakera.com",
      password: passwordHasheada,
      rol: "OFICINA",
      cargo: "Administración y Compras",
      telefono: "+54 9 11 7890-3456",
      establecimiento: "El Rancho, Goya, Corrientes",
    },
    {
      id: "usr-5",
      nombre: "Dra. Sofía Navarro",
      email: "veterinario@vakera.com",
      password: passwordHasheada,
      rol: "VETERINARIO",
      cargo: "Médica Veterinaria (Mat. 4892)",
      telefono: "+54 9 11 8901-4567",
      establecimiento: "El Rancho, Goya, Corrientes",
    },
  ];

  for (const u of usuariosSeed) {
    await prisma.usuario.create({ data: u });
  }
  console.log(`- ${usuariosSeed.length} usuarios creados (contraseña demo: "${PASSWORD_DEMO}").`);

  // 3. Potreros
  const potrerosSeed = [
    { id: "pot-1", nombre: "Potrero 1 - Los Eucaliptos", superficieHas: 120, capacidad: 150 },
    { id: "pot-2", nombre: "Potrero 2 - La Loma", superficieHas: 95, capacidad: 110 },
    { id: "pot-3", nombre: "Potrero 3 - El Trébol", superficieHas: 140, capacidad: 180 },
    { id: "pot-4", nombre: "Potrero 4 - Bajo Hondo", superficieHas: 80, capacidad: 90 },
    { id: "pot-5", nombre: "Potrero 5 - La Aguada", superficieHas: 160, capacidad: 200 },
  ];

  for (const p of potrerosSeed) {
    await prisma.potrero.create({ data: p });
  }
  console.log(`- ${potrerosSeed.length} potreros creados.`);

  // 4. Ganado
  const ganadoSeed = [
    {
      id: "gan-001",
      caravana: "AR-84920",
      categoria: "Vacas",
      raza: "Angus Negro",
      sexo: "Hembra",
      pesoKg: 460,
      potreroId: "pot-3",
      estadoSanitario: "SALUDABLE",
      fechaNacimiento: new Date("2022-09-14"),
    },
    {
      id: "gan-002",
      caravana: "AR-84921",
      categoria: "Toros",
      raza: "Hereford",
      sexo: "Macho",
      pesoKg: 780,
      potreroId: "pot-1",
      estadoSanitario: "SALUDABLE",
      fechaNacimiento: new Date("2021-04-20"),
    },
    {
      id: "gan-003",
      caravana: "AR-84922",
      categoria: "Novillos",
      raza: "Angus Colorado",
      sexo: "Macho",
      pesoKg: 390,
      potreroId: "pot-5",
      estadoSanitario: "EN_TRATAMIENTO",
      fechaNacimiento: new Date("2023-10-05"),
    },
    {
      id: "gan-004",
      caravana: "AR-84923",
      categoria: "Terneras",
      raza: "Braford",
      sexo: "Hembra",
      pesoKg: 145,
      potreroId: "pot-2",
      estadoSanitario: "SALUDABLE",
      fechaNacimiento: new Date("2024-03-12"),
    },
    {
      id: "gan-005",
      caravana: "AR-84924",
      categoria: "Vaquillonas",
      raza: "Angus Negro",
      sexo: "Hembra",
      pesoKg: 320,
      potreroId: "pot-4",
      estadoSanitario: "OBSERVACION",
      fechaNacimiento: new Date("2023-08-18"),
    },
  ];

  for (const g of ganadoSeed) {
    await prisma.ganado.create({ data: g });
  }
  console.log(`- ${ganadoSeed.length} cabezas de ganado registradas.`);

  // 5. Insumos y Medicamentos
  const insumosSeed = [
    {
      id: "ins-1",
      nombre: "Vacuna Antiaftosa Bivalente",
      categoria: "Fármaco",
      stockActual: 18,
      stockMinimo: 50,
      unidad: "Dosis",
      ubicacion: "Heladera Veterinaria",
      estado: "Bajo Stock",
      requiereReposicion: true,
      icono: "fa-prescription-bottle-medical",
    },
    {
      id: "ins-2",
      nombre: "Ivermectina Inyectable 500ml",
      categoria: "Fármaco",
      stockActual: 3,
      stockMinimo: 5,
      unidad: "Frascos",
      ubicacion: "Depósito Sanitario",
      estado: "Bajo Stock",
      requiereReposicion: true,
      icono: "fa-syringe",
    },
    {
      id: "ins-3",
      nombre: "Complejo Vitamínico",
      categoria: "Nutrición",
      stockActual: 12,
      stockMinimo: 10,
      unidad: "Kg",
      ubicacion: "Galpón 1",
      estado: "OK",
      requiereReposicion: false,
      icono: "fa-box-archive",
    },
    {
      id: "ins-4",
      nombre: "Sales Minerales",
      categoria: "Nutrición",
      stockActual: 8,
      stockMinimo: 5,
      unidad: "Bolsas",
      ubicacion: "Galpón 2",
      estado: "OK",
      requiereReposicion: false,
      icono: "fa-sack-xmark",
    },
  ];

  for (const i of insumosSeed) {
    await prisma.insumo.create({ data: i });
  }
  console.log(`- ${insumosSeed.length} insumos registrados.`);

  // 6. Eventos Sanitarios
  const sanidadSeed = [
    {
      id: "san-1",
      evento: "Vacunación Antiaftosa",
      tipo: "Vacunación",
      lote: "Rodeo General",
      fechaProgramada: new Date("2026-10-15"),
      estado: "Pendiente",
      prioridad: "Alta",
      icono: "fa-syringe",
      responsableId: "usr-5", // Dra. Sofía Navarro
    },
    {
      id: "san-2",
      evento: "Control de Carbunclo",
      tipo: "Vacunación",
      lote: "Terneros destete",
      fechaProgramada: new Date("2026-09-25"),
      estado: "Próximo",
      prioridad: "Urgente",
      icono: "fa-tags",
      responsableId: "usr-5",
    },
    {
      id: "san-3",
      evento: "Tratamiento Antiparasitario",
      tipo: "Tratamiento",
      lote: "Novillos Potrero 5",
      fechaProgramada: new Date("2026-09-18"),
      estado: "Completado",
      prioridad: "Normal",
      icono: "fa-bottle-droplet",
      responsableId: "usr-2", // Martín Benítez
    },
    {
      id: "san-4",
      evento: "Revisión de alambrados",
      tipo: "Mantenimiento",
      lote: "Potrero 2 - La Loma",
      fechaProgramada: new Date("2026-10-05"),
      estado: "Programado",
      prioridad: "Normal",
      icono: "fa-clipboard-check",
      responsableId: "usr-3", // Lucas Giménez
    },
  ];

  for (const s of sanidadSeed) {
    await prisma.sanidadEvento.create({ data: s });
  }
  console.log(`- ${sanidadSeed.length} eventos sanitarios cargados.`);

  // 7. Partes Diarios
  const partesSeed = [
    {
      id: "pd-1",
      fecha: new Date("2026-09-19"),
      peonId: "usr-3", // Lucas Giménez
      potreroId: "pot-2",
      novedades:
        "Nacimiento de 2 terneros machos en buen estado. Alambrado perimetral este con hilo caído por viento.",
      animalesRevisados: 85,
      solicitudInsumos: "Se necesitan 10 metros de alambre y varillas.",
      estado: "PENDIENTE",
    },
    {
      id: "pd-2",
      fecha: new Date("2026-09-18"),
      peonId: "usr-3",
      potreroId: "pot-5",
      novedades:
        "Novillo AR-84922 apartado con renguera en pata trasera derecha. Se apartó a corralillo.",
      animalesRevisados: 120,
      solicitudInsumos: null,
      estado: "APROBADO",
      revisadoPorId: "usr-2", // Martín Benítez
      fechaRevision: new Date("2026-09-18T17:40:00Z"),
    },
  ];

  for (const pd of partesSeed) {
    await prisma.parteDiario.create({ data: pd });
  }
  console.log(`- ${partesSeed.length} partes diarios cargados.`);

  console.log("¡Carga de semillas completada exitosamente!");
  console.log(`\nCredenciales de acceso demo:`);
  console.log(`  Email: dueno@vakera.com | Contraseña: ${PASSWORD_DEMO}`);
  console.log(`  Email: capataz@vakera.com | Contraseña: ${PASSWORD_DEMO}`);
  console.log(`  Email: peon@vakera.com | Contraseña: ${PASSWORD_DEMO}`);
}

main()
  .catch((e) => {
    console.error("Error cargando semillas:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
