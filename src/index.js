/**
 * Punto de entrada del bot.
 *
 * Soporta una ejecución inmediata de producción (`--now`), una ejecución
 * controlada de prueba (`--prueba`) y el modo daemon programado por cron.
 */
import cron from 'node-cron';
import os from 'os';
import { config } from './config.js';
import { ejecutarReporte, shutdown } from './report.js';

const runNow = process.argv.includes('--now');
const runPrueba = process.argv.includes('--prueba');

/**
 * Obtiene una IPv4 visible para facilitar la identificación del servidor en
 * los logs. No participa en conexiones ni se incluye en el reporte.
 *
 * @returns {string}
 */
function ipServidor() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

/**
 * Inicializa el modo solicitado y administra el ciclo de vida principal.
 *
 * El modo prueba tiene precedencia deliberada sobre `--now` para evitar un
 * envío productivo accidental cuando ambos argumentos están presentes.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const ip = ipServidor();
  console.log('Bot Vencimiento Cava — Colbeef');
  console.log(`Servidor: ${ip}`);
  console.log(`Programación: ${config.cronSchedule} (${config.timezone})`);
  console.log(`Destinatarios reporte: ${config.reportTo.join(', ') || '(ninguno)'}`);
  if (config.reportNotifyTo.length) {
    console.log(`Confirmación / prueba: ${config.reportNotifyTo.join(', ')}`);
  }

  if (runPrueba) {
    try {
      await ejecutarReporte({ modo: 'prueba' });
    } finally {
      await shutdown();
    }
    return;
  }

  if (runNow) {
    try {
      await ejecutarReporte();
    } finally {
      await shutdown();
    }
    return;
  }

  cron.schedule(
    config.cronSchedule,
    async () => {
      try {
        await ejecutarReporte();
      } catch (err) {
        // El fallo de una ejecución no debe detener futuras tareas del daemon.
        console.error('[CRON] Error en reporte:', err.message);
      }
    },
    { timezone: config.timezone }
  );

  console.log('Bot activo. Esperando próxima ejecución programada (5:59 AM)...');
  console.log('Prueba manual: npm run prueba');
}

main().catch(async (err) => {
  console.error('Error fatal:', err.message);
  await shutdown();
  process.exit(1);
});

// Permite detener limpiamente una ejecución interactiva con Ctrl+C.
process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});
