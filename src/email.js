/**
 * Adaptador de salida SMTP.
 *
 * Centraliza la construcción del mensaje, el adjunto y las variantes de
 * distribución. Recibe únicamente datos procesados; no consulta la base ni
 * aplica reglas de vencimiento.
 */
import nodemailer from 'nodemailer';
import { readFile } from 'fs/promises';
import { config } from './config.js';

/**
 * Construye el resumen HTML que acompaña al archivo detallado.
 *
 * @param {object} input
 * @returns {string}
 */
function cuerpoHtmlReporte({ fechaReporte, resumen, titulo, esPrueba = false }) {
  const fila = (label, val, bg) =>
    `<tr${bg ? ` style="background:${bg}"` : ''}><td>${label}</td><td align="center"><strong>${val}</strong></td></tr>`;
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#333;">
      <h2 style="color:#259c39;">${titulo}</h2>
      ${esPrueba ? '<p style="background:#fff9c4;padding:10px;border-radius:6px;"><strong>Modo prueba.</strong> Revise los datos antes del envío automático a gerencia.</p>' : ''}
      <p>Fecha del reporte: <strong>${fechaReporte}</strong></p>
      <p>Vence <strong>mañana</strong> (${resumen.fManana}) · <strong>Pasado mañana</strong> (${resumen.fPasado})</p>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:12px 0;">
        <tr style="background:#259c39;color:white;"><th colspan="2">Productos en cava</th></tr>
        ${fila('Total próximos a vencer', resumen.totalProductos)}
        ${fila('Mañana', resumen.mananaProductos, '#ffe0b2')}
        ${fila('Pasado mañana', resumen.pasadoProductos, '#e3f2fd')}
        ${fila('Media canal — día 8 en cava', resumen.dia8Media ?? 0, '#fff9c4')}
        ${fila('Media canal — día 10 en cava', resumen.dia10Media ?? 0, '#ffcdd2')}
      </table>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:12px 0;">
        <tr style="background:#259c39;color:white;"><th colspan="2">Cortes en cava</th></tr>
        ${fila('Total próximos a vencer', resumen.totalCortes)}
        ${fila('Mañana', resumen.mananaCortes, '#ffe0b2')}
        ${fila('Pasado mañana', resumen.pasadoCortes, '#e3f2fd')}
      </table>
      ${resumen.porTipo.length ? `
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
          <tr style="background:#1b5e20;color:white;"><th>Tipo producto</th><th>Cantidad</th></tr>
          ${resumen.porTipo.map((r) => `<tr><td>${r.tipo}</td><td align="center">${r.cantidad}</td></tr>`).join('')}
        </table>
      ` : '<p>No hay productos que venzan mañana o pasado mañana.</p>'}
      <p style="margin-top:1.5rem;color:#666;font-size:12px;">
        Archivo Excel adjunto con resumen, tablas por propietario y detalle por código.
      </p>
    </div>
  `;
}

/**
 * Crea un transportador por operación.
 *
 * El puerto 465 se considera SMTP seguro implícito. La política de TLS se
 * conserva compatible con la configuración histórica del bot.
 *
 * @returns {import('nodemailer').Transporter}
 */
function crearTransportador() {
  const { smtp } = config;
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465 || !smtp.useTls,
    auth: {
      user: smtp.user,
      pass: smtp.password,
    },
    tls: smtp.useTls ? { rejectUnauthorized: false } : undefined,
  });
}

/**
 * Envía el reporte con su Excel adjunto a la lista indicada.
 *
 * @param {object} input
 * @param {string} input.rutaExcel
 * @param {string} input.nombreArchivo
 * @param {Record<string, any>} input.resumen
 * @param {string} input.fechaReporte
 * @param {string[]} [input.destinatarios=config.reportTo]
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
export async function enviarReporte({ rutaExcel, nombreArchivo, resumen, fechaReporte, destinatarios = config.reportTo }) {
  if (!destinatarios.length) {
    throw new Error('No hay destinatarios configurados para el reporte.');
  }

  const transport = crearTransportador();
  const contenido = await readFile(rutaExcel);

  const html = cuerpoHtmlReporte({ fechaReporte, resumen, titulo: 'Reporte diario — Vencimiento en cava' });

  const info = await transport.sendMail({
    from: `"${config.smtp.fromName}" <${config.smtp.from}>`,
    to: destinatarios.join(', '),
    subject: `Reporte cava ${fechaReporte} — ${resumen.mananaProductos + resumen.pasadoProductos} productos / ${resumen.totalCortes} cortes próximos`,
    html,
    attachments: [
      {
        filename: nombreArchivo,
        content: contenido,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
  });

  return info;
}

/**
 * Envía el Excel completo solo a los destinatarios de notificación.
 *
 * El asunto y el cuerpo quedan marcados para impedir que se confunda con una
 * distribución productiva.
 */
export async function enviarReportePrueba({ rutaExcel, nombreArchivo, resumen, fechaReporte }) {
  if (!config.reportNotifyTo.length) {
    throw new Error('REPORT_NOTIFY_TO está vacío. Configure desarrollo.tecnologia@colbeef.com en .env');
  }

  const transport = crearTransportador();
  const contenido = await readFile(rutaExcel);

  const html = cuerpoHtmlReporte({
    fechaReporte,
    resumen,
    titulo: 'Reporte de prueba — Vencimiento en cava',
    esPrueba: true,
  });

  return transport.sendMail({
    from: `"${config.smtp.fromName}" <${config.smtp.from}>`,
    to: config.reportNotifyTo.join(', '),
    subject: `[PRUEBA] Reporte cava ${fechaReporte} — ${resumen.totalProductos} productos / ${resumen.totalCortes} cortes`,
    html,
    attachments: [
      {
        filename: nombreArchivo,
        content: contenido,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
  });
}

/** Une destinatarios principales y de notificación sin repetir direcciones. */
function destinatariosReporteCompleto() {
  return [...new Set([...config.reportTo, ...config.reportNotifyTo])];
}

/**
 * Ejecuta la distribución productiva y, después de su éxito, envía una
 * confirmación separada. Nunca confirma un reporte principal fallido.
 */
export async function enviarReporteConConfirmacion({ rutaExcel, nombreArchivo, resumen, fechaReporte }) {
  const transport = crearTransportador();
  const todos = destinatariosReporteCompleto();
  const reporte = await enviarReporte({
    rutaExcel,
    nombreArchivo,
    resumen,
    fechaReporte,
    destinatarios: todos,
  });

  let confirmacion = null;
  if (config.reportNotifyTo.length) {
    confirmacion = await enviarConfirmacionEnvio({
      transport,
      fechaReporte,
      destinatariosReporte: todos,
      resumen,
      nombreArchivo,
    });
  }

  return { reporte, confirmacion, destinatarios: todos };
}

/**
 * Notifica a desarrollo/tecnología que el correo principal fue aceptado por
 * el servidor SMTP. Los destinatarios de notificación ya reciben el adjunto en
 * el envío principal.
 */
export async function enviarConfirmacionEnvio({
  transport,
  fechaReporte,
  destinatariosReporte,
  resumen,
  nombreArchivo,
}) {
  const transportador = transport || crearTransportador();
  const lista = destinatariosReporte.map((e) => `<li>${e}</li>`).join('');

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#333;">
      <h2 style="color:#259c39;">Confirmación de envío — Reporte cava</h2>
      <p>El reporte del <strong>${fechaReporte}</strong> se envió correctamente a los siguientes correos:</p>
      <ul>${lista}</ul>
      <p><strong>Archivo:</strong> ${nombreArchivo}</p>
      <p><strong>Contenido:</strong> ${resumen.totalProductos} productos próximos (mañana: ${resumen.mananaProductos}, pasado mañana: ${resumen.pasadoProductos}) · ${resumen.totalCortes} cortes próximos</p>
      <p style="color:#666;font-size:12px;">Mensaje automático de Sistema Reportes — Colbeef.</p>
    </div>
  `;

  return transportador.sendMail({
    from: `"${config.smtp.fromName}" <${config.smtp.from}>`,
    to: config.reportNotifyTo.join(', '),
    subject: `✓ Reporte cava enviado — ${fechaReporte}`,
    html,
  });
}

/**
 * Comprueba conexión, seguridad y autenticación SMTP sin enviar mensajes.
 *
 * @returns {Promise<void>}
 */
export async function verificarSmtp() {
  const transport = crearTransportador();
  await transport.verify();
}
