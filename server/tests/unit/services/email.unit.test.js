/**
 * Tests Unitarios — EmailService (Despacho de Correos y Contingencia Emulada)
 *
 * Fase 3C del Implementation Plan:
 * - Operación predeterminada en modo emulado sin credenciales SMTP configuradas.
 * - Despacho de correo de activación de cuenta con código de 6 dígitos y URL firmada.
 * - Despacho de correo de recuperación de contraseña con token y enlace directo.
 * - Resiliencia ante fallos del transporte SMTP (captura de errores y no propagación).
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const emailService = require("../../../src/services/email.service");

describe("Unitario — EmailService (Mensajería y Modo Emulado)", () => {
  let smtpUserOriginal;
  let smtpPassOriginal;

  beforeEach(() => {
    smtpUserOriginal = process.env.SMTP_USER;
    smtpPassOriginal = process.env.SMTP_PASS;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  afterEach(() => {
    process.env.SMTP_USER = smtpUserOriginal;
    process.env.SMTP_PASS = smtpPassOriginal;
  });

  describe("1. Envío de Email de Verificación", () => {
    it("opera en modo emulado cuando no hay SMTP configurado y no lanza excepciones", async () => {
      const res = await emailService.enviarEmailVerificacion({
        email: "productor@vakera.test",
        nombre: "Juan Ganadero",
        token: "849201",
      });

      assert.equal(res.enviado, true);
      assert.equal(res.modo, "emulado");
      assert.equal(res.token, "849201");
      assert.ok(res.link.includes("token=849201"));
      assert.ok(res.link.includes("productor%40vakera.test"));
    });
  });

  describe("2. Envío de Email de Recuperación de Contraseña", () => {
    it("genera enlace y token de recuperación sin fallar en modo emulado", async () => {
      const res = await emailService.enviarEmailRecuperacion({
        email: "recuperar@vakera.test",
        nombre: "María Directora",
        token: "192837",
      });

      assert.equal(res.enviado, true);
      assert.equal(res.modo, "emulado");
      assert.equal(res.token, "192837");
      assert.ok(res.link.includes("token=192837"));
      assert.ok(res.link.includes("recuperar%40vakera.test"));
    });
  });

  describe("3. Resiliencia ante fallos del Transporte SMTP", () => {
    it("si el transporter falla al enviar correo, captura el error y retorna modo emulado", async () => {
      emailService.modoEmulado = false;
      emailService.transporter = {
        sendMail: async () => {
          throw new Error("SMTP_CONNECTION_REFUSED: Servidor de correo caído");
        },
      };

      const res = await emailService.enviarEmailVerificacion({
        email: "fallo@vakera.test",
        nombre: "Test Fallo",
        token: "999888",
      });

      // No debe lanzar la excepción, sino degradar a modo emulado
      assert.equal(res.enviado, true);
      assert.equal(res.modo, "emulado");
      assert.equal(res.token, "999888");
    });
  });
});

