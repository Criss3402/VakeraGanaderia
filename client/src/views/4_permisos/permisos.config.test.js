import { describe, it, expect } from "vitest";
import { ROLES, PERMISOS, tienePermiso } from "./permisos.config.js";

describe("Configuración y Matriz de Permisos RBAC Frontend (permisos.config.js)", () => {
  it("contiene exactamente los 5 roles canónicos del sistema", () => {
    expect(Object.keys(ROLES)).toEqual([
      "DUENO",
      "CAPATAZ",
      "PEON",
      "OFICINA",
      "VETERINARIO",
    ]);
    expect(ROLES.DUENO).toBe("dueno");
    expect(ROLES.CAPATAZ).toBe("capataz");
    expect(ROLES.PEON).toBe("peon");
    expect(ROLES.OFICINA).toBe("oficina");
    expect(ROLES.VETERINARIO).toBe("veterinario");
  });

  it("contiene exactamente los 9 permisos canónicos del frontend", () => {
    const listaPermisos = Object.keys(PERMISOS);
    expect(listaPermisos).toHaveLength(9);
    expect(listaPermisos).toEqual(
      expect.arrayContaining([
        "VER_DASHBOARD_EJECUTIVO",
        "GESTION_USUARIOS_ROLES",
        "VER_SANIDAD_VACUNAS",
        "EDITAR_SANIDAD_VACUNAS",
        "VER_INVENTARIO_INSUMOS",
        "ORDENAR_REPOSICION",
        "VER_PARTES_DIARIOS",
        "CREAR_PARTE_DIARIO",
        "APROBAR_PARTE_DIARIO",
      ])
    );
  });

  describe("Matriz exhaustiva tienePermiso (5 roles x 9 permisos)", () => {
    const matrizEsperada = {
      [ROLES.DUENO]: {
        VER_DASHBOARD_EJECUTIVO: true,
        GESTION_USUARIOS_ROLES: true,
        VER_SANIDAD_VACUNAS: true,
        EDITAR_SANIDAD_VACUNAS: true,
        VER_INVENTARIO_INSUMOS: true,
        ORDENAR_REPOSICION: true,
        VER_PARTES_DIARIOS: true,
        CREAR_PARTE_DIARIO: true,
        APROBAR_PARTE_DIARIO: true,
      },
      [ROLES.CAPATAZ]: {
        VER_DASHBOARD_EJECUTIVO: false,
        GESTION_USUARIOS_ROLES: false,
        VER_SANIDAD_VACUNAS: true,
        EDITAR_SANIDAD_VACUNAS: false,
        VER_INVENTARIO_INSUMOS: true,
        ORDENAR_REPOSICION: false,
        VER_PARTES_DIARIOS: true,
        CREAR_PARTE_DIARIO: true,
        APROBAR_PARTE_DIARIO: true,
      },
      [ROLES.PEON]: {
        VER_DASHBOARD_EJECUTIVO: false,
        GESTION_USUARIOS_ROLES: false,
        VER_SANIDAD_VACUNAS: false,
        EDITAR_SANIDAD_VACUNAS: false,
        VER_INVENTARIO_INSUMOS: false,
        ORDENAR_REPOSICION: false,
        VER_PARTES_DIARIOS: true,
        CREAR_PARTE_DIARIO: true,
        APROBAR_PARTE_DIARIO: false,
      },
      [ROLES.OFICINA]: {
        VER_DASHBOARD_EJECUTIVO: true,
        GESTION_USUARIOS_ROLES: false,
        VER_SANIDAD_VACUNAS: true,
        EDITAR_SANIDAD_VACUNAS: false,
        VER_INVENTARIO_INSUMOS: true,
        ORDENAR_REPOSICION: true,
        VER_PARTES_DIARIOS: true,
        CREAR_PARTE_DIARIO: false,
        APROBAR_PARTE_DIARIO: false,
      },
      [ROLES.VETERINARIO]: {
        VER_DASHBOARD_EJECUTIVO: false,
        GESTION_USUARIOS_ROLES: false,
        VER_SANIDAD_VACUNAS: true,
        EDITAR_SANIDAD_VACUNAS: true,
        VER_INVENTARIO_INSUMOS: true,
        ORDENAR_REPOSICION: false,
        VER_PARTES_DIARIOS: true,
        CREAR_PARTE_DIARIO: false,
        APROBAR_PARTE_DIARIO: false,
      },
    };

    Object.entries(matrizEsperada).forEach(([rol, permisos]) => {
      describe(`Rol '${rol}'`, () => {
        Object.entries(permisos).forEach(([permiso, esperado]) => {
          it(`${esperado ? "concede" : "deniega"} '${permiso}'`, () => {
            expect(tienePermiso(rol, permiso)).toBe(esperado);
          });
        });
      });
    });
  });

  describe("Casos de borde y entradas anómalas en tienePermiso", () => {
    it("retorna false si el rol es null", () => {
      expect(tienePermiso(null, "VER_PARTES_DIARIOS")).toBe(false);
    });

    it("retorna false si el rol es undefined o vacío", () => {
      expect(tienePermiso(undefined, "VER_PARTES_DIARIOS")).toBe(false);
      expect(tienePermiso("", "VER_PARTES_DIARIOS")).toBe(false);
    });

    it("retorna false si el permiso no existe en la matriz", () => {
      expect(tienePermiso("dueno", "PERMISO_FANTASMA")).toBe(false);
      expect(tienePermiso("dueno", "")).toBe(false);
      expect(tienePermiso("dueno", null)).toBe(false);
    });

    it("retorna false ante un rol desconocido", () => {
      expect(tienePermiso("hacker", "VER_PARTES_DIARIOS")).toBe(false);
      expect(tienePermiso("admin", "GESTION_USUARIOS_ROLES")).toBe(false);
    });
  });
});

