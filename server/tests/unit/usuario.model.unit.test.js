/**
 * Tests Unitarios — UsuarioModel (Patrón Dual Prisma con Fallback a Memoria)
 * Cubre métodos de persistencia, invariantes de seguridad (I7, R11) y no-exposición de contraseñas.
 */
const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

// Inicializa variables de test y aísla DATABASE_URL
require("../helpers/tokens");

const { resetearMemoria } = require("../helpers/memoria");
const { assertSinSecretos } = require("../helpers/assertSinSecretos");
const UsuarioModel = require("../../src/models/usuario.model");
const prisma = require("../../src/config/prisma");
const db = require("../../src/config/db");
const { ROLES } = require("../../src/utils/roles.constants");

describe("UsuarioModel — Lógica de Persistencia y Reglas de Negocio", () => {
  beforeEach(() => {
    resetearMemoria();
  });

  describe("crear()", () => {
    it("crea un nuevo usuario con password hasheada y sin exponerla en el retorno", async () => {
      const nuevo = await UsuarioModel.crear({
        nombre: "Test Operario",
        email: "operario@example.test",
        password: "password123",
        rol: ROLES.PEON,
      });

      assert.ok(nuevo.id);
      assert.equal(nuevo.email, "operario@example.test");
      assert.equal(nuevo.rol, "peon");
      assert.equal(nuevo.password, undefined);

      // Verificar que en memoria la contraseña guardada es un hash bcrypt válido
      const guardadoEnMemoria = db.usuarios.find((u) => u.id === nuevo.id);
      assert.ok(guardadoEnMemoria);
      assert.ok(guardadoEnMemoria.password);
      assert.notEqual(guardadoEnMemoria.password, "password123");
      const hashValido = await bcrypt.compare("password123", guardadoEnMemoria.password);
      assert.equal(hashValido, true);
    });

    it("normaliza el correo a minúsculas y elimina espacios circundantes", async () => {
      const nuevo = await UsuarioModel.crear({
        nombre: "Usuario Normalizado",
        email: "  NUEVO.USUARIO@EXAMPLE.TEST  ",
        password: "password123",
      });

      assert.equal(nuevo.email, "nuevo.usuario@example.test");
      const encontrado = await UsuarioModel.buscarPorEmail("nuevo.usuario@example.test");
      assert.ok(encontrado);
      assert.equal(encontrado.id, nuevo.id);
    });

    it("rechaza la creación si el correo ya se encuentra registrado", async () => {
      await assert.rejects(
        async () => {
          await UsuarioModel.crear({
            nombre: "Duplicado",
            email: "dueno@vakera.com", // Ya existe en semillas
            password: "password123",
          });
        },
        /Ya existe un usuario registrado con ese correo electrónico/
      );
    });

    it("rechaza la creación si se especifica un rol inválido", async () => {
      await assert.rejects(
        async () => {
          await UsuarioModel.crear({
            nombre: "Rol Fake",
            email: "fake@example.test",
            password: "password123",
            rol: "superadmin_inexistente",
          });
        },
        /Rol inválido/
      );
    });

    it("genera un ID de establecimiento automático si no se provee uno", async () => {
      const nuevo = await UsuarioModel.crear({
        nombre: "Nuevo Dueño",
        email: "dueno.nuevo@example.test",
        password: "password123",
        rol: ROLES.DUENO,
      });

      assert.ok(nuevo.establecimientoId);
      assert.match(nuevo.establecimientoId, /^est-/);
    });

    it("asigna el establecimientoId provisto si se especifica explícitamente", async () => {
      const nuevo = await UsuarioModel.crear({
        nombre: "Empleado Con Establecimiento",
        email: "empleado.est@example.test",
        password: "password123",
        establecimientoId: "est-el-rancho",
      });

      assert.equal(nuevo.establecimientoId, "est-el-rancho");
    });
  });

  describe("buscarPorId() y buscarPorEmail()", () => {
    it("buscarPorId retorna el usuario sin campo password", async () => {
      const usuario = await UsuarioModel.buscarPorId("usr-2");
      assert.ok(usuario);
      assert.equal(usuario.id, "usr-2");
      assert.equal(usuario.password, undefined);
    });

    it("buscarPorId no expone tokens de verificación ni recuperación en la respuesta (R6)", async () => {
      const usuario = await UsuarioModel.buscarPorId("usr-2");
      assert.ok(usuario);
      assertSinSecretos(usuario);
    });

    it("buscarPorId retorna null para IDs inexistentes o nulos", async () => {
      const noExiste = await UsuarioModel.buscarPorId("usr-inexistente-999");
      assert.equal(noExiste, null);

      const idVacio = await UsuarioModel.buscarPorId(null);
      assert.equal(idVacio, null);
    });

    it("buscarPorId aplica R11: usr-1 o dueno@vakera.com siempre tiene rol dueno", async () => {
      // Modificar en memoria el rol de usr-1 a peon
      const usr1 = db.usuarios.find((u) => u.id === "usr-1");
      usr1.rol = "peon";

      const usuario = await UsuarioModel.buscarPorId("usr-1");
      assert.equal(usuario.rol, "dueno"); // R11: forzado a dueno por código
    });

    it("buscarPorEmail busca de forma insensible a mayúsculas y espacios y no expone password", async () => {
      const usuario = await UsuarioModel.buscarPorEmail("  CAPATAZ@VAKERA.COM  ");
      assert.ok(usuario);
      assert.equal(usuario.id, "usr-2");
      assert.equal(usuario.password, undefined);
    });

    it("buscarPorEmail no expone tokens de verificación ni recuperación en la respuesta (R6)", async () => {
      const usuario = await UsuarioModel.buscarPorEmail("capataz@vakera.com");
      assert.ok(usuario);
      assertSinSecretos(usuario);
    });

    it("buscarPorEmail retorna null para correos no registrados o nulos", async () => {
      const noExiste = await UsuarioModel.buscarPorEmail("nadie@example.test");
      assert.equal(noExiste, null);

      const emailNulo = await UsuarioModel.buscarPorEmail(null);
      assert.equal(emailNulo, null);
    });
  });

  describe("buscarPorEmailConPassword()", () => {
    it("retorna el usuario con el hash de password incluido para validar login", async () => {
      const usuario = await UsuarioModel.buscarPorEmailConPassword("capataz@vakera.com");
      assert.ok(usuario);
      assert.ok(usuario.password);
      const coincide = await bcrypt.compare("password123", usuario.password);
      assert.equal(coincide, true);
    });

    it("retorna null si el correo no existe", async () => {
      const usuario = await UsuarioModel.buscarPorEmailConPassword("inexistente@example.test");
      assert.equal(usuario, null);
    });
  });

  describe("actualizarRol() — Invariantes RBAC (I7)", () => {
    it("actualiza el rol de un usuario existente a un rol permitido", async () => {
      const actualizado = await UsuarioModel.actualizarRol("usr-3", ROLES.CAPATAZ);
      assert.equal(actualizado.rol, "capataz");
      assert.equal(actualizado.password, undefined);

      const verificado = await UsuarioModel.buscarPorId("usr-3");
      assert.equal(verificado.rol, "capataz");
    });

    it("rechaza la actualización si el rol propuesto no es válido", async () => {
      await assert.rejects(
        async () => {
          await UsuarioModel.actualizarRol("usr-3", "gerente_regional");
        },
        /Rol inválido/
      );
    });

    it("I7: no permite degradar al propietario del establecimiento", async () => {
      await assert.rejects(
        async () => {
          await UsuarioModel.actualizarRol("usr-1", ROLES.PEON);
        },
        /No es posible modificar el rol del propietario/
      );
    });

    it("lanza error si el usuario a actualizar no existe", async () => {
      await assert.rejects(
        async () => {
          await UsuarioModel.actualizarRol("usr-fantasma-999", ROLES.CAPATAZ);
        },
        /Usuario no encontrado/
      );
    });
  });

  describe("vincularEstablecimiento() y desvincularEstablecimiento()", () => {
    it("vincula un usuario a un nuevo establecimiento con rol y cargo", async () => {
      const nuevo = await UsuarioModel.crear({
        nombre: "Empleado Libre",
        email: "libre@example.test",
        password: "password123",
      });

      const vinculado = await UsuarioModel.vincularEstablecimiento({
        email: "libre@example.test",
        establecimientoId: "est-el-rancho",
        establecimiento: "El Rancho, Goya, Corrientes",
        rol: ROLES.VETERINARIO,
        cargo: "Médico Veterinario",
      });

      assert.equal(vinculado.establecimientoId, "est-el-rancho");
      assert.equal(vinculado.rol, "veterinario");
      assert.equal(vinculado.cargo, "Médico Veterinario");
      assert.equal(vinculado.password, undefined);
    });

    it("rechaza la vinculación si el correo no existe en el sistema", async () => {
      await assert.rejects(
        async () => {
          await UsuarioModel.vincularEstablecimiento({
            email: "no_registrado@example.test",
            establecimientoId: "est-el-rancho",
          });
        },
        /No existe ningún usuario registrado/
      );
    });

    it("rechaza la vinculación si el usuario ya está asignado al mismo establecimiento", async () => {
      await assert.rejects(
        async () => {
          await UsuarioModel.vincularEstablecimiento({
            email: "dueno@vakera.com", // Ya está en est-el-rancho
            establecimientoId: "est-el-rancho",
          });
        },
        /ya se encuentra asignado a este establecimiento/
      );
    });

    it("desvincula un usuario existente dejando establecimientoId en null", async () => {
      const nuevo = await UsuarioModel.crear({
        nombre: "Operario Vinculado",
        email: "vinculado@example.test",
        password: "password123",
        establecimientoId: "est-el-rancho",
      });

      const desvinculado = await UsuarioModel.desvincularEstablecimiento(nuevo.id, "est-el-rancho");
      assert.equal(desvinculado.establecimientoId, null);
      assert.equal(desvinculado.cargo, "Sin asignar");
      assert.equal(desvinculado.password, undefined);
    });

    it("I7: no permite desvincular al propietario del establecimiento", async () => {
      await assert.rejects(
        async () => {
          await UsuarioModel.desvincularEstablecimiento("usr-1", "est-el-rancho");
        },
        /No es posible desvincular al propietario del establecimiento/
      );
    });
  });

  describe("Tokens de verificación y recuperación", () => {
    it("marcarEmailVerificado activa la cuenta y limpia los tokens", async () => {
      const nuevo = await UsuarioModel.crear({
        nombre: "No Verificado",
        email: "noverificado@example.test",
        password: "password123",
        emailVerificado: false,
        tokenVerificacion: "123456",
        tokenExpiracion: new Date(Date.now() + 3600000),
      });

      const encontrado = await UsuarioModel.buscarPorTokenVerificacion("123456");
      assert.ok(encontrado);
      assert.equal(encontrado.id, nuevo.id);

      const activado = await UsuarioModel.marcarEmailVerificado(nuevo.id);
      assert.equal(activado.emailVerificado, true);
      assert.ok(!activado.tokenVerificacion);
      assert.ok(!activado.tokenExpiracion);

      const yaNoEncuentra = await UsuarioModel.buscarPorTokenVerificacion("123456");
      assert.equal(yaNoEncuentra, null);
    });

    it("guardarTokenRecuperacion y restablecerPassword actualiza contraseña y limpia tokens", async () => {
      const nuevo = await UsuarioModel.crear({
        nombre: "Para Recuperar",
        email: "recuperar@example.test",
        password: "password123",
      });

      const exp = new Date(Date.now() + 3600000);
      await UsuarioModel.guardarTokenRecuperacion(nuevo.id, "token-recup-999", exp);

      const porToken = await UsuarioModel.buscarPorTokenRecuperacion("token-recup-999");
      assert.ok(porToken);
      assert.equal(porToken.id, nuevo.id);

      const restablecido = await UsuarioModel.restablecerPassword(nuevo.id, "nuevaPassword456");
      assert.ok(restablecido);
      assert.ok(!restablecido.tokenRecuperacion);

      // Comprobar que la nueva clave funciona
      const conClave = await UsuarioModel.buscarPorEmailConPassword("recuperar@example.test");
      const coincide = await bcrypt.compare("nuevaPassword456", conClave.password);
      assert.equal(coincide, true);
    });
  });

  describe("Fallback en memoria ante fallos de Prisma", () => {
    it("cuando Prisma falla, utiliza la memoria y emite una advertencia en consola", async () => {
      const origFindMany = prisma.usuario.findMany;
      prisma.usuario.findMany = async () => {
        throw new Error("Conexión perdida a PostgreSQL");
      };

      const warnings = [];
      const origWarn = console.warn;
      console.warn = (...args) => warnings.push(args.join(" "));

      try {
        const usuarios = await UsuarioModel.listarTodos("est-el-rancho");
        assert.ok(Array.isArray(usuarios));
        assert.ok(usuarios.length > 0);
        assert.ok(warnings.some((w) => w.includes("Fallo al consultar Prisma, usando fallback en memoria")));
      } finally {
        prisma.usuario.findMany = origFindMany;
        console.warn = origWarn;
      }
    });
  });
});
