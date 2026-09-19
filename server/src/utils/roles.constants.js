/**
 * Constantes de Roles del Sistema Vakera (RBAC)
 */
const ROLES = {
  DUENO: "dueno",
  CAPATAZ: "capataz",
  PEON: "peon",
  OFICINA: "oficina",
  VETERINARIO: "veterinario",
};

const ROLES_LIST = Object.values(ROLES);

const ROLES_INFO = {
  [ROLES.DUENO]: {
    id: ROLES.DUENO,
    nombre: "Dueño / Dirección",
    descripcion: "Visión global, auditoría de módulos, trazabilidad y aprobación presupuestaria.",
    nivel: 1,
  },
  [ROLES.CAPATAZ]: {
    id: ROLES.CAPATAZ,
    nombre: "Capataz (Supervisor)",
    descripcion: "Revisión y aprobación de partes diarios, asignación de tareas y control de campo.",
    nivel: 2,
  },
  [ROLES.PEON]: {
    id: ROLES.PEON,
    nombre: "Peón (Operario)",
    descripcion: "Carga de novedades diarias en el campo, consultas y solicitudes de insumos.",
    nivel: 3,
  },
  [ROLES.OFICINA]: {
    id: ROLES.OFICINA,
    nombre: "Oficina (Administración)",
    descripcion: "Gestión de compras, control documental sanitario y facturación de insumos.",
    nivel: 2,
  },
  [ROLES.VETERINARIO]: {
    id: ROLES.VETERINARIO,
    nombre: "Médico Veterinario",
    descripcion: "Calendario de vacunación, tratamientos aplicados, alertas y recetas médicas.",
    nivel: 2,
  },
};

module.exports = {
  ROLES,
  ROLES_LIST,
  ROLES_INFO,
};
