/**
 * Servicio de Envío de Correos Electrónicos para Vakera.
 * 
 * Soporta envío real a Gmail (u otros proveedores SMTP) o modo emulado en consola.
 * Si SMTP_USER y SMTP_PASS están presentes en el archivo .env, despacha
 * correos reales a través de Nodemailer hacia cualquier casilla (Gmail, Hotmail, etc.).
 */
const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = null;
    this.modoEmulado = true;
    this.inicializarTransporte();
  }

  inicializarTransporte() {
    // Releer variables de entorno
    if (typeof process.loadEnvFile === "function") {
      try { process.loadEnvFile(); } catch (_) {}
    }

    const { SMTP_SERVICE, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (SMTP_USER && SMTP_PASS && SMTP_PASS.trim() !== "") {
      try {
        const esGmail = SMTP_SERVICE === "gmail" || (SMTP_USER && SMTP_USER.includes("@gmail.com"));

        const configTransporte = esGmail
          ? {
              service: "gmail",
              auth: {
                user: SMTP_USER.trim(),
                pass: SMTP_PASS.trim(),
              },
            }
          : {
              host: SMTP_HOST || "smtp.gmail.com",
              port: Number(SMTP_PORT) || 587,
              secure: Number(SMTP_PORT) === 465,
              auth: {
                user: SMTP_USER.trim(),
                pass: SMTP_PASS.trim(),
              },
            };

        this.transporter = nodemailer.createTransport(configTransporte);
        this.modoEmulado = false;
      } catch (err) {
        console.warn("! Error inicializando transporte de email. Se usará modo consola:", err.message);
        this.modoEmulado = true;
      }
    } else {
      this.transporter = null;
      this.modoEmulado = true;
    }
  }

  /**
   * Envía correo de activación de cuenta con código de 6 dígitos y enlace directo.
   */
  async enviarEmailVerificacion({ email, nombre, token, urlBase = "http://localhost:5173" }) {
    this.inicializarTransporte();
    const linkVerificacion = `${urlBase}/?ruta=verificar&token=${token}&email=${encodeURIComponent(email)}`;
    const asunto = "Activa tu cuenta en Vakera Ganadería";

    const remitente = process.env.SMTP_FROM || (process.env.SMTP_USER ? `"Vakera Ganadería" <${process.env.SMTP_USER}>` : '"Vakera Ganadería" <no-reply@vakera.com>');

    const contenidoHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #2e7d32; margin: 0; font-size: 24px; letter-spacing: 1px;">VAKERA GANADERÍA</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Sistema de Gestión y Trazabilidad de Hacienda</p>
        </div>

        <p style="color: #334155; font-size: 16px;">Hola <strong>${nombre || "Productor"}</strong>,</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.5;">
          Gracias por registrarte en Vakera. Para activar tu cuenta e ingresar a tu establecimiento ganadero, utilizá el siguiente código de activación:
        </p>

        <div style="text-align: center; margin: 28px 0; background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 8px; padding: 18px;">
          <p style="margin: 0 0 8px; font-size: 13px; color: #166534; font-weight: bold; text-transform: uppercase;">Tu Código de Activación</p>
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #15803d; font-family: monospace;">
            ${token}
          </div>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${linkVerificacion}" style="background-color: #2e7d32; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 15px;">
            Activar Cuenta Directamente
          </a>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px;">
          Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br />
          <a href="${linkVerificacion}" style="color: #0284c7; word-break: break-all; font-size: 12px;">${linkVerificacion}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          Este código expira en 24 horas. Si vos no creaste esta cuenta, podés ignorar este correo con total tranquilidad.
        </p>
      </div>
    `;

    if (!this.modoEmulado && this.transporter) {
      try {
        await this.transporter.sendMail({
          from: remitente,
          to: email,
          subject: asunto,
          html: contenidoHtml,
        });
        console.log(`✓ Correo de activación despachado con éxito a: ${email}`);
        return { enviado: true, modo: "smtp", link: linkVerificacion };
      } catch (err) {
        console.warn(`! Fallo al enviar por Gmail/SMTP (${err.message}). Registrando en consola:`);
      }
    }

    // Modo consola informativa de respaldo
    console.log("\n==================================================================");
    console.log(" [CORREO VAKERA] ACTIVACIÓN DE CUENTA");
    console.log(` Para: ${nombre} <${email}>`);
    console.log(` Código de 6 dígitos: ${token}`);
    console.log(` Enlace directo: ${linkVerificacion}`);
    console.log("==================================================================\n");

    return { enviado: true, modo: "emulado", token, link: linkVerificacion };
  }

  /**
   * Envía correo de restablecimiento de contraseña con código de 6 dígitos y enlace.
   */
  async enviarEmailRecuperacion({ email, nombre, token, urlBase = "http://localhost:5173" }) {
    this.inicializarTransporte();
    const linkRecuperacion = `${urlBase}/?ruta=recuperar&token=${token}&email=${encodeURIComponent(email)}`;
    const asunto = "Restablece tu contraseña en Vakera Ganadería";

    const remitente = process.env.SMTP_FROM || (process.env.SMTP_USER ? `"Vakera Ganadería" <${process.env.SMTP_USER}>` : '"Vakera Ganadería" <no-reply@vakera.com>');

    const contenidoHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1e3a8a; margin: 0; font-size: 24px; letter-spacing: 1px;">VAKERA GANADERÍA</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Recuperación Segura de Acceso</p>
        </div>

        <p style="color: #334155; font-size: 16px;">Hola <strong>${nombre || "Productor"}</strong>,</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.5;">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta ganadera. Utilizá el siguiente código de seguridad en la aplicación:
        </p>

        <div style="text-align: center; margin: 28px 0; background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 8px; padding: 18px;">
          <p style="margin: 0 0 8px; font-size: 13px; color: #1e40af; font-weight: bold; text-transform: uppercase;">Código de Recuperación</p>
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #1d4ed8; font-family: monospace;">
            ${token}
          </div>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${linkRecuperacion}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 15px;">
            Restablecer Contraseña Directamente
          </a>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px;">
          O copiá este enlace en tu navegador:<br />
          <a href="${linkRecuperacion}" style="color: #2563eb; word-break: break-all; font-size: 12px;">${linkRecuperacion}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          Este código expira en 1 hora. Si vos no solicitaste este cambio, podés ignorar este correo y tu contraseña permanecerá segura.
        </p>
      </div>
    `;

    if (!this.modoEmulado && this.transporter) {
      try {
        await this.transporter.sendMail({
          from: remitente,
          to: email,
          subject: asunto,
          html: contenidoHtml,
        });
        console.log(`✓ Correo de recuperación despachado con éxito a: ${email}`);
        return { enviado: true, modo: "smtp", link: linkRecuperacion };
      } catch (err) {
        console.warn(`! Fallo al enviar por Gmail/SMTP (${err.message}). Registrando en consola:`);
      }
    }

    console.log("\n==================================================================");
    console.log(" [CORREO VAKERA] RECUPERACIÓN DE CONTRASEÑA");
    console.log(` Para: ${nombre} <${email}>`);
    console.log(` Código de 6 dígitos: ${token}`);
    console.log(` Enlace directo: ${linkRecuperacion}`);
    console.log("==================================================================\n");

    return { enviado: true, modo: "emulado", token, link: linkRecuperacion };
  }

  /**
   * Envía al equipo de soporte (soporte.vakera@gmail.com) el mensaje recibido desde el formulario de contacto.
   */
  async enviarEmailContacto({
    nombre,
    email,
    telefono = null,
    mensaje,
    destino = process.env.CONTACTO_DESTINO_EMAIL || "soporte.vakera@gmail.com",
  }) {
    this.inicializarTransporte();
    const escapar = (val) =>
      String(val || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const remitente =
      process.env.SMTP_FROM ||
      (process.env.SMTP_USER
        ? `"Vakera Ganadería" <${process.env.SMTP_USER}>`
        : '"Vakera Ganadería" <no-reply@vakera.com>');
    const asunto = `[Contacto Vakera] Nuevo mensaje de ${nombre}`;

    const contenidoHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #2e7d32; margin: 0; font-size: 22px; letter-spacing: 1px;">VAKERA GANADERÍA</h1>
          <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Nuevo mensaje desde el formulario de contacto</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 14px; color: #334155;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 110px;">Nombre:</td>
            <td style="padding: 8px 0;">${escapar(nombre)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Correo:</td>
            <td style="padding: 8px 0;"><a href="mailto:${escapar(email)}" style="color: #2e7d32;">${escapar(email)}</a></td>
          </tr>
          ${
            telefono
              ? `<tr><td style="padding: 8px 0; font-weight: bold;">Teléfono:</td><td style="padding: 8px 0;">${escapar(telefono)}</td></tr>`
              : ""
          }
        </table>

        <div style="background: #f8fafc; border-left: 4px solid #8fb56b; padding: 14px 16px; border-radius: 6px; color: #1e293b; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapar(mensaje)}</div>
      </div>
    `;

    if (!this.modoEmulado && this.transporter) {
      try {
        await this.transporter.sendMail({
          from: remitente,
          to: destino,
          replyTo: email,
          subject: asunto,
          html: contenidoHtml,
        });
        console.log(`✓ Mensaje de contacto enviado a ${destino} (de: ${email})`);
        return { enviado: true, modo: "smtp", destino };
      } catch (err) {
        console.warn(`! Fallo al enviar contacto por Gmail/SMTP (${err.message}). Registrando en consola:`);
      }
    }

    console.log("\n==================================================================");
    console.log(" [CORREO VAKERA] MENSAJE DE CONTACTO");
    console.log(` Para: ${destino}`);
    console.log(` De: ${nombre} <${email}>`);
    console.log(` Mensaje: ${mensaje}`);
    console.log("==================================================================\n");

    return { enviado: true, modo: "emulado", destino };
  }
}

module.exports = new EmailService();
