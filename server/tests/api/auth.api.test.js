/**
 * Tests de API — Autenticación y Sesión de Usuario (POST/GET /api/auth/*)
 * Evaluado contra la aplicación Express montada en memoria con Supertest.
 */
const { describe, it, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Inicializa variables de test (JWT_SECRET ficticio y DATABASE_URL aislada)
require("../helpers/tokens");

const { firmarToken, encabezadoBearer } = require("../helpers/tokens");
const { resetearMemoria } = require("../helpers/memoria");
const { assertSinSecretos } = require("../helpers/assertSinSecretos");
const app = require("../../src/index");
const db = require("../../src/config/db");
const emailService = require("../../src/services/email.service");

describe("API — /api/auth (Autenticación, Registro y Ciclo de Vida de Credenciales)", () => {
  before(() => {
    // Evitar llamadas SMTP o logs de consola en tests
    mock.method(emailService, "enviarEmailVerificacion", async () => ({ ok: true }));
    mock.method(emailService, "enviarEmailRecuperacion", async () => ({ ok: true }));
  });

  after(() => {
    mock.restoreAll();
  });

  beforeEach(() => {
    resetearMemoria();
  });

  describe("POST /api/auth/registro", () => {
    it("registro con datos válidos responde 201 y requiere verificación de correo", async () => {
      const res = await request(app)
        .post("/api/auth/registro")
        .send({
          nombre: "Nuevo Productor",
          email: "productor@example.test",
          password: "password123",
          establecimiento: "Estancia La Esperanza",
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.data.requiereVerificacion, true);
      assert.equal(res.body.data.email, "productor@example.test");
      assert.ok(res.body.data.usuario);
      assert.equal(res.body.data.usuario.password, undefined);
    });

    it("el body de la respuesta no contiene tokenVerificacion, password ni tokenExpiracion (R1)", async () => {
      const res = await request(app)
        .post("/api/auth/registro")
        .send({
          nombre: "Usuario Sin Secretos",
          email: "seguro@example.test",
          password: "password123",
        });

      assert.equal(res.status, 201);
      assertSinSecretos(res.body);
    });

    it("intento de escalada: usuario no puede registrarse como dueño de un tenant ajeno (R2)", async () => {
      const res = await request(app)
        .post("/api/auth/registro")
        .send({
          nombre: "Atacante Tenant",
          email: "atacante@example.test",
          password: "password123",
          rol: "dueno",
          establecimientoId: "est-el-rancho", // Tenant ajeno preexistente
        });

      assert.equal(res.status, 201);
      // El nuevo usuario no debe haber sido asignado al establecimiento existente ajeno
      assert.notEqual(res.body.data.usuario.establecimientoId, "est-el-rancho");
    });

    it("rechaza registro con email duplicado", async () => {
      const res = await request(app)
        .post("/api/auth/registro")
        .send({
          nombre: "Duplicado",
          email: "dueno@vakera.com", // Ya existente en el seed
          password: "password123",
        });

      // El código de negocio actual responde 400 ante errores de creación
      assert.ok(res.status === 400 || res.status === 409);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /Ya existe un usuario/i);
    });

    it("rechaza registro con password de menos de 6 caracteres", async () => {
      const res = await request(app)
        .post("/api/auth/registro")
        .send({
          nombre: "Password Corta",
          email: "corta@example.test",
          password: "12345",
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /al menos 6 caracteres/i);
    });

    it("rechaza registro con formato de email inválido", async () => {
      const res = await request(app)
        .post("/api/auth/registro")
        .send({
          nombre: "Email Malo",
          email: "no-es-un-email",
          password: "password123",
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /formato del correo/i);
    });

    it("rechaza registro con body vacío o campos obligatorios faltantes", async () => {
      const res = await request(app).post("/api/auth/registro").send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /obligatorios/i);
    });
  });

  describe("POST /api/auth/login", () => {
    it("login exitoso con credenciales válidas y cuenta verificada retorna token y datos", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "dueno@vakera.com",
          password: "password123",
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.ok(res.body.data.token);
      assert.ok(res.body.data.usuario);
      assert.equal(res.body.data.usuario.password, undefined);
      assert.equal(res.body.data.usuario.email, "dueno@vakera.com");

      // Validar decodificación y estructura del token JWT
      const decodificado = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
      assert.equal(decodificado.id, "usr-1");
      assert.equal(decodificado.rol, "dueno");
      assert.equal(decodificado.establecimientoId, "est-el-rancho");
    });

    it("la respuesta de login no expone secretos ni tokens en el objeto usuario (R6)", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "dueno@vakera.com",
          password: "password123",
        });

      assert.equal(res.status, 200);
      assertSinSecretos(res.body.data.usuario);
    });

    it("credenciales incorrectas: usuario inexistente responde 401 con mensaje genérico", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "noexiste@example.test",
          password: "password123",
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.ok, false);
      assert.equal(res.body.error, "Credenciales incorrectas.");
    });

    it("credenciales incorrectas: password errónea responde 401 con mensaje idéntico (anti-enumeración)", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "dueno@vakera.com",
          password: "clave_totalmente_incorrecta",
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.ok, false);
      assert.equal(res.body.error, "Credenciales incorrectas.");
    });

    it("usuario con cuenta no verificada responde 403 con requiereVerificacion: true", async () => {
      // Crear un usuario con emailVerificado = false
      const usrNoVerif = db.usuarios.find((u) => u.id === "usr-3");
      usrNoVerif.emailVerificado = false;

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "peon@vakera.com",
          password: "password123",
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.ok, false);
      assert.equal(res.body.detalles?.requiereVerificacion, true);
    });

    it("login normaliza email con mayúsculas y espacios extremos", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "  DUENO@VAKERA.COM  ",
          password: "password123",
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.data.usuario.email, "dueno@vakera.com");
    });

    it("login sin email o sin password responde 400", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "dueno@vakera.com" });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
    });
  });

  describe("POST / GET /api/auth/verificar-email", () => {
    it("POST con código válido activa la cuenta y responde 200 con token de sesión", async () => {
      const target = db.usuarios.find((u) => u.id === "usr-3");
      target.emailVerificado = false;
      target.tokenVerificacion = "654321";
      target.tokenExpiracion = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

      const res = await request(app)
        .post("/api/auth/verificar-email")
        .send({ token: "654321" });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.usuario.emailVerificado, true);

      // Comprobar que el usuario ahora puede autenticarse
      const checkDb = db.usuarios.find((u) => u.id === "usr-3");
      assert.equal(checkDb.emailVerificado, true);
      assert.equal(checkDb.tokenVerificacion, null);
    });

    it("GET con query token activa la cuenta correctamente", async () => {
      const target = db.usuarios.find((u) => u.id === "usr-2");
      target.emailVerificado = false;
      target.tokenVerificacion = "789123";
      target.tokenExpiracion = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

      const res = await request(app)
        .get("/api/auth/verificar-email?token=789123");

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.data.usuario.emailVerificado, true);
    });

    it("código inválido o ya utilizado responde 400", async () => {
      const res = await request(app)
        .post("/api/auth/verificar-email")
        .send({ token: "token_falso_o_usado" });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /inválido o ya ha sido utilizado/i);
    });

    it("código vencido (+24h) responde 400 con expirado: true utilizando mock.timers", async () => {
      const target = db.usuarios.find((u) => u.id === "usr-3");
      target.emailVerificado = false;
      target.tokenVerificacion = "999888";
      // Expiración fijada para dentro de 10 minutos
      target.tokenExpiracion = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Habilitar reloj falso preservando la hora actual y avanzar 20 minutos (superando la expiración)
      const now = Date.now();
      mock.timers.enable({ apis: ["Date"], now });
      try {
        mock.timers.tick(20 * 60 * 1000);

        const res = await request(app)
          .post("/api/auth/verificar-email")
          .send({ token: "999888" });

        assert.equal(res.status, 400);
        assert.equal(res.body.ok, false);
        assert.equal(res.body.detalles?.expirado, true);
      } finally {
        mock.timers.reset();
      }
    });

    it("petición sin token responde 400", async () => {
      const res = await request(app).post("/api/auth/verificar-email").send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /obligatorio/i);
    });
  });

  describe("POST /api/auth/reenviar-verificacion", () => {
    it("reenvío exitoso para cuenta existente no verificada responde 200", async () => {
      const target = db.usuarios.find((u) => u.id === "usr-3");
      target.emailVerificado = false;

      const res = await request(app)
        .post("/api/auth/reenviar-verificacion")
        .send({ email: "peon@vakera.com" });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.data.email, "peon@vakera.com");
      assert.ok(target.tokenVerificacion);
    });

    it("reenvío para cuenta que ya está verificada responde 400", async () => {
      const res = await request(app)
        .post("/api/auth/reenviar-verificacion")
        .send({ email: "dueno@vakera.com" });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /ya está verificada/i);
    });

    it("reenvío para correo inexistente responde 404", async () => {
      const res = await request(app)
        .post("/api/auth/reenviar-verificacion")
        .send({ email: "fantasma@example.test" });

      assert.equal(res.status, 404);
      assert.equal(res.body.ok, false);
    });

    it("reenvío sin email responde 400", async () => {
      const res = await request(app).post("/api/auth/reenviar-verificacion").send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
    });
  });

  describe("POST /api/auth/solicitar-recuperacion", () => {
    it("solicitud para correo existente responde 200 neutral y guarda token", async () => {
      const res = await request(app)
        .post("/api/auth/solicitar-recuperacion")
        .send({ email: "dueno@vakera.com" });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);

      const target = db.usuarios.find((u) => u.id === "usr-1");
      assert.ok(target.tokenRecuperacion);
      assert.ok(target.expiracionRecuperacion);
    });

    it("solicitud para correo inexistente responde 200 neutral idéntico (anti-enumeración)", async () => {
      const res = await request(app)
        .post("/api/auth/solicitar-recuperacion")
        .send({ email: "desconocido@example.test" });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.match(res.body.mensaje, /Si el correo se encuentra registrado/i);
    });

    it("solicitud sin email responde 400", async () => {
      const res = await request(app).post("/api/auth/solicitar-recuperacion").send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
    });

    it("R8: documentar ausencia de rate limiting en recuperación de contraseña", { todo: "R8: falta protección de rate limiting contra fuerza bruta" }, async () => {
      // 10 solicitudes consecutivas sin ser bloqueadas por 429
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post("/api/auth/solicitar-recuperacion")
          .send({ email: "dueno@vakera.com" });
        if (res.status === 429) {
          assert.fail("Existe rate limiting (R8 resuelto)");
        }
      }
      assert.fail("No hay limitación de tasa (R8 activo)");
    });
  });

  describe("POST /api/auth/restablecer-password", () => {
    it("restablecimiento exitoso con token válido actualiza contraseña y devuelve sesión", async () => {
      const target = db.usuarios.find((u) => u.id === "usr-2");
      target.tokenRecuperacion = "token-recup-123456";
      target.expiracionRecuperacion = new Date(Date.now() + 3600000).toISOString();

      const res = await request(app)
        .post("/api/auth/restablecer-password")
        .send({
          token: "token-recup-123456",
          nuevaPassword: "nuevaPasswordSegura2026",
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.ok(res.body.data.token);

      // Iniciar sesión con la nueva credencial
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          email: "capataz@vakera.com",
          password: "nuevaPasswordSegura2026",
        });

      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.body.ok, true);
    });

    it("token de recuperación inexistente o ya usado responde 400", async () => {
      const res = await request(app)
        .post("/api/auth/restablecer-password")
        .send({
          token: "token_invalido",
          nuevaPassword: "nuevaPassword123",
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
    });

    it("token de recuperación vencido (+1h) responde 400", async () => {
      const target = db.usuarios.find((u) => u.id === "usr-2");
      target.tokenRecuperacion = "token-expirado";
      target.expiracionRecuperacion = new Date(Date.now() + 5000).toISOString();

      const now = Date.now();
      mock.timers.enable({ apis: ["Date"], now });
      try {
        mock.timers.tick(60000); // 1 minuto después ya está vencido

        const res = await request(app)
          .post("/api/auth/restablecer-password")
          .send({
            token: "token-expirado",
            nuevaPassword: "nuevaPassword123",
          });

        assert.equal(res.status, 400);
        assert.equal(res.body.ok, false);
        assert.match(res.body.error, /ha expirado/i);
      } finally {
        mock.timers.reset();
      }
    });

    it("rechaza restablecimiento con password de menos de 6 caracteres", async () => {
      const res = await request(app)
        .post("/api/auth/restablecer-password")
        .send({
          token: "cualquier-token",
          nuevaPassword: "123",
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /al menos 6 caracteres/i);
    });
  });

  describe("GET /api/auth/me y authMiddleware", () => {
    it("con token válido responde 200 y retorna el usuario autenticado", async () => {
      const token = firmarToken({ id: "usr-1", rol: "dueno" });

      const res = await request(app)
        .get("/api/auth/me")
        .set(encabezadoBearer(token));

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.data.usuario.id, "usr-1");
      assert.equal(res.body.data.usuario.password, undefined);
    });

    it("/me no expone secretos ni tokens en el cuerpo de respuesta (R6)", async () => {
      const token = firmarToken({ id: "usr-1", rol: "dueno" });

      const res = await request(app)
        .get("/api/auth/me")
        .set(encabezadoBearer(token));

      assert.equal(res.status, 200);
      assertSinSecretos(res.body);
    });

    it("sin token responde 401", async () => {
      const res = await request(app).get("/api/auth/me");

      assert.equal(res.status, 401);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /no proporcionado/i);
    });

    it("con token expirado responde 401", async () => {
      const tokenVencido = firmarToken({ id: "usr-1", expiresIn: -10 });

      const res = await request(app)
        .get("/api/auth/me")
        .set(encabezadoBearer(tokenVencido));

      assert.equal(res.status, 401);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /expirado/i);
    });

    it("con token firmado con otro secreto responde 401", async () => {
      const tokenFirmadoFalso = firmarToken({ id: "usr-1", secret: "secreto_totalmente_distinto" });

      const res = await request(app)
        .get("/api/auth/me")
        .set(encabezadoBearer(tokenFirmadoFalso));

      assert.equal(res.status, 401);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /inválido/i);
    });

    it("con token de usuario eliminado/inexistente responde 401", async () => {
      const tokenUsuarioBorrado = firmarToken({ id: "usr-eliminado-999" });

      const res = await request(app)
        .get("/api/auth/me")
        .set(encabezadoBearer(tokenUsuarioBorrado));

      assert.equal(res.status, 401);
      assert.equal(res.body.ok, false);
      assert.match(res.body.error, /el usuario ya no existe/i);
    });

    it("authMiddleware rechaza header sin prefijo Bearer con 401", async () => {
      const token = firmarToken({ id: "usr-1" });

      const res = await request(app)
        .get("/api/auth/me")
        .set({ Authorization: `Basic ${token}` });

      assert.equal(res.status, 401);
      assert.equal(res.body.ok, false);
    });

    it("authMiddleware rechaza Bearer sin token con 401", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set({ Authorization: "Bearer " });

      assert.equal(res.status, 401);
      assert.equal(res.body.ok, false);
    });

    it("authMiddleware rechaza token con alg: none con 401", async () => {
      // Token sin firma con algoritmo none
      const headerB64 = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
      const payloadB64 = Buffer.from(JSON.stringify({ id: "usr-1", rol: "dueno" })).toString("base64url");
      const noneToken = `${headerB64}.${payloadB64}.`;

      const res = await request(app)
        .get("/api/auth/me")
        .set({ Authorization: `Bearer ${noneToken}` });

      assert.equal(res.status, 401);
      assert.equal(res.body.ok, false);
    });
  });
});
