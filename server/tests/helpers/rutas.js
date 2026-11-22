/**
 * Helper de inspección de rutas y definición de matriz RBAC.
 * Provee herramientas para recorrer la pila de routers de Express (app._router.stack),
 * verificar completitud del catálogo de endpoints y validar permisos por rol.
 */

const { ROLES } = require("../../src/utils/roles.constants");
const prisma = require("../../src/config/prisma");

// Asegurar que todas las llamadas de Prisma fallen inmediatamente en tests
// para forzar el fallback en memoria sin demoras de socket TCP.
const fallarPrismaInmediato = async () => {
  throw new Error("Simulación DB desconectada para tests (fallback en memoria inmediato)");
};

const modelosPrisma = [
  "usuario",
  "potrero",
  "ganado",
  "sanidadEvento",
  "insumo",
  "parteDiario",
  "mensajeContacto",
];

for (const model of modelosPrisma) {
  if (prisma && prisma[model]) {
    for (const method of [
      "findUnique",
      "findFirst",
      "findMany",
      "create",
      "update",
      "delete",
      "deleteMany",
      "updateMany",
      "count",
      "aggregate",
      "groupBy",
    ]) {
      if (typeof prisma[model][method] === "function") {
        prisma[model][method] = fallarPrismaInmediato;
      }
    }
  }
}

const ROLES_SISTEMA = [
  ROLES.DUENO,
  ROLES.CAPATAZ,
  ROLES.OFICINA,
  ROLES.PEON,
  ROLES.VETERINARIO,
];

/**
 * Convierte la expresión regular de montaje de un router de Express en su prefijo de ruta.
 */
function regexAPrefijo(layer) {
  if (!layer || !layer.regexp) return "";
  if (layer.regexp.fast_slash) return "";
  let src = layer.regexp.source || "";
  src = src
    .replace(/^\^/, "")
    .replace(/\\\/\?\(\?=\\\/\|\$\)\/?$/, "")
    .replace(/\/\?$/, "")
    .replace(/\\\//g, "/");
  return src.startsWith("/") ? src : "/" + src;
}

/**
 * Recorre recursivamente `app._router.stack` extrayendo todos los endpoints registrados.
 * @param {import("express").Express} app
 * @returns {Array<{ metodo: string, ruta: string, modulo: string }>}
 */
function listarRutas(app) {
  const rutas = [];

  function extraerDeStack(prefix, stack) {
    if (!Array.isArray(stack)) return;

    for (const layer of stack) {
      if (layer.route && layer.route.path) {
        const fullPath = (prefix + layer.route.path).replace(/\/+/g, "/");
        const metodos = Object.keys(layer.route.methods || {});
        for (const m of metodos) {
          if (layer.route.methods[m]) {
            rutas.push({
              metodo: m.toUpperCase(),
              ruta: fullPath,
              modulo: determinarModulo(fullPath),
            });
          }
        }
      } else if (layer.name === "router" && layer.handle && layer.handle.stack) {
        const subPrefix = (prefix + regexAPrefijo(layer)).replace(/\/+/g, "/");
        extraerDeStack(subPrefix, layer.handle.stack);
      }
    }
  }

  if (app && app._router && app._router.stack) {
    extraerDeStack("", app._router.stack);
  }

  return rutas;
}

function determinarModulo(ruta) {
  if (ruta.startsWith("/api/dashboard")) return "dashboard";
  if (ruta.startsWith("/api/permisos")) return "permisos";
  if (ruta.startsWith("/api/auth")) return "auth";
  if (ruta.startsWith("/api/servicios") || ruta.startsWith("/api/contacto")) return "presentacion";
  if (ruta.startsWith("/api/health")) return "health";
  return "otro";
}

/**
 * Reemplaza parámetros en la ruta (ej: `:id` -> `id-test-123`).
 */
function resolverRuta(ruta, params = {}) {
  let res = ruta;
  const p = { id: "id-test-123", ...params };
  for (const [k, v] of Object.entries(p)) {
    res = res.replace(`:${k}`, v);
  }
  return res;
}

/**
 * Matriz esperada de control de acceso basada en roles (RBAC).
 * Define qué identidades tienen acceso permitido para cada ruta del sistema.
 */
const MATRIZ_RBAC_ESPERADA = [
  // ===================== PERMISOS (5 rutas) =====================
  {
    modulo: "permisos",
    metodo: "GET",
    ruta: "/api/permisos/roles",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "permisos",
    metodo: "GET",
    ruta: "/api/permisos/usuarios",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ, ROLES.OFICINA],
  },
  {
    modulo: "permisos",
    metodo: "PATCH",
    ruta: "/api/permisos/usuarios/:id/rol",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO],
    bodyEjemplo: { nuevoRol: ROLES.CAPATAZ },
  },
  {
    modulo: "permisos",
    metodo: "POST",
    ruta: "/api/permisos/solicitar-empleado",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO],
    bodyEjemplo: { email: "nuevo@example.test", rol: ROLES.PEON, nombre: "Nuevo" },
  },
  {
    modulo: "permisos",
    metodo: "DELETE",
    ruta: "/api/permisos/usuarios/:id/desvincular",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO],
  },

  // ===================== DASHBOARD (31 rutas) =====================
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/metricas",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/notificaciones",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/reproduccion",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/reproduccion",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ, ROLES.VETERINARIO],
    bodyEjemplo: { caravana: "AR-1001", tipo: "TACTO", resultado: "PRENADA" },
  },
  {
    modulo: "dashboard",
    metodo: "DELETE",
    ruta: "/api/dashboard/reproduccion/:id",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ, ROLES.VETERINARIO],
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/finanzas",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ, ROLES.VETERINARIO],
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/finanzas/costos",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.OFICINA],
    bodyEjemplo: { rubro: "Sanidad", montoUsd: 100, descripcion: "Vacunas" },
  },
  {
    modulo: "dashboard",
    metodo: "DELETE",
    ruta: "/api/dashboard/finanzas/costos/:id",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.OFICINA],
  },
  {
    modulo: "dashboard",
    metodo: "PUT",
    ruta: "/api/dashboard/finanzas/parametros",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.OFICINA],
    bodyEjemplo: { reposicionHembrasPct: 20 },
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/clima",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/cotizaciones",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/dolar",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/leche",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "PUT",
    ruta: "/api/dashboard/leche/configuracion",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
    bodyEjemplo: { modoEntrada: "vacas", vacasOrdenie: 10 },
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/leche/ordenes",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/leche/ordenes",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
    bodyEjemplo: { litros: 100, fecha: "2026-11-21" },
  },
  {
    modulo: "dashboard",
    metodo: "DELETE",
    ruta: "/api/dashboard/leche/ordenes/:id",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/potreros/permisos",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ],
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/potreros/permisos/solicitar",
    requiereAuth: true,
    rolesPermitidos: [ROLES.OFICINA],
    bodyEjemplo: { accion: "AGREGAR", motivo: "Test" },
  },
  {
    modulo: "dashboard",
    metodo: "PATCH",
    ruta: "/api/dashboard/potreros/permisos/:solicitudId",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO],
    bodyEjemplo: { estado: "APROBADA" },
  },
  {
    modulo: "dashboard",
    metodo: "PATCH",
    ruta: "/api/dashboard/potreros/:id",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ],
    bodyEjemplo: { nombre: "Potrero Editado" },
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/sanidad/eliminar-masivo",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ, ROLES.VETERINARIO],
    bodyEjemplo: { ids: ["san-1"] },
  },
  {
    modulo: "dashboard",
    metodo: "DELETE",
    ruta: "/api/dashboard/sanidad/:id",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ, ROLES.VETERINARIO],
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/insumos/solicitudes/eliminar-masivo",
    requiereAuth: true,
    rolesPermitidos: [ROLES.OFICINA, ROLES.CAPATAZ, ROLES.DUENO],
    bodyEjemplo: { ids: ["sol-1"] },
  },
  {
    modulo: "dashboard",
    metodo: "DELETE",
    ruta: "/api/dashboard/insumos/solicitudes/:id",
    requiereAuth: true,
    rolesPermitidos: [ROLES.OFICINA, ROLES.CAPATAZ, ROLES.DUENO],
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/partes/eliminar-masivo",
    requiereAuth: true,
    rolesPermitidos: [ROLES.CAPATAZ, ROLES.DUENO],
    bodyEjemplo: { ids: ["pd-1"] },
  },
  {
    modulo: "dashboard",
    metodo: "DELETE",
    ruta: "/api/dashboard/partes/:id",
    requiereAuth: true,
    rolesPermitidos: [ROLES.CAPATAZ, ROLES.DUENO],
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/ganado",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/ganado/:id",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/potreros",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/potreros",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ],
    bodyEjemplo: { nombre: "Potrero Test", superficieHectareas: 25 },
  },
  {
    modulo: "dashboard",
    metodo: "DELETE",
    ruta: "/api/dashboard/potreros/:id",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ],
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/ganado",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ],
    bodyEjemplo: { caravana: "AR-9999", categoria: "Novillos", pesoKg: 400 },
  },
  {
    modulo: "dashboard",
    metodo: "PATCH",
    ruta: "/api/dashboard/ganado/:id",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ, ROLES.VETERINARIO],
    bodyEjemplo: { pesoKg: 420 },
  },
  {
    modulo: "dashboard",
    metodo: "DELETE",
    ruta: "/api/dashboard/ganado/:id",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ],
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/ganado/baja-masiva",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ],
    bodyEjemplo: { animalIds: ["gan-001"], motivo: "Venta" },
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/ganado/traslado-masivo",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ],
    bodyEjemplo: { animalIds: ["gan-001"], potreroDestinoId: "pot-1" },
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/alertas",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/sanidad",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/sanidad",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ, ROLES.VETERINARIO],
    bodyEjemplo: { evento: "Vacunacion Test", fechaProgramada: "2026-12-01" },
  },
  {
    modulo: "dashboard",
    metodo: "PATCH",
    ruta: "/api/dashboard/sanidad/:id/estado",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.CAPATAZ, ROLES.VETERINARIO],
    bodyEjemplo: { estado: "Completado" },
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/insumos",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/insumos-criticos",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/insumos",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ],
    bodyEjemplo: { nombre: "Insumo Test", stockActual: 10, stockMinimo: 5, unidad: "Litros" },
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/insumos/eliminar-masivo",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ],
    bodyEjemplo: { ids: ["ins-1"] },
  },
  {
    modulo: "dashboard",
    metodo: "PATCH",
    ruta: "/api/dashboard/insumos/locaciones",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ],
    bodyEjemplo: { nombreAnterior: "Depósito Central", nuevoNombre: "Depósito A" },
  },
  {
    modulo: "dashboard",
    metodo: "DELETE",
    ruta: "/api/dashboard/insumos/:id",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ],
  },
  {
    modulo: "dashboard",
    metodo: "PATCH",
    ruta: "/api/dashboard/insumos/:id/stock",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ],
    bodyEjemplo: { cantidad: 5, operacion: "sumar" },
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/insumos/solicitudes",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/insumos/solicitudes",
    requiereAuth: true,
    rolesPermitidos: [ROLES.PEON, ROLES.CAPATAZ, ROLES.VETERINARIO, ROLES.DUENO],
    bodyEjemplo: { insumoNombre: "Alambre", cantidad: 2, unidad: "Rollos" },
  },
  {
    modulo: "dashboard",
    metodo: "PATCH",
    ruta: "/api/dashboard/insumos/solicitudes/:id/estado",
    requiereAuth: true,
    rolesPermitidos: [ROLES.OFICINA, ROLES.CAPATAZ, ROLES.DUENO],
    bodyEjemplo: { estado: "Aprobado" },
  },
  {
    modulo: "dashboard",
    metodo: "PATCH",
    ruta: "/api/dashboard/insumos/:id/conteo",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
    bodyEjemplo: { stockContado: 12 },
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/partes",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
  {
    modulo: "dashboard",
    metodo: "POST",
    ruta: "/api/dashboard/partes",
    requiereAuth: true,
    rolesPermitidos: [ROLES.PEON, ROLES.CAPATAZ, ROLES.DUENO],
    bodyEjemplo: { novedades: "Recorrido sin incidencias", animalesRevisados: 50 },
  },
  {
    modulo: "dashboard",
    metodo: "PATCH",
    ruta: "/api/dashboard/partes/:id/estado",
    requiereAuth: true,
    rolesPermitidos: [ROLES.CAPATAZ, ROLES.DUENO],
    bodyEjemplo: { estado: "APROBADO" },
  },
  {
    modulo: "dashboard",
    metodo: "GET",
    ruta: "/api/dashboard/reportes",
    requiereAuth: true,
    rolesPermitidos: [ROLES.DUENO, ROLES.OFICINA, ROLES.CAPATAZ, ROLES.VETERINARIO],
  },

  // ===================== AUTH (8 rutas) =====================
  {
    modulo: "auth",
    metodo: "POST",
    ruta: "/api/auth/login",
    requiereAuth: false,
    rolesPermitidos: [],
  },
  {
    modulo: "auth",
    metodo: "POST",
    ruta: "/api/auth/registro",
    requiereAuth: false,
    rolesPermitidos: [],
  },
  {
    modulo: "auth",
    metodo: "POST",
    ruta: "/api/auth/verificar-email",
    requiereAuth: false,
    rolesPermitidos: [],
  },
  {
    modulo: "auth",
    metodo: "GET",
    ruta: "/api/auth/verificar-email",
    requiereAuth: false,
    rolesPermitidos: [],
  },
  {
    modulo: "auth",
    metodo: "POST",
    ruta: "/api/auth/reenviar-verificacion",
    requiereAuth: false,
    rolesPermitidos: [],
  },
  {
    modulo: "auth",
    metodo: "POST",
    ruta: "/api/auth/solicitar-recuperacion",
    requiereAuth: false,
    rolesPermitidos: [],
  },
  {
    modulo: "auth",
    metodo: "POST",
    ruta: "/api/auth/restablecer-password",
    requiereAuth: false,
    rolesPermitidos: [],
  },
  {
    modulo: "auth",
    metodo: "GET",
    ruta: "/api/auth/google/estado",
    requiereAuth: false,
    rolesPermitidos: [],
  },
  {
    modulo: "auth",
    metodo: "GET",
    ruta: "/api/auth/google",
    requiereAuth: false,
    rolesPermitidos: [],
  },
  {
    modulo: "auth",
    metodo: "GET",
    ruta: "/api/auth/google/callback",
    requiereAuth: false,
    rolesPermitidos: [],
  },
  {
    modulo: "auth",
    metodo: "POST",
    ruta: "/api/auth/google/completar-registro",
    requiereAuth: false,
    rolesPermitidos: [],
  },
  {
    modulo: "auth",
    metodo: "GET",
    ruta: "/api/auth/me",
    requiereAuth: true,
    rolesPermitidos: ROLES_SISTEMA,
  },
];

module.exports = {
  ROLES_SISTEMA,
  listarRutas,
  determinarModulo,
  resolverRuta,
  MATRIZ_RBAC_ESPERADA,
};

